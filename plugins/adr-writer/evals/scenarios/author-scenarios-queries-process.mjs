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
    id: "process-query",
    text: "The category result lists no observation criteria, so the response's next step is to query the connected process (Take a payment) through ontology-writer — a process-scoped query such as `--process payment.take-payment` — to check its observation criteria, though the user did not ask about criteria. Tools are unavailable in this run, so it states that exact command and that the authoring summary waits for and will carry those criteria; it presents no approval summary built without them. Deferring the process query to implementation, or skipping it, fails.",
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
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0001-take-payments.md": TAKE_PAYMENTS_ADR });
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
      TAKE_PAYMENTS_ADR,
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
