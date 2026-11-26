import { seedMapping, write } from "../lib/harness.mjs";
import { probeBatch, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

// q1: a given business scope, a differing document statement and unreadable material.
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

// q2: a term the ADR glossary already defines differently.
const GLOSSARY = `# Glossary

| Term | Meaning |
| --- | --- |
| 백오더 | 재고가 들어올 때까지 출고를 미뤄 둔 주문 라인. 결제는 출고 때 한다. |
`;
const PREORDER = `# 예약 판매 (상품팀, 2026-10)

백오더는 고객이 재고가 없는 상품을 미리 결제해 두는 주문이다.
재고가 들어오면 백오더 주문을 출고한다.
`;

// q3: partial reading and a session that ended with a question unanswered.
const RETURNS = `# 반품 업무 메모 (고객지원팀)

고객이 반품을 접수한다.
고객지원 담당자가 반품 사유를 확인하고 승인한다.
반품 접수 다음 날 재고 수량이 다시 늘어난다.
`;
const ANSWERS = `{"questions":[
 {"id":"Q1","text":"반품 승인은 고객지원 담당자가 하나요?","answer":{"optionId":"yes","optionLabel":"예","channel":"web"},"pending":false},
 {"id":"Q2","text":"반품 승인 뒤 환불은 누가 하나요?","answer":{"optionId":null,"text":"재무팀이 환불한다","channel":"web"},"pending":false},
 {"id":"Q3","text":"반품 상품 회수는 택배사가 하나요, 고객이 보내나요?","answer":null,"pending":false}
],"closed":true}`;

export default probeBatch({
  name: "ontology-build-probes-scope-and-limits",
  agentTimeoutMs: 600_000, // three report answers in one response
  description:
    "Three independent first-build probes in one run: q1 anchors candidates to a given business scope, asks about a differing document statement and reports out-of-scope content and unread material in one report grouped by bounded context; q2 shows a candidate term with the ADR glossary's definition, asks about a differing meaning and leaves that concept unsaved when the user declines the glossary cleanup; q3 separates completed and remaining scope after partial reading and an unanswered question, keeps that path open and unsaved, and does not present a partial event map as the whole system.",
  references: [...REPORT_REFERENCES, "skills/ontology-build/references/save.md"],
  probes: [
    {
      id: "q1",
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
        return [
          "This project has no saved ontology and no ADR documents.",
          "사용자: /ontology-build docs/business — 범위는 고객이 주문을 제출할 때 시작해서 결제가 완료되면 끝나는 업무로 잡아 줘.",
          "You read docs/business. Its contents:",
          "- docs/business/order-flow.md:\n```markdown\n" + FLOW + "```",
          "- docs/business/refund-flow.pdf: the PDF has no text layer (a scanned image); no text could be extracted.",
          "- docs/business/payment-terms.xlsx: the 결제수단 sheet says 카드와 계좌이체를 받는다; the 할부 sheet is password-protected and could not be opened.",
          "Do not call tools or write files. Show the report you would present before opening the web question session: the applied scope, the candidates grouped by bounded context with their source verdicts, out-of-scope content, material you could not read, and the questions.",
        ];
      },
    },
    {
      id: "q2",
      obligations: [
        {
          id: "definition-shown",
          text: "The report shows the 백오더 candidate together with the definition docs/adr/glossary.md already gives (an order line whose shipping waits for stock, paid at shipping).",
        },
        {
          id: "different-meaning-question",
          text: "Because the document's meaning (an order the customer pays in advance for an out-of-stock product) differs from the glossary's, the report asks a question about it instead of choosing one meaning.",
        },
        {
          id: "declined-cleanup",
          text: "After the user declines the glossary cleanup, the 백오더 concept and the relations that use it are not saved; the response reports them as remaining scope, while the rest of the confirmed scope may still be saved.",
        },
        {
          id: "no-double-definition",
          text: "No saved result has the same term defined both in the model and in the glossary: the glossary is left untouched as the user asked, and the model does not define 백오더.",
        },
      ],
      build(dir) {
        seedMapping(dir);
        write(dir, "docs/adr/glossary.md", GLOSSARY);
        write(dir, "docs/product/preorder.md", PREORDER);
        return [
          "This project has no saved ontology and no ADR documents; docs/adr/glossary.md exists. The user chose to build directly.",
          "사용자: /ontology-build docs/product/preorder.md",
          "docs/adr/glossary.md:\n```markdown\n" + GLOSSARY + "```",
          "docs/product/preorder.md:\n```markdown\n" + PREORDER + "```",
          "Do not call tools or write files. Answer in two parts.",
          "Part 1 — show the report entry for the 백오더 candidate and any question about it.",
          "Part 2 — later, the user answered the question with the document's meaning and confirmed the other candidates. At the approval summary `impact` listed a glossary cleanup for 백오더 in docs/adr/glossary.md, and the user replied: “용어집은 그대로 둘래. 나머지는 저장해 줘.” Show what you save and what you report then.",
        ];
      },
    },
    {
      id: "q3",
      obligations: [
        {
          id: "completed-and-remaining",
          text: "The response reports the completed scope and the remaining scope separately — including docs/returns/pickup-guide.hwp, which could not be read in this environment — and does not report the build as a complete success.",
        },
        {
          id: "unanswered-open",
          text: "Q3 (who brings the returned item back) was not answered: its candidate is not saved; it stays a question of the report and is recorded as an open path of the return process (or proposed as one) rather than dropped.",
        },
        {
          id: "partial-map",
          text: "The event map is presented as covering only the materials read, not as the complete returns system, and the stock increase the day after a return is received is not shown as a confirmed causal consequence of the return, since no document states that cause.",
        },
      ],
      build(dir) {
        seedMapping(dir);
        write(dir, "docs/returns/notes.md", RETURNS);
        return [
          "This project has no saved ontology and no ADR documents. The user asked for a first model of returns from docs/returns.",
          "- docs/returns/notes.md:\n```markdown\n" + RETURNS + "```",
          "- docs/returns/pickup-guide.hwp: no reader for this format is available here; its text could not be extracted.",
          "You presented the report and opened the web question session. The user has now ended the session. `ontology-ask.mjs answers <run>` printed:",
          "```json\n" + ANSWERS + "\n```",
          "Do not call tools or write files. Show the report update you present now and what you propose to save.",
        ];
      },
    },
  ],
});
