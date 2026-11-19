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
      adrs: [record("docs/adr/payments/0001-take-payments.md", "orders are paid by card")],
      realizes: ["payment.request-payment", "payment.capture-payment"],
      dependsOn: [],
    },
  },
};

const EXISTING = `# ADR 0001: Take card payments for orders

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

Customers pay for an order by card.

## Decision Drivers

- One order is charged at most once.

## Decision

Charge the order total by card through the payment provider.

### Requirement contract

- An order is charged at most once.

## Alternatives

1. **Pay on delivery** — not offered.
2. **Card payment (chosen)**.

## Consequences

### Positive

- Customers pay at checkout.
`;

export const obligations = [
  {
    id: "process-query",
    text: "The category result lists no observation criteria, so the response queries the connected process (Take a payment) through ontology-writer — a process-scoped query such as `--process payment.take-payment` — to check its observation criteria, though the user did not ask about criteria, and the authoring summary it presents for approval waits for and carries those criteria.",
  },
  {
    id: "no-model-read",
    text: "It does not read the docs/ontology documents itself, and presents no contract rows for approval before that query.",
  },
].map((o) => ({ ...o, label: `ordinary authoring queries the process: ${o.id}` }));

export default {
  name: "author-scenarios-queries-process",
  description:
    "Ordinary ADR authoring whose category result lists no observation criteria queries the connected process before proposing rows.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0001-take-payments.md": EXISTING });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const feature = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "주문 결제 결정을 처음부터 정리해 줘. 카드사가 결제를 거절하면 고객에게 거절 사유를 보여 준다.",
      "",
      "docs/adr/payments/0001-take-payments.md:",
      "```markdown",
      EXISTING,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      feature,
      "```",
      "Do not call tools or write files. State what you do next, with the exact command, before proposing contract rows.",
      "In the tail use NEXT_STEP and COMMAND tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
