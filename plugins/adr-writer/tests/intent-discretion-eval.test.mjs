import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scenario from "../evals/scenarios/impl-uses-intent-to-bound-discretion.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";
import lookup from "../evals/scenarios/impl-uses-intent-for-file-lookup.mjs";
import alternatives from "../evals/scenarios/impl-uses-intent-with-safe-alternatives.mjs";

test("intent probe loads the actual shared gap guidance and is selected when it changes", () => {
  const shared = readFileSync(
    new URL("../references/requirement-delegation.md", import.meta.url),
    "utf8",
  );
  assert.ok(scenario.build().includes(shared));
  assert.ok(
    scenarioNamesForChangedPaths(
      ["plugins/adr-writer/references/requirement-delegation.md"],
      [scenario],
    ).has(scenario.name),
  );
  for (const entry of [scenario, lookup, alternatives]) {
    for (const obligation of entry.obligations) {
      assert.ok(
        !entry.build().includes(obligation.text),
        "judge criteria are not target instructions",
      );
    }
  }
});

test("only Purpose changes between probes", () => {
  const prompts = [scenario, lookup, alternatives].map((entry) =>
    entry.build().replace(/^Purpose: .*$/m, "Purpose: <controlled variation>"),
  );
  assert.equal(prompts[0], prompts[1]);
  assert.equal(prompts[1], prompts[2]);
});

test("intent comparison probes preserve their selection for either plugin's shared guidance", () => {
  const probes = [scenario, lookup, alternatives];
  for (const plugin of ["adr-writer", "alps-writer"]) {
    const selected = scenarioNamesForChangedPaths(
      [`plugins/${plugin}/references/requirement-delegation.md`],
      probes,
    );
    assert.deepEqual([...selected].sort(), probes.map((entry) => entry.name).sort());
  }
});
