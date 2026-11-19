import { seedIndexedAdrs, seedMapping, write } from "../lib/harness.mjs";
import {
  buildPrompt,
  QUOTE_APPROVAL_ADR,
  quoteApprovalMapping,
} from "../lib/ontology-fixtures.mjs";

const adr = QUOTE_APPROVAL_ADR;

export default {
  name: "ontology-build-one-time-review-override",
  description:
    "A one-time instruction to skip the saved ADR-review route applies to this build only and leaves the saved default unchanged.",
  obligations: [
    {
      id: "this-run",
      text: "For this build the response follows the user's instruction: it proceeds directly from the documents without the ADR review the saved preference would start.",
    },
    {
      id: "default-kept",
      text: "It treats the instruction as one-time: it does not run `set adr-review build-direct` (or any set or reset), and it says or implies that the saved review-first default still applies to later builds.",
    },
    {
      id: "not-approval",
      text: "Proceeding directly is not approval to save: the response presents draft candidates or questions and keeps saving the model for a separate approval.",
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
      "사용자: /ontology-build docs/quote-workflow.md — 이번에는 ADR 리뷰 없이 바로 초안을 만들어 줘.",
      "Do not call tools. Respond to the user at this point and name any command you would run.",
    );
  },
};
