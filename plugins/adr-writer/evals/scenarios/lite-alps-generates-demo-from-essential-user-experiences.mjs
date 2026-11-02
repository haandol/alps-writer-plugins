import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "demo",
    text: "Show a concrete complete Section 4 demo using the supplied business-travel/self-introduction context: starting state, representative input, ordered user actions and visible outcomes. Cover all three essential experiences: the initial English question for a chosen situation, response-dependent English continuation and next question, and user termination with a visible completed state.",
  },
  {
    id: "coverage",
    text: "Connect the demo to reduced preparation time or readiness, and make the overall success condition require observation of all three essential experiences. Equivalent expressions such as '3/3' are valid.",
  },
  {
    id: "approval",
    text: "Show the full proposed scenario before offering approval, revision or deferral. Do not ask the user to supply the demo flow, expose acceptance-test implementation jargon, invoke tools or save content. The required tail agrees with the proposal.",
  },
];

/** Keep the response-only scope and requested records exact; judge meaning with GEval. */
export function deterministicScore(input) {
  return responseChecks(input, {
    AUTO_GENERATED_DEMO: [],
    COVERS_ALL_ESSENTIAL_EXPERIENCES: [],
    SHOWS_FULL_SCENARIO: [],
    NO_RESTATEMENT_QUESTION: [],
    OVERALL_PASS_SHOWS_ALL: [],
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
현재 Lite ALPS Sections 1-2가 승인되어 저장되었다.

Section 1.2 Desired Business Impact:
해외 출장을 준비하는 직장인이 자기소개 대화를 짧게 반복 연습해 준비 시간을 줄이고 실제
대화를 시작할 수 있는 준비감을 얻는다.

Section 2.2 Essential User Experiences:

1. 상황별 연습이 시작된다
   - 사용자에게 보이는 결과: 선택한 업무 상황에 맞는 AI 강사의 첫 영어 질문이 보인다.
   - 비즈니스 임팩트 기여: 실제로 어려운 대화를 바로 연습할 수 있다.
2. 대화가 사용자 답변에 맞춰 이어진다
   - 사용자에게 보이는 결과: 영어 답변 뒤 관련 영어 응답과 다음 질문이 보인다.
   - 비즈니스 임팩트 기여: 고정 문장 암기보다 실제 대화에 가까운 연습을 할 수 있다.
3. 사용자가 연습을 종료할 수 있다
   - 사용자에게 보이는 결과: 사용자가 대화를 종료하면 완료 상태가 보인다.
   - 비즈니스 임팩트 기여: 제한된 준비 시간에 맞춰 연습할 수 있다.

명시적 제외 범위는 없다. 정상적인 Section 4 다음 응답을 작성하라.
도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-generates-demo-from-essential-user-experiences",
  description:
    "Lite ALPS must reverse-engineer and show a concrete Demo Scenario from Essential User Experiences without asking the user to design the flow.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      alpsLiteGuideText(4),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean and show the complete generated scenario before approval.`,
      `In the tail use AUTO_GENERATED_DEMO, COVERS_ALL_ESSENTIAL_EXPERIENCES, SHOWS_FULL_SCENARIO, NO_RESTATEMENT_QUESTION, and OVERALL_PASS_SHOWS_ALL once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
