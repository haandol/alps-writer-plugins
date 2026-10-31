import { alpsGuideText, skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

const CASES = `
A. Feature: 이미 승인된 정적 안내 문구 한 줄을 그대로 표시한다.
   이 fixture에서는 서로 다른 사용자 행동이나 결정, 요구사항 계약, 상태·흐름,
   경계 결합, 불확실성·검증 부담이 모두 없어 다섯 내부 축의 합계가 0이다.
   계산 근거는 사용자에게 노출하지 않는다.

B. ADR: 결제 요청을 idempotency key로 중복 방지하고, 승인/실패/취소 상태 전이를
   관리하며, 외부 결제사 timeout 시 fallback을 수행한다. webhook 중복·역순 도착,
   원장 기록의 transaction 일관성, 재시도와 부분 실패를 함께 검증해야 한다.
`;

export default {
  name: "comprehension-load-score-only",
  description:
    "Feature and ADR workflows must show only an advisory 1-10 comprehension-load score while keeping the five-axis calculation internal and non-blocking.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsGuideText(7),
      skillText("adr-new", {
        references: [
          "skills/adr-new/references/approval-and-save.md",
          "references/comprehension-load.md",
        ],
      }),
      `\n---\n\n# This run`,
      `Estimate the comprehension load for A as an ALPS Feature and B as an ADR.`,
      `Return the normal user-facing result first. Follow the shipped score-only format:`,
      `one labeled score line for A and one for B, with no rationale, axis breakdown,`,
      `automatic split proposal, checkpoint, approval request, or blocking action.`,
      CASES,
      `In the machine-readable tail include exactly one FEATURE_SCORE and one ADR_SCORE tag.`,
      `Do not replace those required score records with NONE.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
