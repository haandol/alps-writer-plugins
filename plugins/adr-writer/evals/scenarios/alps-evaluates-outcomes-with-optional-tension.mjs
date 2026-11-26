import { alpsSkillText, alpsLiteGuideText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "lite-scope",
    text: "For Lite, keep the eight sections and business-level resolution. Give each FR and EC a pass/fail criterion, state release acceptance in Success Criteria, and show initial pass/fail observations in the Demo Scenario. Preserve ending the practice session on request as a Required FR, without adding Feature IDs, technology, a new evaluation section, sample-size design, data collection or evaluator code.",
  },
  {
    id: "optional",
    text: "The approved absence of a numeric KPI for Lite does not block writing, saving or completion, and no metric quota or omission approval is imposed; Success Criteria records that no KPI applies. A relevant observable counterexample is acceptable; any KPI or improvement signal the response proposes still gets a tension candidate and a recorded decision. Do not equate optional metrics with optional existing product or safety requirements.",
  },
  {
    id: "evidence",
    text: "Do not claim that a proposed demo proves production business improvement, that fabricated examples are observed traces, or that AI labels are human-confirmed. Keep existing approval-before-save boundaries and do not invoke tools in this response-only task.",
  },
];

export default {
  name: "alps-evaluates-outcomes-with-optional-tension",
  description:
    "Lite connects intent to acceptance without a numeric KPI, always proposing tension candidates for any signal it proposes while leaving adoption to the user. Full rubric completion and tension are covered by alps-evaluates-outcomes-with-validation-contract and -kpi-tension.",
  obligations,
  build() {
    return [
      alpsSkillText("lite-alps-init", { references: ["references/outcome-evaluation.md"] }),
      alpsLiteGuideText(3),
      alpsLiteGuideText(6),
      alpsLiteGuideText(8),
      `# This run
Prepare a Korean proposal; do not invoke tools or save files.
Lite: overseas workers rehearse a short English introduction. The approved functional requirements are starting topic-specific practice, receiving a relevant response to an answer, and ending the session when requested. The user explicitly has no numeric KPI. Suggest the relevant FR acceptance criteria, Success Criteria text and demo observations while preserving that choice and the eight-section structure.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
