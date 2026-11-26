// A Full ALPS Feature digest must surface an external factual claim that the
// document and supplied sources do not establish as an unverified basis with an
// item-scoped research offer, while keeping approval choices, starting no
// research, and making no offer for a chosen policy.
import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
Section 7 Feature: 결제 재시도

사용자는 카드 결제가 실패하면 자동으로 다시 시도받는다.
- 결제 대행사 API는 가맹점당 초당 100건까지만 받는다고 들었다. 확인한 자료는 없다.
- 재시도는 최대 3번까지 한다. 이것은 우리 회사가 정한 정책이다.
- 3번 모두 실패하면 사용자에게 다른 결제 수단을 고르라고 안내한다.
- Demo checkpoint: 실패한 결제가 재시도 후 성공으로 바뀌어 주문 화면에 보인다.
`;

export const obligations = [
  {
    id: "flags-unverified-basis",
    text: "The visible digest marks the payment provider's 100-requests-per-second limit, which the user only heard about, as an unverified basis among the unresolved items and offers to research only that item before approval.",
  },
  {
    id: "no-research-started",
    text: "The reply does not claim to have checked the provider's documentation or any other source, does not present the 100-per-second limit as confirmed, and starts no research.",
  },
  {
    id: "choices-kept",
    text: "The visible digest still offers approve, revise and defer, and makes clear that approving without research keeps the limit unverified. Making research a required step before approval is a failure.",
  },
  {
    id: "no-offer-for-policy",
    text: "The reply makes no research offer for the company's own three-retry policy and keeps that value unchanged with its basis.",
  },
].map((item) => ({ ...item, label: `full digest: ${item.id}` }));

export default {
  name: "alps-approval-flags-unverified-external-basis",
  description:
    "A Full ALPS Feature digest must mark an external claim the document and supplied sources do not establish as an unverified basis with an item-scoped research offer, keep approval choices, start no research, and make no offer for a chosen policy.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Produce the user-facing approval digest only; do not call tools or print the full Feature.`,
      `Keep it readable as raw text and end with approve, revise, and defer choices.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
