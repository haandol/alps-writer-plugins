import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { DocumentService } from "../src/tools/documents/service.js";
import { COMPLETE_LITE_SUBSECTIONS, saveCompleteFull, saveCompleteLite } from "./lite-fixtures.js";

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

/** A completed Lite document in `dir/<folder>/`, so the Full source path is relative and nested. */
function completedLite(dir: string, folder = "lite"): string {
  const litePath = path.join(dir, folder, "cart.lite.alps.xml");
  const lite = new DocumentService();
  lite.initDocument("cart", litePath, "lite");
  saveCompleteLite(lite);
  return litePath;
}

const ALL_IDS = "BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1";

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LITE_DEMO = COMPLETE_LITE_SUBSECTIONS.find(([section]) => section === 8)![3];

/** A derived Full document with every Section written and every Lite ID referenced. */
function completedDerivedFull(dir: string): {
  litePath: string;
  fullPath: string;
  service: DocumentService;
} {
  const litePath = completedLite(dir);
  const fullPath = path.join(dir, "cart.alps.xml");
  const service = new DocumentService();
  service.initDocument("cart", fullPath, "alps", litePath);
  saveCompleteFull(service, `Source requirements: ${ALL_IDS}`);
  return { litePath, fullPath, service };
}

const recordedFingerprint = (fullPath: string): string =>
  fs.readFileSync(fullPath, "utf8").match(/source-fingerprint="([0-9a-f]+)"/)![1];

test("Full init records a completed Lite source relative to the Full document without changing Lite", () => {
  const dir = temporaryDirectory();
  const litePath = completedLite(dir);
  const liteBefore = fs.readFileSync(litePath, "utf8");
  const fullPath = path.join(dir, "full", "cart.alps.xml");

  const service = new DocumentService();
  assert.match(
    service.initDocument("cart", fullPath, "alps", litePath),
    new RegExp(
      `Created ALPS document .*\\nLite source: \\.\\./lite/cart\\.lite\\.alps\\.xml\\nLite source path: ${escapeRegExp(litePath)}$`,
    ),
  );
  const raw = fs.readFileSync(fullPath, "utf8");
  assert.match(raw, /source="\.\.\/lite\/cart\.lite\.alps\.xml"/);
  assert.match(raw, /source-fingerprint="[0-9a-f]{64}"/);
  assert.equal(fs.readFileSync(litePath, "utf8"), liteBefore);

  const resumed = new DocumentService();
  const status = resumed.loadDocument(fullPath);
  assert.match(status, /Lite source: \.\.\/lite\/cart\.lite\.alps\.xml/);
  // The reported path reads the Lite directly, wherever the server's output directory is.
  const reported = status.match(/^Lite source path: (.+)$/m)![1];
  assert.equal(reported, litePath);
  assert.match(new DocumentService().forDocument(reported).readSection(2, "1"), /BR-1/);
});

test("Full init rejects missing, non-Lite, incomplete and other-format sources without creating a file", () => {
  const dir = temporaryDirectory();
  const fullPath = path.join(dir, "cart.alps.xml");
  const service = new DocumentService();

  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", path.join(dir, "missing.lite.alps.xml")),
    /Lite source not readable at .*: .*\. Check the path, write the Lite first with alps_document\(action: 'init', profile: 'lite', project_name, output_path\), or call .*without source_doc_path to continue without a Lite source\./,
  );
  const otherFull = path.join(dir, "other.alps.xml");
  new DocumentService().initDocument("other", otherFull);
  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", otherFull),
    /must be a \.lite\.alps\.xml document\. Name a completed Lite ALPS document, or call .*without source_doc_path/,
  );

  const incomplete = path.join(dir, "incomplete.lite.alps.xml");
  const lite = new DocumentService();
  lite.initDocument("incomplete", incomplete, "lite");
  lite.saveSection(1, "1", "Target User and Core Problem", "Guests");
  const incompleteBefore = fs.readFileSync(incomplete, "utf8");
  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", incomplete),
    /is not complete: Sections not complete: 1, 2, 3, 4, 5, 6, 8\. Complete it first: load it with alps_document\(action: 'load', doc_path: '.*incomplete\.lite\.alps\.xml'\), then complete the remaining Sections in section order, starting with Section 1 \(Business Context\)\. Retry this initialization afterwards, or call alps_document\(action: 'init', profile: 'full', project_name, output_path\) without source_doc_path/,
  );
  assert.equal(fs.readFileSync(incomplete, "utf8"), incompleteBefore);

  const formerFormat = path.join(dir, "former.lite.alps.xml");
  fs.writeFileSync(
    formerFormat,
    '<alps-document project="former" profile="lite"><section id="1" title="Overview"><!-- Not started --></section></alps-document>',
  );
  assert.throws(
    () => service.initDocument("cart", fullPath, "alps", formerFormat),
    /Invalid Lite source .*must contain Sections 1-8 exactly once and in order\. Name a current-format Lite ALPS document, or call .*without source_doc_path/,
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
    /applies only to Full ALPS initialization; Lite ALPS documents have no source\. Call alps_document\(action: 'init', profile: 'lite', project_name, output_path\) without source_doc_path to create the Lite, or use profile 'full' with this source_doc_path to derive a Full document from a completed Lite\./,
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
  assert.match(
    status,
    /^Next steps:\n- Complete the remaining Sections in section order, starting with Section 1 \(Overview\)\.\n- Convert BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1 in the Full Section its guide names and list each ID in that content's `Source requirements:`; only an optional FR, NFR or EC may instead be deferred to Section 9 with its ID and reason\.$/m,
  );

  service.saveSection(1, "1", "Purpose", "Source requirements: BR-1, FR-1, FR-9");
  status = service.getStatus();
  assert.match(
    status,
    /Lite coverage: 🟡 2\/6 requirement IDs referenced — missing: NFR-1, EC-1, KPI-1, TM-1/,
  );
  assert.match(status, /References to IDs not defined in the Lite source: FR-9/);
  assert.match(
    status,
    /^- Ask whether to remove or correct the Full content that references FR-9, or to propose a Lite change that defines them, saved through Lite Section approval\.$/m,
  );

  service.saveSection(1, "1", "Purpose", `Source requirements: ${ALL_IDS}`);
  status = service.getStatus();
  assert.match(status, /Lite coverage: ✅ 6\/6 requirement IDs referenced/);
  assert.doesNotMatch(status, /References to IDs not defined/);
  assert.match(
    status,
    /Completion: 🟡 Incomplete — Sections not complete: 1, 2, 3, 4, 5, 6, 7, 8, 9$/m,
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
  assert.match(
    status,
    new RegExp(
      `^- Restore the completed Lite ALPS document at ${escapeRegExp(litePath)}, the source path recorded relative to this Full document\\. Then check this document's status again; resume, saves and export keep working meanwhile\\.$`,
      "m",
    ),
  );

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

test("a derived Full completes when coverage holds, and a dangling reference alone blocks it", () => {
  const { service } = completedDerivedFull(temporaryDirectory());
  let status = service.getStatus();
  assert.match(status, /Lite coverage: ✅ 6\/6 requirement IDs referenced/);
  assert.match(status, /^Completion: ✅ Complete$/m);
  assert.doesNotMatch(status, /Next steps:/);

  service.saveSection(1, "1", "Purpose", `Source requirements: ${ALL_IDS}, FR-9`);
  status = service.getStatus();
  assert.match(status, /Lite coverage: ✅ 6\/6 requirement IDs referenced/);
  assert.match(
    status,
    /^Completion: 🟡 Incomplete — references to IDs not defined in the Lite source$/m,
  );
  assert.match(
    status,
    /^- Ask whether to remove or correct the Full content that references FR-9/m,
  );
});

test("a source Lite that becomes incomplete is reported unusable with its next actions until it is completed", () => {
  const dir = temporaryDirectory();
  const { litePath, fullPath, service } = completedDerivedFull(dir);
  const fingerprint = recordedFingerprint(fullPath);

  const lite = new DocumentService().forDocument(litePath);
  lite.saveSection(
    8,
    "1",
    "Demo Scenario",
    "| Step | User action | Visible expected result | Shows |\n|----|----|----|----|\n| 1 | Signs in | 3 shirts | FR-1, FR-2, EC-1 |",
  );
  const status = service.getStatus();
  assert.match(
    status,
    /^Lite source incomplete: undefined requirement references: FR-2\. Lite coverage is unverified\.$/m,
  );
  assert.doesNotMatch(status, /Lite coverage: /);
  assert.match(status, /^Completion: 🟡 Incomplete — Lite source incomplete$/m);
  assert.match(
    status,
    new RegExp(
      `^- Complete the Lite source through Lite Section approval: load it with alps_document\\(action: 'load', doc_path: '${escapeRegExp(litePath)}'\\), then define each referenced ID in its owning subsection \\(FR-2 in 3\\.1\\), or correct or remove the reference\\. Then check this document's status again; resume, saves and export keep working meanwhile\\.$`,
      "m",
    ),
  );

  // The Full document stays editable, and an unusable source keeps the recorded fingerprint.
  assert.match(service.saveSection(1, "2", "Document Name", "Cart"), /Saved 1\.2/);
  assert.match(service.saveGlossaryEntry("SLA", "Service level agreement"), /Saved glossary/);
  assert.equal(recordedFingerprint(fullPath), fingerprint);

  lite.saveSection(8, "1", "Demo Scenario", LITE_DEMO.replace("3 shirts |", "Sees 3 shirts |"));
  const restored = service.getStatus();
  assert.match(restored, /^Completion: ✅ Complete$/m);
  assert.match(restored, /Lite source changed since the last Full save/);
});

test("a source that is no longer Lite ALPS is unavailable with a restore action", () => {
  const dir = temporaryDirectory();
  const { litePath, service } = completedDerivedFull(dir);
  const restore = new RegExp(
    `^- Restore the completed Lite ALPS document at ${escapeRegExp(litePath)}, the source path recorded relative to this Full document\\.`,
    "m",
  );

  const other = path.join(dir, "other.alps.xml");
  new DocumentService().initDocument("other", other);
  fs.copyFileSync(other, litePath);
  let status = service.getStatus();
  assert.match(
    status,
    /^Lite source unavailable: the document is not Lite ALPS\. Lite coverage is unverified\.$/m,
  );
  assert.match(status, /^Completion: 🟡 Incomplete — Lite source unavailable$/m);
  assert.match(status, restore);

  fs.writeFileSync(litePath, "not an ALPS document");
  status = service.getStatus();
  assert.match(
    status,
    /^Lite source unavailable: Missing <alps-document> root element\. Lite coverage is unverified\.$/m,
  );
  assert.match(status, restore);
});

test("Full saves, status and export never change the Lite source, and export refuses to replace it", () => {
  const dir = temporaryDirectory();
  const { litePath, service } = completedDerivedFull(dir);
  const liteBefore = fs.readFileSync(litePath, "utf8");

  service.saveSection(1, "2", "Document Name", "Cart");
  service.saveGlossaryEntry("SLA", "Service level agreement");
  service.getStatus();
  service.loadDocument(path.join(dir, "cart.alps.xml"));
  assert.match(service.exportMarkdown(path.join(dir, "cart.md")), /Exported to/);
  assert.equal(fs.readFileSync(litePath, "utf8"), liteBefore);

  const refusal =
    /Markdown output must not replace the Lite source document\. Choose another output_path ending in \.md\./;
  assert.throws(() => service.exportMarkdown(litePath), refusal);
  const link = path.join(dir, "lite-link.md");
  fs.symlinkSync(litePath, link);
  assert.throws(() => service.exportMarkdown(link), refusal);
  assert.equal(fs.readFileSync(litePath, "utf8"), liteBefore);

  // A missing source path is still protected, so export cannot plant a non-Lite file there,
  // including through a directory alias.
  fs.renameSync(litePath, `${litePath}.moved`);
  assert.throws(() => service.exportMarkdown(litePath), refusal);
  const alias = path.join(dir, "alias");
  fs.symlinkSync(path.dirname(litePath), alias);
  assert.throws(() => service.exportMarkdown(path.join(alias, path.basename(litePath))), refusal);
  // `..` after a directory link steps out of the link's target, as the operating system does.
  fs.mkdirSync(path.join(path.dirname(litePath), "inner"));
  fs.symlinkSync(path.join(path.dirname(litePath), "inner"), path.join(dir, "inner-link"));
  assert.throws(
    () => service.exportMarkdown(`${dir}/inner-link/../${path.basename(litePath)}`),
    refusal,
  );
  assert.equal(fs.existsSync(litePath), false);
});

test("export treats case and Unicode variants of a missing Lite location as that location", () => {
  const dir = temporaryDirectory();
  const folder = "장바구니";
  const litePath = completedLite(dir, folder);
  const service = new DocumentService();
  service.initDocument("cart", path.join(dir, "cart.alps.xml"), "alps", litePath);
  fs.renameSync(litePath, `${litePath}.moved`);
  const refusal = /Markdown output must not replace the Lite source document\./;
  // A case-insensitive or normalizing volume, such as the default macOS one, opens these as the Lite.
  for (const variant of [
    path.join(dir, folder, "Cart.lite.alps.xml"),
    path.join(dir, folder.normalize("NFD"), "cart.lite.alps.xml"),
    path.join(dir, folder, "cart.lite.alpſ.xml"),
    path.join(dir, folder, "cart.lite\u200B.alps.xml"),
  ]) {
    assert.throws(() => service.exportMarkdown(variant), refusal);
  }
  assert.match(service.exportMarkdown(path.join(dir, folder, "cart.md")), /Exported to/);
});

test("export folds special case pairs and ignorable characters of a missing Lite location", () => {
  const dir = temporaryDirectory();
  const folder = "straße";
  const litePath = completedLite(dir, folder);
  const service = new DocumentService();
  service.initDocument("cart", path.join(dir, "cart.alps.xml"), "alps", litePath);
  fs.renameSync(litePath, `${litePath}.moved`);
  for (const variant of [
    path.join(dir, "STRASSE", "cart.lite.alps.xml"),
    path.join(dir, "straẞe", "cart.lite.alps.xml"),
    path.join(dir, folder, "cart.lite.al\u00ADps.xml"),
  ]) {
    assert.throws(
      () => service.exportMarkdown(variant),
      /Markdown output must not replace the Lite source document\./,
      variant,
    );
  }
});

test("export compares a missing Lite location through the nearest existing directory's identity", () => {
  const dir = temporaryDirectory();
  const { litePath, service } = completedDerivedFull(dir);
  // The whole Lite directory is gone, and `mount` stands for a mount or firmlink alias of `dir`.
  fs.rmSync(path.dirname(litePath), { recursive: true });
  const mount = path.join(dir, "mount");
  fs.mkdirSync(mount);
  const original = fs.statSync;
  const alias = ((file: fs.PathLike, ...rest: unknown[]) =>
    (original as (...args: unknown[]) => fs.Stats)(
      path.resolve(String(file)) === mount ? dir : file,
      ...rest,
    )) as typeof fs.statSync;
  (fs as { statSync: typeof fs.statSync }).statSync = alias;
  try {
    assert.throws(
      () => service.exportMarkdown(path.join(mount, path.relative(dir, litePath))),
      /Markdown output must not replace the Lite source document\./,
    );
  } finally {
    (fs as { statSync: typeof fs.statSync }).statSync = original;
  }
  assert.equal(fs.existsSync(path.join(mount, path.relative(dir, litePath))), false);
});

test("export cannot reach the target of a recorded Lite path that became a dangling link", () => {
  const dir = temporaryDirectory();
  const { litePath, service } = completedDerivedFull(dir);
  const real = path.join(dir, "elsewhere", "real.lite.alps.xml");
  fs.mkdirSync(path.dirname(real));
  fs.renameSync(litePath, real);
  fs.symlinkSync(real, litePath);
  fs.renameSync(real, `${real}.moved`);
  assert.throws(
    () => service.exportMarkdown(real),
    /Markdown output must not replace the Lite source document\./,
  );
  assert.equal(fs.existsSync(real), false);
});

test("a glossary save on a current-order derived Full changes only the glossary and fingerprint", () => {
  const dir = temporaryDirectory();
  const { litePath, fullPath, service } = completedDerivedFull(dir);
  const handEdited = fs
    .readFileSync(fullPath, "utf8")
    .replace('<alps-document project="cart"', '<alps-document project="cart" owner="team-a"')
    .replace('source-fingerprint="', 'source-fingerprint = "')
    .replace("</alps-document>", "<!-- reviewer note -->\n</alps-document>");
  fs.writeFileSync(fullPath, handEdited);
  new DocumentService()
    .forDocument(litePath)
    .saveSection(1, "1", "Target User and Core Problem", "Guest shoppers lose carts.");

  service.saveGlossaryEntry("SLA", "Service level agreement");
  const raw = fs.readFileSync(fullPath, "utf8");
  assert.equal(raw.match(/source-fingerprint/g)?.length, 1, "the attribute is replaced, not added");
  const fingerprint = raw.match(/source-fingerprint = "([0-9a-f]{64})"/)![1];
  assert.notEqual(fingerprint, handEdited.match(/source-fingerprint = "([0-9a-f]{64})"/)![1]);
  assert.equal(
    raw,
    handEdited
      .replace(/source-fingerprint = "[0-9a-f]{64}"/, `source-fingerprint = "${fingerprint}"`)
      .replace(
        "<!-- reviewer note -->\n</alps-document>",
        '<!-- reviewer note -->\n<glossary>\n<entry term="SLA">Service level agreement</entry>\n</glossary>\n\n</alps-document>',
      ),
  );
  assert.doesNotMatch(service.getStatus(), /Lite source changed/);
});

test("a glossary save on a derived Full records the current source fingerprint and keeps the source", () => {
  const dir = temporaryDirectory();
  const { litePath, fullPath, service } = completedDerivedFull(dir);
  new DocumentService()
    .forDocument(litePath)
    .saveSection(1, "1", "Target User and Core Problem", "Guest shoppers lose carts.");
  assert.match(service.getStatus(), /Lite source changed since the last Full save/);

  service.saveGlossaryEntry("SLA", "Service level agreement");
  const raw = fs.readFileSync(fullPath, "utf8");
  assert.match(
    raw,
    /<alps-document project="cart" source="lite\/cart\.lite\.alps\.xml" source-fingerprint="[0-9a-f]{64}">/,
  );
  assert.match(raw, /<entry term="SLA">Service level agreement<\/entry>/);
  assert.match(raw, /Feature body/);
  const status = service.getStatus();
  assert.doesNotMatch(status, /Lite source changed/);
  assert.match(status, /^Completion: ✅ Complete$/m);
});
