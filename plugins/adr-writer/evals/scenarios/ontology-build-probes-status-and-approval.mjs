import { seedIndexedAdrs, seedMapping, write } from "../lib/harness.mjs";
import {
  adrDocument,
  commitFixture,
  PAYMENTS_ADR,
  probeBatch,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// q1: Accepted ADRs that only passed a document review.
const QUOTE_MAPPING = {
  categories: {
    "sales/quotes": {
      feature: "Quote approval",
      dependsOn: [],
      adrs: [
        {
          path: "docs/adr/sales/quotes/0001-quote-approval.md",
          status: "Accepted (2026-10-01)",
          summary: "A sales manager approves or returns a submitted quote",
        },
      ],
    },
  },
};
const QUOTE_ADR = adrDocument({
  title: "Approve submitted quotes",
  purpose: "A quote reaches the customer only after a sales manager approves it.",
  decision: "A sales manager approves or returns each submitted quote.",
  rows: [
    "A submitted quote is approved or returned by a sales manager.",
    "A returned quote can be fixed and resubmitted by the salesperson.",
  ],
});

// q2: the approval summary after the user confirmed the report.
const REPORT = `## 모델에 담지 않은 내용
- N1. 카드 결제가 실패하면 10초 간격으로 세 번 다시 시도한다. (결제 운영 안내 2절) — 결제 확인 단계를 실현하는 Payments 기능의 값
- N2. 주문 상태는 접수 → 결제 대기 → 확정 → 취소로만 바뀐다. (주문 운영 안내 1절) — 주문 확정과 결제 기능이 함께 정하는 상태 기계

## 질문
- Q1. N1·N2를 ADR 작성 후보로 넘길까요?
- Q2. 포인트 차감 단계(payment.deduct-points, 시스템 단계)를 실현하는 기능이 아직 없습니다. 어떻게 할까요?`;
const IMPACT = `semantic diff: added 1 Step (payment.deduct-points); changed 1 Process (payment.take-payment: hasStep)
processes that become Proposed: payment.take-payment "Take a payment" (Accepted (2026-10-01))
affected ADRs: docs/adr/payments/0001-card-capture.md (revision 3f2a9c1)
index link changes: none
system steps without a realizing feature: payment.deduct-points "Deduct points"
glossary cleanup: none
base hash: 9b1e…`;

export default probeBatch({
  name: "ontology-build-probes-status-and-approval",
  agentTimeoutMs: 600_000, // two answers, one of them a full approval summary
  description:
    "Two independent build probes in one run: q1 drafts a model from Accepted ADRs that only passed a document review without taking their Status or that review as proof the code implements them, so implementation conformance stays to be checked; q2, after the report is confirmed, has the approval summary ask only what the save needs — affected ADR revisions, processes becoming Proposed, realization candidates for unrealized system steps and ADR candidates for the transferred content.",
  references: [
    "references/ontology.md",
    "skills/ontology-build/references/pre-build-adr-review.md",
    "skills/ontology-build/references/candidate-review.md",
    "skills/ontology-build/references/save.md",
    // save.md requires reading the approved change unit before preparing the approval.
    "references/change-unit.md",
  ],
  probes: [
    {
      id: "q1",
      obligations: [
        {
          id: "not-from-status",
          text: "The response does not claim the code implements the quote ADR because it is Accepted or because the document review passed; it treats implementation conformance as not yet verified.",
        },
        {
          id: "verify-or-mark",
          text: "It either checks conformance for the relevant ADR through the implementation review (/adr-impl-review) or drafts from the ADR as the decision source while marking implementation behaviour as unverified; it does not confirm in the model any business behaviour neither the ADR nor a verified source establishes.",
        },
      ],
      build(dir) {
        seedMapping(dir, QUOTE_MAPPING);
        seedIndexedAdrs(dir, QUOTE_MAPPING, {
          "docs/adr/sales/quotes/0001-quote-approval.md": QUOTE_ADR,
        });
        return [
          "This project has no saved ontology. The user chose to review the ADRs first; `/adr-review docs/adr/sales/quotes` (a document-quality review, which reads no code) passed with no findings. No implementation review has been run on this ADR.",
          "docs/adr/sales/quotes/0001-quote-approval.md:\n```markdown\n" + QUOTE_ADR + "```",
          "사용자: 리뷰도 통과했고 Accepted니까 구현도 이대로라고 보고 바로 모델 만들어 줘.",
          "Do not call tools or write files. Respond with how you use this ADR for the model and what you check first.",
        ];
      },
    },
    {
      id: "q2",
      obligations: [
        {
          id: "transfer-targets",
          text: "The retry rule (N1) appears as an update candidate for the payments ADR that realizes its step (docs/adr/payments/0001-card-capture.md), and the order state machine (N2) appears as a context-level ADR candidate, since several features decide it together.",
        },
        {
          id: "unrealized-step",
          text: "The system step Deduct points, which no feature realizes, has a realization candidate (an update of an existing ADR or a new ADR candidate) or the stated reason there is none.",
        },
        {
          id: "asks-only",
          text: "The approval summary asks only for what the save needs — the affected payments ADR at its revision (its drafted edit, or the stated reason its current contract stays unrevised), that the Accepted Take a payment process becomes Proposed, the realization candidate and the transferred ADR candidates (index-link changes and glossary cleanup are none). It does not ask again to confirm the elements and relations the user already confirmed in the report.",
        },
      ],
      build(dir) {
        const mapping = settledMapping();
        seedMapping(dir, mapping);
        seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
        write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
        commitFixture(dir);
        return [
          "Earlier in this session you presented the candidate report for adding point payments to the saved model. Its last part was:",
          "```markdown\n" + REPORT + "\n```",
          "사용자: 리포트 후보는 전부 그대로 확인했어. Q1은 N1, N2 둘 다 넘겨 줘. Q2는 네가 제안해 줘.",
          "The realizing ADR you read for the capture step (its index record realizes payment.request-payment and payment.capture-payment), docs/adr/payments/0001-card-capture.md:",
          "```markdown\n" + PAYMENTS_ADR + "```",
          "You built the save draft from every current model document plus the confirmed candidates and ran `impact`. It printed:",
          "```text\n" + IMPACT + "\n```",
          "Do not call tools or write files. Show the approval summary you present now.",
        ];
      },
    },
  ],
});
