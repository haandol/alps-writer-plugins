import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cache = new Map();
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
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./vendor/mermaid-parser.mjs", import.meta.url))],
    { input: source, encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024 },
  );
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
  if (cache.size >= 128) cache.delete(cache.keys().next().value);
  cache.set(source, parsed);
  return parsed;
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
  return `<script data-mermaid-engine>${engine}</script><script data-mermaid-runtime>
window.reportDiagramsReady = (async () => {
  mermaid.initialize({startOnLoad:false,securityLevel:"strict",theme:"default",flowchart:{htmlLabels:false},suppressErrorRendering:true});
  const figures = [...document.querySelectorAll('figure[data-mermaid]')];
  const results = [];
  for (const [index, figure] of figures.entries()) {
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
  }
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
