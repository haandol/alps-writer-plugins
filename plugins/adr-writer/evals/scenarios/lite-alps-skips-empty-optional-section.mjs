import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "optional",
    text: "Skip optional Section 3 because the user stated no explicit exclusions; do not invent excluded personas, features or screens to fill it. Continue to the required Section 4 Demo Scenario rather than declaring all work complete.",
  },
  {
    id: "independence",
    text: "Keep completion inside Lite ALPS without proposing a Full ALPS transition or another planning document. Explaining that Full ALPS is not required is allowed. The required tail agrees with the visible response.",
  },
];

/** Keep the response-only scope and requested records exact; judge meaning with GEval. */
export function deterministicScore(input) {
  return responseChecks(input, {
    SKIP_SECTION_3: [],
    NO_INVENTED_EXCLUSIONS: [],
    LITE_INDEPENDENT: [],
    DEMO_READY: [],
  });
}

import {
  alpsLiteGuideText,
  alpsSkillText,
  expectNoText,
  expectText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 4-Section Lite ALPS에서 Sections 1-2는 승인되어 저장되었다.
사용자는 "첫 PoC에서 명시적으로 제외할 항목은 없다. 이제 Lite 문서를 마무리해줘"라고
답했다. 정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export default {
  name: "lite-alps-skips-empty-optional-section",
  description:
    "Current Lite ALPS must skip optional Section 3 when no explicit exclusions exist and continue to the required Demo Scenario.",
  bugReport: "무엇을 안 할것인가는 옵셔널 섹션이야.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(3),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean with the normal completion guidance.`,
      `In the tail use SKIP_SECTION_3, NO_INVENTED_EXCLUSIONS, LITE_INDEPENDENT, and DEMO_READY once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      expectText(tail.raw, /SKIP_SECTION_3/i, "skips optional Section 3"),
      expectText(
        tail.raw,
        /NO_INVENTED_EXCLUSIONS/i,
        "does not invent exclusions to fill the template",
      ),
      expectText(tail.raw, /LITE_INDEPENDENT/i, "keeps Lite completion independent from Full ALPS"),
      expectText(tail.raw, /DEMO_READY/i, "continues to required Demo Scenario"),
      expectNoText(
        visible,
        /Full ALPS|\/alps-init|다음 문서|후속 문서|구현 준비|Feature ID/i,
        "does not suggest a Full ALPS transition or extra planning",
      ),
      expectNoText(
        visible,
        /제외 범위\s*[:：]\s*\S|지원하지 않|다루지 않.{0,80}(기능|사용자|화면)/i,
        "does not fabricate exclusion content",
      ),
    ];
  },
};
