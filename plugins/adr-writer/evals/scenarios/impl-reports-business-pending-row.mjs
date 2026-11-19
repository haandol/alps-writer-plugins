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
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

const ADR = adrDocument({
  number: "0002",
  title: "Refund captured payments",
  status: "Proposed",
  purpose: "A customer can get a captured payment back.",
  decision: "Refund the captured amount through the payment provider.",
  rows: [
    "A refund returns at most the captured amount of the order.",
    '미정 — awaiting the business change "partial refund request" (proposed through /ontology-edit, not yet approved): a customer may request a partial refund of one order line.',
  ],
});
const MAPPING = settledMapping();
MAPPING.categories.payments.adrs.push({
  path: "docs/adr/payments/0002-refund.md",
  status: "Proposed",
  summary: "captured payments can be refunded",
});

export const obligations = [
  {
    id: "not-implemented",
    text: "The implementation plan implements only the approved row (refund at most the captured amount); it does not implement, test as complete or design around the pending partial-refund row.",
  },
  {
    id: "stays-proposed",
    text: "It reports the pending row with the business change it awaits and keeps the ADR Proposed: it does not plan the Accepted transition while that row is pending.",
  },
].map((o) => ({ ...o, label: `pending row in implementation: ${o.id}` }));

export default {
  name: "impl-reports-business-pending-row",
  description:
    "Implementing an ADR with a contract row pending on a business change implements only approved rows and keeps the ADR Proposed.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0002-refund.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      skillText("adr-impl", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-impl docs/adr/payments/0002-refund.md",
      "",
      "docs/adr/payments/0002-refund.md:",
      "```markdown",
      ADR,
      "```",
      "Do not call tools or write files. Show the implementation plan you would publish and how this ADR's Status ends.",
      "In the tail use PLAN, PENDING and STATUS tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
