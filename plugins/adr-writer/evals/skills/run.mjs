#!/usr/bin/env bun
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  cpSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { catalog, skillCatalog, checkReferences, filesHash, PLUGIN, ROOT } from "./catalog.mjs";
import { DEFAULT_JOBS, limiter } from "../lib/run-pool.mjs";
import {
  behaviourFingerprint,
  cachedSamples,
  openCache,
  recordDependencies,
  scoringFingerprint,
} from "../lib/evaluation-cache.mjs";
import { routingCounts } from "./metrics.mjs";
import { carriedChanges, changedProbes, defaultBase, knownCaseIds } from "./evidence-selection.mjs";
import { startSkillsReport, renderSavedSkillsReport } from "./report.mjs";
import {
  copyPlugin,
  runCase,
  calendarDate,
  executionPrompt,
  initialFixtureChecks,
} from "../regression/run.mjs";
import { invokeClaude } from "../regression/claude.mjs";
import {
  confined,
  createWorkspace,
  makeTools,
  sha,
  snapshot,
  listFiles,
} from "../regression/workspace.mjs";
import { semanticPrompt } from "./response-contract.mjs";
import { capturedChecks } from "./mechanical-checks.mjs";
import { checkRequiredGuidance } from "../lib/required-guidance.mjs";
import { parseTail, ALPS_PLUGIN_ROOT, ONTOLOGY_PLUGIN_ROOT } from "../lib/harness.mjs";
import { evaluationImpactPaths, scenarioNamesForChangedPaths } from "../impact-map.mjs";
import { BEDROCK_DEFAULTS } from "../deepeval/bedrock.mjs";
import { validateReportEvaluation } from "./report-evaluation.mjs";
import { executionOutcome, ignoreReviewArtifacts } from "../lib/execution-checks.mjs";
import { toolServerConfig } from "../regression/tool-config.mjs";

/** The automatic policy's repeat ceiling after a failed, erroneous or unscored run. */
export const AUTO_MAX_RUNS = 3;

/** The target for routine regression; `--release` or `--model` choose another. */
export const REGRESSION_MODEL = "sonnet";

const HELP = `Skill evaluation — classification, routing, execution

  bun run eval:skills --prepare
  bun run eval:skills --list --suite execution
  bun run eval:skills --prepare --suite execution --compare without-skill
  bun run eval:skills --live --suite execution --compare without-skill --runs 5
  bun run eval:skills --live --suite execution --compare both --baseline HEAD~1
  bun run eval:skills --live --changed main
  bun run eval:skills --live --suite routing --runs 3
  bun run eval:skills --report .codex/evals/<run> --open
  bun run eval:skills --live --rejudge .codex/evals/<run> --jobs 2

Defaults: --prepare, --suite all, --runs auto, --compare none. --live explicitly
permits target and semantic-judge calls. Deterministic scorers do not call a judge.
--runs auto runs each case once (twice for a new case or with --confirm) and up
to ${AUTO_MAX_RUNS} times only after a failure or error. Reuse depends on content: a
result whose prompt, fixture, tool permissions, consumed plugin files,
obligations and scoring code are unchanged is reused from .codex/evals/cache;
one whose scoring alone changed is rejudged from its stored evidence. The
model, client and judge are recorded, not reuse keys; --no-reuse runs fresh.
--changed adds cases whose prompt carries a changed hunk or whose cached
fingerprints changed, and reports the omitted rest.
--runs N runs N fresh repeats (defect reproduction); comparisons default to 3.
Routine --runs auto targets --model ${REGRESSION_MODEL} unless --model is given; --release
runs the user's default model fresh (no reuse) for a release check.
All catalog classification responses receive DeepEval GEval judgments; existing
local checks remain independent gates. Routing is scored deterministically.
--only filters case IDs (comma-separated substrings); --changed <git-base> selects impacted cases.
--jobs bounds concurrent independent repeats (default up to 4; use 1 for serial).
--model chooses the Claude target; --judge-model/profile/region/provider choose
the existing DeepEval judge (Bedrock defaults). No provider fallback.
--target-profile <AWS-profile> --target-region <region> with --model selects
explicit Bedrock target credentials without loading user/project settings.
--out must be new/empty. --report regenerates HTML with no model calls.
Quality failures are findings, not CI gates. Exit 2 means setup/no scorable result.
`;

/** Parse one explicit execution intent; report/list/prepare never inherit live behavior. */
export function parseSkillsArgs(args) {
  const o = { suite: "all", jobs: DEFAULT_JOBS, timeout: 300, compare: "none" };
  const flags = new Set([
    "live",
    "prepare",
    "list",
    "open",
    "help",
    "no-reuse",
    "confirm",
    "release",
  ]);
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
    "target-profile",
    "target-region",
    "judge-model",
    "judge-profile",
    "judge-region",
    "judge-provider",
    "report",
    "rejudge",
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
  if (
    o.rejudge &&
    args.some((a) => ["--runs", "--model", "--target-profile", "--target-region"].includes(a))
  )
    throw new Error("Rejudge reuses captured target replies and repeat counts");
  if (o.rejudge && (o.changed || o.compare !== "none" || o.baseline || o.list || o.report))
    throw new Error("Rejudge uses captured cases; omit changed/compare/baseline/list/report");
  if (o.changed && o.only) throw new Error("Choose --changed or --only");
  if (["versions", "both"].includes(o.compare) !== Boolean(o.baseline))
    throw new Error("Version comparison requires --compare versions|both and --baseline");
  if (o.compare !== "none" && !["all", "execution"].includes(o.suite))
    throw new Error("Comparisons require the execution suite");
  // Regression evidence defaults to one run; measurements keep their repeat count.
  o.runs ??= o.compare === "none" ? "auto" : "3";
  if (o.runs !== "auto") {
    o.runs = Number(o.runs);
    if (!Number.isInteger(o.runs) || o.runs < 1)
      throw new Error("--runs must be auto or a positive integer");
  }
  if (o.runs === "auto" && o.compare !== "none")
    throw new Error("Comparisons measure fresh repeats; give --runs N");
  if (o.release) o["no-reuse"] = true;
  if (o.confirm && o.runs !== "auto")
    throw new Error("--confirm applies to --runs auto; --runs N already fixes the count");
  for (const key of ["jobs", "timeout"]) {
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
  if (o["target-profile"] || o["target-region"]) {
    if (!o["target-profile"] || !o["target-region"] || !o.model)
      throw new Error(
        "Explicit Bedrock target requires --target-profile, --target-region and --model",
      );
    o.targetBedrock = { profile: o["target-profile"], region: o["target-region"] };
  }
  // Routine regression runs on a lower-cost target; a release check runs the
  // user's default model fresh, so cached routine evidence never stands in for it.
  if (!o.model && !o.release && o.runs === "auto") o.model = REGRESSION_MODEL;
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
export function selectImpacted(cases, changedPaths) {
  const paths = evaluationImpactPaths(changedPaths);
  const classification = scenarioNamesForChangedPaths(
    paths,
    cases.filter((c) => c.type === "classification").map((c) => ({ ...c, name: c.id })),
  );
  const shared = paths.some((p) =>
    /^(shared\/report-writer\/|plugins\/adr-writer\/skills\/report-writer\/|plugins\/adr-writer\/evals\/(skills|lib|deepeval)\/|plugins\/adr-writer\/evals\/regression\/(judge|claude|workspace|tool-server|tool-config)\.mjs$)/.test(
      p,
    ),
  );
  return cases.filter(
    (c) =>
      shared ||
      (c.type === "classification"
        ? classification.has(c.id)
        : c.type === "routing"
          ? // Routing shows only shipped skill names, descriptions and selected bodies.
            paths.some(
              (p) =>
                /^plugins\/(adr|alps)-writer\/skills\/[^/]+\/SKILL\.md$/.test(p) ||
                p.includes("evals/skills/"),
            )
          : paths.some(
              (p) =>
                /plugins\/(adr|ontology)-writer\/(references|templates|scripts)\/|evals\/(regression|deepeval)\//.test(
                  p,
                ) ||
                (/^plugins\/(adr|ontology)-writer\/skills\//.test(p) &&
                  p.split("/")[3] === c.skill),
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
function toolConfig(directory, root, pluginRoot, logPath, item) {
  const file = path.join(directory, "mcp.json");
  writeFileSync(
    file,
    JSON.stringify(
      toolServerConfig({
        root,
        pluginRoot,
        logPath,
        turn: 1,
        guidance: !item.directiveOnly,
        checkerRoot: pluginRoot,
        artifactPaths: item.artifactPaths,
        draftRoot: item.draftRoot,
        businessContext: item.businessContext,
      }),
    ),
  );
  return file;
}

// Classification probes quote sibling plugins' skills, whose bodies read their own
// plugin's guidance through CLAUDE_PLUGIN_ROOT. The probe root is that root, so it
// carries the guidance those skills reference; files adr-writer ships stay its own.
const SIBLING_GUIDANCE = [
  [ALPS_PLUGIN_ROOT, ["skills", "references"]],
  [ONTOLOGY_PLUGIN_ROOT, ["skills", "references", "templates"]],
];

function addSiblingGuidance(destination) {
  for (const [source, folders] of SIBLING_GUIDANCE) {
    for (const folder of folders)
      for (const file of listFiles(source, folder)) {
        const target = confined(destination, file);
        if (existsSync(target)) continue;
        mkdirSync(path.dirname(target), { recursive: true });
        cpSync(confined(source, file), target);
      }
  }
}

/** The routing prompt shows only shipped names and descriptions; expectations never enter it. */
function routingPrompt(item, entries) {
  const visible = entries.map(({ name, description }) => ({ name, description }));
  return `Select the skills needed for this user request from the shipped catalog. Return JSON {"selected":[names]}; use [] when no skill is needed. Do not execute the task.\nCatalog:\n${JSON.stringify(visible)}\nRequest:\n${item.prompt}`;
}

/** The structured answer a routing trial must return; the model receives it with the prompt. */
const ROUTING_SCHEMA = {
  type: "object",
  properties: { selected: { type: "array", items: { type: "string" } } },
  required: ["selected"],
  additionalProperties: false,
};

/** The second routing prompt, which shows the selected shipped skill bodies. */
function routingBodyPrompt(selected, bodies, request) {
  return `The previous catalog selection was ${JSON.stringify(selected)}. Read the selected shipped skill bodies below. Describe their relevant scope briefly; do not execute the user task.\n${JSON.stringify(bodies)}\nRequest: ${request}`;
}

/** The content a routing trial is given: both prompts and the answer schema. */
function routingBehaviour(item, entries) {
  return behaviourFingerprint({
    prompt: routingPrompt(item, entries),
    item,
    // The bodies themselves are recorded per run as `skill:` dependencies.
    extra: { schema: ROUTING_SCHEMA, bodyPrompt: routingBodyPrompt(["<S>"], ["<B>"], item.prompt) },
  });
}

/** Score one captured selection deterministically; no model is involved.*/
function scoreRouting(item, record) {
  record.routing = routingCounts(item.required, item.allowed, record.selected);
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
  record.verdict = record.checks.every((c) => c.pass) ? "PASS" : "NOT_PROVEN";
}

/** Read plugin metadata first and only selected bodies second; expectations never enter either prompt. */
async function runRouting(item, record, folder, entries, options, dependencies) {
  const prompt = routingPrompt(item, entries);
  json(folder, "selection-input.json", { prompt });
  record.inputHash = sha({ prompt, required: item.required, allowed: item.allowed });
  record.behaviourHash = routingBehaviour(item, entries);
  if (!options.live) return;
  const response = await dependencies.target({
    prompt,
    cwd: folder,
    model: options.model,
    timeoutMs: options.timeout * 1000,
    schema: ROUTING_SCHEMA,
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
  // Body availability is a separate observable phase; no task outcome is claimed.
  const bodies = entries
    .filter((e) => selected.includes(e.name))
    .map(({ name, source }) => ({ name, source }));
  json(folder, "selected-bodies.json", bodies);
  if (bodies.length) {
    const readResponse = await dependencies.target({
      prompt: routingBodyPrompt(selected, bodies, item.prompt),
      cwd: folder,
      model: options.model,
      timeoutMs: options.timeout * 1000,
    });
    recordCall(record, "target", readResponse);
    json(folder, "body-response.json", readResponse);
  }
  // The selected bodies were shown to the target, so they are inputs of this trial.
  record.dependencies = recordDependencies([], skillContext(entries), { skills: selected });
  record.captured = true;
  scoreRouting(item, record);
}

/** Dependency context for routing trials: the shipped skill bodies by name. */
function skillContext(entries) {
  return { skills: new Map(entries.map(({ name, source }) => [name, source])) };
}

/** Build a probe's fixture and prompt and check its capabilities; no model is called. */
async function prepareClassification(item, record, folder, pluginRoot, options, fingerprint) {
  validateReportEvaluation(item);
  if (!Array.isArray(item.semanticObligations) || !item.semanticObligations.length)
    throw new Error("Classification requires fixed semantic obligations before target execution");
  const root = path.join(folder, "workspace");
  mkdirSync(root);
  const prompt = semanticPrompt(await item.build(root));
  checkReferences(prompt, pluginRoot);
  const log = path.join(folder, "events.jsonl");
  // Validate case capabilities before any paid target invocation.
  makeTools({
    root,
    pluginRoot,
    logPath: log,
    turn: 0,
    guidance: !item.directiveOnly,
    artifactPaths: item.artifactPaths,
    draftRoot: item.draftRoot,
    businessContext: item.businessContext,
  });
  const config = toolConfig(folder, root, pluginRoot, log, item);
  const guidance = item.directiveOnly
    ? "This session has only its startup directives."
    : "CLAUDE_PLUGIN_ROOT is plugin/. Resolve referenced skills and guidance through plugin/skills and plugin/references.";
  const wrapped = `This is an isolated classification probe, not a native client routing test.\nUse only the local fixture MCP tools. Fixture root ${root}; use relative paths for fixture reads/writes. ${guidance}\n${prompt}`;
  const initial = snapshot(root, item);
  json(folder, "input.json", { prompt: wrapped, files: initial });
  record.promptHash = sha(prompt.split(root).join("<FIXTURE>"));
  record.inputHash = sha({ prompt: record.promptHash, files: initial });
  // Only a cached run needs its behaviour fingerprint.
  if (fingerprint) record.behaviourHash = behaviourFingerprint({ prompt: wrapped, root, item });
  return { root, prompt, wrapped, log, config, initial };
}

/** Judge captured replies semantically while retaining objective artifact and action checks. */
async function runClassification(
  item,
  record,
  folder,
  pluginRoot,
  options,
  dependencies,
  fingerprint = false,
) {
  validateReportEvaluation(item);
  if (item.id === "review-real-repo-adr" && !options.only?.split(",").includes(item.id)) {
    record.notRunReason =
      "외부 저장소 사례는 --only review-real-repo-adr로 명시하고 입력을 설정해야 합니다.";
    return;
  }
  const { root, prompt, wrapped, log, config, initial } = await prepareClassification(
    item,
    record,
    folder,
    pluginRoot,
    options,
    fingerprint,
  );
  if (!options.live) return;
  let response;
  try {
    response = await dependencies.target({
      prompt: wrapped,
      cwd: root,
      config,
      model: options.model,
      // A heavy scenario declares the longer limit its whole-document answer needs.
      timeoutMs: Math.max(options.timeout * 1000, item.agentTimeoutMs ?? 0),
    });
  } catch (error) {
    // A timed-out invocation can leave a useful document. Keep its files and
    // raw trace without fabricating a reply, grading it, or erasing the error.
    json(folder, "evidence.json", {
      reply: null,
      tail: null,
      files: snapshot(root, item),
      events: existsSync(log) ? readFileSync(log, "utf8") : "",
      executionError: error?.message ?? String(error),
    });
    throw error;
  }
  recordCall(record, "target", response);
  json(folder, "response.json", response);
  const tail = parseTail(response.text);
  // Capture target evidence before local scorers can materialize review files.
  // Keep it even when tail validation or the judge subsequently fails.
  const files = snapshot(root, item);
  const rawEvents = existsSync(log) ? readFileSync(log, "utf8") : "";
  const events = rawEvents
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  json(folder, "evidence.json", { reply: response.text, tail, files, events: rawEvents });
  // The plugin files this run read decide whether a later edit invalidates it.
  record.dependencies = recordDependencies(
    events,
    { pluginRoot },
    { guidance: !item.directiveOnly },
  );
  if (!response.text?.trim()) throw new Error("Missing scorable reply");
  record.captured = true;
  const evidence = {
    before: initial,
    after: files,
    events,
    turns: [prompt],
    replies: [response.text],
    referenceDate: options.referenceDate,
  };
  json(folder, "judge-input-evidence.json", evidence);
  await scoreClassification(item, record, folder, evidence, root, options, dependencies);
}

/** Apply the current mechanical checks and semantic judge to one captured reply. */
async function scoreClassification(
  item,
  record,
  folder,
  evidence,
  workspace,
  options,
  dependencies,
) {
  const { before, after: files, events } = evidence;
  record.checks = capturedChecks(item, { before, files, events });
  if (item.supplementalChecks && item.score) {
    const output = evidence.replies.at(-1);
    const additional = await item.score({
      tail: parseTail(output),
      output,
      dir: workspace,
      events,
      before,
      files,
    });
    if (!Array.isArray(additional) || additional.some((check) => typeof check.pass !== "boolean"))
      throw new Error("Invalid mechanical artifact checks");
    record.checks.push(...additional);
  }
  await judgeEvidence(
    { ...item, obligations: item.semanticObligations, turns: evidence.turns },
    evidence,
    record,
    folder,
    options,
    dependencies,
  );
  if (record.verdict === "PASS" && record.checks?.some((c) => !c.pass))
    record.verdict = "NOT_PROVEN";
}

/** Fields of a cached trial that describe its result rather than its identity in this run. */
function cachedResult(folder, record) {
  const cached = JSON.parse(readFileSync(path.join(folder, "result.json"), "utf8"));
  const { caseId, type, variant, repeat, artifactDirectory, calls, elapsedMs, ...result } = cached;
  if (result.captureDirectory)
    result.capture = `${record.artifactDirectory}/${result.captureDirectory}/evidence.json`;
  return result;
}

/** Present a cached result with identical fingerprints as earlier evidence, not a new trial. */
function reuseCached(record, folder, entry) {
  Object.assign(record, cachedResult(folder, record), {
    origin: "reused",
    reusedFrom: {
      id: entry.id,
      createdAt: entry.createdAt,
      origin: entry.origin,
      behaviour: entry.behaviour,
      scoring: entry.scoring,
      clientVersion: entry.clientVersion ?? null,
      // Unknown cost stays unknown; it is never reported as free.
      costUSD: entry.costUSD ?? null,
      unpricedCalls: entry.unpricedCalls ?? null,
    },
    calls: [],
  });
}

/** Judge a cached reply under the current scoring; the target is not called again. */
async function rejudgeCached(candidate, item, record, folder, entry, options, deps) {
  const cached = cachedResult(folder, record);
  for (const file of readdirSync(folder))
    if (
      /^(result|deepeval-result|test-case|execution-checks|judge-response-\d+)\.json$|^final-checks\.jsonl$/.test(
        file,
      )
    )
      rmSync(path.join(folder, file));
  Object.assign(record, {
    origin: "rejudged",
    source: entry.source ?? entry.id,
    behaviourHash: entry.behaviour,
    dependencies: entry.dependencies,
    promptHash: cached.promptHash,
    inputHash: cached.inputHash,
    conditionHash: cached.conditionHash,
    targetModels: entry.targetModels ?? [],
    modelIdentityIncomplete: entry.modelIdentityIncomplete,
    clientVersion: entry.clientVersion ?? null,
    captured: true,
  });
  if (item.type === "routing") {
    record.selected = cached.selected;
    return scoreRouting(item, record);
  }
  if (item.type === "execution") {
    Object.assign(record, {
      capture: cached.capture,
      captureDirectory: cached.captureDirectory,
      referenceDate: cached.referenceDate ?? record.referenceDate,
    });
    return scoreExecution(item, record, folder, item.build(), candidate, options, deps);
  }
  const evidence = JSON.parse(readFileSync(path.join(folder, "judge-input-evidence.json"), "utf8"));
  record.referenceDate = evidence.referenceDate ?? record.referenceDate;
  await scoreClassification(
    item,
    record,
    folder,
    evidence,
    path.join(folder, "workspace"),
    options,
    deps,
  );
}

/** Use one citation-validated DeepEval path for semantic probes and actual document operations. */
async function judgeEvidence(item, evidence, record, folder, options, dependencies) {
  const { evaluateEvidence, deepEvalInput } = await import("../deepeval/engine.mjs");
  json(folder, "judge-input-evidence.json", evidence);
  json(folder, "test-case.json", deepEvalInput(item, evidence));
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
  fingerprint = false,
) {
  if (variant.guidance !== false) {
    const body = readFileSync(path.join(variant.root, "skills", item.skill, "SKILL.md"), "utf8");
    checkReferences(body, variant.root);
  }
  function recordPreflight(root, { policy, lint }) {
    json(folder, "preflight.json", [policy, lint]);
    const initialFilesHash = filesHash(root);
    record.conditionHash = sha({
      files: initialFilesHash,
      task: item.turns,
      obligations: item.obligations,
      timeout: options.timeout,
      tools: "fixture-documents-v2",
      artifactPaths: item.artifactPaths ?? [],
      checker: candidate.hash,
      judge: options.judge,
      targetBedrock: options.targetBedrock ?? null,
      harness: report.runtime.harnessHash,
      date: options.referenceDate,
    });
    record.inputHash = sha({
      files: initialFilesHash,
      task: item.turns,
      obligations: item.obligations,
    });
  }
  const fixture = item.build();
  if (!options.live) {
    const root = path.join(folder, "prepared");
    createWorkspace(root, fixture, candidate.root);
    const tools = makeTools({
      root,
      pluginRoot: variant.root,
      checkerRoot: candidate.root,
      logPath: path.join(folder, "checks.jsonl"),
      turn: 0,
      artifactPaths: item.artifactPaths,
    });
    if (variant.guidance !== false) checkRequiredGuidance(item, tools);
    const initial = initialFixtureChecks(tools);
    recordPreflight(root, initial);
    if (initial.policy.exitCode !== 0 || initial.lint.exitCode !== 0)
      throw new Error("Invalid execution fixture");
    return;
  }
  const captured = await runCase(item, variant, record.repeat, folder, {
    ...options,
    "capture-only": true,
    fixture,
    onPreflight: recordPreflight,
    invoke: dependencies.target,
    fixturePluginRoot: candidate.root,
    checkerRoot: candidate.root,
  });
  for (const call of captured.calls) recordCall(record, "target", call);
  record.capture = `${record.artifactDirectory}/${captured.artifactDirectory}/evidence.json`;
  record.captureDirectory = captured.artifactDirectory;
  if (captured.verdict !== "UNSCORED")
    throw new Error(captured.error ?? "Target execution did not complete");
  const evidence = JSON.parse(
    readFileSync(path.join(folder, captured.artifactDirectory, "evidence.json"), "utf8"),
  );
  // Only a cached run needs its behaviour fingerprint.
  if (fingerprint)
    record.behaviourHash = executionBehaviour(
      item,
      fixture,
      variant,
      candidate,
      options,
      path.join(folder, "fingerprint"),
    );
  record.dependencies = recordDependencies(
    evidence.events ?? [],
    { pluginRoot: variant.root, checkerRoot: candidate.root },
    { guidance: variant.guidance !== false },
  );
  record.captured = true;
  await scoreExecution(item, record, folder, fixture, candidate, options, dependencies);
}

/** The content of one execution trial: its fingerprint and the text it carries. */
function executionInputs(item, fixture, variant, candidate, options, scratch) {
  createWorkspace(scratch, fixture, candidate.root);
  try {
    // The first-turn prompt carries the template and skill body; later turns add
    // the item's own turns and the run's history. The date is a value, not content.
    const prompt = executionPrompt(
      item,
      variant.root,
      [],
      options.referenceDate,
      variant.guidance !== false,
    );
    const files = listFiles(scratch).map((file) => readFileSync(confined(scratch, file), "utf8"));
    return {
      behaviour: behaviourFingerprint({
        prompt,
        root: scratch,
        item,
        date: options.referenceDate,
        // Fixture edits between turns and injected tool faults are what the model meets.
        extra: {
          turns: item.turns,
          condition: variant.name,
          betweenTurns: item.betweenTurns ?? null,
          faults: item.faults ?? null,
        },
      }),
      text: [prompt, JSON.stringify(item.turns), ...files].join("\n"),
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Behaviour fingerprint of one execution trial. */
function executionBehaviour(item, fixture, variant, candidate, options, scratch) {
  return executionInputs(item, fixture, variant, candidate, options, scratch).behaviour;
}

/** Apply the current execution checks and judge to one captured multi-turn run. */
async function scoreExecution(item, record, folder, fixture, candidate, options, dependencies) {
  const evidence = JSON.parse(
    readFileSync(path.join(folder, record.captureDirectory, "evidence.json"), "utf8"),
  );
  ignoreReviewArtifacts(path.join(folder, record.captureDirectory, "workspace"));
  const finalTools = makeTools({
    root: path.join(folder, record.captureDirectory, "workspace"),
    pluginRoot: candidate.root,
    logPath: path.join(folder, "final-checks.jsonl"),
    turn: item.turns.length,
    artifactPaths: item.artifactPaths,
  });
  const { checks, caseChecks } = executionOutcome(
    finalTools,
    item,
    evidence,
    fixture,
    item.verifyEvidence,
  );
  record.checks = checks;
  if (caseChecks.length) json(folder, "execution-checks.json", caseChecks);
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
  if (options.rejudge) {
    const result = await (await import("./rejudge.mjs")).rejudge(options, injected);
    if (options.open) (injected.open ?? openReport)(result.html);
    return result;
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
  // `--only a,b` keeps cases matching any comma-separated substring.
  const only = options.only?.split(",").filter(Boolean) ?? [];
  if (only.length) cases = cases.filter((c) => only.some((part) => c.id.includes(part)));
  const available = cases;
  let changed;
  let probes = [];
  if (options.changed) {
    changed = injected.changedPaths ?? changedPaths(options.changed);
    cases = selectImpacted(cases, changed);
    probes = injected.probes ?? changedProbes(options.changed, changed);
  }
  // Listing builds fixtures to find carried changes, so it works in a throwaway directory.
  const output = options.list
    ? mkdtempSync(path.join(tmpdir(), "skill-evals-list-"))
    : path.resolve(
        options.out ??
          path.join(
            ROOT,
            ".codex/evals",
            `skills-${new Date().toISOString().replace(/[:.]/g, "-")}`,
          ),
      );
  if (!options.list && existsSync(output) && readdirSync(output).length)
    throw new Error("--out must be new or empty");
  mkdirSync(output, { recursive: true });
  // Fixtures live under the output, which may sit inside this repository's
  // work tree. Stop Git discovery at the output so a fixture never sees the
  // outer repository's history or status as its own.
  const previousCeiling = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = [output, previousCeiling].filter(Boolean).join(":");
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
  addSiblingGuidance(probeRoot);
  const entries = skillCatalog();
  const dependencies = {
    ...injected,
    target: (request) =>
      (injected.target ?? invokeClaude)({
        ...request,
        ...(options.targetBedrock ? { bedrock: options.targetBedrock } : {}),
      }),
  };
  const auto = options.runs === "auto";
  // Injected test targets never read or write the shared local cache unless given one.
  const cache =
    "cache" in injected
      ? injected.cache
      : injected.target || injected.judge || injected.evaluate
        ? null
        : openCache();
  // Recorded with each live result (not a reuse key); reading it calls no model.
  const version = options.live
    ? (injected.clientVersion ??
      spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 10_000 }))
    : null;
  options.clientVersion =
    typeof version === "string" ? version : version?.status === 0 ? version.stdout.trim() : null;

  let known;
  const isNew =
    injected.isNew ??
    ((item) => !(known ??= knownCaseIds(available, defaultBase(options.changed))).has(item.id));
  const memo = (compute) => {
    const values = new Map();
    return async (item) => {
      if (!values.has(item.id)) values.set(item.id, await compute(item));
      return values.get(item.id);
    };
  };
  const scoringOf = (item) =>
    scoringFingerprint({
      item,
      ...(item.type === "routing" ? { code: [scoreRouting, routingCounts] } : {}),
    });
  const contextOf = (item) =>
    item.type === "routing"
      ? skillContext(entries)
      : item.type === "execution"
        ? { pluginRoot: candidate.root, checkerRoot: candidate.root }
        : { pluginRoot: probeRoot };
  /** The behaviour fingerprint and carried text of a case, built without calling a model. */
  const inputsOf = memo(async (item) => {
    if (item.id === "review-real-repo-adr" && !options.only?.split(",").includes(item.id))
      return null;
    try {
      if (item.type === "routing")
        return { behaviour: routingBehaviour(item, entries), text: routingPrompt(item, entries) };
      const folder = confined(output, `plan/${item.id}`);
      mkdirSync(folder, { recursive: true });
      try {
        if (item.type === "execution")
          return executionInputs(
            item,
            item.build(),
            candidate,
            candidate,
            options,
            path.join(folder, "w"),
          );
        const probe = {};
        const { wrapped, root } = await prepareClassification(
          item,
          probe,
          folder,
          probeRoot,
          options,
          true,
        );
        const files = listFiles(root).map((file) => readFileSync(confined(root, file), "utf8"));
        return { behaviour: probe.behaviourHash, text: [wrapped, ...files].join("\n") };
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    } catch (error) {
      // The trial reports the preparation error itself; selection must not hide it.
      return { error: error.message };
    }
  });
  const samplesOf = memo(async (item) => {
    const inputs = await inputsOf(item);
    if (!cache || !inputs?.behaviour) return { reusable: [], rejudgeable: [] };
    return cachedSamples(cache, item.id, {
      behaviour: inputs.behaviour,
      scoring: scoringOf(item),
      context: contextOf(item),
    });
  });

  // The impact map is a path heuristic. A case it skipped still runs when its
  // prompt or fixture carries a changed hunk, or when its cached evidence no
  // longer matches its current inputs, plugin reads included.
  const reasons = new Map();
  let omitted = [];
  if (options.changed) {
    const selected = new Set(cases.map((c) => c.id));
    for (const item of available) {
      if (selected.has(item.id)) continue;
      const inputs = probes.length || cache?.entries(item.id).length ? await inputsOf(item) : null;
      const carried = inputs?.text ? carriedChanges(inputs.text, probes) : [];
      if (inputs?.error) reasons.set(item.id, `could not be prepared: ${inputs.error}`);
      else if (carried.length) reasons.set(item.id, `carries ${carried.join(", ")}`);
      else if (inputs?.behaviour && cache?.entries(item.id).length) {
        const { reusable, rejudgeable, stale } = await samplesOf(item);
        if (!reusable.length)
          reasons.set(
            item.id,
            stale
              ? "a plugin file one of its runs consumed has changed"
              : rejudgeable.length
                ? "its scoring changed or its earlier judgment failed"
                : "its inputs changed since its cached run",
          );
      }
    }
    cases = available.filter((c) => selected.has(c.id) || reasons.has(c.id));
    omitted = available.filter((c) => !cases.includes(c)).map((c) => c.id);
    for (const [id, reason] of reasons)
      process.stdout.write(`Selected beyond the impact map: ${id} — ${reason}\n`);
    process.stdout.write(
      `Change selection: ${cases.length} of ${available.length} case(s); ${omitted.length} omitted.\n`,
    );
  }
  const restoreCeiling = () => {
    if (previousCeiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
    else process.env.GIT_CEILING_DIRECTORIES = previousCeiling;
  };
  if (!cases.length || options.list) {
    restoreCeiling();
    if (options.list) for (const c of cases) process.stdout.write(`${c.type}\t${c.id}\n`);
    if (options.list) rmSync(output, { recursive: true, force: true });
    if (options.list || options.changed) {
      if (!cases.length) process.stdout.write("No related evaluation cases. No model called.\n");
      return { status: 0 };
    }
    throw new Error("No matching evaluation cases");
  }
  json(
    output,
    "skill-catalog.json",
    entries.map(({ name, description, hash }) => ({ name, description, hash })),
  );

  /** Decide how many trials a case needs and which of them cached evidence can supply. */
  async function planCase(item) {
    if (!auto) return { count: options.runs, reuse: [], rejudge: [] };
    const required = options.confirm || isNew(item) ? 2 : 1;
    if (!cache || options["no-reuse"] || !cache.entries(item.id).length)
      return { count: required, reuse: [], rejudge: [] };
    const { reusable, rejudgeable } = await samplesOf(item);
    // Every cached run with this behaviour stays in the sample once a failure is
    // known or the scoring changed: current ones are reused, the rest rejudged,
    // so neither a later pass nor a new scoring hides an earlier failure.
    const failing = reusable.some((e) => e.verdict !== "PASS");
    const complete = failing || rejudgeable.length > 0;
    const reuse = complete ? reusable : reusable.slice(0, required);
    const rejudge = complete ? rejudgeable : [];
    const count = Math.max(required, reuse.length + rejudge.length, failing ? AUTO_MAX_RUNS : 0);
    return { count, reuse, rejudge };
  }
  const plans = new Map();
  for (const item of cases) plans.set(item.id, await planCase(item));

  const report = {
    schemaVersion: 1,
    scoringPolicy: "semantic-v1",
    framework: "skill-evals",
    generatedAt: new Date().toISOString(),
    mode: options.live ? "LIVE" : "PREPARED",
    selection: {
      suite: options.suite,
      only: options.only ?? null,
      changed: options.changed ?? null,
      paths: changed ?? null,
      compare: options.compare,
      beyondImpactMap: Object.fromEntries(reasons),
      omitted,
    },
    runsPerCase: auto
      ? Math.max(AUTO_MAX_RUNS, ...[...plans.values()].map((plan) => plan.count))
      : options.runs,
    repeatPolicy: auto ? "auto" : "fixed",
    autoMaxRuns: AUTO_MAX_RUNS,
    referenceDate: options.referenceDate,
    variants: variants.map((v) => v.name),
    runtime: {
      node: process.version,
      platform: process.platform,
      client: "claude-bare-fixture",
      clientVersion: options.clientVersion,
      requestedModel: options.model ?? null,
      targetBedrock: options.targetBedrock ?? null,
      judge: options.judge,
      candidateHash: candidate.hash,
      catalogHash: sha(entries.map(({ name, description, hash }) => ({ name, description, hash }))),
      harnessHash: sha(
        ["skills", "regression", "deepeval", "lib"].flatMap((dir) =>
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
  const groupsByCase = new Map(cases.map((c) => [c.id, []]));
  /** Add one repeat of a case; paired execution variants alternate their order. */
  function addRepeat(item, repeat, source = { mode: "execute" }) {
    const trials = (item.type === "execution" ? variants : [candidate]).map((variant) => {
      const record = {
        caseId: item.id,
        type: item.type,
        variant: variant.name,
        repeat,
        verdict: "NOT_RUN",
        targetModels: [],
        judgeModels: [],
        calls: [],
        referenceDate: options.referenceDate,
        clientVersion: options.clientVersion,
        artifactDirectory: `runs/${item.id}-${variant.name}-${repeat}`,
      };
      report.runs.push(record);
      return { record, variant };
    });
    if (repeat % 2 === 0) trials.reverse();
    const group = { item, trials, ...source };
    groupsByCase.get(item.id).push(group);
    return group;
  }

  for (const item of cases) {
    const plan = plans.get(item.id);
    const sources = [
      ...plan.reuse.map((entry) => ({ mode: "reuse", entry })),
      ...plan.rejudge.map((entry) => ({ mode: "rejudge", entry })),
    ];
    for (let repeat = 1; repeat <= plan.count; repeat++)
      addRepeat(item, repeat, sources[repeat - 1] ?? { mode: "execute" });
  }
  const byMode = (mode) => [...groupsByCase.values()].flat().filter((group) => group.mode === mode);
  // Reused and rejudged cases are always named; a long execution list is summarised.
  const listed = (groups, limit = Infinity) => {
    const ids = [...new Set(groups.map((g) => g.item.id))];
    if (!ids.length) return "";
    return ids.length > limit
      ? ` (${ids.length} cases; names in the HTML report)`
      : ` (${ids.join(", ")})`;
  };
  process.stdout.write(
    `Evidence plan: execute ${byMode("execute").length}${listed(byMode("execute"), 20)}; ` +
      `rejudge ${byMode("rejudge").length}${listed(byMode("rejudge"))}; ` +
      `reuse ${byMode("reuse").length}${listed(byMode("reuse"))}` +
      (auto ? `; failures add repeats up to ${AUTO_MAX_RUNS}` : "") +
      "\n",
  );
  const progress = startSkillsReport(output, report, (byCase) => {
    report.datasetHash = sha(
      report.cases.map((item) => ({
        ...item,
        inputHashes: [
          ...new Set(
            byCase
              .get(item.id)
              .map((r) => r.inputHash)
              .filter(Boolean),
          ),
        ].sort(),
      })),
    );
  });

  async function runGroup({ item, trials, mode, entry }) {
    for (const { record: slot, variant } of trials) {
      const record = structuredClone(slot);
      const folder = confined(output, record.artifactDirectory);
      mkdirSync(folder, { recursive: true });
      const started = Date.now();
      let live = options.live ? mode : "execute";
      if (live !== "execute")
        try {
          cache.restore(entry, folder);
        } catch (error) {
          // An unusable cache entry is a miss: run the trial rather than report an error.
          process.stderr.write(`Cache entry for ${item.id} unusable (${error.message}); running\n`);
          rmSync(folder, { recursive: true, force: true });
          mkdirSync(folder, { recursive: true });
          live = "execute";
        }
      try {
        if (live === "reuse") reuseCached(record, folder, entry);
        else if (live === "rejudge")
          await rejudgeCached(candidate, item, record, folder, entry, options, dependencies);
        else if (item.type === "routing")
          await runRouting(item, record, folder, entries, options, dependencies);
        else if (item.type === "classification")
          await runClassification(
            item,
            record,
            folder,
            probeRoot,
            options,
            dependencies,
            Boolean(cache),
          );
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
            Boolean(cache),
          );
      } catch (error) {
        record.verdict = "ERROR";
        record.error = error.message;
      }
      record.elapsedMs = live === "reuse" ? 0 : Date.now() - started;
      json(output, `${record.artifactDirectory}/result.json`, record);
      // The cache only saves later model calls; failing to write it never changes this result.
      if (
        cache &&
        options.live &&
        live !== "reuse" &&
        record.captured &&
        variant.name === "candidate"
      )
        try {
          const unpriced = record.calls.filter((c) => c.costUSD == null).length;
          cache.store(
            item.id,
            {
              behaviour: record.behaviourHash,
              scoring: scoringOf(item),
              dependencies: record.dependencies ?? {},
              verdict: record.verdict,
              origin: record.origin ?? "executed",
              source: record.source ?? null,
              targetModels: record.targetModels,
              modelIdentityIncomplete: record.modelIdentityIncomplete ?? false,
              clientVersion: record.clientVersion ?? null,
              costUSD: unpriced ? null : record.calls.reduce((n, c) => n + c.costUSD, 0),
              unpricedCalls: unpriced,
            },
            folder,
          );
        } catch (error) {
          process.stderr.write(`Could not cache ${item.id} #${record.repeat}: ${error.message}\n`);
        }
      Object.assign(slot, record);
      progress.completed(item);
      process.stdout.write(
        `${item.type} ${item.id} ${variant.name} #${record.repeat}: ${record.verdict}` +
          `${record.origin ? ` (${record.origin})` : ""}${record.error ? ` — ${record.error}` : ""}\n`,
      );
    }
  }

  const previousCwd = process.cwd(),
    previousHome = process.env.DEEPEVAL_HOME;
  process.env.DEEPEVAL_HOME = path.join(output, ".deepeval-local");
  // DeepEval's optional local files stay in the disposable output, never the repository root.
  process.chdir(output);
  const limit = limiter(options.jobs);
  try {
    const settled = await Promise.allSettled(
      cases.map(async (item) => {
        await Promise.all(groupsByCase.get(item.id).map((group) => limit(() => runGroup(group))));
        // Regression evidence runs once; a failure, judging error or unscored run adds repeats.
        const runs = report.runs.filter((r) => r.caseId === item.id);
        if (
          !auto ||
          !options.live ||
          !runs.some((r) => ["NOT_PROVEN", "ERROR"].includes(r.verdict)) ||
          groupsByCase.get(item.id).length >= AUTO_MAX_RUNS
        )
          return;
        const extra = [];
        for (let repeat = groupsByCase.get(item.id).length + 1; repeat <= AUTO_MAX_RUNS; repeat++)
          extra.push(addRepeat(item, repeat));
        await Promise.all(extra.map((group) => limit(() => runGroup(group))));
      }),
    );
    const failed = settled.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  } finally {
    process.chdir(previousCwd);
    if (previousHome === undefined) delete process.env.DEEPEVAL_HOME;
    else process.env.DEEPEVAL_HOME = previousHome;
    restoreCeiling();
  }
  const html = progress.finish();
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
