import { skillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const CASES = `
A. 오류 문구 한 줄을 표시한다. 상태, 권한, 외부 경계와 별도 예외가 없다.
B. 사용자가 프로필을 수정한다. 입력 검증, 저장, 성공 표시, 일반적인 오류 처리를
   하나의 vertical slice로 다루며 요구사항 값 하나가 있다.
C. 주문 승인 결정이 권한, 상태 전이, 중복 방지, 부분 실패와 외부 결제 경계를 함께 다룬다.
D. 여러 bounded context, 두 외부 provider, 비동기 보상 흐름, 데이터 migration,
   권한 체계와 미확정 동시성 위험을 하나의 결정에 함께 담고 있다.
`;

function taggedScore(findings, tag) {
  const summary =
    findings.find((finding) => new RegExp(tag, "i").test(`${finding.tag}\n${finding.summary}`))
      ?.summary ?? "";
  return { summary, value: Number(summary.match(/\b(10|[1-9])\s*\/\s*10\b/)?.[1]) };
}

export default {
  name: "comprehension-load-calibration-bands",
  description:
    "The shared 1-10 comprehension rubric must distinguish low, recommended, high, and very-high review load without turning the score into a quality or blocking gate.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-new", { references: ["references/comprehension-load.md"] }),
      `\n---\n\n# This run`,
      `Score A-D using the shipped internal calibration guide. Do not expose axis calculations.`,
      `Return one score line per case and no split proposal because the user did not request one.`,
      CASES,
      `In the tail include LOW_SCORE, RECOMMENDED_SCORE, HIGH_SCORE, and VERY_HIGH_SCORE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const low = taggedScore(tail.findings, "LOW_SCORE");
    const recommended = taggedScore(tail.findings, "RECOMMENDED_SCORE");
    const high = taggedScore(tail.findings, "HIGH_SCORE");
    const veryHigh = taggedScore(tail.findings, "VERY_HIGH_SCORE");
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      {
        pass: low.value >= 1 && low.value <= 3,
        detail: low.summary || "missing LOW_SCORE",
        label: "places the trivial case in the 1-3 low band",
      },
      {
        pass: recommended.value >= 4 && recommended.value <= 6,
        detail: recommended.summary || "missing RECOMMENDED_SCORE",
        label: "places the balanced slice in the 4-6 recommended band",
      },
      {
        pass: high.value >= 7 && high.value <= 8,
        detail: high.summary || "missing HIGH_SCORE",
        label: "places the coupled decision in the 7-8 high band",
      },
      {
        pass: veryHigh.value >= 9 && veryHigh.value <= 10,
        detail: veryHigh.summary || "missing VERY_HIGH_SCORE",
        label: "places the multi-boundary decision in the 9-10 very-high band",
      },
      {
        pass: !/(?:quality|품질)(?![^\n.]{0,40}(?:아니|not\b))\s*(?:score|rating|점수|평가|:)|승인 불가|구현 불가|blocked|차단(?:됨|한다|해야|하라|필수)/i.test(
          visible,
        ),
        detail: visible.trim() || "no visible output",
        label: "does not turn comprehension load into a quality or blocking verdict",
      },
    ];
  },
};
