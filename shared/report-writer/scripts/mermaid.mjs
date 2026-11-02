import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cache = new Map();
const CACHE_LIMIT = 128;
const PARSER = fileURLToPath(new URL("./vendor/mermaid-parser.mjs", import.meta.url));
/** Keep one parse result, dropping the oldest beyond the limit. */
function remember(source, parsed) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(source, parsed);
}
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** Normalize upstream aliases, without restricting the upstream diagram registry. */
export function normalizeDiagramType(type) {
  if (typeof type !== "string") return type;
  if (/^C4/.test(type)) return "c4";
  if (type.endsWith("-beta")) return type.slice(0, -5);
  if (type === "classDiagram-v2") return "classDiagram";
  if (type === "requirementDiagram") return "requirement";
  return (
    {
      "flowchart-v2": "flowchart",
      graph: "flowchart",
      sequence: "sequenceDiagram",
      class: "classDiagram",
      classDiagram: "classDiagram",
      state: "stateDiagram",
      stateDiagram: "stateDiagram-v2",
      er: "erDiagram",
    }[type] || type
  );
}

/** Validate full Mermaid syntax with the bundled official parser in an isolated Node process.
 * Keep the synchronous report API; no package installation, browser or network is needed.
 * Success proves syntax only. The HTML renderer reports SVG completion separately.
 */
export function parseMermaid(source) {
  source = String(source ?? "");
  if (cache.has(source)) return cache.get(source);
  const result = spawnSync(process.execPath, [PARSER], {
    input: source,
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });
  let parsed;
  try {
    if (result.error || result.status !== 0)
      throw new Error(
        result.error?.message || result.stderr?.slice(-2000) || "Mermaid parser failed",
      );
    parsed = JSON.parse(result.stdout);
    if (parsed.type) parsed.type = normalizeDiagramType(parsed.type);
    if (!parsed.type && !parsed.error) throw new Error("Mermaid parser returned no result");
  } catch (error) {
    parsed = { error: String(error.message).slice(0, 2000) };
  }
  remember(source, parsed);
  return parsed;
}

/** Validate several sources with one parser process, so `parseMermaid` answers them from its
 * cache. Upstream resets its configuration for every diagram it parses. A batch that fails or
 * answers in another shape caches nothing, and each source is then parsed on its own.
 */
export function parseMermaidAll(sources) {
  const fresh = [...new Set(sources.map((s) => String(s ?? "")))]
    .filter((s) => !cache.has(s))
    .slice(0, CACHE_LIMIT);
  if (fresh.length < 2) return;
  const result = spawnSync(process.execPath, [PARSER, "--batch"], {
    input: JSON.stringify(fresh),
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return;
  let answers;
  try {
    answers = JSON.parse(result.stdout);
  } catch {
    return;
  }
  if (!Array.isArray(answers) || answers.length !== fresh.length) return;
  for (const [i, source] of fresh.entries()) {
    const parsed = answers[i];
    // Cache only what a parse of its own would keep from the same answer.
    if (parsed?.type) parsed.type = normalizeDiagramType(parsed.type);
    else if (!parsed?.error) continue;
    remember(source, parsed);
  }
}

/** Preserve source until the official browser renderer has produced the SVG. */
export function renderMermaid(source, ui = {}) {
  const parsed = parseMermaid(source);
  const sourceView = `<details class="diagram-source" open><summary>${esc(ui.diagramSource || "Mermaid source")}</summary><pre><code>${esc(source)}</code></pre></details>`;
  if (parsed.error)
    return `<figure class="diagram diagram--fallback" data-rendered="false" data-render-state="failed"><figcaption>${esc(ui.diagramFallback || "Diagram not rendered")}: ${esc(parsed.error)}</figcaption>${sourceView}</figure>`;
  const id = `mermaid-${createHash("sha256")
    .update(String(ui.idPrefix || "") + source)
    .digest("hex")
    .slice(0, 12)}`;
  return `<figure class="diagram" data-mermaid="${id}" data-diagram-type="${esc(parsed.type)}" data-rendered="false" data-render-state="pending"><figcaption class="diagram-status" role="status">${esc(ui.diagramPending || "Diagram rendering pending. Source is available below.")}</figcaption><div class="diagram__viewport"></div>${sourceView}</figure>`;
}

/** Inline the pinned browser engine once per report, including all diagram modules.
 * Source is read as text. Strict mode disables authored callbacks and HTML execution.
 * Figures are drawn one at a time and each announces itself with a bubbling
 * `report-diagram-rendered` event. By default every figure is drawn and
 * `reportDiagramsReady` settles with all of them. With `ui.lazy` a figure is drawn only
 * when it comes near view (`ui.lazy.root` names the scrolling element, when it scrolls) or
 * is asked for through `reportDiagramRender(figure)`; `reportDiagramsReady` then settles
 * with the figures near view at load.
 */
export function mermaidRuntime(ui = {}) {
  const engine = readFileSync(new URL("./vendor/mermaid.min.js", import.meta.url), "utf8").replace(
    /<\/script/gi,
    "<\\/script",
  );
  const failure = JSON.stringify(ui.diagramFallback || "Diagram not rendered").replace(
    /</g,
    "\\u003c",
  );
  const lazy = JSON.stringify(ui.lazy ? { root: ui.lazy.root ?? null } : null).replace(
    /</g,
    "\\u003c",
  );
  return `<script data-mermaid-engine>${engine}</script><script data-mermaid-runtime>
window.reportDiagramsReady = (async () => {
  mermaid.initialize({startOnLoad:false,securityLevel:"strict",theme:"default",flowchart:{htmlLabels:false},suppressErrorRendering:true});
  const figures = [...document.querySelectorAll('figure[data-mermaid]')];
  const results = [];
  const drawing = new Map();
  let queue = Promise.resolve();
  async function render(figure, index) {
    const source = figure.querySelector('.diagram-source code').textContent;
    const status = figure.querySelector('.diagram-status');
    try {
      const {svg} = await mermaid.render(figure.dataset.mermaid + '-' + index, source);
      figure.querySelector('.diagram__viewport').innerHTML = svg;
      const image = figure.querySelector('.diagram__viewport svg');
      if (!image) throw new Error('Mermaid returned no SVG');
      if (image.viewBox.baseVal.width) {
        image.style.width = image.viewBox.baseVal.width + 'px';
        image.style.maxWidth = 'none';
      }
      figure.dataset.rendered = 'true'; figure.dataset.renderState = 'rendered';
      figure.querySelector('.diagram-source').open = false;
      status.hidden = true;
      results.push({type:figure.dataset.diagramType,rendered:true});
    } catch (error) {
      figure.dataset.renderState = 'failed';
      status.textContent = ${failure} + ': ' + String(error.message || error);
      results.push({type:figure.dataset.diagramType,rendered:false,error:String(error.message || error)});
    }
    figure.dispatchEvent(new CustomEvent('report-diagram-rendered', {bubbles: true}));
  }
  // One figure at a time: Mermaid keeps page-wide state while it lays a diagram out.
  const draw = (figure) => {
    if (!drawing.has(figure)) {
      queue = queue.then(() => render(figure, figures.indexOf(figure)));
      drawing.set(figure, queue);
    }
    return drawing.get(figure);
  };
  const lazy = ${lazy};
  if (!lazy) {
    for (const figure of figures) await draw(figure);
    return results;
  }
  window.reportDiagramRender = draw;
  const scroller = lazy.root && document.querySelector(lazy.root);
  const root = scroller && /auto|scroll/.test(getComputedStyle(scroller).overflowY) ? scroller : null;
  const near = await new Promise((resolve) => {
    if (!figures.length) return resolve([]);
    const probe = new IntersectionObserver((entries) => {
      probe.disconnect();
      resolve(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target));
    }, {root, rootMargin: '600px 0px'});
    for (const figure of figures) probe.observe(figure);
  });
  const watch = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      watch.unobserve(entry.target);
      draw(entry.target);
    }
  }, {root, rootMargin: '600px 0px'});
  for (const figure of figures) watch.observe(figure);
  await Promise.all(near.map(draw));
  return results;
})();
</script>`;
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
