import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "acceptance",
    text: "State release acceptance as every Required BR, FR, NFR and EC passing, and keep KPI-1 as a monitoring outcome rather than a release gate because the user did not confirm it as required.",
  },
  {
    id: "kpi",
    text: "Define KPI-1 by its business calculation (population, numerator, denominator, unit, direction, observation window) using the supplied 12% baseline and 15% target, without inventing other targets and without data collection, instrumentation, sample design or technology.",
  },
  {
    id: "tension",
    text: "Always propose a tension metric for KPI-1 with the abuse or opposite-failure scenario it exposes (for example merges that duplicate or drop items raising checkouts), offer adopting it as TM-1 or not, and show that the decision is recorded per KPI. A declined candidate never blocks completion. Present for approval without invoking tools or saving.",
  },
];

export function deterministicScore(input) {
  return responseChecks(input, {
    RELEASE_ACCEPTANCE: [],
    KPI_BUSINESS_CALCULATION: [],
    TENSION_PROPOSED: [],
    DECISION_RECORDED: [],
    APPROVAL_BEFORE_SAVE: [],
  });
}

const SOURCE = `
현재 Lite ALPS Sections 1-5가 승인되어 저장되었다.

1.2 Intent and Desired Outcome:
쇼핑객이 로그인해도 비회원 때 담은 상품을 그대로 이어서 구매해, 로그인 단계에서 포기되던 구매를 회복한다.
사용자는 "로그인 후 7일 안에 결제하는 비율을 지금 12%에서 15%로 올리고 싶다"고 말했다. 이 지표를 출시 조건으로 삼을지는 정하지 않았다.

승인된 식별자: BR-1, BR-2, FR-1, FR-2, NFR-1, EC-1, EC-2 (모두 Required).
정상적인 Section 6 다음 응답을 한국어로 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-success-criteria-records-tension",
  description:
    "Lite Success Criteria states release acceptance, defines KPIs by business calculation and always proposes a tension metric whose per-KPI decision is recorded.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(6),
      `\n---\n\n# This run`,
      SOURCE,
      `In the tail use RELEASE_ACCEPTANCE, KPI_BUSINESS_CALCULATION, TENSION_PROPOSED, DECISION_RECORDED, and APPROVAL_BEFORE_SAVE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
