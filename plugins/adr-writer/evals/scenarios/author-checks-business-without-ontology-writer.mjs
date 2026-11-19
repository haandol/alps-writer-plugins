import { seedMapping, seedRuleDocs, skillText, TAIL_SPEC, write } from "../lib/harness.mjs";
import { EXAMPLE_MODEL } from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "unchecked",
    text: "The approval summary states that the business context was not checked because Ontology Writer is not available, so the reader knows the decision was not compared with the business model.",
  },
  {
    id: "continues",
    text: "The missing query does not block the work: the response continues to a normal ADR approval summary for the refund decision, including the 7-day refund window as a requirement value.",
  },
  {
    id: "no-model-reading",
    text: "It does not open, parse or summarize docs/ontology/ordering.ttl itself as a substitute for the query, and it does not claim knowledge of the model's steps, events or rules.",
  },
].map((o) => ({ ...o, label: `without ontology writer: ${o.id}` }));

export default {
  name: "author-checks-business-without-ontology-writer",
  description:
    "ADR authoring in a repository with a business ontology but no Ontology Writer says the context was not checked and continues.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    write(dir, "docs/ontology/ordering.ttl", EXAMPLE_MODEL);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new refunds",
      "",
      "환불 기능을 결정하려 한다. 고객은 배송 완료 후 7일 안에만 환불을 요청할 수 있다 (고객 정책).",
      "",
      "The repository contains docs/ontology/ordering.ttl, but Ontology Writer is not installed in this client: its query command is not available.",
      "Do not call tools or write files. Show what you would present before saving: what you checked and the approval summary.",
      "In the tail use CHECKED_CONTEXT, CONTINUE and ADR_VALUE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
