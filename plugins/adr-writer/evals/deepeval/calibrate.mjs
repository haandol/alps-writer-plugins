#!/usr/bin/env node
import { mkdirSync, existsSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDeepEvalArgs } from "./run.mjs";
import { runPool } from "../regression/run.mjs";
import { sha } from "../regression/workspace.mjs";
import { evaluateEvidence, deepEvalInput, EVALUATION_STEPS } from "./engine.mjs";
import {
  calibrationCases,
  calibrationDefinition,
  buildCalibrationEvidence,
} from "./calibration-set.mjs";
import { renderDiagrams } from "./coverage-render.mjs";
import { renderCalibrationReport } from "./calibration-report.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = path.resolve(PLUGIN, "../..");
export function parseCalibrationArgs(args) {
  const forwarded = [];
  let split = "all";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--split") split = args[++i];
    else forwarded.push(args[i]);
  }
  if (!["all", "development", "holdout"].includes(split)) throw new Error("Invalid --split");
  const options = parseDeepEvalArgs(forwarded);
  if (options.from || options.baseline || options["candidate-root"] || options.model)
    throw new Error(
      "Calibration has authored evidence; use --judge-model, not target capture options",
    );
  return { ...options, split };
}

export function summarizeCalibration(runs) {
  const scored = runs.filter((r) => ["PASS", "NOT_PROVEN"].includes(r.verdict));
  return {
    requested: runs.length,
    scored: scored.length,
    matched: scored.filter((r) => r.actualScore === r.expectedScore).length,
    falseAcceptances: scored.filter((r) => r.expectedScore === 0 && r.actualScore === 1).length,
    falseRejections: scored.filter((r) => r.expectedScore === 1 && r.actualScore === 0).length,
    errors: runs.filter((r) => r.verdict === "ERROR").length,
    notRun: runs.filter((r) => r.verdict === "NOT_RUN").length,
    humanReviewed: runs.filter((r) => r.labelStatus === "human-reviewed").length,
  };
}

export async function main(args) {
  const options = parseCalibrationArgs(args);
  const entries = calibrationCases.filter(
    (entry) =>
      (options.split === "all" || entry.split === options.split) &&
      (!options.only || entry.id.includes(options.only)) &&
      (!options.skill || calibrationDefinition(entry).item.skill === options.skill),
  );
  if (!entries.length) throw new Error("No calibration cases selected");
  if (options.list) {
    process.stdout.write(
      entries
        .map((e) => `${e.id}: expected=${e.expectedScore}, ${e.split}, ${e.labelStatus}`)
        .join("\n") + "\n",
    );
    return 0;
  }
  if (options.help || (!options.prepare && !options.live)) {
    process.stdout.write(
      "pnpm eval:calibration --prepare | --live [--split all|development|holdout] [--jobs 2] [--runs 1]\nUses authored reference evidence, not new agent executions. Draft expected labels are NOT human review. Defaults to Bedrock GPT-5.6 Sol / default / us-east-1.\n",
    );
    return 0;
  }
  const output = path.resolve(
    options.out ?? path.join(ROOT, ".codex/evals", `calibration-${Date.now()}`),
  );
  if (existsSync(output) && readdirSync(output).length)
    throw new Error("--out must be new or empty");
  mkdirSync(output, { recursive: true });
  const definitions = entries.map((entry) => {
    const { item, ...definition } = calibrationDefinition(entry);
    return { ...definition, obligations: item.obligations };
  });
  const referenceHash = sha(
    readFileSync(new URL("./calibration-set.mjs", import.meta.url), "utf8"),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.live ? "LIVE_JUDGE" : "PREPARED",
    judge: options.judge,
    datasetHash: sha({ definitions, referenceHash }),
    referenceHash,
    rubricHash: sha(EVALUATION_STEPS),
    labelStatus: "needs-human-review",
    definitions,
    runs: [],
  };
  [report.diagram] = await renderDiagrams(
    [
      {
        id: "calibration-process",
        source: `flowchart TD
 A["고정 사례·기대 의무"] --> B["작성한 기준 산출물·도구 행동"]
 B --> C["정상 동의 표현 또는 통제된 반례"]
 C --> D["기대 점수·라벨·분할 정보를 제외한 증거"]
 D --> E["DeepEval GEval · GPT-5.6 Sol"]
 E --> F["관찰 점수·이유"]
 L["계약에서 도출한 기대 판정 초안"] --> G["초안 기대 판정과 비교"]
 F --> G
 G --> H["일치·오통과·오거절·오류 리포트"]
 H --> R["사람 검수 전 · 사람 정답 정확도로 표시하지 않음"]`,
      },
    ],
    output,
  );
  const save = () => {
    report.summary = summarizeCalibration(report.runs);
    writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2));
    writeFileSync(path.join(output, "index.html"), renderCalibrationReport(report));
  };
  const tasks = entries.flatMap((entry) =>
    Array.from({ length: options.runs }, (_, index) => ({ entry, repeat: index + 1 })),
  );
  const templates = new Map();
  for (const entry of entries) {
    const folder = path.join(output, "references", entry.id);
    mkdirSync(folder, { recursive: true });
    const evidence = buildCalibrationEvidence(entry, folder, PLUGIN);
    templates.set(entry.id, evidence);
    writeFileSync(path.join(folder, "evidence.json"), JSON.stringify(evidence, null, 2));
  }
  report.runs = tasks.map(({ entry, repeat }) => ({
    ...entry,
    repeat,
    verdict: "NOT_RUN",
    actualScore: null,
    artifactDirectory: `references/${entry.id}`,
    calls: [],
    evidenceHash: sha(templates.get(entry.id)),
  }));
  save();
  const previousCwd = process.cwd();
  const previousHome = process.env.DEEPEVAL_HOME;
  process.chdir(output);
  process.env.DEEPEVAL_HOME = path.join(output, ".deepeval-local");
  try {
    await runPool(report.runs, options.jobs, async (record) => {
      const evidence = templates.get(record.id);
      const { item } = calibrationDefinition(record);
      const folder = path.join(output, record.artifactDirectory);
      writeFileSync(
        path.join(folder, "test-case.json"),
        JSON.stringify(deepEvalInput(item, evidence), null, 2),
      );
      if (!options.live) return;
      process.stdout.write(`calibrate ${record.id} ${record.repeat}\n`);
      try {
        const result = await evaluateEvidence({
          item,
          evidence,
          name: `sample-${sha([report.datasetHash, record.id, record.repeat]).slice(0, 16)}`,
          provider: options.judge.provider,
          model: options.judge.model,
          profile: options.judge.profile,
          region: options.judge.region,
          cwd: folder,
          timeoutMs: options.timeout * 1000,
          onCall(response) {
            record.calls.push({ ...response, text: undefined, structured: undefined });
            writeFileSync(
              path.join(folder, `model-response-${record.repeat}-${record.calls.length}.json`),
              JSON.stringify(response, null, 2),
            );
          },
        });
        Object.assign(record, result);
        record.actualScore = result.testResult?.metricsData?.[0]?.score ?? null;
      } catch (error) {
        record.verdict = "ERROR";
        record.error = error.message;
      }
      writeFileSync(
        path.join(folder, `deepeval-result-${record.repeat}.json`),
        JSON.stringify(record.frameworkResult ?? { error: record.error }, null, 2),
      );
      save();
      process.stdout.write(
        `  expected ${record.expectedScore} / observed ${record.actualScore ?? record.verdict}\n`,
      );
    });
  } finally {
    process.chdir(previousCwd);
    if (previousHome === undefined) delete process.env.DEEPEVAL_HOME;
    else process.env.DEEPEVAL_HOME = previousHome;
  }
  save();
  process.stdout.write(`Calibration HTML: ${path.join(output, "index.html")}\n`);
  return options.live && report.summary.scored === 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(error.message + "\n");
      process.exitCode = 2;
    });
}
