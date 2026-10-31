import {
  alpsLiteGuideText,
  alpsLiteResumeText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SECTION_ONE = `
Section 1은 승인되어 저장되었다.

Target User and Core Problem:
해외 출장을 준비하는 직장인은 실제 업무 상황과 비슷한 영어 대화를 짧게 연습할 방법이 없다.

Desired Business Impact:
직장인은 출장 전에 자기소개 대화를 반복 연습해 준비 시간을 줄이고 실제 대화를 시작할
준비감을 얻는다.

금전, 권한, 개인정보, 안전, 외부 약속과 관련해 사용자가 정해야 할 추가 정책은 없다.
`;

export default {
  name: "lite-alps-resume-preserves-proposal-first",
  description:
    "Resuming a Lite document must preserve proposal-first Sections 2 and 4 instead of applying Full ALPS's blanket no-auto-generation guidance.",
  bugReport:
    "Lite 문서를 load하면 공통 resume banner가 DO NOT auto-generate content라고 지시해 Section 2와 4의 working-backwards 제안을 막았다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    const resume = alpsLiteResumeText(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      `\n---\n\n# Actual load_alps_document response`,
      resume,
      `\n---\n\n# Approved document context`,
      SECTION_ONE,
      `Continue at the first incomplete required Section. Write the normal next response in Korean.`,
      `Do not call tools or save content.`,
      `In the tail use PROFILE_AWARE_RESUME, AI_PROPOSES_SOLUTION, NO_SOLUTION_DESIGN_QUESTION, and APPROVAL_BEFORE_SAVE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
