import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import scenario, { obligations } from "../evals/scenarios/impl-review-provability.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import documentProbe from "../evals/scenarios/review-provability.mjs";
import implementationProbe from "../evals/scenarios/impl-provability.mjs";

test("catalog delegates provability meaning to fixed semantic obligations", async () => {
  const item = (await catalog()).find((c) => c.id === scenario.name);
  assert.equal(item.score, undefined);
  assert.deepEqual(item.semanticObligations, obligations);
  assert.equal(item.supplementalChecks, false);
});

test("scenario embeds shipping review modules without leaking the semantic answer key", () => {
  const prompt = scenario.build();
  for (const file of [
    "references/implementation-evidence.md",
    "skills/adr-impl-review/references/full-review.md",
    "skills/adr-impl-review/references/evidence-synthesis.md",
  ])
    assert.ok(prompt.includes(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")));
  for (const obligation of obligations) assert.ok(!prompt.includes(obligation.text));
  assert.ok(prompt.length > 5000 && prompt.length <= 100_000);
});

const stage2 = [
  { probe: documentProbe, references: ["skills/adr-review/references/report.md"] },
  {
    probe: implementationProbe,
    references: [
      "skills/adr-impl/references/planning.md",
      "references/implementation-evidence.md",
      "references/outcome-evaluation.md",
      "skills/adr-impl/references/completion.md",
    ],
  },
];

test("stage2 catalog preserves semantic evidence obligations without record-word scoring", async () => {
  const entries = await catalog();
  for (const { probe } of stage2) {
    const item = entries.find((c) => c.id === probe.name);
    assert.equal(item.score, undefined);
    assert.deepEqual(item.semanticObligations, probe.obligations);
    assert.equal(item.supplementalChecks, false);
  }
});

test("stage2 probes load current workflow evidence and keep semantic answer keys private", () => {
  for (const { probe, references } of stage2) {
    const prompt = probe.build();
    for (const file of references)
      assert.ok(prompt.includes(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")));
    for (const obligation of probe.obligations) assert.ok(!prompt.includes(obligation.text));
    assert.ok(prompt.length > 5000 && prompt.length <= 100_000, `${probe.name}: ${prompt.length}`);
  }
});
