// The ontology view's 3D city in a real browser: a roof leads to its flow and a floor to
// its step, the city stays still when the reader prefers reduced motion, rests once the
// reader has been away, turns while they are idle, paces its own motion, and leaves out
// what lies outside a close view. It runs beside the document's browser tests.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  fastClock,
  fresh,
  launch,
  openWide,
  position,
  reached,
  waitFast,
  writeViews,
} from "./view-pages.mjs";

let views;
let browser;
let wide;
const requests = [];
before(async () => {
  views = writeViews();
  browser = await launch();
  wide = await openWide(browser, views.example, requests);
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
});

test("pointing at a roof in the city opens its flow and at a floor its step, and the tree opens to it (R20)", async () => {
  for (const id of ["process-el-ordering_2e_place-order", "el-payment_2e_request-payment"]) {
    await fresh(wide);
    const point = await wide.evaluate((target) => window.ontologyViewCity.locate(target), id);
    assert.ok(point, `${id} is drawn in the city`);
    await wide.mouse.click(point.x, point.y);
    assert.deepEqual(await position(wide), reached(id));
    const marked = await wide.$$eval(`nav.tree a[href="#${id}"]`, (as) =>
      as.map((a) => a.getAttribute("aria-current") === "location" && a.checkVisibility()),
    );
    assert.ok(marked.length && marked.every(Boolean), id);
  }
});

test("with motion reduced the city stays still, offers to resume motion and requests nothing", async () => {
  await fresh(wide);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(await wide.evaluate(() => window.ontologyViewCity.moving()), false);
  assert.equal(await wide.$eval("#city-motion", (b) => b.textContent), "Resume motion");
  assert.deepEqual(requests, []);
});

test("with motion on, the city stops drawing once the reader has been away, and a pointer over it wakes it", async () => {
  const idle = await browser.newPage();
  await idle.setViewport({ width: 1440, height: 900 });
  await fastClock(idle);
  await idle.goto(pathToFileURL(views.example).href, { waitUntil: "load" });
  assert.equal(await idle.evaluate(() => window.ontologyViewCity.moving()), true);
  // Past the city's 12 s rest.
  await waitFast(14000);
  assert.equal(await idle.evaluate(() => window.ontologyViewCity.moving()), false);
  const box = await (await idle.$("#city-canvas")).boundingBox();
  await idle.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await idle.evaluate(() => window.ontologyViewCity.moving()), true);
  await idle.close();
});

test("with motion on, a city without hand-offs also turns once the reader has been idle a while, then rests", async () => {
  const idle = await browser.newPage();
  await idle.setViewport({ width: 1440, height: 900 });
  await fastClock(idle);
  await idle.goto(pathToFileURL(views.plain).href, { waitUntil: "load" });
  // Locating a shape ends the opening flight, so only turning can change the canvas after it.
  assert.ok(await idle.evaluate(() => window.ontologyViewCity.locate("process-el-sales_2e_sell")));
  const canvas = async () =>
    createHash("sha256")
      .update(await idle.$eval("#city-canvas", (c) => c.toDataURL()))
      .digest("hex");
  const still = await canvas();
  // Past the 3.5 s the reader is idle before the city turns, then past its 12 s rest.
  await waitFast(4500);
  assert.notEqual(await canvas(), still, "the city turns");
  await waitFast(9500);
  assert.equal(await idle.evaluate(() => window.ontologyViewCity.moving()), false);
  await idle.close();
});

test("moving on its own, the city asks the browser for about 30 frames a second, not one per display refresh", async () => {
  const paced = await browser.newPage();
  await paced.setViewport({ width: 1440, height: 900 });
  // Every frame the page asks for, counted.
  await paced.evaluateOnNewDocument(() => {
    const ask = window.requestAnimationFrame.bind(window);
    window.framesAsked = 0;
    window.requestAnimationFrame = (callback) => {
      window.framesAsked += 1;
      return ask(callback);
    };
  });
  await paced.goto(pathToFileURL(views.example).href, { waitUntil: "load" });
  // Locating a shape ends the opening flight, so what follows is the city moving on its own:
  // the hand-offs' lights.
  assert.ok(
    await paced.evaluate(() =>
      window.ontologyViewCity.locate("process-el-ordering_2e_place-order"),
    ),
  );
  const before = await paced.evaluate(() => window.framesAsked);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const asked = (await paced.evaluate(() => window.framesAsked)) - before;
  assert.ok(asked >= 20 && asked <= 80, `${asked} frames in 2 s`);
  await paced.close();
});

test("zoomed in on one process, the city leaves out what lies outside the view", async () => {
  const PLACE_ORDER = "process-el-ordering_2e_place-order";
  /** The shapes the city draws, opened at `fragment`, and whether the process is among them. */
  async function shapes(fragment) {
    const still = await browser.newPage();
    await still.setViewport({ width: 1440, height: 900 });
    await still.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await still.goto(pathToFileURL(views.large).href + fragment, { waitUntil: "load" });
    const drawn = await still.evaluate((id) => {
      const point = window.ontologyViewCity.locate(id);
      return { point, shapes: window.ontologyViewCity.shapes() };
    }, PLACE_ORDER);
    await still.close();
    return drawn;
  }
  const whole = await shapes("");
  const near = await shapes(`#${PLACE_ORDER}`);
  assert.ok(whole.point && near.point, "the process is drawn both ways");
  assert.ok(
    near.shapes * 4 < whole.shapes,
    `${near.shapes} shapes up close, ${whole.shapes} in all`,
  );
});
