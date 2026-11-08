#!/usr/bin/env bun
// Regenerate the README screenshots from the repository's own examples:
// the ontology template model (with two realizing ADRs) and the report-writer
// example report. Uses the browser the Mermaid tests use (MERMAID_BROWSER_PATH or
// an installed Chrome/Chromium). Writes docs/images/*.webp.
//
// Usage: bun scripts/readme-screenshots.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/images");
const ONTOLOGY = path.join(ROOT, "plugins/ontology-writer");
const REPORT = path.join(ROOT, "plugins/adr-writer/skills/report-writer");
const { browserPath } = await import(
  path.join(ROOT, "plugins/adr-writer/evals/deepeval/coverage-render.mjs")
);
const cli = createRequire(
  createRequire(path.join(ROOT, "package.json")).resolve("@mermaid-js/mermaid-cli"),
);
const { default: puppeteer } = await import(cli.resolve("puppeteer"));

const run = (args, cwd) => execFileSync(process.execPath, args, { cwd, encoding: "utf8" });
const write = (dir, rel, text) => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), text);
};

/** A small project: the template model plus two ADRs that realize its system steps. */
function sampleProject(dir) {
  write(
    dir,
    "docs/ontology/orders.ttl",
    readFileSync(path.join(ONTOLOGY, "templates/ontology/example.ttl"), "utf8"),
  );
  const features = [
    ["checkout", "Checkout", "submit-order", "Customers submit the cart as an order"],
    ["confirmation", "Order confirmation", "confirm-order", "Paid orders are confirmed once"],
  ];
  const categories = {};
  for (const [key, feature, step, summary] of features) {
    const file = `docs/adr/${key}/0001-${step}.md`;
    write(
      dir,
      file,
      `# ADR 0001: ${summary}\n\nDate: 2026-11-01\n\n## Status\n\nAccepted (2026-11-02)\n\n## Purpose\n\n${summary}.\n\n## Decision\n\n${summary}.\n`,
    );
    categories[key] = {
      feature,
      adrs: [{ path: file, status: "Accepted (2026-11-02)", summary }],
      dependsOn: [],
      realizes: [`ordering.${step}`],
    };
  }
  write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories }, null, 2));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync(
    "git",
    ["-c", "user.email=docs@example.test", "-c", "user.name=docs", "commit", "-qm", "sample"],
    { cwd: dir },
  );
  run([path.join(ONTOLOGY, "scripts/ontology.mjs"), "view", "--no-open", "--lang", "en"], dir);
  const runs = path.join(dir, ".adr-review");
  const viewRun = readdirSync(runs).find((name) => name.includes("ontology-view"));
  return path.join(runs, viewRun, "ontology-view.html");
}

const work = mkdtempSync(path.join(tmpdir(), "readme-screenshots-"));
const browser = await puppeteer.launch({ executablePath: browserPath(), headless: true });
try {
  const view = sampleProject(path.join(work, "project"));
  const report = path.join(work, "report.html");
  run([
    path.join(REPORT, "scripts/render-report.mjs"),
    path.join(REPORT, "references/examples/report-with-quiz.json"),
    "--out",
    report,
  ]);

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  // Wait for the BC space's camera transition, then let layout and motion settle.
  const shot = async (name, options = {}) => {
    await page.evaluate(() => document.activeElement?.blur());
    await page
      .waitForFunction(
        () => document.getElementById("kw-space")?.dataset.transitioning !== "true",
        {
          timeout: 15000,
        },
      )
      .catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await page.screenshot({
      path: path.join(OUT, `${name}.webp`),
      type: "webp",
      quality: 82,
      ...options,
    });
    console.log(`docs/images/${name}.webp`);
  };
  const open = async (hash = "") => {
    await page.goto("about:blank"); // a hash-only change would keep the previous page state
    await page.goto(`file://${view}${hash}`, { waitUntil: "load" });
    await page.waitForSelector("#kw-space:not([hidden])");
  };
  mkdirSync(OUT, { recursive: true });

  await open();
  await shot("ontology-bc-overview");
  await open("#bc=ordering");
  await page.type("#kw-search", "payment");
  await shot("ontology-bc-search");
  // Search the BC, then open the step from its results, as a reader would.
  await open("#bc=ordering");
  await page.type("#kw-search", "confirm");
  const step = '#kw-results [data-knowledge-element="ordering.confirm-order"]';
  await page.waitForSelector(step, { visible: true });
  await page.click(step);
  await shot("ontology-step-detail");
  await open();
  await page.click("#kw-show-whole");
  await page.waitForSelector("#whole-workspace:not([hidden])");
  await shot("ontology-event-flow");
  await page.click("#view-structure-tab");
  await shot("ontology-business-structure");

  await page.goto(`file://${report}`, { waitUntil: "networkidle0" });
  await shot("report-writer", { clip: { x: 0, y: 0, width: 1440, height: 1420 } });
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
