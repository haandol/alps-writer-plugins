import { seedIndexedAdrs, seedMapping, write } from "../lib/harness.mjs";
import {
  buildPrompt,
  commitFixture,
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

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

export default {
  name: "ontology-build-hands-off-adr-content",
  description:
    "After the report is confirmed, the approval summary asks only what the save needs: affected ADR revisions, processes becoming Proposed, realization candidates for unrealized system steps and ADR candidates for the transferred content.",
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
    return buildPrompt(
      [
        "references/ontology.md",
        "skills/ontology-build/references/candidate-review.md",
        "skills/ontology-build/references/save.md",
        // save.md requires reading the approved change unit before preparing the approval.
        "references/change-unit.md",
      ],
      "Earlier in this session you presented the candidate report for adding point payments to the saved model. Its last part was:",
      "```markdown\n" + REPORT + "\n```",
      "사용자: 리포트 후보는 전부 그대로 확인했어. Q1은 N1, N2 둘 다 넘겨 줘. Q2는 네가 제안해 줘.",
      "The realizing ADR you read for the capture step (its index record realizes payment.request-payment and payment.capture-payment), docs/adr/payments/0001-card-capture.md:",
      "```markdown\n" + PAYMENTS_ADR + "```",
      "You built the save draft from every current model document plus the confirmed candidates and ran `impact`. It printed:",
      "```text\n" + IMPACT + "\n```",
      "Do not call tools or write files. Show the approval summary you present now.",
    );
  },
};
