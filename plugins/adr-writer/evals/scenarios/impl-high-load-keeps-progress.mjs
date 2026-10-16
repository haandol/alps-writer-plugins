import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "choice",
    text: "Retain the given 8/10 score and continue the already approved implementation without asking for a split choice. The score alone is not a gate. A non-blocking split direction may be offered; no contract or ownership is changed.",
  },
  {
    id: "candidates",
    text: "Do not claim that the user selected a split or alter ADR boundaries. This probe must not call tools or change files; describe the next authorized action without claiming it already ran. The visible reply and classification records agree.",
  },
];

/** Exact output/scope checks supplement the semantic obligations. */
export function deterministicScore(input) {
  return [
    ...responseChecks(
      input,
      { PLAN_SCORE: [], NEXT_STEP: [], CANDIDATE_STATE: [], EXECUTION_STATE: [] },
      { noTools: true },
    ),
    {
      label: "retains the 8/10 plan score",
      pass: /\b8\s*\/\s*10\b/.test(
        input.tail.findings.find((f) => f.tag === "PLAN_SCORE")?.summary ?? "",
      ),
      detail: "PLAN_SCORE must remain 8/10",
    },
  ];
}

import {
  expectNoText,
  expectText,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
The target ADR revision is already approved, every dependency is Accepted, and
planning found no contract gap, contradiction, unverified safety premise, or
destructive scope expansion.

The implementation plan spans checkout orchestration, payment and inventory
reservation, compensation after partial failure, and audit evidence. Its displayed
comprehension load is 8/10. The user has not requested a split.
`;

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

export default {
  name: "impl-high-load-keeps-progress",
  description:
    "An approved high-load implementation continues without a score-triggered split question while retaining contract and tool boundaries.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl", { references: ["skills/adr-impl/references/planning.md"] }),
      `\n---\n\n# This run`,
      SOURCE,
      `Do not call tools or change files. Show the normal next user-facing message before implementation.`,
      `Do not invent a new user choice or claim that implementation tools already ran.`,
      `In the tail include exactly PLAN_SCORE, NEXT_STEP, CANDIDATE_STATE, and EXECUTION_STATE. Use PROCEED_APPROVED or WAIT_FOR_CHOICE; BOUNDARIES_UNCHANGED or SPLIT_APPLIED; READY_NO_SCORE_GATE or WAIT_FOR_REPLY as applicable.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      expectText(
        taggedSummary(tail, "PLAN_SCORE"),
        /\b8\s*\/\s*10\b/,
        "retains the advisory score",
      ),
      expectText(taggedSummary(tail, "NEXT_STEP"), /PROCEED_APPROVED/, "continues approved scope"),
      expectText(
        taggedSummary(tail, "CANDIDATE_STATE"),
        /BOUNDARIES_UNCHANGED/,
        "does not silently split contracts",
      ),
      expectText(
        taggedSummary(tail, "EXECUTION_STATE"),
        /READY_NO_SCORE_GATE/,
        "no score-triggered wait",
      ),
      expectNoText(
        visible,
        /(?:선택|답변).{0,15}(?:주세요|기다)|shall we|choose (?:split|whether)/i,
        "no routine split choice",
      ),
    ];
  },
};
