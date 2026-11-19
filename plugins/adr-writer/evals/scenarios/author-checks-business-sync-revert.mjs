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
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "no-query",
    text: "The capture code was removed, so the Accepted payments ADR is no longer implemented. The response returns it to Proposed as an automatic correction — naming the deterministic status transition it runs, since tools are disabled in this run — without first querying the business context or asking the user before the return; the automatic return does not wait for a query.",
  },
  {
    id: "honest",
    text: "It reports the reason (the implementation is gone) and keeps the decision and contract text unchanged.",
  },
].map((o) => ({ ...o, label: `sync revert: ${o.id}` }));

export default {
  name: "author-checks-business-sync-revert",
  description:
    "ADR sync returning an unimplemented Accepted ADR to Proposed does not wait for a business-context query.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    write(
      dir,
      "src/payments/README.md",
      "# Payments\n\nCard capture was removed in the November cleanup; nothing captures payments now.\n",
    );
    commitFixture(dir);
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
      PAYMENTS_ADR,
      "```",
      "Repository search for the capture implementation found nothing; src/payments/README.md says: Card capture was removed in the November cleanup; nothing captures payments now.",
      "Do not call tools or write files. Show the drift and the action you take.",
      "In the tail use DRIFT, ACTION and QUERY tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
