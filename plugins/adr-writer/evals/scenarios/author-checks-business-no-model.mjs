import { seedMapping, seedRuleDocs, skillText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "silent",
    text: "The repository has no docs/ontology model documents, so the response adds no business-context check, link judgment, ontology proposal or question about a business model; it neither mentions running an ontology query nor says that the business context was not checked.",
  },
  {
    id: "normal-flow",
    text: "It continues the ordinary ADR authoring flow for the refund decision, keeping the 7-day refund window as a requirement value, and proposes no realizes link or empty record for the index.",
  },
].map((o) => ({ ...o, label: `no model: ${o.id}` }));

export default {
  name: "author-checks-business-no-model",
  description:
    "Without model documents, ADR authoring adds no business-context output, question or index change.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new refunds",
      "",
      "환불 기능을 결정하려 한다. 고객은 배송 완료 후 7일 안에만 환불을 요청할 수 있다 (고객 정책).",
      "",
      "The repository has docs/adr but no docs/ontology directory.",
      "Do not call tools or write files. Show what you would present before saving.",
      "In the tail use APPROVAL and ADR_VALUE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
