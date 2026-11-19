import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { commitFixture, ontologyQuery, SETTLED_MODEL } from "../lib/ontology-fixtures.mjs";

const record = (path, summary) => ({ path, status: "Accepted (2026-10-01)", summary });
const MAPPING = {
  categories: {
    checkout: {
      feature: "Checkout",
      adrs: [record("docs/adr/checkout/0001-submit-orders.md", "orders are submitted")],
      realizes: ["ordering.submit-order"],
      dependsOn: [],
    },
    confirmation: {
      feature: "Order confirmation",
      adrs: [record("docs/adr/confirmation/0001-confirm-paid.md", "paid orders are confirmed")],
      realizes: ["ordering.confirm-order"],
      dependsOn: [],
    },
    payments: {
      feature: "Payments",
      adrs: [
        record(
          "docs/adr/payments/0001-card-capture.md",
          "card payments are captured once per order",
        ),
      ],
      realizes: ["payment.request-payment", "payment.capture-payment"],
      dependsOn: [],
    },
  },
};
const PAYMENTS = `# ADR 0001: Capture card payments once per order

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

Customers must never be charged twice for one order.

## Decision Drivers

- One order is charged at most once.

## Decision

Capture the card charge through the payment provider once per order.

### Requirement contract

- An order is captured at most once; a repeated capture request returns the first result.
- A declined card leaves the order unpaid and shows the decline reason.

## Alternatives

1. **Capture on submission** — charges abandoned carts.
2. **Capture once per order (chosen)**.

## Consequences

### Positive

- No double charges.
`;

export const obligations = [
  {
    id: "open-path",
    text: "Retrying after the payment provider declines a card is an open path in the business context. The response keeps it as something to confirm — it asks the user or proposes settling it through the business model — and does not conclude that no retry rule exists because the model records none.",
  },
  {
    id: "not-applicable",
    text: "The confirmed not-applicable item (payment never passes work to another organization) is accepted as it stands: it is not turned back into a question.",
  },
  {
    id: "failure-guarantee",
    text: "Neither the not-applicable item nor the user's suggestion removes the failure guarantee inside the step: the decision still keeps that a declined card leaves the order unpaid (and shows the reason), or the response explains that it must stay.",
  },
].map((o) => ({ ...o, label: `open scope: ${o.id}` }));

export default {
  name: "author-checks-business-open-scope",
  description:
    "Authoring against a business context with an open path and a not-applicable item keeps the open path to confirm and keeps the step's failure guarantee.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0001-card-capture.md": PAYMENTS });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "결제 재시도 규칙은 모델에 없으니 없는 걸로 치고, 외부 기관에 넘기는 일도 없다고 되어 있으니 카드가 거절됐을 때의 처리는 결정에서 빼자. 결제 결정을 그렇게 정리해 줘.",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      PAYMENTS,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving: the checked business context, any question for the user and the approval summary.",
      "In the tail use CHECKED_CONTEXT, OPEN_PATH, NOT_APPLICABLE and FAILURE_GUARANTEE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
