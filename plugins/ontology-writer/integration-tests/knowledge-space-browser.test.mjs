import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { validateModel } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";
import { EXAMPLE } from "../tests/ontology-helpers.mjs";
import { MAPPING } from "../tests/ontology-query-helpers.mjs";
import { launch, offline } from "./view-pages.mjs";

let browser, page, dir, files, baseline;
const errors = [],
  requests = [];
const hash = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
function fixture(name, text) {
  const modelFile = path.join(dir, `${name}.ttl`);
  writeFileSync(modelFile, text);
  const v = validateModel([{ doc: modelFile, text }]);
  const html = path.join(dir, `${name}.html`);
  writeFileSync(html, renderView({ index: v.index, findings: v.findings, mapping: MAPPING }));
  return html;
}
before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ontology-space-browser-"));
  let large = EXAMPLE;
  for (let i = 0; i < 45; i++)
    large += `
m:ordering.extra-${i} a onto:Step ; rdfs:label "Extra work ${i}" ; onto:definition "Review the item ${i}." ; onto:stepKind "system" ; onto:inContext m:ordering .
m:ordering.place-order onto:hasStep m:ordering.extra-${i} .
m:customer onto:performs m:ordering.extra-${i} .
`;
  files = {
    base: fixture("base", EXAMPLE),
    large: fixture("large", large),
    unsafe: fixture(
      "unsafe",
      EXAMPLE.replace(
        'rdfs:label "Ordering"',
        'rdfs:label "</script><img src=x onerror=alert(1)>"',
      ) +
        `
m:constructor a onto:BoundedContext ; rdfs:label "Payment" ; onto:definition "Another scope." ; onto:coreLogic "A request receives a reply." .
m:__proto__ a onto:BoundedContext ; rdfs:label "Prototype" ; onto:definition "A distinct scope." ; onto:coreLogic "A request receives a result." .
`,
    ),
    invalid: fixture(
      "invalid",
      EXAMPLE + "\nm:ordering.confirm-order onto:inContext m:payment .\n",
    ),
  };
  writeFileSync(path.join(dir, "mapping.json"), JSON.stringify(MAPPING));
  baseline = new Map(
    Object.values(files)
      .flatMap((f) => [f, f.replace(/\.html$/, ".ttl")])
      .concat(path.join(dir, "mapping.json"))
      .map((f) => [f, hash(f)]),
  );
  browser = await launch();
  page = await browser.newPage();
  await offline(page, requests);
  page.on("pageerror", (e) => errors.push(e.message));
});
after(async () => {
  await browser?.close();
  for (const [file, before] of baseline) assert.equal(hash(file), before, file);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  if (dir) rmSync(dir, { recursive: true, force: true });
});
async function load(file = files.base, reduced = false) {
  await page.setViewport({ width: 1440, height: 960 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
  ]);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.waitForSelector("#kw-space:not([hidden])");
}
const settled = () =>
  page.waitForFunction(() => document.getElementById("kw-space").dataset.transitioning === "false");
const camera = () => page.$eval("#ks-world", (e) => e.style.transform);
async function enter(id = "ordering") {
  await page.waitForFunction(
    (id) => {
      const nodes = [...document.querySelectorAll("[data-space-context]")];
      return nodes.some((n) => n.dataset.spaceContext === id && !n.closest(".ks-island").inert);
    },
    {},
    id,
  );
  await page.focus(`[data-space-context="${id}"]`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (id) => document.getElementById("kw-space").dataset.scope === id,
    {},
    id,
  );
}
const internalKeys = () =>
  page.$$eval("[data-space-element]", (nodes) => nodes.map((n) => n.dataset.spaceElement));
const listKeys = () =>
  page.$$eval("#kw-results button", (nodes) => nodes.map((n) => n.dataset.knowledgeElement));

test("the 3D overview contains only authored BCs and collaborations, with internal scenes absent", async () => {
  await load();
  assert.equal(await page.evaluate(() => document.body.dataset.knowledgePresentation), "space");
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.depth), "0");
  assert.deepEqual(await internalKeys(), []);
  assert.match(await page.$eval("#ks-world", (e) => getComputedStyle(e).transform), /^matrix3d\(/);
  assert.deepEqual(
    await page.$$eval("[data-space-context]", (ns) => ns.map((n) => n.dataset.spaceContext)),
    ["ordering", "payment"],
  );
  assert.match(
    await page.$eval('[data-space-context="ordering"]', (e) => e.textContent),
    /matching payment completes/,
  );
  assert.deepEqual(
    await page.$$eval(".ks-collaborations line", (ns) =>
      ns.map((n) => [n.dataset.from, n.dataset.to]),
    ),
    [["ordering", "payment"]],
  );
  assert.equal(
    await page.evaluate(() => Boolean(document.querySelector(".event-timeline")?.timeline)),
    false,
  );
});

test("choosing a spatial BC animates its camera and expanding plate, then draws exactly the current page", async () => {
  await load();
  const before = await camera();
  const width = await page.$eval(
    '[data-space-island="ordering"] .ks-plate',
    (e) => e.getBoundingClientRect().width,
  );
  await enter();
  await page.waitForFunction(() =>
    document
      .getElementById("ks-world")
      .getAnimations()
      .some((a) => a.currentTime > 60),
  );
  const middle = await page.$eval("#ks-world", (e) => getComputedStyle(e).transform);
  assert.ok(
    await page.$eval(
      '[data-space-island="ordering"] .ks-plate',
      (e) => e.getAnimations().length > 0,
    ),
  );
  assert.ok(await page.$eval(".ks-inside button", (e) => e.getAnimations().length > 0));
  await settled();
  assert.notEqual(await camera(), before);
  assert.notEqual(await page.$eval("#ks-world", (e) => getComputedStyle(e).transform), middle);
  assert.ok(
    (await page.$eval(
      '[data-space-island="ordering"] .ks-plate',
      (e) => e.getBoundingClientRect().width,
    )) > width,
  );
  assert.deepEqual(await internalKeys(), await listKeys());
  assert.equal(
    await page.$eval('[data-space-island="payment"] .ks-inside', (e) => e.childElementCount),
    0,
  );
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.depth), "1");
});

test("spatial detail selection and upward navigation restore both camera and scoped search", async () => {
  await load();
  await page.focus("#ks-viewport");
  await page.keyboard.press("ArrowRight");
  const overview = await camera();
  await enter();
  await settled();
  await page.type("#kw-search", "Confirm the order");
  const inside = await camera();
  await page.click('[data-space-element="ordering.confirm-order"]');
  await page.waitForSelector("#kw-detail article");
  await settled();
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.depth), "2");
  assert.match(await page.$eval("#kw-detail", (e) => e.textContent), /Confirm the order/);
  assert.equal(
    await page.$eval('[data-space-element="ordering.confirm-order"]', (e) =>
      e.getAttribute("aria-current"),
    ),
    "true",
  );
  assert.notEqual(await camera(), inside);
  await page.click("#kw-up");
  await page.waitForFunction(() => document.getElementById("kw-space").dataset.depth === "1");
  await settled();
  assert.equal(await camera(), inside);
  assert.equal(await page.$eval("#kw-search", (e) => e.value), "Confirm the order");
  await page.click("#kw-home");
  await page.waitForFunction(
    () => document.getElementById("kw-space").dataset.scope === "contexts",
  );
  await settled();
  assert.equal(await camera(), overview);
  assert.deepEqual(await internalKeys(), []);
});

test("paging a large BC and switching list/3D keeps the same bounded results and selected page", async () => {
  await load(files.large, true);
  await enter();
  await page.select("#kw-type", "Step");
  const seen = [];
  while (true) {
    const spatial = await internalKeys();
    assert.deepEqual(spatial, await listKeys());
    assert.ok(spatial.length <= 20);
    assert.ok(spatial.every((k) => k.startsWith("ordering.")));
    seen.push(...spatial);
    if (await page.$eval("#kw-next", (e) => e.disabled)) break;
    await page.click("#kw-next");
  }
  assert.equal(new Set(seen).size, 47);
  assert.equal(seen.length, 47);
  const pageNumber = await page.$eval("#kw-page", (e) => e.textContent),
    before = await camera();
  await page.click("#kw-presentation");
  assert.equal(await page.$eval("#kw-space", (e) => e.hidden), true);
  assert.equal(await page.$eval("#kw-page", (e) => e.textContent), pageNumber);
  await page.click("#kw-presentation");
  assert.equal(await page.$eval("#kw-space", (e) => e.hidden), false);
  assert.equal(await camera(), before);
  assert.deepEqual(await internalKeys(), await listKeys());
});

test("returning from a spatial detail restores the BC reading pane's scroll position", async () => {
  await load(files.large, true);
  await enter();
  await page.hover("#kw-bc-panel");
  await page.mouse.wheel({ deltaY: 360 });
  await page.waitForFunction(() => document.getElementById("kw-bc-panel").scrollTop > 100);
  const before = await page.$eval("#kw-bc-panel", (e) => e.scrollTop);
  await page.focus('[data-space-element^="ordering.extra-"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector("#kw-detail article");
  await page.click("#kw-up");
  await page.waitForFunction(() => document.getElementById("kw-space").dataset.depth === "1");
  assert.equal(await page.$eval("#kw-bc-panel", (e) => e.scrollTop), before);
});

test("dragging a BC pans or rotates without entering it, and zoom/reset remain local to the scene", async () => {
  await load();
  await page.evaluate(() => {
    localStorage.setItem("existing-local", "keep");
    sessionStorage.setItem("existing-session", "keep");
  });
  const initial = await camera();
  const b = await (await page.$('[data-space-context="ordering"]')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 70, b.y + b.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.scope), "contexts");
  assert.notEqual(await camera(), initial);
  // Keyboard commands avoid the drag's deliberately suppressed trailing click.
  await page.focus('[data-space-action="rotate"]');
  await page.keyboard.press("Enter");
  await page.focus("#ks-viewport");
  const spin = await page.$eval("#ks-world", (e) => e.style.getPropertyValue("--ks-spin"));
  await page.keyboard.press("ArrowRight");
  assert.notEqual(
    await page.$eval("#ks-world", (e) => e.style.getPropertyValue("--ks-spin")),
    spin,
  );
  assert.notEqual(await camera(), initial);
  const rotated = await camera();
  await page.keyboard.press("+");
  assert.notEqual(await camera(), rotated);
  await page.keyboard.press("Home");
  await settled();
  assert.equal(await camera(), initial);
  assert.deepEqual(
    await page.evaluate(() => ({
      local: localStorage.getItem("existing-local"),
      session: sessionStorage.getItem("existing-session"),
    })),
    { local: "keep", session: "keep" },
  );
  await page.goto(pathToFileURL(files.base).href);
  await page.waitForSelector("#kw-space:not([hidden])");
  assert.equal(await camera(), initial);
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.scope), "contexts");
});

test("a new BC or home chosen during a transition always wins over the older camera animation", async () => {
  await load();
  await enter();
  await page.click('#kw-neighbors [data-knowledge-context="payment"]');
  await page.waitForFunction(() => document.getElementById("kw-space").dataset.scope === "payment");
  await page.click("#kw-home");
  await page.waitForFunction(
    () => document.getElementById("kw-space").dataset.scope === "contexts",
  );
  await enter("payment");
  await settled();
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.scope), "payment");
  assert.equal(await page.$eval("#kw-bc-id", (e) => e.textContent), "payment");
  assert.match(await page.evaluate(() => location.hash), /^#bc=payment$/);
  assert.deepEqual(await internalKeys(), await listKeys());
  assert.equal(await page.$eval("#ks-world", (e) => e.getAnimations({ subtree: true }).length), 0);
});

test("reduced motion and turning transitions off settle effects without changing the destination", async () => {
  await load(files.base, true);
  await enter();
  assert.equal(await page.$eval("#ks-world", (e) => e.getAnimations({ subtree: true }).length), 0);
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.scope), "ordering");
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.click("#kw-home");
  await page.waitForFunction(
    () => document.getElementById("kw-space").dataset.transitioning === "true",
  );
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await settled();
  assert.equal(await page.$eval("#ks-world", (e) => e.getAnimations({ subtree: true }).length), 0);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.click("#ks-motion");
  await enter("payment");
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.motion), "false");
  assert.equal(await page.$eval("#ks-world", (e) => e.getAnimations({ subtree: true }).length), 0);
  assert.equal(await page.$eval("#kw-bc-id", (e) => e.textContent), "payment");
});

test("leaving the knowledge workspace or hiding its tab ends effects and preserves the return route", async () => {
  await load();
  await enter();
  await page.click("#kw-show-whole");
  await page.waitForFunction(() => document.getElementById("kw-space").hidden);
  assert.equal(await page.$eval("#ks-world", (e) => e.getAnimations({ subtree: true }).length), 0);
  await page.click("#kw-up");
  await page.waitForFunction(
    () => document.getElementById("kw-space").dataset.scope === "ordering",
  );
  await page.click("#kw-home");
  const other = await browser.newPage();
  await other.bringToFront();
  await page.waitForFunction(() => document.hidden);
  assert.equal(await page.$eval("#ks-world", (e) => e.getAnimations({ subtree: true }).length), 0);
  await other.close();
  await page.bringToFront();
  assert.equal(await page.$eval("#kw-space", (e) => e.dataset.scope), "contexts");
});

test("the first resize refits an existing camera even before the observer's initial notification", async () => {
  const injected = await page.evaluateOnNewDocument(() => {
    const Native = window.ResizeObserver;
    const queued = new Map();
    let released = false;
    window.__queuedKnowledgeResize = false;
    window.__releaseKnowledgeResize = () => {
      released = true;
      for (const callback of queued.values()) callback();
      queued.clear();
    };
    window.ResizeObserver = class {
      constructor(callback) {
        this.inner = new Native((entries, observer) => {
          if (!released && entries.some((entry) => entry.target.id === "ks-viewport")) {
            queued.set(this, () => callback(entries, observer));
            window.__queuedKnowledgeResize = true;
          } else callback(entries, observer);
        });
      }
      observe(...args) {
        this.inner.observe(...args);
      }
      unobserve(...args) {
        this.inner.unobserve(...args);
      }
      disconnect() {
        this.inner.disconnect();
      }
    };
  });
  try {
    await load(files.base, true);
    await page.waitForFunction(() => window.__queuedKnowledgeResize);
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById("ks-viewport").clientWidth === 390);
    await page.evaluate(() => window.__releaseKnowledgeResize());
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("[data-space-context]")].every((node) => {
          const r = node.getBoundingClientRect();
          return r.x >= 0 && r.right <= 390;
        }),
      { timeout: 3000 },
    );
    assert.equal(await page.$eval("#kw-space", (e) => e.dataset.scope), "contexts");
  } finally {
    await page.removeScriptToEvaluateOnNewDocument(injected.identifier);
  }
});

test("narrow-screen spatial BC targets stay separated and keyboard navigation still reaches details", async () => {
  await load(files.base, true);
  await page.setViewport({ width: 390, height: 844 });
  // CSS width can update before ResizeObserver refits the camera. Judge the
  // rendered targets after that refit, while retaining the geometry assertions.
  await page.waitForFunction(
    () =>
      document.getElementById("ks-viewport").clientWidth === 390 &&
      [...document.querySelectorAll("[data-space-context]")].every((node) => {
        const r = node.getBoundingClientRect();
        return r.x >= 0 && r.right <= 390;
      }),
  );
  const boxes = await page.$$eval("[data-space-context]", (nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }),
  );
  assert.ok(boxes.every((b) => b.x >= 0 && b.right <= 390));
  assert.ok(
    boxes[0].right <= boxes[1].x ||
      boxes[1].right <= boxes[0].x ||
      boxes[0].bottom <= boxes[1].y ||
      boxes[1].bottom <= boxes[0].y,
  );
  await enter();
  await page.focus('[data-space-element="ordering.confirm-order"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector("#kw-detail article");
  assert.match(await page.$eval("#kw-detail", (e) => e.textContent), /Confirm the order/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

test("spatial nodes keep literal model text, distinct BC identities and unconfirmed ownership", async () => {
  await load(files.unsafe, true);
  assert.equal((await page.$$("#ks-world img")).length, 0);
  assert.match(await page.$eval('[data-space-context="ordering"]', (e) => e.textContent), /<img/);
  await enter("__proto__");
  assert.equal(await page.$eval("#kw-bc-id", (e) => e.textContent), "__proto__");
  await page.click("#kw-home");
  await enter("constructor");
  assert.equal(await page.$eval("#kw-bc-id", (e) => e.textContent), "constructor");
  await load(files.invalid, true);
  await enter();
  assert.match(
    await page.$eval('[data-space-element="ordering.confirm-order"]', (e) => e.textContent),
    /membership unconfirmed/,
  );
});
