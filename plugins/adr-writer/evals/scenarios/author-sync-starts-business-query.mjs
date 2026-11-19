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
  ontologyDirective,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "query-first",
    text: "The response runs ontology-writer's business-context query for the payments feature — the command the session directive names, scoped to the feature's category or to the steps it realizes — before any body change is finalized: the approval summary it plans carries the checked context, and no body change is presented for approval or written before the query result. Finding the drift in the ADR and code first is allowed.",
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
      "docs/adr/payments/0001-card-capture.md": DRIFTED_PAYMENTS_ADR,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    write(dir, "src/payments/capture.ts", CAPTURE_CODE);
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
      DRIFTED_PAYMENTS_ADR,
      "```",
      "src/payments/capture.ts:",
      "```ts",
      CAPTURE_CODE,
      "```",
      "Do not call tools or write files. List, in order, the steps and exact commands you run before proposing the body change, and stop where you would need their output.",
      "In the tail use FIRST_STEP and COMMAND tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
