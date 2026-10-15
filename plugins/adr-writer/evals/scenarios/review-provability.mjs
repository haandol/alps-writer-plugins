import { agentText, ruleText, skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks, exactDecisionRecords } from "../lib/response-checks.mjs";
import { sectionRange } from "../../scripts/adr-lint-lib.mjs";

export const obligations = [
  {
    id: "source-omission-versus-unknown-intent",
    text: "A must fail document completeness under R19: the supplied organizer requirement says to release the seat before reporting cancellation success, but the ADR omits it. Explain the counterexample of cancelled status and readable history with the seat still reserved. B has the identical internally complete ADR without that source: PASS on ADR-internal completeness, explicitly limit intent coverage, do not invent seat-release policy or demand an external intent document. Neither case authorizes document edits or code inspection.",
  },
  {
    id: "complete-unimplemented-document",
    text: "C's complete seat-release, success ordering and failure outcome rules cover the supplied intent and allow document PASS even though code and tests do not exist. Explain normal cancellation, unauthorized and repeated requests, and release failure with their observable criteria. This proves document reviewability only, not implementation, test execution, or an Accepted lifecycle state. Do not require test files or an implementation run to pass document review.",
  },
  {
    id: "missing-oracle-without-leakage",
    text: "D's 'recover safely' does not specify the externally observable outcome after release failure; a test filename and passing command are not an oracle. Return a document completeness finding under R19 and identify the implementation detail leak. Request the missing domain outcome/criterion without inventing pending-versus-cancelled policy, copying behavior from code or prescribing a function, library, file or command in the ADR. Keep the supplied source/ADR distinction and document-only boundary in every explanation.",
  },
];

const fields = ["verdict", "basis", "criteria", "implementation"];
const expected = {
  A: ["FIX_REQUIRED", "SOURCE_COMPARED", "INCOMPLETE", "NOT_ASSESSED"],
  B: ["PASS", "ADR_INTERNAL", "COMPLETE", "NOT_ASSESSED"],
  C: ["PASS", "SOURCE_COMPARED", "COMPLETE", "NOT_ASSESSED"],
  D: ["FIX_REQUIRED", "ADR_INTERNAL", "INCOMPLETE", "NOT_ASSESSED"],
};

function score(input) {
  return exactDecisionRecords(
    input,
    fields,
    expected,
    "one document record per case without extras",
  );
}

export function deterministicScore(input) {
  return [...responseChecks(input, {}), ...score(input)];
}

export default {
  name: "review-provability",
  description:
    "Distinguish supplied intent omissions, honest ADR-internal scope, complete unimplemented documents and missing observable criteria.",
  obligations,
  deterministicScore,
  score,
  build() {
    const rules = sectionRange(
      ruleText("authoring-rules.md"),
      (h) => h.text === "What an ADR must satisfy — the regeneration test",
    );
    if (!rules) throw new Error("Missing shipping regeneration/provability guidance");
    return [
      skillText("adr-review", { references: ["skills/adr-review/references/report.md"] }),
      agentText("adr-reviewer"),
      rules.lines.slice(rules.start, rules.end).join("\n"),
      `# This run
Review four independent hypothetical ADR excerpts on document provability only.
All unrelated structure, admission, rationale, alternatives and mapping checks
are satisfied. All documents are Proposed. Do not call tools, inspect code,
edit files or create report artifacts. Explain findings in this response.

A and B have exactly this ADR:
Purpose: organizers can undo unpaid reservations while retaining readable history.
Decision: cancellation is a terminal reservation state; retain its history
instead of deleting the reservation.
Contract: an owner cancelling a pending reservation changes it to cancelled.
A different actor is rejected without changing the reservation. Cancelling an
already-cancelled reservation leaves it cancelled. A cancelled reservation
cannot become confirmed. After cancellation, its history remains readable.
These are synchronous domain operations; no other behavior or policy is stated.

A. Supplied organizer requirement, excerpt U1: "Cancellation must release the
reserved seat before reporting success, so another attendee can reserve it."
This excerpt applies to the decision but is absent from the ADR above.
B. No external intent or requirement material was supplied. There is no U1
for this case and no evidence of a seat-release requirement beyond this ADR.

C. U1 is supplied. The ADR includes A/B's contract plus: "A successful
cancellation releases the seat before success is reported; the seat is then
available for another reservation. If release fails, report failure, keep the
reservation pending and the seat reserved; do not report cancellation success."
Code and tests have not been written. Only the document is being reviewed.

D. No external source is supplied. Its ADR has C's purpose, cancellation and
success-release rules, but replaces the entire release-failure sentence with:
"On release failure, recover safely; test/cancel.test.mjs must pass."
No other statement settles the resulting reservation/seat state on failure.

For each case give a document verdict, source boundary, independent obligations,
observable normal/edge/failure criteria, and any gap with a counterexample and
suggested domain-level correction or needed decision. Distinguish what the
document verdict establishes from implementation or lifecycle completion.
Do not supply guessed policy as if it were a source fact.

In EVAL-FINDINGS emit exactly A through D, each with four key=value fields
separated by semicolons: verdict=<PASS|FIX_REQUIRED|BLOCK>;
basis=<SOURCE_COMPARED|ADR_INTERNAL>; criteria=<COMPLETE|INCOMPLETE>;
implementation=<NOT_ASSESSED|PROVEN>. These are eval-only decision records.
Use EVAL-VERDICT: CLASSIFIED for the batch.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
