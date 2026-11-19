import { seedMapping, seedRuleDocs, skillText, TAIL_SPEC, write } from "../lib/harness.mjs";
import { commitFixture, EXAMPLE_MODEL, ontologyQuery } from "../lib/ontology-fixtures.mjs";

const CODE = `// src/payments/capture.ts
export async function capture(order) {
  if (await ledger.captured(order.id)) return ledger.result(order.id); // one capture per order
  const result = await provider.capture(order.id, order.total);
  if (result.declined) return keepUnpaid(order.id);
  await ledger.record(order.id, result);
  bus.publish("PaymentCompleted", { orderId: order.id });
}`;
const MAPPING = {
  categories: {
    payments: {
      feature: "Payments",
      adrs: [],
      realizes: ["payment.request-payment", "payment.capture-payment"],
      dependsOn: [],
    },
  },
};

export const obligations = [
  {
    id: "checked-before-confirming",
    text: "Before confirming the adopted payments ADR's contract, the response checks and names the business context of the payments feature: the Order placed start, the Payment completed hand-off to order confirmation and the applicable Payment covers the order rule.",
  },
  {
    id: "consistent",
    text: "The adopted contract candidates agree with that context (one capture per order, a declined card leaves the order unpaid, Payment completed is announced after a successful capture) or surface any difference as a question; they are proposed for the user's confirmation, not saved.",
  },
].map((o) => ({ ...o, label: `import business context: ${o.id}` }));

export default {
  name: "author-checks-business-import",
  description:
    "Adopting ADRs for an existing project with a business ontology checks the feature's business context before confirming each adopted contract.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    write(dir, "docs/ontology/ordering.ttl", EXAMPLE_MODEL);
    write(dir, "src/payments/capture.ts", CODE);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-import", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-import payments",
      "",
      "The repository's payment code, src/payments/capture.ts:",
      "```ts",
      CODE,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show the adoption candidates for the payments feature and what you would present before confirming its contract.",
      "In the tail use CHECKED_CONTEXT, CANDIDATE and QUESTION tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
