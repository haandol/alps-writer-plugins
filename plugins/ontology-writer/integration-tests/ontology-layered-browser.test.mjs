import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { MODEL, ONTO } from "../scripts/ontology-lib.mjs";
import { CLI } from "../tests/ontology-helpers.mjs";
import {
  ADR_BODY,
  ADR_PATH,
  BUSINESS,
  writeLayeredFixture,
} from "../tests/ontology-layered-helpers.mjs";
import { commitAll, git, initRepo, write } from "../tests/helpers.mjs";
import { launch, offline } from "./view-pages.mjs";

let dir, browser, url, largeUrl, snapshot;
const issues = [],
  requests = [];
const addedProcesses =
  `@prefix m: <${MODEL}> .\n@prefix onto: <${ONTO}> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n` +
  Array.from(
    { length: 13 },
    (
      _,
      i,
    ) => `m:studio.extra-${i} a onto:Process ; rdfs:label "Extra work ${i}" ; onto:definition "Separate business work." ; onto:startCondition "A request arrives." ; onto:businessOutcome "The request is handled." ; onto:openScope "none"^^onto:NoOpenScope ; onto:status "Proposed" ; onto:hasStep m:studio.extra-step-${i} .
m:studio.extra-step-${i} a onto:Step ; rdfs:label "Manual action ${i}" ; onto:definition "A person handles the request." ; onto:stepKind "outside-system" ; onto:inContext m:studio .
m:creator onto:performs m:studio.extra-step-${i} .
m:studio.extra-result-${i} a onto:ObservationCriterion ; rdfs:label "The request is handled ${i}" ; onto:startCondition "A request arrives." ; onto:observedResult "The request is handled." ; onto:criterionOf m:studio.extra-${i} .`,
  ).join("\n");

function view(args = []) {
  const out = execFileSync(process.execPath, [CLI, "view", "--no-open", "--lang", "ko", ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  const file = /NOT_OPENED (.+) — opening was not requested/.exec(out)?.[1];
  assert.ok(file, out);
  return pathToFileURL(file).href;
}

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ontology-layered-browser-"));
  assert.deepEqual(writeLayeredFixture(dir).findings, []);
  initRepo(dir);
  commitAll(dir);
  url = view(["--board", "board.json"]);
  write(dir, "large-draft/business.ttl", BUSINESS);
  write(dir, "large-draft/extra.ttl", addedProcesses);
  largeUrl = view(["--draft", "large-draft", "--board", "board.json"]);
  snapshot = git(dir, ["status", "--porcelain"]);
  browser = await launch();
});
after(async () => {
  try {
    if (browser) await browser.close();
    if (dir) {
      assert.equal(
        git(dir, ["status", "--porcelain"]),
        snapshot,
        "using the UI changes no model, ADR or index",
      );
      assert.equal(readFileSync(path.join(dir, ADR_PATH), "utf8"), ADR_BODY);
    }
    assert.deepEqual(requests, [], "the normal CLI UI requires no network request");
    assert.deepEqual(issues, [], "browser scripts have no uncaught error");
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

async function withPage(run, { at = url, width = 1440, reduced = false } = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => issues.push(error.message));
  await offline(page, requests);
  await page.setViewport({ width, height: 1040 });
  if (reduced)
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluateOnNewDocument(() => {
    window.storageWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      window.storageWrites.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto(at, { waitUntil: "load" });
  await page.waitForFunction(() => window.ontologyLayered);
  try {
    await run(page);
    assert.deepEqual(await page.evaluate(() => window.storageWrites), []);
  } finally {
    await page.close();
  }
}
const state = (page) => page.evaluate(() => window.ontologyLayered.state());
const visible = (page) => page.evaluate(() => window.ontologyLayered.visible());
async function pick(page, id, { keyboard = false } = {}) {
  const selector = `[data-layer-node=${JSON.stringify(id)}]`;
  await page.focus(selector);
  if (keyboard) await page.keyboard.press("Enter");
  else await page.click(selector);
}
async function changeView(page, mode) {
  await page.click(`button[data-view="${mode}"]`);
}

test("the normal CLI starts with only BC nodes, then opens actual processes and their ADRs in both representations", async () =>
  withPage(async (page) => {
    assert.deepEqual((await visible(page)).sort(), ["billing", "studio"]);
    assert.equal(
      await page.$$eval("iframe,[data-kind=Process],[data-kind=ADR]", (nodes) => nodes.length),
      0,
    );
    const homeRelations = await page.evaluate(() => window.ontologyLayered.relations());
    await changeView(page, "structure");
    assert.deepEqual((await visible(page)).sort(), ["billing", "studio"]);
    assert.deepEqual(await page.evaluate(() => window.ontologyLayered.relations()), homeRelations);
    await pick(page, "studio");
    assert.equal((await state(page)).level, "containers");
    assert.deepEqual((await visible(page)).sort(), ["studio.animation", "studio.image"]);
    assert.equal(await page.$$eval("[data-kind=ADR]", (nodes) => nodes.length), 0);
    const before = await state(page);
    const processRelations = await page.evaluate(() => window.ontologyLayered.relations());
    assert.match(
      await page.$eval('[data-layer-node="studio.image"] .node-type', (node) => node.textContent),
      /공유.*Proposed/,
    );
    await changeView(page, "events");
    assert.equal((await state(page)).context, before.context);
    assert.deepEqual((await visible(page)).sort(), ["studio.animation", "studio.image"]);
    assert.deepEqual(
      await page.evaluate(() => window.ontologyLayered.relations()),
      processRelations,
    );
    await pick(page, "studio.image");
    assert.equal((await state(page)).level, "adrs");
    assert.ok((await visible(page)).includes(ADR_PATH));
    assert.match(
      await page.$eval("#scope-summary", (node) => node.textContent),
      /A creator requests an image.*A reusable image is available/s,
    );
    assert.match(await page.$eval("#scope-summary", (node) => node.textContent), /기능 범주 수준/);
    await pick(page, ADR_PATH);
    assert.equal((await state(page)).adr, ADR_PATH);
    assert.match(
      await page.$eval("#detail-body", (node) => node.textContent),
      /charge at most once|Charge at most once/,
    );
    assert.equal(await page.evaluate(() => window.__ontologyUntrustedAdrExecuted), undefined);
    assert.equal(await page.$$eval(".adr-document a[href]", (links) => links.length), 0);
    const adrNodes = await visible(page);
    await changeView(page, "structure");
    assert.deepEqual(await visible(page), adrNodes);
    assert.equal((await state(page)).adr, ADR_PATH);
    assert.equal((await state(page)).level, "adrs");
    assert.equal(await page.$$eval(".path-step", (nodes) => nodes.length), 3);
  }));

test("every visible model element is searchable by identifier and name, with guidance distinguishing the next actions", async () =>
  withPage(async (page) => {
    await page.select("#search-scope", "knowledge");
    const entries = await page.evaluate(() =>
      Object.values(JSON.parse(document.getElementById("layered-data").textContent).elements).map(
        (element) => ({ id: element.k, name: element.n }),
      ),
    );
    for (const entry of entries)
      for (const query of [entry.id, entry.name]) {
        await page.$eval(
          "#layer-search",
          (input, value) => {
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          },
          query,
        );
        assert.ok((await visible(page)).includes(entry.id), query);
      }
    await page.click("#help-toggle");
    const guide = await page.$eval("#help-panel", (node) => node.textContent);
    for (const command of [
      "/ontology-build",
      "/ontology-edit",
      "/ontology-sync",
      "/ontology-align",
    ])
      assert.ok(guide.includes(command), command);
    assert.match(guide, /업무 완전성|모델 충분성/);
  }));

test("keyboard controls rotate the 3D scope without changing its business selection", async () =>
  withPage(async (page) => {
    await changeView(page, "structure");
    await page.click('[data-camera="rotate"]');
    await page.focus("#layer-viewport");
    const before = await state(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const after = await state(page);
    assert.notEqual(after.camera.yaw, before.camera.yaw);
    assert.notEqual(after.camera.pitch, before.camera.pitch);
    assert.equal(after.context, before.context);
    assert.equal(after.selected, null);
  }));

test("shared processes and ADRs keep identity when reached through another BC", async () =>
  withPage(async (page) => {
    await pick(page, "studio");
    await pick(page, "studio.image");
    const first = await visible(page);
    await page.click('[data-action="home"]');
    await pick(page, "billing");
    await pick(page, "studio.image");
    assert.deepEqual(await visible(page), first);
    await page.click("#scope-summary details > summary");
    const external = await page.$$eval(".workflow-steps > li.external", (nodes) =>
      nodes.map((node) => node.dataset.businessStep),
    );
    assert.deepEqual(external, ["studio.request"]);
  }));

test("multiword and short Korean searches, finite pages, camera and selection survive mode changes and upward/back navigation", async () =>
  withPage(async (page) => {
    await pick(page, "studio");
    await page.type("#layer-search", "이미지");
    assert.deepEqual(await visible(page), ["studio.image"]);
    await page.click('[data-camera="in"]');
    const prior = await state(page);
    await changeView(page, "structure");
    assert.equal((await state(page)).query, "이미지");
    assert.deepEqual((await state(page)).camera, prior.camera);
    await pick(page, "studio.image", { keyboard: true });
    await page.click("#go-up");
    assert.equal((await state(page)).query, "이미지");
    assert.equal((await state(page)).selected, "studio.image");
    assert.deepEqual((await state(page)).camera, prior.camera);
    await pick(page, "studio.image");
    await page.goBack();
    assert.equal((await state(page)).query, "이미지");
    assert.equal((await state(page)).level, "containers");
    await page.$eval("#layer-search", (input) => {
      input.value = "request creator";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.ok((await visible(page)).includes("studio.image"));
    await page.$eval("#layer-search", (input) => {
      input.value = '"unclosed';
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.deepEqual(await visible(page), []);
    assert.match(await page.$eval("#results-status", (node) => node.textContent), /따옴표/);
  }));

test("all pages remain reachable in a large BC and the current page is shared by both representations", async () =>
  withPage(
    async (page) => {
      await pick(page, "studio");
      const first = await visible(page);
      assert.equal(first.length, 9);
      await page.click("#page-next");
      const last = await visible(page);
      assert.equal(last.length, 6);
      assert.equal(new Set([...first, ...last]).size, 15);
      await changeView(page, "structure");
      assert.deepEqual(await visible(page), last);
      await pick(page, last[0], { keyboard: true });
      await page.click("#go-up");
      assert.equal((await state(page)).page, 1);
      assert.deepEqual(await visible(page), last);
    },
    { at: largeUrl },
  ));

test("business detail search opens its process scope, preserves inbound/outbound facts and follows relations by keyboard", async () =>
  withPage(async (page) => {
    await page.select("#search-scope", "knowledge");
    await page.type("#layer-search", "billing.paid");
    await page.keyboard.press("Enter");
    assert.equal((await state(page)).detail, "billing.paid");
    assert.ok((await state(page)).container);
    assert.match(await page.$eval("#detail-body", (node) => node.textContent), /Payment received/);
    const link = '#detail-body a[href="#el-billing_2e_deliver-policy"]';
    await page.focus(link);
    await page.keyboard.press("Enter");
    assert.equal((await state(page)).detail, "billing.deliver-policy");
    assert.match(
      await page.$eval("#detail-body", (node) => node.textContent),
      /The payment matches this creator and has not been delivered/,
    );
  }));

test("a selected process opens a scoped event board with causal cycles, conditions and direct external hand-offs", async () =>
  withPage(async (page) => {
    await pick(page, "studio");
    await pick(page, "studio.image");
    await page.click('[data-action="workflow"]');
    const frameElement = await page.waitForSelector("#workflow-frame-host iframe");
    const frame = await frameElement.contentFrame();
    await frame.waitForSelector(".story-node");
    const stages = await frame.$$eval(".story-node", (nodes) =>
      nodes.map((node) => node.dataset.storyNode),
    );
    assert.equal(stages.length, 3);
    assert.equal(await frame.$$eval(".story-node.external-stage", (nodes) => nodes.length), 1);
    assert.match(
      await frame.$eval(".event-timeline", (node) => node.textContent),
      /The payment matches this creator and has not been delivered/,
    );
    await frame.waitForSelector(".story-connections path[data-from]");
    await frame.waitForFunction(
      () => document.querySelector(".event-timeline").timeline.flow().frames > 1,
    );
    assert.ok(
      (await frame.$$eval(".story-connections path[data-from]", (nodes) => nodes.length)) > 0,
    );
    await frame.click(".event-flow-toggle");
    assert.equal(
      await frame.evaluate(() => document.querySelector(".event-timeline").timeline.flow().running),
      false,
    );
    assert.match(
      await frame.$eval(".event-flow-status", (node) => node.textContent),
      /멈췄습니다|재생 중|화면 밖/,
    );
    const before = await state(page);
    await changeView(page, "structure");
    assert.equal((await state(page)).container, before.container);
    assert.equal(await page.$$eval("#workflow-frame-host iframe", (nodes) => nodes.length), 1);
    await frame.evaluate(() =>
      document.querySelector('a[data-model-target="billing.reserve"]').click(),
    );
    await page.waitForFunction(() => window.ontologyLayered.state().detail === "billing.reserve");
    assert.match(await page.$eval("#detail-body", (node) => node.textContent), /Reserve credit/);
  }));

test("dragging pans without selecting a node; zoom and 3D rotation leave the business scope unchanged", async () =>
  withPage(async (page) => {
    const node = await page.$('[data-layer-node="studio"]');
    const rect = await node.boundingBox();
    const before = await state(page);
    await page.mouse.move(rect.x + 60, rect.y + 60);
    await page.mouse.down();
    await page.mouse.move(rect.x + 140, rect.y + 110, { steps: 6 });
    await page.mouse.up();
    const moved = await state(page);
    assert.equal(moved.level, "contexts");
    assert.equal(moved.selected, null);
    assert.notEqual(moved.camera.x, before.camera.x);
    await page.click('[data-camera="in"]');
    assert.ok((await state(page)).camera.zoom > moved.camera.zoom);
    await changeView(page, "structure");
    await page.click('[data-camera="rotate"]');
    const area = await page.$eval("#layer-viewport", (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x + 20, y: r.y + 40 };
    });
    await page.mouse.move(area.x, area.y);
    await page.mouse.down();
    await page.mouse.move(area.x + 90, area.y + 30, { steps: 5 });
    await page.mouse.up();
    assert.notEqual((await state(page)).camera.yaw, before.camera.yaw);
    assert.equal((await state(page)).level, "contexts");
  }));

test("fast navigation, reduced motion and effects-off reach the final requested layer without delayed state changes", async () =>
  withPage(
    async (page) => {
      await changeView(page, "structure");
      await page.evaluate(() => {
        document.querySelector('[data-layer-node="studio"]').click();
        document.querySelector("#go-up").click();
        document.querySelector('[data-layer-node="billing"]').click();
      });
      assert.equal((await state(page)).context, "billing");
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await page.click("#go-up");
      assert.equal((await state(page)).level, "contexts");
    },
    { reduced: true },
  ));

test("active layer transitions are cancelled when hidden and consecutive clicks keep only the latest scope", async () =>
  withPage(async (page) => {
    await changeView(page, "structure");
    await page.evaluate(() => {
      document.querySelector('[data-layer-node="studio"]').click();
      document.querySelector("#go-up").click();
      document.querySelector('[data-layer-node="billing"]').click();
    });
    assert.equal((await state(page)).context, "billing");
    const other = await browser.newPage();
    try {
      await other.bringToFront();
      await page.waitForFunction(() => document.hidden);
      assert.equal(
        await page.evaluate(() => document.getElementById("layer-nodes").getAnimations().length),
        0,
      );
    } finally {
      await other.close();
      await page.bringToFront();
    }
    assert.equal((await state(page)).context, "billing");
    await page.click("#motion-toggle");
    await page.click("#go-up");
    await pick(page, "studio");
    assert.equal(
      await page.evaluate(() => document.getElementById("layer-nodes").getAnimations().length),
      0,
    );
  }));

test("the scoped event board pauses when hidden and a sequence-only process has no communication effect", async () =>
  withPage(async (page) => {
    await pick(page, "studio");
    await pick(page, "studio.image");
    await page.click('[data-action="workflow"]');
    let frame = await (await page.waitForSelector("#workflow-frame-host iframe")).contentFrame();
    await frame.waitForFunction(() => document.querySelector(".event-timeline")?.timeline);
    const other = await browser.newPage();
    try {
      await other.bringToFront();
      await page.waitForFunction(() => document.hidden);
      assert.equal(
        await frame.evaluate(
          () => document.querySelector(".event-timeline").timeline.flow().running,
        ),
        false,
      );
    } finally {
      await other.close();
      await page.bringToFront();
    }
    await page.click("#go-up");
    await pick(page, "studio.animation");
    await page.click('[data-action="workflow"]');
    frame = await (await page.waitForSelector("#workflow-frame-host iframe")).contentFrame();
    await frame.waitForFunction(() => document.querySelector(".event-timeline")?.timeline);
    assert.equal(
      await frame.evaluate(() => document.querySelector(".event-timeline").timeline.flow().reason),
      "empty",
    );
    assert.equal(await frame.$$eval(".story-signal", (nodes) => nodes.length), 0);
    assert.equal(await frame.$$eval(".story-fact-missing", (nodes) => nodes.length), 2);
  }));

test("requested process diagrams draw offline and their nodes open the original model detail", async () =>
  withPage(async (page) => {
    await pick(page, "studio");
    await pick(page, "studio.image");
    await page.click('[data-action="element"][data-id="studio.image"]');
    await page.click("#detail-body figure > button");
    await page.waitForSelector(
      '#detail-body figure[data-render-state="rendered"] g.node[role="link"]',
    );
    const names = await page.$$eval('#detail-body figure g.node[role="link"]', (nodes) =>
      nodes.map((node) => node.textContent),
    );
    assert.ok(names.some((name) => name.includes("Creator")));
    const node = (await page.$$('#detail-body figure g.node[role="link"]'))[0];
    await node.evaluate((element) => element.focus());
    await page.keyboard.press("Enter");
    assert.notEqual((await state(page)).detail, "studio.image");
  }));

test("a narrow screen and keyboard reach all three layers and the same readable ADR without document overflow", async () =>
  withPage(
    async (page) => {
      await pick(page, "studio", { keyboard: true });
      await pick(page, "studio.animation", { keyboard: true });
      await pick(page, ADR_PATH, { keyboard: true });
      assert.equal((await state(page)).adr, ADR_PATH);
      assert.match(await page.$eval(".adr-document", (node) => node.textContent), /at most once/);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await changeView(page, "structure");
      assert.equal((await state(page)).adr, ADR_PATH);
      await page.click("#detail-body > details > summary");
      await page.click('#detail-body [data-action="element"][data-id="studio.animate"]');
      assert.equal((await state(page)).detail, "studio.animate");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
    },
    { width: 390 },
  ));

test("legacy whole and direct BC/process/ADR addresses use the common hierarchy and reopening resets local search", async () => {
  await withPage(
    async (page) => {
      assert.equal((await state(page)).level, "contexts");
      await page.type("#layer-search", "studio");
      await page.reload({ waitUntil: "load" });
      assert.equal((await state(page)).query, "");
    },
    { at: url + "#all" },
  );
  await withPage(
    async (page) => {
      assert.equal((await state(page)).level, "adrs");
      assert.equal((await state(page)).adr, ADR_PATH);
    },
    {
      at: url + "#" + new URLSearchParams({ bc: "studio", process: "studio.image", adr: ADR_PATH }),
    },
  );
  await withPage(
    async (page) => {
      assert.equal((await state(page)).level, "contexts");
      assert.equal((await state(page)).detail, null);
    },
    { at: url + "#bc=unknown&adr=constructor&element=__proto__" },
  );
});
