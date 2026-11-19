import { seedIndexedAdrs, seedMapping } from "../lib/harness.mjs";
import { buildPrompt, quoteApprovalMapping } from "../lib/ontology-fixtures.mjs";

const MAPPING = quoteApprovalMapping();

export default {
  name: "ontology-build-unanswered-review-choice",
  description:
    "A reply that does not answer the pre-build ADR review question is not recorded as a review route, and the build does not start until the user chooses.",
  obligations: [
    {
      id: "not-recorded",
      text: "The user's reply does not choose between reviewing the ADRs first and building directly; the response records no `adr-review` preference (neither review-first nor build-direct).",
    },
    {
      id: "still-asks",
      text: "It answers the user's question and keeps the review choice open (asks it again or says it is waiting for it); it neither starts the review nor drafts model candidates yet.",
    },
  ],
  build(dir) {
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    return buildPrompt(
      [
        "skills/ontology-build/references/preferences.md",
        "skills/ontology-build/references/pre-build-adr-review.md",
      ],
      'This project has no saved ontology. It holds docs/adr/sales/quotes/0001-quote-approval.md. The project preference helper\'s `show` printed: {"setup":"build"}',
      "You asked: “기존 ADR을 먼저 리뷰하고 발견 사항을 반영할까요, 아니면 현재 문서로 바로 구축할까요?”",
      "사용자: 그런데 견적 반려도 이 모델에 들어가는 거지?",
      "Do not call tools or write files. Respond to the user and list any command you would run, including any preference you record.",
    );
  },
};
