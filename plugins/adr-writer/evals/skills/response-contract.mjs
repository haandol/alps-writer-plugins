import { TAIL_SPEC } from "../lib/harness.mjs";
/**
 * Reuse each scenario's authored behavior as its fixed GEval obligation.
 * The legacy checks remain independent gates; their verdicts and the agent's
 * machine-readable self-assessment are never used to generate judging criteria.
 * Scenarios needing finer semantic decisions can export explicit obligations.
 */
export function responseObligations(scenario) {
  if (typeof scenario.description !== "string" || !scenario.description.trim())
    throw new Error(`Missing authored evaluation behavior: ${scenario.name}`);
  return [
    {
      id: "scenario-behavior",
      text: `${scenario.description.trim()} Verify this behavior against the scenario's concrete task, original files, visible reply, resulting files and recorded tool actions. Enforce the task's exact conditions, values, permissions and exceptions. Evaluation-only tags, repeated records and wording are not product obligations; assess the actual meaning even when that metadata is absent or repeated. A keyword or PASS declaration alone is not evidence that the behavior occurred. For a response-only task judge the requested response, not unrequested implementation; for an artifact task require the actual artifact.`,
    },
  ];
}

/** Retire only the harness-owned trailer; retain the task, product contracts and supplied sources. */
export function semanticPrompt(prompt) {
  return (
    prompt.split(TAIL_SPEC).join("") +
    `

Evaluation transport: Return the requested user-facing answer or actual artifacts. Evaluation-only EVAL-FINDINGS/tail/tag records mentioned above are optional diagnostic metadata and need not be generated. This supersedes only evaluation metadata instructions, not product/report schemas, scope labels needed to explain cases, required values, action permissions or evidence. Your response is judged from its meaning and actual files/tool results, not from these tags.
`
  );
}
