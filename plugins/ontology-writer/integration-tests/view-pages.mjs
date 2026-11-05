// What the ontology view's browser tests share: the views they open, a browser that keeps
// them offline, a faster page clock, and the ways a reader moves through a page.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { browserPath } from "./browser.mjs";
import { MODEL, ONTO, RDFS, validateModel } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";
import { manyProcesses } from "../tests/ontology-view-helpers.mjs";

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve("@mermaid-js/mermaid-cli"));
const { default: puppeteer } = await import(cliRequire.resolve("puppeteer"));

const EXAMPLE = readFileSync(new URL("../templates/ontology/example.ttl", import.meta.url), "utf8");
// A model with no hand-offs between processes, so no lights move in its city.
const PLAIN = `@prefix m: <${MODEL}> .
@prefix onto: <${ONTO}> .
@prefix rdfs: <${RDFS}> .
m:customer a onto:Actor ; rdfs:label "Customer" ; onto:definition "A buyer." ;
    onto:performs m:sales.ask, m:sales.sell-it .
m:sales a onto:BoundedContext ; rdfs:label "Sales" ; onto:definition "Selling." ; onto:coreLogic "A buyer asks for a thing and the store sells it." .
m:sales.sell a onto:Process ; rdfs:label "Sell" ; onto:definition "Selling a thing." ;
    onto:startCondition "A buyer asks." ; onto:businessOutcome "It is sold." ;
    onto:openScope "none"^^onto:NoOpenScope ; onto:status "Proposed" ;
    onto:hasStep m:sales.ask, m:sales.sell-it .
m:sales.ask a onto:Step ; rdfs:label "Ask" ; onto:definition "The buyer asks." ;
    onto:stepKind "system" ; onto:flowsTo m:sales.sell-it ; onto:inContext m:sales .
m:sales.sell-it a onto:Step ; rdfs:label "Sell it" ; onto:definition "The store sells." ;
    onto:stepKind "system" ; onto:inContext m:sales .
m:sales.sell.done a onto:ObservationCriterion ; rdfs:label "A sale ends sold" ;
    onto:startCondition "A buyer asks." ; onto:observedResult "The thing is sold." ;
    onto:criterionOf m:sales.sell .
`;

/** The view of a model made of `documents`, with no ADR index. */
function render(documents) {
  const model = validateModel(documents);
  return {
    findings: model.findings,
    html: renderView({
      index: model.index,
      mapping: { categories: {} },
      findings: model.findings,
      initialView: "events",
    }),
  };
}

/**
 * Write the views the tests open into a fresh directory, since the default browser opens a
 * view from a file: the example model, one whose landscape is too large to draw unasked and
 * that has many flows, and one with no hand-offs. Returns the directory and the files.
 */
export function writeViews() {
  const dir = mkdtempSync(path.join(tmpdir(), "ontology-view-browser-"));
  const plain = render([{ doc: "docs/ontology/plain.ttl", text: PLAIN }]);
  assert.deepEqual(plain.findings, []);
  const views = {
    dir,
    example: path.join(dir, "ontology-view.html"),
    large: path.join(dir, "large-view.html"),
    plain: path.join(dir, "plain-view.html"),
  };
  writeFileSync(views.example, render([{ doc: "docs/ontology/example.ttl", text: EXAMPLE }]).html);
  writeFileSync(
    views.large,
    render([
      { doc: "docs/ontology/example.ttl", text: EXAMPLE },
      { doc: "docs/ontology/many.ttl", text: manyProcesses(70) },
    ]).html,
  );
  writeFileSync(views.plain, plain.html);
  return views;
}

/** A headless browser on this machine's Chrome. */
export const launch = () =>
  puppeteer.launch({
    headless: true,
    executablePath: browserPath(),
    args: process.env.CI ? ["--no-sandbox"] : [],
  });

/** Abort and record in `requests` every request that would leave the machine: the view opens offline. */
export async function offline(p, requests) {
  await p.setRequestInterception(true);
  p.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      requests.push(request.url());
      request.abort();
    } else request.continue();
  });
}

/**
 * Run a page's clock `FAST` times faster from its start: timer delays, `performance.now` and
 * the times animation frames receive, which are all the city measures. The city keeps its own
 * durations, and a test waits through its idle periods without spending them.
 */
export const FAST = 6;
export const fastClock = (p) =>
  p.evaluateOnNewDocument((k) => {
    const now = performance.now.bind(performance);
    performance.now = () => now() * k;
    const frame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => frame((time) => callback(time * k));
    const timeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, ms = 0, ...args) => timeout(callback, ms / k, ...args);
  }, FAST);
/** Wait `ms` of a fast page's time. */
export const waitFast = (ms) => new Promise((resolve) => setTimeout(resolve, ms / FAST));

/** Every figure drawn, as a reader scrolling through the page would have them; each figure's state. Runs in the page. */
export async function drawAll() {
  await window.reportDiagramsReady;
  const figures = [...document.querySelectorAll("figure[data-mermaid]")];
  await Promise.all(figures.map((figure) => window.reportDiagramRender(figure)));
  return figures.map((figure) => ({
    type: figure.dataset.diagramType,
    rendered: figure.dataset.renderState === "rendered",
  }));
}

/** Bring an element into view and let the page settle: sections are laid out as they come near. */
export async function settle(handle) {
  await handle.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await handle.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** The diagram node of a figure on page `on` whose visible label starts with `label`; labels may wrap. */
export async function nodeIn(on, figure, label) {
  const handle = await on.evaluateHandle(
    (selector, wanted) => {
      const squash = (s) => s.replace(/\s+/g, "");
      return (
        [...document.querySelectorAll(`${selector} g.node`)].find((g) =>
          squash(g.textContent).startsWith(squash(wanted)),
        ) ?? null
      );
    },
    figure,
    label,
  );
  const node = handle.asElement();
  assert.ok(node, `no diagram node "${label}" in ${figure}`);
  return node;
}

/** Where a page is after an action: the URL fragment, the focused element and the :target element. */
export const position = (on) =>
  on.evaluate(() => ({
    hash: location.hash,
    focused: document.activeElement?.id ?? "",
    target: document.querySelector(":target")?.id ?? "",
  }));
export const leave = (on) =>
  on.evaluate(() => {
    location.hash = "start";
    document.activeElement?.blur?.();
  });
export const reached = (id) => ({ hash: `#${id}`, focused: id, target: id });

/** Follow a diagram node by mouse or by keyboard on the page `on` that shows it. */
export async function follow(on, node, how) {
  if (how === "mouse") {
    await settle(node);
    await node.click();
  } else {
    // Puppeteer's focus() accepts HTML elements only; an SVG node is focused by the page itself.
    await node.evaluate((g) => g.focus());
    await on.keyboard.press("Enter");
  }
}

/** A wide page in front, at its start, with the search box empty and the city over the whole model. */
export async function fresh(wide) {
  await wide.bringToFront();
  await showStructure(wide);
  await leave(wide);
  await wide.$eval("#find", (input) => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
  });
  await wide.click("#city-reset");
}

/**
 * A wide window that shows the explorer, the city and the document side by side, with motion
 * reduced so nothing moves under the pointer, opened offline at `file`.
 */
export async function openWide(browser, file, requests) {
  const wide = await browser.newPage();
  await wide.setViewport({ width: 1440, height: 900 });
  await wide.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await offline(wide, requests);
  await wide.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await showStructure(wide);
  return wide;
}

/** Select the whole-model structure explicitly, entering that workspace if needed. */
export async function showStructure(page) {
  if (await page.$eval("#whole-workspace", (e) => e.hidden)) await page.click("#kw-show-whole");
  await page.click("#view-structure-tab");
  await page.waitForFunction(
    () =>
      !document.getElementById("city").hidden &&
      document.getElementById("city-canvas").getBoundingClientRect().width > 0,
  );
}
