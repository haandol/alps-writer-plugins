import { alpsSkillText, alpsGuideText, alpsLiteGuideText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

export const deterministicScore = (input) => responseChecks(input, {});

export const obligations = [
  {
    id: "full-purpose",
    text: "For Full, distinguish completion checks of supported customer questions from later resolution-rate improvement. Propose a meaningful tension such as wrong answers or unjustified handoffs and explain the purpose-defeating shortcut. Do not invent a numeric threshold or call every monitoring change a mandatory failure.",
  },
  {
    id: "lite-scope",
    text: "For Lite, keep the four sections and experience-based scope. Explain adequate results in Essential User Experiences and show initial pass/fail observations in the Demo Scenario. Preserve ending the practice session on request as required, without adding Feature IDs, a new evaluation section, sample-size design or evaluator code.",
  },
  {
    id: "optional",
    text: "The approved absence of a numeric KPI for Lite does not block writing, saving or completion, and no metric quota or omission approval is imposed. A relevant observable counterexample is acceptable. Do not equate optional metrics with optional existing product or safety requirements.",
  },
  {
    id: "evidence",
    text: "Do not claim that a proposed demo proves production business improvement, that fabricated examples are observed traces, or that AI labels are human-confirmed. Keep existing approval-before-save boundaries and do not invoke tools in this response-only task.",
  },
];

export default {
  name: "alps-evaluates-outcomes-with-optional-tension",
  description:
    "Full and Lite connect intent to acceptance while proposing useful tension signals without metric quotas.",
  obligations,
  score: deterministicScore,
  deterministicScore,
  build() {
    return [
      alpsSkillText("alps-init", { references: ["references/outcome-evaluation.md"] }),
      alpsGuideText(7),
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      alpsLiteGuideText(4),
      `# This run
Prepare two separate Korean proposals; do not invoke tools or save files.
A. Full Feature: supported customer questions receive a grounded answer; a confirmed need for staff results in an actual handoff. The user wants to improve verified resolution rate later, but supplied no numeric acceptance thresholds. Write its Evaluation Rubric, keeping completion checks and improvement distinct.
B. Lite: overseas workers rehearse a short English introduction. The approved essential experiences are starting topic-specific practice, receiving a relevant response to an answer, and ending the session when requested. The user explicitly has no numeric KPI for this PoC. Suggest the relevant experience text and demo observations while preserving that choice and the four-section structure.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
