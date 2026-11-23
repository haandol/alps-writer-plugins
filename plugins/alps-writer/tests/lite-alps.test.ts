import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import {
  LITE_CHAPTERS_DIR,
  LITE_SECTION_NUMBERS,
  LITE_SECTION_TITLES,
  NOT_STARTED,
} from "../src/constants.js";
import { LITE_ALPS_PROFILE } from "../src/profiles.js";
import { DocumentService } from "../src/tools/documents/service.js";
import { TemplateService } from "../src/tools/templates/service.js";
import { saveCompleteLite, liteContextDiagram } from "./lite-fixtures.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lite-alps-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

function liteDocument(project: string, titles: string[]): string {
  const sections = titles
    .map(
      (title, index) => `<section id="${index + 1}" title="${title}">\n${NOT_STARTED}\n</section>`,
    )
    .join("\n\n");
  return `<alps-document project="${project}" profile="lite">\n\n${sections}\n\n</alps-document>`;
}

const read = (...segments: string[]) =>
  fs.readFileSync(path.join(PACKAGE_ROOT, ...segments), "utf8");

const liteGuides = () =>
  LITE_SECTION_NUMBERS.map((section) =>
    read("src", "guides", "lite", `${String(section).padStart(2, "0")}.md`),
  ).join("\n");

const liteChapters = () =>
  fs
    .readdirSync(LITE_CHAPTERS_DIR)
    .filter((name) => name.endsWith(".xml"))
    .map((name) => fs.readFileSync(path.join(LITE_CHAPTERS_DIR, name), "utf8"))
    .join("\n");

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Lite ALPS exposes eight business-requirement sections in order", () => {
  assert.deepEqual(LITE_SECTION_NUMBERS, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(Object.values(LITE_SECTION_TITLES), [
    "Business Context",
    "Business Requirements",
    "Functional Requirements",
    "Non-Functional Requirements",
    "Edge Cases",
    "Success Criteria",
    "Out of Scope",
    "Demo Scenario",
  ]);

  const template = new TemplateService(LITE_ALPS_PROFILE);
  assert.equal(template.listSections().length, 8);
  assert.match(template.getOverview(), /1 → 2 → 3 → 4 → 5 → 6 → 7 → 8/);
  assert.match(template.getOverview(), /Section 7 is optional/i);
  assert.match(template.getSection(1), /1\.1 Target User and Core Problem/);
  assert.match(template.getSection(1), /1\.2 Intent and Desired Outcome/);
  assert.match(template.getSection(2), /2\.1 Business Requirements/);
  assert.match(template.getSection(3), /3\.1 Functional Requirements/);
  assert.match(template.getSection(3), /3\.2 Business Context Diagram/);
  assert.match(template.getSection(4), /4\.1 Non-Functional Requirements/);
  assert.match(template.getSection(5), /5\.1 Edge Cases/);
  assert.match(template.getSection(6), /6\.1 KPIs and Tension Metrics/);
  assert.match(template.getSection(7), /7\.1 Explicit Exclusions \(Optional\)/);
  assert.match(template.getSection(8), /8\.1 Demo Scenario/);
  assert.match(template.getSectionGuide(8), /Sections 1-6/);
});

test("Full and Lite ALPS use one same-named Demo Scenario subsection", () => {
  const fullDemo = new TemplateService().getSection(3);
  const liteDemo = new TemplateService(LITE_ALPS_PROFILE).getSection(8);

  assert.match(fullDemo, /3\.1 Demo Scenario/);
  assert.doesNotMatch(fullDemo, /3\.2/);
  assert.match(liteDemo, /8\.1 Demo Scenario/);
  assert.doesNotMatch(liteDemo, /8\.2|Learning Check/);
  assert.match(liteDemo, /every Required FR/i);
  assert.match(liteDemo, /visible expected result/i);
  assert.match(liteDemo, /overall pass result/i);
});

test("Lite templates keep requirements evaluable, identified and free of technology", () => {
  const source = liteChapters();

  for (const prefix of ["BR", "FR", "NFR", "EC", "KPI", "TM"]) {
    assert.match(source, new RegExp(`\`${prefix}-n\``));
  }
  assert.match(source, /Required or Optional/);
  assert.match(source, /pass\/fail criterion/i);
  assert.match(source, /Given\/When\/Then/);
  assert.match(source, /technical author can derive technical requirements/i);
  assert.match(source, /release acceptance/i);
  assert.match(source, /always propose a tension metric/i);
  assert.match(source, /tension decision/i);
  assert.match(source, /Business Context Diagram/);
  assert.match(source, /C4Context/);
  assert.match(source, /business wording/i);
  assert.doesNotMatch(source, /^C4Container$/m);
  assert.doesNotMatch(source, /Technology Stack|Technical Description|Solution Strategy/);
  assert.doesNotMatch(source, /Essential User Experiences|Desired Business Impact/);
  assert.doesNotMatch(source, /\bF\d+\b|State Matrix|Learning Check/);
  assert.match(source, /never record replaceable technology/i);
  assert.match(source, /Full ALPS adds those/i);
});

test("optional Out of Scope does not block completion and export omits it", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "cart.lite.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("cart", target, "lite"), /Created Lite ALPS/);
  assert.match(service.getStatus(), /Completion: 🟡 Incomplete — Sections not written: 1, 2, 3/);
  saveCompleteLite(service);

  const status = service.getStatus();
  assert.match(status, /Section 1 .*✅ Written \(2\/2 subsections\)/);
  assert.match(status, /Section 3 .*✅ Written \(2\/2 subsections\)/);
  assert.match(status, /Section 7 .*Optional — not written/);
  assert.match(status, /Section 8 .*✅ Written \(1\/1 subsections\)/);
  assert.match(status, /Requirement IDs: 6 defined \(BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1\)/);
  assert.match(status, /Completion: ✅ Complete/);

  const exportWithoutExclusions = service.exportMarkdown();
  assert.doesNotMatch(exportWithoutExclusions, /## Section 7\. Out of Scope/);
  assert.doesNotMatch(exportWithoutExclusions, /Not yet written/);
  assert.match(exportWithoutExclusions, /## Section 8\. Demo Scenario/);

  assert.match(
    service.saveSection(7, "1", "Explicit Exclusions", "Explicitly excluded"),
    /Saved 7\.1/,
  );
  assert.match(service.getStatus(), /Section 7 .*✅ Written \(1 optional subsection\)/);
  assert.match(service.exportMarkdown(), /## Section 7\. Out of Scope/);
});

test("Lite Business Context Diagram requires exactly one Context and rejects lower C4 levels", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "context.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("context", target, "lite");
  const before = fs.readFileSync(target, "utf8");

  assert.throws(
    () => service.saveSection(3, "2", "Business Context Diagram", "Text only"),
    /Section 3\.2 requires exactly one Mermaid C4Context diagram/,
  );
  const duplicate = `${liteContextDiagram()}\n\n${liteContextDiagram()}`;
  assert.throws(
    () => service.saveSection(3, "2", "Business Context Diagram", duplicate),
    /requires exactly one Mermaid C4Context diagram/,
  );
  const containerAdded = `${liteContextDiagram()}

\`\`\`mermaid
C4Container
Container(app, "Application")
\`\`\``;
  assert.throws(
    () => service.saveSection(3, "2", "Business Context Diagram", containerAdded),
    /allows only Mermaid C4Context diagrams; found C4Container/,
  );
  assert.equal(fs.readFileSync(target, "utf8"), before);

  assert.match(
    service.saveSection(3, "2", "Business Context Diagram", liteContextDiagram()),
    /Saved 3\.2/,
  );
});

test("Lite requirement IDs are defined once in their owning subsection and dangling references block completion", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "ids.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("ids", target, "lite");
  const before = fs.readFileSync(target, "utf8");

  const duplicate = "| ID | Rule |\n|----|------|\n| BR-1 | First |\n| BR-1 | Second |";
  assert.throws(
    () => service.saveSection(2, "1", "Business Requirements", duplicate),
    /must be defined once in 2\.1; duplicated: BR-1/,
  );
  assert.equal(fs.readFileSync(target, "utf8"), before);

  // A reference in a later cell or prose never defines; FR-1 is not counted inside FR-10 or NFR-1.
  service.saveSection(
    2,
    "1",
    "Business Requirements",
    "| ID | Rule | Related |\n|----|------|---------|\n| BR-1 | Sum quantities | FR-10 |",
  );
  service.saveSection(
    3,
    "1",
    "Functional Requirements",
    "**FR-1: Merge** (Required)\n- Rules: BR-1, BR-2\n- Quality: NFR-1",
  );
  const status = service.getStatus();
  assert.match(status, /Requirement IDs: 2 defined \(BR-1, FR-1\)/);
  assert.match(status, /Undefined requirement references: BR-2, FR-10, NFR-1/);
  assert.match(status, /Completion: 🟡 Incomplete — .*undefined requirement references/);
  assert.doesNotMatch(status, /Undefined requirement references: .*(?<![A-Z])FR-1(?!\d)/);
});

test("Lite documents initialize, validate, resume, and export independently from Full ALPS", () => {
  const dir = temporaryDirectory();
  const liteTarget = path.join(dir, "product.lite.alps.xml");
  const fullTarget = path.join(dir, "product.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("product", liteTarget, "lite"), /Created Lite ALPS document/);
  const rawLite = fs.readFileSync(liteTarget, "utf8");
  assert.match(rawLite, /<alps-document project="product" profile="lite">/);
  assert.equal([...rawLite.matchAll(/<section id="/g)].length, 8);
  assert.match(rawLite, /title="Business Context"/);
  assert.match(rawLite, /title="Demo Scenario"/);
  assert.match(service.getStatus(), /Lite ALPS Document: product/);
  assert.doesNotMatch(service.getStatus(), /Section 9/);

  assert.match(
    service.saveSection(1, "1", "Target User and Core Problem", "Guest shoppers"),
    /Saved 1\.1/,
  );
  const beforeInvalid = fs.readFileSync(liteTarget, "utf8");
  assert.throws(() => service.saveSection(9, "1", "Anything", "x"), /Must be 1-8 for Lite ALPS/);
  assert.throws(
    () => service.saveSection(1, "2", "Desired Business Impact", "wrong current title"),
    /must be "Intent and Desired Outcome"/,
  );
  assert.equal(fs.readFileSync(liteTarget, "utf8"), beforeInvalid);
  assert.match(service.exportMarkdown(), /^# product Lite ALPS/m);
  assert.doesNotMatch(service.exportMarkdown(), /## Section 7\. Out of Scope/);
  assert.match(service.exportMarkdown(), /## Section 8\. Demo Scenario/);

  const resumed = new DocumentService();
  const resumeGuidance = resumed.loadDocument(liteTarget);
  assert.match(resumeGuidance, /alps_template\(action: 'guide', profile: 'lite'/);
  assert.match(resumeGuidance, /propose Sections 2-6 and 8 before asking the user to design them/i);
  assert.match(resumeGuidance, /undefined terms or protected decisions/i);
  assert.doesNotMatch(resumeGuidance, /DO NOT auto-generate content/);

  const full = new DocumentService();
  assert.match(full.initDocument("product", fullTarget), /Created ALPS document/);
  assert.match(full.getStatus(), /Section 9 \(Out of Scope\)/);
  assert.doesNotMatch(full.getStatus(), /Lite source|Requirement IDs|Completion:/);
  assert.match(full.saveSection(1, "1", "Purpose", "Full ALPS remains independent"), /Saved 1\.1/);
  assert.doesNotMatch(fs.readFileSync(liteTarget, "utf8"), /Full ALPS remains independent/);
});

test("other Lite formats are rejected without modifying the original document", () => {
  const dir = temporaryDirectory();
  const formerFourPath = path.join(dir, "former-four.lite.alps.xml");
  const formerEightPath = path.join(dir, "former-eight.lite.alps.xml");
  const formerFour = liteDocument("former-four", [
    "Overview",
    "Solution and Essential User Experiences",
    "Out of Scope",
    "Demo Scenario",
  ]);
  const formerEight = liteDocument("former-eight", [
    "Product Overview",
    "MVP Goals and Scope",
    "Primary User Scenario",
    "Key Features and Behavior",
    "Key Screens",
    "Shared Product Principles",
    "PoC Validation Plan",
    "Open Questions",
  ]);
  fs.writeFileSync(formerFourPath, formerFour);
  fs.writeFileSync(formerEightPath, formerEight);

  const service = new DocumentService();
  assert.throws(() => service.loadDocument(formerFourPath), /must contain Sections 1-8/);
  assert.equal(fs.readFileSync(formerFourPath, "utf8"), formerFour);
  assert.throws(
    () => service.loadDocument(formerEightPath),
    /Section 1 title must be "Business Context"/,
  );
  assert.equal(fs.readFileSync(formerEightPath, "utf8"), formerEight);
});

test("Lite load rejects invalid fixed subsection schemas without modifying the original", () => {
  const dir = temporaryDirectory();
  const base = liteDocument("invalid-subsections", Object.values(LITE_SECTION_TITLES));
  const section = (id: number, title: string, content: string) =>
    `<section id="${id}" title="${title}">\n${content}\n</section>`;
  const cases = [
    {
      name: "wrong-title",
      content: base.replace(
        section(1, "Business Context", NOT_STARTED),
        section(
          1,
          "Business Context",
          '<subsection id="1.1" title="Problem Context">old content</subsection>',
        ),
      ),
      error: /Title for 1\.1 must be "Target User and Core Problem"/,
    },
    {
      name: "former-impact-title",
      content: base.replace(
        section(1, "Business Context", NOT_STARTED),
        section(
          1,
          "Business Context",
          '<subsection id="1.2" title="Desired Business Impact">old content</subsection>',
        ),
      ),
      error: /Title for 1\.2 must be "Intent and Desired Outcome"/,
    },
    {
      name: "unknown-id",
      content: base.replace(
        section(7, "Out of Scope", NOT_STARTED),
        section(7, "Out of Scope", '<subsection id="7.9" title="Wrong">old content</subsection>'),
      ),
      error: /Unknown subsection 7\.9/,
    },
    {
      name: "duplicate-id",
      content: base.replace(
        section(8, "Demo Scenario", NOT_STARTED),
        section(
          8,
          "Demo Scenario",
          [
            '<subsection id="8.1" title="Demo Scenario">first</subsection>',
            '<subsection id="8.1" title="Demo Scenario">second</subsection>',
          ].join("\n"),
        ),
      ),
      error: /subsection 8\.1 must appear exactly once/,
    },
  ];

  for (const testCase of cases) {
    const target = path.join(dir, `${testCase.name}.lite.alps.xml`);
    fs.writeFileSync(target, testCase.content);

    const service = new DocumentService();
    assert.throws(() => service.loadDocument(target), testCase.error);
    assert.equal(fs.readFileSync(target, "utf8"), testCase.content);
    assert.throws(() => service.getStatus(), /No document loaded/);
  }
});

test("profile mismatches preserve the original document", () => {
  const dir = temporaryDirectory();
  const wrongLitePath = path.join(dir, "wrong.alps.xml");
  const wrongFullPath = path.join(dir, "wrong.lite.alps.xml");
  const wrongShapePath = path.join(dir, "wrong-shape.lite.alps.xml");
  const wrongTitlePath = path.join(dir, "wrong-title.lite.alps.xml");
  const wrongOrderPath = path.join(dir, "wrong-order.lite.alps.xml");
  const service = new DocumentService();

  assert.throws(
    () => service.initDocument("lite", wrongLitePath, "lite"),
    /must use the \.lite\.alps\.xml extension/,
  );
  assert.equal(fs.existsSync(wrongLitePath), false);
  assert.throws(
    () => service.initDocument("full", wrongFullPath),
    /must use the \.alps\.xml extension/,
  );
  assert.equal(fs.existsSync(wrongFullPath), false);

  fs.writeFileSync(
    wrongShapePath,
    '<alps-document project="mismatch" profile="lite"><section id="1" title="Business Context"><!-- Not started --></section></alps-document>',
  );
  const wrongShape = fs.readFileSync(wrongShapePath, "utf8");
  assert.throws(() => service.loadDocument(wrongShapePath), /must contain Sections 1-8/);
  assert.equal(fs.readFileSync(wrongShapePath, "utf8"), wrongShape);

  assert.match(service.initDocument("lite", wrongTitlePath, "lite"), /Created Lite ALPS/);
  const wrongTitle = fs
    .readFileSync(wrongTitlePath, "utf8")
    .replace('title="Business Context"', 'title="Overview"');
  fs.writeFileSync(wrongTitlePath, wrongTitle);
  assert.throws(
    () => service.loadDocument(wrongTitlePath),
    /Section 1 title must be "Business Context"/,
  );
  assert.equal(fs.readFileSync(wrongTitlePath, "utf8"), wrongTitle);

  assert.match(service.initDocument("lite", wrongOrderPath, "lite"), /Created Lite ALPS/);
  const wrongOrder = fs
    .readFileSync(wrongOrderPath, "utf8")
    .replace('<section id="2"', '<section id="1"');
  fs.writeFileSync(wrongOrderPath, wrongOrder);
  assert.throws(() => service.loadDocument(wrongOrderPath), /must contain Sections 1-8/);
  assert.equal(fs.readFileSync(wrongOrderPath, "utf8"), wrongOrder);
});

test("Lite guidance proposes evaluable requirements from the business context", () => {
  const skill = read("skills", "lite-alps-init", "SKILL.md");
  const runtime = read("src", "index.ts");
  const overview = read("src", "templates", "lite", "overview.md");
  const guides = liteGuides();

  for (const source of [skill, runtime, overview]) {
    for (const title of Object.values(LITE_SECTION_TITLES)) assert.match(source, new RegExp(title));
    for (const prefix of ["BR", "FR", "NFR", "EC", "KPI", "TM"]) {
      assert.match(source, new RegExp(`${prefix}-n`));
    }
    assert.match(source, /Required or Optional|required or optional/);
    assert.match(source, /tension metric/i);
    assert.match(source, /C4Context/);
    assert.doesNotMatch(
      source,
      /Essential User Experiences|Desired Business Impact|Solution Strategy/,
    );
    assert.match(source, /same conversational|follows Full ALPS|Full ALPS's conversation/i);
  }

  assert.match(skill, /1 → 2 → 3 → 4 → 5 → 6 → 7 → 8/);
  assert.match(skill, /Every Section except Section 7 is required/i);
  assert.match(overview, /never reads or updates a Full document/i);
  assert.match(skill, /never reads or updates a Full document/i);
  assert.match(overview, /upper business baseline/i);

  assert.match(guides, /exactly one Mermaid `C4Context`/i);
  assert.match(guides, /business-role|business responsibility/i);
  assert.match(guides, /Never generate `C4Container`/i);
  assert.match(guides, /Do not invent non-goals/i);
  assert.match(guides, /overall pass result/i);
  assert.match(guides, /without a\s+dedicated question/i);
  assert.match(guides, /proof of\s+business impact or market validity/i);
  assert.match(guides, /Work backward|Reverse-engineer/i);
  assert.match(guides, /always propose one/i);
  assert.match(guides, /Record the decision for every KPI/i);
  assert.match(guides, /Do not save the Section while an acceptance-changing value/i);
  assert.match(guides, /show the affected items in the same digest/i);
  assert.doesNotMatch(guides, /technology stack wizard|Learning Check/i);
});

test("Lite Section 1 asks for business context without pulling requirements or demo design forward", () => {
  const skill = read("skills", "lite-alps-init", "SKILL.md");
  const overview = read("src", "templates", "lite", "overview.md");
  const guide = read("src", "guides", "lite", "01.md");
  const chapter = read("src", "templates", "lite", "chapters", "01-business-context.xml");
  const runtime = read("src", "index.ts");

  assert.match(runtime, /same conversational approval pattern as Full ALPS/i);
  assert.match(skill, /ask one focused\s+question or at most two closely related questions/i);
  assert.match(overview, /ask one\s+focused question, or at most two closely related questions/i);
  assert.match(guide, /Who is the main target user, and what core problem/i);
  assert.match(guide, /what final outcome should they gain/i);
  assert.match(guide, /Do not ask for a solution, screen, technology, requirement list/i);
  assert.match(chapter, /Identify the main target user and the core problem/i);
  assert.match(chapter, /Do not ask for a solution, screen, technology, requirement list/i);

  for (const source of [runtime, skill, overview, guide, chapter]) {
    assert.doesNotMatch(source, /concrete hypothetical|Primary Persona/i);
  }
});

test("Lite requirement Sections propose before asking and ask only for protected or missing context", () => {
  for (const section of [2, 3, 4, 5, 6, 8]) {
    const guide = read("src", "guides", "lite", `0${section}.md`);
    assert.match(guide, /propose/i, `guide ${section}`);
    assert.match(guide, /Ask only/i, `guide ${section}`);
  }
  const guide2 = read("src", "guides", "lite", "02.md");
  assert.match(guide2, /propose every business requirement before asking the user/i);
  assert.match(guide2, /would change money, permissions, law or\s+regulation/i);
  assert.match(guide2, /Never record replaceable technology/i);
  const guide3 = read("src", "guides", "lite", "03.md");
  assert.match(guide3, /before asking the user to design one/i);
  assert.match(guide3, /without another business\s+question/i);
});

test("only the current eight-section Lite assets are shipped", () => {
  const chapters = fs.readdirSync(LITE_CHAPTERS_DIR).filter((name) => name.endsWith(".xml"));
  assert.equal(chapters.length, 8);
  for (const former of [
    "01-overview.xml",
    "02-solution-and-essential-user-experiences.xml",
    "02-solution-and-acceptance-tests.xml",
    "04-demo-scenario.xml",
  ]) {
    assert.equal(chapters.includes(former), false, former);
  }
  assert.equal(
    fs
      .readdirSync(path.join(PACKAGE_ROOT, "src", "guides", "lite"))
      .filter((name) => name.endsWith(".md")).length,
    8,
  );
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "src", "templates", "lite", "legacy")), false);
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "src", "guides", "lite", "legacy")), false);
});
