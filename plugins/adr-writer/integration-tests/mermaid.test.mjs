import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createRequire } from "node:module";
import { renderHtml } from "../skills/report-writer/scripts/render-report.mjs";
import { browserPath } from "../evals/deepeval/coverage-render.mjs";

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve("@mermaid-js/mermaid-cli"));
const { default: puppeteer } = await import(cliRequire.resolve("puppeteer"));
let browser;
before(async () => {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath(),
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
});
after(async () => {
  await browser?.close();
});
const sources = {
  class: "classDiagram\nclass Animal {\n+String name\n+move()\n}\nAnimal <|-- Duck\nOwner *-- Pet",
  state: "stateDiagram-v2\n[*] --> Pending\nPending --> Done\nDone --> [*]",
  er: "erDiagram\nUSER {\nstring name\n}\nUSER ||--o{ ORDER : owns",
  sequence:
    "sequenceDiagram\nautonumber\nparticipant Caller\nparticipant Service\nCaller->>+Service: request\nalt success\nService-->>Caller: result\nelse failure\nService-->>Caller: error\nend\ndeactivate Service",
  flow: "flowchart LR\nsubgraph Outer\nsubgraph Inner\nA --> B\nend\nend",
  c4: 'C4Context\nPerson(user, "User")\nSystem(app, "App")\nRel(user, app, "Uses")',
  mindmap: "mindmap\n  root((Topic))\n    Concept A\n    Concept B",
  gantt: "gantt\n  dateFormat YYYY-MM-DD\n  section Work\n  Design :2026-10-10, 2d",
};
const document = (items) => ({
  title: "Diagram rendering contract",
  language: "en",
  background: ["Synthetic diagram fixtures."],
  summary: ["Inspect notation and failure reporting."],
  requiredEvidenceIds: [],
  review: {
    status: "draft",
    basis: "Automated rendering fixture.",
    limitations: "Not a human explanation review.",
  },
  sections: [
    {
      id: "diagrams",
      title: "Relations",
      domain: "Reporting",
      scope: "Diagram notation",
      children: Object.entries(items).map(([id, source]) => ({
        id,
        title: id,
        domain: "Reporting",
        scope: "Notation",
        diagram: { source, explanation: "Synthetic relationship evidence." },
      })),
    },
  ],
});
async function open(html) {
  const page = await browser.newPage();
  const requests = [];
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      requests.push(request.url());
      request.abort();
    } else request.continue();
  });
  await page.setContent(html, { waitUntil: "load" });
  const results = await page.evaluate(() => window.reportDiagramsReady);
  return { page, results, requests };
}

test("official Mermaid renders UML, state and ER semantics offline through the report entry point", async () => {
  const { page, results, requests } = await open(
    renderHtml(document(Object.fromEntries(Object.entries(sources).slice(0, 4)))),
  );
  try {
    assert.equal(results.length, 4);
    assert.ok(
      results.every((result) => result.rendered),
      JSON.stringify(results),
    );
    assert.deepEqual(requests, []);
    const svg = await page.$eval("#class .diagram__viewport", (node) => node.innerHTML);
    assert.match(svg, /marker-(?:start|end)="url\([^"]*extension/);
    assert.match(svg, /marker-(?:start|end)="url\([^"]*composition/);
    assert.match(svg, /move/);
    const state = await page.$eval("#state svg", (node) => node.outerHTML);
    assert.match(state, /state-start/);
    assert.match(state, /state-end/);
    const er = await page.$eval("#er svg", (node) => node.outerHTML);
    assert.match(er, /marker-start="url\(#[^"]*onlyOneStart\)"/);
    assert.match(er, /marker-end="url\(#[^"]*zeroOrMoreEnd\)"/);
    assert.match(er, /name/);
    const sequence = await page.$eval("#sequence svg", (node) => node.textContent);
    for (const text of ["Caller", "Service", "request", "result", "error", "success", "failure"])
      assert.ok(sequence.includes(text), text);
    assert.equal(await page.$$eval('[data-render-state="rendered"]', (nodes) => nodes.length), 4);
  } finally {
    await page.close();
  }
});

test("types and richer syntax outside the former subset render without a type allowlist", async () => {
  const { page, results, requests } = await open(
    renderHtml(document(Object.fromEntries(Object.entries(sources).slice(4)))),
  );
  try {
    assert.equal(results.length, 4);
    assert.ok(
      results.every((result) => result.rendered),
      JSON.stringify(results),
    );
    assert.deepEqual(requests, []);
  } finally {
    await page.close();
  }
});

test("diagram source cannot execute script or callbacks, including a security-level override", async () => {
  const source =
    '%%{init: {"securityLevel": "loose"}}%%\nflowchart LR\nA["<img src=x onerror=window.compromised=true>"] --> B\nclick B callback';
  const { page, results } = await open(renderHtml(document({ safety: source })));
  try {
    assert.equal(results[0].rendered, true, JSON.stringify(results));
    assert.equal(await page.evaluate(() => window.compromised), undefined);
    assert.equal(
      await page.$$eval(
        "#safety svg [onclick], #safety svg [onerror], #safety svg script",
        (nodes) => nodes.length,
      ),
      0,
    );
  } finally {
    await page.close();
  }
});

test("render failure remains visible with source and never claims rendered success", async () => {
  const html = renderHtml(document({ failure: sources.class })).replace(
    "const {svg} = await mermaid.render(",
    'const {svg} = await (()=>{throw new Error("simulated render failure")})(',
  );
  const { page, results } = await open(html);
  try {
    assert.equal(results[0].rendered, false);
    assert.match(
      await page.$eval(".diagram-status", (node) => node.textContent),
      /simulated render failure/,
    );
    assert.equal(await page.$eval(".diagram-source", (node) => node.open), true);
    assert.equal(
      await page.$eval("figure[data-mermaid]", (node) => node.dataset.rendered),
      "false",
    );
  } finally {
    await page.close();
  }
});

test("implementation-review HTML uses the same official class renderer", async () => {
  const input = {
    adr: "Review fixture",
    verdict: "PASS",
    language: "en",
    diagramRequirements: [{ id: "V1", section: "Context", diagramType: "classDiagram" }],
    narrativeSections: [
      {
        title: "Context",
        body:
          "```mermaid\n%% requirement: V1\n" +
          sources.class +
          "\n```\nNotice: Inheritance and composition stay distinct.",
      },
    ],
  };
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../scripts/adr-impl-review-report.mjs", import.meta.url)),
      "-",
      "--stdout",
    ],
    { input: JSON.stringify(input), encoding: "utf8", maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr);
  const { page, results, requests } = await open(result.stdout);
  try {
    assert.equal(results[0].rendered, true, JSON.stringify(results));
    assert.deepEqual(requests, []);
    assert.equal(await page.$$eval("svg.classDiagram", (nodes) => nodes.length), 1);
  } finally {
    await page.close();
  }
});
