import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ALPS_PLUGIN_ROOT,
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

/** The Full overview's Lite source derivation rules, which alps-init points to. */
function liteDerivationRules() {
  const overview = readFileSync(
    path.join(ALPS_PLUGIN_ROOT, "src", "templates", "overview.md"),
    "utf8",
  );
  const start = overview.indexOf("## Lite source derivation");
  return overview.slice(start, overview.indexOf("\n---", start));
}

const LITE_SOURCE = `
alps_document(action: 'status')는 다음을 보고했다.
Lite source: cart.lite.alps.xml
Lite coverage: 🟡 0/7 requirement IDs referenced — missing: BR-1, BR-2, FR-1, FR-2, NFR-1, EC-1, KPI-1

완료된 Lite 출처의 내용:
1.2 Intent and Desired Outcome: 쇼핑객이 로그인해도 비회원 때 담은 상품을 그대로 이어서 구매해 로그인 단계에서 포기되던 구매를 회복한다.
2.1 Business Requirements:
| BR-1 | 로그인하면 비회원 장바구니와 회원 장바구니가 하나가 되고 같은 상품 수량은 합산된다 | Required | 두 장바구니의 모든 상품이 한 번씩 보이고 수량이 합산된다 | 상품 책임자 결정 |
| BR-2 | 회원의 장바구니는 다른 회원에게 보이거나 바뀌지 않는다 | Required | 다른 회원의 요청은 장바구니를 보거나 바꾸지 못한다 | 개인정보 정책 |
3.1 Functional Requirements:
**FR-1: 로그인 시 비회원 장바구니 병합** (Required) — Given 비회원 셔츠 2개와 회원 셔츠 1개, When 로그인하면, Then 셔츠 3개가 보인다.
**FR-2: 병합된 장바구니로 결제** (Required) — Given 병합된 장바구니, When 결제를 시작하면, Then 모든 상품과 수량이 주문 확인에 보인다.
4.1 Non-Functional Requirements:
| NFR-1 | 병합된 장바구니가 빨리 보인다 | 피크 시간 로그인의 95%에서 로그인 후 2초 안에 보인다 | FR-1 | Required | 결제 경험 목표 |
5.1 Edge Cases:
| EC-1 | 네트워크 재시도로 같은 병합이 다시 요청된다 | FR-1, BR-1 | 수량은 한 번만 합산된다 | Required |
6.1 KPIs and Tension Metrics:
| KPI-1 | 비회원 구매 회복률 | 비회원 장바구니 로그인 후 7일 안에 결제한 회원 / 비회원 장바구니 로그인, 30일 | 관찰용 | 채택하지 않음 |
`;

export const obligations = [
  {
    id: "convert",
    text: "Propose the Section 6 Requirements Summary as a conversion of the Lite source: group FR-1 and FR-2 into vertical-slice Features with `Source requirements:` naming their FR IDs, and carry NFR-1 into 6.2 as a mandatory constraint keeping 2 seconds, 95% and peak sign-ins with an added measurement method and its NFR ID. Do not split Features by frontend/backend/database.",
  },
  {
    id: "no-reask",
    text: "Do not ask again for the target user, intent, merge rule, privacy rule or NFR threshold that Lite already answered, and do not add a business rule, value, permission or user-visible acceptance criterion without a Lite ID. Any question concerns only a technical-resolution choice.",
  },
  {
    id: "approval",
    text: "Present the draft for approval before saving; do not invoke tools or save. The required tail agrees with the visible response.",
  },
];

export function deterministicScore(input) {
  return responseChecks(input, {
    CONVERTS_LITE_FRS: [],
    KEEPS_LITE_NFR_VALUES: [],
    NO_BUSINESS_REASK: [],
    APPROVAL_BEFORE_SAVE: [],
  });
}

export default {
  name: "alps-full-derives-from-lite-without-reasking",
  description:
    "A Full ALPS derived from Lite converts Lite requirements into Section 6 with source IDs and unchanged values instead of re-asking business questions.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      liteDerivationRules(),
      alpsGuideText(6),
      `\n---\n\n# This run`,
      `새 Full ALPS를 Lite 출처로 초기화했고 Sections 1-4는 승인되어 저장되었다.`,
      LITE_SOURCE,
      `정상적인 Section 6 다음 응답을 한국어로 작성하라. 도구를 호출하거나 저장하지 마라.`,
      `In the tail use CONVERTS_LITE_FRS, KEEPS_LITE_NFR_VALUES, NO_BUSINESS_REASK, and APPROVAL_BEFORE_SAVE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
