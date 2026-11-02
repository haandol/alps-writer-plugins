// The ontology view in a real browser: landscape nodes lead to process flows and
// flow nodes lead to element details, by mouse and by keyboard. The page's
// navigation script finds Mermaid's rendered nodes by their DOM ids, so a
// Mermaid upgrade that changes that format fails here. The explorer finds and
// lists elements, a relation in the details leads to the other element, and the
// diagrams zoom and are drawn as they come near. The 3D city has a file of its own,
// so the two run side by side.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  drawAll,
  follow,
  fresh,
  launch,
  leave,
  nodeIn,
  offline,
  openWide,
  position,
  reached,
  settle,
  writeViews,
} from "./view-pages.mjs";

const LANDSCAPE = "#landscape figure[data-targets]";
const ORDERING_FLOW = "#process-el-ordering_2e_place-order figure[data-targets]";

let views;
let browser;
let page;
let wide;
let results;
const requests = [];
before(async () => {
  views = writeViews();
  browser = await launch();
  page = await browser.newPage();
  await offline(page, requests);
  await page.goto(pathToFileURL(views.example).href, { waitUntil: "load" });
  results = await page.evaluate(drawAll);
  await page.waitForFunction(() =>
    document.querySelector('figure[data-targets] g.node[role="link"]'),
  );
  wide = await openWide(browser, views.example, requests);
  await wide.evaluate(drawAll);
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
});

async function select(node, how) {
  // Input reaches only the page in front; a page behind never renders what a click waits for.
  await page.bringToFront();
  await leave(page);
  await follow(page, node, how);
  return position(page);
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
      assert.deepEqual(await select(await nodeIn(page, LANDSCAPE, label), how), reached(id), label);
  });

  test(`an element in a process flow opens its details by ${how}`, async () => {
    for (const [label, id] of [
      ["Submit the order", "el-ordering_2e_submit-order"],
      ["Customer", "el-customer"],
      ["Order placed", "el-ordering_2e_order-placed"],
      ["Request payment for a new order", "el-payment_2e_request-on-order"],
    ])
      assert.deepEqual(
        await select(await nodeIn(page, ORDERING_FLOW, label), how),
        reached(id),
        label,
      );
  });
}

test("the Tab key moves from the navigation bar into the landscape diagram, and Enter follows the node", async () => {
  await page.bringToFront();
  await leave(page);
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
  assert.deepEqual(await position(page), reached(focused.target));
});

test("the search finds an element by name or identifier, and Enter opens its details (R18)", async () => {
  for (const [term, id] of [
    ["Submit the order", "el-ordering_2e_submit-order"],
    ["payment.capture", "el-payment_2e_capture-payment"],
  ]) {
    await fresh(wide);
    await wide.focus("#find");
    await wide.keyboard.type(term);
    const found = await wide.$$eval("#find-results a", (as) =>
      as.map((a) => a.getAttribute("href")),
    );
    assert.equal(found[0], `#${id}`, term);
    await wide.keyboard.press("Enter");
    assert.deepEqual(await position(wide), reached(id), term);
  }
  await fresh(wide);
  assert.equal(await wide.$eval("#tree", (t) => t.hidden), false);
});

test("a context in the tree opens its details by mouse and by keyboard, and the tree marks what is shown (R18)", async () => {
  await fresh(wide);
  await wide.click('nav.tree a[href="#el-payment"]');
  assert.deepEqual(await position(wide), reached("el-payment"));
  await fresh(wide);
  await wide.focus('nav.tree a[href="#el-ordering"]');
  await wide.keyboard.press("Enter");
  assert.deepEqual(await position(wide), reached("el-ordering"));
  assert.equal(
    await wide.$eval('nav.tree a[href="#el-ordering"]', (a) => a.getAttribute("aria-current")),
    "location",
  );
  // A process reached at its details is marked like one reached at its flow.
  await fresh(wide);
  await wide.evaluate(() => (location.hash = "el-ordering_2e_place-order"));
  await wide.waitForFunction(
    () =>
      document
        .querySelector('nav.tree a[href="#process-el-ordering_2e_place-order"]')
        ?.getAttribute("aria-current") === "location",
  );
});

for (const how of ["mouse", "keyboard"])
  test(`a relation in an element's details opens the other element by ${how} (R19)`, async () => {
    await fresh(wide);
    const relation = '#el-ordering_2e_submit-order li a[href="#el-ordering_2e_confirm-order"]';
    if (how === "mouse") {
      await settle(await wide.$(relation));
      await wide.click(relation);
    } else {
      await wide.focus(relation);
      await wide.keyboard.press("Enter");
    }
    assert.deepEqual(await position(wide), reached("el-ordering_2e_confirm-order"));
  });

test("a diagram zooms by its buttons, Ctrl-scroll and keys, pans by dragging without following a node, fits back and enlarges until Escape", async () => {
  await fresh(wide);
  const figure = LANDSCAPE;
  const view = () =>
    wide.$eval(`${figure} svg`, (svg) => {
      const b = svg.viewBox.baseVal;
      return { x: b.x, y: b.y, width: b.width };
    });
  const press = (name) => wide.click(`${figure} .diagram-zoom button[data-zoom="${name}"]`);
  const fitted = await view();
  await press("in");
  const zoomed = await view();
  assert.ok(zoomed.width < fitted.width * 0.8, "the zoom button zooms in");
  const area = await (await wide.$(`${figure} .diagram__viewport`)).boundingBox();
  const [cx, cy] = [area.x + area.width / 2, area.y + area.height / 2];
  await wide.mouse.move(cx, cy);
  await wide.mouse.wheel({ deltaY: -200 });
  assert.equal((await view()).width, zoomed.width, "a plain scroll leaves the zoom");
  await wide.keyboard.down("Control");
  await wide.mouse.wheel({ deltaY: -200 });
  await wide.keyboard.up("Control");
  const closer = await view();
  assert.ok(closer.width < zoomed.width, "Ctrl-scroll zooms in");
  await wide.mouse.down();
  await wide.mouse.move(cx - 90, cy - 40, { steps: 6 });
  await wide.mouse.up();
  const moved = await view();
  assert.ok(moved.x > closer.x && moved.y > closer.y, "dragging pans");
  assert.equal(await wide.evaluate(() => location.hash), "#start", "a drag follows no node");
  await press("fit");
  assert.deepEqual(await view(), fitted);
  await wide.focus(`${figure} .diagram-zoom button[data-zoom="fit"]`);
  await wide.keyboard.press("+");
  assert.ok((await view()).width < fitted.width, "+ zooms in");
  await wide.keyboard.press("0");
  assert.deepEqual(await view(), fitted, "0 fits");
  await press("enlarge");
  assert.equal(await wide.$eval(figure, (f) => f.classList.contains("expanded")), true);
  await wide.keyboard.press("Escape");
  assert.equal(await wide.$eval(figure, (f) => f.classList.contains("expanded")), false);
  assert.deepEqual(await view(), fitted);
});

test("a node of a zoomed-in diagram still opens its target by mouse and by keyboard", async () => {
  for (const how of ["mouse", "keyboard"]) {
    await fresh(wide);
    await wide.click(`${ORDERING_FLOW} .diagram-zoom button[data-zoom="in"]`);
    await follow(wide, await nodeIn(wide, ORDERING_FLOW, "Submit the order"), how);
    assert.deepEqual(await position(wide), reached("el-ordering_2e_submit-order"), how);
  }
});

test("a diagram is drawn only once it comes near view, so the page opens without drawing them all", async () => {
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 800, height: 600 });
  await fresh.goto(pathToFileURL(views.large).href, { waitUntil: "load" });
  await fresh.evaluate(() => window.reportDiagramsReady);
  const last = () =>
    fresh.evaluate(
      () =>
        [...document.querySelectorAll("section.process figure[data-mermaid]")].at(-1).dataset
          .renderState,
    );
  assert.equal(await last(), "pending");
  await fresh.evaluate(() =>
    [...document.querySelectorAll("section.process figure[data-mermaid]")].at(-1).scrollIntoView(),
  );
  await fresh.waitForFunction(
    () =>
      [...document.querySelectorAll("section.process figure[data-mermaid]")].at(-1).dataset
        .renderState === "rendered",
  );
  await fresh.close();
});

test("a large landscape waits for its button, and only the flows just ahead of the reader are drawn while the page is idle", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  // With motion reduced the city keeps still, so the page is idle.
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(pathToFileURL(views.large).href, { waitUntil: "load" });
  await page.evaluate(() => window.reportDiagramsReady);
  const landscape = () => page.$eval("#landscape figure", (f) => f.dataset.renderState);
  assert.equal(await landscape(), "pending");
  const flows = () =>
    page.$$eval("section.process figure[data-mermaid]", (figures) =>
      figures.map((f) => f.dataset.renderState),
    );
  // Further above the first flow than "near", but within "ahead".
  await page.evaluate(() => {
    const flow = document.querySelector("section.process");
    document.querySelector(".document").scrollTop = flow.offsetTop - 2200;
  });
  await page.waitForFunction(
    () => document.querySelector("section.process figure").dataset.renderState === "rendered",
  );
  // Left idle, the page draws only what lies ahead of the reader.
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const drawn = await flows();
  assert.equal(drawn.at(-1), "pending", "a flow far below waits");
  assert.ok(drawn.filter((s) => s === "rendered").length < 15, drawn.join());
  await page.evaluate(() => (document.querySelector(".document").scrollTop = 0));
  await page.click("#landscape .diagram-draw");
  await page.waitForFunction(
    () => document.querySelector("#landscape figure").dataset.renderState === "rendered",
  );
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "link");
  assert.equal(await page.$eval("#landscape .diagram-status", (s) => s.hidden), true);
  await page.close();
});
