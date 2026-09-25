import { sha } from "../regression/workspace.mjs";

const SCORED = new Set(["PASS", "NOT_PROVEN"]);

/** Keep unscored requests visible without counting transport failures as behavior judgments. */
export function summarize(runs) {
  const scored = runs.filter((r) => SCORED.has(r.verdict));
  const passed = scored.filter((r) => r.verdict === "PASS").length;
  return {
    requested: runs.length,
    scored: scored.length,
    passed,
    notProven: scored.length - passed,
    errors: runs.filter((r) => r.verdict === "ERROR").length,
    notRun: runs.filter((r) => r.verdict === "NOT_RUN").length,
    successRate: scored.length ? passed / scored.length : null,
    elapsedMs: runs.reduce((n, r) => n + (r.elapsedMs ?? 0), 0),
    knownCostUSD: runs.flatMap((r) => r.calls ?? []).reduce((n, c) => n + (c.costUSD ?? 0), 0),
    unpricedCalls: runs.flatMap((r) => r.calls ?? []).filter((c) => c.costUSD == null).length,
  };
}

/** Compare only complete pairs with known identical models, tasks, verifiers, and execution limits. */
export function pairComparability(a, b) {
  if (!a || !b || !SCORED.has(a.verdict) || !SCORED.has(b.verdict)) return "unscored-or-missing";
  if (a.modelIdentityIncomplete || b.modelIdentityIncomplete) return "unverified-model-identity";
  for (const key of ["targetModels", "judgeModels"]) {
    if (!a[key]?.length || !b[key]?.length) return `unknown-${key}`;
    if (sha([...a[key]].sort()) !== sha([...b[key]].sort())) return `different-${key}`;
  }
  for (const key of ["conditionHash", "referenceDate"]) {
    if (!a[key] || a[key] !== b[key]) return `different-or-unknown-${key}`;
  }
  return null;
}

/** Calculate paired percentage-point differences; unavailable comparisons never become zero lift. */
export function comparePairs(runs, beforeVariant = "without-skill") {
  const candidates = runs.filter((r) => r.variant === "candidate" && r.type === "execution");
  const pairs = candidates.map((after) => {
    const before = runs.find(
      (r) => r.caseId === after.caseId && r.repeat === after.repeat && r.variant === beforeVariant,
    );
    const excluded = pairComparability(before, after);
    return {
      caseId: after.caseId,
      repeat: after.repeat,
      excluded,
      difference: excluded
        ? null
        : Number(after.verdict === "PASS") - Number(before.verdict === "PASS"),
    };
  });
  const valid = pairs.filter((p) => !p.excluded);
  return {
    beforeVariant,
    requestedPairs: pairs.length,
    validPairs: valid.length,
    excludedPairs: pairs.length - valid.length,
    differencePP: valid.length
      ? (100 * valid.reduce((n, p) => n + p.difference, 0)) / valid.length
      : null,
    pairs,
  };
}

/** Score the selected set against required and acceptable routes without penalizing optional report support. */
export function routingCounts(required, allowed, selected) {
  const tp = required.filter((id) => selected.includes(id)).length;
  return {
    tp,
    fn: required.length - tp,
    fp: selected.filter((id) => !allowed.includes(id)).length,
    tn: required.length === 0 && selected.length === 0 ? 1 : 0,
  };
}

/** Expose undefined denominators and exclude malformed router output from precision/recall. */
export function summarizeRouting(runs) {
  const counts = runs
    .filter((r) => SCORED.has(r.verdict) && r.routing)
    .reduce(
      (all, r) => {
        for (const key of ["tp", "fn", "fp", "tn"]) all[key] += r.routing[key];
        return all;
      },
      { tp: 0, fn: 0, fp: 0, tn: 0 },
    );
  return {
    ...counts,
    precision: counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null,
    recall: counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null,
  };
}
