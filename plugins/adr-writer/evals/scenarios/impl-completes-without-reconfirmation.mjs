import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "completion",
    text: "For scenario A, complete after the successful full review and tests, promote a Proposed target to Accepted, and report results without reopening intent or regeneration approval. Describing that reconfirmation must not happen is not asking for reconfirmation.",
  },
  {
    id: "repair",
    text: "For B, automatically fix the evidence-backed Spec violation and missing test within the unchanged approved contract, rerun tests and the full review, and complete only after PASS; no per-finding user approval is required.",
  },
  {
    id: "decision",
    text: "For C, ask one consolidated Decision request for the needed contract change before implementing it. Report the actual fixes and verification limits. Do not change files or invoke tools for this classification task.",
  },
];

/** Exact output/scope checks supplement the semantic obligations. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    { PASS_PATH: [], FIX_PATH: [], ESCALATE_ONLY: [] },
    { noTools: true },
  );
}

import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-completes-without-reconfirmation",
  description:
    "/adr-impl must not reopen routine intent confirmation after implementation; it auto-remediates evidence-backed findings and completes after PASS.",
  bugReport:
    "“구현 후 ADR만 남아도 재구현 가능한지와 의도가 맞는지 다시 확인해 달라고 멈춘다. 구현 전에 확인하고, 구현 후에는 스스로 리뷰·수정한 뒤 완료해야 한다.”",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);

    return [
      skillText("adr-impl", { references: ["skills/adr-impl/references/completion.md"] }),
      `\n---\n`,
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The ADR's Decision, Drivers, requirement contract, and regeneration checklist`,
      `were explicitly approved before implementation. The ADR did not change afterward.`,
      ``,
      `Classify these completion outcomes without executing tools:`,
      `A. Full necessity/sufficiency review returns PASS with all tests passing.`,
      `B. Full review finds one evidence-backed Spec violation in code and one missing test.`,
      `   Both fixes are local, stay inside the approved ADR contract, and are reproducible.`,
      `C. Review discovers that satisfying the code would require changing the approved`,
      `   product contract.`,
      ``,
      `State whether the workflow asks the user to reconfirm intent, what it fixes`,
      `automatically, when it transitions to Accepted, and what it reports at the end.`,
      `Use PASS_PATH, FIX_PATH, and ESCALATE_ONLY as finding tags.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
