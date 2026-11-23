import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 Lite ALPS Section 1이 승인되어 저장되었다.

Section 1 Business Context는 승인되어 저장되었다.

1.1 Target User and Core Problem:
비회원으로 상품을 담던 쇼핑객은 결제를 위해 로그인하면 담아 둔 장바구니가 사라져 다시 담거나 구매를 포기한다.

1.2 Intent and Desired Outcome:
쇼핑객이 로그인해도 비회원 때 담은 상품을 그대로 이어서 구매해, 로그인 단계에서 포기되던 구매를 회복한다.
회원이 이미 담아 둔 장바구니를 잃지 않는 것이 출시 속도보다 중요하다.

사용자는 같은 상품이 두 장바구니에 있으면 수량을 합산한다고 이미 정했다.
다른 회원의 장바구니는 절대 보이거나 바뀌면 안 된다는 개인정보 정책이 있다.
금전, 권한, 법률, 외부 약속과 관련해 사용자가 더 정해야 할 정책은 없다.
정상적인 Section 2 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-proposes-requirements-from-business-context",
  description:
    "Lite ALPS must propose identified Business Requirements with required flags, pass/fail criteria and basis from the approved Business Context instead of asking the user to list them, without technology.",
  bugReport:
    "Section 2에서 사용자가 요구사항을 직접 나열하게 하지 말고 승인된 비즈니스 맥락에서 AI가 BR-n과 판정 기준을 역설계해 제안해야 한다.",

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
      `In the tail use AI_PROPOSES_BUSINESS_REQUIREMENTS, REQUIREMENT_IDS_AND_FLAGS, PASS_FAIL_CRITERIA, NO_TECHNOLOGY, and APPROVAL_BEFORE_SAVE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
