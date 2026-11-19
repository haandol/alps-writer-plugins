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
const CODE = `// payments/refund.ts
export async function refund(order, amount) {
  if (amount > order.captured) throw new Error("refund exceeds the captured amount");
  return provider.refund(order.id, amount);
}`;
const TESTS = `test("a refund above the captured amount is refused", ...); // PASS
test("a refund up to the captured amount is sent to the provider", ...); // PASS`;
const MAPPING = settledMapping();
MAPPING.categories.payments.adrs.push({
  path: "docs/adr/payments/0002-refund.md",
  status: "Proposed",
  summary: "captured payments can be refunded",
});

export const obligations = [
  {
    id: "unresolved",
    text: "The review reports the pending partial-refund row as unresolved, awaiting its business change — not as PROVEN, not as a code Spec violation and not as a test gap to fix in code.",
  },
  {
    id: "no-pass-to-accept",
    text: "It does not let the ADR become Accepted while that row is pending: the verdict or its routing keeps the ADR Proposed until the business change is decided.",
  },
].map((o) => ({ ...o, label: `pending row in review: ${o.id}` }));

export default {
  name: "impl-reports-business-pending-review",
  description:
    "An implementation review reports a contract row pending on a business change as unresolved and keeps the ADR from Accepted.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0002-refund.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      skillText("adr-impl-review", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-impl-review docs/adr/payments/0002-refund.md --mode standard",
      "",
      "docs/adr/payments/0002-refund.md:",
      "```markdown",
      ADR,
      "```",
      "The implementation:",
      "```ts",
      CODE,
      "```",
      "Its tests and latest results:",
      "```ts",
      TESTS,
      "```",
      "Do not call tools or write files, and skip the HTML evidence package and its quiz. Give the verdict, each row's status and the findings.",
      "In the tail use VERDICT, ROW and ROUTE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
