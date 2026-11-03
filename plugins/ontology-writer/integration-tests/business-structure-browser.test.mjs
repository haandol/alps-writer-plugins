import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { before, after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { launch, offline, writeViews, showStructure } from "./view-pages.mjs";
import { validateModel } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";

let browser, page, views;
const requests = [];
before(async () => {
  views = writeViews();
  browser = await launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await offline(page, requests);
  await page.goto(pathToFileURL(views.example).href);
  await showStructure(page);
});
after(async () => {
  await browser?.close();
  if (views) rmSync(views.dir, { recursive: true, force: true });
});

test("business structure keeps both context boundaries and their event-policy hand-offs without a duplicate map", async () => {
  const data = await page.$eval("#view-data", (e) => JSON.parse(e.textContent));
  assert.deepEqual(data.city.districts.map((d) => data.elements[d.e]?.k).sort(), [
    "ordering",
    "payment",
  ]);
  assert.deepEqual(
    data.city.links.map(([e, p]) => [data.elements[e].k, data.elements[p].k]).sort(),
    [
      ["ordering.order-placed", "payment.request-on-order"],
      ["payment.payment-completed", "ordering.confirm-on-payment"],
    ],
  );
  assert.equal(await page.$("#event-context-map"), null);
  for (const id of ["el-ordering", "el-payment"]) {
    await page.click("#city-reset");
    const point = await page.evaluate((id) => window.ontologyViewCity.locate(id), id);
    assert.ok(point, `${id} can be selected on its district`);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction((id) => document.activeElement?.id === id, {}, id);
    assert.equal(await page.evaluate(() => location.hash), `#${id}`);
  }
});

test("business structure pans by default, rotates explicitly and zooms without activating a model element", async () => {
  await page.click("#city-reset");
  await page.evaluate(() => window.ontologyViewCity.locate("el-ordering"));
  const before = await page.evaluate(() => window.ontologyViewCity.camera());
  const hash = await page.evaluate(() => location.hash);
  const box = await (await page.$("#city-canvas")).boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 24, { steps: 12 });
  await page.mouse.up();
  const panned = await page.evaluate(() => window.ontologyViewCity.camera());
  assert.ok(panned.tx !== before.tx || panned.tz !== before.tz);
  assert.equal(panned.yaw, before.yaw);
  assert.equal(panned.pitch, before.pitch);
  assert.equal(await page.evaluate(() => location.hash), hash);
  await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 32, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const turned = await page.evaluate(() => window.ontologyViewCity.camera());
  assert.notEqual(turned.yaw, panned.yaw);
  await page.mouse.wheel({ deltaY: -100 });
  await page.waitForFunction(
    (dist) => window.ontologyViewCity.camera().dist < dist,
    {},
    turned.dist,
  );
  assert.equal(await page.evaluate(() => location.hash), hash);
  assert.deepEqual(requests, []);
});

test("equal context display names retain different identities in the surviving structure view", async () => {
  const source = readFileSync(new URL("../templates/ontology/example.ttl", import.meta.url), "utf8")
    .replace('rdfs:label "Ordering"', 'rdfs:label "Shared"')
    .replace('rdfs:label "Payment"', 'rdfs:label "Shared"');
  const model = validateModel([{ doc: "same-label.ttl", text: source }]);
  assert.equal(model.ok, true);
  const file = path.join(views.dir, "same-context-label.html");
  writeFileSync(
    file,
    renderView({ index: model.index, mapping: { categories: {} }, findings: model.findings }),
  );
  const other = await browser.newPage();
  try {
    await offline(other, requests);
    await other.goto(pathToFileURL(file).href);
    await showStructure(other);
    const districts = await other.$eval("#view-data", (e) => {
      const d = JSON.parse(e.textContent);
      return d.city.districts.map((c) => ({ name: c.n, id: d.elements[c.e].k }));
    });
    assert.equal(districts.length, 2);
    assert.ok(districts.every((d) => d.name === "Shared"));
    assert.deepEqual(districts.map((d) => d.id).sort(), ["ordering", "payment"]);
    assert.deepEqual(requests, []);
  } finally {
    await other.close();
  }
});
