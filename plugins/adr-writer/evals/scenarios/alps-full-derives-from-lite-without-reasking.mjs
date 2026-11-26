import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";
import { LITE_SOURCE, liteDerivationRules } from "../lib/lite-derivation.mjs";

export const obligations = [
  {
    id: "convert",
    text: "Propose the Section 5 Requirements Summary as a conversion of the Lite source: group FR-1 and FR-2 into vertical-slice Features with `Source requirements:` naming their FR IDs, and carry NFR-1 into 5.2 as a mandatory constraint keeping 2 seconds, 95% and peak sign-ins with an added measurement method and its NFR ID. Lite never defines the peak period NFR-1 is measured in: do not define or assume it in Full, raise it as a Lite change proposal naming NFR-1, and keep the Full NFR to how the defined target is measured. Do not split Features by frontend/backend/database.",
  },
  {
    id: "no-reask",
    text: "Do not ask again for the target user, intent, merge rule, privacy rule or NFR threshold that Lite already answered, and do not add a business rule, value, permission or user-visible acceptance criterion without a Lite ID. Any direct question concerns only a technical-resolution choice; a missing business meaning such as the undefined peak period is a Lite change proposal, not a direct Full question.",
  },
  {
    id: "approval",
    text: "Present the draft for approval before saving; do not invoke tools or save.",
  },
];

export default {
  name: "alps-full-derives-from-lite-without-reasking",
  description:
    "A Full ALPS derived from Lite converts Lite requirements into Section 5 with source IDs and unchanged values instead of re-asking business questions.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      liteDerivationRules(),
      alpsGuideText(5),
      `\n---\n\n# This run`,
      `새 Full ALPS를 Lite 출처로 초기화했고 Sections 1-4는 승인되어 저장되었다.`,
      LITE_SOURCE,
      `정상적인 Section 5 다음 응답을 한국어로 작성하라. 도구를 호출하거나 저장하지 마라.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
