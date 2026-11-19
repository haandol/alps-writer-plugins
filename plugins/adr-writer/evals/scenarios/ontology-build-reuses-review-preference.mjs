import { seedIndexedAdrs, seedMapping, write } from "../lib/harness.mjs";
import {
  buildPrompt,
  QUOTE_APPROVAL_ADR,
  quoteApprovalMapping,
} from "../lib/ontology-fixtures.mjs";

const adr = QUOTE_APPROVAL_ADR;

export default {
  name: "ontology-build-reuses-review-preference",
  description:
    "A first build in a project whose user already chose to review existing ADRs first reuses that choice without asking or treating it as approval.",
  obligations: [
    {
      id: "reuse",
      text: "The saved preference says review-first. The response does not ask again whether to review the existing ADRs or build directly; it follows the saved route and starts with the ADR review before drafting model candidates.",
    },
    {
      id: "not-approval",
      text: "Reusing the choice is not approval: the response does not edit the ADR or save a model on the strength of the preference, and says that review findings still need the user's selection and that saving the model needs separate approval.",
    },
    {
      id: "no-write",
      text: "It does not run the preference helper's set or reset command; the saved choice stays as it is.",
    },
  ],
  build(dir) {
    const mapping = quoteApprovalMapping();
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping);
    write(
      dir,
      "docs/quote-workflow.md",
      "A salesperson submits a quote. A sales manager approves or returns it.",
    );
    return buildPrompt(
      [
        "skills/ontology-build/references/preferences.md",
        "skills/ontology-build/references/pre-build-adr-review.md",
      ],
      `This project has no saved ontology. It contains ${adr.path} and docs/quote-workflow.md. ADR Writer is available.`,
      'The project preference helper\'s `show` printed: {"setup":"build","adr-review":"review-first"}',
      "사용자: /ontology-build docs/quote-workflow.md",
      "Do not call tools. Respond to the user at this point and name any command you would run next.",
    );
  },
};
