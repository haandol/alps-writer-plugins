import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EVALUATION_STEPS,
  classifyDeepEval,
  deepEvalInput,
  evaluateEvidence,
  loadDeepEval,
} from "./engine.mjs";
import { compareDeepEval, renderDeepEvalReport } from "./report.mjs";
import { loadExecutionReport, parseDeepEvalArgs } from "./run.mjs";
import { cases } from "../regression/cases.mjs";

const item = cases.find((c) => c.id === "sync-encbird-turn-units");
const evidence = {
  before: item.build(),
  after: item.build(),
  events: [],
  replies: ["실제 텍스트는 시드 1개를 제외해 5턴이고 음성은 6턴이다."],
  turns: item.turns,
  referenceDate: "2026-09-19",
};
const folder = () => mkdtempSync(path.join(tmpdir(), "adr-deepeval-"));

test("real DeepEval GEval/evaluate owns the strict metric; CLI is only the model adapter", async () => {
  let calls = 0;
  const output = await evaluateEvidence({
    item,
    evidence,
    name: "integration",
    cwd: folder(),
    invoke: async ({ prompt, schema }) => {
      calls++;
      assert.ok(prompt.includes(EVALUATION_STEPS[0]));
      assert.ok(prompt.includes(item.obligations[0].text));
      assert.equal(schema.properties.score.type, "number");
      assert.equal(schema.properties.reason.type, "string");
      assert.equal(schema.$schema, undefined, "CLI transport must not require a 2020-12 registry");
      return {
        text: "",
        structured: { score: 1, reason: "원문과 결과의 실제 5턴·음성 6턴 계약이 일치한다." },
        costUSD: 0,
        models: ["stub-model"],
        ms: 1,
      };
    },
  });
  assert.equal(calls, 1, "fixed steps must not trigger model-generated grading steps");
  assert.equal(output.verdict, "PASS");
  const metric = output.testResult.metricsData[0];
  assert.equal(metric.name, "ADR operation contract [GEval]");
  assert.equal(metric.strictMode, true);
  assert.equal(metric.threshold, 1);
  assert.equal(metric.score, 1);
  assert.equal(output.frameworkResult.confidentLink, null);
  assert.equal(process.env.CONFIDENT_API_KEY, "");
  assert.equal(process.env.DEEPEVAL_TELEMETRY_OPT_OUT, "1");
  assert.equal(process.env.CONFIDENT_TRACING_ENABLED, "false");
});

test("DeepEval score zero is not proof of a violation, and invalid scores remain errors", async () => {
  const zero = await evaluateEvidence({
    item,
    evidence,
    name: "not-established",
    cwd: folder(),
    invoke: async () => ({
      text: "",
      structured: { score: 0, reason: "필수 계약을 확인할 실행 증거가 부족하다." },
      models: ["stub"],
      costUSD: 0,
      ms: 1,
    }),
  });
  assert.equal(zero.verdict, "NOT_PROVEN");
  assert.equal(zero.testResult.success, false);
  const invalid = await evaluateEvidence({
    item,
    evidence,
    name: "invalid-score",
    cwd: folder(),
    invoke: async () => ({
      text: "",
      structured: {
        score: 2,
        reason: "정상이라는 주장만 있으므로 범위 밖 점수는 거절되어야 한다.",
      },
      models: ["stub"],
      costUSD: 0,
      ms: 1,
    }),
  });
  assert.equal(invalid.verdict, "ERROR");
  assert.match(invalid.error, /score 0 or 1/);
});

test("previous custom verdicts are excluded and incomplete/empty expectations cannot pass", () => {
  const input = deepEvalInput(item, { ...evidence, judgment: "OLD_JUDGE_SECRET_MARKER" });
  assert.doesNotMatch(JSON.stringify(input), /OLD_JUDGE_SECRET_MARKER/);
  assert.throws(() => deepEvalInput(item, { ...evidence, replies: [] }), /incomplete/);
  assert.throws(() => deepEvalInput({ ...item, obligations: [] }, evidence), /nonempty/);
  assert.equal(
    classifyDeepEval({
      success: true,
      metricsData: [
        {
          score: 1,
          success: true,
          strictMode: true,
          threshold: 1,
          error: "backend failed",
        },
      ],
    }),
    "ERROR",
  );
});

test("comparison distinguishes not-proven results from errors and requires matching models", () => {
  const before = {
    verdict: "PASS",
    models: ["judge"],
    targetModels: ["target"],
    referenceDate: "2026-09-19",
    pluginHash: "old",
  };
  const after = { ...before, verdict: "NOT_PROVEN", pluginHash: "new" };
  assert.equal(compareDeepEval(before, after), "REGRESSION_SIGNAL");
  assert.equal(compareDeepEval(after, { ...before, pluginHash: "newer" }), "IMPROVEMENT_OBSERVED");
  assert.equal(compareDeepEval(before, { ...after, verdict: "ERROR" }), "INCONCLUSIVE");
  assert.equal(compareDeepEval(before, { ...after, models: ["other"] }), "INCONCLUSIVE");
  assert.equal(compareDeepEval(before, { ...after, targetModels: ["other"] }), "INCONCLUSIVE");
  assert.equal(compareDeepEval(before, { ...before }), "SAME_SNAPSHOT");
});

test("recorded-run loading rejects missing pairs, duplicate identities and escaping evidence paths", () => {
  const dir = folder();
  const metadata = {
    cases: [item],
    runsPerCase: 1,
    referenceDate: "2026-09-19",
    variants: { candidate: { hash: "c" }, baseline: { hash: "b" } },
    runs: [{ caseId: item.id, variant: "candidate", repeat: 1, artifactDirectory: "runs/case" }],
  };
  const save = () => writeFileSync(path.join(dir, "results.json"), JSON.stringify(metadata));
  save();
  assert.throws(() => loadExecutionReport(dir), /incomplete/);
  metadata.runs.push({ ...metadata.runs[0], variant: "baseline" });
  save();
  assert.equal(loadExecutionReport(dir).runs.length, 2);
  metadata.runs[1].artifactDirectory = "../../outside";
  save();
  assert.throws(() => loadExecutionReport(dir), /relative|escape/);
  assert.throws(() => parseDeepEvalArgs(["--from", dir, "--baseline", "HEAD"]), /already defines/);
});

test("local DeepEval HTML escapes model text and links to framework-native results", () => {
  const report = {
    frameworkVersion: "test",
    generatedAt: "test",
    referenceDate: "2026-09-19",
    reusedEvidence: true,
    runsPerCase: 1,
    cases: [item],
    runs: [
      {
        caseId: item.id,
        variant: "candidate",
        repeat: 1,
        verdict: "NOT_PROVEN",
        artifactDirectory: "cases/test",
        calls: [],
        models: ["stub"],
        testResult: {
          metricsData: [{ score: 0, threshold: 1, reason: "<script>attack()</script>" }],
        },
      },
    ],
  };
  const html = renderDeepEvalReport(report);
  assert.match(html, /GEval/);
  assert.match(html, /deepeval-results\.json/);
  assert.match(html, /&lt;script&gt;attack/);
  assert.doesNotMatch(html, /<script>attack/);
});
