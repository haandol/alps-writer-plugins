import { gradeEvidence, judgeSchema } from "../regression/judge.mjs";
import { BEDROCK_DEFAULTS } from "./judge-defaults.mjs";

/** Judge independently of the target command; explicit injected transport is used by deterministic tests. */
export async function semanticScore({
  obligations,
  sources,
  invoke,
  model = BEDROCK_DEFAULTS.model,
  profile = BEDROCK_DEFAULTS.profile,
  region = BEDROCK_DEFAULTS.region,
}) {
  const judgment = await gradeEvidence({
    obligations,
    sources,
    maxAttempts: 1,
    invoke:
      invoke ??
      (async (prompt) => {
        const { invokeBedrock } = await import("../deepeval/bedrock.mjs");
        return invokeBedrock({ prompt, schema: judgeSchema, model, profile, region });
      }),
  });
  return judgment.obligations.map((item) => ({
    label: obligations.find((obligation) => obligation.id === item.id).label ?? item.id,
    pass: item.verdict === "PASS",
    detail: `${item.verdict}: ${item.reason}`,
  }));
}
