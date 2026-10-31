// The process view in a real browser: landscape nodes lead to process flows and
// flow nodes lead to element details, by mouse and by keyboard. The page's
// navigation script finds Mermaid's rendered nodes by their DOM ids, so a
// Mermaid upgrade that changes that format fails here.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { browserPath } from "../evals/deepeval/coverage-render.mjs";
import { validateModel } from "../scripts/process-model-lib.mjs";
import { renderView } from "../scripts/process-model-view.mjs";

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve("@mermaid-js/mermaid-cli"));
const { default: puppeteer } = await import(cliRequire.resolve("puppeteer"));

const EXAMPLE = readFileSync(new URL("../templates/process/example.ttl", import.meta.url), "utf8");
const model = validateModel([{ doc: "docs/process/example.ttl", text: EXAMPLE }]);
const HTML = renderView({
  index: model.index,
  mapping: { categories: {} },
  findings: model.findings,
});
const LANDSCAPE = "#landscape figure[data-targets]";
const ORDERING_FLOW = "#process-el-ordering_2e_place-order figure[data-targets]";

let browser;
let page;
let results;
const requests = [];
// The view is opened from a file, as the default browser opens it.
const dir = mkdtempSync(path.join(tmpdir(), "process-view-browser-"));
const file = path.join(dir, "process-view.html");
before(async () => {
  writeFileSync(file, HTML);
  browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath(),
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      requests.push(request.url());
      request.abort();
    } else request.continue();
  });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  results = await page.evaluate(() => window.reportDiagramsReady);
  await page.waitForFunction(() =>
    document.querySelector('figure[data-targets] g.node[role="link"]'),
  );
});
after(async () => {
  await browser?.close();
  rmSync(dir, { recursive: true, force: true });
});

/** The diagram node of a figure whose visible label starts with `label`; labels may wrap. */
async function nodeIn(figure, label) {
  const handle = await page.evaluateHandle(
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

/** Where the page is after an action: the URL fragment, the focused element and the :target element. */
const position = () =>
  page.evaluate(() => ({
    hash: location.hash,
    focused: document.activeElement?.id ?? "",
    target: document.querySelector(":target")?.id ?? "",
  }));
const leave = () =>
  page.evaluate(() => {
    location.hash = "start";
    document.activeElement?.blur?.();
  });
const reached = (id) => ({ hash: `#${id}`, focused: id, target: id });

async function select(node, how) {
  await leave();
  if (how === "mouse") await node.click();
  else {
    // Puppeteer's focus() accepts HTML elements only; an SVG node is focused by the page itself.
    await node.evaluate((g) => g.focus());
    await page.keyboard.press("Enter");
  }
  return position();
}

test("the view renders offline and every diagram node becomes a focusable link", async () => {
  assert.ok(results.length >= 3, JSON.stringify(results));
  assert.ok(
    results.every((result) => result.rendered),
    JSON.stringify(results),
  );
  assert.deepEqual(requests, []);
  const nodes = await page.$$eval("figure[data-targets] g.node", (gs) =>
    gs.map((g) => ({
      id: g.id,
      role: g.getAttribute("role"),
      tabindex: g.getAttribute("tabindex"),
    })),
  );
  assert.ok(nodes.length > 0);
  for (const node of nodes) assert.deepEqual([node.role, node.tabindex], ["link", "0"], node.id);
});

for (const how of ["mouse", "keyboard"]) {
  test(`a process in the landscape opens its flow by ${how}`, async () => {
    for (const [label, id] of [
      ["Place an order", "process-el-ordering_2e_place-order"],
      ["Take a payment", "process-el-payment_2e_take-payment"],
    ])
      assert.deepEqual(await select(await nodeIn(LANDSCAPE, label), how), reached(id), label);
  });

  test(`an element in a process flow opens its details by ${how}`, async () => {
    for (const [label, id] of [
      ["Submit the order", "el-ordering_2e_submit-order"],
      ["Customer", "el-customer"],
      ["Order placed", "el-ordering_2e_order-placed"],
      ["Request payment for a new order", "el-payment_2e_request-on-order"],
    ])
      assert.deepEqual(await select(await nodeIn(ORDERING_FLOW, label), how), reached(id), label);
  });
}

test("the Tab key moves from the navigation bar into the landscape diagram, and Enter follows the node", async () => {
  await leave();
  await page.focus('nav a[href="#elements"]');
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const g = document.activeElement;
    const figure = g?.closest?.("figure[data-targets]");
    const node = /flowchart-(n\d+)-/.exec(g?.id ?? "")?.[1];
    return {
      inLandscape: Boolean(g?.closest?.("#landscape")),
      role: g?.getAttribute?.("role") ?? null,
      target: figure && node ? JSON.parse(figure.dataset.targets)[node] : null,
    };
  });
  assert.equal(focused.inLandscape, true, JSON.stringify(focused));
  assert.equal(focused.role, "link");
  assert.ok(focused.target);
  await page.keyboard.press("Enter");
  assert.deepEqual(await position(), reached(focused.target));
});
