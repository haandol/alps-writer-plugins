import { writeFileSync } from "node:fs";
import path from "node:path";
import { TAIL_SPEC } from "../lib/harness.mjs";
import { REPORT_OUTPUT, scoreReportArtifact } from "./report-artifact-checks.mjs";

const coa = `Supplied terminology for an illustrative CoA system, not a verified product release:
The build process prepares descriptions, relationships and formulas that the query process reuses to answer questions.
A namespace is the unit in which sources, an ontology and access permissions are managed together.
The ontology describes business concepts, their attributes and relationships between concepts. Concepts are represented as classes.
Member and Order are classes. A member's tier and an order's amount are attributes. A member placing an order is a relationship between the concepts.
Mappings connect ontology definitions to source data: classes to tables, attributes to columns and relationships to join conditions.
No deployment, performance measurement or source beyond this fixture was supplied.`;

const cases = [
  {
    id: "report-terminology-introduction",
    title: "용어 정의와 예시를 연결한 CoA 소개",
    source: coa,
    request:
      "CoA를 처음 접한 개발자에게 구축·질의 과정과 업무 데이터를 표현하는 방법을 설명하는 짧은 한국어 리포트를 작성해줘. 회원과 주문 사례를 활용하고 글로만 설명해줘.",
    obligations: [
      {
        id: "definition-example-continuity",
        text: "The saved report connects the ontology overview to class, attribute and relationship examples. A reader can recognize what Member/Order, tier/amount and a member placing an order illustrate. New detail may be introduced progressively, but a promised element is not silently replaced or omitted. Do not require exact wording or an exhaustive introductory list.",
      },
      {
        id: "relationship-versus-mapping",
        text: "The relationship connects business concepts; mapping connects ontology definitions to source data. Explain those endpoints and purposes without using mapping as an unexplained synonym for the business relationship or inventing equivalence. Keep namespace and build/query meanings consistent with the source.",
      },
    ],
  },
  {
    id: "report-terminology-source-hierarchy",
    title: "다른 원문의 속성 분류와 별칭을 보존",
    source: `Supplied model for an illustrative knowledge graph:
Entity types are classes, such as Member and Order.
Property is an umbrella term. Data properties connect an entity to a literal value: tier and amount are data properties. Object properties connect one entity to another: placesOrder connects a Member to an Order.
This source calls object properties relationships. Relationships are therefore a kind of property in this model, not a disjoint peer category.
Bindings, also called mappings in this source, connect graph definitions to source tables, columns and join conditions. They are distinct from relationships between entities.
No claim about all ontologies or deployed systems is supplied.`,
    request:
      "이 지식 그래프 모델에서 회원과 주문 정보를 표현하는 방법을 주니어 개발자에게 설명하는 짧은 한국어 리포트를 작성해줘. 원문의 용어를 쉬운 설명과 함께 사용하고 글로만 설명해줘.",
    obligations: [
      {
        id: "source-owned-hierarchy",
        text: "Explain property as the umbrella covering data properties and object properties, with relationships corresponding to object properties in this supplied model. Keep literal-value examples and entity-to-entity examples aligned. Do not copy a universal classes/attributes/relationships partition that contradicts this source.",
      },
      {
        id: "explicit-alias-and-boundary",
        text: "Preserve the source equivalence of binding and mapping. Either choose one term consistently or explain their equivalence before alternating them. Distinguish these source-data correspondences from entity relationships; avoid inventing different meanings merely because the names differ.",
      },
    ],
  },
  {
    id: "report-terminology-review-control",
    title: "빠진 연결은 찾고 올바른 새 용어는 허용",
    source: `${coa}

Two report excerpts to review against the same supplied facts:
Excerpt A:
온톨로지는 업무 개념과 관계를 정리한 사전으로 생각하면 됩니다. “회원”, “주문”은 클래스라는 개념으로, “등급”, “금액”은 속성으로 표현합니다. 매핑은 이 개념을 실제 테이블·컬럼·조인 조건에 연결하는 규칙입니다.

Excerpt B:
온톨로지는 업무 개념과 그 개념의 속성, 개념 사이의 관계를 정리합니다. 예를 들어 “회원”과 “주문”은 클래스로 표현하는 업무 개념입니다. 회원의 “등급”과 주문의 “금액”은 속성이고, “회원이 주문한다”는 두 개념 사이의 관계입니다. 매핑은 이렇게 정리한 정의를 실제 데이터에 연결합니다. 이 사례에서는 클래스를 테이블에, 속성을 컬럼에, 관계를 조인 조건에 연결합니다.`,
    request:
      "두 설명의 용어와 문장 연결을 검토해서 짧은 한국어 리뷰 리포트를 작성해줘. 의미 있는 문제와 독자에게 미치는 영향을 설명하고, 문제가 없는 부분은 그대로 인정해줘. 원문은 수정하지 말고 글로만 검토 결과를 작성해줘.",
    obligations: [
      {
        id: "find-missing-connection",
        text: "Identify that excerpt A introduces concepts and relationships but then gives class and attribute examples without a relationship example or clear connection for the new category. Explain the reader impact and suggest aligning the overview and examples. Mapping is distinct from a business relationship: do not claim it is factually the same term or propose renaming one into the other.",
      },
      {
        id: "accept-grounded-control",
        text: "Recognize that excerpt B explains the classes, attributes, relationships and source mappings coherently. Do not report new terminology itself as a defect, demand every word be repeated identically, require a glossary, or invent a material flaw to fill a finding quota. Optional wording polish is allowed if clearly distinguished from a meaningful defect.",
      },
    ],
  },
];

/** Saved-report probes keep terminology judgments semantic and file checks independent. */
export const reportTerminologyCases = cases.map((item) => ({
  id: item.id,
  name: item.id,
  title: item.title,
  description: item.title,
  type: "classification",
  skill: "report-writer",
  group: "report",
  artifactPaths: [REPORT_OUTPUT],
  supplementalChecks: true,
  semanticObligations: [
    ...item.obligations,
    {
      id: "source-and-review-scope",
      text: "Judge the saved report against the supplied facts. Keep original source and excerpts unchanged, preserve prose-only and no-quiz delivery, and do not claim renderer, browser, deployment or reader-study verification. The target has no such tools; report only the checks it actually performed.",
    },
  ],
  build(dir) {
    writeFileSync(path.join(dir, "source.md"), item.source);
    return [
      item.request,
      "Read source.md and plugin/skills/report-writer/SKILL.md with the fixture tools. Read the necessary references including references/report-document.md. Use source.md as the only factual source.",
      `Save the actual report as JSON at ${REPORT_OUTPUT}. Only that output is writable. Include the supplied source as evidence, with links resolving beside this report file. Do not create other files or rewrite source.md.`,
      "No quiz or figures. There is no shell or browser. The host validates and renders the first saved final report without providing feedback or a repair turn. Do not claim to have run those tools. Your final reply may be short; the evaluated content is the saved report.",
      TAIL_SPEC,
    ].join("\n\n");
  },
  score(context) {
    return scoreReportArtifact(context, item.source);
  },
}));
