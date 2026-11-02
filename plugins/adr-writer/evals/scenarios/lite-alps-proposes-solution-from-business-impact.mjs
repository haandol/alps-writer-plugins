import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 Lite ALPS Section 1이 승인되어 저장되었다.

Target User and Core Problem:
해외 출장을 준비하는 직장인은 실제 업무 상황과 비슷한 영어 대화를 짧게 연습할 방법이 없다.

Desired Business Impact:
직장인은 출장 전에 부담 없이 자기소개 대화를 반복 연습해 준비 시간을 줄이고 실제 대화를
시작할 수 있는 준비감을 얻는다.

금전, 권한, 개인정보, 안전, 외부 약속과 관련해 사용자가 정해야 할 추가 정책은 없다.
정상적인 Section 2 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-proposes-solution-from-business-impact",
  description:
    "Lite ALPS must propose the minimum solution and Essential User Experiences from the approved Desired Business Impact instead of asking the user to design the flow.",
  bugReport:
    "Section 2에서 데모 시나리오 내용을 먼저 요구하지 말고 비즈니스 임팩트에서 AI가 역설계해 제안해야 한다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      alpsLiteGuideText(2),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean with the complete Section 2 proposal and approval choices.`,
      `In the tail use AI_PROPOSES_SOLUTION, AI_PROPOSES_ESSENTIAL_EXPERIENCES, BUSINESS_IMPACT_TRACE, NO_SOLUTION_DESIGN_QUESTION, and APPROVAL_BEFORE_SAVE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
