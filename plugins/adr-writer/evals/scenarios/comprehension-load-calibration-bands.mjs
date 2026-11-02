import { skillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const CASES = `
A. 오류 문구 한 줄을 표시한다. 상태, 권한, 외부 경계와 별도 예외가 없다.
B. 사용자가 프로필을 수정한다. 입력 검증, 저장, 성공 표시, 일반적인 오류 처리를
   하나의 vertical slice로 다루며 요구사항 값 하나가 있다.
C. 주문 승인 결정이 권한, 상태 전이, 중복 방지, 부분 실패와 외부 결제 경계를 함께 다룬다.
D. 여러 bounded context, 두 외부 provider, 비동기 보상 흐름, 데이터 migration,
   권한 체계와 미확정 동시성 위험을 하나의 결정에 함께 담고 있다.
`;

export default {
  name: "comprehension-load-calibration-bands",
  description:
    "The shared 1-10 comprehension rubric must distinguish low, recommended, high, and very-high review load without turning the score into a quality or blocking gate.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-new", {
        references: [
          "skills/adr-new/references/approval-and-save.md",
          "references/comprehension-load.md",
        ],
      }),
      `\n---\n\n# This run`,
      `Score A-D using the shipped internal calibration guide. Do not expose axis calculations.`,
      `Return one score line per case and no split proposal because the user did not request one.`,
      CASES,
      `In the tail include LOW_SCORE, RECOMMENDED_SCORE, HIGH_SCORE, and VERY_HIGH_SCORE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
