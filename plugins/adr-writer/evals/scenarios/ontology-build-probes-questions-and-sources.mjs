import { seedMapping, write } from "../lib/harness.mjs";
import { probeBatch } from "../lib/ontology-fixtures.mjs";

// q1: an authoritative ADR, behaviour only code shows and two equal sources that disagree.
const ADR_PATH = "docs/adr/sales/quotes/0001-quote-approval.md";
const ADR = `# ADR 0001: A sales manager decides submitted quotes

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

Every submitted quote gets one accountable decision.

## Decision

A sales manager approves or returns each submitted quote. A returned quote goes back to the salesperson who submitted it, with the manager's reason.

### Requirement contract

- A returned quote is reassigned to its submitting salesperson with the return reason.

## Consequences

### Positive

- Every quote has one accountable decision.
`;
const CODE = `// src/quotes/expire.ts
export const sweep = (quotes) => quotes.filter((q) => daysSince(q.sentAt) > 30).forEach(expire);`;

// q2: business notes beside service folders that are not boundaries by themselves.
const NOTES = `# 주문 처리 업무 메모

고객이 주문을 제출하면 결제를 요청한다. 카드 결제가 승인되면 결제 완료가 기록되고, 결제가 완료된 주문만 출고를 준비한다.
출고가 끝나면 고객에게 배송 시작을 알린다. 결제가 거절되면 고객이 다른 카드로 다시 시도할 수 있다.
`;

// q3: a policy whose file, pages and passages stay out of the saved model.
const REFUND_POLICY = `# 환불 정책 (고객지원팀, 2026-09 개정)

## 3. 환불 기한 (3쪽)

배송 완료 후 7일 안에 요청한 환불만 받는다. "배송 완료일로부터 7일이 지나면 환불을 받지 않는다."

## 4. 부분 환불 (4쪽)

묶음 상품은 개별 상품 단위로 환불한다.
`;

export default probeBatch({
  name: "ontology-build-probes-questions-and-sources",
  agentTimeoutMs: 600_000, // three report answers in one response
  description:
    "Three independent first-build probes in one run: q1 settles before asking a question an authoritative repository source answers and still asks what only code shows or what equal sources dispute; q2 shows the evidence-based event map before deriving contexts and subdomains and never takes services or folders as boundaries by themselves; q3 keeps rule candidates' sources in evidence, so a saved basis is a kind and a short sentence and a user-confirmed rule without a document is a user decision.",
  references: [
    "references/eventstorming.md",
    "skills/ontology-build/references/candidate-review.md",
    "skills/ontology-build/references/candidates.md",
    "skills/ontology-build/references/ask-session.md",
    "skills/ontology-build/references/save.md",
  ],
  probes: [
    {
      id: "q1",
      obligations: [
        {
          id: "resolved",
          text: "Who receives a returned quote is answered by the Accepted ADR, so it is not asked as an open question: it is listed as resolved, with that ADR as its source, and the user can still answer it differently.",
        },
        {
          id: "code-only",
          text: "The 30-day expiry of a sent quote appears only in code. It is observed behavior, not a business decision, so it stays a question for the user (or an unconfirmed candidate); it is not marked resolved.",
        },
        {
          id: "conflict",
          text: "The sales handbook and the finance handbook disagree on who approves a discount of 10% or more. Neither outranks the other, so the question is asked, citing both documents as conflicting evidence, rather than one being picked.",
        },
      ],
      build(dir) {
        seedMapping(dir, {
          categories: {
            "sales/quotes": {
              feature: "Quote approval",
              dependsOn: [],
              adrs: [
                {
                  path: ADR_PATH,
                  status: "Accepted (2026-10-01)",
                  summary: "A sales manager decides submitted quotes",
                },
              ],
            },
          },
        });
        write(dir, ADR_PATH, ADR);
        write(dir, "src/quotes/expire.ts", CODE);
        write(dir, "docs/sales-handbook.md", "할인율이 10% 이상이면 영업팀장이 승인한다.");
        write(dir, "docs/finance-handbook.md", "할인율이 10% 이상이면 재무팀이 승인한다.");
        return [
          "This project has no saved ontology. The user chose to build directly from the current documents. The sources you read:",
          `${ADR_PATH}:`,
          "```markdown",
          ADR,
          "```",
          "```ts",
          CODE,
          "```",
          "docs/sales-handbook.md: 할인율이 10% 이상이면 영업팀장이 승인한다.",
          "docs/finance-handbook.md: 할인율이 10% 이상이면 재무팀이 승인한다.",
          "Your open points for the quote workflow: who receives a returned quote, whether a sent quote expires, and who approves a large discount.",
          "Do not call tools. Show the questions file (questions.json) you would open the question session with.",
        ];
      },
    },
    {
      id: "q2",
      obligations: [
        {
          id: "order",
          text: "The report first presents the business event map for the requested scope — events such as order submitted, payment completed and shipment started with their causal hand-offs — and only then identifies bounded contexts and subdomains from that map, before any model candidates.",
        },
        {
          id: "not-folders",
          text: "The service folders (services/order-api, services/payment-worker, services/notification) are evidence, not boundaries: no bounded context is accepted because a folder or service exists, and each proposed boundary cites business evidence or is marked unconfirmed.",
        },
        {
          id: "subdomain",
          text: "Subdomains are described as problem areas separate from bounded contexts as responsibility boundaries, and a core, supporting or generic classification that the evidence does not state is left unconfirmed.",
        },
        {
          id: "open-path",
          text: "The retry with another card after a declined payment is kept in the map (as stated or as an open question); it is not dropped to make the flow simpler.",
        },
      ],
      build(dir) {
        seedMapping(dir);
        write(dir, "docs/order-notes.md", NOTES);
        for (const service of ["order-api", "payment-worker", "notification"])
          write(dir, `services/${service}/README.md`, `# ${service}\n`);
        return [
          "This project has no saved ontology and no ADRs. Its folders are services/order-api, services/payment-worker and services/notification. docs/order-notes.md:",
          "```markdown",
          NOTES,
          "```",
          "사용자: /ontology-build docs/order-notes.md 주문 처리 업무로 첫 모델 초안을 보여 줘.",
          "Do not call tools. Show the report you would present before writing candidates.",
        ];
      },
    },
    {
      id: "q3",
      obligations: [
        {
          id: "basis",
          text: "The basis text of the refund-window rule (and the partial-refund rule) is a short business sentence. It may name the refund policy and one of its articles or clauses, but it contains no input file name or path (docs/policies/refund-policy.md), no page such as 3쪽 and no passage quoted from the document.",
        },
        {
          id: "evidence",
          text: "The input file's name, path and page appear only in report-only fields — the candidates' evidence entries or notHeld sources — and never in an attribute that would be saved into the model, such as basis, definition, label or comment.",
        },
        {
          id: "user-decision",
          text: "The rule the user stated in the conversation — a support lead approves every refund, with no document behind it — is a candidate whose basis kind is user-decision, not a document-backed kind.",
        },
        {
          id: "log",
          text: "Any change-log line the response proposes is in business language and names no input file, path or page.",
        },
      ],
      build(dir) {
        seedMapping(dir);
        write(dir, "docs/policies/refund-policy.md", REFUND_POLICY);
        return [
          "This project has no saved ontology and no ADRs. The user asked for a first model of refunds from docs/policies/refund-policy.md:",
          "```markdown",
          REFUND_POLICY,
          "```",
          "사용자: 문서에는 없지만, 환불은 모두 고객지원팀장이 승인하는 걸로 우리가 정했어.",
          "Do not call tools. Show the `rules` entries of the candidates file you would write, and the change-log line you would propose for saving them.",
        ];
      },
    },
  ],
});
