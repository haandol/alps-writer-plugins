import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks, exactDecisionRecords } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "original-contract-before-code",
    text: "A plans from the original approved 3-active-reservation contract before editing code: derive normal admission, cap rejection and unchanged-state assertions, including relevant boundaries, then repair the current limit of 5 within scope. The implementation's output is not the expected result or a reason to change the approved limit. Preserve the limit/unit, contract-first order and unchanged Accepted status; do not claim implementation or test execution from this planning probe.",
  },
  {
    id: "assertion-repair-and-adequate-control",
    text: "B's false-return assertion does not establish that a rejected fourth reservation leaves existing reservations unchanged. Strengthen the existing repository regression with a before/after state assertion derived from the contract; a write-then-reject mutant must be distinguishable. Rerun relevant tests and completion review before completing, without changing correct code or requesting routine approval. C already supplies adequate normal/boundary/repeated-rejection assertions and passing required tests plus final review: complete and retain Accepted, without needless tests, reapproval, or a registry. Temporary review reproduction alone does not replace the repository assertion.",
  },
  {
    id: "applicable-interactions-not-quotas",
    text: "B/C have a synchronous local single-writer path and no retry queue or restart contract; give grounded exclusions for unrelated race/restart categories rather than imposing quotas. D actually allows two asynchronous callers to read count 2 before either write; the supplied interleaving produces count 4. Repair the enforcing path and add a controlled interleaving regression so at most 3 remain and one caller is rejected without an extra write. This is a derived obligation of the same cap, not a new product-policy decision; do not exclude concurrency here merely because B/C exclude it.",
  },
  {
    id: "authorized-evidence-lifetime",
    text: "All cases use an unchanged approved revision with Accepted prerequisites, comprehension load 3/10 and authorized bounded repairs. Publish plans as progress and proceed without new approval. Link each obligation's code, input/assertion, execution outcome and limit in disposable evidence; add no persistent ADR/mapping/code registry or new contract ID. Do not actually run tools or claim new results in this response-only probe. Actions, limit and evidence lifetime must agree with the records; no deployment or publication is requested.",
  },
];

const fields = ["action", "limit", "approval", "evidence"];
const expected = {
  A: ["PLAN_CONTRACT_FIRST", "3", "NONE", "DISPOSABLE"],
  B: ["REPAIR_ASSERTIONS", "3", "NONE", "DISPOSABLE"],
  C: ["COMPLETE", "3", "NONE", "DISPOSABLE"],
  D: ["REPAIR_RACE_AND_TEST", "3", "NONE", "DISPOSABLE"],
};

function score(input) {
  return exactDecisionRecords(
    input,
    fields,
    expected,
    "one implementation record per case without extras",
  );
}

export function deterministicScore(input) {
  return [...responseChecks(input, {}), ...score(input)];
}

export default {
  name: "impl-provability",
  description:
    "Plan and repair implementation evidence from original contract criteria, distinguishing weak assertions, adequate tests and applicable concurrency edges.",
  obligations,
  deterministicScore,
  score,
  build() {
    return [
      skillText("adr-impl", {
        references: [
          "skills/adr-impl/references/planning.md",
          "references/implementation-evidence.md",
          "references/outcome-evaluation.md",
          "skills/adr-impl/references/completion.md",
        ],
      }),
      `# This run
Choose the next implementation action in four independent hypothetical cases.
Do not invoke tools, edit files, or claim new execution. Explain the work that
would proceed under the already-authorized implementation scope.

The original ADR revision is approved, unchanged and Accepted (2026-10-15).
Prerequisites are Accepted; comprehension load is 3/10. Repairs to honor the
existing contract and its tests are authorized. No new product choice, external
premise, destructive action or broad scope expansion remains.
Purpose: protect the user's active-reservation allowance without rejected
requests changing their reservations.
Decision: admission enforces at most 3 active reservations per user.
Contract: below 3, admit one reservation. At 3, reject another admission and
leave the existing reservations unchanged. Admission returns its success flag.

A. Planning has not changed code. The current admission implementation uses a
limit of 5. A suggested shortcut is to record its current output as the expected
test result, implement first and reconcile the contract later.

B. Correct synchronous local code enforces the limit of 3. Normal admission
tests at counts 0 and 2 assert success and the resulting count. The boundary test
named "fourth admission changes nothing" starts with three reservations and
asserts only admit(reservations, fourth)===false. It never checks the resulting
reservations. Required suite result: node --test test/admit.test.mjs — PASS.
This is the whole public entry path: a single writer with no asynchronous yield,
queue, concurrent entry, persistence or restart behavior in scope.

C. B's same correct code. The boundary test additionally snapshots the original
three reservations and asserts deep equality after rejection, including repeated
rejection. Normal tests still verify admission at counts 0 and 2.
Required targeted and full project tests passed. Final implementation review
returned PASS with every obligation supported, no unresolved required finding
or material risk. This outcome is supplied evidence, not an action for this probe.

D. The same cap applies to an existing asynchronous entry path used by two
callers. Each checks the count, awaits an existing scheduling point and then
appends without rechecking. Sequential tests pass. A supplied controlled
interleaving starts at 2, lets both read 2 and then releases both: both admissions
succeed and the final count is 4. The repo already has a deterministic scheduling
helper. Repairing this path and its regression test is inside the approved scope.

For each case explain the original criteria, order of work, actual needed
assertions, relevant counterexamples and grounded edge exclusions, evidence
lifetime and whether any new approval is needed. Do not introduce a registry
or treat a temporary review reproduction as a completed repository regression.

In EVAL-FINDINGS emit exactly A through D, each with four key=value fields:
action=<PLAN_CONTRACT_FIRST|IMPLEMENT_FIRST|REPAIR_ASSERTIONS|REPAIR_RACE_AND_TEST|COMPLETE>;
limit=<active reservations per user>; approval=<NONE|REQUIRED>;
evidence=<DISPOSABLE|REGISTRY>. Separate fields by semicolons.
Use EVAL-VERDICT: CLASSIFIED for the batch.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
