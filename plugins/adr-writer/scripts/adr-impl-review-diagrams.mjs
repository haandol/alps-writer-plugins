import { createHash } from "node:crypto";

const ID = "[A-Za-z0-9_][A-Za-z0-9_.-]*";
const NODE = `(${ID})(\\["[^"]*"\\]|\\[[^\\]]+\\]|\\{"[^"]*"\\}|\\{[^}]+\\}|\\("[^"]*"\\)|\\([^)]+\\))?`;
/** Treat diagram labels as text so generated SVG and source views cannot execute markup. */
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
/** Preserve authored line breaks while removing only Mermaid's outer label quotes. */
const label = (value) =>
  String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/^"(.*)"$/, "$1");

/**
 * Read a deliberately small Mermaid subset shared by validation and rendering.
 * Unknown statements fail the whole diagram; no relationship is silently dropped.
 */
export function parseMermaid(source) {
  const lines = String(source ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"));
  const [declaration, ...body] = lines;
  try {
    if (declaration === "sequenceDiagram") return parseSequence(body);
    if (/^(flowchart|graph) (LR|RL|TD|TB|BT)$/.test(declaration)) {
      return parseGraph(body, declaration.split(" ")[1]);
    }
    if (declaration === "stateDiagram-v2") return parseState(body);
    if (declaration === "erDiagram") return parseEntities(body);
    throw new Error(`Unsupported diagram declaration: ${declaration || "(empty)"}`);
  } catch (error) {
    return { error: error.message };
  }
}

/** Preserve nesting, participants, and message arrows before laying out time. */
function parseSequence(lines) {
  const participants = new Map();
  const events = [];
  const stack = [];
  let current = events;
  /** Reuse participant identity while allowing a later declaration to supply its display name. */
  const participant = (id, name = id) => {
    if (!participants.has(id) || name !== id) participants.set(id, label(name));
  };
  for (const line of lines) {
    let match = line.match(new RegExp(`^(?:participant|actor) (${ID})(?: as (.+))?$`));
    if (match) {
      participant(match[1], match[2]);
      continue;
    }
    match = line.match(/^(alt|opt|loop|par)\b\s*(.*)$/);
    if (match) {
      const block = { kind: "block", type: match[1], branches: [{ label: match[2], events: [] }] };
      current.push(block);
      stack.push({ block, parent: current });
      current = block.branches[0].events;
      continue;
    }
    match = line.match(/^(else|and)\b\s*(.*)$/);
    if (match) {
      const frame = stack.at(-1);
      if (
        !frame ||
        (match[1] === "else" ? frame.block.type !== "alt" : frame.block.type !== "par")
      ) {
        throw new Error(`Unmatched sequence branch: ${line}`);
      }
      const branch = { label: match[2] || match[1], events: [] };
      frame.block.branches.push(branch);
      current = branch.events;
      continue;
    }
    if (line === "end") {
      if (!stack.length) throw new Error("Unmatched sequence end");
      current = stack.pop().parent;
      continue;
    }
    match = line.match(
      new RegExp(`^Note (over|left of|right of) (${ID}(?:\\s*,\\s*${ID})?)\\s*:\\s*(.+)$`, "i"),
    );
    if (match) {
      const ids = match[2].split(/\s*,\s*/);
      ids.forEach((id) => participant(id));
      current.push({
        kind: "note",
        placement: match[1],
        participants: ids,
        label: label(match[3]),
      });
      continue;
    }
    match = line.match(new RegExp(`^(${ID}?)\\s*(-->>|->>|-->|->)\\s*(${ID})\\s*:\\s*(.+)$`));
    if (!match) throw new Error(`Unsupported sequence statement: ${line}`);
    participant(match[1]);
    participant(match[3]);
    current.push({
      kind: "message",
      from: match[1],
      to: match[3],
      arrow: match[2],
      label: label(match[4]),
    });
  }
  if (stack.length) throw new Error("Unclosed sequence block");
  if (!events.length) throw new Error("Sequence has no interactions");
  return { type: "sequenceDiagram", participants, events };
}

/** Preserve named components and grouping independently from edge layout. */
function parseGraph(lines, direction) {
  const nodes = new Map();
  const groups = new Map();
  const edges = [];
  let group = "";
  /** Resolve repeated references to one component without changing an established boundary. */
  const node = (id, raw = "") => {
    const existing = nodes.get(id);
    if (existing?.group && group && existing.group !== group) {
      throw new Error(`Component ${id} appears in conflicting subgraphs`);
    }
    nodes.set(id, {
      id,
      label: raw ? label(raw.slice(1, -1)) : existing?.label || id,
      shape: raw.startsWith("{") ? "decision" : existing?.shape || "box",
      group: existing?.group || group,
    });
  };
  for (const line of lines) {
    const subgraph = line.match(new RegExp(`^subgraph (${ID})(?:\\[(.+)\\])?$`));
    if (subgraph) {
      if (group || groups.has(subgraph[1])) throw new Error("Nested or duplicate subgraph");
      group = subgraph[1];
      groups.set(group, { id: group, label: label(subgraph[2] || group) });
      continue;
    }
    if (line === "end") {
      if (!group) throw new Error("Unmatched subgraph end");
      group = "";
      continue;
    }
    let rest = line.replace(/;\s*$/, "");
    const first = rest.match(new RegExp(`^${NODE}`));
    if (!first) throw new Error(`Unsupported graph statement: ${line}`);
    node(first[1], first[2]);
    rest = rest.slice(first[0].length).trim();
    let from = first[1];
    while (rest) {
      const edge = rest.match(new RegExp(`^(-->|-\\.->|==>)(?:\\|([^|]+)\\|)?\\s*${NODE}`));
      if (!edge) throw new Error(`Unsupported graph relationship: ${line}`);
      node(edge[3], edge[4]);
      edges.push({ from, to: edge[3], label: label(edge[2] || ""), dashed: edge[1] === "-.->" });
      from = edge[3];
      rest = rest.slice(edge[0].length).trim();
    }
  }
  if (group) throw new Error("Unclosed subgraph");
  if (!edges.length) throw new Error("Graph has no relationships");
  return { type: "flowchart", direction, nodes, groups, edges };
}

/** Keep lifecycle endpoints and named states as independent graph nodes. */
function parseState(lines) {
  const nodes = new Map();
  const edges = [];
  /** Keep the lifecycle identity stable when a named state is declared after its first use. */
  const node = (id, name = id) => {
    if (!nodes.has(id) || name !== id) nodes.set(id, { id, label: name, group: "" });
  };
  for (const line of lines) {
    let match = line.match(new RegExp(`^state "([^"]+)" as (${ID})$`));
    if (match) {
      node(match[2], match[1]);
      continue;
    }
    match = line.match(new RegExp(`^(${ID})\\s*:\\s*(.+)$`));
    if (match) {
      node(match[1], match[2]);
      continue;
    }
    match = line.match(
      new RegExp(`^(\\[\\*\\]|${ID})\\s*-->\\s*(\\[\\*\\]|${ID})(?:\\s*:\\s*(.+))?$`),
    );
    if (!match) throw new Error(`Unsupported state statement: ${line}`);
    const from = match[1] === "[*]" ? "__start" : match[1];
    const to = match[2] === "[*]" ? "__end" : match[2];
    node(from);
    node(to);
    edges.push({ from, to, label: label(match[3] || "") });
  }
  if (!edges.length) throw new Error("State diagram has no transitions");
  return { type: "stateDiagram-v2", direction: "LR", nodes, groups: new Map(), edges };
}

/** Keep cardinalities attached to their entity relationship, not an implied call. */
function parseEntities(lines) {
  const nodes = new Map();
  const edges = [];
  for (const line of lines) {
    const match = line.match(
      new RegExp(`^(${ID})\\s+([|o}{]+)(--|\\.\\.)([|o}{]+)\\s+(${ID})\\s*:\\s*(.+)$`),
    );
    if (!match) throw new Error(`Unsupported entity statement: ${line}`);
    for (const id of [match[1], match[5]]) nodes.set(id, { id, label: id, group: "" });
    edges.push({
      from: match[1],
      to: match[5],
      label: `${match[2]}${match[3]}${match[4]} ${label(match[6])}`,
      undirected: true,
    });
  }
  if (!edges.length) throw new Error("Entity diagram has no relationships");
  return { type: "erDiagram", direction: "LR", nodes, groups: new Map(), edges };
}

/** Wrap visible labels without shrinking their type, including Korean text. */
function wrap(value, capacity = 26) {
  const lines = [];
  for (const paragraph of String(value).split("\n")) {
    let line = "",
      width = 0;
    for (const char of paragraph) {
      const size = /[^\x00-\x7f]/.test(char) ? 2 : 1;
      if (width + size > capacity && line) {
        lines.push(line);
        line = "";
        width = 0;
      }
      line += char;
      width += size;
    }
    lines.push(line);
  }
  return lines;
}

/** Place wrapped, escaped SVG labels without executing authored markup. */
function text(lines, x, y, className = "", anchor = "middle") {
  return `<text class="${className}" x="${x}" y="${y}" text-anchor="${anchor}">${lines
    .map((line, i) => `<tspan x="${x}" dy="${i ? 18 : 0}">${esc(line)}</tspan>`)
    .join("")}</text>`;
}

/** Give every diagram a local marker and accessible title with a stable view box. */
function svg(body, width, height, id, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title" viewBox="0 0 ${width} ${height}" style="width:${width}px;max-width:none">
    <title id="${id}-title">${esc(title)}</title>
    <defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
    ${body}</svg>`;
}

/** Place actors across the page and time down it, retaining nested branch frames. */
function sequenceSvg(diagram, id) {
  const actors = [...diagram.participants];
  /** Reserve space for a note beside the first lifeline, including notes inside branches. */
  const needsLeftMargin = (events) =>
    events.some((event) =>
      event.kind === "note"
        ? event.placement.toLowerCase() === "left of" && event.participants.includes(actors[0][0])
        : event.kind === "block" && event.branches.some((branch) => needsLeftMargin(branch.events)),
    );
  const leftMargin = needsLeftMargin(diagram.events) ? 100 : 0;
  const positions = new Map(actors.map(([name], index) => [name, 110 + leftMargin + index * 200]));
  const width = Math.max(440, actors.length * 200 + 170 + leftMargin);
  const headerHeight = Math.max(...actors.map(([, name]) => wrap(name, 24).length)) * 18 + 30;
  let y = headerHeight + 42;
  /** Advance time by visible content height, keeping each branch inside its own frame. */
  const renderEvents = (events, depth = 0) => {
    let out = "";
    for (const event of events) {
      if (event.kind === "message") {
        const x1 = positions.get(event.from),
          x2 = positions.get(event.to);
        const self = x1 === x2;
        const lines = wrap(
          event.label,
          self ? 24 : Math.max(22, Math.floor(Math.abs(x2 - x1) / 8)),
        );
        y += lines.length * 18 + 22;
        const route = self ? `M ${x1} ${y} h 65 v 30 h -65` : `M ${x1} ${y} H ${x2}`;
        out += `<g class="sequence__message" data-from="${esc(event.from)}" data-to="${esc(event.to)}">
          <title>${esc(diagram.participants.get(event.from))} → ${esc(diagram.participants.get(event.to))}: ${esc(event.label)}</title>
          ${text(lines, self ? x1 + 75 : (x1 + x2) / 2, y - lines.length * 18, "diagram-label", self ? "start" : "middle")}
          <path class="sequence__arrow${event.arrow.startsWith("--") ? " sequence__arrow--dashed" : ""}" d="${route}" fill="none" stroke="currentColor" stroke-width="1.8" ${event.arrow.startsWith("--") ? 'stroke-dasharray="6 4"' : ""} ${event.arrow.endsWith(">>") ? `marker-end="url(#${id}-arrow)"` : ""}/></g>`;
        y += self ? 64 : 32;
      } else if (event.kind === "note") {
        const xs = event.participants.map((name) => positions.get(name));
        const noteWidth = Math.max(190, Math.max(...xs) - Math.min(...xs) + 170);
        const placement = event.placement.toLowerCase();
        const x =
          placement === "left of"
            ? Math.min(...xs) - noteWidth - 18
            : placement === "right of"
              ? Math.max(...xs) + 18
              : Math.max(20, Math.min(...xs) - 85);
        const lines = wrap(
          `${event.placement} ${event.participants.map((name) => diagram.participants.get(name)).join(", ")}: ${event.label}`,
          Math.floor(noteWidth / 8),
        );
        const height = lines.length * 18 + 22;
        out += `<g class="sequence__note"><rect x="${x}" y="${y}" width="${noteWidth}" height="${height}" rx="4"/>${text(lines, x + 10, y + 20, "", "start")}</g>`;
        y += height + 22;
      } else {
        const top = y,
          x = 15 + depth * 12;
        y += 28;
        let content = "";
        for (const [index, branch] of event.branches.entries()) {
          if (index)
            content += `<line x1="${x}" x2="${width - x}" y1="${y}" y2="${y}" stroke="currentColor" stroke-dasharray="4 4"/>`;
          const lines = wrap(branch.label || event.type, Math.floor((width - 2 * x - 30) / 8));
          content += text(lines, x + 14, y + 18, "sequence__condition", "start");
          y += lines.length * 18 + 18;
          content += renderEvents(branch.events, depth + 1);
        }
        out += `<g class="sequence__block" data-block="${event.type}">
          <rect class="sequence__frame" x="${x}" y="${top}" width="${width - 2 * x}" height="${y - top + 4}" rx="5"/>
          ${text([event.type], x + 10, top + 19, "sequence__block-title", "start")}${content}</g>`;
        y += 22;
      }
    }
    return out;
  };
  const interactions = renderEvents(diagram.events);
  const lifelines = actors
    .map(([name]) => {
      const x = positions.get(name);
      return `<line class="sequence__lifeline" x1="${x}" x2="${x}" y1="${headerHeight + 16}" y2="${y}" stroke="currentColor" stroke-dasharray="4 5"/>`;
    })
    .join("");
  const headers = actors
    .map(([name, display]) => {
      const x = positions.get(name);
      return `<g class="sequence__participant" data-participant="${esc(name)}"><rect x="${x - 90}" y="14" width="180" height="${headerHeight}" rx="6"/>${text(wrap(display, 24), x, 40)}</g>`;
    })
    .join("");
  return svg(lifelines + interactions + headers, width, y + 20, id, "Sequence diagram");
}

/** Lay out unique components in dependency ranks and keep boundary members together. */
function graphSvg(diagram, id, ui) {
  const nodes = [...diagram.nodes.values()].map((node) => ({
    ...node,
    label:
      node.id === "__start"
        ? ui.stateStart || "Start"
        : node.id === "__end"
          ? ui.stateEnd || "End"
          : node.label,
  }));
  const rank = new Map(nodes.map((node) => [node.id, 0]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of diagram.edges)
    if (edge.from !== edge.to) indegree.set(edge.to, indegree.get(edge.to) + 1);
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  for (let i = 0; i < queue.length; i++) {
    for (const edge of diagram.edges.filter(
      (edge) => edge.from === queue[i] && edge.to !== edge.from,
    )) {
      rank.set(edge.to, Math.max(rank.get(edge.to), rank.get(edge.from) + 1));
      indegree.set(edge.to, indegree.get(edge.to) - 1);
      if (indegree.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  const horizontal = ["LR", "RL"].includes(diagram.direction);
  const reverse = ["RL", "BT"].includes(diagram.direction);
  const maxRank = Math.max(...rank.values());
  const nodeWidth = 190;
  const nodeHeight = Math.max(64, ...nodes.map((node) => wrap(node.label).length * 18 + 26));
  const groupKeys = [...new Set(nodes.map((node) => node.group || ""))];
  const positioned = new Map();
  let offset = 0;
  for (const key of groupKeys) {
    const members = nodes.filter((node) => (node.group || "") === key);
    const columns = new Map();
    for (const node of members) {
      const r = rank.get(node.id);
      if (!columns.has(r)) columns.set(r, []);
      columns.get(r).push(node);
    }
    const rows = Math.max(...[...columns.values()].map((column) => column.length));
    for (const [r, column] of columns) {
      column.forEach((node, index) => {
        const primary = reverse ? maxRank - r : r;
        const secondary = offset + index + (rows - column.length) / 2;
        positioned.set(node.id, {
          ...node,
          x: 80 + (horizontal ? primary * 285 : secondary * 250),
          y: 80 + (horizontal ? secondary * (nodeHeight + 75) : primary * (nodeHeight + 100)),
        });
      });
    }
    offset += rows + (groupKeys.length > 1 ? 0.7 : 0);
  }
  const width = Math.max(...[...positioned.values()].map((node) => node.x + nodeWidth)) + 100;
  const height = Math.max(...[...positioned.values()].map((node) => node.y + nodeHeight)) + 90;
  const boundaries = [...diagram.groups.values()]
    .map((group) => {
      const members = [...positioned.values()].filter((node) => node.group === group.id);
      if (!members.length) return "";
      const x = Math.min(...members.map((node) => node.x)) - 22;
      const y = Math.min(...members.map((node) => node.y)) - 45;
      const right = Math.max(...members.map((node) => node.x + nodeWidth)) + 22;
      const bottom = Math.max(...members.map((node) => node.y + nodeHeight)) + 22;
      return `<g class="diagram-boundary" data-boundary="${esc(group.id)}"><rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" rx="10"/>${text(wrap(group.label, Math.floor((right - x) / 8)), x + 12, y + 23, "", "start")}</g>`;
    })
    .join("");
  const edges = diagram.edges
    .map((edge, index) => {
      const from = positioned.get(edge.from),
        to = positioned.get(edge.to);
      let route, lx, ly;
      if (from === to) {
        route = `M ${from.x + nodeWidth} ${from.y + 20} c 70 -50 70 80 0 30`;
        lx = from.x + nodeWidth + 38;
        ly = from.y - 15;
      } else if (horizontal) {
        const forward = to.x > from.x,
          same = to.x === from.x;
        const x1 = forward ? from.x + nodeWidth : from.x;
        const x2 = forward ? to.x : same ? to.x : to.x + nodeWidth;
        const y1 = from.y + nodeHeight / 2,
          y2 = to.y + nodeHeight / 2;
        const mid = same ? x1 - 45 : (x1 + x2) / 2;
        route = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
        lx = mid;
        ly = (y1 + y2) / 2 - 13 - (index % 2) * 3;
      } else {
        const forward = to.y > from.y,
          same = to.y === from.y;
        const y1 = forward ? from.y + nodeHeight : from.y;
        const y2 = forward ? to.y : same ? to.y : to.y + nodeHeight;
        const x1 = from.x + nodeWidth / 2,
          x2 = to.x + nodeWidth / 2;
        const mid = same ? y1 - 42 : (y1 + y2) / 2;
        route = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
        lx = (x1 + x2) / 2;
        ly = mid - 10;
      }
      return `<g class="diagram-relationship" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}">
      <title>${esc(from.label)} → ${esc(to.label)}: ${esc(edge.label)}</title>
      <path d="${route}" fill="none" stroke="currentColor" stroke-width="1.8" ${edge.dashed ? 'stroke-dasharray="5 4"' : ""} ${edge.undirected ? "" : `marker-end="url(#${id}-arrow)"`}/>
      ${edge.label ? text(wrap(edge.label, 24), lx, ly, "diagram-label") : ""}</g>`;
    })
    .join("");
  const boxes = [...positioned.values()]
    .map((node) => {
      const shape =
        node.shape === "decision"
          ? `<path d="M ${node.x + nodeWidth / 2} ${node.y - 5} L ${node.x + nodeWidth + 8} ${node.y + nodeHeight / 2} L ${node.x + nodeWidth / 2} ${node.y + nodeHeight + 5} L ${node.x - 8} ${node.y + nodeHeight / 2} Z"/>`
          : `<rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" rx="7"/>`;
      return `<g class="diagram-node" data-node="${esc(node.id)}">${shape}${text(wrap(node.label), node.x + nodeWidth / 2, node.y + 25)}</g>`;
    })
    .join("");
  return svg(boundaries + edges + boxes, width, height, id, diagram.type);
}

/**
 * Render a self-contained SVG plus inspectable Mermaid source. Unsupported
 * input retains its complete source and is never labeled as rendered evidence.
 */
export function renderMermaid(source, ui) {
  const parsed = parseMermaid(source);
  if (parsed.error) {
    return `<figure class="diagram diagram--fallback" data-rendered="false"><figcaption>${esc(ui.diagramFallback)}</figcaption><pre><code>${esc(source)}</code></pre></figure>`;
  }
  const id = `mermaid-${createHash("sha256").update(source).digest("hex").slice(0, 12)}`;
  const typeClass = {
    sequenceDiagram: "sequence",
    flowchart: "flow",
    "stateDiagram-v2": "state",
    erDiagram: "er",
  }[parsed.type];
  const image =
    parsed.type === "sequenceDiagram" ? sequenceSvg(parsed, id) : graphSvg(parsed, id, ui);
  return `<figure class="diagram diagram--${typeClass}" data-rendered="true"><div class="diagram__viewport">${image}</div><details class="diagram-source"><summary>${esc(ui.diagramSource || "Mermaid source")}</summary><pre><code>${esc(source)}</code></pre></details></figure>`;
}

/**
 * Locate real fences, excluding code examples containing Markdown fences.
 * This parser is also used for report sections, so embedded headings stay code.
 */
export function mermaidBlocks(source) {
  const lines = String(source ?? "").split(/\r?\n/);
  const blocks = [];
  let section = "";
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^##\s+(.+?)\s*$/);
    if (heading) section = heading[1];
    const fence = lines[index].match(/^(`{3,}|~{3,})\s*(.*)$/);
    if (!fence) continue;
    const close = new RegExp(`^${fence[1][0]}{${fence[1].length},}\\s*$`);
    const start = index + 1;
    let end = start;
    while (end < lines.length && !close.test(lines[end])) end++;
    index = end;
    if (fence[2].trim() !== "mermaid") continue;
    const code = lines.slice(start, end).join("\n");
    const markers = [...code.matchAll(/^\s*%%\s*requirement:\s*(V\d+)\s*$/gm)];
    let cursor = end + 1;
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    blocks.push({
      source: code,
      section,
      requirementId: markers[0]?.[1] || "",
      markerCount: markers.length,
      closed: end < lines.length,
      notice: /^Notice:\s+\S/.test(lines[cursor]?.trim() || ""),
    });
  }
  return blocks;
}

/**
 * Keep source line positions for prose while excluding complete fenced examples.
 * Materialization markers and section boundaries inside evidence are just code.
 */
export function proseLines(source) {
  const result = [];
  let fence = null;
  for (const [index, value] of String(source ?? "")
    .split(/\r?\n/)
    .entries()) {
    if (fence) {
      if (new RegExp(`^${fence[0]}{${fence.length},}\\s*$`).test(value)) fence = null;
      continue;
    }
    const marker = value.match(/^(`{3,}|~{3,})/);
    if (marker) fence = marker[1];
    else result.push({ index, value });
  }
  return result;
}
