import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "optional",
    text: "Skip optional Section 7 because the user stated no explicit exclusions; do not invent excluded users, flows, capabilities or claims to fill it. Continue to the required Section 8 Demo Scenario rather than declaring all work complete.",
  },
  {
    id: "independence",
    text: "Keep the work inside Lite ALPS: do not start, read or update a Full ALPS document or declare Lite complete while Section 8 remains. The required tail agrees with the visible response.",
  },
];

/** Keep the response-only scope and requested records exact; judge meaning with GEval. */
export function deterministicScore(input) {
  return responseChecks(input, {
    SKIP_SECTION_7: [],
    NO_INVENTED_EXCLUSIONS: [],
    LITE_INDEPENDENT: [],
    DEMO_READY: [],
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
현재 8-Section Lite ALPS에서 Sections 1-6은 승인되어 저장되었다.
사용자는 "명시적으로 제외할 항목은 없다. 이제 Lite 문서를 마무리해줘"라고
답했다. 정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export default {
  name: "lite-alps-skips-empty-optional-section",
  description:
    "Current Lite ALPS must skip optional Section 7 when no explicit exclusions exist and continue to the required Demo Scenario.",
  bugReport: "무엇을 안 할것인가는 옵셔널 섹션이야.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean with the normal completion guidance.`,
      `In the tail use SKIP_SECTION_7, NO_INVENTED_EXCLUSIONS, LITE_INDEPENDENT, and DEMO_READY once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
