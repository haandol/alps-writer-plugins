import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks, exactDecisionRecords } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "saved-document-review",
    text: "A normally performs adr-review on the exact saved ADR without routine permission and retains Proposed. B cannot run the post-save follow-up on an unapproved unsaved candidate. C honors the explicit skip without a new save gate or status promotion. D reuses the completed unchanged document review; the authoring self-check in A alone does not count as that review. I preserves the approved save and Proposed while reporting unavailable recommended review, without fabricated PASS or a new approval request.",
  },
  {
    id: "implementation-completion-review",
    text: "E runs the existing mandatory adr-impl-review after code/tests and before promotion. F reuses that same completed PASS after the metadata-only Accepted transition and does not add another review. G reruns after relevant code/test repair rather than reuse stale evidence. H cannot promote without the unexecuted required completion review even if the user asks to skip it; distinguish this from C's recommended document review. No unrelated category sweep, new baseline approval, automatic quiz, or publication is introduced.",
  },
];

const fields = ["action", "target", "status", "approval"];
const expected = {
  A: ["RUN_DOCUMENT_REVIEW", "saved", "Proposed", "none"],
  B: ["WAIT_FOR_APPROVAL", "none", "unsaved", "baseline"],
  C: ["SKIP_RECOMMENDED", "saved", "Proposed", "none"],
  D: ["REUSE_DOCUMENT_REVIEW", "saved", "Proposed", "none"],
  E: ["RUN_IMPLEMENTATION_REVIEW", "selected", "Proposed", "none"],
  F: ["REUSE_IMPLEMENTATION_REVIEW", "selected", "Accepted", "none"],
  G: ["RERUN_IMPLEMENTATION_REVIEW", "selected", "Proposed", "none"],
  H: ["REPORT_INCOMPLETE", "selected", "Proposed", "none"],
  I: ["REPORT_REVIEW_UNAVAILABLE", "saved", "Proposed", "none"],
};

function score(input) {
  return exactDecisionRecords(input, fields, expected, "one record for every follow-up case");
}

export function deterministicScore(input) {
  return [...responseChecks(input, {}), ...score(input)];
}

export default {
  name: "author-review-followup",
  description:
    "Recommend a scoped saved-ADR review and reuse the implementation completion review without weakening its gate.",
  obligations,
  deterministicScore,
  score,
  build() {
    return [
      skillText("adr-new", {
        references: ["skills/adr-new/references/after-save-review.md"],
      }),
      skillText("adr-impl", {
        references: ["skills/adr-impl/references/completion.md"],
      }),
      `# This run
Classify the next review action in nine independent cases. These are supplied
hypothetical situations, not commands to execute: do not call tools, edit files,
create reports or claim a new review result. Each requested implementation is
already authorized, prerequisites are Accepted, and comprehension load is 3/10.
The exact saved/selected ADR is docs/adr/orders/0001-cancellation.md. An unrelated
accepted ADR exists in the same category; no category-wide review was requested.

A. adr-new saved the approved ADR and matching mapping entry as Proposed.
Final structure checks passed. Only its ordinary pre-save authoring self-check
has run. No skip/defer instruction exists.
B. The candidate passed draft verification, but baseline approval has not
arrived and no official ADR or mapping entry was saved.
C. A, with the user's explicit instruction: skip the recommended document review.
D. A, except a completed document review already covered exactly this decision,
contract, relevant sources and checks; none changed when the approved save landed.
E. adr-impl completed code, tests and any needed refactoring. The new target is
Proposed; the required final implementation review has not run.
F. The implementation review returned PASS on all current obligations and code.
Only the automatic lifecycle metadata changed to Accepted. No code, tests,
decision or contract changed after that review.
G. E's target had a review, then a relevant implementation/test defect was repaired.
The previous review predates the repair; the target is still Proposed.
H. E, but the user asks to skip the required completion review and stop the work.
No review evidence exists; report the actual lifecycle outcome without more work.
I. A, but the environment cannot execute the recommended document review.
The approved ADR and mapping were saved and validated successfully.

Explain the chosen action, exact target, reuse/skip boundary and lifecycle result.
Keep review permission distinct from contract approval. Do not add a publishing
gate, a repeated approval, an automatic quiz or a second unchanged review.

Emit exactly A through I in EVAL-FINDINGS, each with action, target, status and
approval as semicolon-separated key=value fields. For action use one of:
RUN_DOCUMENT_REVIEW, REUSE_DOCUMENT_REVIEW, SKIP_RECOMMENDED, WAIT_FOR_APPROVAL,
RUN_IMPLEMENTATION_REVIEW, REUSE_IMPLEMENTATION_REVIEW, RERUN_IMPLEMENTATION_REVIEW,
REPORT_INCOMPLETE, REPORT_REVIEW_UNAVAILABLE. Put explanations in prose above,
not inside the action field. target is saved, selected or
none; status is Proposed, Accepted or unsaved; approval is none or baseline.
Use EVAL-VERDICT: CLASSIFIED for this batch.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
