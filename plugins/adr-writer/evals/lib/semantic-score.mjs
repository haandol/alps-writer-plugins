import { gradeEvidence, judgeSchema } from "../regression/judge.mjs";
import { DEFAULT_CMD, mkFixture, runAgent } from "./harness.mjs";

// Use the selected agent command in a separate context. The target never sees
// the scoring obligations; format/provider errors stay outside behavior rates.
export async function semanticScore({ obligations, sources, cmd = DEFAULT_CMD, invoke }) {
  const cwd = invoke ? undefined : mkFixture("adr-eval-judge-");
  const judgment = await gradeEvidence({
    obligations,
    sources,
    maxAttempts: 1,
    invoke:
      invoke ??
      (async (prompt) => {
        const result = runAgent(
          `${prompt}\n\nReturn only JSON matching this schema:\n${JSON.stringify(judgeSchema)}`,
          { cmd, cwd },
        );
        if (!result.ok || !result.stdout.trim())
          throw new Error(
            `semantic judge failed: ${result.error || result.stderr.trim() || `exit ${result.status} with empty output`}`,
          );
        return { text: result.stdout };
      }),
  });
  return judgment.obligations.map((item) => ({
    label: obligations.find((obligation) => obligation.id === item.id).label ?? item.id,
    pass: item.verdict === "PASS",
    detail: `${item.verdict}: ${item.reason}`,
  }));
}
