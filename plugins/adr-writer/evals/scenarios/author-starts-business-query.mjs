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
  ontologyDirective,
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "query-first",
    text: "Before drafting any decision text or contract row for the payments change, the response runs ontology-writer's business-context query for the payments feature — the command the session directive names, scoped to the feature's category or to the steps it realizes — and waits for its result instead of proposing contract rows first. Locating the feature's index record or ADR first is allowed.",
  },
  {
    id: "no-model-read",
    text: "It obtains the business context through that query, not by reading or parsing the docs/ontology documents itself.",
  },
].map((o) => ({ ...o, label: `starts business query: ${o.id}` }));

export default {
  name: "author-starts-business-query",
  description:
    "With a business model present and no context supplied, ADR authoring starts the business-context query itself before drafting.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      "The session started with this Ontology Writer directive:",
      "```text",
      ontologyDirective(dir),
      "```",
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "카드가 거절되면 고객에게 거절 사유를 보여 주도록 결제 결정을 고쳐 줘.",
      "",
      "Do not call tools or write files. List, in order, the steps and exact commands you run before drafting, and stop where you would need their output.",
      "In the tail use FIRST_STEP and COMMAND tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
