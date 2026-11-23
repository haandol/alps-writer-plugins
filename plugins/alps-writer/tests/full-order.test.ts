import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { ALPS_PROFILE } from "../src/profiles.js";
import { DocumentService } from "../src/tools/documents/service.js";
import { TemplateService } from "../src/tools/templates/service.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "full-order-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const section = (id: number, title: string, body: string) =>
  `<section id="${id}" title="${title}">\n${body}\n</section>`;
const subsection = (id: string, title: string, body: string) =>
  `<subsection id="${id}" title="${title}">\n${body}\n</subsection>`;
const NOT_STARTED = "<!-- Not started -->";

const SOURCED_ROOT =
  '<alps-document project="Legacy &amp; Co" source="../lite/missing.lite.alps.xml" source-fingerprint="abc123">';

/** A Full document saved in the earlier order: Section 5 Design, Section 6 Requirements. */
function earlierOrderDocument(
  designBody?: string,
  requirementsTitle = "Requirements Summary",
  {
    designTitle = "Design Specification",
    requirementsBody,
    root = '<alps-document project="legacy">',
  }: { designTitle?: string; requirementsBody?: string; root?: string } = {},
) {
  return [
    root,
    section(1, "Overview", subsection("1.1", "Purpose", "Legacy purpose")),
    ...[2, 3, 4].map((id) => section(id, ALPS_PROFILE.sectionTitles[id], NOT_STARTED)),
    section(
      5,
      designTitle,
      designBody ??
        [
          subsection("5.1.1", "Key Pages (Features)", "- F1: Login screen"),
          subsection("5.1.2", "Page Navigation", "1. Open the login screen"),
        ].join("\n"),
    ),
    section(
      6,
      requirementsTitle,
      requirementsBody ??
        [
          subsection(
            "6.1",
            "Core Features (Functional Requirements)",
            "| F1 | Login | Must-Have |",
          ),
          subsection("6.2", "Non-Functional Requirements", "| NF1 | 3 seconds p95 | Global |"),
        ].join("\n"),
    ),
    section(7, "Feature-Level Specification", subsection("7.1", "Login", "Login feature body")),
    ...[8, 9].map((id) => section(id, ALPS_PROFILE.sectionTitles[id], NOT_STARTED)),
    '<glossary>\n<entry term="PO">Purchase order</entry>\n</glossary>',
    "</alps-document>",
  ].join("\n\n");
}

test("Full ALPS places Requirements Summary before Design Specification and authors 1 → 9", () => {
  assert.equal(ALPS_PROFILE.sectionTitles[5], "Requirements Summary");
  assert.equal(ALPS_PROFILE.sectionTitles[6], "Design Specification");
  assert.deepEqual(ALPS_PROFILE.authoringOrder, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(ALPS_PROFILE.sectionReferences, { 3: [2], 6: [5], 7: [3, 5], 8: [2, 5] });
  assert.equal(ALPS_PROFILE.dynamicSection?.sourceSubsectionId, "5.1");

  const template = new TemplateService();
  assert.match(template.getSection(5), /5\.1 Core Features \(Functional Requirements\)/);
  assert.match(template.getSection(5), /5\.3 Feature Dependency Diagram/);
  assert.match(template.getSection(6), /6\.1 User Flow and Page Structure/);
  assert.match(template.getSection(6), /6\.1\.2 Page Navigation/);
  assert.match(
    template.getOverview(),
    /1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9, the same as the section numbers/,
  );
  assert.doesNotMatch(template.getOverview(), /6 → 5/);
  assert.match(template.getSectionGuide(6), /alps_section\(action: 'read', doc_path, section: 5\)/);
});

test("an earlier-order Full document reads in the current order without changing the file", () => {
  const target = path.join(temporaryDirectory(), "legacy.alps.xml");
  const original = earlierOrderDocument();
  fs.writeFileSync(target, original);

  const service = new DocumentService();
  const status = service.loadDocument(target);
  assert.match(status, /Section 5 \(Requirements Summary\): 🟡 In progress \(2\/3 subsections\)/);
  assert.match(
    status,
    /Section 6 \(Design Specification\): 🟡 In progress \(2\/3 subsections\)|Section 6 \(Design Specification\): ✅/,
  );
  assert.match(status, /Section 7 \(Feature-Level Specification\): ✅ Written \(1\/1 features\)/);

  const scoped = service.forDocument(target);
  assert.match(scoped.readSection(5), /### 5\.1\. Core Features[\s\S]*\| F1 \| Login/);
  assert.match(scoped.readSection(5, "2"), /### 5\.2\. Non-Functional Requirements/);
  assert.match(
    scoped.readSection(6),
    /### 6\.1\.1\. Key Pages \(Features\)[\s\S]*F1: Login screen/,
  );
  const markdown = scoped.exportMarkdown();
  assert.ok(
    markdown.indexOf("## Section 5. Requirements Summary") <
      markdown.indexOf("## Section 6. Design Specification"),
  );
  assert.equal(fs.readFileSync(target, "utf8"), original);
});

test("the first approved save rewrites an earlier-order document in the current order with all content", () => {
  const target = path.join(temporaryDirectory(), "legacy.alps.xml");
  fs.writeFileSync(target, earlierOrderDocument());

  const service = new DocumentService().forDocument(target);
  assert.match(service.saveSection(1, "1", "Purpose", "Updated purpose"), /Saved 1\.1/);
  const raw = fs.readFileSync(target, "utf8");
  assert.ok(
    raw.indexOf('<section id="5" title="Requirements Summary">') <
      raw.indexOf('<section id="6" title="Design Specification">'),
  );
  assert.match(
    raw,
    /<subsection id="5\.1" title="Core Features \(Functional Requirements\)">\n\| F1 \| Login/,
  );
  assert.match(
    raw,
    /<subsection id="5\.2" title="Non-Functional Requirements">\n\| NF1 \| 3 seconds p95/,
  );
  assert.match(raw, /<subsection id="6\.1\.1" title="Key Pages \(Features\)">\n- F1: Login screen/);
  assert.match(raw, /<subsection id="6\.1\.2" title="Page Navigation">/);
  assert.match(raw, /Login feature body/);
  assert.match(raw, /<entry term="PO">Purchase order<\/entry>/);
  assert.doesNotMatch(raw, /title="Design Specification">[\s\S]*id="5\.1\.1"/);

  // The rewritten file is in the current order and no longer converts.
  const resumed = new DocumentService().forDocument(target);
  assert.match(
    resumed.getStatus(),
    /Section 7 \(Feature-Level Specification\): ✅ Written \(1\/1 features\)/,
  );
  assert.match(resumed.readSection(5, "1"), /\| F1 \| Login/);
});

/** Every earlier Section 5/6 body, now under current numbers, plus Section 7 and the root. */
function assertRewrittenWithAllContent(raw: string, root: string) {
  assert.ok(raw.startsWith(root), "the root element and its attributes are preserved");
  assert.ok(
    raw.indexOf('<section id="5" title="Requirements Summary">') <
      raw.indexOf('<section id="6" title="Design Specification">'),
  );
  assert.match(
    raw,
    /<subsection id="5\.1" title="Core Features \(Functional Requirements\)">\n\| F1 \| Login/,
  );
  assert.match(
    raw,
    /<subsection id="5\.2" title="Non-Functional Requirements">\n\| NF1 \| 3 seconds p95/,
  );
  assert.match(raw, /<subsection id="6\.1\.1" title="Key Pages \(Features\)">\n- F1: Login screen/);
  assert.match(raw, /<subsection id="6\.1\.2" title="Page Navigation">\n1\. Open the login screen/);
  assert.match(raw, /Login feature body/);
  assert.match(raw, /<entry term="PO">Purchase order<\/entry>/);
}

test("a glossary save on an earlier-order document also writes the current order", () => {
  const target = path.join(temporaryDirectory(), "legacy.alps.xml");
  fs.writeFileSync(target, earlierOrderDocument());
  const service = new DocumentService().forDocument(target);
  assert.match(service.saveGlossaryEntry("SLA", "Service level agreement"), /Saved glossary term/);
  const raw = fs.readFileSync(target, "utf8");
  assertRewrittenWithAllContent(raw, '<alps-document project="legacy">');
  assert.match(raw, /<entry term="SLA">Service level agreement<\/entry>/);
});

test("section and glossary saves keep a derived earlier-order document's root attributes", () => {
  for (const save of [
    (service: DocumentService) => service.saveSection(1, "1", "Purpose", "Updated purpose"),
    (service: DocumentService) => service.saveGlossaryEntry("SLA", "Service level agreement"),
  ]) {
    const target = path.join(temporaryDirectory(), "derived.alps.xml");
    fs.writeFileSync(target, earlierOrderDocument(undefined, undefined, { root: SOURCED_ROOT }));
    save(new DocumentService().forDocument(target));
    // The source is unreadable here, so its recorded fingerprint is kept as well.
    assertRewrittenWithAllContent(fs.readFileSync(target, "utf8"), SOURCED_ROOT);
  }
});

test("only the exact earlier title pair converts", () => {
  for (const original of [
    earlierOrderDocument(undefined, "Feature Requirements"),
    earlierOrderDocument(undefined, undefined, { designTitle: "UX Design" }),
  ]) {
    const target = path.join(temporaryDirectory(), "partial.alps.xml");
    fs.writeFileSync(target, original);
    const service = new DocumentService().forDocument(target);
    assert.match(service.readSection(6), /### 6\.1\. Core Features/);
    assert.match(service.readSection(5), /### 5\.1\.1\. Key Pages/);
    // Stored numbers are read as they are, so the earlier Design subsections fill no 5.x slot.
    assert.match(
      service.getStatus(),
      /Section 5 \(Requirements Summary\): 🟡 In progress \(0\/3 subsections\)/,
    );
    assert.equal(fs.readFileSync(target, "utf8"), original);
  }
});

test("unrecognized content in an earlier-order Section 5 or 6 blocks the rewrite without changing the file", () => {
  const refusal = (locations: string, verb: string, own: string, target: string) =>
    new RegExp(
      `Cannot rewrite this document in the current section order: ${locations} ${verb} unrecognized content outside ${own} subsections\\. Reads, status and export still work\\. To save again, move that text into one of ${target} subsections or out of the file, then retry the save\\.$`,
    );
  const design =
    'Section 6 \\(this earlier-order file stores Design Specification as <section id="5">\\)';
  const requirements =
    'Section 5 \\(this earlier-order file stores Requirements Summary as <section id="6">\\)';
  for (const [original, readable, expected] of [
    [
      earlierOrderDocument("Free-form design notes outside any subsection"),
      [6],
      refusal(design, "contains", "its", "that section's"),
    ],
    [
      earlierOrderDocument(undefined, undefined, {
        requirementsBody: "Free-form requirement notes outside any subsection",
      }),
      [5],
      refusal(requirements, "contains", "its", "that section's"),
    ],
    [
      earlierOrderDocument("Free-form design notes", undefined, {
        requirementsBody: "Free-form requirement notes",
      }),
      [5, 6],
      refusal(`${requirements} and ${design}`, "contain", "their", "each section's"),
    ],
  ] as const) {
    const target = path.join(temporaryDirectory(), "unparsed.alps.xml");
    fs.writeFileSync(target, original);
    const service = new DocumentService().forDocument(target);
    // One refusal names every location, so fixing what it names makes the next save possible.
    assert.throws(() => service.saveSection(1, "1", "Purpose", "Updated purpose"), expected);
    assert.throws(() => service.saveGlossaryEntry("SLA", "Service level agreement"), expected);
    for (const current of readable) {
      assert.match(service.readSection(current), /Free-form/);
    }
    assert.match(service.exportMarkdown(), /Free-form/);
    assert.equal(fs.readFileSync(target, "utf8"), original);
  }
});

test("Full guidance and the ADR rules cite only the current Section 5 and 6 numbers", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = [
    path.join(root, "src", "index.ts"),
    path.join(root, "src", "templates", "overview.md"),
    ...["guides", path.join("templates", "chapters")].flatMap((dir) =>
      fs
        .readdirSync(path.join(root, "src", dir))
        .filter((name) => /\.(md|xml)$/.test(name))
        .map((name) => path.join(root, "src", dir, name)),
    ),
    ...["alps-init", "feature-to-adr"].map((skill) => path.join(root, "skills", skill, "SKILL.md")),
    ...[
      "skills/adr-new/SKILL.md",
      "skills/adr-impl/references/dependencies.md",
      "templates/adr/mapping.schema.json",
      "templates/adr/structure.md",
    ].map((file) => path.join(root, "..", "adr-writer", file)),
  ];
  const earlier =
    /Section 6\.[23]\b|6\.1 Core Features|6\.2 Non-Functional|6\.3 Feature Dependency|5\.1 User Flow|5\.1\.[12] (?:Key Pages|Page Navigation)|\b6 → 5\b|\b4, 6, 5\b|section: 6\) *(?:for|to read) (?:the )?Requirements/;
  for (const file of files) {
    const match = fs.readFileSync(file, "utf8").match(earlier);
    assert.equal(
      match,
      null,
      `${path.relative(root, file)} cites an earlier number: ${match?.[0]}`,
    );
  }
});

test("Full guide, chapter and overview bodies read and reuse the current Section 5", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const raw = (...segments: string[]) => fs.readFileSync(path.join(root, ...segments), "utf8");
  const pins: [string[], RegExp][] = [
    [
      ["src", "guides", "06.md"],
      /Call alps_section\(action: 'read', doc_path, section: 5\), summarize its Feature IDs/,
    ],
    [["src", "guides", "06.md"], /reusing Section 5\.1 Feature IDs<\/completion>/],
    [
      ["src", "guides", "07.md"],
      /then call alps_section\(action: 'read', doc_path, section: 5\) and confirm all Feature IDs/,
    ],
    [
      ["src", "guides", "08.md"],
      /Section 5\.2 \(Non-Functional Requirements\): Call alps_section\(action: 'read', doc_path, section: 5\) for NFRs to validate/,
    ],
    [
      ["src", "guides", "05.md"],
      /Move every Required Lite NFR into 5\.2 as a mandatory constraint/,
    ],
    [
      ["src", "templates", "chapters", "07-feature-spec.xml"],
      /For every feature listed in Section 5\.1, provide a detailed design/,
    ],
    [
      ["src", "templates", "chapters", "07-feature-spec.xml"],
      /No additional features beyond those in Section 5\.1 may be specified here\./,
    ],
    [
      ["src", "templates", "overview.md"],
      /Section 6 \(Design Specification\) → MUST review Section 5 \(Requirements Summary\)/,
    ],
    [
      ["src", "templates", "overview.md"],
      /Section 7 \(Feature-Level Specification\) → MUST review Section 3 \(Demo Scenario\) AND Section 5 \(Requirements Summary\)/,
    ],
    [
      ["src", "templates", "overview.md"],
      /Features \(5\.1 and 7\.x\), Required NFRs 5\.2 mandatory constraints/,
    ],
    [
      ["skills", "alps-init", "SKILL.md"],
      /Sections the user leaves out of the batch are not skipped: they stay incomplete and continue in section order after the batch\./,
    ],
  ];
  for (const [segments, pin] of pins) {
    assert.match(raw(...segments), pin, `${segments.join("/")} keeps ${pin}`);
  }
  for (const guide of ["06.md", "07.md", "08.md"]) {
    assert.doesNotMatch(
      raw("src", "guides", guide),
      /section: 6\)/,
      `${guide} reads no earlier Section 6`,
    );
  }
});
