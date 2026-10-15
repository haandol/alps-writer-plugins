import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks, exactDecisionRecords } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "assertions-and-compound-coverage",
    text: "A has correct inspected code but its failure test asserts only 503, not unchanged completion count. Mark compound R2 and D0 UNVERIFIED, Test gap, FIX_REQUIRED, with 4/4 code-inspected and 3/4 test-verified obligations. An increment-before-failure mutant survives, but do not call that hypothetical mutant an observed defect in A. B actually contains that defect: retain Spec violation for D0/R2 and the separate weak-assertion Test gap. C's adequate code and assertions allow PASS and 4/4 verified. A test name, lines executed or one verified clause cannot prove the parent row.",
  },
  {
    id: "external-and-execution-evidence",
    text: "D's mock tenant cannot establish real gateway provenance: R1/D0 UNVERIFIED, INCONCLUSIVE, Unverified risk, 3/4 verified. E has adequate existing tests but Node is unavailable before discovery: all rows UNVERIFIED, INCONCLUSIVE, Unverified risk, 0/4 verified. Neither supplies a missing/weak test or code violation. Route to gateway/environment recovery and rerunning existing tests, never Test gap, Spec violation, or source/test repair solely for unavailable execution. C is the adequate verified counterpart.",
  },
  {
    id: "whole-scope-and-retained-findings",
    text: "F's unchanged queue bypass violates ownership despite green HTTP tests: R1/D0 VIOLATED, Spec violation, FIX_REQUIRED, 3/4 verified. Use full ingress, not the diff or completion claim. G retains the exact-code-confirmed ownership violation while runtime checks cannot run: R1/D0 VIOLATED, R2 UNVERIFIED, overall INCONCLUSIVE, 0/4 verified. Keep the concrete ownership repair alongside environment recovery; do not downgrade the known defect to risk or call its separate adequate-but-unavailable tests Test gap.",
  },
  {
    id: "bounded-artifact-evidence",
    text: "Retain D0/R1/R2 and the seven existing coverage fields. Put clause/source inventory, enforcing paths, inputs/assertions, counterexamples and edge applicability/exclusions in evidence. Separate 4/4 code-inspected from obligations satisfied by executed assertions, including Decision's success obligation and both R2 clauses. tests lists only supplied required execution outcomes or NOT RUN, not hypothetical mutant failures or assertion narratives. Add no schema/registry, invoke no tools, claim no new execution, borrow no other case's runtime result, require no irrelevant concurrency/restart quota, and claim no mathematical completeness. Prose and records must agree.",
  },
];

// Eval-only decision records; these do not extend the review artifact schema.
const fields = ["verdict", "D0", "R1", "R2", "category", "inspected", "verified"];
const expected = {
  A: ["FIX_REQUIRED", "UNVERIFIED", "PROVEN", "UNVERIFIED", "Test gap", "4/4", "3/4"],
  B: ["FIX_REQUIRED", "VIOLATED", "PROVEN", "VIOLATED", "Spec violation", "4/4", "3/4"],
  C: ["PASS", "PROVEN", "PROVEN", "PROVEN", "none", "4/4", "4/4"],
  D: ["INCONCLUSIVE", "UNVERIFIED", "UNVERIFIED", "PROVEN", "Unverified risk", "4/4", "3/4"],
  E: ["INCONCLUSIVE", "UNVERIFIED", "UNVERIFIED", "UNVERIFIED", "Unverified risk", "4/4", "0/4"],
  F: ["FIX_REQUIRED", "VIOLATED", "VIOLATED", "PROVEN", "Spec violation", "4/4", "3/4"],
  G: ["INCONCLUSIVE", "VIOLATED", "VIOLATED", "UNVERIFIED", "Spec violation", "4/4", "0/4"],
};

function score(input) {
  return exactDecisionRecords(input, fields, expected, "one record for every case without extras");
}

export function deterministicScore(input) {
  return [...responseChecks(input, {}), ...score(input)];
}

export default {
  name: "impl-review-provability",
  description:
    "Review assertion effectiveness, compound coverage, external premises, unavailable execution and indirect bypasses against one bounded payment contract.",
  obligations,
  deterministicScore,
  score,
  build() {
    return [
      skillText("adr-impl-review", {
        references: [
          "references/implementation-evidence.md",
          "skills/adr-impl-review/references/full-review.md",
          "skills/adr-impl-review/references/evidence-synthesis.md",
        ],
      }),
      `# This run
Classify seven independent implementation-review cases from supplied hypothetical
evidence. Do not call tools, edit files or create reports. All unrelated review
and documentation obligations are satisfied. Do not claim you executed tests.

Original ADR:
Purpose: successful callbacks complete the owner's payment without another
tenant or a failed provider outcome changing it.
D0.adrBasis: Decision
Decision: Successful callbacks for owned payments commit one completion; all ingress preserves
tenant ownership and provider-failure guarantees.
R1.adrBasis: A callback may mutate only a payment owned by the authenticated tenant.
R2.adrBasis: For a payment owned by the caller, provider failure returns status 503 and leaves the completion count unchanged.
Count independent obligations across the whole ADR, without counting a
restatement in Decision twice. D0 status covers the complete decision.

Full base code, src/callback.mjs:1:
\`\`\`js
function callback(payment, tenant, providerOK) {
  if (payment.tenant !== tenant) return 403;
  if (!providerOK) return 503;
  payment.completions += 1;
  return 200;
}
\`\`\`
HTTP and queue ingress call this function. Both paths and the storage mutation
have been inspected in every case. Only src/http.mjs is in the change list;
src/queue.mjs is unchanged. Authenticated-tenant provenance is established at
both ingress paths except in D. This fixture is sequential and local: no
concurrent writer, retry, replay or restart-recovery contract.

Existing test/callback.test.mjs:
- Normal: owned payment starts at 0, providerOK=true; assert return===200 and
  completions===1 through both entry paths.
- Ownership: authenticated A attempts B's payment, providerOK=true and false;
  assert unchanged completion count through both paths.
- Weak failure body: owned payment starts at 4, providerOK=false;
  assert return===503 only.
- Adequate failure replacement: same input; assert return===503 AND
  completions===4 through both paths.
Existing test/ingress.test.mjs asserts that forged tenant headers cannot change
another tenant's payment through the real gateway. It passes except where stated.

A. Base code, normal/ownership tests and weak failure test. Required outcome:
node --test test/callback.test.mjs — PASS. No code defect is observed.
The implementer marks every row PROVEN because all lines and named tests pass.
B. A, except actual code increments completions AFTER the ownership guard but
BEFORE checking providerOK. Exact inspection confirms this order. Same weak
suite outcome: node --test test/callback.test.mjs — PASS.
C. Base code with adequate failure assertions and all ingress/interaction checks.
Required outcome: node --test test/callback.test.mjs — PASS.
D. C's application code and adequate tests, but gateway provenance is unknown.
The local suite mocks the authenticated tenant. Required real-ingress outcome:
node --test test/ingress.test.mjs — NOT RUN (gateway access unavailable).
Supporting local outcome: node --test test/callback.test.mjs — PASS. The other
obligations need no gateway guarantee and are tested without substitutes.
No exploit or test defect is known.
E. C's code and adequate tests; node is unavailable before discovery.
Required outcomes: node --test test/callback.test.mjs — NOT RUN;
node --test test/ingress.test.mjs — NOT RUN. Provenance configuration is inspected.
F. C, except unchanged queue ingress calls a copy missing the ownership guard.
HTTP tests and provider-outcome assertions pass. The queue ownership assertion
observes B's count increase when authenticated A sends providerOK=true.
Required outcome: node --test test/callback.test.mjs — FAIL (queue ownership).
G. F's source and adequate tests; node is unavailable before discovery.
Exact code/contract comparison still confirms the unguarded queue write.
Required outcomes: node --test test/callback.test.mjs — NOT RUN;
node --test test/ingress.test.mjs — NOT RUN. Provenance configuration is inspected.
G has no runtime result; do not borrow F's execution.

For each case explain verdict, primary category, follow-up, clause inventory,
actual assertions and relevant counterexample/edge exclusions. Retain separately
confirmed findings when another verification cannot run. Use existing coverage
fields and D0/R1/R2 IDs. Put clause/source, input/assertion, edge and hypothetical
mutant narratives in evidence. tests contains only actual supplied required
execution outcomes or NOT RUN. No new schema/registry.

Emit exactly A through G in EVAL-FINDINGS. Each eval-only record has these fields
once, using key=value separated by semicolons: verdict; D0; R1; R2; category;
inspected; verified. D0/R1/R2 use existing coverage statuses. category is the
primary category or none. inspected and verified are fractions of the full
independent-obligation count. Inspected includes code found to violate a rule;
verified counts obligations supported as SATISFIED by executed assertions,
not a defect merely exercised by a failing test. Explain the inventories in prose.
Use EVAL-VERDICT: CLASSIFIED for this batch.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
