import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scenario from "../evals/scenarios/author-delegation-is-not-approval.mjs";

test("delegation guidance keeps ALPS and ADR protected decisions in their owning contracts", () => {
  const sources = [
    scenario.build(),
    readFileSync(new URL("../../alps-writer/src/guides/07.md", import.meta.url), "utf8"),
  ];
  for (const source of sources) {
    assert.match(source, /delegates a proposal/);
    assert.match(source, /retention/);
    assert.match(source, /permission/);
    assert.match(source, /approval/i);
    assert.doesNotMatch(source, /Classify anything.*whatever seems right.*as a tuning value/);
    assert.doesNotMatch(source, /whatever seems right.*that value is a tuning constant/);
  }
});

test("the delegation scorer rejects protected values classified as tuning or already approved", () => {
  const findings = ["A", "B", "C", "D"].map((id) => ({
    tag: id === "A" ? "TUNING" : "DECISION",
    summary: `case=${id}; approved=false; reason=The value's effect determines its owner.`,
  }));
  assert.ok(scenario.score({ tail: { findings } }).every((check) => check.pass));
  const bad = structuredClone(findings);
  bad[1].tag = "TUNING";
  bad[2].summary = "case=C; approved=true; reason=The user delegated the value.";
  const results = scenario.score({ tail: { findings: bad } });
  assert.equal(results[0].pass, true);
  assert.equal(results[1].pass, false);
  assert.equal(results[2].pass, false);
  assert.equal(results[3].pass, true);
});
