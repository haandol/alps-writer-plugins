import { skillText, TAIL_SPEC } from "./harness.mjs";
import { responseChecks } from "./response-checks.mjs";

/** Build a fixed preparation/resume task; expectations are not copied into the task text. */
export function batchDecisionScenario(resume = false) {
  const expected = resume
    ? { A: ["CONTINUE", "APPLY"], B: "APPLY", C: "DEFER" }
    : { A: "READY", B: "ASK_INTENT", C: "ASK_CONFLICT" };
  function score({ tail }) {
    const rows = tail?.findings ?? [];
    return Object.entries(expected).map(([tag, summary]) => ({
      label: `${tag} preserves the batch's intent and exact answer scope`,
      pass:
        rows.length === 3 &&
        rows.filter((r) => r.tag === tag).length === 1 &&
        [summary].flat().includes(rows.find((r) => r.tag === tag)?.summary),
      detail: rows.find((r) => r.tag === tag)?.summary ?? "missing",
    }));
  }
  const scenario = {
    name: resume ? "sync-resumes-confirmed-batch" : "sync-batches-unclear-decisions",
    description: resume
      ? "Resume confirmed intent answers without reapproval, while a deferred conflict remains untouched."
      : "Prepare independent work and combine only unknown intent and contract conflicts into one question report.",
    obligations: [
      {
        id: "batch",
        text: resume
          ? "Continue A, apply B's exact approved contract and reason, defer C without guessing, then continue authorized validation. Do not ask a new proceed question, infer global approval, or reinterpret the deferred item as accepted."
          : "A requires no question. Gather B and C in one domain-grouped report with evidence, recommended meaning and exact questions. C's newer code is a candidate, not authority. Do not invent B's historical reason, ask one-by-one, or claim files changed.",
      },
    ],
    score,
    deterministicScore(input) {
      return [...responseChecks(input, {}), ...score(input)];
    },
    build() {
      return [
        skillText("adr-sync", {
          references: ["references/decision-questions.md", "references/decision-reconciliation.md"],
        }),
        `# This run
Response-only workflow probe. Do not use tools, create artifacts, or claim execution.
The user requests deep sync of three independent decisions. No code edits or
destructive path changes are authorized.
A: An already authorized, fully evidenced wording correction to an existing
contract, with no semantic change or unanswered question.
B: Only invited users may access a workspace. Code and ADR agree, but the
recorded purpose is missing. No reason has previously been supplied.
C: The ADR requires a 30-day retention period. Newer code uses 60 days, with no
recorded contract decision. Current intent is unknown.
${
  resume
    ? `A prior report assigned decision-1 to B and decision-2 to C and displayed
both exact proposed contracts. The user now replies: "decision-1: retain the
invited-user rule to protect customer confidentiality; I approve that contract
and its stated rationale. decision-2: defer, I need to confirm the retention
obligation. Continue the confirmed scope."`
    : `Explain what can proceed and prepare the content of one question report.
The user should be able to answer its decision IDs in one message.`
}
Explain next actions and the scope that stays unresolved.
Emit exactly A, B, C in EVAL-FINDINGS. Each summary must be one of READY,
ASK_INTENT, ASK_CONFLICT, CONTINUE, APPLY, DEFER.`,
        TAIL_SPEC,
      ].join("\n\n");
    },
  };
  return scenario;
}
