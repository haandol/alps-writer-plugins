import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

const FLOW = `# 주문 업무 (영업운영팀, 2026-10)

## 1. 주문 제출
고객이 장바구니에서 주문을 제출하면 주문 시스템이 주문을 만든다.

## 2. 결제
주문이 만들어지면 결제 시스템이 결제를 요청하고, 결제 대행사가 승인하면 결제가 완료된다.
카드가 거절되면 주문은 결제 대기로 남는다.

## 3. 업무의 끝
주문 접수 업무는 결제가 완료된 뒤 고객에게 주문 확정 안내 메일을 보내는 것으로 끝난다.

## 4. 출고와 배송
결제가 완료되면 물류팀이 출고를 준비하고, 택배사가 배송을 추적한다.
`;

export default {
  name: "ontology-build-anchors-to-scope",
  description:
    "A build with a business scope keeps candidates inside it, asks about a differing document statement, reports out-of-scope content and unread material, and presents one report grouped by bounded context.",
  obligations: [
    {
      id: "anchored",
      text: "The candidates start when the customer submits an order and end when the payment is completed, the scope the user gave; no candidate process starts before that or ends after it.",
    },
    {
      id: "differing-statement",
      text: "The document's statement that the work ends with the order confirmation email after payment differs from the given end; the report turns it into a question for the user (with an identifier) instead of silently adopting or dropping it.",
    },
    {
      id: "out-of-scope",
      text: "Shipping preparation and delivery tracking are reported as out-of-scope content and are not candidates (no step, event, actor or policy candidate for them).",
    },
    {
      id: "unread",
      text: "docs/business/refund-flow.pdf (no text layer) and the password-protected 할부 sheet of docs/business/payment-terms.xlsx are reported as not read, each with its reason; the report does not describe them as examined or draw candidates from them.",
    },
    {
      id: "one-report",
      text: "The response is one report grouped by bounded context, with every question carrying an identifier the user can answer by; it does not stop to ask about elements one at a time.",
    },
  ],
  build(dir) {
    seedMapping(dir);
    write(dir, "docs/business/order-flow.md", FLOW);
    return buildPrompt(
      REPORT_REFERENCES,
      "This project has no saved ontology and no ADR documents.",
      "사용자: /ontology-build docs/business — 범위는 고객이 주문을 제출할 때 시작해서 결제가 완료되면 끝나는 업무로 잡아 줘.",
      "You read docs/business. Its contents:",
      "- docs/business/order-flow.md:\n```markdown\n" + FLOW + "```",
      "- docs/business/refund-flow.pdf: the PDF has no text layer (a scanned image); no text could be extracted.",
      "- docs/business/payment-terms.xlsx: the 결제수단 sheet says 카드와 계좌이체를 받는다; the 할부 sheet is password-protected and could not be opened.",
      "Do not call tools or write files. Show the report you would present before opening the web question session: the applied scope, the candidates grouped by bounded context with their source verdicts, out-of-scope content, material you could not read, and the questions.",
    );
  },
};
