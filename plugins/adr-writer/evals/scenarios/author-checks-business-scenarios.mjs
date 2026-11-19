import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  commitFixture,
  ontologyQuery,
  recordedMapping,
  SETTLED_MODEL,
  TAKE_PAYMENTS_ADR,
} from "../lib/ontology-fixtures.mjs";

const MAPPING = recordedMapping();
MAPPING.categories.payments.adrs = [
  {
    path: "docs/adr/payments/0001-take-payments.md",
    status: "Accepted (2026-10-01)",
    summary: "orders are paid by card",
  },
];

export const obligations = [
  {
    id: "derived",
    text: "The approval summary derives the payment contract rows from the business flow it checked: the payment starts when an order is placed, the customer requests it and the payment provider captures it, the Payment completed hand-off lets order confirmation react, and the outcome is an order showing a completed payment.",
  },
  {
    id: "criterion",
    text: "It names the observation criterion “A placed order gets paid” (an order is placed → the order shows a completed payment) as what the contract must make observable, and connects it to the rows.",
  },
  {
    id: "paths",
    text: "The normal path, the declined-card exception (the order stays unpaid and the reason is shown) and the hand-off each map to a proposed contract row; the open retry-after-decline path stays a question rather than an invented rule.",
  },
].map((o) => ({ ...o, label: `business scenarios in authoring: ${o.id}` }));

export default {
  name: "author-checks-business-scenarios",
  description:
    "ADR authoring connects the business start, performers, hand-off, outcome and observation criterion to the contract rows it proposes.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0001-take-payments.md": TAKE_PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const feature = ontologyQuery(dir, ["--category", "payments"]);
    const process = ontologyQuery(dir, ["--process", "payment.take-payment"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "주문 결제 결정을 처음부터 정리해 줘. 카드사가 결제를 거절하면 고객에게 거절 사유를 보여 준다.",
      "",
      "docs/adr/payments/0001-take-payments.md:",
      "```markdown",
      TAKE_PAYMENTS_ADR,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      feature,
      "```",
      "It listed no observation criteria, so you also queried the connected process:",
      "```text",
      process,
      "```",
      "Do not call tools or write files. Show what you would present before saving: the checked business context and the approval summary with its proposed contract rows.",
      "In the tail use CHECKED_CONTEXT, CONTRACT_ROW, CRITERION and OPEN_PATH tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
