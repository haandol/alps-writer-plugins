import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { before, after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { launch, offline, writeViews, showStructure } from "./view-pages.mjs";
import { BOARD } from "../tests/eventstorming-fixture.mjs";
import { eventBoardPage } from "../scripts/eventstorming-board.mjs";
let browser, page, views;
const requests = [];
const flow = () => page.$eval(".event-timeline", (h) => h.timeline.flow());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
before(async () => {
  views = writeViews();
  browser = await launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });
  await offline(page, requests);
  await page.goto(pathToFileURL(views.example).href);
  await page.waitForFunction(
    () => document.querySelector(".event-timeline")?.timeline?.flow().frames > 2,
  );
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
});

test("subtle story signals follow only recorded event reactions while facts, path geometry and camera stay still", async () => {
  const camera = await page.$eval(".event-timeline", (h) => h.timeline.camera());
  const original = await page.$eval("#view-data", (e) => e.textContent);
  const geometry = await page.$$eval(".story-connections path:not(.story-signal)", (es) =>
    es.map((p) => p.getAttribute("d")),
  );
  const first = await flow();
  const expected = await page.$$eval('.event-board .event-next[data-relation="causal"]', (es) =>
    es
      .map((e) => ({ from: e.dataset.from, to: e.dataset.to }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
  assert.deepEqual(
    first.paths
      .map(({ from, to }) => ({ from, to }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    expected,
  );
  const offsets = await page.$$eval(".story-signal", (es) =>
    es.map((p) => p.style.strokeDashoffset),
  );
  await sleep(180);
  const next = await flow();
  assert.ok(next.frames > first.frames && next.elapsed > first.elapsed);
  for (const p of first.paths) {
    const n = next.paths.find((q) => q.from === p.from && q.to === p.to);
    assert.ok((n.t - p.t + 1) % 1 > 0, "progress runs from source toward destination");
  }
  assert.notDeepEqual(
    await page.$$eval(".story-signal", (es) => es.map((p) => p.style.strokeDashoffset)),
    offsets,
  );
  assert.deepEqual(
    await page.$$eval(".story-connections path:not(.story-signal)", (es) =>
      es.map((p) => p.getAttribute("d")),
    ),
    geometry,
  );
  assert.deepEqual(await page.$eval(".event-timeline", (h) => h.timeline.camera()), camera);
  assert.equal(await page.$eval("#view-data", (e) => e.textContent), original);
  assert.match(await page.$eval(".event-flow-note", (e) => e.textContent), /not live execution/);
  assert.deepEqual(requests, []);
});

test("story motion pauses on request, while hidden and when out of view, then resumes without moving the viewport", async () => {
  await page.click(".event-flow-toggle");
  const paused = await flow();
  assert.equal(paused.enabled, false);
  await sleep(100);
  assert.equal((await flow()).frames, paused.frames);
  assert.equal((await flow()).elapsed, paused.elapsed);
  await page.click(".event-flow-toggle");
  await page.waitForFunction(
    (n) => document.querySelector(".event-timeline").timeline.flow().frames > n,
    {},
    paused.frames,
  );
  const scroll = await page.$eval(".document", (e) => e.scrollTop);
  await showStructure(page);
  const hidden = await flow();
  assert.equal(hidden.running, false);
  await sleep(100);
  assert.equal((await flow()).frames, hidden.frames);
  await page.click("#view-events-tab");
  await page.waitForFunction(
    (n) => document.querySelector(".event-timeline").timeline.flow().frames > n,
    {},
    hidden.frames,
  );
  assert.ok(Math.abs((await page.$eval(".document", (e) => e.scrollTop)) - scroll) < 2);
  await page.$eval("#workflow-readiness", (e) => e.scrollIntoView());
  await page.waitForFunction(
    () => !document.querySelector(".event-timeline").timeline.flow().running,
  );
  const away = await flow();
  await sleep(100);
  assert.equal((await flow()).frames, away.frames);
});

test("reduced motion disables startup and stops a playing story on a new reduced-motion preference", async () => {
  const other = await browser.newPage();
  try {
    await other.setViewport({ width: 1500, height: 1000 });
    await other.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await offline(other, requests);
    await other.goto(pathToFileURL(views.example).href);
    await other.waitForSelector(".story-signal");
    assert.equal(await other.$eval(".event-timeline", (h) => h.timeline.flow().enabled), false);
    await sleep(100);
    assert.equal(await other.$eval(".event-timeline", (h) => h.timeline.flow().frames), 0);
    await other.click(".event-flow-toggle");
    await other.waitForFunction(
      () => document.querySelector(".event-timeline").timeline.flow().frames > 0,
    );
    const changed = other.evaluate(
      () =>
        new Promise((resolve) =>
          matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
            "change",
            (e) => resolve(e.matches),
            { once: true },
          ),
        ),
    );
    await other.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    assert.equal(await changed, false);
    await other.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await other.waitForFunction(
      () => !document.querySelector(".event-timeline").timeline.flow().enabled,
    );
    const count = await other.$eval(".event-timeline", (h) => h.timeline.flow().frames);
    await sleep(100);
    assert.equal(await other.$eval(".event-timeline", (h) => h.timeline.flow().frames), count);
  } finally {
    await other.close();
  }
});

test("a missing emitted event and sequence-only work do not acquire animated communications", async () => {
  const board = structuredClone(BOARD);
  board.stages[0].event = null;
  const file = path.join(views.dir, "unrecorded-event.html");
  writeFileSync(file, eventBoardPage(board));
  const other = await browser.newPage();
  try {
    await offline(other, requests);
    await other.goto(pathToFileURL(file).href);
    await other.waitForSelector(".story-signal");
    assert.deepEqual(
      await other.$eval(".event-timeline", (h) =>
        h.timeline.flow().paths.map(({ from, to }) => ({ from, to })),
      ),
      [{ from: "pay", to: "confirm" }],
    );
    await other.goto(pathToFileURL(views.plain).href);
    await other.waitForSelector(".story-connections path");
    assert.equal(await other.$eval(".event-timeline", (h) => h.timeline.flow().paths.length), 0);
    assert.equal(await other.$eval(".event-flow-toggle", (e) => e.disabled), true);
    assert.deepEqual(requests, []);
  } finally {
    await other.close();
  }
});
