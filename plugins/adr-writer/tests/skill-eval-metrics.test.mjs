import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarize,
  comparePairs,
  routingCounts,
  summarizeRouting,
} from "../evals/skills/metrics.mjs";
import { validateResults } from "../evals/skills/report.mjs";
import { routingCases } from "../evals/skills/catalog.mjs";

test("implementation routing permits its optional refactor stage but still requires the owning skill", () => {
  const item = routingCases.find((c) => c.id === "routing-implementation");
  assert.deepEqual(
    routingCounts(item.required, item.allowed, [
      "adr-impl",
      "adr-impl-refactor",
      "adr-impl-review",
    ]),
    { tp: 1, fn: 0, fp: 0, tn: 0 },
  );
  assert.equal(routingCounts(item.required, item.allowed, ["adr-impl-refactor"]).fn, 1);
  assert.equal(routingCounts(item.required, item.allowed, ["adr-impl", "alps-init"]).fp, 1);
});

const run = (variant, verdict, repeat = 1) => ({
  caseId: "case",
  type: "execution",
  variant,
  verdict,
  repeat,
  targetModels: ["target"],
  judgeModels: ["judge"],
  conditionHash: "same",
  referenceDate: "2026-09-25",
});

test("paired lift reports percentage points and exposes incomplete or incompatible pairs", () => {
  const runs = [
    run("candidate", "PASS"),
    run("without-skill", "NOT_PROVEN"),
    run("candidate", "NOT_PROVEN", 2),
    run("without-skill", "NOT_PROVEN", 2),
    run("candidate", "ERROR", 3),
    run("without-skill", "PASS", 3),
  ];
  const result = comparePairs(runs);
  assert.equal(result.differencePP, 50);
  assert.equal(result.validPairs, 2);
  assert.equal(result.excludedPairs, 1);
  for (const key of ["targetModels", "judgeModels", "conditionHash", "referenceDate"]) {
    const changed = { ...runs[1], [key]: key.endsWith("Models") ? ["different"] : "different" };
    assert.equal(comparePairs([runs[0], changed]).differencePP, null, key);
    assert.equal(
      comparePairs([runs[0], { ...runs[1], [key]: null }]).differencePP,
      null,
      `unknown ${key}`,
    );
  }
  assert.equal(
    comparePairs([run("candidate", "ERROR"), run("without-skill", "ERROR")]).differencePP,
    null,
  );
  assert.equal(comparePairs([run("candidate", "PASS"), run("baseline", "PASS")]).validPairs, 0);
  assert.equal(
    comparePairs([
      run("candidate", "PASS"),
      { ...run("without-skill", "PASS"), modelIdentityIncomplete: true },
    ]).differencePP,
    null,
  );
});

test("behavior rates exclude errors and unrun trials while counts and unknown costs remain visible", () => {
  const result = summarize([
    { verdict: "PASS", calls: [{ costUSD: 0.25 }, { costUSD: null }] },
    { verdict: "NOT_PROVEN" },
    { verdict: "ERROR" },
    { verdict: "NOT_RUN" },
  ]);
  assert.equal(result.successRate, 0.5);
  assert.equal(result.requested, 4);
  assert.equal(result.scored, 2);
  assert.equal(result.errors, 1);
  assert.equal(result.notRun, 1);
  assert.equal(result.unpricedCalls, 1);
  assert.equal(result.knownCostUSD, 0.25);
  assert.equal(summarize([{ verdict: "ERROR" }]).successRate, null);
});

test("routing reports missing required skills and irrelevant selections independently", () => {
  assert.deepEqual(routingCounts(["sync"], ["sync", "report"], ["report", "review"]), {
    tp: 0,
    fn: 1,
    fp: 1,
    tn: 0,
  });
  assert.deepEqual(routingCounts([], [], []), { tp: 0, fn: 0, fp: 0, tn: 1 });
  const result = summarizeRouting([
    { verdict: "PASS", routing: { tp: 2, fn: 0, fp: 0, tn: 0 } },
    { verdict: "NOT_PROVEN", routing: { tp: 0, fn: 1, fp: 1, tn: 0 } },
    { verdict: "ERROR", routing: { tp: 999, fn: 0, fp: 0, tn: 0 } },
  ]);
  assert.equal(result.precision, 2 / 3);
  assert.equal(result.recall, 2 / 3);
  assert.equal(summarizeRouting([]).precision, null);
  assert.equal(summarizeRouting([]).recall, null);
});

test("saved results reject missing, duplicate, and invalid trials instead of looking complete", () => {
  const base = {
    schemaVersion: 1,
    framework: "skill-evals",
    cases: [{ id: "case", type: "execution" }],
    runsPerCase: 1,
    variants: ["candidate", "without-skill"],
    runs: [run("candidate", "PASS"), run("without-skill", "PASS")],
  };
  assert.equal(validateResults(base), base);
  assert.throws(() => validateResults({ ...base, runs: base.runs.slice(0, 1) }), /Missing/);
  assert.throws(
    () => validateResults({ ...base, runs: [...base.runs, base.runs[0]] }),
    /Duplicate/,
  );
  assert.throws(
    () => validateResults({ ...base, runs: [{ ...base.runs[0], verdict: "GREEN" }, base.runs[1]] }),
    /Invalid/,
  );
});
