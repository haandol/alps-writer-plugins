#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, cpSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { catalog, skillCatalog, checkReferences, filesHash, PLUGIN, ROOT } from "./catalog.mjs";
import { routingCounts } from "./metrics.mjs";
import { saveSkillsReport, renderSavedSkillsReport } from "./report.mjs";
import { copyPlugin, runCase, runPool, calendarDate } from "../regression/run.mjs";
import { invokeClaude } from "../regression/claude.mjs";
import {
  confined,
  createWorkspace,
  makeTools,
  sha,
  snapshot,
  listFiles,
} from "../regression/workspace.mjs";
import { parseTail } from "../lib/harness.mjs";
import { scenarioNamesForChangedPaths } from "../impact-map.mjs";
import { BEDROCK_DEFAULTS } from "../deepeval/bedrock.mjs";

const HELP = `Skill evaluation — classification, routing, execution

  pnpm eval:skills --prepare
  pnpm eval:skills --list --suite execution
  pnpm eval:skills --prepare --suite execution --compare without-skill
  pnpm eval:skills --live --suite execution --compare without-skill --runs 5
  pnpm eval:skills --live --suite execution --compare both --baseline HEAD~1
  pnpm eval:skills --live --suite routing --runs 3
  pnpm eval:skills --report .codex/evals/<run> --open

Defaults: --prepare, --suite all, --runs 3, --compare none. --live explicitly
permits target and semantic-judge calls. Deterministic scorers do not call a judge.
--only filters case IDs; --changed <git-base> selects impacted cases.
--model chooses the Claude target; --judge-model/profile/region/provider choose
the existing DeepEval judge (Bedrock defaults). No provider fallback.
--out must be new/empty. --report regenerates HTML with no model calls.
Quality failures are findings, not CI gates. Exit 2 means setup/no scorable result.
`;

/** Parse one explicit execution intent; report/list/prepare never inherit live behavior. */
export function parseSkillsArgs(args) {
  const o = { suite: "all", runs: 3, jobs: 1, timeout: 300, compare: "none" };
  const flags = new Set(["live", "prepare", "list", "open", "help"]);
  const values = new Set([
    "suite",
    "runs",
    "jobs",
    "timeout",
    "compare",
    "only",
    "changed",
    "out",
    "baseline",
    "model",
    "judge-model",
    "judge-profile",
    "judge-region",
    "judge-provider",
    "report",
    "reference-date",
  ]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (flags.has(key)) o[key] = true;
    else if (values.has(key)) {
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw new Error(`--${key} requires a value`);
      o[key] = args[++i];
    } else throw new Error(`Unknown option ${args[i]}`);
  }
  if (!["all", "classification", "routing", "execution"].includes(o.suite))
    throw new Error("Unknown suite");
  if (!["none", "without-skill", "versions", "both"].includes(o.compare))
    throw new Error("Unknown comparison");
  if (o.live && (o.prepare || o.list || o.report))
    throw new Error("Live cannot be combined with preparation, listing or report-only");
  if (o.report && args.some((arg) => arg.startsWith("--") && !["--report", "--open"].includes(arg)))
    throw new Error("Report-only accepts --report and --open");
  if (o.changed && o.only) throw new Error("Choose --changed or --only");
  if (["versions", "both"].includes(o.compare) !== Boolean(o.baseline))
    throw new Error("Version comparison requires --compare versions|both and --baseline");
  if (o.compare !== "none" && !["all", "execution"].includes(o.suite))
    throw new Error("Comparisons require the execution suite");
  for (const key of ["runs", "jobs", "timeout"]) {
    o[key] = Number(o[key]);
    if (!Number.isInteger(o[key]) || o[key] < 1)
      throw new Error(`--${key} must be a positive integer`);
  }
  const date = o["reference-date"] ?? calendarDate();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid reference date");
  o.referenceDate = date;
  o.judge = { ...BEDROCK_DEFAULTS };
  for (const key of ["model", "profile", "region", "provider"])
    if (o[`judge-${key}`]) o.judge[key] = o[`judge-${key}`];
  if (!["bedrock", "claude"].includes(o.judge.provider)) throw new Error("Unknown judge provider");
  if (o.judge.provider === "claude" && !o["judge-model"]) o.judge.model = undefined;
  return o;
}

/** Include branch, staged, unstaged and untracked changes while rejecting an invalid comparison base. */
export function changedPaths(base) {
  const paths = new Set();
  for (const args of [
    ["diff", "--name-only", `${base}...HEAD`],
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
    if (result.status !== 0)
      throw new Error(`Cannot select changed evals: ${result.stderr.trim()}`);
    for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) paths.add(file);
  }
  return [...paths];
}

/** Apply the same change selection to existing scenarios and the separate execution/routing corpora. */
export function selectImpacted(cases, paths) {
  const classification = scenarioNamesForChangedPaths(
    paths,
    cases.filter((c) => c.type === "classification").map((c) => ({ ...c, name: c.id })),
  );
  const shared = paths.some((p) =>
    /^(shared\/report-write\/|plugins\/(adr-writer|alps-writer)\/skills\/report-write\/|plugins\/adr-writer\/evals\/(skills|lib)\/)/.test(
      p,
    ),
  );
  return cases.filter(
    (c) =>
      shared ||
      (c.type === "classification"
        ? classification.has(c.id)
        : c.type === "routing"
          ? paths.some(
              (p) => /\/skills\/|\/references\/|\/hooks\//.test(p) || p.includes("evals/skills/"),
            )
          : paths.some(
              (p) =>
                /plugins\/adr-writer\/(references|templates|scripts)\/|evals\/(regression|deepeval)\//.test(
                  p,
                ) || p.startsWith(`plugins/adr-writer/skills/${c.skill}/`),
            )),
  );
}

/** Save a JSON artifact under an already-owned run directory, never following escaped paths. */
function json(root, relative, value) {
  const file = confined(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

/** Record provider-reported model/cost evidence; never infer an unknown model from a requested alias. */
function recordCall(record, stage, response) {
  record.calls.push({
    stage,
    models: response.models ?? [],
    ms: response.ms ?? null,
    usage: response.usage ?? null,
    costUSD: response.costUSD ?? null,
    modelEvidence: response.modelEvidence ?? "provider-reported",
  });
  if (!response.models?.length || response.modelEvidence === "requested-bedrock-inference-profile")
    record.modelIdentityIncomplete = true;
  const key = stage === "target" ? "targetModels" : "judgeModels";
  record[key] = [...new Set([...record[key], ...(response.models ?? [])])];
}

/** Provide a confined MCP filesystem for old probes without granting a host shell or external tools. */
function toolConfig(directory, root, pluginRoot, logPath) {
  const file = path.join(directory, "mcp.json");
  writeFileSync(
    file,
    JSON.stringify({
      mcpServers: {
        fixture: {
          command: process.execPath,
          args: [
            path.join(PLUGIN, "evals/regression/tool-server.mjs"),
            root,
            pluginRoot,
            logPath,
            "1",
          ],
        },
      },
    }),
  );
  return file;
}

/** Snapshot ALPS-only instruction files into the shared probe view without changing ADR-owned duplicates. */
function addAlpsGuidance(destination) {
  const source = path.join(ROOT, "plugins/alps-writer");
  for (const folder of ["skills", "references"])
    for (const file of listFiles(source, folder)) {
      const target = confined(destination, file);
      if (existsSync(target)) continue;
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(confined(source, file), target);
    }
}

/** Read plugin metadata first and only selected bodies second; expectations never enter either prompt. */
async function runRouting(item, record, folder, entries, options, dependencies) {
  const visible = entries.map(({ name, description }) => ({ name, description }));
  const prompt = `Select the skills needed for this user request from the shipped catalog. Return JSON {"selected":[names]}; use [] when no skill is needed. Do not execute the task.\nCatalog:\n${JSON.stringify(visible)}\nRequest:\n${item.prompt}`;
  json(folder, "selection-input.json", { prompt });
  record.inputHash = sha({ prompt, required: item.required, allowed: item.allowed });
  if (!options.live) return;
  const response = await dependencies.target({
    prompt,
    cwd: folder,
    model: options.model,
    timeoutMs: options.timeout * 1000,
    schema: {
      type: "object",
      properties: { selected: { type: "array", items: { type: "string" } } },
      required: ["selected"],
      additionalProperties: false,
    },
  });
  recordCall(record, "target", response);
  json(folder, "selection-response.json", response);
  const selected = (response.structured ?? JSON.parse(response.text)).selected;
  if (
    !Array.isArray(selected) ||
    new Set(selected).size !== selected.length ||
    selected.some((name) => !entries.some((e) => e.name === name))
  )
    throw new Error("Malformed or unknown selected skill");
  record.selected = selected;
  record.routing = routingCounts(item.required, item.allowed, selected);
  record.checks = [
    {
      label: "required routes selected",
      pass: record.routing.fn === 0,
      detail: JSON.stringify(record.routing),
    },
    {
      label: "irrelevant routes excluded",
      pass: record.routing.fp === 0,
      detail: JSON.stringify(record.routing),
    },
  ];
  // Body availability is a separate observable phase; no task outcome is claimed.
  const bodies = entries
    .filter((e) => selected.includes(e.name))
    .map(({ name, source }) => ({ name, source }));
  json(folder, "selected-bodies.json", bodies);
  if (bodies.length) {
    const readResponse = await dependencies.target({
      prompt: `The previous catalog selection was ${JSON.stringify(selected)}. Read the selected shipped skill bodies below. Describe their relevant scope briefly; do not execute the user task.\n${JSON.stringify(bodies)}\nRequest: ${item.prompt}`,
      cwd: folder,
      model: options.model,
      timeoutMs: options.timeout * 1000,
    });
    recordCall(record, "target", readResponse);
    json(folder, "body-response.json", readResponse);
  }
  record.verdict = record.checks.every((c) => c.pass) ? "PASS" : "NOT_PROVEN";
}

/** Retain existing scorers while collecting isolated replies, actual files and semantic-judge calls. */
async function runClassification(item, record, folder, pluginRoot, options, dependencies) {
  if (item.id === "review-real-repo-adr" && options.only !== item.id) {
    record.notRunReason =
      "외부 저장소 사례는 --only review-real-repo-adr로 명시하고 입력을 설정해야 합니다.";
    return;
  }
  const root = path.join(folder, "workspace");
  mkdirSync(root);
  const prompt = await item.build(root);
  checkReferences(prompt, pluginRoot);
  const log = path.join(folder, "events.jsonl");
  const config = toolConfig(folder, root, pluginRoot, log);
  const wrapped = `This is an isolated classification probe, not a native client routing test.\nUse only the local fixture MCP tools. Fixture root ${root}; use relative paths for fixture reads/writes. CLAUDE_PLUGIN_ROOT is plugin/. Resolve referenced skills and guidance through plugin/skills and plugin/references.\n${prompt}`;
  json(folder, "input.json", { prompt: wrapped, files: snapshot(root) });
  record.promptHash = sha(prompt.split(root).join("<FIXTURE>"));
  record.inputHash = sha({ prompt: record.promptHash, files: snapshot(root) });
  if (!options.live) return;
  const response = await dependencies.target({
    prompt: wrapped,
    cwd: root,
    config,
    model: options.model,
    timeoutMs: options.timeout * 1000,
  });
  recordCall(record, "target", response);
  json(folder, "response.json", response);
  const tail = parseTail(response.text);
  if (!response.text?.trim() || !tail.complete)
    throw new Error("Missing scorable reply or machine-readable tail");
  if (item.semanticObligations) {
    const input = JSON.parse(readFileSync(path.join(folder, "input.json"), "utf8"));
    await judgeEvidence(
      { ...item, obligations: item.semanticObligations, turns: [prompt] },
      {
        before: input.files,
        after: snapshot(root),
        events: [],
        turns: [prompt],
        replies: [response.text],
        referenceDate: options.referenceDate,
      },
      record,
      folder,
      options,
      dependencies,
    );
  } else {
    record.checks = await item.score({ tail, output: response.text, dir: root });
    if (
      !Array.isArray(record.checks) ||
      !record.checks.length ||
      record.checks.some((c) => typeof c.pass !== "boolean")
    )
      throw new Error("No valid scorer checks");
    record.verdict = record.checks.every((c) => c.pass) ? "PASS" : "NOT_PROVEN";
  }
  json(folder, "evidence.json", {
    reply: response.text,
    tail,
    files: snapshot(root),
    events: existsSync(log) ? readFileSync(log, "utf8") : "",
  });
}

/** Use one citation-validated DeepEval path for semantic probes and actual document operations. */
async function judgeEvidence(item, evidence, record, folder, options, dependencies) {
  const { evaluateEvidence } = await import("../deepeval/engine.mjs");
  json(folder, "judge-input-evidence.json", evidence);
  const result = await (dependencies.evaluate ?? evaluateEvidence)({
    item,
    evidence,
    name: `${item.id}/${record.variant}/${record.repeat}`,
    cwd: folder,
    model: options.judge.model,
    provider: options.judge.provider,
    profile: options.judge.profile,
    region: options.judge.region,
    timeoutMs: options.timeout * 1000,
    invoke: dependencies.judge,
    onCall(response) {
      recordCall(record, "judge", response);
      json(folder, `judge-response-${record.calls.length}.json`, response);
    },
  });
  Object.assign(record, result);
  json(folder, "deepeval-result.json", result.frameworkResult ?? result);
}

/** Reuse actual edit capture and DeepEval, holding shared contracts and deterministic verifiers fixed. */
async function runExecution(
  item,
  record,
  folder,
  variant,
  candidate,
  options,
  dependencies,
  report,
) {
  if (variant.guidance !== false) {
    const body = readFileSync(path.join(variant.root, "skills", item.skill, "SKILL.md"), "utf8");
    checkReferences(body, variant.root);
  }
  const prepared = path.join(folder, "prepared");
  createWorkspace(prepared, item.build(), candidate.root);
  const tools = makeTools({
    root: prepared,
    pluginRoot: candidate.root,
    logPath: path.join(folder, "checks.jsonl"),
    turn: 0,
  });
  const checks = [
    tools.call("run_check", { kind: "policy-tests" }),
    tools.call("run_check", { kind: "structure" }),
  ];
  json(folder, "preflight.json", checks);
  if (checks.some((c) => c.exitCode !== 0)) throw new Error("Invalid execution fixture");
  const initialFilesHash = filesHash(prepared);
  record.conditionHash = sha({
    files: initialFilesHash,
    task: item.turns,
    obligations: item.obligations,
    timeout: options.timeout,
    tools: "fixture-documents-v1",
    checker: candidate.hash,
    judge: options.judge,
    harness: report.runtime.harnessHash,
    date: options.referenceDate,
  });
  record.inputHash = sha({
    files: initialFilesHash,
    task: item.turns,
    obligations: item.obligations,
  });
  if (!options.live) return;
  const captured = await runCase(item, variant, record.repeat, folder, {
    ...options,
    "capture-only": true,
    invoke: dependencies.target,
    fixturePluginRoot: candidate.root,
    checkerRoot: candidate.root,
  });
  for (const call of captured.calls) recordCall(record, "target", call);
  record.capture = `${record.artifactDirectory}/${captured.artifactDirectory}/evidence.json`;
  const evidence = JSON.parse(
    readFileSync(path.join(folder, captured.artifactDirectory, "evidence.json"), "utf8"),
  );
  if (captured.verdict !== "UNSCORED")
    throw new Error(captured.error ?? "Target execution did not complete");
  const finalTools = makeTools({
    root: path.join(folder, captured.artifactDirectory, "workspace"),
    pluginRoot: candidate.root,
    logPath: path.join(folder, "final-checks.jsonl"),
    turn: item.turns.length,
  });
  record.checks = ["policy-tests", "structure"].map((kind) => {
    const result = finalTools.call("run_check", { kind });
    return {
      label: `final ${kind}`,
      pass: result.exitCode === 0,
      detail: result.stdout + result.stderr,
    };
  });
  await judgeEvidence(item, evidence, record, folder, options, dependencies);
  if (record.verdict === "PASS" && record.checks.some((c) => !c.pass))
    record.verdict = "NOT_PROVEN";
}

/** Open only the explicitly requested local report; failure never changes evaluation results. */
function openReport(file) {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  const result = spawnSync(command, [file], { stdio: "ignore" });
  if (result.status !== 0) process.stderr.write(`Could not open report automatically: ${file}\n`);
}

/** Orchestrate explicit paid runs and reusable free reports with every requested outcome represented. */
export async function main(args, injected = {}) {
  const options = parseSkillsArgs(args);
  if (options.help) {
    process.stdout.write(HELP);
    return { status: 0 };
  }
  if (options.report) {
    const html = renderSavedSkillsReport(options.report);
    if (options.open) (injected.open ?? openReport)(html);
    process.stdout.write(`HTML: ${html}\n`);
    return { status: 0, html };
  }
  let cases = (injected.cases ?? (await catalog())).filter(
    (c) => options.suite === "all" || c.type === options.suite,
  );
  let changed;
  if (options.changed) {
    changed = changedPaths(options.changed);
    cases = selectImpacted(cases, changed);
  }
  if (options.only) cases = cases.filter((c) => c.id.includes(options.only));
  if (!cases.length) {
    if (options.changed) {
      process.stdout.write("No related evaluation cases. No model called.\n");
      return { status: 0 };
    }
    throw new Error("No matching evaluation cases");
  }
  if (options.list) {
    for (const c of cases) process.stdout.write(`${c.type}\t${c.id}\n`);
    return { status: 0 };
  }
  const output = path.resolve(
    options.out ??
      path.join(ROOT, ".codex/evals", `skills-${new Date().toISOString().replace(/[:.]/g, "-")}`),
  );
  if (existsSync(output) && readdirSync(output).length)
    throw new Error("--out must be new or empty");
  mkdirSync(output, { recursive: true });
  const candidate = {
    name: "candidate",
    ...copyPlugin(path.join(output, "plugin/candidate"), PLUGIN, null, {
      allowMissingSkills: true,
    }),
  };
  const variants = [candidate];
  if (["versions", "both"].includes(options.compare))
    variants.push({
      name: "baseline",
      ...copyPlugin(path.join(output, "plugin/baseline"), null, options.baseline, {
        allowMissingSkills: true,
      }),
    });
  if (["without-skill", "both"].includes(options.compare))
    variants.push({ ...candidate, name: "without-skill", guidance: false });
  const probeRoot = path.join(output, "plugin/probes");
  cpSync(candidate.root, probeRoot, { recursive: true });
  addAlpsGuidance(probeRoot);
  const entries = skillCatalog();
  json(
    output,
    "skill-catalog.json",
    entries.map(({ name, description, hash }) => ({ name, description, hash })),
  );
  const dependencies = { target: invokeClaude, ...injected };
  const version = options.live
    ? spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 10_000 })
    : null;
  const report = {
    schemaVersion: 1,
    framework: "skill-evals",
    generatedAt: new Date().toISOString(),
    mode: options.live ? "LIVE" : "PREPARED",
    selection: {
      suite: options.suite,
      only: options.only ?? null,
      changed: options.changed ?? null,
      paths: changed ?? null,
      compare: options.compare,
    },
    runsPerCase: options.runs,
    referenceDate: options.referenceDate,
    variants: variants.map((v) => v.name),
    runtime: {
      node: process.version,
      platform: process.platform,
      client: "claude-bare-fixture",
      clientVersion: version?.status === 0 ? version.stdout.trim() : null,
      requestedModel: options.model ?? null,
      judge: options.judge,
      candidateHash: candidate.hash,
      catalogHash: sha(entries.map(({ name, description, hash }) => ({ name, description, hash }))),
      harnessHash: sha(
        ["skills", "regression", "deepeval"].flatMap((dir) =>
          listFiles(path.join(PLUGIN, "evals"), dir)
            .filter((f) => f.endsWith(".mjs"))
            .map((f) => readFileSync(path.join(PLUGIN, "evals", f), "utf8")),
        ),
      ),
    },
    cases: cases.map(({ build, score, ...c }) => c),
    datasetHash: sha(cases.map(({ build, score, ...c }) => c)),
    runs: [],
  };
  for (const item of cases)
    for (let repeat = 1; repeat <= options.runs; repeat++)
      for (const v of item.type === "execution" ? variants : [candidate])
        report.runs.push({
          caseId: item.id,
          type: item.type,
          variant: v.name,
          repeat,
          verdict: "NOT_RUN",
          targetModels: [],
          judgeModels: [],
          calls: [],
          referenceDate: options.referenceDate,
          artifactDirectory: `runs/${item.id}-${v.name}-${repeat}`,
        });
  const save = () => {
    report.datasetHash = sha(
      report.cases.map((item) => ({
        ...item,
        inputHashes: [
          ...new Set(
            report.runs
              .filter((r) => r.caseId === item.id)
              .map((r) => r.inputHash)
              .filter(Boolean),
          ),
        ].sort(),
      })),
    );
    json(output, "results.json", report);
    return saveSkillsReport(output, report);
  };
  save();
  const previousCwd = process.cwd(),
    previousHome = process.env.DEEPEVAL_HOME;
  process.env.DEEPEVAL_HOME = path.join(output, ".deepeval-local");
  // DeepEval's optional local files stay in the disposable output, never the repository root.
  process.chdir(output);
  try {
    // Alternate within each task to avoid always observing the same condition first.
    await runPool(cases, options.jobs, async (item) => {
      for (let repeat = 1; repeat <= options.runs; repeat++) {
        const order =
          item.type === "execution"
            ? repeat % 2
              ? variants
              : [...variants].reverse()
            : [candidate];
        for (const variant of order) {
          const record = report.runs.find(
            (r) => r.caseId === item.id && r.repeat === repeat && r.variant === variant.name,
          );
          const folder = confined(output, record.artifactDirectory);
          mkdirSync(folder, { recursive: true });
          const started = Date.now();
          try {
            if (item.type === "routing")
              await runRouting(item, record, folder, entries, options, dependencies);
            else if (item.type === "classification")
              await runClassification(item, record, folder, probeRoot, options, dependencies);
            else
              await runExecution(
                item,
                record,
                folder,
                variant,
                candidate,
                options,
                dependencies,
                report,
              );
          } catch (error) {
            record.verdict = "ERROR";
            record.error = error.message;
          }
          record.elapsedMs = Date.now() - started;
          json(output, `${record.artifactDirectory}/result.json`, record);
          save();
          process.stdout.write(
            `${item.type} ${item.id} ${variant.name} #${repeat}: ${record.verdict}${record.error ? ` — ${record.error}` : ""}\n`,
          );
        }
      }
    });
  } finally {
    process.chdir(previousCwd);
    if (previousHome === undefined) delete process.env.DEEPEVAL_HOME;
    else process.env.DEEPEVAL_HOME = previousHome;
  }
  const html = save();
  if (options.open) (injected.open ?? openReport)(html);
  process.stdout.write(`HTML: ${html}\nResults: ${path.join(output, "results.json")}\n`);
  return {
    status: options.live
      ? report.runs.some((r) => ["PASS", "NOT_PROVEN"].includes(r.verdict))
        ? 0
        : 2
      : report.runs.some((r) => r.verdict === "ERROR")
        ? 2
        : 0,
    html,
    report,
    output,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2))
    .then(({ status }) => {
      process.exitCode = status;
    })
    .catch((error) => {
      process.stderr.write(`skill-evals: ${error.message}\n`);
      process.exitCode = 2;
    });
