import {
  ontologySkillText,
  ruleText,
  seedIndexedAdrs,
  seedMapping,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { QUOTE_APPROVAL_ADR, quoteApprovalMapping } from "../lib/ontology-fixtures.mjs";

const adr = QUOTE_APPROVAL_ADR;

export default {
  name: "ontology-build-offers-adr-review",
  description:
    "A user accepts first-model setup in a project with an ADR, without yet choosing whether to review it.",
  obligations: [
    {
      id: "review-choice",
      text: "The next response asks whether to review the existing ADRs and optionally adjust them first or to proceed with the current documents. It respects the user's prior choice to build and leaves review optional.",
    },
    {
      id: "await-choice",
      text: "Before the user chooses, the response neither performs a review nor drafts model candidates. It treats the user's yes to building as neither authority to edit ADRs nor approval to save a model.",
    },
  ],
  build(dir) {
    const mapping = quoteApprovalMapping();
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping);
    write(
      dir,
      "quote-workflow.md",
      "A salesperson submits a quote. A sales manager approves or returns it.",
    );
    return [
      ontologySkillText("ontology-build", {
        references: ["skills/ontology-build/references/pre-build-adr-review.md"],
      }),
      ruleText("concepts.md"),
      "# This run",
      `This project has no saved ontology. It contains ${adr.path} and quote-workflow.md. ADR Writer is available.`,
      "The user was asked whether to create a business ontology and replied: “네, 견적 처리 업무부터 만들어 줘. quote-workflow.md에 업무 내용이 있어.”",
      "Respond to the user at this point in the conversation.",
      TAIL_SPEC,
    ].join("\n\n");
  },
};
