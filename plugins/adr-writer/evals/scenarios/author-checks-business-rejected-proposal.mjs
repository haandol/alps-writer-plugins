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
    '미정 — awaiting the business change "partial refund request": a customer may request a partial refund of one order line.',
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
    id: "not-finalized",
    text: "The user rejected the partial-refund business change, so the response does not finalize the partial-refund row as an approved contract.",
  },
  {
    id: "rewrite-or-keep",
    text: "It either rewrites that row in the model's current meaning (no partial refund of a single order line, since that business change was rejected) for the user's approval, or keeps it pending and asks the user to decide; while it stays pending the ADR stays Proposed.",
  },
].map((o) => ({ ...o, label: `rejected proposal: ${o.id}` }));

export default {
  name: "author-checks-business-rejected-proposal",
  description:
    "After a business change is rejected, a pending ADR row is rewritten in the model's current meaning or kept pending — never finalized as proposed.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0002-refund.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "docs/adr/payments/0002-refund.md:",
      "```markdown",
      ADR,
      "```",
      "The user just answered the ontology change proposal: “부분 환불은 업무에 넣지 않기로 했어. 그 제안은 거절할게.” The model therefore stays as it is, with no partial refund.",
      "Do not call tools or write files. Show what you would present for the pending row now.",
      "In the tail use PENDING_ROW, ACTION and STATUS tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
