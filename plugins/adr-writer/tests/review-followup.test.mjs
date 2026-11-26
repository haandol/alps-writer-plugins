import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scenario, { obligations } from "../evals/scenarios/author-review-followup.mjs";
import { skillText } from "../evals/lib/harness.mjs";
import { catalog } from "../evals/skills/catalog.mjs";

test("post-save policy is reachable explicitly without loading it during authoring discovery", () => {
  const relative = "skills/adr-new/references/after-save-review.md";
  const body = readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
  assert.ok(!skillText("adr-new").includes(body));
  assert.ok(skillText("adr-new", { references: [relative] }).includes(body));
  const prompt = scenario.build();
  assert.ok(prompt.includes(body));
  for (const obligation of obligations) assert.ok(!prompt.includes(obligation.text));
});

test("follow-up catalog keeps decision checks separate from semantic review evidence", async () => {
  const item = (await catalog()).find((entry) => entry.id === scenario.name);
  assert.equal(item.score, undefined);
  assert.deepEqual(item.semanticObligations, obligations);
  assert.equal(item.supplementalChecks, false);
});
