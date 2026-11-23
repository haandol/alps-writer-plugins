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
import {
  COMPLETE_LITE_SUBSECTIONS,
  saveCompleteLite,
  liteContextDiagram,
} from "./lite-fixtures.js";

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
  const exported = service.exportMarkdown();
  assert.match(exported, /## Section 7\. Out of Scope/);
  assert.ok(
    exported.indexOf("## Section 6. Success Criteria") <
      exported.indexOf("## Section 7. Out of Scope") &&
      exported.indexOf("## Section 7. Out of Scope") <
        exported.indexOf("## Section 8. Demo Scenario"),
    "a written optional Section keeps its original position",
  );
});

test("Lite Business Context Diagram requires exactly one Context and rejects lower C4 levels", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "context.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("context", target, "lite");
  const before = fs.readFileSync(target, "utf8");

  assert.throws(
    () => service.saveSection(3, "2", "Business Context Diagram", "Text only"),
    /Section 3\.2 requires exactly one Mermaid C4Context diagram\. Keep one ```mermaid block whose first line is C4Context, outside quotes, and remove any other C4Context block or line holding only that keyword\./,
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
    /allows only Mermaid C4Context diagrams; found C4Container\. Remove that diagram, or any line holding only that keyword; system structure belongs in Full ALPS Section 4\.1\./,
  );
  assert.equal(fs.readFileSync(target, "utf8"), before);

  // Tilde fences, any-case info strings and frontmatter are Mermaid blocks too.
  for (const [extra, message] of [
    ["~~~mermaid\nC4Container\n~~~", /found C4Container/],
    ["```mermaid\n---\ntitle: Internal\n---\nC4Container\n```", /found C4Container/],
    ["~~~Mermaid\nC4Context\n~~~", /requires exactly one Mermaid C4Context diagram/],
  ] as const) {
    assert.throws(
      () =>
        service.saveSection(
          3,
          "2",
          "Business Context Diagram",
          `${liteContextDiagram()}\n\n${extra}`,
        ),
      message,
    );
  }
  assert.equal(fs.readFileSync(target, "utf8"), before);

  // A fence closes on at least as many fence characters, and an unclosed fence runs to the end.
  const context = liteContextDiagram();
  for (const content of [
    `${context}\n\n\`\`\`mermaid\nC4Container\n\`\`\`\``,
    `${context.replace(/\`\`\`$/, "\`\`\`\`")}\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    `${context.replace(/\`\`\`$/, "\`\`\`\`")}\n\n\`\`\`mermaid\nC4Context\n\`\`\``,
    `${context}\n\n\`\`\`mermaid\nC4Container`,
    // Only the opening character closes a fence, and inline code at a line start is no fence.
    `${context.replace(/\`\`\`$/, "~~~\n\`\`\`")}\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    `${context}\n\n\`\`\`C4Context\`\`\` 아래에 실행 구조를 덧붙인다.\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    // A line indented four columns is no fence, and a list item's fence ends with the item.
    `${context}\n\nNote:\n\n    \`\`\`text\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    `${context}\n\nNote:\n\n    \`\`\`text\n\n${context}`,
    `${context}\n\n- Example:\n  \`\`\`text\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    // Whatever list, quote or lazy line surrounds them, C4 keyword lines are still read.
    `${context}\n\n- Parent:\n  - Child\n  \`\`\`text\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    `${context}\n\n- Parent:\n  - Child\n  \`\`\`text\n\n${context}`,
    `${context}\n\n- Example:\ncontinued lazily\n  \`\`\`text\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
    `${context}\n\n-     \`\`\`text\n     \`\`\`mermaid\n     C4Container\n     \`\`\``,
    `${context}\n\n-\t\`\`\`mermaid\n\tC4Container\n\t\`\`\``,
    `${context}\n\n> \`\`\`mermaid\n> C4Container\n> \`\`\``,
    `${context}\n\nParagraph\n2. not a list item\n   \`\`\`text\nx\n\`\`\`\n\`\`\`mermaid\nC4Container\n\`\`\``,
    // Directives are removed as Mermaid removes them, and a lone carriage return ends a line.
    `${context}\n\n\`\`\`mermaid\n%%{init: {}}%% C4Container\n\`\`\``,
    `${context}\n\n\`\`\`mermaid\n%%{init: {\n  "theme": "neutral"}}%% C4Context\n\`\`\``,
    `${context}\n\n\`\`\`mermaid\n%%{wrap}%% C4Component\n\`\`\``,
    `${context}\r\r\`\`\`mermaid\rC4Container\r\`\`\``,
    `${context}\n\n<pre class="mermaid">C4Container\nContainer(app, "Application")\n</pre>`,
    `${context}\n\n\`\`\`mermaid\nC4Dynamic\n\`\`\``,
    `${context}\n\n\`\`\`mermaid\nC4Deployment\n\`\`\``,
    `${context}\n\n- C4Container %% hidden level`,
    // An unmatched `%%{` cannot swallow a quoted level up to a later directive close.
    `${context}\n\n> \`\`\`mermaid\n> %%{ "a": 1\n> C4Container\n> \`\`\`\n\nNote %%{x}%% done.`,
    // The line reading alone sees levels inside a quote, where no fence is recognized.
    `${context}\n\n> \`\`\`mermaid\n> %%{init: {}}%% C4Container\n> \`\`\``,
    `${context}\n\n> \`\`\`mermaid\r> C4Container\r> \`\`\``,
    `${context}\n\n> \`\`\`mermaid\n> C4Dynamic\n> \`\`\``,
    `${context}\n\n> \`\`\`mermaid\n> C4Deployment\n> \`\`\``,
    // A closing fence indented four columns past its container does not close the block.
    `${context.replace(/\`\`\`$/, "    \`\`\`\n\`\`\`")}\n\n\`\`\`mermaid\nC4Container\n\`\`\``,
  ]) {
    assert.throws(() => service.saveSection(3, "2", "Business Context Diagram", content));
  }
  assert.equal(fs.readFileSync(target, "utf8"), before);
  assert.match(
    service.saveSection(3, "2", "Business Context Diagram", context.replace(/\`\`\`$/, "\`\`\`\`")),
    /Saved 3\.2/,
  );
  // One Context inside a list item, a nested item or after a list marker is still one Context,
  // and prose naming the level in a sentence is no keyword line.
  for (const single of [
    `- Business view:\n\n${context.replace(/^/gm, "  ")}`,
    `- Parent:\n  - Business view:\n\n${context.replace(/^/gm, "    ")}`,
    `- ${context.replace(/\n/g, "\n  ")}`,
    `${context}\n\nC4Context 다이어그램은 쇼핑객과 상점의 관계만 보여 준다.`,
    context.replace("```mermaid\n", "```mermaid\n%%{init: {}}%% "),
    context.replace(/\n/g, "\r"),
    `\`\`\`C4Context\`\`\` 문장 뒤에도 다이어그램은 하나다.\n\n${context}`,
    `Note:\n\n    \`\`\`text\n\n${context}`,
    `- Example:\n  \`\`\`text\n\n${context}`,
    `${context.replace(/\`\`\`$/, "\`\`\`\`")}\n\n~~~text\nnote\n~~~`,
    `~~~text\n\`\`\`\n~~~\n\n${context}`,
    context.replace("Rel(", "    \`\`\`\nRel("),
    `- Business view:\n\n${context.replace(/^/gm, "  ")}\n\nAfter the list.`,
  ]) {
    assert.match(service.saveSection(3, "2", "Business Context Diagram", single), /Saved 3\.2/);
  }

  const withFrontmatter = liteContextDiagram().replace(
    "```mermaid\n",
    "```mermaid\n---\ntitle: Business view\n---\n%%{init: {}}%%\n",
  );
  assert.match(
    service.saveSection(3, "2", "Business Context Diagram", withFrontmatter),
    /Saved 3\.2/,
  );
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

test("an identifier at the start of an ordinary paragraph line is a reference, not a definition", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "paragraph.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("paragraph", target, "lite");
  saveCompleteLite(service);

  service.saveSection(
    3,
    "1",
    "Functional Requirements",
    "**FR-1: Merge the guest cart on sign-in** (Required)\n\n- Rules: BR-1\n\nFR-1 applies to every member.\n\nFR-2 is described later by the partner team.",
  );
  let status = service.getStatus();
  assert.match(status, /Requirement IDs: 6 defined \(BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1\)/);
  assert.match(status, /Undefined requirement references: FR-2/);
  assert.match(status, /Completion: 🟡 Incomplete — undefined requirement references/);

  assert.match(
    service.saveSection(
      6,
      "1",
      "KPIs and Tension Metrics",
      "| ID | KPI | Tension decision |\n|----|----|----|\n| KPI-1 | Checkout recovery | TM-1 |\n\nKPI-1은 관찰용이며 출시 조건이 아니다.\n\n| ID | Tension metric | Protects |\n|----|----|----|\n| TM-1 | Complaint rate | KPI-1 |",
    ),
    /Saved 6\.1/,
  );
  service.saveSection(
    3,
    "1",
    "Functional Requirements",
    "**FR-1: Merge** (Required)\n\nFR-1 applies to every member.",
  );
  status = service.getStatus();
  assert.doesNotMatch(status, /Duplicate requirement definitions/);
  assert.match(status, /Completion: ✅ Complete/);
});

test("Lite saves never read a file named by a root source attribute", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "sourced.lite.alps.xml");
  const neighbor = path.join(dir, "neighbor.alps.xml");
  new DocumentService().initDocument("neighbor", neighbor);
  const service = new DocumentService();
  service.initDocument("sourced", target, "lite");
  fs.writeFileSync(
    target,
    fs
      .readFileSync(target, "utf8")
      .replace('profile="lite"', 'profile="lite" source="neighbor.alps.xml"'),
  );
  const reads: string[] = [];
  const original = fs.readFileSync;
  (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = ((
    file: fs.PathOrFileDescriptor,
    ...rest: unknown[]
  ) => {
    reads.push(String(file));
    return (original as (...args: unknown[]) => unknown)(file, ...rest);
  }) as typeof fs.readFileSync;
  try {
    // Status and export run first, while the hand-written attribute is still in the file.
    const scoped = new DocumentService().forDocument(target);
    assert.doesNotMatch(scoped.getStatus(), /Lite source/);
    assert.doesNotMatch(scoped.exportMarkdown(), /Lite source/);
    scoped.saveSection(1, "1", "Target User and Core Problem", "Guests lose carts.");
  } finally {
    (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = original;
  }
  assert.deepEqual(
    reads.filter((file) => file.endsWith("neighbor.alps.xml")),
    [],
  );
});

test("Lite documents with extra section elements or root content are rejected unchanged", () => {
  const dir = temporaryDirectory();
  const base = liteDocument("extra", Object.values(LITE_SECTION_TITLES));
  for (const [name, content] of [
    [
      "appendix",
      base.replace(
        "</alps-document>",
        '<section id="appendix" title="Notes">keep me</section>\n</alps-document>',
      ),
    ],
    [
      "root-text",
      base.replace("</alps-document>", "stray notes outside any section\n</alps-document>"),
    ],
  ]) {
    const target = path.join(dir, `${name}.lite.alps.xml`);
    fs.writeFileSync(target, content);
    assert.throws(
      () => new DocumentService().loadDocument(target),
      /must contain only Sections 1-8 and an optional glossary/,
      name,
    );
    assert.equal(fs.readFileSync(target, "utf8"), content);
  }
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

test("a bold identifier that opens a sentence is a reference, while bold heading lines define", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "bold.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("bold", target, "lite");
  saveCompleteLite(service);

  service.saveSection(
    3,
    "1",
    "Functional Requirements",
    "**FR-1: Merge the guest cart on sign-in** (Required)\n\n- Rules: BR-1\n\n**FR-2** 결제 흐름은 다음 릴리스에서 다시 정의한다.",
  );
  const status = service.getStatus();
  assert.match(status, /Requirement IDs: 6 defined \(BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1\)/);
  assert.match(status, /Undefined requirement references: FR-2/);
  assert.match(status, /^Completion: 🟡 Incomplete — undefined requirement references: FR-2$/m);
  assert.match(
    status,
    /^Next steps:\n- Define each referenced ID in its owning subsection \(FR-2 in 3\.1\), or correct or remove the reference\.$/m,
  );
  assert.throws(
    () =>
      new DocumentService().initDocument("cart", path.join(dir, "cart.alps.xml"), "alps", target),
    /is not complete: undefined requirement references: FR-2/,
  );

  // A bold reference beside a table definition is not a second definition.
  assert.match(
    service.saveSection(
      3,
      "1",
      "Functional Requirements",
      "| ID | Functional requirement |\n|----|----|\n| FR-1 | Merge the guest cart |\n\n**FR-1**은 모든 회원에게 적용된다.",
    ),
    /Saved 3\.1/,
  );
});

test("a bold noun phrase or a parenthetical before prose opens a sentence and only references", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "phrase.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("phrase", target, "lite");
  saveCompleteLite(service);

  for (const [sentence, undefinedIds] of [
    ["**FR-2 결제 흐름**은 다음 릴리스에서 다시 정의한다.", "FR-2"],
    ["**FR-2 checkout** is redefined by the partner team.", "FR-2"],
    ["**FR-2 and FR-3** follow later.", "FR-2, FR-3"],
    ["**FR-2** (파트너 팀) 결제 흐름은 다음에 정의한다.", "FR-2"],
  ] as const) {
    service.saveSection(
      3,
      "1",
      "Functional Requirements",
      `**FR-1: Merge the guest cart on sign-in** (Required)\n\n- Rules: BR-1\n\n${sentence}`,
    );
    const status = service.getStatus();
    assert.match(
      status,
      /Requirement IDs: 6 defined \(BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1\)/,
      sentence,
    );
    assert.match(
      status,
      new RegExp(`Undefined requirement references: ${undefinedIds}$`, "m"),
      sentence,
    );
    assert.throws(
      () =>
        new DocumentService().initDocument("cart", path.join(dir, "cart.alps.xml"), "alps", target),
      /is not complete: undefined requirement references/,
    );
  }

  assert.match(
    service.saveSection(
      3,
      "1",
      "Functional Requirements",
      "| ID | Functional requirement |\n|----|----|\n| FR-1 | Merge the guest cart |\n\n**FR-1 병합 규칙**은 모든 회원에게 적용된다.",
    ),
    /Saved 3\.1/,
  );
});

test("Lite definitions accept emphasis, numbered items and heading forms, never fenced lines", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "forms.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("forms", target, "lite");
  saveCompleteLite(service);

  service.saveSection(
    2,
    "1",
    "Business Requirements",
    "| ID | Business requirement |\n|----|----|\n| **BR-1** | Quantities are summed |",
  );
  service.saveSection(
    3,
    "1",
    "Functional Requirements",
    "- **FR-1**: Merge the guest cart (BR-1, EC-1)\n1. FR-2: Keep the merged cart at checkout\n### FR-3 Show the merged total\n\n```text\n- FR-4: an example inside a fence\n```\n\n````markdown\n```text\n- FR-5: nested inside a longer fence\n```\n````",
  );
  // Bold heading lines with a colon, dash or parenthetical after the bold ID also define.
  service.saveSection(
    4,
    "1",
    "Non-Functional Requirements",
    "**NFR-1** (Required)\n\nThe merged cart appears within 2 seconds for 95% of sign-ins.",
  );
  service.saveSection(
    5,
    "1",
    "Edge Cases",
    "**EC-1**: The merge is retried and quantities are summed once (FR-1, BR-1).",
  );
  const status = service.getStatus();
  assert.match(
    status,
    /Requirement IDs: 8 defined \(BR-1, FR-1, FR-2, FR-3, NFR-1, EC-1, KPI-1, TM-1\)/,
  );
  assert.match(status, /Undefined requirement references: FR-4, FR-5$/m);
});

test("a hand-edited duplicate definition blocks Lite completion and Full derivation with its next action", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "duplicate.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("duplicate", target, "lite");
  saveCompleteLite(service);
  fs.writeFileSync(
    target,
    fs
      .readFileSync(target, "utf8")
      .replace(
        "**FR-1: Merge the guest cart on sign-in** (Required)",
        "| FR-1 | Merge |\n| FR-1 | Merge again |",
      ),
  );

  const status = new DocumentService().forDocument(target).getStatus();
  assert.match(status, /Duplicate requirement definitions: FR-1/);
  assert.match(status, /^Completion: 🟡 Incomplete — duplicate requirement definitions: FR-1$/m);
  assert.match(
    status,
    /^- Keep one definition of each duplicated ID in its owning subsection \(FR-1 in 3\.1\) and refer to it elsewhere by ID\.$/m,
  );
  assert.throws(
    () =>
      new DocumentService().initDocument("cart", path.join(dir, "cart.alps.xml"), "alps", target),
    /is not complete: duplicate requirement definitions: FR-1\. Complete it first: .* then keep one definition of each duplicated ID/,
  );
});

test("an incomplete Lite status names the next Section to write in section order", () => {
  const dir = temporaryDirectory();
  const service = new DocumentService();
  service.initDocument("next", path.join(dir, "next.lite.alps.xml"), "lite");
  const [first, second] = COMPLETE_LITE_SUBSECTIONS;
  service.saveSection(...first);
  service.saveSection(...second);
  assert.match(
    service.getStatus(),
    /^Completion: 🟡 Incomplete — Sections not written: 2, 3, 4, 5, 6, 8\nNext steps:\n- Write the unwritten Sections in section order, starting with Section 2 \(Business Requirements\)\.$/m,
  );
});
