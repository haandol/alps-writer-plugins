#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { selectCases } from "./cases.mjs";
import {
  confined,
  createWorkspace,
  diff,
  listFiles,
  makeTools,
  sha,
  snapshot,
} from "./workspace.mjs";
import { JUDGE_PROMPT, evidenceSources, judgeSchema, gradeEvidence } from "./judge.mjs";
import { invokeClaude } from "./claude.mjs";
import { saveReport } from "./report.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, "../..");
const REPO = path.resolve(PLUGIN, "../..");
const DIRECTORIES = ["skills", "agents", "references", "templates", "scripts"];

export function calendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function parseArgs(args) {
  const options = { runs: 1, jobs: 1, timeout: 300, live: false, prepare: false, list: false };
  const valued = new Set([
    "skill",
    "only",
    "runs",
    "out",
    "baseline",
    "model",
    "judge-model",
    "timeout",
    "candidate-root",
    "reference-date",
    "jobs",
  ]);
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, "");
    if (["live", "prepare", "list", "capture-only"].includes(name)) options[name] = true;
    else if (valued.has(name)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
      options[name] = value;
    } else if (name === "help" || name === "-h") options.help = true;
    else throw new Error(`unknown option ${args[i]}`);
  }
  options.runs = Number(options.runs);
  options.jobs = Number(options.jobs);
  options.timeout = Number(options.timeout);
  if (!Number.isInteger(options.runs) || options.runs < 1)
    throw new Error("--runs must be a positive integer");
  if (!Number.isFinite(options.timeout) || options.timeout <= 0)
    throw new Error("--timeout must be positive seconds");
  if (!Number.isInteger(options.jobs) || options.jobs < 1)
    throw new Error("--jobs must be a positive integer");
  if (options["reference-date"] && !validDate(options["reference-date"]))
    throw new Error("--reference-date must be a real YYYY-MM-DD calendar date");
  if (options.live && options.prepare) throw new Error("choose --live or --prepare");
  if (options["capture-only"] && !options.live)
    throw new Error("--capture-only requires --live because it executes the target agent");
  return options;
}

function help() {
  return `ADR rollup/sync semantic regression

  pnpm eval:custom --list
  pnpm eval:custom --prepare --out .codex/evals/fixtures
  pnpm eval:custom --live --only sync-encbird-turn-units --runs 1
  pnpm eval:custom --live --skill adr-rollup --baseline HEAD --runs 3

--live explicitly invokes the logged-in Claude Code CLI and its configured provider.
Without --live, no model is called. --prepare writes fixtures and a NOT_RUN HTML report.
--baseline <git-ref> compares the selected plugin instructions against that commit.
--candidate-root <adr-writer-directory> evaluates a separate working copy.
--model / --judge-model use explicit CLI model names; otherwise local defaults apply.
--timeout <seconds> bounds each CLI invocation (default 300).
--jobs <count> runs independent cases concurrently (default 1); each case keeps baseline before candidate.
--reference-date <YYYY-MM-DD> freezes the date supplied to both variants; defaults to today's local calendar date.
--capture-only collects actual target execution evidence without the custom judge (requires --live).
--out <new-directory> stores index.html, results.json, fixtures and execution evidence.
Exit 0: preparation or at least one scored run, including behavioral FAIL.
Exit 2: usage/setup error or no scorable live result. This is not a CI quality gate.
`;
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git failed: ${result.stderr}`);
  return result.stdout;
}

export function copyPlugin(destination, source, baseline) {
  mkdirSync(destination, { recursive: true });
  const files = {};
  if (baseline) {
    if (baseline.startsWith("-")) throw new Error("invalid baseline ref");
    const commit = git(["rev-parse", "--verify", `${baseline}^{commit}`]).trim();
    for (const line of git(["ls-tree", "-r", commit, "--", "plugins/adr-writer"])
      .trim()
      .split("\n")) {
      const match = line.match(/^(\d+) blob [a-f0-9]+\tplugins\/adr-writer\/(.+)$/);
      if (!match || !DIRECTORIES.some((dir) => match[2].startsWith(`${dir}/`))) continue;
      if (match[1] !== "100644" && match[1] !== "100755")
        throw new Error("baseline plugin contains a non-regular file");
      files[match[2]] = git(["show", `${commit}:plugins/adr-writer/${match[2]}`]);
    }
  } else {
    for (const dir of DIRECTORIES) {
      for (const file of listFiles(source, dir)) {
        files[file] = readFileSync(confined(source, file), "utf8");
      }
    }
  }
  for (const required of [
    "skills/adr-rollup/SKILL.md",
    "skills/adr-sync/SKILL.md",
    "scripts/adr-structure-lint.mjs",
  ]) {
    if (!(required in files)) throw new Error(`selected plugin lacks ${required}`);
  }
  for (const [file, content] of Object.entries(files)) {
    const target = confined(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { root: destination, hash: sha(Object.fromEntries(Object.entries(files).sort())) };
}

function readEvents(file) {
  return existsSync(file)
    ? readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse)
    : [];
}

function executionPrompt(item, pluginRoot, history, referenceDate) {
  const skill = readFileSync(
    path.join(pluginRoot, "skills", item.skill, "SKILL.md"),
    "utf8",
  ).replace(/^---\n[\s\S]*?\n---\n/, "");
  return `Execute the following shipped skill using the available local fixture MCP tools.
This is an evaluation workspace, not either source repository.
Read-only plugin files are addressed as plugin/skills/..., plugin/agents/..., plugin/references/..., plugin/templates/..., plugin/scripts/....
For references relative to this skill, resolve under plugin/skills/${item.skill}/.
CLAUDE_PLUGIN_ROOT corresponds to the virtual plugin/ directory.
list_files/search/read_file are the available filesystem discovery tools.
The evaluation calendar date is ${referenceDate}. Use this fixed date for "today" in generated documents; retain historical dates where appropriate.
run_check performs read-only structure/invariant/policy checks.
demote_adr_status explicitly changes one ADR and its mapping entry to Proposed using the shipped transition script; it is not a status-reading tool.
write_file/delete_file/move_file are the available document editing tools.
No arbitrary host shell, credentials, source/test edits, or external service access are available.
Respond normally in Korean. Do not emit evaluation tags or a machine-readable tail.
Conversation replay below includes the preceding user turns and observable replies/events.

<shipped-skill>
${skill}
</shipped-skill>

<conversation>
${JSON.stringify(history, null, 2)}
</conversation>`;
}

export async function runCase(item, variant, repeat, directory, options) {
  const referenceDate = options.referenceDate ?? options["reference-date"] ?? calendarDate();
  const relative = `runs/${item.id}-${variant.name}-${repeat}`;
  const artifactDir = path.join(directory, relative);
  const root = path.join(artifactDir, "workspace");
  mkdirSync(artifactDir, { recursive: true });
  createWorkspace(root, item.build(), variant.root);
  const before = snapshot(root);
  const result = {
    caseId: item.id,
    variant: variant.name,
    pluginHash: variant.hash ?? null,
    repeat,
    referenceDate,
    artifactDirectory: relative,
    verdict: "ERROR",
    replies: [],
    calls: [],
    models: [],
    changes: [],
  };
  const started = Date.now();
  const logPath = path.join(artifactDir, "events.jsonl");
  const history = [];
  let phase = "execution";
  let sources;
  try {
    const tools = makeTools({
      root,
      pluginRoot: variant.root,
      logPath: path.join(artifactDir, "fixture-checks.jsonl"),
      turn: 0,
    });
    const policy = tools.call("run_check", { kind: "policy-tests" });
    const lint = tools.call("run_check", { kind: "structure" });
    writeFileSync(
      path.join(artifactDir, "fixture-checks.json"),
      JSON.stringify({ policy, lint }, null, 2),
    );
    if (policy.exitCode !== 0 || lint.exitCode !== 0)
      throw new Error("invalid initial fixture: inspect fixture-checks.json");
    for (const [index, user] of item.turns.entries()) {
      history.push({ role: "user", content: user });
      const config = path.join(artifactDir, `mcp-${index + 1}.json`);
      writeFileSync(
        config,
        JSON.stringify({
          mcpServers: {
            fixture: {
              command: process.execPath,
              args: [
                path.join(HERE, "tool-server.mjs"),
                root,
                variant.root,
                logPath,
                String(index + 1),
              ],
            },
          },
        }),
      );
      const response = await (options.invoke ?? invokeClaude)({
        prompt: executionPrompt(item, variant.root, history, referenceDate),
        cwd: root,
        config,
        model: options.model,
        timeoutMs: options.timeout * 1000,
      });
      result.replies.push(response.text);
      result.calls.push({ stage: "target", ...response, text: undefined, structured: undefined });
      result.models.push(...response.models);
      history.push({ role: "assistant", content: response.text });
      history.push({
        role: "observed-tool-events",
        content: readEvents(logPath).filter((event) => event.turn === index + 1),
      });
    }
    sources = evidenceSources({
      before,
      after: snapshot(root),
      events: readEvents(logPath),
      replies: result.replies,
      turns: item.turns,
      referenceDate,
    });
    if (options["capture-only"]) {
      result.verdict = "UNSCORED";
    } else {
      phase = "judge";
      result.judgeAttempts = [];
      result.judgment = await gradeEvidence({
        obligations: item.obligations,
        sources,
        invoke: (prompt) =>
          (options.invoke ?? invokeClaude)({
            prompt,
            cwd: artifactDir,
            model: options["judge-model"] ?? options.model,
            schema: judgeSchema,
            timeoutMs: options.timeout * 1000,
          }),
        onAttempt({ attempt, response, error }) {
          result.calls.push({
            stage: "judge",
            ...response,
            text: undefined,
            structured: undefined,
          });
          result.judgeAttempts.push({ attempt, error });
          writeFileSync(
            path.join(artifactDir, `judge-response-${attempt}.json`),
            JSON.stringify(response, null, 2),
          );
          writeFileSync(
            path.join(artifactDir, "judge-response.json"),
            JSON.stringify(response, null, 2),
          );
        },
      });
      result.verdict = result.judgment.verdict;
    }
  } catch (error) {
    result.verdict = phase === "judge" ? "GRADER_ERROR" : "ERROR";
    result.error = error.message;
  }
  const after = snapshot(root);
  const events = readEvents(logPath);
  sources ??= evidenceSources({
    before,
    after,
    events,
    replies: result.replies,
    turns: item.turns,
    referenceDate,
  });
  result.changes = diff(before, after);
  result.models = [...new Set(result.models)];
  result.elapsedMs = Date.now() - started;
  writeFileSync(
    path.join(artifactDir, "evidence.json"),
    JSON.stringify(
      {
        before,
        after,
        events,
        turns: item.turns,
        referenceDate,
        replies: result.replies,
        evidenceSources: sources,
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(artifactDir, "result.json"), JSON.stringify(result, null, 2));
  return result;
}

export async function runPool(items, jobs, action) {
  let next = 0;
  const workers = Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await action(item);
    }
  });
  // If one worker fails, let the other owned workers finish before returning.
  const settled = await Promise.allSettled(workers);
  const failed = settled.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}

export async function main(args) {
  const options = parseArgs(args);
  options.referenceDate = options["reference-date"] ?? calendarDate();
  if (options.help) {
    process.stdout.write(help());
    return 0;
  }
  const selected = selectCases(options);
  if (options.list || (!options.live && !options.prepare)) {
    for (const item of selected) process.stdout.write(`${item.id}\n  ${item.title}\n`);
    if (!options.list)
      process.stdout.write("\nUse --prepare for fixtures/report or --live for model execution.\n");
    return 0;
  }
  const directory = path.resolve(
    options.out ??
      path.join(
        REPO,
        ".codex/evals",
        `adr-regression-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      ),
  );
  if (existsSync(directory) && readdirSync(directory).length)
    throw new Error("--out must be a new or empty directory");
  mkdirSync(directory, { recursive: true });
  const candidate = copyPlugin(
    path.join(directory, "plugin/candidate"),
    path.resolve(options["candidate-root"] ?? PLUGIN),
  );
  const variants = { candidate: { name: "candidate", ...candidate } };
  if (options.baseline) {
    variants.baseline = {
      name: "baseline",
      ...copyPlugin(path.join(directory, "plugin/baseline"), null, options.baseline),
    };
  }
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options["capture-only"]
      ? "EVIDENCE_COLLECTION"
      : options.live
        ? "LIVE_LLM"
        : "PREPARED_NOT_RUN",
    referenceDate: options.referenceDate,
    jobs: options.jobs,
    runtime: {
      node: process.version,
      platform: process.platform,
      requestedModel: options.model ?? null,
      requestedJudgeModel: options["judge-model"] ?? options.model ?? null,
      harnessHash: sha(
        ["run.mjs", "workspace.mjs", "tool-server.mjs", "claude.mjs", "judge.mjs"].map((file) =>
          readFileSync(path.join(HERE, file), "utf8"),
        ),
      ),
    },
    runsPerCase: options.runs,
    cases: selected.map(({ build, ...item }) => item),
    variants,
    datasetHash: sha(selected.map(({ build, ...item }) => ({ ...item, files: build() }))),
    judgeHash: options["capture-only"] ? null : sha({ prompt: JUDGE_PROMPT, schema: judgeSchema }),
    runs: [],
  };
  saveReport(directory, report);
  if (options.prepare) {
    for (const item of selected) {
      const root = path.join(directory, "fixtures", item.id);
      createWorkspace(root, item.build(), candidate.root);
      const tools = makeTools({
        root,
        pluginRoot: candidate.root,
        logPath: path.join(directory, `${item.id}-checks.jsonl`),
        turn: 0,
      });
      const checks = {
        tests: tools.call("run_check", { kind: "policy-tests" }),
        lint: tools.call("run_check", { kind: "structure" }),
      };
      writeFileSync(
        path.join(directory, "fixtures", `${item.id}-checks.json`),
        JSON.stringify(checks, null, 2),
      );
      if (checks.tests.exitCode !== 0 || checks.lint.exitCode !== 0) {
        throw new Error(
          `invalid prepared fixture ${item.id}; inspect fixtures/${item.id}-checks.json`,
        );
      }
      process.stdout.write(`prepared ${item.id}\n`);
    }
  } else {
    await runPool(selected, options.jobs, async (item) => {
      for (let repeat = 1; repeat <= options.runs; repeat++) {
        for (const variant of Object.values(variants).sort((a, b) =>
          a.name.localeCompare(b.name),
        )) {
          process.stdout.write(`running ${item.id} ${variant.name} ${repeat}/${options.runs}\n`);
          const result = await runCase(item, variant, repeat, directory, options);
          report.runs.push(result);
          saveReport(directory, report);
          process.stdout.write(
            `  ${item.id} ${variant.name} ${repeat}: ${result.verdict}${result.error ? `: ${result.error}` : ""}\n`,
          );
        }
      }
    });
  }
  process.stdout.write(
    `HTML: ${path.join(directory, "index.html")}\nJSON: ${path.join(directory, "results.json")}\n`,
  );
  return options.live &&
    !report.runs.some((run) =>
      options["capture-only"]
        ? run.verdict === "UNSCORED"
        : ["PASS", "FAIL", "UNVERIFIED"].includes(run.verdict),
    )
    ? 2
    : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`adr-regression: ${error.message}\n`);
      process.exitCode = 2;
    });
}
