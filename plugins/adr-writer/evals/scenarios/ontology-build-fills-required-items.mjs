import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

const DOC = `# 출고 업무 흐름 (신입 교육 자료)

결제 대행사가 카드 결제를 승인하면 결제가 완료된다.
결제가 완료된 주문만 출고한다 (회사 출고 정책 2조).
결제가 완료되면 출고를 요청한다.
창고 담당자가 출고할 상품을 준비한다.
상품이 준비되면 출고 지시서를 발행한다.
출고 지시는 결제 완료 후 30분 안에 내려야 한다.
주문 하나는 한 번만 출고한다.
`;

export default {
  name: "ontology-build-fills-required-items",
  agentTimeoutMs: 600_000, // a full candidate report is a long answer
  description:
    "Required model items the documents cannot fill become candidates or questions in the same report; a rule or policy without a basis is marked and gets a basis question; ADR-level content is offered for ADR authoring only with the user's answer.",
  obligations: [
    {
      id: "required-gaps",
      text: "For each required item the document does not fill — who issues the shipping order, the reaction condition of the policy that requests shipping when a payment completes (or confirms the payment completion as its trigger), and an observation criterion for the shipping process — the same report has a candidate or a question with an identifier; none is silently left missing.",
    },
    {
      id: "basis",
      text: "Each rule and policy candidate proposes a basis kind and a short basis sentence. Where no document gives a basis — the one-shipment-per-order rule and the policy that requests shipping, unlike the paid-orders rule the shipping policy's article backs — the candidate is marked as having no basis found (a proposed kind may accompany the mark) and a basis question is asked.",
    },
    {
      id: "cross-feature-rule",
      text: "The rule that only paid orders ship relies on payment state the Payments feature changes: the rule candidate reaches the step that completes the payment as well as the shipping steps it governs (two or more steps), or a question asks which step changes that state.",
    },
    {
      id: "adr-level-asked",
      text: "The 30-minute deadline for the shipping order is an exact value the model does not hold: it is listed as not held in the model, and the report asks whether to pass it to ADR authoring. Nothing is written as an ADR or ADR candidate before the user answers (the report may say where it would go if passed).",
    },
  ],
  build(dir) {
    seedMapping(dir, {
      categories: {
        payments: { feature: "Payments", adrs: [], realizes: [], dependsOn: [] },
      },
    });
    write(dir, "docs/logistics/shipping.md", DOC);
    return buildPrompt(
      REPORT_REFERENCES,
      "This project has no saved ontology and no ADR documents yet; its ADR index lists a Payments feature with no ADR. The user chose to build directly.",
      "사용자: /ontology-build docs/logistics/shipping.md — 카드 결제 승인부터 출고 지시까지.",
      "docs/logistics/shipping.md:\n```markdown\n" + DOC + "```",
      "Do not call tools or write files. Show the report you would present: candidates grouped by bounded context, not-held content, and the questions with their identifiers.",
    );
  },
};
