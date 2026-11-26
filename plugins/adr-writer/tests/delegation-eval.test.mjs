import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scenario from "../evals/scenarios/author-delegation-is-not-approval.mjs";
import handoff from "../evals/scenarios/handoff-delegation-is-not-approval.mjs";

test("delegation guidance keeps ALPS and ADR protected decisions in their owning contracts", () => {
  const sources = [
    scenario.build(),
    handoff.build(),
    readFileSync(new URL("../../alps-writer/src/guides/07.md", import.meta.url), "utf8"),
  ];
  const shared = readFileSync(
    new URL("../references/requirement-delegation.md", import.meta.url),
    "utf8",
  );
  assert.ok(scenario.build().includes(shared), "direct authoring loads the actual common policy");
  assert.ok(
    handoff.build().includes(shared),
    "handoff loads the same policy through its own package",
  );
  for (const source of sources) {
    assert.match(source, /delegates a proposal/);
    assert.match(source, /retention/);
    assert.match(source, /permission/);
    assert.match(source, /approval/i);
    assert.doesNotMatch(source, /Classify anything.*whatever seems right.*as a tuning value/);
    assert.doesNotMatch(source, /whatever seems right.*that value is a tuning constant/);
  }
});

test("both delegation probes judge the same protected decisions outside their prompts", () => {
  assert.deepEqual(handoff.obligations, scenario.obligations);
  for (const entry of [scenario, handoff]) {
    assert.equal(entry.score, undefined);
    for (const obligation of entry.obligations)
      assert.ok(!entry.build().includes(obligation.text), obligation.id);
  }
});
