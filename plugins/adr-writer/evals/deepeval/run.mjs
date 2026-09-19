#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { main as collect, parseArgs, runPool } from "../regression/run.mjs";
import { confined, sha } from "../regression/workspace.mjs";
import { EVALUATION_STEPS, deepEvalInput, evaluateEvidence } from "./engine.mjs";
import { saveDeepEvalReport } from "./report.mjs";
import { prepareCoverageVisuals } from "./coverage-render.mjs";
import { BEDROCK_DEFAULTS } from "./bedrock.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const require = createRequire(import.meta.url);

export function parseDeepEvalArgs(args) {
  const forwarded = [];
  const judge = { ...BEDROCK_DEFAULTS };
  let from;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from") {
      from = args[++i];
      if (!from || from.startsWith("--"))
        throw new Error("--from requires an execution report directory");
    } else if (["--judge-provider", "--judge-profile", "--judge-region"].includes(args[i])) {
      const name = args[i].replace("--judge-", "");
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`--judge-${name} requires a value`);
      judge[name] = value;
    } else forwarded.push(args[i]);
  }
  if (!["bedrock", "claude"].includes(judge.provider))
    throw new Error("--judge-provider must be bedrock or claude");
  const options = parseArgs(forwarded);
  judge.model =
    options["judge-model"] ?? (judge.provider === "bedrock" ? BEDROCK_DEFAULTS.model : undefined);
  if (from && (options.baseline || options["candidate-root"]))
    throw new Error("--from already defines the captured baseline/candidate snapshots");
  if (options["capture-only"])
    throw new Error("use the regression collector directly for --capture-only");
  return { ...options, judge, collectorArgs: forwarded, from: from && path.resolve(from) };
}

export function loadExecutionReport(directory, options = {}) {
  const source = JSON.parse(readFileSync(confined(directory, "results.json"), "utf8"));
  if (!Array.isArray(source.cases) || !Array.isArray(source.runs))
    throw new Error("invalid execution report");
  if (
    !Number.isInteger(source.runsPerCase) ||
    source.runsPerCase < 1 ||
    new Set(source.cases.map((item) => item.id)).size !== source.cases.length
  )
    throw new Error("invalid captured case identities or repeat count");
  const cases = source.cases.filter(
    (item) =>
      (!options.skill || item.skill === options.skill) &&
      (!options.only || item.id.includes(options.only)),
  );
  if (!cases.length) throw new Error("no captured cases matched");
  const selected = new Set(cases.map((item) => item.id));
  const runs = source.runs.filter((run) => selected.has(run.caseId));
  const variants = source.variants?.baseline ? ["baseline", "candidate"] : ["candidate"];
  const seen = new Set();
  for (const run of runs) {
    if (
      !/^[a-z0-9-]+$/.test(run.caseId) ||
      !variants.includes(run.variant) ||
      !Number.isInteger(run.repeat) ||
      run.repeat < 1
    )
      throw new Error("invalid captured run identity");
    const identity = `${run.caseId}/${run.variant}/${run.repeat}`;
    if (seen.has(identity)) throw new Error("duplicate captured run");
    seen.add(identity);
    confined(directory, `${run.artifactDirectory}/evidence.json`);
  }
  for (const item of cases) {
    for (let repeat = 1; repeat <= source.runsPerCase; repeat++) {
      for (const variant of variants) {
        if (!seen.has(`${item.id}/${variant}/${repeat}`))
          throw new Error("execution report is incomplete; wait for the capture run to finish");
      }
    }
  }
  if (options["reference-date"] && options["reference-date"] !== source.referenceDate)
    throw new Error("cannot change the reference date of already captured evidence");
  return { source, cases, runs };
}

function snapshotLabel(directory, variant, hash) {
  const file = path.join(directory, "plugin", variant, "templates/adr/README.md");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const version = text.match(/adr-writer:rules-version\s+([0-9.]+)/)?.[1];
  return `${version ?? variant} (${hash?.slice(0, 12) ?? "unknown"})`;
}

const help = `DeepEval GEval evaluation for adr-sync / adr-rollup

  pnpm eval:deepeval --live --baseline HEAD --jobs 2 --runs 1
  pnpm eval:deepeval --live --from .codex/evals/captured-run --jobs 2
  pnpm eval:deepeval --prepare --from .codex/evals/captured-run

Without --from, the target skills run in isolated fixtures with --capture-only,
then DeepEval GEval evaluates the actual evidence. The custom judge is skipped.
--from reuses captured evidence; previous custom-judge scores are not input.
--live explicitly permits LLM calls. --prepare only exports the dataset.
--out must be a new/empty directory. --model selects the Claude Code target model.
DeepEval defaults: Bedrock, profile default, region us-east-1,
model us.openai.gpt-5.6-sol. --judge-model / --judge-profile / --judge-region override them.
--judge-provider claude explicitly selects the legacy Claude Code judge.
No automatic provider fallback, Confident AI upload or telemetry is enabled.
`;

export async function main(args) {
  const options = parseDeepEvalArgs(args);
  if (options.list && options.from) throw new Error("omit --from when listing built-in cases");
  if (options.list || (options.prepare && !options.from)) return collect(options.collectorArgs);
  if (options.help || (!options.live && !options.prepare)) {
    process.stdout.write(help);
    return 0;
  }
  const output = path.resolve(
    options.out ??
      path.join(ROOT, ".codex/evals", `deepeval-${new Date().toISOString().replace(/[:.]/g, "-")}`),
  );
  if (existsSync(output) && readdirSync(output).length)
    throw new Error("--out must be new or empty");
  mkdirSync(output, { recursive: true });
  let sourceDirectory = options.from;
  if (!sourceDirectory) {
    sourceDirectory = path.join(output, "execution");
    const captureArgs = ["--live", "--capture-only", "--out", sourceDirectory];
    for (const name of [
      "baseline",
      "skill",
      "only",
      "model",
      "runs",
      "jobs",
      "timeout",
      "reference-date",
    ]) {
      if (options[name] !== undefined) captureArgs.push(`--${name}`, String(options[name]));
    }
    if (options["candidate-root"])
      captureArgs.push("--candidate-root", path.resolve(options["candidate-root"]));
    const status = await collect(captureArgs);
    if (status !== 0)
      process.stderr.write(
        "Some target executions could not complete; DeepEval will mark missing evidence.\n",
      );
  }
  const { source, cases, runs } = loadExecutionReport(sourceDirectory, options);
  const packageFile = path.resolve(path.dirname(require.resolve("deepeval")), "../package.json");
  const frameworkVersion = JSON.parse(readFileSync(packageFile, "utf8")).version;
  const report = {
    framework: "deepeval",
    frameworkVersion,
    generatedAt: new Date().toISOString(),
    sourceDirectory,
    reusedEvidence: Boolean(options.from),
    referenceDate: source.referenceDate,
    runsPerCase: source.runsPerCase,
    cases,
    runs: [],
    rubricHash: sha(EVALUATION_STEPS),
    datasetHash: source.datasetHash,
    baselineLabel: source.variants.baseline
      ? snapshotLabel(sourceDirectory, "baseline", source.variants.baseline.hash)
      : null,
    candidateLabel: snapshotLabel(sourceDirectory, "candidate", source.variants.candidate.hash),
    evaluationSettings: {
      judgeProvider: options.judge.provider,
      judgeModel: options.judge.model ?? null,
      ...(options.judge.provider === "bedrock"
        ? { awsProfile: options.judge.profile, awsRegion: options.judge.region }
        : {}),
      strictMode: true,
      threshold: 1,
      jobs: options.jobs,
      telemetry: false,
      cloudUpload: false,
    },
  };
  await prepareCoverageVisuals(report, output);
  saveDeepEvalReport(output, report);
  // DeepEval's optional local stores and settings remain inside this new output
  // directory, never the user's existing ~/.deepeval or repository settings.
  const previousCwd = process.cwd();
  process.chdir(output);
  process.env.DEEPEVAL_HOME = path.join(output, ".deepeval-local");
  try {
    await runPool(runs, options.jobs, async (original) => {
      const item = cases.find((c) => c.id === original.caseId);
      const artifactDirectory = `cases/${original.caseId}-${original.variant}-${original.repeat}`;
      const target = path.join(output, artifactDirectory);
      mkdirSync(target, { recursive: true });
      const record = {
        caseId: item.id,
        variant: original.variant,
        repeat: original.repeat,
        pluginHash: source.variants[original.variant].hash,
        referenceDate: source.referenceDate,
        artifactDirectory,
        verdict: "NOT_RUN",
        calls: [],
        models: [],
        targetModels: [...new Set(original.models ?? [])],
      };
      const started = Date.now();
      let phase = "evidence";
      try {
        const evidence = JSON.parse(
          readFileSync(
            confined(sourceDirectory, `${original.artifactDirectory}/evidence.json`),
            "utf8",
          ),
        );
        record.referenceDate = evidence.referenceDate ?? original.referenceDate ?? null;
        writeFileSync(path.join(target, "evidence.json"), JSON.stringify(evidence, null, 2));
        const input = deepEvalInput(item, evidence);
        writeFileSync(path.join(target, "test-case.json"), JSON.stringify(input, null, 2));
        if (options.live) {
          phase = "deepeval";
          process.stdout.write(
            `DeepEval GEval: ${item.id} ${original.variant} ${original.repeat}\n`,
          );
          const result = await evaluateEvidence({
            item,
            evidence,
            name: `${item.id}/${original.variant}/${original.repeat}`,
            cwd: target,
            model: options.judge.model,
            provider: options.judge.provider,
            profile: options.judge.profile,
            region: options.judge.region,
            timeoutMs: options.timeout * 1000,
            onCall(response) {
              record.calls.push({ ...response, text: undefined, structured: undefined });
              record.models.push(...response.models);
              writeFileSync(
                path.join(target, `model-response-${record.calls.length}.json`),
                JSON.stringify(response, null, 2),
              );
            },
          });
          Object.assign(record, result);
        }
      } catch (error) {
        record.verdict = phase === "evidence" ? "NOT_EVALUABLE" : "ERROR";
        record.error = error.message;
      }
      record.models = [...new Set(record.models)];
      record.elapsedMs = Date.now() - started;
      writeFileSync(
        path.join(target, "deepeval-result.json"),
        JSON.stringify(
          record.frameworkResult ?? { error: record.error, verdict: record.verdict },
          null,
          2,
        ),
      );
      writeFileSync(path.join(target, "result.json"), JSON.stringify(record, null, 2));
      report.runs.push(record);
      saveDeepEvalReport(output, report);
      process.stdout.write(`  ${item.id} ${original.variant}: ${record.verdict}\n`);
    });
  } finally {
    process.chdir(previousCwd);
  }
  process.stdout.write(`DeepEval HTML: ${path.join(output, "index.html")}\n`);
  return options.live && !report.runs.some((r) => ["PASS", "NOT_PROVEN"].includes(r.verdict))
    ? 2
    : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`adr-deepeval: ${error.message}\n`);
      process.exitCode = 2;
    });
}
