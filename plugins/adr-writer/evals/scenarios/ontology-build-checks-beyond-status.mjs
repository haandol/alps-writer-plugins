import { seedIndexedAdrs, seedMapping } from "../lib/harness.mjs";
import { adrDocument, buildPrompt } from "../lib/ontology-fixtures.mjs";

const MAPPING = {
  categories: {
    "sales/quotes": {
      feature: "Quote approval",
      dependsOn: [],
      adrs: [
        {
          path: "docs/adr/sales/quotes/0001-quote-approval.md",
          status: "Accepted (2026-10-01)",
          summary: "A sales manager approves or returns a submitted quote",
        },
      ],
    },
  },
};
const ADR = adrDocument({
  title: "Approve submitted quotes",
  purpose: "A quote reaches the customer only after a sales manager approves it.",
  decision: "A sales manager approves or returns each submitted quote.",
  rows: [
    "A submitted quote is approved or returned by a sales manager.",
    "A returned quote can be fixed and resubmitted by the salesperson.",
  ],
});

export default {
  name: "ontology-build-checks-beyond-status",
  description:
    "Drafting a model from Accepted ADRs that only passed a document review does not take their Status or that review as proof the code implements them; implementation conformance stays to be checked.",
  obligations: [
    {
      id: "not-from-status",
      text: "The response does not claim the code implements the quote ADR because it is Accepted or because the document review passed; it treats implementation conformance as not yet verified.",
    },
    {
      id: "verify-or-mark",
      text: "It either checks conformance for the relevant ADR through the implementation review (/adr-impl-review) or drafts from the ADR as the decision source while marking implementation behaviour as unverified; it does not confirm in the model any business behaviour neither the ADR nor a verified source establishes.",
    },
  ],
  build(dir) {
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/sales/quotes/0001-quote-approval.md": ADR });
    return buildPrompt(
      [
        "skills/ontology-build/references/pre-build-adr-review.md",
        "skills/ontology-build/references/candidate-review.md",
      ],
      "This project has no saved ontology. The user chose to review the ADRs first; `/adr-review docs/adr/sales/quotes` (a document-quality review, which reads no code) passed with no findings. No implementation review has been run on this ADR.",
      "docs/adr/sales/quotes/0001-quote-approval.md:\n```markdown\n" + ADR + "```",
      "사용자: 리뷰도 통과했고 Accepted니까 구현도 이대로라고 보고 바로 모델 만들어 줘.",
      "Do not call tools or write files. Respond with how you use this ADR for the model and what you check first.",
    );
  },
};
