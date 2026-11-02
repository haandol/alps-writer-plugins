import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC, write } from "../lib/harness.mjs";

const MODEL = `@prefix m: <urn:ontology-writer:model:> .
@prefix onto: <urn:ontology-writer:vocabulary:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:ordering a onto:BoundedContext ;
  rdfs:label "주문" ;
  onto:definition "고객 주문을 받아 확정하는 업무 경계" .

m:ordering.order a onto:BusinessConcept ;
  rdfs:label "주문" ;
  onto:definition "고객이 상품 구매를 확정한 요청" ;
  onto:inContext m:ordering .
`;

const BRIEF = `
F1: 주문 내역 화면
- 고객은 자기 주문(고객이 상품 구매를 확정한 요청)만 주문 내역 화면에서 볼 수 있다.
- 최근 12개월의 주문만 보인다 (개인정보 보관 정책).

F2: 선물 주문
- 선물 주문은 받는 사람 주소를 따로 가진 주문이다.
- 선물 주문이 확정되면 포장 단계가 시작된다.
- 포장은 확정 후 24시간 안에 시작해야 한다 (물류 계약).

F3: 주문 내역 내보내기
- 고객은 자기 주문 내역만 CSV로 내려받을 수 있다.
`;

export const obligations = [
  {
    id: "reuse",
    text: "F1 reuses the business ontology's existing meaning of 주문 and does not transfer 주문 into docs/adr/glossary.md.",
  },
  {
    id: "proposal",
    text: "F2's new term 선물 주문 and the relationship 'a confirmed 선물 주문 starts the 포장 step' are shown as business ontology change proposals in the same handoff approval summary, not as glossary entries.",
  },
  {
    id: "value",
    text: "F2's 24-hour packing start limit with its 물류 계약 basis and F1's 12-month visibility window with its 개인정보 보관 정책 basis stay ADR-owned requirement values; neither is moved into a model proposal.",
  },
  {
    id: "unresolved",
    text: "Until the model proposal is approved, F2's items that depend on it are Unresolved and F2 is not reported as transferred.",
  },
  {
    id: "independent",
    text: "F1 and F3, which do not depend on the pending proposal, can still complete their transfer; the pending proposal does not block them.",
  },
].map((item) => ({ ...item, label: `handoff model terms: ${item.id}` }));

export default {
  name: "feature-handoff-routes-model-owned-terms",
  description:
    "/feature-to-adr in a repository with a business ontology must reuse model-owned terms, route new terms and feature relationships as model proposals, keep values in ADRs, and complete handoff per Feature.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    write(dir, "docs/ontology/ordering.ttl", MODEL);
    return [
      alpsSkillText("feature-to-adr", {
        references: ["skills/feature-to-adr/references/current-reference-level.md"],
      }),
      `\n---\n\n# This run`,
      `The repository contains docs/ontology/ordering.ttl:`,
      "```turtle",
      MODEL,
      "```",
      `Analyze these completed ALPS Features. Do not call tools or write files; return only`,
      `the preflight result for each Feature and the proposals the handoff approval summary`,
      `would show. Assume no model proposal has been approved yet.`,
      BRIEF,
      `In the tail use REUSED_TERM, MODEL_PROPOSAL, ADR_OWNED, FEATURE_RESULT and`,
      `GLOSSARY_CHANGE tags. Put each tag exactly to the left of the | separator.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
