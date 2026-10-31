import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "cases",
    text: "For Case A require repair of missing GoDoc explaining why/how and missing provider-failure and duplicate-settlement tests; the ideal success test is already present. For Case B allow PASS on this policy axis because GoDoc and all relevant tests are present. For C require removal of the direct ADR reference while preserving the useful domain vocabulary and why/how explanation.",
  },
  {
    id: "scope",
    text: "Do not make standard documentation optional, require unrelated edge categories, execute tools or change files. Keep the visible report and all CASE_A/B/C required fields consistent with those three outcomes.",
  },
];

/** Validate requested response structure and scope; preserve semantic contract distinctions. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    {
      CASE_A: ["verdict", "documentation", "ideal", "edge", "action"],
      CASE_B: [
        "verdict",
        "documentation",
        "why",
        "how",
        "terminology",
        "adrReference",
        "ideal",
        "edge",
      ],
      CASE_C: ["verdict", "adrReference", "action"],
    },
    { noTools: true },
  );
}

import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-requires-standard-docs-and-ideal-edge-tests",
  description:
    "/adr-impl must require language-standard why/how documentation without ADR references and both ideal and relevant edge tests before completion.",
  bugReport:
    "“구현 함수에 GoDoc·docstring 같은 표준 주석이 없거나 happy path 테스트만 있어도 완료된다. 주석에 ADR 파일을 직접 적는 것도 막아야 한다.”",

  /**
   * Builds paired incomplete, compliant, and source-referencing examples so one
   * run exercises why/how documentation plus ideal and relevant edge coverage.
   */
  build() {
    return [
      skillText("adr-impl"),
      `\n---\n`,
      skillText("adr-impl-review", {
        references: ["skills/adr-impl-review/references/full-review.md"],
      }),
      `\n---\n\n# This run`,
      `Classify the following three Go implementations without executing tools.`,
      `The approved contract uses these exact domain terms: pending payment, provider success,`,
      `provider failure, at-most-once completion, duplicate settlement.`,
      ``,
      `## Case A — incomplete`,
      `A named SettlePayment function is newly added with no GoDoc comment.`,
      `Its only test is "provider success completes a pending payment".`,
      `There is no provider-failure or duplicate-settlement test.`,
      ``,
      `## Case B — complete on this policy axis`,
      `The function has this GoDoc comment:`,
      `"SettlePayment enforces at-most-once completion for a pending payment. It records`,
      `completion only after provider success, preserves the pending payment on provider failure,`,
      `and ignores duplicate settlement attempts."`,
      `Tests cover provider success, provider failure preserving pending state, and duplicate`,
      `settlement producing one completion.`,
      ``,
      `## Case C — direct decision-document reference`,
      `The function and tests are otherwise identical to Case B, but the comment begins:`,
      `"SettlePayment implements ADR-0001 from docs/adr/payments/settlement/..."`,
      ``,
      `State the completion verdict and required action for each case.`,
      `Do not weaken the language-standard comment requirement into an optional style preference.`,
      `Do not require unrelated edge categories that the payment contract does not make relevant.`,
      ``,
      `In EVAL-FINDINGS use exactly these three tags and include every named field:`,
      `CASE_A | verdict=...; documentation=...; ideal=...; edge=...; action=...`,
      `CASE_B | verdict=...; documentation=...; why=...; how=...; terminology=...; adrReference=...; ideal=...; edge=...`,
      `CASE_C | verdict=...; adrReference=...; action=...`,
      TAIL_SPEC,
    ].join("\n");
  },

  /**
   * Accepts only the result that repairs missing documentation and edge cases,
   * passes the compliant case, and removes source references while preserving
   * the searchable payment-settlement vocabulary.
   */
};
