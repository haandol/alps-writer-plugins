import { seedIndexedAdrs, seedMapping, write } from "../lib/harness.mjs";
import {
  adrDocument,
  buildPrompt,
  commitFixture,
  REPORT_REFERENCES,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

const DOC = `# 결제 업무 개편 (재무팀, 2026-11)

1. 주문이 만들어져도 결제를 자동으로 요청하지 않는다. "새 주문에 결제 요청" 정책은 폐지하고, 고객이 결제 버튼을 누르면 결제를 요청한다.
2. 결제를 요청할 때 고객은 카드와 포인트 중 결제 수단을 고른다.
3. 포인트로 결제하면 결제 대행사를 거치지 않고 포인트를 차감해 결제를 마친다.
`;
// A current note from another team that describes the amount differently, stating no change.
const NOTE = `# 정산 운영 메모 (정산팀, 2026-11)

결제 금액은 주문 금액에서 쿠폰 할인을 뺀 금액이다.
`;
const POINTS_ADR = adrDocument({
  title: "Deduct points for a purchase",
  purpose: "A customer can spend wallet points.",
  decision: "Deduct the spent points from the customer's wallet in one operation.",
  rows: ["A deduction never leaves a wallet below zero."],
});
const MAPPING = settledMapping({
  points: {
    feature: "Point wallet",
    adrs: [
      {
        path: "docs/adr/points/0001-deduct-points.md",
        status: "Accepted (2026-10-01)",
        summary: "points are deducted from the wallet in one operation",
      },
    ],
    realizes: [],
    dependsOn: [],
  },
});

export default {
  name: "ontology-build-diffs-current-model",
  agentTimeoutMs: 600_000, // a full candidate report is a long answer
  description:
    "Extending a saved model shows a semantic diff against current elements, proposes deletion only where a document retires an element, keeps a conflict with the model a question, and proposes feature links with reasons, including a feature with an empty realization record.",
  obligations: [
    {
      id: "diff",
      text: "The report shows the semantic diff against the current model: each added, changed or deleted candidate appears with the current element it is compared with (for example the current Request the payment step and the current Request payment for a new order policy).",
    },
    {
      id: "deletion-only-when-stated",
      text: "The ordering process's elements and the Capture the payment step, which the documents do not cover, are not deletion candidates. Each deletion candidate traces to a retirement or change a document states — such as the retired Request payment for a new order policy and the relations it carries.",
    },
    {
      id: "conflict-question",
      text: "The settlement note's coupon-discounted payment amount conflicts with the current Payment covers the order rule without stating a change. It stays a question for the user and the report's diff proposes no change to that rule until the user decides.",
    },
    {
      id: "link-candidates",
      text: "The report proposes feature-to-step link candidates with their reasons, and includes the Point wallet feature whose realization record is empty (for a point-deduction step). It does not change the ADR index before the user confirms.",
    },
  ],
  build(dir) {
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/points/0001-deduct-points.md": POINTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    write(dir, "docs/finance/payment-update.md", DOC);
    write(dir, "docs/finance/settlement-note.md", NOTE);
    return buildPrompt(
      REPORT_REFERENCES,
      "This project has a saved, committed ontology (docs/ontology/ordering.ttl) and an ADR index. The user asked to extend the model with a new document.",
      "사용자: /ontology-build docs/finance",
      "docs/ontology/ordering.ttl:\n```turtle\n" + SETTLED_MODEL + "```",
      "docs/adr/.mapping.json:\n```json\n" + JSON.stringify(MAPPING) + "\n```",
      "docs/adr/points/0001-deduct-points.md:\n```markdown\n" + POINTS_ADR + "```",
      "docs/finance/payment-update.md:\n```markdown\n" + DOC + "```",
      "docs/finance/settlement-note.md:\n```markdown\n" + NOTE + "```",
      "Do not call tools or write files. Show the report's semantic diff, the link candidates and the questions, and say whether any project file changes at this point.",
    );
  },
};
