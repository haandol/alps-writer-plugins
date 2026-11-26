import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CHAPTERS_DIR, GUIDES_DIR, SECTION_REFERENCES } from "../src/constants.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(CHAPTERS_DIR, "..", "..", "..");

test("Section 7 connects each Feature to Section 3 without a duplicate demo subsection", () => {
  assert.deepEqual(SECTION_REFERENCES[7], [3, 5]);

  const guide = fs.readFileSync(path.join(GUIDES_DIR, "07.md"), "utf8");
  assert.match(guide, /Section 3 \(Demo Scenario\)/);
  assert.match(guide, /Demo outcome/);
  assert.match(guide, /role in the Section 3/i);
  assert.match(guide, /observable completion result/i);
  assert.match(guide, /User Flow/);
  assert.match(guide, /Evaluation Rubric/);
  assert.match(guide, /derive|compose/i);
  assert.doesNotMatch(guide, /#### 7\.\d+\.7 Feature Demo/);
  assert.match(
    guide,
    /Keep the Demo outcome consistent with this Feature's User Flow, Edge Cases, Error Handling, and Evaluation Rubric; if Section 3 conflicts with them, surface the conflict as an unresolved question in the approval digest/,
  );
  assert.match(
    guide,
    /do not include test files, deployment steps, PR boundaries, commits, libraries, or code structure/,
  );

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
  assert.match(chapter, /it is not another test or approval gate/);
  assert.match(
    chapter,
    /must agree with this Feature's User Flow, Edge Cases, Error Handling and Evaluation Rubric; surface a conflict with Section 3 before approval/,
  );

  const skill = fs.readFileSync(path.join(PLUGIN_ROOT, "skills", "alps-init", "SKILL.md"), "utf8");
  assert.match(skill, /Review Section 3 and Section 5 first/);
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
  assert.match(guide, /Section 3 \(Demo Scenario\), Section 5 \(Requirements Summary\)/);
  assert.match(
    guide,
    /alps_section\(action: 'read', doc_path, section: 3\), alps_section\(action: 'read', doc_path, section: 5\)/,
  );
});

test("every shipped Full writing surface names 7.x.6 Evaluation Rubric and Demo outcome, keeping legacy names read-only", () => {
  const index = fs.readFileSync(path.join(PLUGIN_ROOT, "src", "index.ts"), "utf8");
  const instructions = index.slice(index.indexOf("instructions: `"), index.indexOf("<TRIGGER>"));
  assert.match(
    instructions,
    /End each Feature's 7\.x\.6 Evaluation Rubric with exactly one Demo outcome sentence/,
  );
  assert.match(
    instructions,
    /role in the Section 3 end-to-end demo and its observable completion result/,
  );

  const overview = fs.readFileSync(
    path.join(PLUGIN_ROOT, "src", "templates", "overview.md"),
    "utf8",
  );
  assert.match(
    overview,
    /For Section 7, ALWAYS review Sections 3 and 5 first and include one Demo outcome/,
  );

  const surfaces = [
    path.join("src", "index.ts"),
    path.join("src", "templates", "overview.md"),
    path.join("src", "guides", "07.md"),
    path.join("src", "templates", "chapters", "07-feature-spec.xml"),
    path.join("skills", "alps-init", "SKILL.md"),
  ];
  for (const file of surfaces) {
    const sentences = fs
      .readFileSync(path.join(PLUGIN_ROOT, file), "utf8")
      .split(/(?<=[.;])\s+|\n/)
      .filter((sentence) => /Acceptance Criteria|Demo checkpoint/.test(sentence));
    for (const sentence of sentences)
      assert.match(sentence, /legacy|existing/i, `${file} authors with a legacy name: ${sentence}`);
  }
});

test("Full Section 2 and 8 guides propose a tension for every KPI outside the Lite block", () => {
  const fullPart = (section: string) => {
    const text = fs.readFileSync(path.join(GUIDES_DIR, `${section}.md`), "utf8");
    return text.slice(0, text.indexOf("<lite_source>"));
  };
  const goals = fullPart("02");
  assert.match(
    goals,
    /for every KPI, always derive a scenario that reaches its target while defeating the purpose/,
  );
  assert.match(
    goals,
    /propose a tension metric that protects the same purpose and worsens in that scenario/,
  );
  assert.match(
    goals,
    /An adopted tension is monitoring-only unless the user confirms it as a required success condition/,
  );
  assert.match(goals, /keep the tension and its reporting out of the success condition/);
  const lines = goals.slice(goals.indexOf("### 2.2"), goals.indexOf("</example>")).split("\n");
  const kpis = lines.flatMap((line, i) => (/^- .+: \*\*/.test(line) ? [i] : []));
  assert.ok(kpis.length >= 2);
  for (const i of kpis)
    assert.match(lines[i + 1] ?? "", /^ {2}- Tension: .+\. .+/, `${lines[i]} has no tension`);

  const metrics = fullPart("08");
  assert.match(
    metrics,
    /Carry every tension metric from Section 2 together with the KPI it protects/,
  );
  assert.match(metrics, /a monitoring-only tension needs no target/);
  assert.match(
    metrics,
    /If a KPI here has no proposed tension yet, propose one from its abuse or opposite-failure scenario/,
  );
  const kpiRows = metrics
    .split("\n")
    .filter((line) => line.startsWith("|") && /Section 2 [\w-]+ KPI/.test(line));
  assert.ok(kpiRows.length >= 2);
  for (const row of kpiRows) assert.match(row, /tension for /, `${row.trim()} has no tension pair`);
});
