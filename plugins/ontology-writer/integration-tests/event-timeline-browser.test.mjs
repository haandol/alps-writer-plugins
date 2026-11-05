import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { launch, offline, writeViews } from "./view-pages.mjs";
import { eventBoardPage } from "../scripts/eventstorming-board.mjs";
import { BOARD } from "../tests/eventstorming-fixture.mjs";

let browser, page, views, initial;
const requests = [],
  errors = [];
const state = () =>
  page.$eval(".event-timeline", (h) => ({
    camera: h.timeline.camera(),
    selected: h.timeline.selected(),
  }));
before(async () => {
  views = writeViews();
  browser = await launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1080 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  page.on("pageerror", (e) => errors.push(e.message));
  await offline(page, requests);
  await page.goto(pathToFileURL(views.example).href);
  await page.waitForSelector(".story-connections path:not(.story-signal)");
  initial = await state();
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
});

test("the default story foregrounds real events and conditions across contexts, keeping command-only steps and questions honest", async () => {
  assert.equal(
    await page.$eval("#view-events-tab", (e) => e.getAttribute("aria-selected")),
    "true",
  );
  assert.equal(await page.$("#event-context-map"), null);
  assert.equal(await page.$$eval("[data-model-tab]", (es) => es.length), 2);
  assert.equal(await page.$eval("#city", (e) => e.hidden), true);
  assert.deepEqual(
    await page.$$eval(".story-fact:not(.story-fact-missing) strong", (es) =>
      es.map((e) => e.textContent).sort(),
    ),
    ["Order confirmed", "Order placed", "Payment completed"],
  );
  assert.equal(await page.$$eval(".story-fact-missing", (es) => es.length), 1);
  const policy = await page.$eval(
    '.story-policy[data-story-to*="confirm-order"]',
    (e) => e.innerText,
  );
  assert.ok(
    policy.includes("Payment completed") &&
      policy.includes("The completed payment belongs to the order."),
  );
  assert.deepEqual(
    await page.$$eval(".story-connections path:not(.story-signal)", (es) =>
      es.map((e) => [e.dataset.from, e.dataset.to, e.dataset.relation]).sort(),
    ),
    await page.$$eval(".event-board .event-next", (es) =>
      es.map((e) => [e.dataset.from, e.dataset.to, e.dataset.relation]).sort(),
    ),
  );
  assert.equal(
    await page.$$eval('.story-question[data-question-scope="process"]', (es) => es.length),
    2,
  );
  if (process.env.ONTOLOGY_VIEW_CAPTURE_DIR) {
    mkdirSync(process.env.ONTOLOGY_VIEW_CAPTURE_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.ONTOLOGY_VIEW_CAPTURE_DIR, "event-story.png"),
    });
  }
  await page.click(".story-question summary");
  assert.match(
    await page.$eval(".story-question[open]", (e) => e.innerText),
    /not an established failure branch/,
  );
  await page.click(".story-question[open] summary");
  assert.deepEqual(requests, []);
});

test("selecting an event by keyboard opens the actual rule, trigger and unknown state, then reaches the same step in business structure", async () => {
  await page.focus('.story-fact[data-story-select*="confirm-order"]');
  await page.keyboard.press("Enter");
  assert.equal(await page.$eval(".story-inspector", (e) => e.hidden), false);
  const text = await page.$eval(".story-inspector-body", (e) => e.innerText);
  for (const part of [
    "Order system",
    "Taking a customer's purchase request and confirming it.",
    "Payment completed",
    "The completed payment belongs to the order.",
    "The collected amount equals the amount of the order it pays for.",
    "Related concept: Order",
  ])
    assert.ok(text.includes(part), part);
  assert.deepEqual(
    await page.$$eval(".story-inspector .entity-change dd", (es) => es.map((e) => e.textContent)),
    ["Unconfirmed", "Unconfirmed"],
  );
  const destination = await page.$eval(
    '.event-board .event-stage[data-stage*="confirm-order"] .command a',
    (a) => a.getAttribute("href"),
  );
  await page.click(".story-structure-link");
  await page.waitForFunction(
    (id) => location.hash === id && document.activeElement?.id === id.slice(1),
    {},
    destination,
  );
  assert.equal(
    await page.$eval("#view-structure-tab", (e) => e.getAttribute("aria-selected")),
    "true",
  );
  await page.click("#view-events-tab");
  assert.equal(await page.$eval(".story-inspector", (e) => e.hidden), false);
  await page.click(".story-close");
});

test("dragging a story card pans without selecting it and zoom remains local to this projection", async () => {
  await page.click('[data-story-camera="fit"]');
  const before = await state();
  const handle = await page.$('.story-fact[data-story-select*="submit-order"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 35, { steps: 12 });
  await page.mouse.up();
  const after = await state();
  assert.ok(after.camera.x > before.camera.x + 50);
  assert.equal(after.selected, before.selected);
  assert.equal(await page.$eval(".story-inspector", (e) => e.hidden), true);
  await page.click('[data-story-camera="in"]');
  assert.ok((await state()).camera.zoom > after.camera.zoom);
});

test("two keyboard tabs preserve the story camera, selection and model; reopening clears only transient navigation", async () => {
  const before = await state();
  const data = await page.$eval("#view-data", (e) => e.textContent);
  const storage = await page.evaluate(() => [
    JSON.stringify(localStorage),
    JSON.stringify(sessionStorage),
  ]);
  await page.focus("#view-events-tab");
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.$eval("#view-structure-tab", (e) => e.getAttribute("aria-selected")),
    "true",
  );
  await page.keyboard.press("Home");
  assert.deepEqual(await state(), before);
  assert.equal(await page.$eval("#view-data", (e) => e.textContent), data);
  assert.deepEqual(
    await page.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]),
    storage,
  );
  // Reopen the base view; a retained element fragment is an explicit deep link.
  await page.goto(pathToFileURL(views.example).href, { waitUntil: "load" });
  await page.waitForSelector(".story-connections path:not(.story-signal)");
  assert.deepEqual(await state(), initial);
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});

test("branch, merge, returning and self connections point into their recorded destinations in the browser", async () => {
  const board = structuredClone(BOARD);
  for (const [from, to] of [
    ["reject", "confirm"],
    ["confirm", "submit"],
    ["pay", "pay"],
  ])
    board.links.push({ ...board.links[0], from, to });
  const file = path.join(views.dir, "returning-events.html");
  writeFileSync(file, eventBoardPage(board));
  const other = await browser.newPage();
  try {
    await offline(other, requests);
    await other.goto(pathToFileURL(file).href);
    await other.waitForSelector(".story-connections path:not(.story-signal)");
    const paths = await other.$$eval(".story-connections path:not(.story-signal)", (paths) =>
      paths.map((path) => {
        const tip = path.getPointAtLength(path.getTotalLength());
        const prior = path.getPointAtLength(path.getTotalLength() - 0.5);
        const arrow = path.nextElementSibling.points;
        const tailX = (arrow[1].x + arrow[2].x) / 2;
        const tailY = (arrow[1].y + arrow[2].y) / 2;
        return {
          from: path.dataset.from,
          to: path.dataset.to,
          direction: (tip.x - tailX) * (tip.x - prior.x) + (tip.y - tailY) * (tip.y - prior.y),
        };
      }),
    );
    assert.equal(paths.length, board.links.length);
    assert.ok(
      paths.every((p) => p.direction > 0),
      "every arrow follows the terminal direction of its path, including return paths",
    );
    assert.ok(paths.some((p) => p.from === "pay" && p.to === "pay"));
    assert.ok(paths.some((p) => p.from === "confirm" && p.to === "submit"));
    assert.equal(
      await other.$("[role=tab]"),
      null,
      "candidates show only their event story, with no invented structure or duplicate map",
    );
    assert.equal(await other.$("#event-context-map"), null);
  } finally {
    await other.close();
  }
});
