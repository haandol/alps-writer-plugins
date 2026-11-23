import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { DocumentService } from "../src/tools/documents/service.js";
import { saveCompleteLite } from "./lite-fixtures.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lite-derivation-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A completed Lite document in `dir/lite/`, so the Full source path is relative and nested. */
function completedLite(dir: string): string {
  const litePath = path.join(dir, "lite", "cart.lite.alps.xml");
  const lite = new DocumentService();
  lite.initDocument("cart", litePath, "lite");
  saveCompleteLite(lite);
  return litePath;
}

const ALL_IDS = "BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1";

test("Full init records a completed Lite source relative to the Full document without changing Lite", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const liteBefore = fs.readFileSync(litePath, "utf8");
  const fullPath = path.join(dir, "full", "cart.alps.xml");

  const service = new DocumentService();
  assert.match(
    service.initDocument("cart", fullPath, "alps", litePath),
    /Created ALPS document .*\nLite source: \.\.\/lite\/cart\.lite\.alps\.xml/,
  );
  const raw = fs.readFileSync(fullPath, "utf8");
  assert.match(raw, /source="\.\.\/lite\/cart\.lite\.alps\.xml"/);
  assert.match(raw, /source-fingerprint="[0-9a-f]{64}"/);
  assert.equal(fs.readFileSync(litePath, "utf8"), liteBefore);

  const resumed = new DocumentService();
  assert.match(resumed.loadDocument(fullPath), /Lite source: \.\.\/lite\/cart\.lite\.alps\.xml/);
});

test("Full init rejects missing, non-Lite, incomplete and other-format sources without creating a file", () => {
  const dir = temporaryDirectory();
  const fullPath = path.join(dir, "cart.alps.xml");
  const service = new DocumentService();

  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", path.join(dir, "missing.lite.alps.xml")),
    /Lite source not readable/,
  );
  const otherFull = path.join(dir, "other.alps.xml");
  new DocumentService().initDocument("other", otherFull);
  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", otherFull),
    /must be a \.lite\.alps\.xml document/,
  );

  const incomplete = path.join(dir, "incomplete.lite.alps.xml");
  const lite = new DocumentService();
  lite.initDocument("incomplete", incomplete, "lite");
  lite.saveSection(1, "1", "Target User and Core Problem", "Guests");
  const incompleteBefore = fs.readFileSync(incomplete, "utf8");
  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", incomplete),
    /is not complete: required Sections not written: 1, 2, 3, 4, 5, 6, 8/,
  );
  assert.equal(fs.readFileSync(incomplete, "utf8"), incompleteBefore);

  const formerFormat = path.join(dir, "former.lite.alps.xml");
  fs.writeFileSync(
    formerFormat,
    '<alps-document project="former" profile="lite"><section id="1" title="Overview"><!-- Not started --></section></alps-document>',
  );
  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", formerFormat),
    /Invalid Lite source .*must contain Sections 1-8/,
  );

  assert.equal(fs.existsSync(fullPath), false);
});

test("a dangling Lite reference makes the Lite incomplete and unusable as a source", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const lite = new DocumentService().forDocument(litePath);
  lite.saveSection(
    8,
    "1",
    "Demo Scenario",
    "| Step | User action | Visible expected result | Shows |\n|----|----|----|----|\n| 1 | Signs in | 3 shirts | FR-1, FR-2 |",
  );
  assert.match(lite.getStatus(), /Undefined requirement references: FR-2/);
  assert.throws(
    () =>
      new DocumentService().initDocument("cart", path.join(dir, "c.alps.xml"), "alps", litePath),
    /undefined requirement references: FR-2/,
  );
});

test("Lite initialization rejects a source without creating a file", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const target = path.join(dir, "second.lite.alps.xml");
  assert.throws(
    () => new DocumentService().initDocument("second", target, "lite", litePath),
    /applies only to Full ALPS initialization/,
  );
  assert.equal(fs.existsSync(target), false);
});

test("status reports unreferenced and undefined Lite IDs and completes only when coverage holds", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const fullPath = path.join(dir, "cart.alps.xml");
  const service = new DocumentService();
  service.initDocument("cart", fullPath, "alps", litePath);

  let status = service.getStatus();
  assert.match(status, /Lite coverage: 🟡 0\/6 requirement IDs referenced — missing: BR-1, FR-1/);
  assert.match(status, /Completion: 🟡 Incomplete — .*Lite requirement IDs not referenced/);

  service.saveSection(1, "1", "Purpose", "Source requirements: BR-1, FR-1, FR-9");
  status = service.getStatus();
  assert.match(
    status,
    /Lite coverage: 🟡 2\/6 requirement IDs referenced — missing: NFR-1, EC-1, KPI-1, TM-1/,
  );
  assert.match(status, /References to IDs not defined in the Lite source: FR-9/);

  service.saveSection(1, "1", "Purpose", `Source requirements: ${ALL_IDS}`);
  status = service.getStatus();
  assert.match(status, /Lite coverage: ✅ 6\/6 requirement IDs referenced/);
  assert.doesNotMatch(status, /References to IDs not defined/);
  assert.match(
    status,
    /Completion: 🟡 Incomplete — Sections not written: 1, 2, 3, 4, 5, 6, 7, 8, 9$/m,
  );
  assert.doesNotMatch(status, /Lite requirement IDs not referenced/);

  // A Lite ID added later becomes missing at the next status, without re-derivation.
  const lite = new DocumentService().forDocument(litePath);
  lite.saveSection(
    5,
    "1",
    "Edge Cases",
    "| ID | Situation | Related | Expected business outcome | Required |\n|----|----|----|----|----|\n| EC-1 | Retried | FR-1, BR-1 | Summed once | Required |\n| EC-2 | Simultaneous | FR-1 | Nothing lost | Required |",
  );
  assert.match(service.getStatus(), /missing: EC-2/);
});

test("Full saves keep the source and refresh its fingerprint; a later Lite change is reported without blocking", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const fullPath = path.join(dir, "cart.alps.xml");
  const service = new DocumentService();
  service.initDocument("cart", fullPath, "alps", litePath);
  service.saveSection(1, "1", "Purpose", `Source requirements: ${ALL_IDS}`);
  assert.match(fs.readFileSync(fullPath, "utf8"), /source="lite\/cart\.lite\.alps\.xml"/);
  assert.doesNotMatch(service.getStatus(), /Lite source changed/);

  const lite = new DocumentService().forDocument(litePath);
  const liteBefore = fs.readFileSync(litePath, "utf8");
  lite.saveSection(1, "1", "Target User and Core Problem", "Guest shoppers lose carts.");
  assert.notEqual(fs.readFileSync(litePath, "utf8"), liteBefore);

  const status = service.getStatus();
  assert.match(status, /Lite source changed since the last Full save/);
  assert.doesNotMatch(status, /Completion: .*Lite source changed/);

  service.saveSection(1, "2", "Document Name", "Cart");
  assert.doesNotMatch(service.getStatus(), /Lite source changed/);
  assert.match(fs.readFileSync(fullPath, "utf8"), /source="lite\/cart\.lite\.alps\.xml"/);
});

test("an unavailable source leaves coverage unverified while resume, save and export still work", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const fullPath = path.join(dir, "cart.alps.xml");
  const service = new DocumentService();
  service.initDocument("cart", fullPath, "alps", litePath);
  const fingerprint = fs
    .readFileSync(fullPath, "utf8")
    .match(/source-fingerprint="([0-9a-f]+)"/)![1];

  const moved = `${litePath}.moved`;
  fs.renameSync(litePath, moved);
  const status = new DocumentService().loadDocument(fullPath);
  assert.match(status, /Lite source unavailable: not readable/);
  assert.match(status, /Lite coverage is unverified/);
  assert.match(status, /Completion: 🟡 Incomplete — .*Lite source unavailable/);

  assert.match(service.saveSection(1, "1", "Purpose", "Still editable"), /Saved 1\.1/);
  assert.match(
    fs.readFileSync(fullPath, "utf8"),
    new RegExp(`source-fingerprint="${fingerprint}"`),
  );
  assert.match(service.exportMarkdown(), /^> Lite source: lite\/cart\.lite\.alps\.xml$/m);

  fs.renameSync(moved, litePath);
  assert.doesNotMatch(service.getStatus(), /Lite source unavailable/);
});

test("Full documents without a source report no Lite results and export no source line", () => {
  const dir = temporaryDirectory();
  const fullPath = path.join(dir, "plain.alps.xml");
  const service = new DocumentService();
  service.initDocument("plain", fullPath);
  service.saveSection(1, "1", "Purpose", "Mentions FR-1 in prose");
  const status = service.getStatus();
  assert.doesNotMatch(status, /Lite|Completion:/);
  assert.doesNotMatch(fs.readFileSync(fullPath, "utf8"), /source=/);
  assert.doesNotMatch(service.exportMarkdown(), /Lite source/);
});
