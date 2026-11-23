import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LITE_ALPS_PROFILE } from "../src/profiles.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

function c4Declarations(source: string): string[] {
  return [...source.matchAll(/^C4[A-Za-z]+\s*$/gm)].map((match) => match[0].trim());
}

const expectedC4Levels = ["C4Context", "C4Container"];

test("Section 4 ships required Context and Container examples without lower C4 levels", () => {
  const template = read("src/templates/chapters/04-architecture.xml");
  const runtimeSection = new TemplateService().getSection(4, true);

  assert.deepEqual(c4Declarations(template), expectedC4Levels);
  assert.deepEqual(c4Declarations(runtimeSection), expectedC4Levels);
  assert.match(template, /Context diagram is required/);
  assert.match(template, /Container diagram is required/);
  assert.match(template, /only C4 levels allowed/);
  assert.doesNotMatch(template, /Container diagram is optional/);
});

test("the Section 4 guide requires both diagrams and keeps implementation detail out", () => {
  const guide = read("src/guides/04.md");
  const runtimeGuide = new TemplateService().getSectionGuide(4);

  for (const source of [guide, runtimeGuide]) {
    assert.deepEqual(c4Declarations(source), expectedC4Levels);
    assert.match(source, /MUST contain both/);
    assert.match(source, /only C4 levels ALPS uses/);
    assert.match(source, /modules, classes, functions, files, methods, libraries, or frameworks/);
    assert.match(source, /Architecture Constraints/);
    assert.match(source, /regenerated implementation must preserve/i);
    assert.match(source, /Do NOT save an AI-recommended technology stack/i);
    assert.doesNotMatch(source, /<tech_stack_wizard>|### 4\.2 Technology Stack/);
  }
});

test("Section 4.2 stores durable constraints instead of a recoverable technology inventory", () => {
  const template = read("src/templates/chapters/04-architecture.xml");
  const runtimeSection = new TemplateService().getSection(4, true);

  assert.match(template, /subsection id="4\.2" title="Architecture Constraints"/);
  assert.match(runtimeSection, /### 4\.2 Architecture Constraints/);
  for (const source of [template, runtimeSection]) {
    assert.match(source, /Scale assumption/);
    assert.match(source, /Data and security boundary/);
    assert.match(source, /Exclude replaceable frameworks, SDKs, ORMs/);
    assert.doesNotMatch(source, /React|Express|MongoDB|Tailwind|Technology Stack/);
  }
});

test("the overview and alps-init keep Context and Container as the only C4 levels", () => {
  const overview = read("src/templates/overview.md");
  const skill = read("skills/alps-init/SKILL.md");

  for (const source of [overview, skill]) {
    assert.match(source, /C4Context/);
    assert.match(source, /C4Container/);
    assert.match(source, /only C4 levels/);
    assert.match(source, /Component, Dynamic, Deployment, or Code-level/);
  }
});

test("Lite Business Context Diagram ships one business-wording Context without Container", () => {
  const template = read("src/templates/lite/chapters/03-functional-requirements.xml");
  const guide = read("src/guides/lite/03.md");
  const runtimeSection = new TemplateService(LITE_ALPS_PROFILE).getSection(3, true);

  assert.deepEqual(c4Declarations(template), ["C4Context"]);
  assert.deepEqual(c4Declarations(runtimeSection), ["C4Context"]);
  for (const source of [template, guide]) {
    assert.match(source, /Business Context Diagram/);
    assert.match(source, /exactly one Mermaid `C4Context`/i);
    assert.match(source, /business responsibility/i);
    assert.match(source, /C4Container/);
    assert.match(source, /APIs/);
    assert.match(source, /databases/i);
  }
});
