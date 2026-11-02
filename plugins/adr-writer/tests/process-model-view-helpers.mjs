// Fixtures that process-model-view.test.mjs and process-model-view.integration.test.mjs share.
import { validateModel } from "../scripts/process-model-lib.mjs";
import { EXAMPLE } from "./process-model-helpers.mjs";

export const MAPPING = {
  categories: {
    checkout: {
      adrs: [{ path: "docs/adr/checkout/0001-a.md", status: "Accepted (2020-01-01)" }],
      realizes: ["ordering.submit-order"],
    },
    confirmation: {
      adrs: [
        { path: "docs/adr/confirmation/0001-b.md", status: "Accepted (2020-01-01)" },
        { path: "docs/adr/confirmation/0002-c.md", status: "Proposed" },
      ],
      realizes: ["ordering.confirm-order"],
    },
    retiredOnly: {
      adrs: [{ path: "docs/adr/x/0001-d.md", status: "Deprecated (2020-01-01)" }],
      realizes: [],
    },
  },
};

export const sections = (html) =>
  [...html.matchAll(/<section class="process" id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map(
    (m) => ({ id: m[1], body: m[2] }),
  );

// One rendering shared by the read-only checks: diagram syntax validation spawns the bundled parser.
export const v = validateModel([{ doc: "docs/process/example.ttl", text: EXAMPLE }]);

export const withoutEngine = (html) =>
  html.replace(/<script data-mermaid-engine>[\s\S]*?<\/script>/, "");

export const unescapeHtml = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

export const anchorOf = (id) =>
  `el-${id.replace(/[^\p{L}\p{N}-]/gu, (c) => `_${c.codePointAt(0).toString(16)}_`)}`;

export const decodeAnchor = (anchor) =>
  anchor
    .replace(/^(?:process-)?el-/, "")
    .replace(/_([0-9a-f]+)_/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

export const articleOf = (html, id) =>
  html.match(
    new RegExp(`<article class="element" id="${anchorOf(id)}"[^>]*>([\\s\\S]*?)</article>`),
  )?.[1] ?? "";

export const landscapeOf = (html) =>
  html.slice(html.indexOf('<section id="landscape">'), html.indexOf('<section class="process"'));

export const SHAPES = { "([": "event", "{{": "policy", "[/": "actor", "[": "box" };

/** Nodes (shape, label, context subgraph, classes), links in order, and the broken link indices of one flowchart. */
export function parseFlowchart(source) {
  const nodes = new Map();
  const edges = [];
  const broken = new Set();
  let context = null;
  for (const line of source.split("\n").map((l) => l.trim())) {
    let m;
    if ((m = /^subgraph n\d+_ctx\["(.*)"\]$/.exec(line))) context = m[1];
    else if (line === "end") context = null;
    else if ((m = /^(n\d+)(\(\[|\{\{|\[\/|\[)"(.*)"(?:\]\)|\}\}|\/\]|\])$/.exec(line)))
      nodes.set(m[1], { shape: SHAPES[m[2]], label: m[3], context, classes: [] });
    else if ((m = /^(n\d+) (-->|==>|-\.->) (n\d+)$/.exec(line)))
      edges.push({ from: m[1], arrow: m[2], to: m[3] });
    else if ((m = /^class (n\d+) (\S+)$/.exec(line)))
      nodes.get(m[1])?.classes.push(...m[2].split(","));
    else if ((m = /^linkStyle ([\d,]+) /.exec(line)))
      for (const i of m[1].split(",")) broken.add(Number(i));
  }
  return { source, nodes, edges, broken };
}

/** Every diagram of a page fragment with its navigation targets. */
export const diagrams = (html) =>
  [
    ...html.matchAll(/<figure data-targets="([^"]*)"[\s\S]*?<pre><code>([\s\S]*?)<\/code><\/pre>/g),
  ].map((m) => ({
    targets: JSON.parse(unescapeHtml(m[1])),
    ...parseFlowchart(unescapeHtml(m[2])),
  }));

/** The data the explorer and the city read. */
export const viewData = (html) =>
  JSON.parse(html.match(/<script type="application\/json" id="view-data">([\s\S]*?)<\/script>/)[1]);

/** The explorer's tree: each group's heading target (null for the group apart) and its links in order. */
export const treeGroups = (html) =>
  (html.match(/<nav class="tree"[\s\S]*?<\/nav>/)?.[0] ?? "")
    .split('<li class="context">')
    .slice(1)
    .map((chunk) => ({
      head: chunk.match(/^<details><summary><a href="#([^"]+)"/)?.[1] ?? null,
      links: [...chunk.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]),
      chunk,
    }));

/** The document part of a page: banners, landscape, flows and details. */
export const documentOf = (html) =>
  html.slice(html.indexOf('<main class="document"'), html.indexOf("</main>"));

export const UNKNOWN =
  /<a href="#errors">cannot be determined until the ADR index error is fixed<\/a>/;
