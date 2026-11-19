import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  ANNOUNCE_PAYMENT_ADR,
  commitFixture,
  ontologyQuery,
  recordedMapping,
  SETTLED_MODEL,
} from "../lib/ontology-fixtures.mjs";

const MAPPING = recordedMapping();
MAPPING.categories.payments.adrs.push({
  path: "docs/adr/payments/0002-announce-payment.md",
  status: "Proposed",
  summary: "a successful capture announces Payment completed once",
});
const ADR = ANNOUNCE_PAYMENT_ADR;

export const obligations = [
  {
    id: "scenarios",
    text: "The implementation plan maps each approved contract row to a business scenario from the checked context — a placed order whose capture succeeds and is announced once, a repeated capture, a declined card — and to the test that will show it.",
  },
  {
    id: "unverified",
    text: "It says which business observation this feature cannot establish on its own: that the order then shows a completed payment, through the Payment completed hand-off to order confirmation's Confirm once paid, stays unverified here (or needs an end-to-end check), with the reason.",
  },
  {
    id: "authority",
    text: "Completion stays judged by the three ADR rows; the observation criterion and the hand-off are not added as new completion conditions of this ADR.",
  },
].map((o) => ({ ...o, label: `business scenarios in planning: ${o.id}` }));

export default {
  name: "impl-reports-business-scenarios-plan",
  description:
    "An implementation plan connects approved contract rows to business scenarios and tests, and names the business observation it cannot verify itself.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0002-announce-payment.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const process = ontologyQuery(dir, ["--process", "payment.take-payment"]);
    return [
      skillText("adr-impl", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-impl docs/adr/payments/0002-announce-payment.md",
      "",
      "docs/adr/payments/0002-announce-payment.md:",
      "```markdown",
      ADR,
      "```",
      "The business-context query for the payment process returned:",
      "```text",
      process,
      "```",
      "Do not call tools or write files. Show the implementation plan you would publish.",
      "In the tail use SCENARIO, UNVERIFIED and COMPLETION_BASIS tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
