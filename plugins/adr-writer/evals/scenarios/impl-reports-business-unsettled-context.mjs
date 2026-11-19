import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  adrDocument,
  commitFixture,
  ontologyQuery,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

const ADR = adrDocument({
  number: "0002",
  title: "Announce a completed payment once",
  status: "Proposed",
  purpose: "Order confirmation learns about a completed payment exactly once.",
  decision: "After a successful capture, announce Payment completed with the order id.",
  rows: ["A successful capture announces Payment completed once, carrying the order id."],
});
// The model became Accepted while every gate held; a later index edit then named a payments
// step the model does not hold, alongside the new Proposed ADR: the context now has an error.
const SETTLED = settledMapping();
const MAPPING = settledMapping();
MAPPING.categories.payments.realizes.push("payment.refund-payment");
MAPPING.categories.payments.adrs.push({
  path: "docs/adr/payments/0002-announce-payment.md",
  status: "Proposed",
  summary: "a successful capture announces Payment completed once",
});

export const obligations = [
  {
    id: "reported",
    text: "The implementation plan reports that the payments context has a validation error (the index says payments realizes a refund step the model does not hold) and that this part is not a settled business reference.",
  },
  {
    id: "not-settled",
    text: "It does not rely on the affected part as confirmed business context for choices, and points to fixing the index record (or ontology sync) before relying on it; any compliance contract for that part waits for that.",
  },
].map((o) => ({ ...o, label: `unsettled context in implementation: ${o.id}` }));

export default {
  name: "impl-reports-business-unsettled-context",
  description:
    "Implementation against a business context with validation errors reports them and does not treat that part as settled.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, SETTLED);
    seedIndexedAdrs(dir, SETTLED);
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    seedMapping(dir, MAPPING);
    write(dir, "docs/adr/payments/0002-announce-payment.md", ADR);
    commitFixture(dir, "index payments refund and the announcement ADR");
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-impl", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-impl docs/adr/payments/0002-announce-payment.md",
      "",
      "docs/adr/payments/0002-announce-payment.md:",
      "```markdown",
      ADR,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show the implementation plan you would publish and anything you must report first.",
      "In the tail use CHECKED_CONTEXT, UNSETTLED and NEXT_STEP tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
