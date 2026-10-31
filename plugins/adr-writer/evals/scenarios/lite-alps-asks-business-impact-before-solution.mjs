import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "impact",
    text: "Ask one focused question about the missing Desired Business Impact, including why that outcome matters to the target user. Wait for the answer before drafting or saving.",
  },
  {
    id: "sequence",
    text: "Do not ask the user to design a solution, screen or demo flow at this stage. Mentioning that solution/demo details will wait is not prematurely asking for them. The visible response and required tail agree.",
  },
];

/** Keep the response-only scope and requested records exact; judge meaning with GEval. */
export function deterministicScore(input) {
  return responseChecks(input, {
    BUSINESS_IMPACT_QUESTION: [],
    BEFORE_SOLUTION: [],
    FOCUSED_QUESTION: [],
    WAIT_FOR_ANSWER: [],
  });
}

import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
새 Lite ALPS 작성을 시작했다.

Target User and Core Problem:
해외 출장을 준비하는 직장인은 실제 업무 상황과 비슷한 영어 대화를 짧게 연습할 방법이 없다.

Desired Business Impact는 아직 설명하지 않았다.
정상적인 Section 1 다음 대화 한 단계만 진행하라. 도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-asks-business-impact-before-solution",
  description:
    "Lite ALPS must ask for the missing Desired Business Impact before discussing a solution, screen, or demo flow.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean with one focused question.`,
      `In the tail use BUSINESS_IMPACT_QUESTION, BEFORE_SOLUTION, FOCUSED_QUESTION, and WAIT_FOR_ANSWER once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
