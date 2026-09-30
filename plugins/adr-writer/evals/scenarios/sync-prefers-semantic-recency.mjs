import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

const expected = {
  A: "KEEP_30",
  B: "KEEP_30",
  C: "ASK_50",
  D: "ASK_ORDER",
  E: "KEEP_20",
  F: "KEEP_BOTH",
};

/** Judge declared outcomes, including incomplete or duplicate records; prose is judged separately. */
export function score({ tail }) {
  const rows = tail?.findings ?? [];
  return Object.entries(expected).map(([tag, choice]) => ({
    label: `${tag} distinguishes semantic recency from a timestamp or unknown intent`,
    pass:
      rows.length === 6 &&
      rows.filter((row) => row.tag === tag).length === 1 &&
      rows.find((row) => row.tag === tag)?.summary === choice,
    detail: rows.find((row) => row.tag === tag)?.summary ?? "missing",
  }));
}

export function deterministicScore(input) {
  return [...responseChecks(input, {}), ...score(input)];
}

export default {
  name: "sync-prefers-semantic-recency",
  description:
    "Resolve adopted semantic changes while preserving unknown intent, branch order, current user answers, and independent scopes.",
  obligations: [
    {
      id: "chronology",
      text: "Use the later adopted semantic decision for A and B; a later formatting commit does not restore the old value. For C recommend 50 but retain the existing contract pending intent confirmation. D has no established order. E follows the user's explicit reversal. F preserves separate plan scopes.",
    },
    {
      id: "interaction",
      text: "Group only C and D as remaining intent/chronology questions, continue independent cases, and do not claim edits or tests. Preserve all unrelated requirements. Outcomes in prose must agree with the records.",
    },
  ],
  score,
  deterministicScore,
  build() {
    return [
      skillText("adr-sync", { references: ["references/decision-reconciliation.md"] }),
      `# This run
Response-only probe: do not use tools, write files, or claim execution.
The user asks to sync the following independent cases. Use the supplied facts.
A: A free-plan cap of 20 was adopted on September 1. A September 20 decision,
committed as a descendant, explicitly adopts 30 for the same plan and replaces
only the cap. The code follows 30; the old document still says 20.
B: Same as A, but a September 29 formatting-only commit touches the old document.
C: ADR adopts 30. A September 29 code commit implements 50, without a recorded
reason or evidence of contract approval. No user has confirmed the new policy.
D: Two branches independently change the same rule, to 20 and 30. Neither is
an ancestor of the other. Their recorded dates disagree with commit timestamps.
E: Same as A, but the current user explicitly says to restore 20 for this plan.
F: The standard plan's cap is 20 and the enterprise plan's cap is 30; their
applicability is explicit and neither replaces the other.
Explain the current choices, remaining questions and what can proceed.
Then emit exactly A..F in EVAL-FINDINGS; each summary is one of KEEP_20,
KEEP_30, ASK_50, ASK_ORDER, KEEP_BOTH. ASK_50 means recommending 50 while
asking about intent, not applying it.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
