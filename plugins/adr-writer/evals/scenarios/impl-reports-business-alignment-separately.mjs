import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { commitFixture, ontologyQuery, SETTLED_MODEL } from "../lib/ontology-fixtures.mjs";

const record = (path, status, summary) => ({ path, status, summary });
const MAPPING = {
  categories: {
    checkout: {
      feature: "Checkout",
      adrs: [
        record(
          "docs/adr/checkout/0001-submit-orders.md",
          "Accepted (2026-10-01)",
          "orders are submitted",
        ),
      ],
      realizes: ["ordering.submit-order"],
      dependsOn: [],
    },
    confirmation: {
      feature: "Order confirmation",
      adrs: [
        record(
          "docs/adr/confirmation/0001-confirm-paid.md",
          "Accepted (2026-10-01)",
          "paid orders are confirmed",
        ),
      ],
      realizes: ["ordering.confirm-order"],
      dependsOn: [],
    },
    payments: {
      feature: "Payments",
      adrs: [
        record(
          "docs/adr/payments/0001-card-capture.md",
          "Accepted (2026-10-01)",
          "card payments are captured once per order",
        ),
        record(
          "docs/adr/payments/0002-announce-payment.md",
          "Proposed",
          "a successful capture announces Payment completed once",
        ),
      ],
      realizes: ["payment.request-payment", "payment.capture-payment"],
      dependsOn: [],
    },
  },
};
const ADR = `# ADR 0002: Announce a completed payment once

Date: 2026-11-01

## Status

Proposed

## Purpose

Order confirmation must learn about a completed payment exactly once, so an order is never confirmed twice or left waiting.

## Decision Drivers

- One announcement per paid order.

## Decision

After a successful capture, announce Payment completed with the order id. A declined card announces nothing.

### Requirement contract

- A successful capture announces Payment completed once, carrying the order id.
- A repeated capture of the same order announces nothing new.
- A declined card announces nothing.

## Alternatives

1. **Confirm the order directly** — couples payments to ordering data.
2. **Announce the event (chosen)**.

## Consequences

### Positive

- Confirmation reacts without knowing payment internals.
`;
const CODE = `// payments/announce.ts
export function onCaptured(order: Order, capture: Capture, bus: Bus) {
  if (capture.status !== "succeeded") return; // a declined card announces nothing
  if (alreadyAnnounced(order.id)) return; // one announcement per order
  bus.publish("PaymentCompleted", { orderId: order.id });
  markAnnounced(order.id);
  // Finance asked in November that payments captured after 23:00 count toward the next business day.
  ledger.record(order.id, capture.amount, businessDayOf(capture.at, { cutoff: "23:00" }));
}`;
const TESTS = `// payments/announce.test.ts
test("a successful capture announces Payment completed once with the order id", ...);   // PASS
test("capturing the same order again announces nothing new", ...);                       // PASS
test("a declined card announces nothing", ...);                                           // PASS`;

export const obligations = [
  {
    id: "model-only",
    text: "The business context's Payment covers the order rule (the collected amount equals the order amount) is not in this ADR. The review reports it, separately from the implementation verdict, as a model-only obligation the ADRs lack (a model/ADR alignment gap), and does not classify it as a Spec violation, test gap or other implementation defect.",
  },
  {
    id: "verdict",
    text: "The implementation verdict is judged only by the three ADR contract rows and their passing tests; the alignment result is reported separately, and a PASS is not described as business alignment or as an execution check of the whole process.",
  },
  {
    id: "new-fact",
    text: "The 23:00 cutoff that moves a late payment to the next business day is a business fact found in code but in neither the ADR nor the model. The review proposes routing it through the owning approval path (an ADR decision or an ontology change) and does not turn it into a new pass condition, a required test or an automatic model edit.",
  },
  {
    id: "scenarios",
    text: "The review connects the business flow — capture of the payment, the Payment completed hand-off to Confirm once paid in order confirmation, the declined-card path — to the ADR rows and to the test evidence, and says which business observation it could not verify, with the reason.",
  },
].map((o) => ({ ...o, label: `impl alignment: ${o.id}` }));

export default {
  name: "impl-reports-business-alignment-separately",
  description:
    "An implementation review keeps a model-only obligation and a code-only business fact out of the ADR verdict, reports them through their owning paths and maps the business flow to evidence.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0002-announce-payment.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-impl-review", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-impl-review docs/adr/payments/0002-announce-payment.md --mode standard",
      "",
      "docs/adr/payments/0002-announce-payment.md:",
      "```markdown",
      ADR,
      "```",
      "The implementation:",
      "```ts",
      CODE,
      "```",
      "Its tests and their latest results:",
      "```ts",
      TESTS,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files, and skip the HTML evidence package and its quiz. Give the review verdict and its findings.",
      "In the tail use VERDICT, ALIGNMENT, NEW_FACT and SCENARIOS tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
