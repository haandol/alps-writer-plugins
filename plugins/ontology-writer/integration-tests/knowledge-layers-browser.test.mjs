import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { validateModel, parseTurtle, serializeTurtle } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";
import { EXAMPLE } from "../tests/ontology-helpers.mjs";
import { MAPPING } from "../tests/ontology-query-helpers.mjs";
import { launch, offline } from "./view-pages.mjs";

let browser, page, dir, files, baseline;
const requests = [],
  errors = [];
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
function writeView(name, text) {
  const v = validateModel([{ doc: "model.ttl", text }]);
  const mapping = {
    categories: {
      ordering: {
        ...MAPPING.categories.ordering,
        adrs: [
          { path: path.join(dir, "ordering.md"), status: "Proposed", summary: "Order contract" },
        ],
      },
      payments: MAPPING.categories.payments,
    },
  };
  const file = path.join(dir, `${name}.html`);
  writeFileSync(file, renderView({ index: v.index, findings: v.findings, mapping }));
  return file;
}
async function load(file = files.base) {
  await page.setViewport({ width: 1440, height: 960 });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.dataset.knowledgeLevel === "contexts");
}
async function openBC(id = "ordering") {
  await page.click(`.kw-bc-card[data-knowledge-card="${id}"] button`);
  await page.waitForFunction(
    (id) =>
      document.getElementById("kw-bc-id").textContent === id &&
      document.body.dataset.knowledgeLevel === "bc",
    {},
    id,
  );
}
async function openElement(id) {
  await page.click(`[data-knowledge-element="${id}"]`);
  await page.waitForSelector("#kw-detail article");
}
before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ontology-knowledge-browser-"));
  writeFileSync(path.join(dir, "ordering.md"), "# Ordering\n\n## Status\n\nProposed\n");
  let large = EXAMPLE;
  for (let i = 0; i < 45; i++)
    large += `
m:ordering.extra-${i} a onto:Step ; rdfs:label "Extra work ${i}" ; onto:definition "Review the requested item ${i}." ; onto:stepKind "system" ; onto:inContext m:ordering .
m:ordering.place-order onto:hasStep m:ordering.extra-${i} .
m:customer onto:performs m:ordering.extra-${i} .
`;
  const legacy = serializeTurtle(
    parseTurtle(EXAMPLE).triples.filter((t) => !t.p.endsWith("coreLogic")),
  );
  files = {
    base: writeView("base", EXAMPLE),
    large: writeView("large", large),
    legacy: writeView("legacy", legacy),
    invalidMembership: writeView(
      "invalid-membership",
      EXAMPLE + "\nm:ordering.confirm-order onto:inContext m:payment .\n",
    ),
    unsafe: writeView(
      "unsafe",
      EXAMPLE.replace(
        'rdfs:label "Ordering"',
        'rdfs:label "</script><img src=x onerror=alert(1)>"',
      ),
    ),
  };
  baseline = Object.values(files).map(hash);
  browser = await launch();
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await offline(page, requests);
});
after(async () => {
  await browser?.close();
  assert.deepEqual(
    Object.values(files).map(hash),
    baseline,
    "navigation never changes the view's files",
  );
  assert.deepEqual(requests, [], "the knowledge workspace remains offline");
  assert.deepEqual(errors, [], "all UI paths avoid uncaught exceptions");
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test("first paint shows BC knowledge and collaborations while internal renderers remain idle", async () => {
  await load();
  const state = await page.evaluate(() => ({
    cards: [...document.querySelectorAll(".kw-bc-card")].map((c) => c.textContent),
    wholeHidden: document.getElementById("whole-workspace").hidden,
    rows: document.querySelectorAll("#kw-results button").length,
    rendered: document.querySelectorAll('figure[data-render-state="rendered"]').length,
    initialized: Boolean(document.querySelector(".event-timeline")?.timeline),
  }));
  assert.equal(state.cards.length, 2);
  assert.match(state.cards[0], /matching payment completes/);
  assert.equal(state.wholeHidden, true);
  assert.equal(state.rows, 0);
  assert.equal(state.rendered, 0);
  assert.equal(state.initialized, false);
});

test("BC and element selection work with keyboard and preserve the BC's search when returning", async () => {
  await load();
  await page.focus('.kw-bc-card[data-knowledge-card="ordering"] button');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.dataset.knowledgeLevel === "bc");
  await page.select("#kw-type", "Step");
  await page.type("#kw-search", "Confirm the order");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#kw-detail article");
  assert.match(await page.$eval("#kw-detail", (e) => e.textContent), /Confirm the order/);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "H3");
  const adr = await page.$eval('#kw-detail a[href^="file:"]', (a) => ({
    href: a.href,
    text: a.textContent,
  }));
  assert.equal(adr.href, pathToFileURL(path.join(dir, "ordering.md")).href);
  await page.click("#kw-close-detail");
  await page.click("#kw-home");
  await openBC();
  assert.equal(await page.$eval("#kw-search", (e) => e.value), "Confirm the order");
  assert.equal(await page.$eval("#kw-type", (e) => e.value), "Step");
});

test("an internal keyword finds a BC without showing the internal result on the upper layer", async () => {
  await load();
  await page.type("#kw-context-search", "authorizes");
  const shown = await page.$$eval(".kw-bc-card", (cards) =>
    cards.filter((c) => !c.hidden).map((c) => c.dataset.knowledgeCard),
  );
  assert.deepEqual(shown, ["payment"]);
  await openBC("payment");
  assert.equal(await page.$eval("#kw-search", (e) => e.value), "authorizes");
  assert.ok(
    (
      await page.$$eval("#kw-results button", (bs) => bs.map((b) => b.dataset.knowledgeElement))
    ).includes("payment.request-payment"),
  );
});

test("a BC's source facts and document location remain available from its knowledge header", async () => {
  await load();
  await openBC();
  await page.click("#kw-bc-source");
  await page.waitForSelector("#kw-detail article");
  const text = await page.$eval("#kw-detail", (e) => e.textContent);
  assert.match(text, /BoundedContext: Ordering/);
  assert.match(text, /model\.ttl:/);
  assert.match(text, /matching payment completes/);
});

test("large BC lists are paged without mixing another BC's internal steps", async () => {
  await load(files.large);
  await openBC();
  await page.select("#kw-type", "Step");
  const seen = [];
  while (true) {
    const ids = await page.$$eval("#kw-results button", (bs) =>
      bs.map((b) => b.dataset.knowledgeElement),
    );
    assert.ok(ids.length <= 20);
    assert.ok(ids.every((id) => id.startsWith("ordering.")));
    seen.push(...ids);
    if (await page.$eval("#kw-next", (b) => b.disabled)) break;
    await page.click("#kw-next");
  }
  assert.equal(seen.length, 47);
  assert.equal(new Set(seen).size, 47);
  assert.ok(
    seen.indexOf("ordering.submit-order") < seen.indexOf("ordering.confirm-order"),
    "steps retain modeled flow order",
  );
  assert.ok(seen.includes("ordering.extra-44"));
  const savedPage = await page.$eval("#kw-page", (e) => e.textContent);
  await page.click("#kw-home");
  await openBC();
  assert.equal(await page.$eval("#kw-page", (e) => e.textContent), savedPage);
});

test("following a boundary relation changes to its owning BC and browser back restores the prior context", async () => {
  await load();
  await openBC();
  await openElement("ordering.confirm-order");
  await page.click('#kw-detail a[href="#el-ordering_2e_confirm-on-payment"]');
  await page.waitForSelector('#kw-detail a[href="#el-payment_2e_payment-completed"]');
  await page.click('#kw-detail a[href="#el-payment_2e_payment-completed"]');
  await page.waitForFunction(() => document.getElementById("kw-bc-id").textContent === "payment");
  assert.match(await page.$eval("#kw-crumb", (e) => e.textContent), /Payment/);
  await page.goBack();
  await page.waitForFunction(() => document.getElementById("kw-bc-id").textContent === "ordering");
  assert.match(await page.$eval("#kw-detail", (e) => e.textContent), /Confirm once paid/);
});

test("a selected process draws its flow on demand and its nodes lead to scoped details", async () => {
  await load();
  await openBC();
  await openElement("ordering.place-order");
  await page.waitForSelector('#kw-detail figure[data-render-state="rendered"] g.node[role="link"]');
  assert.equal(await page.$eval("#whole-workspace", (e) => e.hidden), true);
  assert.equal(
    await page.evaluate(() => Boolean(document.querySelector(".event-timeline")?.timeline)),
    false,
  );
  const link = await page.$('#kw-detail g.node[aria-label="Submit the order"]');
  assert.ok(link);
  await link.evaluate((g) => g.focus());
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.getElementById("kw-detail").textContent.includes("The customer sends the cart"),
  );
});

test("whole event and structure views remain available and returning restores scoped search", async () => {
  await load();
  await openBC();
  await page.type("#kw-search", "paid");
  await page.click("#kw-show-whole");
  await page.waitForFunction(
    () =>
      document.body.dataset.knowledgeLevel === "all" &&
      document.querySelector(".event-timeline")?.timeline,
  );
  await page.click("#view-structure-tab");
  await page.waitForFunction(() => !document.getElementById("city").hidden);
  await page.click("#kw-up");
  await page.waitForFunction(() => document.body.dataset.knowledgeLevel === "bc");
  assert.equal(await page.$eval("#kw-search", (e) => e.value), "paid");
  await page.click("#kw-show-whole");
  await page.waitForFunction(() => document.body.dataset.knowledgeLevel === "all");
  assert.equal(await page.evaluate(() => document.body.dataset.modelView), "structure");
});

test("legacy missing knowledge and inert model text remain inspectable without inventing facts", async () => {
  await load(files.legacy);
  assert.equal(await page.$$eval(".kw-bc-card .kw-warning", (els) => els.length), 2);
  assert.match(await page.$eval(".kw-core", (e) => e.textContent), /not been recorded/);
  await load(files.unsafe);
  assert.equal(await page.$$(".kw-bc-card img").then((els) => els.length), 0);
  assert.match(
    await page.$eval('.kw-bc-card[data-knowledge-card="ordering"] h3', (e) => e.textContent),
    /<img/,
  );
});

test("invalid multiple ownership is unconfirmed rather than a legitimate shared element", async () => {
  await load(files.invalidMembership);
  await openBC();
  const row = await page.$eval(
    '[data-knowledge-element="ordering.confirm-order"]',
    (e) => e.textContent,
  );
  assert.match(row, /Context membership unconfirmed/);
  assert.doesNotMatch(row, /Shared element/);
  await openElement("ordering.confirm-order");
  assert.match(
    await page.$eval("#kw-detail-context", (e) => e.textContent),
    /Context membership unconfirmed/,
  );
});

test("the BC and detail controls remain usable on a narrow screen", async () => {
  await load();
  await page.setViewport({ width: 390, height: 844 });
  await openBC();
  await openElement("ordering.confirm-order");
  assert.ok(await page.$eval("#kw-close-detail", (e) => e.getBoundingClientRect().width > 0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.click("#kw-close-detail");
  await page.waitForFunction(
    () => document.getElementById("kw-search").getBoundingClientRect().width > 0,
  );
  assert.ok(await page.$eval("#kw-search", (e) => e.getBoundingClientRect().width > 0));
});
