import { runAgentProcess } from "../lib/agent-process.mjs";

/** Isolate evaluation context and tools while reusing the configured provider credentials privately. */
export async function invokeClaude({
  prompt,
  cwd,
  config,
  model,
  schema,
  timeoutMs = 300_000,
  executable = "claude",
  bedrock,
}) {
  if (bedrock && (!bedrock.profile || !bedrock.region || !model))
    throw new Error("Explicit Bedrock target requires profile, region and model");
  const environment = { ...process.env };
  if (bedrock) {
    // The caller selected an AWS profile. Do not let unrelated static/bearer
    // credentials or another provider override it in the child process.
    for (const name of [
      "AWS_BEARER_TOKEN_BEDROCK",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_SESSION_TOKEN",
      "CLAUDE_CODE_USE_VERTEX",
      "CLAUDE_CODE_USE_FOUNDRY",
    ])
      delete environment[name];
    Object.assign(environment, {
      CLAUDE_CODE_USE_BEDROCK: "1",
      AWS_PROFILE: bedrock.profile,
      AWS_REGION: bedrock.region,
    });
  }
  const args = [
    "--bare",
    ...(bedrock
      ? [
          "--setting-sources",
          "",
          "--settings",
          JSON.stringify({
            env: {
              CLAUDE_CODE_USE_BEDROCK: "1",
              AWS_PROFILE: bedrock.profile,
              AWS_REGION: bedrock.region,
            },
          }),
        ]
      : []),
    "--disable-slash-commands",
    "-p",
    "--output-format",
    "json",
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    config ?? '{"mcpServers":{}}',
    "--no-session-persistence",
    ...(config ? ["--allowedTools", "mcp__fixture__*"] : []),
    ...(model ? ["--model", model] : []),
    ...(schema ? ["--json-schema", JSON.stringify(schema)] : []),
  ];
  const result = await runAgentProcess(executable, args, {
    cwd,
    env: environment,
    input: prompt,
    timeoutMs,
    stdoutLimit: 8 * 1024 * 1024,
    stderrLimit: 2 * 1024 * 1024,
  });
  if (!result.ok) {
    throw new Error(
      `${result.error ?? `Claude exited ${result.status}`}: ${result.stderr.slice(-1200) || result.stdout.slice(-1200)}`,
    );
  }
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    throw new Error("Claude returned non-JSON output");
  }
  if (json.is_error)
    throw new Error(`Claude error: ${json.result ?? JSON.stringify(json.errors ?? [])}`);
  const text = json.result ?? "";
  if (!text.trim() && !json.structured_output) throw new Error("Claude returned no result");
  return {
    text,
    structured: json.structured_output ?? null,
    ms: result.ms,
    usage: json.usage ?? null,
    costUSD: json.total_cost_usd ?? null,
    models: Object.keys(json.modelUsage ?? {}),
  };
}
