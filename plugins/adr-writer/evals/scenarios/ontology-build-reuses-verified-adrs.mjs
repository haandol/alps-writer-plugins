import { ontologySkillText, ruleText, seedMapping, TAIL_SPEC, write } from "../lib/harness.mjs";

const source = "docs/adr/sales/quotes/0001-quote-decision.md";
const contract = `# ADR 0001: Quote decision

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

A sales representative needs a binding decision before sending a quote.

## Decision Drivers

- The manager must see a submitted quote.
- Sales must receive the decision.
- A returned quote must be correctable.

## Decision

Sales submits the quote. Its manager approves it or returns it with reasons.
Approval makes the quote available for sales to send. After a return, sales
can correct and resubmit. The representative observes the result on the quote.

## Alternatives

1. Automatic approval would remove the manager's required judgment.

## Consequences

Sales can distinguish an approved quote from one requiring revision.
`;

export default {
  name: "ontology-build-reuses-verified-adrs",
  description:
    "Draft the first workflow from already verified ADR clauses and keep an undocumented external hand-off open.",
  obligations: [
    {
      id: "reuse",
      text: "The answer proceeds from the current scoped implementation verification and the ADR without requiring another document review, implementation scan or additional source before drafting the covered flow.",
    },
    {
      id: "workflow",
      text: "The candidate workflow grounded in the quote-decision ADR includes sales submission, manager approval or reasoned return, and sales sending or correcting/resubmitting the quote. It is a draft, not an accepted business process.",
    },
    {
      id: "gap",
      text: "The optional external broker delivery is unconfirmed or open. No external recipient, performer, policy or outcome is invented; the unresolved part is separated from the covered in-product flow.",
    },
  ],
  build(dir) {
    write(dir, source, contract);
    seedMapping(dir, {
      categories: {
        "sales/quotes": {
          feature: "Quote decision",
          dependsOn: [],
          adrs: [
            {
              path: source,
              status: "Accepted (2026-10-01)",
              summary: "Managers approve or return submitted quotes.",
            },
          ],
        },
      },
    });
    return [
      ontologySkillText("ontology-build", {
        references: ["skills/ontology-build/references/pre-build-adr-review.md"],
      }),
      ruleText("concepts.md"),
      "# This run",
      source,
      contract,
      "A completed implementation review of this same revision checked submission, approval, return and resubmission through the quote UI and found no outstanding conformance issue. No ADR or implementation touched by that review has changed. External broker delivery was outside its scope.",
      "사용자: 이 자료로 견적 승인과 반려 업무의 첫 온톨로지 초안을 보여줘. 외부 중개인이 고객에게 전달하는 경우도 있는지는 아직 몰라.",
      TAIL_SPEC,
    ].join("\n\n");
  },
};
