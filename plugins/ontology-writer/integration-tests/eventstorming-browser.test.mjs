import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { BOARD } from "../tests/eventstorming-fixture.mjs";
import { eventBoardPage } from "../scripts/eventstorming-board.mjs";
import { launch, offline } from "./view-pages.mjs";
let browser, page, dir;
const requests = [];
before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "eventstorming-browser-"));
  const file = path.join(dir, "board.html");
  writeFileSync(file, eventBoardPage(BOARD, { lang: "ko" }));
  browser = await launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await offline(page, requests);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.waitForSelector(".event-connections path");
});
after(async () => {
  await browser?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test("the EventStorming board renders entity transitions and only the declared causal links offline", async () => {
  assert.deepEqual(requests, []);
  assert.equal(await page.$$eval(".event-connections path", (p) => p.length), BOARD.links.length);
  const text = await page.$eval(".event-workbench", (e) => e.innerText);
  for (const s of [
    "Not created",
    "Waiting for payment",
    "Payment completed",
    "Confirm after payment",
    "Rejected",
  ])
    assert.ok(text.includes(s), s);
  assert.equal(await page.$$eval("svg[data-mermaid],figure[data-mermaid]", (p) => p.length), 0);
  const before = await page.$eval(".event-board", (b) => b.scrollWidth);
  await page.setViewport({ width: 1300, height: 900 });
  await page.waitForFunction(() =>
    document.querySelector(".event-connections path")?.getAttribute("d"),
  );
  assert.ok(
    (await page.$eval(".event-board", (b) => b.scrollWidth)) <= before + 100,
    "connectors do not grow the canvas repeatedly",
  );
});

test("a causal link leads to the next business action by keyboard, with visible source evidence", async () => {
  const selector = 'a.event-next[data-from="pay"][data-to="confirm"]';
  await page.$eval(selector, (e) => e.scrollIntoView());
  await page.focus(selector);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.dataset.stage === "confirm");
  assert.equal(
    await page.$eval(".event-stage:target .command strong", (e) => e.textContent),
    "Confirm order",
  );
  const source = ".event-stage:target .event-evidence summary";
  await page.click(source);
  assert.ok(
    (await page.$eval(".event-stage:target", (e) => e.innerText)).includes(
      "Authored workflow example",
    ),
  );
});

test("the board can expand, close with Escape, and keep horizontal scrolling inside a small viewport", async () => {
  await page.click(".event-expand");
  assert.equal(await page.$eval(".event-expand", (e) => e.getAttribute("aria-pressed")), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval(".event-expand", (e) => e.getAttribute("aria-pressed")), "false");
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.ok(await page.$eval(".event-board", (e) => e.scrollWidth > e.clientWidth));
});
