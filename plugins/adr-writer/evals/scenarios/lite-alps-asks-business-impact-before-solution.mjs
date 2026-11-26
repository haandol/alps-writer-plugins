export const obligations = [
  {
    id: "outcome",
    text: "Ask one focused question about the missing Intent and Desired Outcome: what should change for the shopper, the final outcome, and why it matters. Wait for the answer before drafting or saving.",
  },
  {
    id: "sequence",
    text: "Do not ask the user for a solution, screen, technology, requirement list or demo flow at this stage. Mentioning that requirements will be proposed later is not prematurely asking for them.",
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
새 Lite ALPS 작성을 시작했다.

1.1 Target User and Core Problem:
비회원으로 상품을 담던 쇼핑객은 결제를 위해 로그인하면 담아 둔 장바구니가 사라져 다시 담거나 구매를 포기한다.

Intent and Desired Outcome은 아직 설명하지 않았다.
정상적인 Section 1 다음 대화 한 단계만 진행하라. 도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-asks-business-impact-before-solution",
  description:
    "Lite ALPS must ask for the missing Intent and Desired Outcome before discussing a solution, requirements, technology, or demo flow.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
