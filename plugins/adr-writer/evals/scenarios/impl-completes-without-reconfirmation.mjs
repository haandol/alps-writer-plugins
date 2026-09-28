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

import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";

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
      skillText("adr-impl"),
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

  score({ tail, output }) {
    const all = `${output}\n${tail.raw}`;
    const fixPath = tail.findings.find((finding) => /^FIX_PATH$/i.test(finding.tag))?.summary ?? "";
    const escalateOnly =
      tail.findings.find((finding) => /^ESCALATE_ONLY$/i.test(finding.tag))?.summary ?? "";

    return [
      expectText(
        all,
        /PASS_PATH.{0,240}(Accepted|완료|추가 승인 없이|without another approval)/is,
        "PASS completes and promotes without another approval",
      ),
      {
        pass:
          /(automatically|automatic|auto(?:-|\s*)?(?:appl(?:y|ies)|fix(?:es)?|remediat(?:e|es))|자동|사용자 (?:승인 )?없이|without asking|no user approval|재확인 없음|질의 금지)/i.test(
            fixPath,
          ) &&
          /(Spec violation).{0,220}(fix|repair|수정)|(?:fix|repair|수정).{0,220}(Spec violation)/i.test(
            fixPath,
          ) &&
          /(Test gap|test|테스트)/i.test(fixPath) &&
          /(rerun|re-review|재실행|재리뷰|다시 (?:검증|리뷰)|after tests and full review pass|full review.{0,40}PASS)/i.test(
            fixPath,
          ),
        detail: fixPath ? `FIX_PATH | ${fixPath}` : "no FIX_PATH finding",
        label: "evidence-backed code and test findings are fixed and re-reviewed automatically",
      },
      {
        pass:
          /(contract|decision|계약|결정)/i.test(escalateOnly) &&
          /(no (?:automatic )?(?:fix|repair|contract change)|not auto(?:-|\s*)fixed|not automatically fixed|자동 수정 (?:없음|금지|0건)|수정하지 않|explicit user judgment|사용자.{0,40}(?:결정|판단)|Proposed)/i.test(
            escalateOnly,
          ) &&
          /(user|사용자|ask|질문|확인|escalate|BLOCK|질의)/i.test(all),
        detail: escalateOnly ? `ESCALATE_ONLY | ${escalateOnly}` : "no ESCALATE_ONLY finding",
        label: "only a contract-changing decision escalates",
      },
      expectText(
        all,
        /(?:summar|final report|최종 보고|요약|정리|report).{0,180}(?:fix|repair|수정|test|검증|review|리뷰).{0,180}(?:test|verification|검증|review|리뷰|PASS)/is,
        "final report summarizes applied fixes and verification",
      ),
      expectNoText(
        all,
        /(?:ADR만 남아도|delete all code|regeneration).{0,180}(?:확인해|confirm|ask the user)/is,
        "does not repeat the regeneration confirmation after implementation",
      ),
      {
        pass:
          /(automatically|automatic|auto(?:-|\s*)?(?:appl(?:y|ies)|fix(?:es)?|repair(?:s)?|remediat(?:e|es))|자동)/i.test(
            fixPath,
          ) &&
          !/(?:apply\s*\/\s*skip\s*\/\s*defer|적용\s*\/\s*건너뛰기\s*\/\s*보류).{0,60}(?:ask|required|질문|요구)/i.test(
            fixPath,
          ),
        detail: fixPath ? `FIX_PATH | ${fixPath}` : "no FIX_PATH finding",
        label: "does not require per-finding user rulings for ordinary repairs",
      },
    ];
  },
};
