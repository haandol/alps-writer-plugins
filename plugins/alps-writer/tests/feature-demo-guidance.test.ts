import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CHAPTERS_DIR, GUIDES_DIR, SECTION_REFERENCES } from "../src/constants.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(CHAPTERS_DIR, "..", "..", "..");

test("Section 7 connects each Feature to Section 3 without a duplicate demo subsection", () => {
  assert.deepEqual(SECTION_REFERENCES[7], [3, 6]);

  const guide = fs.readFileSync(path.join(GUIDES_DIR, "07.md"), "utf8");
  assert.match(guide, /Section 3 \(Demo Scenario\)/);
  assert.match(guide, /Demo outcome/);
  assert.match(guide, /role in the Section 3/i);
  assert.match(guide, /observable completion result/i);
  assert.match(guide, /User Flow/);
  assert.match(guide, /Evaluation Rubric/);
  assert.match(guide, /derive|compose/i);
  assert.doesNotMatch(guide, /#### 7\.\d+\.7 Feature Demo/);

  const chapterFile = fs
    .readdirSync(CHAPTERS_DIR)
    .find((name) => name.startsWith("07-") && name.endsWith(".xml"));
  assert.ok(chapterFile);
  const chapter = fs.readFileSync(path.join(CHAPTERS_DIR, chapterFile), "utf8");
  assert.doesNotMatch(chapter, /id="7\.x\.7"/);
  assert.match(chapter, /Demo outcome/);
  assert.match(chapter, /role in the Section 3 end-to-end demo/i);
  assert.match(chapter, /observable completion result/i);
  assert.match(chapter, /Do not repeat preconditions, user actions, or failure scenarios/i);

  const skill = fs.readFileSync(path.join(PLUGIN_ROOT, "skills", "alps-init", "SKILL.md"), "utf8");
  assert.match(skill, /Review Section 3 and Section 6 first/);
  assert.match(skill, /Demo outcome/);
  assert.match(skill, /Evaluation Rubric/);
  assert.doesNotMatch(skill, /Every Feature must include a Feature Demo/);
});

test("the Section 7 runtime surfaces the Demo outcome and both dependencies", () => {
  const service = new TemplateService();
  const template = service.getSection(7, true);
  const guide = service.getSectionGuide(7);

  assert.match(template, /Demo outcome/);
  assert.doesNotMatch(template, /#### 7\.x\.7 Feature Demo/);
  assert.match(guide, /Section 3 \(Demo Scenario\), Section 6 \(Requirements Summary\)/);
  assert.match(guide, /read_alps_section\(3\), read_alps_section\(6\)/);
});
