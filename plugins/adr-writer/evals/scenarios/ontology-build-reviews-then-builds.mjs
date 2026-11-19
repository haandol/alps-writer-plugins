import { seedIndexedAdrs, seedMapping } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const MAPPING = {
  categories: {
    "sales/quotes": {
      feature: "Quote approval",
      dependsOn: [],
      adrs: [
        {
          path: "docs/adr/sales/quotes/0001-quote-approval.md",
          status: "Accepted (2026-10-01)",
          summary: "A sales manager decides whether to approve a submitted quote",
        },
      ],
    },
  },
};
const FINDINGS = `/adr-review docs/adr/sales/quotes — 2 findings
- F1 (fix). R6: the contract row "A returned quote can be resubmitted" has no observable criterion.
- F2 (fix). R11: the Purpose calls the approver "sales lead" while the contract says "sales manager".`;

export default {
  name: "ontology-build-reviews-then-builds",
  description:
    "After the user chose to review ADRs first, only the approved fixes are applied through ADR authoring, the build drafts from the resulting ADRs, and the model save is approved separately.",
  obligations: [
    {
      id: "approved-only",
      text: "Only F1 is applied, through ADR Writer's authoring workflow on the ADR that owns the decision; F2 is held as the user asked and not edited (it may be carried as an open question).",
    },
    {
      id: "latest-documents",
      text: "The build re-reads the resulting ADR (with the F1 fix) before drafting model candidates or EventStorming from it.",
    },
    {
      id: "save-separate",
      text: "Neither the review choice nor the fix approval is treated as approval to save the model: saving is approved separately after the user reviews the candidates.",
    },
  ],
  build(dir) {
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    return buildPrompt(
      ["skills/ontology-build/references/pre-build-adr-review.md"],
      "This project has no saved ontology. It holds docs/adr/sales/quotes/0001-quote-approval.md. The user chose “ADR 먼저 리뷰” for this first build, and the review just returned:",
      "```text\n" + FINDINGS + "\n```",
      "You showed the findings and asked which to address. 사용자: F1만 고쳐 줘. F2는 일단 보류할게.",
      "Do not call tools or write files. State the steps you take from here until the user reviews the model candidates.",
    );
  },
};
