export const obligations = [
  {
    id: "demo",
    text: "Show a concrete complete Section 8 demo for the supplied cart-merge requirements: starting state, representative input, ordered user actions and visible outcomes. Every step names the FR and EC IDs it shows, and the demo shows every Required FR (FR-1 merge on sign-in and FR-2 checkout of the merged cart).",
  },
  {
    id: "coverage",
    text: "Include the relevant EC-1 counterexample (a retried merge must not add quantities twice) and make the overall pass require every shown FR and EC criterion. Do not present a passing demo as proof of recovered purchases.",
  },
  {
    id: "approval",
    text: "Show the full proposed scenario before offering approval, revision or deferral. Do not ask the user to supply the demo flow, invoke tools or save content.",
  },
];

import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 Lite ALPS Sections 1-6이 승인되어 저장되었고, 명시적 제외 범위는 없다.

1.2 Intent and Desired Outcome:
쇼핑객이 로그인해도 비회원 때 담은 상품을 그대로 이어서 구매해, 로그인 단계에서 포기되던 구매를 회복한다.

2.1 Business Requirements:
| ID | Business requirement | Required | Pass/fail criterion | Basis |
| BR-1 | 로그인하면 비회원 장바구니와 회원 장바구니가 하나가 되고 같은 상품 수량은 합산된다 | Required | 두 장바구니의 모든 상품이 한 번씩 보이고 수량이 합산된다 | 상품 책임자 결정 |

3.1 Functional Requirements:
**FR-1: 로그인 시 비회원 장바구니 병합** (Required)
- Given 비회원 장바구니에 셔츠 2개와 신발 1개, 회원 장바구니에 셔츠 1개가 있을 때, When 로그인하면, Then 셔츠 3개와 신발 1개가 보인다.
**FR-2: 병합된 장바구니로 결제** (Required)
- Given 병합된 장바구니, When 결제를 시작하면, Then 병합된 모든 상품과 수량이 주문 확인에 보인다.

5.1 Edge Cases:
| ID | Situation | Related | Expected business outcome | Required |
| EC-1 | 네트워크 재시도로 같은 병합이 다시 요청된다 | FR-1, BR-1 | 수량은 한 번만 합산된다 | Required |

정상적인 Section 8 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-generates-demo-from-functional-requirements",
  description:
    "Lite ALPS must reverse-engineer and show a concrete Demo Scenario that shows every Required FR with its FR and EC IDs, without asking the user to design the flow.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(8),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
