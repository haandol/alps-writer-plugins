import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierIdentity } from "../evals/lib/verifier-identity.mjs";
import { withTmp, write } from "./helpers.mjs";
import { compareRuns } from "../evals/regression/judge.mjs";
import { compareDeepEval } from "../evals/deepeval/report.mjs";

test("actual grading prompt/schema and transitive checker changes invalidate comparison identity", () => {
  withTmp((root) => {
    write(
      root,
      "evals/regression/judge.mjs",
      'export const prompt="keep the complete contract"; export const schema={required:["evidence"]};',
    );
    write(root, "evals/skills/mechanical-checks.mjs", "export const check=x=>x.valid;");
    write(root, "scripts/validator.mjs", "export const schemaVersion=1;");
    write(root, "scripts/adr-invariants.sh", "#!/bin/sh\nexit 0\n");
    write(root, "templates/adr/mapping.schema.json", '{"type":"object"}');
    const initial = verifierIdentity(root, root);
    const before = {
      verdict: "FAIL",
      referenceDate: "2026-10-16",
      conditionHash: initial,
      calls: [
        { stage: "target", models: ["fixed-target"] },
        { stage: "judge", models: ["fixed-judge"] },
      ],
    };
    for (const [file, content] of [
      [
        "evals/regression/judge.mjs",
        'export const prompt="ignore missing evidence"; export const schema={required:[]};',
      ],
      ["evals/skills/mechanical-checks.mjs", "export const check=x=>true;"],
      ["scripts/validator.mjs", "export const schemaVersion=2;"],
      ["scripts/adr-invariants.sh", "#!/bin/sh\nexit 1\n"],
      ["templates/adr/mapping.schema.json", '{"type":"array"}'],
    ]) {
      const prior = verifierIdentity(root, root);
      write(root, file, content);
      const current = verifierIdentity(root, root);
      assert.notEqual(current, prior);
      assert.equal(
        compareRuns(before, { ...before, verdict: "PASS", conditionHash: current }),
        "INCONCLUSIVE",
      );
      const saved = {
        verdict: "NOT_PROVEN",
        conditionHash: initial,
        models: ["fixed-judge"],
        targetModels: ["fixed-target"],
        referenceDate: before.referenceDate,
        pluginHash: "before",
      };
      assert.equal(
        compareDeepEval(saved, {
          ...saved,
          verdict: "PASS",
          conditionHash: current,
          pluginHash: "after",
        }),
        "INCONCLUSIVE",
      );
    }
  });
});
