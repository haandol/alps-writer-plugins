import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BEDROCK_DEFAULTS, bedrockClientConfig, invokeBedrock } from "./bedrock.mjs";
import { evaluateEvidence } from "./engine.mjs";
import { parseDeepEvalArgs } from "./run.mjs";
import { renderDeepEvalReport } from "./report.mjs";
import { cases } from "../regression/cases.mjs";

const response = {
  stopReason: "end_turn",
  output: {
    message: {
      role: "assistant",
      content: [{ text: '{"score":0,"reason":"필수 계약을 확인할 근거가 부족합니다."}' }],
    },
  },
  usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
  $metadata: { requestId: "test-request" },
};

test("DeepEval defaults to Bedrock default / GPT-5.6 Sol independently of target model", () => {
  assert.deepEqual(parseDeepEvalArgs(["--model", "target-model"]).judge, BEDROCK_DEFAULTS);
  const explicit = parseDeepEvalArgs([
    "--judge-profile",
    "evaluation",
    "--judge-region",
    "us-west-2",
    "--judge-model",
    "selected-model",
  ]);
  assert.deepEqual(explicit.judge, {
    provider: "bedrock",
    profile: "evaluation",
    region: "us-west-2",
    model: "selected-model",
  });
  assert.equal(parseDeepEvalArgs(["--judge-provider", "claude"]).judge.model, undefined);
  assert.throws(
    () => parseDeepEvalArgs(["--judge-provider", "unknown"]),
    /must be bedrock or claude/,
  );
  assert.throws(() => parseDeepEvalArgs(["--judge-profile"]), /requires a value/);
});

test("explicit default profile ignores unrelated ambient AWS profile and static credentials", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "eval-aws-profile-"));
  const overrides = {
    AWS_SHARED_CREDENTIALS_FILE: path.join(directory, "credentials"),
    AWS_CONFIG_FILE: path.join(directory, "config"),
    AWS_PROFILE: "unrelated",
    AWS_ACCESS_KEY_ID: "environment-test-key",
    AWS_SECRET_ACCESS_KEY: "environment-test-secret",
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  try {
    writeFileSync(
      overrides.AWS_SHARED_CREDENTIALS_FILE,
      "[default]\naws_access_key_id = default-test-key\naws_secret_access_key = default-test-secret\n[unrelated]\naws_access_key_id = unrelated-test-key\naws_secret_access_key = unrelated-test-secret\n",
    );
    writeFileSync(overrides.AWS_CONFIG_FILE, "");
    Object.assign(process.env, overrides);
    const config = bedrockClientConfig(BEDROCK_DEFAULTS);
    const credentials = await config.credentials();
    assert.equal(credentials.accessKeyId, "default-test-key");
    assert.equal(config.region, "us-east-1");
    assert.equal(config.maxAttempts, 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Bedrock adapter preserves prompt, schema, model and usage and closes its client", async () => {
  let closed = 0;
  const result = await invokeBedrock({
    prompt: "Complete evidence",
    schema: { type: "object", properties: { score: { type: "number" } } },
    clientFactory: (config) => ({
      async send(command, options) {
        assert.equal(config.region, "us-east-1");
        assert.equal(command.input.modelId, "us.openai.gpt-5.6-sol");
        assert.equal(command.input.messages[0].content[0].text, "Complete evidence");
        assert.match(command.input.system[0].text, /JSON Schema/);
        assert.equal(command.input.toolConfig, undefined);
        assert.ok(options.abortSignal);
        return response;
      },
      destroy() {
        closed++;
      },
    }),
  });
  assert.equal(closed, 1);
  assert.equal(result.structured.score, 0);
  assert.deepEqual(result.models, ["us.openai.gpt-5.6-sol"]);
  assert.deepEqual(result.usage, response.usage);
  assert.equal(result.costUSD, null);
  assert.equal(result.profile, "default");
});

test("incomplete, malformed, tool and denied answers are errors with no provider fallback", async () => {
  for (const failure of [
    { ...response, stopReason: "max_tokens" },
    { ...response, stopReason: "guardrail_intervened" },
    { ...response, output: { message: { content: [{ text: "not JSON" }] } } },
    { ...response, output: { message: { content: [] } } },
    { ...response, output: { message: { content: [{ toolUse: { name: "unexpected" } }] } } },
    new Error("AccessDeniedException"),
  ]) {
    let calls = 0;
    let closed = 0;
    await assert.rejects(
      invokeBedrock({
        prompt: "test",
        schema: { type: "object" },
        clientFactory: () => ({
          async send() {
            calls++;
            if (failure instanceof Error) throw failure;
            return failure;
          },
          destroy() {
            closed++;
          },
        }),
      }),
    );
    assert.equal(calls, 1);
    assert.equal(closed, 1);
  }
});

test("actual GEval can use Bedrock transport and the report names the selected provider", async () => {
  const item = cases.find((entry) => entry.id === "sync-encbird-turn-units");
  const evidence = {
    before: item.build(),
    after: item.build(),
    events: [],
    turns: item.turns,
    replies: ["미검증"],
    referenceDate: "2026-09-19",
  };
  const output = await evaluateEvidence({
    item,
    evidence,
    name: "bedrock-transport",
    invoke: (options) =>
      invokeBedrock({
        ...options,
        clientFactory: () => ({ send: async () => response, destroy() {} }),
      }),
  });
  assert.equal(output.verdict, "NOT_PROVEN");
  assert.equal(output.testResult.metricsData[0].evaluationModel, BEDROCK_DEFAULTS.model);
  const html = renderDeepEvalReport({
    cases: [],
    runs: [],
    runsPerCase: 1,
    evaluationSettings: {
      judgeProvider: "bedrock",
      judgeModel: BEDROCK_DEFAULTS.model,
      awsProfile: "default",
      awsRegion: "us-east-1",
    },
  });
  assert.match(html, /Bedrock Converse/);
  assert.match(html, /AWS 프로필 default/);
  assert.match(html, /us.openai.gpt-5.6-sol/);
  assert.doesNotMatch(html, /어댑터가 기존 Claude Code 제공자 설정을 사용/);
});
