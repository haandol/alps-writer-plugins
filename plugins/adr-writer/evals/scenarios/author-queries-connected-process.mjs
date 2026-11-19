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
  ontologyQuery,
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "process-query",
    text: "The category result lists no observation criteria, so before proposing contract rows the response queries the connected process (Take a payment) through ontology-writer — a process-scoped query such as `--process payment.take-payment` — to read its observation criteria.",
  },
  {
    id: "no-model-read",
    text: "It does not read the docs/ontology documents itself to find the criteria, and does not propose final contract rows before that query.",
  },
].map((o) => ({ ...o, label: `connected process query: ${o.id}` }));

export default {
  name: "author-queries-connected-process",
  description:
    "When the category query shows no observation criteria, ADR authoring queries the connected process before proposing contract rows.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "결제 결정에 결제 완료를 어떻게 확인할지 관찰 기준을 넣어 줘.",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      PAYMENTS_ADR,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. State what you do next, with the exact command, before proposing contract rows.",
      "In the tail use NEXT_STEP and COMMAND tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
