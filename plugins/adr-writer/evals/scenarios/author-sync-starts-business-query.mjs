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
  CONFIRMATION_ADR,
  ontologyDirective,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// The contract holds in code; only a storage detail the ADR names has drifted.
const PAYMENTS_ADR = adrDocument({
  title: "Capture card payments once per order",
  purpose: "Customers must never be charged twice for one order.",
  decision: "Capture the card charge through the payment provider once per order.",
  rows: [
    "An order is captured at most once; a repeated capture request returns the first result.",
    "A declined card leaves the order unpaid; the decline is written to the `payment_failures` table.",
  ],
});
const CODE = `// payments/capture.ts
export async function capture(order) {
  const first = await ledger.find(order.id);
  if (first) return first; // a repeated request returns the first result
  const result = await provider.capture(order.id, order.total);
  await ledger.record(order.id, result);
  if (result.declined) {
    await declineLog.append(order.id, result.reason);
    return keepUnpaid(order.id);
  }
  return markPaid(order.id);
}`;

export const obligations = [
  {
    id: "query-first",
    text: "Before proposing any change to the payments ADR body, the response runs ontology-writer's business-context query for the payments feature — the command the session directive names, scoped to the feature's category or to the steps it realizes — and waits for its result. Locating the feature's index record, ADR or code first is allowed.",
  },
  {
    id: "no-model-read",
    text: "It obtains the business context through that query, not by reading or parsing the docs/ontology documents itself.",
  },
].map((o) => ({ ...o, label: `sync starts business query: ${o.id}` }));

export default {
  name: "author-sync-starts-business-query",
  description:
    "ADR sync that would change an ADR body starts the business-context query itself when no context is supplied.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, {
      "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    write(dir, "src/payments/capture.ts", CODE);
    commitFixture(dir);
    return [
      "The session started with this Ontology Writer directive:",
      "```text",
      ontologyDirective(dir),
      "```",
      skillText("adr-sync", {
        references: [
          "references/business-context.md",
          "skills/adr-sync/references/deep-verification.md",
        ],
      }),
      `\n---\n\n# This run`,
      "/adr-sync payments",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      PAYMENTS_ADR,
      "```",
      "src/payments/capture.ts:",
      "```ts",
      CODE,
      "```",
      "Do not call tools or write files. List, in order, the steps and exact commands you run before proposing the body change, and stop where you would need their output.",
      "In the tail use FIRST_STEP and COMMAND tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
