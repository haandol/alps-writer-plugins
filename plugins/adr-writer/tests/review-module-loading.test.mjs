import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { skillText, agentText } from "../evals/lib/harness.mjs";
import { withTmp } from "./helpers.mjs";
import passScenario from "../evals/scenarios/impl-review-evidence-package-pass.mjs";
import unverifiedScenario from "../evals/scenarios/impl-review-evidence-package-unverified.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const prefix = "skills/adr-impl-review/references/";
const read = (file) => readFileSync(path.join(root, file), "utf8");
const modulePath = (name) => `${prefix}${name}.md`;
const body = (name) => read(modulePath(name));
const optional = [
  "artifact-example",
  "quiz-artifact",
  "interactive-check",
  "repair-guide",
  "requested-browser-qa",
];

for (const [name, selected, absent] of [
  ["PASS without quiz", ["artifact-contract", "artifact-schema"], optional],
  [
    "quiz included",
    ["artifact-contract", "artifact-schema", "quiz-artifact"],
    optional.filter((n) => n !== "quiz-artifact"),
  ],
  [
    "explicit interactive request",
    ["artifact-contract", "interactive-check", "quiz-artifact"],
    ["artifact-schema", "artifact-example", "repair-guide", "requested-browser-qa"],
  ],
  [
    "FIX_REQUIRED or BLOCK repair",
    ["artifact-contract", "artifact-schema", "repair-guide"],
    optional.filter((n) => n !== "repair-guide"),
  ],
  [
    "requested browser QA",
    ["artifact-contract", "visualization", "requested-browser-qa"],
    ["artifact-schema", "artifact-example", "quiz-artifact", "interactive-check", "repair-guide"],
  ],
  [
    "worked serialization example",
    ["artifact-contract", "artifact-schema", "artifact-example"],
    optional.filter((n) => n !== "artifact-example"),
  ],
]) {
  test(`review module selection: ${name}`, () => {
    const prompt = skillText("adr-impl-review", { references: selected.map(modulePath) });
    for (const item of selected) assert.ok(prompt.includes(body(item)), `missing ${item}`);
    for (const item of absent) assert.ok(!prompt.includes(body(item)), `eagerly loaded ${item}`);
    assert.ok(
      !prompt.includes(body("full-review")),
      "delivery must not implicitly rerun full mode",
    );
    assert.ok(
      !prompt.includes(body("remediation-routing")),
      "repair content does not grant caller mutations",
    );
  });
}

test("review entry and delivery spine state conditional loads without embedding their branches", () => {
  const core = skillText("adr-impl-review");
  const spine = body("artifact-contract");
  assert.match(core, /Only after evidence synthesis and verdict selection, read/);
  for (const name of ["artifact-contract", "artifact-schema", ...optional])
    assert.ok(!core.includes(body(name)), `${name} belongs after scope discovery`);
  assert.match(spine, /Writing or repairing native artifacts/);
  assert.match(spine, /Quiz included/);
  assert.match(spine, /Without a quiz, omit its data and section without approval/);
  assert.match(spine, /only for `FIX_REQUIRED`,\s+`BLOCK`, or requested detailed repair guidance/);
  assert.match(spine, /only when the user asks to run it/);
  assert.match(
    body("visualization"),
    /Only when browser, interaction, viewport or print QA is explicitly requested/,
  );
  assert.match(body("requested-browser-qa"), /common delivery owner.*format-and-layout\.md/);
  assert.match(
    body("requested-browser-qa"),
    /Do not start automation merely to deliver one local HTML file/,
  );
  assert.ok(
    spine.split("\n").length < 160,
    "delivery spine must stay smaller than its serialization branches",
  );
});

test("children require a reachable parent and direct writer use selects the same owners", () => {
  assert.throws(
    () => skillText("adr-impl-review", { references: [modulePath("artifact-example")] }),
    /not directly referenced/,
  );
  const selected = ["artifact-contract", "artifact-schema", "review-hiking", "evidence-synthesis"];
  const writer = agentText("adr-impl-review-report-writer", {
    references: selected.map(modulePath),
  });
  for (const name of selected) assert.ok(writer.includes(body(name)));
  for (const name of optional) assert.ok(!writer.includes(body(name)));
  assert.match(body("evidence-synthesis"), /native schema.*artifact-schema\.md/);
  assert.match(
    body("evidence-synthesis"),
    /Optional wording never makes substantive evidence optional/,
  );
  assert.doesNotMatch(body("evidence-synthesis"), /Keep non-empty `whyItMatters`/);
  assert.match(
    body("artifact-schema"),
    /`editTargets`, and `completionCriteria` are optional precision fields/,
  );
  assert.match(
    body("review-hiking"),
    /unchanged contract-critical callee may use `excerpt` alongside/,
  );
  assert.doesNotMatch(writer, /Use `excerpt` only when.*no change diff/s);
});

test("review and direct writer loads preserve exact contract comparison through synthesis", () => {
  const synthesis = body("evidence-synthesis");
  for (const prompt of [
    skillText("adr-impl-review", { references: [modulePath("evidence-synthesis")] }),
    agentText("adr-impl-review-report-writer", {
      references: [modulePath("evidence-synthesis")],
    }),
  ]) {
    assert.ok(prompt.includes(synthesis));
    assert.match(prompt, /Contract compliance/);
    assert.match(
      prompt,
      /every recorded\s+value, allowed set, transition, permission, mandatory field, ordering rule,\s+uniqueness rule, and unit against the actual code/,
    );
    assert.match(prompt, /Similar logic is not enough\s+when its value or rule differs/);
    assert.match(prompt, /the report must not summarize away a mismatch/);
  }
});

test("quiz, interaction and remediation keep publishing gates separate from verdict and delivery", () => {
  const quiz = body("quiz-artifact");
  const interactive = body("interactive-check");
  const routing = body("remediation-routing");
  assert.match(
    quiz,
    /only an explicitly selected user\/team quiz gate requires every prepared\s+question to pass/,
  );
  assert.match(quiz, /Do not infer a publishing gate from a quiz request/);
  assert.match(quiz, /Do not infer permission to start an interactive quiz from gate/);
  assert.match(quiz, /only the visible prompts and four options/);
  assert.match(interactive, /without praise, celebration, scoring, grading, or ability judgment/);
  assert.match(
    interactive,
    /HTML self-check does not\s+establish comprehension readiness or satisfy the opt-in publishing gate/,
  );
  assert.match(interactive, /Do not persist quiz progress or pass\/fail state/);
  assert.match(
    routing,
    /unverified or failed comprehension does not block PR publishing by default/,
  );
  assert.match(routing, /user authorization and repository checks remain required/);
  assert.doesNotMatch(routing, /still governs\s+whether the human should open or send the PR/);
});

test("all review-owned module and role references resolve, including inline plugin paths", () => {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = read(file).replace(/```[\s\S]*?```/g, "");
    const references = [
      ...source.matchAll(/\[[^\]]+\]\(([^()\s]+\.md)(?:#[^()\s]*)?\)/g),
      ...source.matchAll(/`(\$\{CLAUDE_PLUGIN_ROOT\}\/[^`\n]+\.md)`/g),
    ];
    for (const [, target] of references) {
      if (/^[a-z]+:/i.test(target)) continue;
      const resolved = target.startsWith("${CLAUDE_PLUGIN_ROOT}/")
        ? path.join(root, target.slice("${CLAUDE_PLUGIN_ROOT}/".length))
        : path.resolve(root, path.dirname(file), target);
      assert.ok(existsSync(resolved), `${file}: broken ${target}`);
      const relative = path.relative(root, resolved);
      if (relative.startsWith(prefix)) visit(relative);
    }
  }
  visit("skills/adr-impl-review/SKILL.md");
  visit("agents/adr-impl-review-report-writer.md");
  for (const name of ["artifact-contract", "artifact-schema", ...optional])
    assert.ok(seen.has(modulePath(name)), `${name} is unreachable`);
});

test("artifact scenario builders explicitly load relocated quiz/schema instructions without optional actions", () => {
  for (const scenario of [passScenario, unverifiedScenario]) {
    withTmp((dir) => {
      const prompt = scenario.build(dir);
      for (const name of ["artifact-contract", "artifact-schema", "review-hiking", "quiz-artifact"])
        assert.ok(prompt.includes(body(name)), `${scenario.name}: missing ${name}`);
      for (const name of [
        "artifact-example",
        "interactive-check",
        "repair-guide",
        "requested-browser-qa",
      ])
        assert.ok(!prompt.includes(body(name)), `${scenario.name}: unexpected ${name}`);
    });
  }
});
