// The template registry decides which subsection IDs and titles alps_section
// accepts, so its reading of the chapter XML is a user-facing contract: a title it
// misreads is a title the author cannot save.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { CHAPTERS_DIR, LITE_CHAPTERS_DIR } from "../src/constants.js";
import { TemplateRegistry } from "../src/tools/templates/registry.js";

const temporaryDirectories: string[] = [];

// A copy of the shipped chapters with one subsection title rewritten, so the test
// exercises real templates rather than a stub whose shape could drift from them.
function chaptersWithTitle(section: number, subsectionId: string, title: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-registry-test-"));
  temporaryDirectories.push(dir);
  fs.cpSync(CHAPTERS_DIR, dir, { recursive: true });

  const file = fs
    .readdirSync(dir)
    .find((name) => name.startsWith(String(section).padStart(2, "0") + "-"));
  assert.ok(file, `no chapter file for section ${section}`);

  const full = path.join(dir, file);
  const source = fs.readFileSync(full, "utf8");
  const pattern = new RegExp(
    `(<subsection\\b[^>]*id="${subsectionId.replace(".", "\\.")}"[^>]*title=")([^"]*)(")`,
  );
  assert.match(source, pattern, `no subsection ${subsectionId} to rewrite`);
  fs.writeFileSync(full, source.replace(pattern, `$1${title}$3`));
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Regression: the registry used to read the title as raw markup while the
// document layer decoded it. A template title written with a legal XML entity
// then demanded the entity form back — validateSubsection rejected the
// "Risks & Limits" an author writes and reported that the title 'must be
// "Risks &amp; Limits"', which is not a string any author would type.
test("a template title written with an XML entity accepts the plain text it denotes", () => {
  const registry = new TemplateRegistry(chaptersWithTitle(9, "9.1", "Risks &amp; Limits"));

  const expected = registry.expectedSubsections(9).find((d) => d.id === "9.1");
  assert.equal(expected?.title, "Risks & Limits", "the registry must expose the decoded title");

  assert.deepEqual(registry.validateSubsection(9, "1", "Risks & Limits"), {
    ok: true,
    fullId: "9.1",
  });
});

test("every entity form is decoded, not just the ampersand", () => {
  const registry = new TemplateRegistry(
    chaptersWithTitle(9, "9.1", "&quot;Scope&quot; &lt;out&gt; &amp; &apos;in&apos;"),
  );

  assert.equal(
    registry.expectedSubsections(9).find((d) => d.id === "9.1")?.title,
    `"Scope" <out> & 'in'`,
  );
});

// The flip side: a title that merely looks like markup must still round-trip. The
// decode is a single pass, so "&amp;lt;" denotes the literal "&lt;" and must not
// be double-decoded into "<".
test("a single decode pass leaves an escaped entity literal intact", () => {
  const registry = new TemplateRegistry(chaptersWithTitle(9, "9.1", "Limit &amp;lt; 3s"));

  assert.equal(registry.expectedSubsections(9).find((d) => d.id === "9.1")?.title, "Limit &lt; 3s");
});

test("the shipped templates expose the titles the tools advertise", () => {
  const registry = new TemplateRegistry();

  // Section 7 is dynamic (one entry per feature), so it declares no fixed set.
  assert.deepEqual(registry.expectedSubsections(7), []);

  for (const section of [1, 2, 3, 4, 5, 6, 8, 9]) {
    const definitions = registry.expectedSubsections(section);
    assert.ok(definitions.length > 0, `section ${section} declares no subsections`);
    for (const { id, title, required } of definitions) {
      assert.ok(id.startsWith(`${section}.`), `${id} is not a section-${section} id`);
      assert.ok(title.trim(), `${id} has an empty title`);
      assert.equal(required, true, `${id} must remain required in Full ALPS`);
      // A title that still carries an entity means the decode did not happen.
      assert.doesNotMatch(title, /&(amp|lt|gt|quot|apos);/, `${id} title was not decoded`);
    }
  }

  assert.deepEqual(registry.validateSubsection(4, "2", "Architecture Constraints"), {
    ok: true,
    fullId: "4.2",
  });
  assert.deepEqual(registry.validateSubsection(4, "2", "Technology Stack"), {
    ok: false,
    message: 'Title for 4.2 must be "Architecture Constraints".',
  });
});

test("the Lite templates use fixed sections, keep Section 3 optional, and require Section 4", () => {
  const registry = new TemplateRegistry(LITE_CHAPTERS_DIR, null);

  assert.equal(
    registry.expectedSubsections(3).every((definition) => definition.required === false),
    true,
  );
  assert.equal(
    registry.expectedSubsections(4).every((definition) => definition.required === true),
    true,
  );
  assert.deepEqual(registry.validateSubsection(3, "1", "Excluded Users and Use Cases"), {
    ok: false,
    message: 'Title for 3.1 must be "Explicit Exclusions".',
  });
  assert.deepEqual(registry.validateSubsection(3, "1", "Explicit Exclusions"), {
    ok: true,
    fullId: "3.1",
  });
  assert.deepEqual(registry.validateSubsection(1, "1", "Target User and Core Problem"), {
    ok: true,
    fullId: "1.1",
  });
  assert.deepEqual(registry.validateSubsection(1, "2", "Desired Business Impact"), {
    ok: true,
    fullId: "1.2",
  });
  assert.deepEqual(registry.validateSubsection(1, "2", "Value and Key Assumption"), {
    ok: false,
    message: 'Title for 1.2 must be "Desired Business Impact".',
  });
  assert.deepEqual(registry.validateSubsection(2, "2", "Essential User Experiences"), {
    ok: true,
    fullId: "2.2",
  });
  assert.deepEqual(registry.validateSubsection(2, "2", "Required Acceptance Tests"), {
    ok: false,
    message: 'Title for 2.2 must be "Essential User Experiences".',
  });
  assert.deepEqual(registry.validateSubsection(4, "1", "Demo Scenario"), {
    ok: true,
    fullId: "4.1",
  });
  assert.deepEqual(registry.validateSubsection(4, "2", "Learning Check"), {
    ok: false,
    message: "Unknown subsection 4.2. Allowed subsection_id values: 1.",
  });
  const invalid = registry.validateSubsection(1, "1", "Purpose");
  assert.match(invalid.ok ? "" : invalid.message, /must be "Target User and Core Problem"/);
});
