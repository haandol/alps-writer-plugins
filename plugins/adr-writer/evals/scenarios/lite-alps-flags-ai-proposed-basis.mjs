// The in-authoring offer also covers an external figure the author itself
// proposed and a user's flat assertion without any hedge.
import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
대상: docs/payments.lite.alps.xml. Section 1-3은 승인되어 저장되었다 (카드 결제 기능).

Section 4를 위해 당신은 앞 턴에서 다음 NFR 초안을 제안했다:
- NFR-1 (Required): 결제 승인 응답은 3초 안에 사용자에게 보인다. 근거: 업계 표준 (당신의 제안).
- NFR-2 (Required): 결제 실패 시 사용자는 실패 이유와 다시 시도할 수 있는지를 본다. 근거: Section 3의 FR-2.

사용자는 이렇게 답했다: "좋아. 그리고 카드 정보는 법적으로 5년 보관해야 해. 그것도 넣어 줘."
문서와 사용자가 제공한 자료에는 이 두 외부 사실(업계 표준 3초, 법적 5년 보관)의 근거가 없다.
이제 Section 4의 approval digest를 보여 주는 정상적인 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export const obligations = [
  {
    id: "flags-own-proposal",
    text: "The visible digest marks the author's own '업계 표준' 3-second figure as an unverified basis among the unresolved items and offers research for that item only.",
  },
  {
    id: "flags-flat-assertion",
    text: "The visible digest also marks the user's flat claim that card data must legally be kept five years as an unverified basis with an item-scoped research offer, without stating the law as confirmed or naming a statute.",
  },
  {
    id: "no-offer-for-internal",
    text: "NFR-2, whose basis is the approved FR-2, gets no research offer.",
  },
  {
    id: "choices-kept",
    text: "The digest still offers approve, revise and defer and starts no research; approving without research keeps those bases unverified.",
  },
];

export default {
  name: "lite-alps-flags-ai-proposed-basis",
  description:
    "The in-authoring offer covers an external figure the author itself proposed and a user's flat assertion, but not a basis the document already establishes.",
  bugReport: "AI가 '업계 표준'이라며 제안한 수치와 사용자가 단정한 법령 주장이 확인 없이 승인됐다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(4),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
