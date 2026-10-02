import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { skillText } from "../evals/lib/harness.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";
import reconciliation from "../evals/scenarios/rollup-reconciles-conflicts.mjs";
import discovery from "../evals/scenarios/rollup-targeted-discovery.mjs";

const reference = "skills/adr-rollup/references/renumbering.md";
const referenceText = readFileSync(new URL(`../${reference}`, import.meta.url), "utf8");

test("normal rollup loading includes the core only, without optional renumbering contents", () => {
  const core = readFileSync(
    new URL("../skills/adr-rollup/SKILL.md", import.meta.url),
    "utf8",
  ).replace(/^---\n[\s\S]*?\n---\n/, "");
  assert.equal(skillText("adr-rollup"), core);
  assert.ok(referenceText.trim().length > 0);
  assert.ok(!core.includes(referenceText));
});

test("explicit renumbering reference loading appends the complete real reference without changing default loading", () => {
  const normal = skillText("adr-rollup");
  const expanded = skillText("adr-rollup", { references: [reference] });
  assert.equal(
    expanded,
    [normal, `\n# Loaded reference: ${reference}\n`, referenceText].join("\n"),
  );
  assert.equal(skillText("adr-rollup"), normal);
});

test("existing rollup probes retain the core and optional-reference changes select them", () => {
  const core = skillText("adr-rollup");
  for (const scenario of [reconciliation, discovery]) {
    const prompt = scenario.build();
    assert.ok(prompt.startsWith(core), scenario.name);
    assert.ok(!prompt.includes(referenceText), `${scenario.name}: optional details loaded eagerly`);
  }
  assert.deepEqual(
    [
      ...scenarioNamesForChangedPaths(
        [`plugins/adr-writer/${reference}`],
        [reconciliation, discovery, { name: "hook-admission-routing" }],
      ),
    ],
    [reconciliation.name, discovery.name],
  );
});
