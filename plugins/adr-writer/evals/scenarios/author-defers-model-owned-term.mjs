import { seedMapping, seedRuleDocs, skillText, TAIL_SPEC, write } from "../lib/harness.mjs";

const MODEL = `@prefix m: <urn:ontology-writer:model:> .
@prefix pm: <urn:ontology-writer:process:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:ordering a pm:BoundedContext ;
  rdfs:label "주문" ;
  pm:definition "고객 주문을 받아 결제와 환불까지 관리하는 업무 경계" .

m:ordering.refund-request a pm:BusinessConcept ;
  rdfs:label "환불 요청" ;
  pm:definition "결제를 마친 고객이 결제 금액 전체의 반환을 요청한 것" ;
  pm:inContext m:ordering .
`;

const REQUEST = `
/adr-new ordering/refund

주문 일부 상품만 환불하는 기능을 결정하려 한다.
- 고객은 배송 완료 후 14일 안에만 '부분 환불 요청'을 제출할 수 있다 (환불 규정).
- 부분 환불 요청은 주문의 일부 상품에 대한 결제 금액 반환 요청이다.
- 환불 요청과 부분 환불 요청은 같은 환불 승인 단계를 거친다.
`;

export const obligations = [
  {
    id: "reuse",
    text: "The visible response reuses the business process model's existing meaning of 환불 요청 and does not propose adding 환불 요청 to docs/adr/glossary.md.",
  },
  {
    id: "proposal",
    text: "The visible response presents the new term 부분 환불 요청 as a change proposal to the business process model inside the ADR approval summary. Proposing it only as a glossary entry is a failure.",
  },
  {
    id: "pending",
    text: "Contract rows whose meaning depends on 부분 환불 요청 are marked pending (미정) on that model proposal, name the awaited business change in business language, and are not presented as approved contracts. Model file paths or element identifiers such as urn:ontology-writer:model: in the ADR row are a failure.",
  },
  {
    id: "value",
    text: "The 14-day submission window after delivery stays an ADR requirement value with its 환불 규정 basis; it is not moved into the model proposal as a value.",
  },
  {
    id: "status",
    text: "The response keeps the ADR Proposed and does not claim the pending rows can be implemented or the ADR accepted before the proposal is resolved.",
  },
].map((item) => ({ ...item, label: `model-owned term: ${item.id}` }));

export default {
  name: "author-defers-model-owned-term",
  description:
    "ADR authoring in a repository with a business process model must reuse the model's business terms, propose a new term as a model change in the same approval summary, and keep dependent contract rows pending without model identifiers.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    write(dir, "docs/process/ordering.ttl", MODEL);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n| Term | Meaning in these documents |\n| --- | --- |\n| 정산 | 판매 대금을 판매자에게 지급하는 일 |\n",
    );
    return [
      skillText("adr-new", {
        references: ["references/glossary.md", "skills/adr-new/references/approval-and-save.md"],
      }),
      `\n---\n\n# This run`,
      `The repository contains docs/process/ordering.ttl:`,
      "```turtle",
      MODEL,
      "```",
      REQUEST,
      `Do not call tools or write files. Show only the approval summary you would present`,
      `before saving this ADR, including how each business term is handled.`,
      `In the tail use REUSED_TERM, MODEL_PROPOSAL, GLOSSARY_CHANGE, PENDING_ROW and`,
      `ADR_STATUS tags. Put each tag exactly to the left of the | separator.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
