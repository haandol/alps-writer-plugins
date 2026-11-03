import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { launch, offline, writeViews, showStructure } from "./view-pages.mjs";
import { eventBoardPage } from "../scripts/eventstorming-board.mjs";
import { BOARD } from "../tests/eventstorming-fixture.mjs";

let browser,
  page,
  views,
  counter = 0;
const requests = [],
  errors = [];
before(async () => {
  views = writeViews();
  browser = await launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1080 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  page.on("pageerror", (e) => errors.push(e.message));
  await offline(page, requests);
  await page.goto(pathToFileURL(views.example).href);
  await page.waitForSelector(".story-route");
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
});

test("main trace lines reach destination events or explicit action checkpoints, with solid order lines and original relations", async () => {
  const routes = await page.$$eval(".story-route:not(.story-signal)", (paths) =>
    paths.map((p) => {
      const host = p.closest(".event-timeline"),
        world = host.querySelector(".story-world").getBoundingClientRect();
      const zoom = host.timeline.camera().zoom,
        end = p.getPointAtLength(p.getTotalLength());
      const node = [...host.querySelectorAll("[data-story-node]")].find(
        (n) => n.dataset.storyNode === p.dataset.to,
      );
      const fact = node.querySelector(".story-fact").getBoundingClientRect();
      const x = world.left + end.x * zoom,
        y = world.top + end.y * zoom;
      return {
        kind: p.dataset.relation,
        endKind: p.dataset.traceEndpoint,
        onFact: Math.abs(x - fact.left) < 0.5 || Math.abs(x - fact.right) < 0.5,
        insideHeight: y >= fact.top && y <= fact.bottom,
        dash: getComputedStyle(p).strokeDasharray,
        afterCause:
          node.querySelector(".story-action").getBoundingClientRect().bottom <
            node.querySelector(".story-objects").getBoundingClientRect().top &&
          node.querySelector(".story-objects").getBoundingClientRect().bottom < fact.top,
      };
    }),
  );
  assert.ok(routes.length > 0 && routes.every((r) => r.onFact && r.insideHeight && r.afterCause));
  assert.ok(routes.some((r) => r.kind === "causal" && r.endKind === "event"));
  assert.ok(routes.some((r) => r.kind === "causal" && r.endKind === "action"));
  assert.ok(routes.filter((r) => r.kind === "sequence").every((r) => r.dash === "none"));
  assert.match(
    await page.$eval(".story-fact-missing", (e) => e.innerText),
    /Intermediate action[\s\S]*Request the payment[\s\S]*No emitted event/,
  );
  assert.equal(await page.$$eval(".story-trace-label", (e) => e.length), routes.length);
});

async function inspectRoute(from, to) {
  const index = await page.$eval(
    `.story-route[data-from*="${from}"][data-to*="${to}"]`,
    (e) => e.dataset.storyTrace,
  );
  await page.focus(`.story-trace-label[data-story-trace="${index}"]`);
  await page.keyboard.press("Enter");
  return Number(index);
}

test("a trace exposes the real policy/action/event chain, and a sequence or missing event never becomes a causal execution claim", async () => {
  const original = await page.$eval("#view-data", (e) => e.textContent);
  const normalShortcut = await page.$eval(".story-route-skip", (e) =>
    Number(getComputedStyle(e).opacity),
  );
  const chosen = await inspectRoute("capture-payment", "confirm-order");
  assert.ok(
    (await page.$eval(".story-route-skip", (e) => Number(getComputedStyle(e).opacity))) <
      normalShortcut,
    "the unrelated order shortcut is visibly dimmed, not only marked with a class",
  );
  let text = await page.$eval(".story-inspector-body", (e) => e.innerText);
  for (const value of [
    "Payment completed",
    "Order confirmed",
    "Confirm once paid",
    "The completed payment belongs to the order.",
    "Destination action: Confirm the order",
    "Emitted event: Order confirmed",
  ])
    assert.ok(text.includes(value), value);
  await page.click(".story-trace-contract .event-evidence summary");
  assert.match(
    await page.$eval(".story-trace-contract", (e) => e.innerText),
    /Model · ordering.confirm-on-payment/,
  );
  await showStructure(page);
  await page.click("#view-events-tab");
  assert.equal(await page.$eval(".event-timeline", (e) => e.timeline.selectedRoute()), chosen);
  await page.click(".story-trace-clear");
  assert.equal(await page.$eval(".event-timeline", (e) => e.timeline.selectedRoute()), null);
  assert.equal(await page.$eval(".story-inspector", (e) => e.hidden), true);

  const point = await page.$eval(`.story-route[data-story-trace="${chosen}"]`, (path) => {
    const host = path.closest(".event-timeline"),
      world = host.querySelector(".story-world").getBoundingClientRect();
    const p = path.getPointAtLength(path.getTotalLength() / 2),
      zoom = host.timeline.camera().zoom;
    return { x: world.left + p.x * zoom, y: world.top + p.y * zoom };
  });
  await page.mouse.click(point.x, point.y);
  assert.equal(
    await page.$eval(".event-timeline", (e) => e.timeline.selectedRoute()),
    chosen,
    "the visible trace line itself opens its relation",
  );
  await page.click(".story-trace-clear");

  await inspectRoute("submit-order", "confirm-order");
  text = await page.$eval(".story-inspector-body", (e) => e.innerText);
  assert.match(text, /Action order: Submit the order → Confirm the order/);
  assert.match(text, /not event causation or arrival time/);
  await page.click(".story-trace-clear");
  await inspectRoute("submit-order", "request-payment");
  assert.match(
    await page.$eval(".story-inspector-body", (e) => e.innerText),
    /No emitted event is recorded[\s\S]*Unrecorded · shown as an intermediate action/,
  );
  assert.equal(await page.$eval("#view-data", (e) => e.textContent), original);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});

async function candidate(board) {
  const file = path.join(views.dir, `trace-${counter++}.html`);
  writeFileSync(file, eventBoardPage(board));
  const other = await browser.newPage();
  await other.setViewport({ width: 1500, height: 1000 });
  await other.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await offline(other, requests);
  await other.goto(pathToFileURL(file).href);
  await other.waitForSelector(".story-route");
  return other;
}

test("choosing an event highlights its predecessors and successors while leaving a sibling branch separate", async () => {
  const other = await candidate(BOARD);
  try {
    const source = await other.$$eval(".event-board .event-stage", (es) =>
      es.map((e) => e.textContent),
    );
    await other.focus('.story-fact[data-story-select="confirm"]');
    await other.keyboard.press("Enter");
    assert.deepEqual(
      await other.$$eval(".story-node:not(.story-trace-muted)", (es) =>
        es.map((e) => e.dataset.storyNode).sort(),
      ),
      ["confirm", "pay", "submit"],
    );
    assert.deepEqual(
      await other.$$eval(".story-route.story-trace-active:not(.story-signal)", (es) =>
        es.map((e) => [e.dataset.from, e.dataset.to]).sort(),
      ),
      [
        ["pay", "confirm"],
        ["submit", "pay"],
      ],
    );
    assert.deepEqual(
      await other.$$eval(".event-board .event-stage", (es) => es.map((e) => e.textContent)),
      source,
    );
    await other.click(".story-trace-clear");
    assert.equal(await other.$eval(".event-timeline", (e) => e.timeline.selected()), null);
    assert.equal(await other.$$eval(".story-node.story-trace-muted", (es) => es.length), 0);
    assert.deepEqual(requests, []);
  } finally {
    await other.close();
  }
});

test("tracing a cycle terminates and retains every declared returning and self connection", async () => {
  const board = structuredClone(BOARD);
  board.links.push(
    { ...board.links[0], from: "confirm", to: "submit" },
    { ...board.links[0], from: "pay", to: "pay" },
  );
  const other = await candidate(board);
  try {
    await other.focus('.story-fact[data-story-select="pay"]');
    await other.keyboard.press("Enter");
    assert.equal(
      await other.$$eval(".story-route:not(.story-signal)", (es) => es.length),
      board.links.length,
    );
    assert.equal(
      await other.$$eval(".story-route.story-trace-active:not(.story-signal)", (es) => es.length),
      board.links.length,
    );
    await other.click(".story-trace-clear");
    assert.equal(await other.$$eval(".story-trace-muted", (es) => es.length), 0);
    assert.deepEqual(requests, []);
  } finally {
    await other.close();
  }
});
