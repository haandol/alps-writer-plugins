import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "choice",
    text: "Retain the given 8/10 plan score and ask whether to review splitting or proceed with the original approved ADR. The user has not chosen, so wait rather than implementing or assuming an answer.",
  },
  {
    id: "candidates",
    text: "Do not generate concrete split candidates before the choice. Do not call tools or change files. The visible reply and PLAN_SCORE, NEXT_STEP, CANDIDATE_STATE and EXECUTION_STATE records agree.",
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
  name: "impl-high-load-asks-before-split",
  description:
    "An /adr-impl plan at 8/10 or higher must ask whether to review a split or proceed with the original ADR, wait for the choice, and avoid generating candidates first.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl"),
      `\n---\n\n# This run`,
      SOURCE,
      `Do not call tools or change files. Show the normal next user-facing message before implementation.`,
      `Do not assume which option the user chooses.`,
      `In the tail include exactly PLAN_SCORE, NEXT_STEP, CANDIDATE_STATE, and EXECUTION_STATE.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const score = taggedSummary(tail, "PLAN_SCORE");
    const next = taggedSummary(tail, "NEXT_STEP");
    const candidates = taggedSummary(tail, "CANDIDATE_STATE");
    const execution = taggedSummary(tail, "EXECUTION_STATE");

    return [
      expectText(score, /\b8\s*\/\s*10\b/, "retains the 8/10 plan score"),
      expectText(
        `${visible}\n${next}`,
        /(분할|split)[\s\S]{0,100}(검토|review)[\s\S]{0,160}(원안|원래|original|그대로|proceed)|(?:원안|원래|original|그대로|proceed)[\s\S]{0,160}(분할|split)[\s\S]{0,100}(검토|review)/i,
        "asks split review versus proceeding with the original ADR",
      ),
      expectText(
        candidates,
        /(후보|candidate)[\s\S]{0,100}(생성하지|없|미생성|not generated|none|wait|선택 후)/i,
        "does not generate concrete split candidates before the choice",
      ),
      expectText(
        execution,
        /(wait|대기|응답|선택)[\s\S]{0,100}(implementation|구현|진행)|(?:implementation|구현|진행)[\s\S]{0,100}(wait|대기|응답|선택)/i,
        "waits for the user's split choice before implementation",
      ),
      expectNoText(
        visible,
        /SPLIT_CANDIDATE|분할 후보\s*[:：]\s*(?:\n|1\.|[-*])|candidate\s*[123]\s*[:.)]/i,
        "keeps concrete candidates out of the first question",
      ),
      expectNoText(
        execution,
        /proceed\s*=\s*(?:true|yes)|즉시\s*구현|바로\s*진행|already proceeding/i,
        "does not proceed before the choice",
      ),
    ];
  },
};
