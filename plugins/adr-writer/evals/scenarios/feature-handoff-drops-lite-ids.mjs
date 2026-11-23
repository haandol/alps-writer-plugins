import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "contract",
    text: "Route F1's merge rule (summed quantities), the 2-second / 95% / peak-sign-in responsiveness requirement, the retry-once guarantee and the privacy rule to an ADR-owned requirement contract with observable evidence, and KPI-1 with its tension metric TM-1 and monitoring meaning to observable evidence.",
  },
  {
    id: "no-lite-ids",
    text: "Do not carry the `Source requirements:` marker, Lite requirement IDs (BR-1, FR-1, NFR-1, EC-1, KPI-1, TM-1) or the Lite document path into the proposed ADR content or mapping; treat them as legacy planning context, and do not propose reading the Lite document or treating it as a current reference level.",
  },
  {
    id: "scope",
    text: "Return only the pre-draft analysis; do not write files. The required tail agrees with the visible response.",
  },
];

export function deterministicScore(input) {
  return responseChecks(input, {
    LITE_IDS_LEGACY: [],
  });
}

const BRIEF = `
이 Full ALPS는 Lite 출처(cart.lite.alps.xml)에서 파생되었다.

F1: 로그인 시 비회원 장바구니 병합
Source requirements: BR-1, BR-2, FR-1, NFR-1, EC-1, KPI-1, TM-1
- 로그인하면 비회원 장바구니와 회원 장바구니가 하나가 되고 같은 상품 수량은 합산된다 (상품 책임자 결정).
- 회원의 장바구니는 다른 회원에게 보이거나 바뀌지 않는다 (개인정보 정책).
- 병합된 장바구니는 피크 시간 로그인의 95%에서 로그인 후 2초 안에 보인다.
- 네트워크 재시도로 같은 병합이 다시 요청되어도 수량은 한 번만 합산된다.
- KPI-1 비회원 구매 회복률은 관찰용이며, TM-1 장바구니 불만 비율을 함께 본다 (관찰용).
`;

export default {
  name: "feature-handoff-drops-lite-ids",
  description:
    "/feature-to-adr transfers a Lite-derived Feature's contracts and metric pairs without carrying Lite IDs, Source requirements markers or the Lite path into ADRs.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("feature-to-adr"),
      `\n---\n\n# This run`,
      `Analyze the following completed ALPS feature. Do not write files; return only the`,
      `decision-discovery result that the skill would show before drafting.`,
      BRIEF,
      `Follow the skill's normal Feature result format, including ADR-owned,`,
      `Implementation discretion, Legacy planning context, Transfer coverage, and Result.`,
      `In the machine-readable tail use ADR_CANDIDATE as the tag for each proposed ADR and LITE_IDS_LEGACY once.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
