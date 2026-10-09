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

/**
 * Finds one implementation-policy case in the machine-readable result so each
 * documentation and test-coverage obligation can be scored independently.
 */
function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

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
  score({ tail, output }) {
    const caseA = taggedSummary(tail, "CASE_A");
    const caseB = taggedSummary(tail, "CASE_B");
    const caseC = taggedSummary(tail, "CASE_C");
    const visible = output.split(/===\s*EVAL-VERDICT:/i)[0];

    return [
      {
        pass:
          /verdict\s*=\s*FIX_REQUIRED/i.test(caseA) &&
          /documentation\s*=\s*[^;]*(?:missing|absent|required|누락|없)/i.test(caseA) &&
          /ideal\s*=\s*[^;]*(?:present|covered|yes|있|충족)/i.test(caseA) &&
          /edge\s*=\s*[^;]*(?:missing|absent|required|누락|없)/i.test(caseA) &&
          /action\s*=\s*[^;]*(?:GoDoc|document|comment|주석)/i.test(caseA) &&
          /action\s*=\s*[^;]*(?:provider failure|duplicate|edge|실패|중복)/i.test(caseA),
        detail: caseA || "missing CASE_A",
        label: "missing standard documentation and relevant edge tests require repair",
      },
      {
        pass:
          /verdict\s*=\s*PASS/i.test(caseB) &&
          /documentation\s*=\s*[^;]*(?:GoDoc|standard|valid|표준|충족)/i.test(caseB) &&
          /why\s*=\s*[^;]*(?:present|yes|included|있|충족)/i.test(caseB) &&
          /how\s*=\s*[^;]*(?:present|yes|included|있|충족)/i.test(caseB) &&
          /terminology\s*=\s*[^;]*(?:present|matched|reused|yes|일치|재사용|충족)/i.test(caseB) &&
          /adrReference\s*=\s*[^;]*(?:none|absent|no|없음|없)/i.test(caseB) &&
          /ideal\s*=\s*[^;]*(?:present|covered|yes|있|충족)/i.test(caseB) &&
          /edge\s*=\s*[^;]*(?:present|covered|yes|있|충족)/i.test(caseB),
        detail: caseB || "missing CASE_B",
        label: "standard why/how documentation plus relevant ideal and edge tests can pass",
      },
      {
        pass:
          /verdict\s*=\s*FIX_REQUIRED/i.test(caseC) &&
          /adrReference\s*=\s*[^;]*(?:present|forbidden|invalid|있|금지)/i.test(caseC) &&
          /action\s*=\s*[^;]*(?:remove|delete|strip|제거|삭제)/i.test(caseC) &&
          /action\s*=\s*[^;]*(?:preserv|keep|retain|domain|contract|용어|유지)/i.test(caseC),
        detail: caseC || "missing CASE_C",
        label: "direct ADR references are removed while domain vocabulary remains",
      },
      {
        pass:
          /Case A[\s\S]{0,500}FIX_REQUIRED/i.test(visible) &&
          /Case B[\s\S]{0,500}PASS/i.test(visible) &&
          /Case C[\s\S]{0,500}FIX_REQUIRED/i.test(visible),
        detail: "visible report must distinguish all three completion outcomes",
        label: "visible report preserves the two failure directions and compliant path",
      },
      {
        pass: !/(?:ADR reference|ADR 참조).{0,80}(?:allowed|acceptable|permitted|허용|가능)/i.test(
          visible,
        ),
        detail: "visible report must not permit direct ADR references in comments",
        label: "does not treat ADR references as acceptable documentation",
      },
    ];
  },
};
