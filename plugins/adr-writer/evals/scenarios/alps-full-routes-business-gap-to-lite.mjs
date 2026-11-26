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
    id: "route",
    text: "While converting FR-1 into its Section 7 Feature, recognize that the Lite source does not say whether a coupon applied in the guest cart stays applied after the merge, which changes the amount the shopper pays. Present it as a Lite change proposal that names the affected Lite IDs (at least FR-1 or BR-1), to be approved and saved in the Lite document, instead of choosing a coupon rule inside Full.",
  },
  {
    id: "hold",
    text: "Do not save or finalize the dependent Full Feature content before the Lite proposal is decided, and say that a declined proposal continues with the current Lite meaning. Independent technical content may still be drafted. Keep NFR-1 and EC-1 values unchanged.",
  },
  {
    id: "scope",
    text: "Do not invoke tools or save.",
  },
];

export default {
  name: "alps-full-routes-business-gap-to-lite",
  description:
    "A Full ALPS derived from Lite routes a missing money-affecting business rule to a Lite change proposal instead of deciding it in Full.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      liteDerivationRules(),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      `새 Full ALPS를 Lite 출처로 초기화했고 Sections 1-6은 승인되어 저장되었다. 5.1의 F1은 FR-1을 전환한다.`,
      LITE_SOURCE,
      `기술 전환 중 확인한 사실: 비회원 장바구니에는 쿠폰을 적용할 수 있지만, Lite는 병합 뒤 그 쿠폰이 유지되는지 정하지 않았다.`,
      `정상적인 Section 7의 F1 다음 응답을 한국어로 작성하라. 도구를 호출하거나 저장하지 마라.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
