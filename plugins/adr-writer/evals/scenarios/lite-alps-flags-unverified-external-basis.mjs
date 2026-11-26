// A Lite Section digest must surface an external factual claim that the
// document and supplied sources do not establish as an unverified basis, and
// offer research for that item only — without adding a question step, starting
// research, blocking approval, or offering research for chosen policies and
// facts a supplied source already establishes.
//
// The brief mixes three bases: a retention period the user "heard" a law
// requires (unverified external claim), the company's own deletion policy
// (chosen policy) and a response-time promise quoted from the supplied customer
// contract (established fact). Only the first earns an offer.
import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 Lite ALPS Section 1이 승인되어 저장되었다.

1.1 Target User and Core Problem:
고객센터 상담원은 지난 상담 녹취를 찾느라 통화 중 고객을 오래 기다리게 한다.

1.2 Intent and Desired Outcome:
상담원이 통화 중에 고객의 지난 상담 녹취와 요약을 바로 찾아, 고객 대기 시간을 줄이고 문의를 한 번에 해결한다.

Section 2를 위해 사용자가 이미 말한 내용:
- 상담 녹취는 개인정보 관련 법 때문에 3년 동안 보관해야 한다고 들었다. 근거 자료는 따로 없다.
- 회원이 탈퇴하면 7일 안에 녹취 요약을 지운다. 이것은 우리 회사가 정한 정책이다.
- 고객사 계약서 사본(사용자가 제공): "상담 이력 조회 요청에는 영업일 1일 안에 응답한다."

금전, 권한, 외부 약속과 관련해 사용자가 더 정해야 할 정책은 없다.
정상적인 Section 2 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export const obligations = [
  {
    id: "flags-unverified-basis",
    text: "The visible approval digest marks the three-year recording retention attributed to a privacy law the user only heard about as an unverified basis among the unresolved items, and offers to research only that item before approval.",
  },
  {
    id: "no-research-started",
    text: "The reply does not claim to have researched, verified or cited the law, does not present the three-year basis as confirmed, and starts no research; the offer waits for the user's request.",
  },
  {
    id: "approval-not-blocked",
    text: "The visible digest still offers approve, revise and defer for Section 2, and makes clear that approving without research keeps the retention basis unverified rather than verified. Making research a required step before approval is a failure.",
  },
  {
    id: "no-offer-for-policy-or-established",
    text: "The reply makes no research offer for the company's own seven-day deletion policy or for the one-business-day response promise that the supplied customer contract already establishes.",
  },
  {
    id: "requirements-preserved",
    text: "The proposed BRs keep the three-year retention, the seven-day deletion after withdrawal and the one-business-day response promise with their values unchanged, each with its basis, and include no technology.",
  },
];

export default {
  name: "lite-alps-flags-unverified-external-basis",
  description:
    "A Lite Section digest must mark an external factual claim the document and supplied sources do not establish as an unverified basis and offer item-scoped research without adding a question step, starting research, blocking approval, or offering it for chosen policies and established facts.",
  bugReport:
    "작성 중에 근거 없는 법령 주장 위에서 Section을 승인했고, 문서를 다 쓴 뒤 근거 검토에서야 고쳐야 했다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      alpsLiteGuideText(2),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean with the complete Section 2 proposal and its approval digest and choices.`,
      `In the tail use UNVERIFIED_BASIS for each item you mark unverified, RESEARCH_OFFER once per offered item,`,
      `and APPROVAL_CHOICES once.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
