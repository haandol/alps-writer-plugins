import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  CAPTURE_CODE,
  DRIFTED_PAYMENTS_ADR,
  commitFixture,
  CONFIRMATION_ADR,
  ontologyQuery,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "checked-first",
    text: "Before changing the payments ADR body, the response checks and names the business context of the payments feature.",
  },
  {
    id: "no-compliance-added",
    text: "The payments ADR has no contract for the Payment completed hand-off that order confirmation reacts to. Sync reports that missing compliance contract as an alignment issue for /ontology-sync; it does not write a new compliance-contract row into the ADR itself.",
  },
  {
    id: "drift-fix",
    text: "The proposed body change is limited to the drift: the ADR names a storage table (`payment_failures`) the code does not use, an implementation detail sync takes out of the row (it does not copy the code's storage name into the ADR), while the row keeps that a declined card leaves the order unpaid. The change is presented for approval before writing.",
  },
].map((o) => ({ ...o, label: `sync body change: ${o.id}` }));

export default {
  name: "author-checks-business-sync-body",
  description:
    "ADR sync that changes an ADR body checks the business context first and reports a missing compliance contract instead of adding it.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, {
      "docs/adr/payments/0001-card-capture.md": DRIFTED_PAYMENTS_ADR,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    write(dir, "src/payments/capture.ts", CAPTURE_CODE);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
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
      DRIFTED_PAYMENTS_ADR,
      "```",
      "src/payments/capture.ts:",
      "```ts",
      CAPTURE_CODE,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show the drift you found and what you would present for approval.",
      "In the tail use CHECKED_CONTEXT, DRIFT, ALIGNMENT and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
