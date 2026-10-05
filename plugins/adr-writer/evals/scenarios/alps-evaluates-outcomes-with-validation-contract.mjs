import { alpsSkillText, alpsGuideText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

export const deterministicScore = (input) => responseChecks(input, {});
export const obligations = [
  {
    id: "complete-criteria",
    text: "For the document feature, organize Ideal Cases, Edge Cases and Automated Evaluation Metrics. Connect metrics to related cases/populations, calculations, evaluator and required or monitoring use, and present a meaningful eval/tension pair without imposing a quota or a new target. Connect independent obligations to their use, given situation/input, observable evidence, evaluator and explicit decision rule. Preserve the 9-section cap, 30-day unconfirmed-draft retention and approval-before-save behavior, including relevant boundary/failure cases. Do not leave those values only in a setup paragraph or combine independent behaviors into an unexplained checkbox. Equivalent clear wording is allowed; exact column labels are not the criterion.",
  },
  {
    id: "semantic-boundary",
    text: "For the answer feature, use the supplied product reference as evidence, define a narrow unsupported-claim failure rule, and require the judged claim and its supporting or contradictory reference. Unknown or missing judgment evidence remains unverified. Do not treat JSON output, temperature 0 or an unexplained aggregate score as deterministic semantic correctness.",
  },
  {
    id: "aggregation-and-resolution",
    text: "Distinguish code-comparable rules, actual user-entry evidence and LLM meaning judgments. Explain fixed-result aggregation: known required violations prevent acceptance; otherwise missing required evidence or execution/judgment errors leave it unverified; accept only with evidence for all required obligations. Keep commands, function names, test files, evaluator prompts and a new validation registry outside the PRD, and preserve the existing Demo outcome and feature save unit.",
  },
  {
    id: "optional-signals",
    text: "Completion checks are distinct from improvement monitoring. Meaningful tension candidates may be proposed but their absence does not block writing or implementation; no invented threshold or metric quota becomes required. Do not invoke tools or claim actual execution in this response-only proposal.",
  },
];

export default {
  name: "alps-evaluates-outcomes-with-validation-contract",
  description:
    "Evaluation rubrics preserve exact rules and evidence while separating code checks from uncertain semantic judgments.",
  obligations,
  deterministicScore,
  score: deterministicScore,
  build() {
    return [
      alpsSkillText("alps-init", { references: ["references/outcome-evaluation.md"] }),
      alpsGuideText(7),
      `# This run
Write Korean 7.x.6 proposals for two independent approved Features. Do not use tools or save files.
A. A user authors a document in a UI. A document has at most 9 sections. An unconfirmed draft is retained for 30 days then discarded. A section may be saved only after explicit approval; the confirmed section is saved once, and an unconfirmed draft is not displayed as complete. These are supplied example policies, not defaults for other products. Its end-to-end demo shows the approved section and continues to the next incomplete section.
B. A support assistant answers from the supplied authoritative product description: in-person property visits are available; virtual tours are not provided. The required outcome is an answer supported by that description, with no claim that an unavailable offering is provided. The demo shows the customer receiving an answer grounded in that description.
Make each proposal usable to choose evaluation inputs, evidence and rules before implementation. Neither Feature has a required business-metric target.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
