import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { before, after, test } from "node:test";
import { launch, offline, writeViews } from "./view-pages.mjs";
import { eventBoardPage } from "../scripts/eventstorming-board.mjs";
import { areaBoard } from "../tests/eventstorming-landscape-fixture.mjs";

let browser, views, candidate, example;
const requests = [],
  errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Compare rendered pixels, allowing the one-channel-level GPU dithering seen in
 * repeated captures of an unchanged stroke. PNG byte equality is not visual equality. */
async function pixelChange(page, first, second) {
  return page.evaluate(
    async (encoded) => {
      const images = await Promise.all(
        encoded.map(
          (base64) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = `data:image/png;base64,${base64}`;
            }),
        ),
      );
      const canvas = new OffscreenCanvas(images[0].width, images[0].height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const pixels = images.map((img) => {
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      });
      let changed = 0,
        maxDelta = 0;
      for (let i = 0; i < pixels[0].length; i += 4) {
        const delta = Math.max(
          ...[0, 1, 2].map((c) => Math.abs(pixels[0][i + c] - pixels[1][i + c])),
        );
        maxDelta = Math.max(maxDelta, delta);
        if (delta > 1) changed++;
      }
      return { changed, maxDelta };
    },
    // A screenshot may be a Uint8Array, whose toString ignores the encoding.
    [Buffer.from(first).toString("base64"), Buffer.from(second).toString("base64")],
  );
}
before(async () => {
  views = writeViews();
  browser = await launch();
  candidate = path.join(views.dir, "areas.html");
  example = path.join(views.dir, "order-payment.html");
  writeFileSync(candidate, eventBoardPage(areaBoard()));
  writeFileSync(
    example,
    eventBoardPage(
      JSON.parse(
        readFileSync(new URL("../examples/order-payment/board.json", import.meta.url), "utf8"),
      ),
      { lang: "ko" },
    ),
  );
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});
async function open(file = candidate, reduced = true) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1500, height: 1080 });
  if (reduced) await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  p.on("pageerror", (e) => errors.push(e.message));
  await offline(p, requests);
  await p.goto(pathToFileURL(file).href);
  await p.waitForFunction(() => Boolean(document.querySelector(".event-timeline")?.timeline));
  return p;
}
async function areas(p) {
  await p.focus('[data-event-perspective="landscape"]');
  await p.keyboard.press("Enter");
  await p.waitForFunction(
    () =>
      document.querySelector(".event-landscape").checkVisibility() &&
      document.querySelectorAll(".land-route").length > 0,
  );
}

test("the visible EventStorming set reads from performer and input view through change to event and result view", async () => {
  const p = await open(example);
  try {
    const sets = await p.$$eval(".story-node", (nodes) =>
      nodes.map((n) => {
        const rect = (s) => n.querySelector(s).getBoundingClientRect();
        return {
          id: n.dataset.storyNode,
          performer: n.querySelector(".story-performer").textContent,
          inputBefore: rect('[data-story-view-role="input"]').bottom <= rect(".story-action").top,
          causeBeforeEffect:
            rect(".story-action").bottom < rect(".story-objects").top &&
            rect(".story-objects").bottom < rect(".story-fact").top,
          resultAfter: rect('[data-story-view-role="result"]').top > rect(".story-fact").bottom,
        };
      }),
    );
    assert.ok(sets.every((s) => s.inputBefore && s.causeBeforeEffect && s.resultAfter));
    assert.match(sets.find((s) => s.id === "capture-payment").performer, /외부 결제 제공자/);
    assert.match(sets.find((s) => s.id === "confirm-order").performer, /주문 처리 시스템/);
    await p.click('.story-node[data-story-node="submit-order"] .story-view summary');
    await p.click(
      '.story-node[data-story-node="submit-order"] .story-view .event-evidence summary',
    );
    assert.match(
      await p.$eval('.story-node[data-story-node="submit-order"] .story-view', (e) => e.innerText),
      /business-notes.md#views/,
    );
    assert.match(
      await p.$eval('.story-node[data-story-node="capture-payment"]', (e) => e.innerText),
      /입력 뷰 미기록[\s\S]*결과 뷰 미기록/,
    );
    await p.focus('.story-fact[data-story-select="confirm-order"]');
    await p.keyboard.press("Enter");
    assert.match(
      await p.$eval('.story-inspector [data-view-role="result"]', (e) => e.innerText),
      /주문 현황[\s\S]*결과 확인/,
    );
  } finally {
    await p.close();
  }
});

test("territories preserve single, shared, unknown and external memberships and lead into the actual event trace", async () => {
  const p = await open();
  try {
    await areas(p);
    const placements = await p.$$eval(".land-context", (nodes) =>
      nodes.map((n) => ({
        id: n.dataset.contextId,
        region: n.closest(".land-region").dataset.landRegion,
        external: n.classList.contains("land-external"),
      })),
    );
    assert.equal(placements.length, 5);
    assert.equal(placements.find((c) => c.id === "reconciliation").region, "shared:");
    assert.equal(placements.find((c) => c.id === "other-ordering").region, "unassigned:");
    assert.equal(placements.find((c) => c.id === "partner").external, true);
    assert.equal(
      placements.find((c) => c.id === "payment").external,
      false,
      "An external performer does not imply an external context",
    );
    await p.focus('[data-land-inspect="id:reconciliation"]');
    await p.keyboard.press("Enter");
    const detail = await p.$eval(".land-inspector-body", (e) => e.innerText);
    assert.match(detail, /Sales[\s\S]*Finance/);
    assert.match(detail, /Settlement worker[\s\S]*Settlement reconciled/);
    await p.click('.land-inspector [data-land-stage="reconcile"]');
    assert.equal(await p.$eval(".event-landscape", (e) => e.hidden), true);
    assert.equal(await p.$eval(".event-timeline", (e) => e.timeline.selected()), "reconcile");
    assert.match(
      await p.$eval(".story-inspector-body", (e) => e.innerText),
      /Settlement worker[\s\S]*Settlement reconciled/,
    );
    await areas(p);
    await p.click(".land-close");
    await p.focus('.land-link-label[data-land-from="id:payment"][data-land-to="id:ordering"]');
    await p.keyboard.press("Enter");
    await p.click(".land-inspector [data-land-link-index]");
    assert.match(
      await p.$eval(".story-inspector-body", (e) => e.innerText),
      /Confirm after payment/,
    );
    assert.equal(await p.$eval(".event-landscape", (e) => e.hidden), true);
  } finally {
    await p.close();
  }
});

test("area dragging is navigation only, and switching perspectives preserves cameras and resets on reload", async () => {
  const p = await open(example);
  try {
    const storage = await p.evaluate(() => [
      JSON.stringify(localStorage),
      JSON.stringify(sessionStorage),
    ]);
    const source = await p.$$eval(".event-board .event-stage", (es) =>
      es.map((e) => e.textContent),
    );
    await areas(p);
    const initial = await p.$eval(".event-landscape", (e) => e.landscape.camera());
    const b = await (await p.$('.land-context[data-context-id="ordering"]')).boundingBox();
    await p.mouse.move(b.x + 30, b.y + 45);
    await p.mouse.down();
    await p.mouse.move(b.x + 110, b.y + 85, { steps: 8 });
    await p.mouse.up();
    const moved = await p.$eval(".event-landscape", (e) => ({
      camera: e.landscape.camera(),
      selected: e.landscape.selected(),
    }));
    assert.ok(moved.camera.x > initial.x + 60 && moved.camera.y > initial.y + 25);
    assert.equal(moved.selected, null);
    await p.click('[data-land-camera="in"]');
    const zoomed = await p.$eval(".event-landscape", (e) => e.landscape.camera());
    assert.ok(zoomed.zoom > moved.camera.zoom);
    await p.click('[data-event-perspective="story"]');
    await areas(p);
    assert.deepEqual(await p.$eval(".event-landscape", (e) => e.landscape.camera()), zoomed);
    assert.deepEqual(
      await p.$$eval(".event-board .event-stage", (es) => es.map((e) => e.textContent)),
      source,
    );
    assert.deepEqual(
      await p.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]),
      storage,
    );
    await p.reload();
    await areas(p);
    assert.deepEqual(await p.$eval(".event-landscape", (e) => e.landscape.camera()), initial);
    await p.setViewport({ width: 390, height: 844 });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  } finally {
    await p.close();
  }
});

test("a visible signal changes actual pixels with a readable tail, while pause stays still across perspectives", async () => {
  const p = await open(example, false);
  try {
    await p.waitForFunction(
      () => document.querySelector(".event-timeline").timeline.flow().frames > 2,
    );
    const clip = await p.$eval(".story-signal", (e) => {
      const b = e.getBoundingClientRect();
      return { x: Math.ceil(b.x), y: Math.floor(b.y - 6), width: Math.floor(b.width), height: 12 };
    });
    const before = await p.screenshot({ clip });
    await sleep(650);
    const moving = await pixelChange(p, before, await p.screenshot({ clip }));
    assert.ok(
      moving.changed >= 10 && moving.maxDelta >= 10,
      "The signal visibly changes a region, not just a clock or GPU dithering",
    );
    const tails = () =>
      p.$$eval(".story-signal", (es) => es.map((e) => Number(e.dataset.trailPixels)));
    assert.ok((await tails()).every((n) => n >= 12 && n <= 25));
    await p.click(".story-projection .event-flow-toggle");
    assert.equal(
      await p.$eval(".story-projection .event-flow-status", (e) => e.dataset.flowState),
      "paused",
    );
    const stopped = await p.$eval(".event-timeline", (e) => e.timeline.flow());
    const paused = await p.screenshot({ clip });
    await sleep(100);
    assert.equal((await pixelChange(p, paused, await p.screenshot({ clip }))).changed, 0);
    assert.deepEqual(await p.$eval(".event-timeline", (e) => e.timeline.flow()), stopped);
    await areas(p);
    assert.equal(await p.$eval(".event-landscape", (e) => e.landscape.flow().enabled), false);
    assert.equal(
      await p.$eval(".event-landscape .event-flow-status", (e) => e.dataset.flowState),
      "paused",
    );
    await p.click(".land-flow-toggle");
    await p.waitForFunction(
      () => document.querySelector(".event-landscape").landscape.flow().frames > 2,
    );
    assert.equal(await p.$eval(".event-timeline", (e) => e.timeline.flow().reason), "hidden");
    assert.ok(await p.$eval(".land-signal", (e) => Number(e.dataset.trailPixels) >= 12));
    await p.click('[data-event-perspective="story"]');
    await p.waitForFunction(
      () => document.querySelector(".event-timeline").timeline.flow().running,
    );
    for (let i = 0; i < 10; i++) await p.click('[data-story-camera="out"]');
    assert.ok((await tails()).every((n) => n >= 12 && n <= 25));
  } finally {
    await p.close();
  }
});

test("saved-model areas keep missing subdomains and views explicit, and reduced-motion status matches playback", async () => {
  const p = await open(views.example);
  try {
    assert.equal(
      await p.$eval(".story-projection .event-flow-status", (e) => e.dataset.flowState),
      "reduced",
    );
    await areas(p);
    assert.match(
      await p.$eval(".land-domain", (e) => e.innerText),
      /Domain name unconfirmed[\s\S]*Subdomain membership unconfirmed/,
    );
    assert.equal(await p.$$eval(".land-region:not(.land-unassigned)", (es) => es.length), 0);
    assert.equal(
      await p.$eval(".event-landscape .event-flow-status", (e) => e.dataset.flowState),
      "reduced",
    );
    assert.equal(await p.$eval(".event-landscape", (e) => e.landscape.flow().frames), 0);
    assert.equal(await p.$$eval("[data-model-tab]", (es) => es.length), 2);
  } finally {
    await p.close();
  }
});

test("area sequence and absent source events stay static, with their original actions available on inspection", async () => {
  const board = areaBoard();
  board.links = [{ ...board.links[0], relation: "sequence" }, board.links[1]];
  board.stages.find((s) => s.id === "pay").event = null;
  const file = path.join(views.dir, "static-areas.html");
  writeFileSync(file, eventBoardPage(board));
  const p = await open(file, false);
  try {
    await areas(p);
    assert.equal(await p.$$eval(".land-signal", (es) => es.length), 0);
    assert.equal(await p.$eval(".land-flow-toggle", (e) => e.disabled), true);
    assert.equal(
      await p.$eval(".event-landscape .event-flow-status", (e) => e.dataset.flowState),
      "empty",
    );
    await p.focus(".land-link-label.sequence");
    await p.keyboard.press("Enter");
    assert.match(
      await p.$eval(".land-inspector-body", (e) => e.innerText),
      /Action order, not event causation[\s\S]*Submit order → Collect payment/,
    );
  } finally {
    await p.close();
  }
});
