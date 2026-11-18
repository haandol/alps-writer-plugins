import { ontologySkillText, ruleText, seedMapping, TAIL_SPEC, write } from "../lib/harness.mjs";

const ADR_PATH = "docs/adr/sales/quotes/0001-quote-approval.md";
const ADR = `# ADR 0001: A sales manager decides submitted quotes

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

Every submitted quote gets one accountable decision.

## Decision

A sales manager approves or returns each submitted quote. A returned quote goes back to the salesperson who submitted it, with the manager's reason.

### Requirement contract

- A returned quote is reassigned to its submitting salesperson with the return reason.

## Consequences

### Positive

- Every quote has one accountable decision.
`;
const CODE = `// src/quotes/expire.ts
export const sweep = (quotes) => quotes.filter((q) => daysSince(q.sentAt) > 30).forEach(expire);`;

export default {
  name: "ontology-build-resolves-before-asking",
  description:
    "Before asking, a build settles questions an authoritative repository source answers, and still asks what only code shows or what equal sources dispute.",
  obligations: [
    {
      id: "resolved",
      text: "Who receives a returned quote is answered by the Accepted ADR, so it is not asked as an open question: it is listed as resolved, with that ADR as its source, and the user can still answer it differently.",
    },
    {
      id: "code-only",
      text: "The 30-day expiry of a sent quote appears only in code. It is observed behavior, not a business decision, so it stays a question for the user (or an unconfirmed candidate); it is not marked resolved.",
    },
    {
      id: "conflict",
      text: "The sales handbook and the finance handbook disagree on who approves a discount of 10% or more. Neither outranks the other, so the question is asked, citing both documents as conflicting evidence, rather than one being picked.",
    },
  ],
  build(dir) {
    seedMapping(dir, {
      categories: {
        "sales/quotes": {
          feature: "Quote approval",
          dependsOn: [],
          adrs: [
            {
              path: ADR_PATH,
              status: "Accepted (2026-10-01)",
              summary: "A sales manager decides submitted quotes",
            },
          ],
        },
      },
    });
    write(dir, ADR_PATH, ADR);
    write(dir, "src/quotes/expire.ts", CODE);
    write(dir, "docs/sales-handbook.md", "할인율이 10% 이상이면 영업팀장이 승인한다.");
    write(dir, "docs/finance-handbook.md", "할인율이 10% 이상이면 재무팀이 승인한다.");
    return [
      ontologySkillText("ontology-build", {
        references: [
          "skills/ontology-build/references/ask-session.md",
          "skills/ontology-build/references/candidate-review.md",
        ],
      }),
      ruleText("concepts.md"),
      "# This run",
      "This project has no saved ontology. The user chose to build directly from the current documents. The sources you read:",
      `${ADR_PATH}:`,
      "```markdown",
      ADR,
      "```",
      "```ts",
      CODE,
      "```",
      "docs/sales-handbook.md: 할인율이 10% 이상이면 영업팀장이 승인한다.",
      "docs/finance-handbook.md: 할인율이 10% 이상이면 재무팀이 승인한다.",
      "Your open points for the quote workflow: who receives a returned quote, whether a sent quote expires, and who approves a large discount.",
      "Do not call tools. Show the questions file (questions.json) you would open the question session with.",
      TAIL_SPEC,
    ].join("\n\n");
  },
};
