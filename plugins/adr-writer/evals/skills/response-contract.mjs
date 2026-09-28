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
      text: `${scenario.description.trim()} Verify this behavior against the scenario's concrete task, original files, visible reply, resulting files and recorded tool actions. Enforce the task's exact conditions, values, permissions and exceptions. A requested tag, keyword or PASS declaration alone is not evidence that the behavior occurred. For a response-only task judge the requested response, not unrequested implementation; for an artifact task require the actual artifact.`,
    },
  ];
}
