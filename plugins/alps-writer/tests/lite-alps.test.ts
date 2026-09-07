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

function liteSolutionStrategy(): string {
  return `Minimum product-level approach.

#### Product Context Diagram

\`\`\`mermaid
C4Context
Person(user, "Target User")
System(product, "PoC System")
Rel(user, product, "Uses")
\`\`\``;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Lite ALPS exposes business-impact and essential-experience names", () => {
  assert.deepEqual(LITE_SECTION_NUMBERS, [1, 2, 3, 4]);
  assert.deepEqual(Object.values(LITE_SECTION_TITLES), [
    "Overview",
    "Solution and Essential User Experiences",
    "Out of Scope",
    "Demo Scenario",
  ]);

  const template = new TemplateService(LITE_ALPS_PROFILE);
  assert.equal(template.listSections().length, 4);
  assert.match(template.getOverview(), /1 → 2 → 3 → 4/);
  assert.match(template.getOverview(), /Section 3 is optional/i);
  assert.match(template.getOverview(), /Section 4 is required/i);
  assert.match(template.getSection(1), /1\.2 Desired Business Impact/);
  assert.match(template.getSection(2), /2\.1 Solution Strategy/);
  assert.match(template.getSection(2), /2\.2 Essential User Experiences/);
  assert.match(template.getSection(3), /3\.1 Explicit Exclusions \(Optional\)/);
  assert.match(template.getSection(4), /4\.1 Demo Scenario/);
  assert.doesNotMatch(template.getSection(4), /4\.2|Learning Check/);
  assert.match(template.getSectionGuide(4), /Section 1 .*Section 2/s);
});

test("Full and Lite ALPS use one same-named Demo Scenario subsection", () => {
  const fullDemo = new TemplateService().getSection(3);
  const liteDemo = new TemplateService(LITE_ALPS_PROFILE).getSection(4);

  assert.match(fullDemo, /3\.1 Demo Scenario/);
  assert.doesNotMatch(fullDemo, /3\.2/);
  assert.match(liteDemo, /4\.1 Demo Scenario/);
  assert.doesNotMatch(liteDemo, /4\.2|Learning Check/);
  assert.match(liteDemo, /visible expected result/i);
  assert.match(liteDemo, /overall pass result/i);
});

test("Lite templates add product context without crossing into implementation architecture", () => {
  const source = fs
    .readdirSync(LITE_CHAPTERS_DIR)
    .filter((name) => name.endsWith(".xml"))
    .map((name) => fs.readFileSync(path.join(LITE_CHAPTERS_DIR, name), "utf8"))
    .join("\n");

  assert.match(source, /Product Context Diagram/);
  assert.match(source, /C4Context/);
  assert.doesNotMatch(source, /Technology Stack|Technical Description/);
  assert.doesNotMatch(source, /^C4Container$/m);
  assert.doesNotMatch(source, /\bAPI\b|\bDatabase\b|UI\s*→\s*API/i);
  assert.doesNotMatch(source, /\bF\d+\b|State Matrix/i);
  assert.match(source, /Do not assign Feature IDs/i);
  assert.match(source, /Desired Business Impact/);
  assert.match(source, /Solution Strategy/);
  assert.match(source, /Essential User Experiences/);
  assert.doesNotMatch(source, /Required Acceptance Tests/);
  assert.match(source, /Demo Scenario/);
  assert.doesNotMatch(source, /Core User Flow/);
  assert.doesNotMatch(source, /Learning Check/);
});

test("optional Out of Scope does not block required Demo Scenario completion", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "minimum-poc.lite.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("minimum-poc", target, "lite"), /Created Lite ALPS/);

  const requiredBySection: Record<number, [string, string][]> = {
    1: [
      ["1", "Target User and Core Problem"],
      ["2", "Desired Business Impact"],
    ],
    2: [
      ["1", "Solution Strategy"],
      ["2", "Essential User Experiences"],
    ],
    4: [["1", "Demo Scenario"]],
  };

  for (const [section, subsections] of Object.entries(requiredBySection)) {
    for (const [id, title] of subsections) {
      const content = Number(section) === 2 && id === "1" ? liteSolutionStrategy() : "confirmed";
      assert.match(service.saveSection(Number(section), id, title, content), /Saved/);
    }
  }

  const status = service.getStatus();
  assert.match(status, /Section 1 .*✅ Written \(2\/2 subsections\)/);
  assert.match(status, /Section 2 .*✅ Written \(2\/2 subsections\)/);
  assert.match(status, /Section 3 .*Optional — not written/);
  assert.match(status, /Section 4 .*✅ Written \(1\/1 subsections\)/);
  const exportWithoutExclusions = service.exportMarkdown();
  assert.doesNotMatch(exportWithoutExclusions, /## Section 3\. Out of Scope/);
  assert.doesNotMatch(exportWithoutExclusions, /Not yet written/);
  assert.match(exportWithoutExclusions, /## Section 4\. Demo Scenario/);

  assert.match(
    service.saveSection(3, "1", "Explicit Exclusions", "Explicitly excluded"),
    /Saved 3\.1/,
  );
  assert.match(service.getStatus(), /Section 3 .*✅ Written \(1 optional subsection\)/);
  assert.match(service.exportMarkdown(), /## Section 3\. Out of Scope/);
});

test("Lite Solution Strategy requires exactly one Context and rejects lower C4 levels", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "context.lite.alps.xml");
  const service = new DocumentService();
  service.initDocument("context", target, "lite");

  assert.match(
    service.saveSection(2, "1", "Solution Strategy", "Text only"),
    /requires exactly one Mermaid C4Context diagram/,
  );

  const duplicate = `${liteSolutionStrategy()}

\`\`\`mermaid
C4Context
System(other, "Other System")
\`\`\``;
  assert.match(
    service.saveSection(2, "1", "Solution Strategy", duplicate),
    /requires exactly one Mermaid C4Context diagram/,
  );

  const containerAdded = `${liteSolutionStrategy()}

\`\`\`mermaid
C4Container
Container(app, "Application")
\`\`\``;
  assert.match(
    service.saveSection(2, "1", "Solution Strategy", containerAdded),
    /allows only Mermaid C4Context diagrams; found C4Container/,
  );

  assert.match(
    service.saveSection(2, "1", "Solution Strategy", liteSolutionStrategy()),
    /Saved 2\.1/,
  );
});

test("Lite documents initialize, validate, resume, and export independently from Full ALPS", () => {
  const dir = temporaryDirectory();
  const liteTarget = path.join(dir, "product.lite.alps.xml");
  const fullTarget = path.join(dir, "product.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("product", liteTarget, "lite"), /Created Lite ALPS document/);
  const rawLite = fs.readFileSync(liteTarget, "utf8");
  assert.match(rawLite, /<alps-document project="product" profile="lite">/);
  assert.equal([...rawLite.matchAll(/<section id="/g)].length, 4);
  assert.match(rawLite, /title="Overview"/);
  assert.match(rawLite, /title="Demo Scenario"/);
  assert.match(service.getStatus(), /Lite ALPS Document: product/);
  assert.doesNotMatch(service.getStatus(), /Section 5/);

  assert.match(
    service.saveSection(1, "1", "Target User and Core Problem", "Adult English learner"),
    /Saved 1\.1/,
  );
  const beforeInvalid = fs.readFileSync(liteTarget, "utf8");
  assert.match(service.saveSection(5, "1", "Anything", "x"), /Must be 1-4 for Lite ALPS/);
  assert.match(
    service.saveSection(1, "1", "Product Name", "wrong current title"),
    /must be "Target User and Core Problem"/,
  );
  assert.equal(fs.readFileSync(liteTarget, "utf8"), beforeInvalid);
  assert.match(service.exportMarkdown(), /^# product Lite ALPS/m);
  assert.doesNotMatch(service.exportMarkdown(), /## Section 3\. Out of Scope/);
  assert.match(service.exportMarkdown(), /## Section 4\. Demo Scenario/);

  const resumed = new DocumentService();
  const resumeGuidance = resumed.loadDocument(liteTarget);
  assert.match(resumeGuidance, /get_lite_alps_section_guide/);
  assert.match(resumeGuidance, /propose Sections 2 and 4 before asking the user to design them/i);
  assert.match(resumeGuidance, /missing user-owned or protected context/i);
  assert.doesNotMatch(resumeGuidance, /DO NOT auto-generate content/);

  const full = new DocumentService();
  assert.match(full.initDocument("product", fullTarget), /Created ALPS document/);
  assert.match(full.getStatus(), /Section 9 \(Out of Scope\)/);
  assert.match(full.saveSection(1, "1", "Purpose", "Full ALPS remains independent"), /Saved 1\.1/);
  assert.doesNotMatch(fs.readFileSync(liteTarget, "utf8"), /Full ALPS remains independent/);
});

test("former Lite formats are rejected without modifying the original document", () => {
  const dir = temporaryDirectory();
  const formerFourPath = path.join(dir, "former-four.lite.alps.xml");
  const formerEightPath = path.join(dir, "former-eight.lite.alps.xml");
  const formerCurrentPath = path.join(dir, "former-current.lite.alps.xml");
  const formerFour = liteDocument("former-four", ["Why", "How", "What Not to Do", "Demo Scenario"]);
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
  const formerCurrent = liteDocument("former-current", [
    "Overview",
    "Solution and Acceptance Tests",
    "Out of Scope",
    "Demo Scenario",
  ]);
  fs.writeFileSync(formerFourPath, formerFour);
  fs.writeFileSync(formerEightPath, formerEight);
  fs.writeFileSync(formerCurrentPath, formerCurrent);

  const service = new DocumentService();
  assert.match(service.loadDocument(formerFourPath), /Section 1 title must be "Overview"/);
  assert.equal(fs.readFileSync(formerFourPath, "utf8"), formerFour);
  assert.match(service.loadDocument(formerEightPath), /must contain Sections 1-4/);
  assert.equal(fs.readFileSync(formerEightPath, "utf8"), formerEight);
  assert.match(
    service.loadDocument(formerCurrentPath),
    /Section 2 title must be "Solution and Essential User Experiences"/,
  );
  assert.equal(fs.readFileSync(formerCurrentPath, "utf8"), formerCurrent);
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
        section(1, "Overview", NOT_STARTED),
        section(
          1,
          "Overview",
          '<subsection id="1.1" title="Problem Context">old content</subsection>',
        ),
      ),
      error: /Title for 1\.1 must be "Target User and Core Problem"/,
    },
    {
      name: "former-assumption-title",
      content: base.replace(
        section(1, "Overview", NOT_STARTED),
        section(
          1,
          "Overview",
          '<subsection id="1.2" title="Value and Key Assumption">old content</subsection>',
        ),
      ),
      error: /Title for 1\.2 must be "Desired Business Impact"/,
    },
    {
      name: "former-acceptance-title",
      content: base.replace(
        section(2, "Solution and Essential User Experiences", NOT_STARTED),
        section(
          2,
          "Solution and Essential User Experiences",
          '<subsection id="2.2" title="Required Acceptance Tests">old content</subsection>',
        ),
      ),
      error: /Title for 2\.2 must be "Essential User Experiences"/,
    },
    {
      name: "unknown-id",
      content: base.replace(
        section(3, "Out of Scope", NOT_STARTED),
        section(3, "Out of Scope", '<subsection id="3.9" title="Wrong">old content</subsection>'),
      ),
      error: /Unknown subsection 3\.9/,
    },
    {
      name: "duplicate-id",
      content: base.replace(
        section(4, "Demo Scenario", NOT_STARTED),
        section(
          4,
          "Demo Scenario",
          [
            '<subsection id="4.1" title="Demo Scenario">first</subsection>',
            '<subsection id="4.1" title="Demo Scenario">second</subsection>',
          ].join("\n"),
        ),
      ),
      error: /subsection 4\.1 must appear exactly once/,
    },
  ];

  for (const testCase of cases) {
    const target = path.join(dir, `${testCase.name}.lite.alps.xml`);
    fs.writeFileSync(target, testCase.content);

    const service = new DocumentService();
    assert.match(service.loadDocument(target), testCase.error);
    assert.equal(fs.readFileSync(target, "utf8"), testCase.content);
    assert.match(service.getStatus(), /No document loaded/);
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

  assert.match(
    service.initDocument("lite", wrongLitePath, "lite"),
    /must use the \.lite\.alps\.xml extension/,
  );
  assert.equal(fs.existsSync(wrongLitePath), false);
  assert.match(service.initDocument("full", wrongFullPath), /must use the \.alps\.xml extension/);
  assert.equal(fs.existsSync(wrongFullPath), false);

  fs.writeFileSync(
    wrongShapePath,
    '<alps-document project="mismatch" profile="lite"><section id="1" title="Overview"><!-- Not started --></section></alps-document>',
  );
  const wrongShape = fs.readFileSync(wrongShapePath, "utf8");
  assert.match(service.loadDocument(wrongShapePath), /must contain Sections 1-4/);
  assert.equal(fs.readFileSync(wrongShapePath, "utf8"), wrongShape);

  assert.match(service.initDocument("lite", wrongTitlePath, "lite"), /Created Lite ALPS/);
  const wrongTitle = fs
    .readFileSync(wrongTitlePath, "utf8")
    .replace('title="Overview"', 'title="Product Overview"');
  fs.writeFileSync(wrongTitlePath, wrongTitle);
  assert.match(service.loadDocument(wrongTitlePath), /Section 1 title must be "Overview"/);
  assert.equal(fs.readFileSync(wrongTitlePath, "utf8"), wrongTitle);

  assert.match(service.initDocument("lite", wrongOrderPath, "lite"), /Created Lite ALPS/);
  const wrongOrder = fs
    .readFileSync(wrongOrderPath, "utf8")
    .replace('<section id="2"', '<section id="1"');
  fs.writeFileSync(wrongOrderPath, wrongOrder);
  assert.match(service.loadDocument(wrongOrderPath), /must contain Sections 1-4/);
  assert.equal(fs.readFileSync(wrongOrderPath, "utf8"), wrongOrder);
});

test("Lite guidance works backward from Desired Business Impact through Essential User Experiences", () => {
  const skill = fs.readFileSync(
    path.join(PACKAGE_ROOT, "skills", "lite-alps-init", "SKILL.md"),
    "utf8",
  );
  const runtime = fs.readFileSync(path.join(PACKAGE_ROOT, "src", "index.ts"), "utf8");
  const overview = fs.readFileSync(
    path.join(PACKAGE_ROOT, "src", "templates", "lite", "overview.md"),
    "utf8",
  );
  const guides = [1, 2, 3, 4]
    .map((section) =>
      fs.readFileSync(
        path.join(PACKAGE_ROOT, "src", "guides", "lite", `${String(section).padStart(2, "0")}.md`),
        "utf8",
      ),
    )
    .join("\n");

  for (const source of [skill, runtime, overview]) {
    assert.match(source, /Overview/);
    assert.match(source, /Solution and Essential User Experiences/);
    assert.match(source, /Out of Scope/);
    assert.match(source, /Demo Scenario/);
    assert.match(source, /Target User and Core Problem/);
    assert.match(source, /Desired Business Impact/);
    assert.match(source, /Essential User Experiences/);
    assert.match(source, /4\.1 Demo Scenario/);
    assert.doesNotMatch(source, /Required Acceptance Tests/);
    assert.match(source, /same conversational|same interaction|follows Full ALPS/i);
    assert.match(source, /independent|separate document/i);
  }

  assert.match(skill, /1 → 2 → 3 → 4/);
  assert.match(skill, /Section 3 is optional/i);
  assert.match(skill, /Sections 1, 2, and 4 are required/i);
  assert.doesNotMatch(skill, /Legacy Lite ALPS|convert it automatically/i);
  assert.doesNotMatch(skill, /start a separate Full ALPS|use the Lite document as a reference/i);
  assert.match(guides, /exactly one Mermaid `C4Context`/i);
  assert.match(guides, /target user, the PoC system, relevant external systems/i);
  assert.match(guides, /Do not generate `C4Container`/i);
  assert.doesNotMatch(guides, /technology stack wizard/i);
  assert.doesNotMatch(guides, /Full ALPS/i);
  assert.doesNotMatch(guides, /Required Acceptance Tests|acceptance tests/i);
  assert.match(guides, /Do not invent non-goals/i);
  assert.match(guides, /overall pass result/i);
  assert.match(guides, /Do not require a separate Learning Check/i);
  assert.match(guides, /without a dedicated question/i);
  assert.match(guides, /proof of business impact or market validity/i);
  assert.match(guides, /Work backward|Reverse-engineer/i);
  assert.match(guides, /Draft the smallest product-level Solution Strategy/i);
  assert.match(guides, /Do not ask the user to supply a starting condition/i);
  assert.match(guides, /Propose a concrete starting state/i);
  assert.match(guides, /complete generated scenario and its experience coverage/i);
});

test("Section 2 owns essential experiences while Section 4 owns the concrete demo method", () => {
  const experienceTemplate = fs.readFileSync(
    path.join(
      PACKAGE_ROOT,
      "src",
      "templates",
      "lite",
      "chapters",
      "02-solution-and-essential-user-experiences.xml",
    ),
    "utf8",
  );
  const demoTemplate = fs.readFileSync(
    path.join(PACKAGE_ROOT, "src", "templates", "lite", "chapters", "04-demo-scenario.xml"),
    "utf8",
  );

  assert.match(
    experienceTemplate,
    /Essential user experience.*User-observable result.*Business impact contribution/s,
  );
  assert.doesNotMatch(experienceTemplate, /Required Acceptance Tests/);
  assert.doesNotMatch(experienceTemplate, /\| Essential user experience \| Starting condition \|/);
  assert.match(experienceTemplate, /Topic-specific practice begins/);
  assert.match(experienceTemplate, /The conversation adapts to the learner/);
  assert.match(experienceTemplate, /The learner controls the session/);
  assert.doesNotMatch(experienceTemplate, /Core User Flow/);

  assert.match(demoTemplate, /Work backward.*every experience/is);
  assert.match(demoTemplate, /concrete starting state.*representative demo input.*user actions/is);
  assert.match(demoTemplate, /Demonstrates essential experience/);
  assert.match(demoTemplate, /All three Essential User Experiences are observable/);
  assert.match(demoTemplate, /Business impact connection/i);
  assert.match(demoTemplate, /not as proof of business impact or market validity/i);
});

test("Lite Section 1 asks for business impact without pulling demo design forward", () => {
  const runtime = fs.readFileSync(path.join(PACKAGE_ROOT, "src", "index.ts"), "utf8");
  const skill = fs.readFileSync(
    path.join(PACKAGE_ROOT, "skills", "lite-alps-init", "SKILL.md"),
    "utf8",
  );
  const overview = fs.readFileSync(
    path.join(PACKAGE_ROOT, "src", "templates", "lite", "overview.md"),
    "utf8",
  );
  const guide = fs.readFileSync(path.join(PACKAGE_ROOT, "src", "guides", "lite", "01.md"), "utf8");
  const chapter = fs.readFileSync(
    path.join(PACKAGE_ROOT, "src", "templates", "lite", "chapters", "01-overview.xml"),
    "utf8",
  );

  assert.match(runtime, /same conversational approval pattern as Full ALPS/i);
  assert.doesNotMatch(
    runtime,
    /Ask 1-2 focused questions at a time - DO NOT auto-generate content/,
  );
  assert.match(skill, /ask one focused question or at most two closely related\s+questions/i);
  assert.match(overview, /Ask one focused question, or at most two closely related questions/i);
  assert.match(guide, /Who is the main target user, and what core problem/i);
  assert.match(guide, /What final business impact should that user gain/i);
  assert.match(guide, /Do not ask for a solution, screen, starting state/i);
  assert.match(chapter, /Identify the main target user and the core problem/i);
  assert.match(chapter, /final business impact/i);

  for (const source of [runtime, skill, overview, guide, chapter]) {
    assert.doesNotMatch(source, /concrete hypothetical|Primary Persona/i);
  }
});

test("Lite Section 2 proposes the solution and essential experiences before asking questions", () => {
  const guide = fs.readFileSync(path.join(PACKAGE_ROOT, "src", "guides", "lite", "02.md"), "utf8");
  const chapter = fs.readFileSync(
    path.join(
      PACKAGE_ROOT,
      "src",
      "templates",
      "lite",
      "chapters",
      "02-solution-and-essential-user-experiences.xml",
    ),
    "utf8",
  );

  assert.match(guide, /Draft the smallest product-level Solution Strategy/i);
  assert.match(guide, /Essential User Experience/i);
  assert.match(guide, /before asking the user to design either one/i);
  assert.match(guide, /exactly one Mermaid `C4Context`/i);
  assert.match(guide, /text Solution Strategy must remain independently reviewable/i);
  assert.match(guide, /Do not generate `C4Container`/i);
  assert.match(
    guide,
    /Ask one focused question only when multiple valid\s+choices would change money/i,
  );
  assert.doesNotMatch(guide, /What is the smallest product-level solution/i);
  assert.doesNotMatch(guide, /what starts it, what does the user do/i);
  assert.match(chapter, /Present the proposal for revision or approval/i);
  assert.match(chapter, /Product Context Diagram/i);
  assert.match(chapter, /C4Context/);
  assert.doesNotMatch(chapter, /^C4Container$/m);
  assert.match(chapter, /Section 4 owns those execution choices/i);
});

test("only the current four-section Lite assets are shipped", () => {
  assert.equal(fs.readdirSync(LITE_CHAPTERS_DIR).filter((name) => name.endsWith(".xml")).length, 4);
  assert.equal(
    fs.existsSync(
      path.join(
        PACKAGE_ROOT,
        "src",
        "templates",
        "lite",
        "chapters",
        "02-solution-and-acceptance-tests.xml",
      ),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        PACKAGE_ROOT,
        "src",
        "templates",
        "lite",
        "chapters",
        "02-solution-and-user-flow.xml",
      ),
    ),
    false,
  );
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "src", "templates", "lite", "legacy")), false);
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "src", "guides", "lite", "legacy")), false);
});
