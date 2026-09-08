import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { ALPS_PROFILE } from "../src/profiles.js";
import { DocumentService } from "../src/tools/documents/service.js";
import { TemplateRegistry } from "../src/tools/templates/registry.js";
import { TemplateService } from "../src/tools/templates/service.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-writer-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("init collision never selects or overwrites the existing file", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "notes.alps.xml");
  fs.writeFileSync(target, "ORIGINAL NOTES\n");

  const service = new DocumentService();
  assert.match(service.initDocument("demo", target), /already exists/);
  assert.match(service.saveSection(1, "1", "Purpose", "replacement"), /No document loaded/);
  assert.equal(fs.readFileSync(target, "utf8"), "ORIGINAL NOTES\n");
});

test("load accepts only structurally valid .alps.xml documents", () => {
  const dir = temporaryDirectory();
  const textFile = path.join(dir, "notes.txt");
  const fakeAlps = path.join(dir, "notes.alps.xml");
  fs.writeFileSync(textFile, "plain text");
  fs.writeFileSync(fakeAlps, "plain text");

  const service = new DocumentService();
  const valid = path.join(dir, "valid.alps.xml");
  service.initDocument("valid", valid);
  assert.match(service.loadDocument(textFile), /must use the \.alps\.xml extension/);
  assert.match(service.loadDocument(fakeAlps), /Invalid ALPS document/);
  assert.match(service.saveSection(1, "1", "Purpose", "replacement"), /No document loaded/);
  assert.doesNotMatch(fs.readFileSync(valid, "utf8"), /replacement/);
});

test("template asset failures preserve the active document and its content", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "active.alps.xml");
  const service = new DocumentService();
  assert.match(service.initDocument("active", target), /Created ALPS document/);
  assert.match(service.saveSection(1, "1", "Purpose", "preserved"), /Saved 1\.1/);

  const emptyChapters = path.join(dir, "empty-chapters");
  const emptyGuides = path.join(dir, "empty-guides");
  fs.mkdirSync(emptyChapters);
  fs.mkdirSync(emptyGuides);
  const templates = new TemplateService({
    ...ALPS_PROFILE,
    chaptersDir: emptyChapters,
    guidesDir: emptyGuides,
  });
  const before = fs.readFileSync(target, "utf8");

  assert.equal(templates.getSectionGuide(1), "Section 1 not found.");
  assert.equal(templates.getSection(1), "Section 1 not found.");
  assert.equal(fs.readFileSync(target, "utf8"), before);
  assert.match(service.getStatus(), /ALPS Document: active/);
  assert.match(service.readSection(1, "1"), /preserved/);
});

test("XML-sensitive project names and Markdown content round-trip without data loss", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "safe.alps.xml");
  const service = new DocumentService();
  const content = 'literal </subsection> plus <tag attr="x"> & text';

  service.initDocument('A "quoted" & named project', target);
  const saveResult = service.saveSection(1, "1", "Purpose", content);
  assert.match(saveResult, /Saved 1\.1/);
  assert.doesNotMatch(saveResult, /literal|<tag/, "save receipt must not echo document content");
  assert.match(service.saveSection(1, "2", "Document Name", "Second value"), /Saved 1\.2/);
  assert.match(
    service.readSection(1, "1"),
    new RegExp(content.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );

  const raw = fs.readFileSync(target, "utf8");
  assert.match(raw, /project="A &quot;quoted&quot; &amp; named project"/);
  assert.match(raw, /literal &lt;\/subsection&gt; plus &lt;tag attr="x"&gt; &amp; text/);
});

test("save enforces template subsection IDs and titles", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "template.alps.xml");
  const service = new DocumentService();
  service.initDocument("demo", target);

  assert.match(service.saveSection(1, "99", "Purpose", "x"), /Unknown subsection 1\.99/);
  assert.match(service.saveSection(1, "1", "Wrong title", "x"), /must be "Purpose"/);
  assert.match(service.getStatus(), /Section 1 \(Overview\): ⬜ Not started/);
});

test("legacy Technology Stack content migrates to Architecture Constraints on save", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "legacy-architecture.alps.xml");
  const service = new DocumentService();
  service.initDocument("demo", target);

  const legacy = fs
    .readFileSync(target, "utf8")
    .replace(
      '<section id="4" title="High-Level Architecture">\n<!-- Not started -->\n</section>',
      '<section id="4" title="High-Level Architecture">\n<subsection id="4.2" title="Technology Stack">\nReact and Express\n</subsection>\n</section>',
    );
  fs.writeFileSync(target, legacy);

  const resumed = service.loadDocument(target);
  assert.match(resumed, /ALPS Document: demo/);
  assert.match(resumed, /DO NOT auto-generate content/);
  assert.match(
    service.saveSection(
      4,
      "2",
      "Architecture Constraints",
      "No additional durable constraints beyond Section 4.1.",
    ),
    /Saved 4\.2/,
  );
  const migrated = fs.readFileSync(target, "utf8");
  assert.match(migrated, /title="Architecture Constraints"/);
  assert.doesNotMatch(migrated, /Technology Stack|React|Express/);
});

test("Section 4.1 requires Context and Container as its only Mermaid diagram types", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "architecture.alps.xml");
  const service = new DocumentService();
  service.initDocument("demo", target);

  const contextOnly =
    '```mermaid\n%%{init: {"theme": "neutral"}}%%\n%% system boundary\nC4Context\nPerson(user, "User")\n```';
  assert.match(
    service.saveSection(4, "1", "System Diagram", contextOnly),
    /requires a Mermaid C4Container diagram/,
  );

  const componentAdded = `${contextOnly}

\`\`\`mermaid
C4Container
Container(app, "Application")
\`\`\`

\`\`\`mermaid
C4Component
Component(module, "Module")
\`\`\``;
  assert.match(
    service.saveSection(4, "1", "System Diagram", componentAdded),
    /allows only Mermaid C4Context and C4Container diagrams; found C4Component/,
  );

  const valid = `${contextOnly}

\`\`\`mermaid
C4Container
Container(app, "Application")
\`\`\``;
  assert.match(service.saveSection(4, "1", "System Diagram", valid), /Saved 4\.1/);
});

test("non-C4 diagrams remain valid outside Section 4.1", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "dependencies.alps.xml");
  const service = new DocumentService();
  service.initDocument("demo", target);

  assert.match(
    service.saveSection(
      6,
      "3",
      "Feature Dependency Diagram",
      "```mermaid\ngraph TD\nF2 --> F1\n```",
    ),
    /Saved 6\.3/,
  );
});

test("status uses required template coverage instead of content length", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "status.alps.xml");
  const registry = new TemplateRegistry();
  const service = new DocumentService(registry);
  service.initDocument("demo", target);

  service.saveSection(1, "1", "Purpose", "x".repeat(200));
  assert.match(service.getStatus(), /Section 1 \(Overview\): 🟡 In progress \(1\/7 subsections\)/);

  for (const definition of registry.expectedSubsections(1).slice(1)) {
    service.saveSection(1, definition.id.slice(2), definition.title, "complete");
  }
  assert.match(service.getStatus(), /Section 1 \(Overview\): ✅ Written \(7\/7 subsections\)/);
});

test("dynamic Section 7 status follows the feature count declared in Section 6.1", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "features.alps.xml");
  const service = new DocumentService();
  service.initDocument("demo", target);

  service.saveSection(
    6,
    "1",
    "Core Features (Functional Requirements)",
    "- F1: Login\n- F2: Logout",
  );
  assert.match(service.saveSection(7, "1", "Login", "feature one"), /Saved 7\.1/);
  assert.match(service.getStatus(), /Section 7 .*🟡 In progress \(1\/2 features\)/);
  assert.match(service.saveSection(7, "2", "Logout", "feature two"), /Saved 7\.2/);
  assert.match(service.getStatus(), /Section 7 .*✅ Written \(2\/2 features\)/);
});

test("Section 7 accepts Features with or without a Mermaid diagram and preserves diagrams on export", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "feature-diagrams.alps.xml");
  const service = new DocumentService();
  service.initDocument("demo", target);

  service.saveSection(
    6,
    "1",
    "Core Features (Functional Requirements)",
    "- F1: Plain flow\n- F2: Visual flow",
  );

  assert.match(
    service.saveSection(7, "1", "Plain flow", "A complete Feature explanation without a diagram."),
    /Saved 7\.1/,
  );

  const visualFlow = `A complete Feature explanation with an optional overview.

\`\`\`mermaid
sequenceDiagram
    actor User
    participant UI
    participant API
    participant Data
    User->>UI: Start action
    UI->>API: Send request
    API->>Data: Save conceptual data
    Data-->>API: Confirm save
    API-->>UI: Return result
\`\`\``;
  assert.match(service.saveSection(7, "2", "Visual flow", visualFlow), /Saved 7\.2/);

  const exported = service.exportMarkdown();
  assert.match(exported, /A complete Feature explanation without a diagram/);
  assert.match(exported, /```mermaid\s+sequenceDiagram/);
  assert.match(service.getStatus(), /Section 7 .*✅ Written \(2\/2 features\)/);
});

test("saving refuses to discard unrecognized legacy section content", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "legacy.alps.xml");
  const original = `<alps-document project="legacy">
<section id="1" title="Overview">
legacy free-form content that must survive
</section>
</alps-document>`;
  fs.writeFileSync(target, original);

  const service = new DocumentService();
  assert.match(service.loadDocument(target), /ALPS Document: legacy/);
  assert.match(service.saveSection(1, "1", "Purpose", "replacement"), /Cannot safely update/);
  assert.equal(fs.readFileSync(target, "utf8"), original);
});
