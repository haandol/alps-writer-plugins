import { seedMapping, write } from "../lib/harness.mjs";
import { probeBatch, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

// q1: input marks, an original source and two documents that disagree.
const WORKSHOP = `# 견적 워크숍 정리 (자동 요약, 2026-10-02)

- [확인됨] 영업 담당자가 견적을 제출하면 영업 관리자가 승인하거나 반려한다. (원 출처: 2026-09-12 영업 회의록 3행)
- [추론] 승인된 견적은 고객에게 자동으로 발송된다.
- [미확인] 반려된 견적은 영업 담당자가 고쳐서 다시 제출한다.
- [확인됨] 모든 견적은 영업 관리자의 승인을 받아야 한다.
`;
const POLICY = `# 견적 승인 기준 (영업정책, 2026-08)

할인율이 20%를 넘는 견적만 영업 관리자가 승인한다. 그 밖의 견적은 영업 담당자가 바로 발송한다.
`;

// q2: required model items the document cannot fill.
const SHIPPING = `# 출고 업무 흐름 (신입 교육 자료)

결제 대행사가 카드 결제를 승인하면 결제가 완료된다.
결제가 완료된 주문만 출고한다 (회사 출고 정책 2조).
결제가 완료되면 출고를 요청한다.
창고 담당자가 출고할 상품을 준비한다.
상품이 준비되면 출고 지시서를 발행한다.
출고 지시는 결제 완료 후 30분 안에 내려야 한다.
주문 하나는 한 번만 출고한다.
`;

export default probeBatch({
  name: "ontology-build-probes-marks-and-gaps",
  agentTimeoutMs: 900_000, // two whole candidate answers in one response
  description:
    "Two independent first-build probes in one run: q1 keeps input marks' meaning — an inferred or unconfirmed claim is not stated, a confirmed mark is not the user's confirmation, an original source is the location and disagreeing documents are a conflict; q2 turns required model items the documents cannot fill into candidates or questions in the same report, marks a rule or policy without a basis with a basis question, and offers ADR-level content for ADR authoring only with the user's answer.",
  references: REPORT_REFERENCES,
  probes: [
    {
      id: "q1",
      obligations: [
        {
          id: "marks-kept",
          text: "The claim marked [추론] (approved quotes are sent automatically) is judged inferred and the claim marked [미확인] (a returned quote is fixed and resubmitted) is judged unconfirmed; neither is judged stated.",
        },
        {
          id: "original-source",
          text: "The candidate for the [확인됨] submission-and-approval claim gives its original source — the 2026-09-12 sales meeting notes, line 3 — as its source location, not only the workshop summary.",
        },
        {
          id: "conflict",
          text: "The approval requirement is judged conflicting: the workshop says every quote needs the sales manager's approval, the sales policy says only quotes with a discount above 20%. It becomes a question.",
        },
        {
          id: "location-or-marker",
          text: "Every model candidate element and relation — bounded contexts and their core logic included — shows its source document and location, or an explicit mark that no location was found; the four verdicts (stated, inferred, conflicting, unconfirmed) are distinguishable.",
        },
        {
          id: "not-confirmed",
          text: "The [확인됨] marks do not stand in for the user's confirmation: the response saves nothing and treats every candidate as still awaiting the user's confirmation (none is marked confirmed by the user).",
        },
        {
          id: "scope-stated",
          text: "The user gave no business scope, so the report states the scope it applied — the quote work the two documents cover.",
        },
      ],
      build(dir) {
        seedMapping(dir);
        write(dir, "docs/sales/workshop-summary.md", WORKSHOP);
        write(dir, "docs/sales/quote-policy.md", POLICY);
        return [
          "This project has no saved ontology and no ADR documents.",
          "사용자: /ontology-build docs/sales",
          "docs/sales/workshop-summary.md:\n```markdown\n" + WORKSHOP + "```",
          "docs/sales/quote-policy.md:\n```markdown\n" + POLICY + "```",
          "Do not call tools or write files. Show the candidates.json you would write for the candidate tool (every candidate with its verdict, evidence and confirmed fields), then the report's applied scope and its questions. Also say what you would save at this point.",
        ];
      },
    },
    {
      id: "q2",
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
        write(dir, "docs/logistics/shipping.md", SHIPPING);
        return [
          "This project has no saved ontology and no ADR documents yet; its ADR index lists a Payments feature with no ADR. The user chose to build directly.",
          "사용자: /ontology-build docs/logistics/shipping.md — 카드 결제 승인부터 출고 지시까지.",
          "docs/logistics/shipping.md:\n```markdown\n" + SHIPPING + "```",
          "Do not call tools or write files. Show the report you would present: candidates grouped by bounded context, not-held content, and the questions with their identifiers.",
        ];
      },
    },
  ],
});
