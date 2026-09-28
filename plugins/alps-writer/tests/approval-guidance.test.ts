import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

test("approval guidance uses a contract-complete plain-text digest", () => {
  const sources = [
    read("src/index.ts"),
    read("skills/alps-init/SKILL.md"),
    read("src/templates/overview.md"),
  ];

  for (const source of sources) {
    assert.match(source, /plain-text approval digest/i);
    assert.match(source, /requirement (?:value|contract)/i);
    assert.match(source, /permission|권한/i);
    assert.match(source, /transition|전이/i);
    assert.match(source, /full pending content|전체 내용|전체 원문/i);
    assert.match(source, /absent from the (?:approval )?digest|digest에 없던/i);
    assert.match(source, /do not name omitted implementation details/i);
  }

  const overview = new TemplateService().getOverview();
  assert.match(overview, /readable as raw text/i);
  assert.match(overview, /approve, revise a named item, or defer/i);
  assert.doesNotMatch(overview, /print FULL section/i);
});

test("reference handling keeps durable contracts and drops source or code-recoverable detail", () => {
  const sources = [read("skills/alps-init/SKILL.md"), read("src/templates/overview.md")];

  for (const source of sources) {
    assert.match(source, /ephemeral input/i);
    assert.match(source, /product intent/i);
    assert.match(source, /observable behavior/i);
    assert.match(source, /durable boundar/i);
    assert.match(source, /ticket IDs?/i);
    assert.match(source, /logs/i);
    assert.match(source, /code paths?/i);
    assert.match(source, /implementation plans?/i);
    assert.match(source, /recoverable from code|code-recoverable/i);
  }

  for (const source of [
    read("skills/lite-alps-init/SKILL.md"),
    read("src/templates/lite/overview.md"),
  ]) {
    assert.match(source, /ephemeral input/i);
    assert.match(source, /target problem/i);
    assert.match(source, /Desired Business Impact/i);
    assert.match(source, /observable/i);
    assert.match(source, /source IDs?/i);
    assert.match(source, /logs/i);
    assert.match(source, /code paths?/i);
    assert.match(source, /implementation plans?/i);
    assert.match(source, /code-recoverable technology facts/i);
  }
});

test("Lite reuses Full's focused-question authoring without changing Full", () => {
  const fullSkill = read("skills/alps-init/SKILL.md");
  const fullOverview = read("src/templates/overview.md");
  const liteSkill = read("skills/lite-alps-init/SKILL.md");
  const liteOverview = read("src/templates/lite/overview.md");
  const server = read("src/index.ts");
  const documents = read("src/tools/documents/service.ts");

  assert.match(fullSkill, /ask one focused question or at most two closely related questions/i);
  assert.match(fullSkill, /only when required information is missing/i);
  assert.match(fullOverview, /Ask ONE or at most TWO focused questions/i);
  assert.doesNotMatch(`${fullSkill}\n${fullOverview}`, /inference-first|Ask ZERO/i);

  assert.match(liteSkill, /same conversational authoring flow as Full ALPS/i);
  assert.match(liteSkill, /Sections 2 and 4 start with AI proposals/i);
  assert.match(liteSkill, /ask only for unresolved protected product decisions/i);
  assert.match(liteOverview, /Ask one focused question, or at most two closely related questions/i);
  assert.match(server, /same conversational approval pattern as Full ALPS/i);
  assert.match(documents, /Ask 1-2 focused questions at a time/i);

  for (const guidePath of Array.from(
    { length: 4 },
    (_, index) => `src/guides/lite/${String(index + 1).padStart(2, "0")}.md`,
  )) {
    assert.match(read(guidePath), /<questions>/i, guidePath);
    assert.doesNotMatch(read(guidePath), /<inference_first>/i, guidePath);
  }
});

test("Section 7 keeps Feature-level save units and suggests splits at eight or higher", () => {
  const guide = new TemplateService().getSectionGuide(7);
  const skill = read("skills/alps-init/SKILL.md");

  for (const source of [guide, skill]) {
    assert.match(source, /8\/10.*or higher|8\/10.*이상/i);
    assert.match(source, /up to three|최대 세 개/i);
    assert.match(source, /(?:keep|keeping) the original Feature|원래 Feature/i);
    assert.match(source, /never blocks approval or saving|승인.*저장.*차단하지/i);
    assert.match(source, /independently (?:demonstrable|observable) user[-\s]+behavior/i);
    assert.match(source, /Section 6 and Section 7 Feature boundaries\s+together/i);
  }

  assert.match(guide, /Feature `7\.x` is one approval and save unit/i);
  assert.match(guide, /`7\.x\.1`-`7\.x\.6`/i);
});

test("Section 7 recommends optional Mermaid diagrams and explains Features for first-time junior developers", () => {
  const sources = [
    read("src/index.ts"),
    read("skills/alps-init/SKILL.md"),
    read("src/templates/overview.md"),
    new TemplateService().getSectionGuide(7),
    new TemplateService().getSection(7, true),
  ];

  for (const source of sources) {
    assert.match(source, /junior developer.*(?:first time|first)/is);
    assert.match(source, /unfamiliar.*(?:acronym|term).*first use/is);
    assert.match(source, /recommend.*Mermaid/is);
    assert.match(source, /sequenceDiagram/);
    assert.match(source, /optional|absence never blocks/is);
    assert.match(source, /modules?.*classes?.*functions?/is);
    assert.doesNotMatch(source, /every Feature must include (?:a )?Mermaid/i);
  }
});
