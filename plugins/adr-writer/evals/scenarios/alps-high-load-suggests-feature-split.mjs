import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
Section 7 Feature: 워크스페이스 멤버 관리

한 Feature 안에서 관리자는 이메일 초대, 역할 변경, 접근 회수, 감사 기록 내보내기를
수행한다. 각 행동은 별도로 시연할 수 있고 권한 규칙, 상태 전이, 오류 처리와 데이터
보존 조건이 서로 다르다. 이 Feature의 인지비용을 평가하고 승인 단계를 제시한다.
`;

export default {
  name: "alps-high-load-suggests-feature-split",
  description:
    "A Section 7 Feature scored eight or higher must receive up to three non-blocking split candidates based on independently demonstrable user behavior, with an option to keep the original.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Do not call tools. Show the normal user-facing score and split suggestion.`,
      `In the tail include FEATURE_SCORE once, two or three SPLIT_CANDIDATE findings,`,
      `KEEP_ORIGINAL once, and NON_BLOCKING once.`,
      TAIL_SPEC,
    ].join("\n");
  },
};

export const obligations = [
  {
    id: "split",
    text: "The visible reply assesses the mixed member-management Feature at 8/10 or higher and offers two or three split candidates based on independently demonstrable user behavior, not frontend/backend/data layers. The keep-original option is separate from the split-candidate count.",
  },
  {
    id: "choice",
    text: "The visible reply and tail offer keeping the original Feature and make the split advisory: the score or declining to split does not block approval or saving. Equivalent wording such as 'does not block approval' and 'approval is not blocked' is accepted. Genuine missing product contracts may still require clarification; do not confuse those with forcing a split.",
  },
  {
    id: "scope",
    text: "The reply is consistent with FEATURE_SCORE, SPLIT_CANDIDATE, KEEP_ORIGINAL and NON_BLOCKING in the requested tail. No tool is called and nothing is saved in this response-only task.",
  },
];

/** Numeric ranges and tail cardinalities stay deterministic, independent of wording. */
export function deterministicScore({ tail }) {
  const scores = tail.findings.filter((finding) => finding.tag === "FEATURE_SCORE");
  const score = Number(scores[0]?.summary.match(/\b(10|[1-9])\s*\/\s*10\b/)?.[1]);
  const candidates = tail.findings.filter((finding) => finding.tag === "SPLIT_CANDIDATE");
  return [
    {
      pass: scores.length === 1 && Number.isInteger(score) && score >= 8 && score <= 10,
      detail: scores[0]?.summary ?? "missing FEATURE_SCORE",
      label: "scores the multi-behavior Feature at eight or higher",
    },
    {
      pass: candidates.length >= 2 && candidates.length <= 3,
      detail: `${candidates.length} candidates`,
      label: "offers two or three split candidates",
    },
    {
      pass: ["KEEP_ORIGINAL", "NON_BLOCKING"].every(
        (tag) => tail.findings.filter((finding) => finding.tag === tag).length === 1,
      ),
      detail: "one keep-original and one non-blocking tail item required",
      label: "preserves the requested tail fields",
    },
  ];
}
