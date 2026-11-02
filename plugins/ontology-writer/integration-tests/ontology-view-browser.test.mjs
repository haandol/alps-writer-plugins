// The ontology view in a real browser: landscape nodes lead to process flows and
// flow nodes lead to element details, by mouse and by keyboard. The page's
// navigation script finds Mermaid's rendered nodes by their DOM ids, so a
// Mermaid upgrade that changes that format fails here. The explorer finds and
// lists elements, a relation in the details leads to the other element, and the
// 3D city leads from a roof to its flow and from a floor to its step.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { browserPath } from "./browser.mjs";
import { MODEL, ONTO, RDFS, validateModel } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";
import { manyProcesses } from "../tests/ontology-view-helpers.mjs";

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve("@mermaid-js/mermaid-cli"));
const { default: puppeteer } = await import(cliRequire.resolve("puppeteer"));

const EXAMPLE = readFileSync(new URL("../templates/ontology/example.ttl", import.meta.url), "utf8");
const model = validateModel([{ doc: "docs/ontology/example.ttl", text: EXAMPLE }]);
const HTML = renderView({
  index: model.index,
  mapping: { categories: {} },
  findings: model.findings,
});
const LANDSCAPE = "#landscape figure[data-targets]";
const ORDERING_FLOW = "#process-el-ordering_2e_place-order figure[data-targets]";

let browser;
let page;
let wide;
let results;
const requests = [];
// The view is opened from a file, as the default browser opens it.
const dir = mkdtempSync(path.join(tmpdir(), "ontology-view-browser-"));
const file = path.join(dir, "ontology-view.html");
// A model with a landscape too large to draw unasked, and many flows.
const large = validateModel([
  { doc: "docs/ontology/example.ttl", text: EXAMPLE },
  { doc: "docs/ontology/many.ttl", text: manyProcesses(70) },
]);
const largeFile = path.join(dir, "large-view.html");
// A model with no hand-offs between processes, so no lights move in its city.
const plain = validateModel([
  {
    doc: "docs/ontology/plain.ttl",
    text: `@prefix m: <${MODEL}> .
@prefix onto: <${ONTO}> .
@prefix rdfs: <${RDFS}> .
m:customer a onto:Actor ; rdfs:label "Customer" ; onto:definition "A buyer." ;
    onto:performs m:sales.ask, m:sales.sell-it .
m:sales a onto:BoundedContext ; rdfs:label "Sales" ; onto:definition "Selling." .
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
`,
  },
]);
const plainFile = path.join(dir, "plain-view.html");
/** Abort and record every request that would leave the machine: the view opens offline. */
async function offline(p) {
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
const FAST = 6;
const fastClock = (p) =>
  p.evaluateOnNewDocument((k) => {
    const now = performance.now.bind(performance);
    performance.now = () => now() * k;
    const frame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => frame((time) => callback(time * k));
    const timeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, ms = 0, ...args) => timeout(callback, ms / k, ...args);
  }, FAST);
/** Wait `ms` of a fast page's time. */
const waitFast = (ms) => new Promise((resolve) => setTimeout(resolve, ms / FAST));
before(async () => {
  writeFileSync(file, HTML);
  writeFileSync(
    largeFile,
    renderView({ index: large.index, mapping: { categories: {} }, findings: large.findings }),
  );
  assert.deepEqual(plain.findings, []);
  writeFileSync(
    plainFile,
    renderView({ index: plain.index, mapping: { categories: {} }, findings: plain.findings }),
  );
  browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath(),
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
  page = await browser.newPage();
  await offline(page);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  results = await page.evaluate(drawAll);
  await page.waitForFunction(() =>
    document.querySelector('figure[data-targets] g.node[role="link"]'),
  );
  // A wide window shows the explorer, the city and the document side by side; with motion
  // reduced, nothing moves under the pointer.
  wide = await browser.newPage();
  await wide.setViewport({ width: 1440, height: 900 });
  await wide.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await offline(wide);
  await wide.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await wide.evaluate(drawAll);
});

/** Every figure drawn, as a reader scrolling through the page would have them; each figure's state. */
async function drawAll() {
  await window.reportDiagramsReady;
  const figures = [...document.querySelectorAll("figure[data-mermaid]")];
  await Promise.all(figures.map((figure) => window.reportDiagramRender(figure)));
  return figures.map((figure) => ({
    type: figure.dataset.diagramType,
    rendered: figure.dataset.renderState === "rendered",
  }));
}
/** Bring an element into view and let the page settle: sections are laid out as they come near. */
const settle = async (handle) => {
  await handle.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await handle.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
after(async () => {
  await browser?.close();
  rmSync(dir, { recursive: true, force: true });
});

/** The diagram node of a figure whose visible label starts with `label`; labels may wrap. */
async function nodeIn(figure, label, on = page) {
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
const position = (on = page) =>
  on.evaluate(() => ({
    hash: location.hash,
    focused: document.activeElement?.id ?? "",
    target: document.querySelector(":target")?.id ?? "",
  }));
const leave = (on = page) =>
  on.evaluate(() => {
    location.hash = "start";
    document.activeElement?.blur?.();
  });
const reached = (id) => ({ hash: `#${id}`, focused: id, target: id });

/** Follow a diagram node by mouse or by keyboard on the page that shows it. */
async function follow(node, how, on = page) {
  if (how === "mouse") {
    await settle(node);
    await node.click();
  } else {
    // Puppeteer's focus() accepts HTML elements only; an SVG node is focused by the page itself.
    await node.evaluate((g) => g.focus());
    await on.keyboard.press("Enter");
  }
}

async function select(node, how) {
  // Input reaches only the page in front; a page behind never renders what a click waits for.
  await page.bringToFront();
  await leave();
  await follow(node, how);
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
  await page.bringToFront();
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

/** The wide page in front, at its start, with the search box empty and the city over the whole model. */
async function fresh() {
  await wide.bringToFront();
  await leave(wide);
  await wide.$eval("#find", (input) => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
  });
  await wide.click("#city-reset");
}

test("the search finds an element by name or identifier, and Enter opens its details (R18)", async () => {
  for (const [term, id] of [
    ["Submit the order", "el-ordering_2e_submit-order"],
    ["payment.capture", "el-payment_2e_capture-payment"],
  ]) {
    await fresh();
    await wide.focus("#find");
    await wide.keyboard.type(term);
    const found = await wide.$$eval("#find-results a", (as) =>
      as.map((a) => a.getAttribute("href")),
    );
    assert.equal(found[0], `#${id}`, term);
    await wide.keyboard.press("Enter");
    assert.deepEqual(await position(wide), reached(id), term);
  }
  await fresh();
  assert.equal(await wide.$eval("#tree", (t) => t.hidden), false);
});

test("a context in the tree opens its details by mouse and by keyboard, and the tree marks what is shown (R18)", async () => {
  await fresh();
  await wide.click('nav.tree a[href="#el-payment"]');
  assert.deepEqual(await position(wide), reached("el-payment"));
  await fresh();
  await wide.focus('nav.tree a[href="#el-ordering"]');
  await wide.keyboard.press("Enter");
  assert.deepEqual(await position(wide), reached("el-ordering"));
  assert.equal(
    await wide.$eval('nav.tree a[href="#el-ordering"]', (a) => a.getAttribute("aria-current")),
    "location",
  );
  // A process reached at its details is marked like one reached at its flow.
  await fresh();
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
    await fresh();
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

test("pointing at a roof in the city opens its flow and at a floor its step, and the tree opens to it (R20)", async () => {
  for (const id of ["process-el-ordering_2e_place-order", "el-payment_2e_request-payment"]) {
    await fresh();
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
  await fresh();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(await wide.evaluate(() => window.ontologyViewCity.moving()), false);
  assert.equal(await wide.$eval("#city-motion", (b) => b.textContent), "Resume motion");
  assert.deepEqual(requests, []);
});

test("a diagram zooms by its buttons, Ctrl-scroll and keys, pans by dragging without following a node, fits back and enlarges until Escape", async () => {
  await fresh();
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
    await fresh();
    await wide.click(`${ORDERING_FLOW} .diagram-zoom button[data-zoom="in"]`);
    await follow(await nodeIn(ORDERING_FLOW, "Submit the order", wide), how, wide);
    assert.deepEqual(await position(wide), reached("el-ordering_2e_submit-order"), how);
  }
});

test("a diagram is drawn only once it comes near view, so the page opens without drawing them all", async () => {
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 800, height: 600 });
  await fresh.goto(pathToFileURL(largeFile).href, { waitUntil: "load" });
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

test("with motion on, the city stops drawing once the reader has been away, and a pointer over it wakes it", async () => {
  const idle = await browser.newPage();
  await idle.setViewport({ width: 1440, height: 900 });
  await fastClock(idle);
  await idle.goto(pathToFileURL(file).href, { waitUntil: "load" });
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
  await idle.goto(pathToFileURL(plainFile).href, { waitUntil: "load" });
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

test("a large landscape waits for its button, and only the flows just ahead of the reader are drawn while the page is idle", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  // With motion reduced the city keeps still, so the page is idle.
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(pathToFileURL(largeFile).href, { waitUntil: "load" });
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
  await paced.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await new Promise((resolve) => setTimeout(resolve, 3000)); // past the opening flight
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
    await still.goto(pathToFileURL(largeFile).href + fragment, { waitUntil: "load" });
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
