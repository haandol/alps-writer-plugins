import { spawn } from "node:child_process";

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
  const started = Date.now();
  const result = await new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    let failure = null;
    function terminate(reason) {
      failure = reason;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already exited */
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          /* already exited */
        }
      }, 1500);
    }
    const timer = setTimeout(() => terminate("agent timeout"), timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 8 * 1024 * 1024) terminate("agent output exceeded limit");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 2 * 1024 * 1024) terminate("agent stderr exceeded limit");
    });
    child.on("error", (error) => {
      failure = error.message;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      // Do not cancel a pending process-group kill after a timeout: an MCP
      // descendant may still be alive after the CLI process exits.
      resolve({ code, stdout, stderr, failure, ms: Date.now() - started });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
  if (result.failure || result.code !== 0) {
    throw new Error(
      `${result.failure ?? `Claude exited ${result.code}`}: ${result.stderr.slice(-1200) || result.stdout.slice(-1200)}`,
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
