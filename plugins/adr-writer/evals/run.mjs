#!/usr/bin/env node
// run.mjs — run ADR behaviour scenarios against a real agent, N times each, and
// report per-check hit rates.
//
// This is a REPRODUCTION tool, not a CI gate. It exists so that when someone
// reports "the reviewer told me to delete my requirement value" you can encode
// that situation once, run it 10 times, and see whether it reproduces 1/10 or
// 8/10. A pass/fail verdict would throw that number away, and the number is the
// whole finding: an LLM defect that appears half the time is a different bug
// from one that appears always, and they get different fixes.
//
// Usage:
//   node evals/run.mjs                          # prepare only, no model calls
//   node evals/run.mjs --live --runs 10                # 10 runs each (rates)
//   node evals/run.mjs --live --only requirement-value # one scenario (substring match)
//   node evals/run.mjs --changed main            # scenarios affected since main
//   node evals/run.mjs --list                   # names, no agent calls
//   node evals/run.mjs --dry-run                # build fixtures + print prompts
//   node evals/run.mjs --live --out report.md          # write a shareable report
//   node evals/run.mjs --live --out report.md --include-transcript
//                                                # opt in to raw replies
//
// Env:
//   ADR_EVAL_CMD   agent command; prompt arrives on stdin
//                  (default: isolated Claude adapter with confined, logged fixture tools)
//
// Exit: 0 = at least one run was scored (even with failing checks — a failure
//       is the finding, not an error), 2 = usage / no scenario matched / no
//       scorable output.

import { readdirSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BEDROCK_DEFAULTS } from "./lib/judge-defaults.mjs";
import { snapshot } from "./regression/workspace.mjs";
import { responseObligations, semanticPrompt } from "./skills/response-contract.mjs";
import { runAgent } from "./lib/harness.mjs";
import { scenarioNamesForChangedPaths } from "./impact-map.mjs";
import { capturedChecks } from "./skills/mechanical-checks.mjs";
import { invokeClaude } from "./regression/claude.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const o = {
    runs: 1,
    only: null,
    changed: null,
    list: false,
    dryRun: false,
    live: false,
    out: null,
    cmd: process.env.ADR_EVAL_CMD ?? null,
    judge: { ...BEDROCK_DEFAULTS },
    includeTranscript: false,
    includeFixturePaths: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--runs") o.runs = Number(argv[++i]);
    else if (a === "--only") o.only = argv[++i];
    else if (a === "--changed") o.changed = argv[++i];
    else if (a === "--list") o.list = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--live") o.live = true;
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--cmd") o.cmd = argv[++i];
    else if (["--judge-model", "--judge-profile", "--judge-region"].includes(a))
      o.judge[a.slice(8)] = argv[++i];
    else if (a === "--include-transcript") o.includeTranscript = true;
    else if (a === "--include-fixture-paths") o.includeFixturePaths = true;
    else if (a === "-h" || a === "--help") {
      process.stdout.write(readHelp());
      process.exit(0);
    } else die(`unknown argument: ${a}`);
  }
  if (!Number.isInteger(o.runs) || o.runs < 1) die(`--runs must be a positive integer`);
  if (o.only && o.changed) die(`--only and --changed are mutually exclusive`);
  if (o.changed != null && !o.changed.trim()) die(`--changed requires a Git base`);
  if (o.live && (o.dryRun || o.list))
    die(`--live cannot be combined with free preparation/listing`);
  if (!o.live) o.dryRun = true;
  return o;
}

function readHelp() {
  return `adr evals — run behaviour scenarios against a real agent

  node evals/run.mjs [--runs N] [--only <substring> | --changed <git-base>]
                     [--list] [--dry-run | --live]
                     [--out report.md] [--cmd '<agent command>']
                     [--include-transcript] [--include-fixture-paths]

Scenarios live in evals/scenarios/*.mjs. Each exports { name, description,
bugReport?, build(dir) -> prompt, and fixed semantic obligations.
Meaning is judged with Bedrock GPT-6.1/default; legacy lexical scores are not run. }.
Preparation is the default. --live explicitly permits target and judge calls.
`;
}

function die(msg, code = 2) {
  process.stderr.write(`adr-evals: ${msg}\n`);
  process.exit(code);
}

export async function loadScenarios() {
  const dir = path.join(HERE, "scenarios");
  const out = [];
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".mjs"))
    .sort()) {
    const mod = await import(path.join(dir, f));
    if (!mod.default) die(`${f} has no default export`);
    out.push({
      file: f,
      ...mod.default,
      mechanicalScore: mod.mechanicalScore ?? mod.default.mechanicalScore,
      semanticObligations:
        mod.obligations ?? mod.default.obligations ?? responseObligations(mod.default),
    });
  }
  return out;
}

function changedPaths(base) {
  const repo = path.resolve(HERE, "..", "..", "..");
  const commands = [
    ["diff", "--name-only", `${base}...HEAD`],
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const paths = new Set();

  for (const [index, args] of commands.entries()) {
    const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    if (result.status !== 0) {
      if (index === 0) {
        die(
          `unable to compare changed files against "${base}": ${result.stderr.trim() || result.stdout.trim()}`,
        );
      }
      continue;
    }
    for (const line of result.stdout.split(/\r?\n/)) {
      if (line.trim()) paths.add(line.trim());
    }
  }

  return [...paths].sort();
}

// ── one run of one scenario ───────────────────────────────────────────────
export async function runOnce(scenario, opts, injected = {}) {
  const started = Date.now();
  const calls = [];
  const timing = () => ({ calls, elapsedMs: Date.now() - started });
  const { mkFixture } = await import("./lib/harness.mjs");
  const artifactDir = mkFixture(`adr-eval-${scenario.name}-`);
  const dir = path.join(artifactDir, "workspace");
  mkdirSync(dir);
  let prompt;
  try {
    prompt = semanticPrompt(await scenario.build(dir));
  } catch (e) {
    return { fixture: dir, error: `build failed: ${e.message}`, checks: [] };
  }
  const promptMeta = {
    promptChars: prompt.length,
    promptHash: createHash("sha256").update(prompt.split(dir).join("<FIXTURE>")).digest("hex"),
  };

  if (opts.dryRun)
    return { fixture: dir, prompt, dry: true, checks: [], ...promptMeta, ...timing() };

  for (const args of [
    ["init", "-q"],
    ["add", "."],
  ]) {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    if (result.status !== 0)
      return {
        fixture: dir,
        error: `fixture preparation failed: ${result.stderr}`,
        checks: [],
        ...promptMeta,
      };
  }
  const before = snapshot(dir, scenario);
  const logPath = path.join(artifactDir, "events.jsonl");
  const config = path.join(artifactDir, "mcp.json");
  const pluginRoot = path.resolve(HERE, "..");
  writeFileSync(
    config,
    JSON.stringify({
      mcpServers: {
        fixture: {
          command: process.execPath,
          args: [
            path.join(HERE, "regression/tool-server.mjs"),
            dir,
            pluginRoot,
            logPath,
            "1",
            "on",
            pluginRoot,
            JSON.stringify(scenario.artifactPaths ?? []),
            ...(scenario.draftRoot ? [scenario.draftRoot] : []),
          ],
        },
      },
    }),
  );
  let res;
  try {
    res = injected.target
      ? await injected.target(prompt, { cmd: opts.cmd, cwd: dir, config })
      : opts.cmd
        ? runAgent(prompt, { cmd: opts.cmd, cwd: dir })
        : await (injected.invokeClaude ?? invokeClaude)({ prompt, cwd: dir, config }).then((r) => ({
            ok: true,
            stdout: r.text,
            stderr: "",
            status: 0,
            ms: r.ms,
            usage: r.usage,
            costUSD: r.costUSD,
            models: r.models,
          }));
  } catch (error) {
    res = { ok: false, status: 1, stdout: "", stderr: error.message };
  }
  calls.push({
    stage: "target",
    ms: res.ms,
    usage: res.usage,
    costUSD: res.costUSD,
    models: res.models,
  });
  if (!res.ok) {
    return {
      fixture: dir,
      error:
        `agent command failed (status ${res.status}${res.error ? `: ${res.error}` : ""}). ` +
        `${res.stderr.slice(0, 300) || res.stdout.slice(0, 300)}`,
      checks: [],
      ms: res.ms,
      ...promptMeta,
      ...timing(),
    };
  }
  // Empty output is an error whatever the exit code. A command that exits 0
  // saying nothing (a wrong ADR_EVAL_CMD, a CLI that needs a flag it did not
  // get) would otherwise be scored as a real run — and since most checks here
  // assert the ABSENCE of a bad finding, an empty reply passes them all
  // vacuously and the report reads green. Scoring silence is worse than no eval.
  if (!res.stdout.trim()) {
    return {
      fixture: dir,
      error:
        `agent produced no output (status ${res.status}${res.error ? `: ${res.error}` : ""}). ` +
        `Check ADR_EVAL_CMD accepts a prompt on stdin and prints the reply to stdout. ` +
        `${res.stderr.slice(0, 300)}`,
      checks: [],
      ms: res.ms,
      ...promptMeta,
      ...timing(),
    };
  }

  const { parseTail } = await import("./lib/harness.mjs");
  const tail = parseTail(res.stdout);
  const evidence = {
    before,
    after: snapshot(dir, scenario),
    events: existsSync(logPath)
      ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map(JSON.parse)
      : [],
    replies: [res.stdout],
    turns: [prompt],
    toolTraceUnavailable: Boolean(opts.cmd || injected.target),
  };
  writeFileSync(
    path.join(artifactDir, "judge-input-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  try {
    const evaluate = injected.evaluate ?? (await import("./deepeval/engine.mjs")).evaluateEvidence;
    const item = {
      ...scenario,
      type: "classification",
      obligations:
        scenario.semanticObligations ?? scenario.obligations ?? responseObligations(scenario),
      turns: [prompt],
    };
    const judgment = await evaluate({
      item,
      evidence,
      name: scenario.name,
      cwd: artifactDir,
      ...BEDROCK_DEFAULTS,
      ...opts.judge,
      timeoutMs: 300_000,
      onCall(response) {
        calls.push({
          stage: "judge",
          ms: response.ms,
          usage: response.usage,
          costUSD: response.costUSD,
          models: response.models,
        });
      },
    });
    writeFileSync(path.join(artifactDir, "judge-result.json"), JSON.stringify(judgment, null, 2));
    if (judgment.verdict === "ERROR")
      return {
        fixture: dir,
        error: judgment.error,
        checks: [],
        output: res.stdout,
        ...promptMeta,
        ...timing(),
      };
    if (!judgment.obligationJudgments?.length)
      throw new Error("Semantic judgment has no obligation results");
    const checks = judgment.obligationJudgments.map((row) => ({
      label: row.id,
      pass: row.verdict === "PASS",
      detail: row.reason,
    }));
    checks.push(
      ...capturedChecks(
        { ...scenario, id: scenario.name },
        {
          before,
          files: evidence.after,
          events: evidence.events,
        },
      ),
    );
    if (scenario.mechanicalScore)
      checks.push(
        ...(await scenario.mechanicalScore({
          dir,
          output: res.stdout,
          tail: tail ?? { findings: [] },
          before,
          files: evidence.after,
          events: evidence.events,
        })),
      );
    if (checks.some((check) => typeof check.pass !== "boolean"))
      throw new Error("Invalid mechanical artifact checks");
    return {
      fixture: dir,
      tail,
      checks,
      ms: res.ms,
      output: res.stdout,
      scored: true,
      verdict: checks.every((c) => c.pass) ? "PASS" : "NOT_PROVEN",
      judge: { ...BEDROCK_DEFAULTS, ...opts.judge },
      ...promptMeta,
      ...timing(),
    };
  } catch (error) {
    return {
      fixture: dir,
      error: `semantic judging failed: ${error.message}`,
      checks: [],
      output: res.stdout,
      ...promptMeta,
      ...timing(),
    };
  }
}

// ── aggregate ─────────────────────────────────────────────────────────────
export function aggregate(runs) {
  const byLabel = new Map();
  for (const r of runs) {
    for (const c of r.checks) {
      if (!byLabel.has(c.label))
        byLabel.set(c.label, { label: c.label, passed: 0, total: 0, details: [] });
      const e = byLabel.get(c.label);
      e.total++;
      if (c.pass) e.passed++;
      else e.details.push(c.detail);
    }
  }
  return [...byLabel.values()];
}

function rate(passed, total) {
  return total === 0 ? "n/a" : `${passed}/${total}`;
}

export function main(args = process.argv.slice(2), injected = {}) {
  const opts = parseArgs(args);
  return (injected.scenarios ? Promise.resolve(injected.scenarios) : loadScenarios()).then(
    async (all) => {
      let scenarios = all;
      let changed = [];
      if (opts.only) {
        scenarios = all.filter((s) => s.name.includes(opts.only));
      } else if (opts.changed) {
        changed = changedPaths(opts.changed);
        const impacted = scenarioNamesForChangedPaths(changed, all);
        scenarios = all.filter((scenario) => impacted.has(scenario.name));
      }

      if (!scenarios.length) {
        if (opts.changed) {
          process.stdout.write(
            `adr evals — no behaviour scenarios impacted by ${changed.length} changed file(s) since ${opts.changed}\n`,
          );
          return;
        }
        die(opts.only ? `no scenario matches "${opts.only}"` : `no scenarios found`);
      }

      if (opts.list) {
        for (const s of scenarios) process.stdout.write(`${s.name}\n  ${s.description}\n`);
        return;
      }

      process.stdout.write(
        `adr evals — ${scenarios.length} scenario(s) × ${opts.runs} run(s)\n` +
          (opts.changed
            ? `changed files: ${changed.length} since ${opts.changed} (plus working tree)\n`
            : "") +
          `judge: ${opts.judge.model} via Bedrock profile ${opts.judge.profile} / ${opts.judge.region}\n` +
          `agent: ${opts.dryRun ? "(dry run, not invoked)" : opts.cmd}\n\n`,
      );

      const results = [];
      let agentScored = false;

      for (const s of scenarios) {
        process.stdout.write(`## ${s.name}\n${s.description}\n`);
        const runs = [];
        for (let i = 0; i < opts.runs; i++) {
          process.stdout.write(`  run ${i + 1}/${opts.runs} … `);
          const r = await runOnce(s, opts, injected);
          runs.push(r);
          if (r.dry) {
            process.stdout.write(`fixture ${r.fixture}\n`);
            process.stdout.write(
              `\n--- prompt (${r.prompt.length} chars) ---\n${r.prompt}\n--- end ---\n`,
            );
            continue;
          }
          if (r.error) {
            process.stdout.write(`ERROR — ${r.error}\n`);
            continue;
          }
          if (r.unscored) {
            process.stdout.write(
              `UNSCORED — ${r.unscored} (${((r.elapsedMs ?? r.ms ?? 0) / 1000).toFixed(0)}s)\n`,
            );
            continue;
          }
          agentScored = true;
          const failed = r.checks.filter((c) => !c.pass).length;
          process.stdout.write(
            `${r.checks.length - failed}/${r.checks.length} checks` +
              `, verdict ${r.verdict}` +
              ` (${((r.elapsedMs ?? r.ms ?? 0) / 1000).toFixed(0)}s)\n`,
          );
        }

        if (!opts.dryRun) {
          const scored = runs.filter((r) => r.scored).length;
          const errored = runs.filter((r) => r.error).length;
          const unscored = runs.filter((r) => r.unscored).length;
          process.stdout.write(
            `  scored ${scored}/${runs.length}; errors ${errored}; unscored ${unscored}\n`,
          );
          const agg = aggregate(runs);
          for (const c of agg) {
            const ok = c.passed === c.total;
            process.stdout.write(`  ${ok ? "✔" : "✗"} ${rate(c.passed, c.total)}  ${c.label}\n`);
            if (!ok) {
              // one representative failure — the rest are usually the same shape
              process.stdout.write(`       ${c.details[0]}\n`);
            }
          }
        }
        results.push({ scenario: s, runs });
        process.stdout.write("\n");
      }

      if (opts.out && !opts.dryRun) {
        writeFileSync(opts.out, renderReport(results, opts));
        process.stdout.write(`report written: ${opts.out}\n`);
      }

      if (!opts.dryRun && !agentScored) {
        die(
          `the agent never produced scorable output. Check ADR_EVAL_CMD (currently: ${opts.cmd}) — ` +
            `it must accept a prompt on stdin, print the reply to stdout, and include the required tail.`,
        );
      }
    },
  );
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: path.resolve(HERE, "..", "..", ".."),
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function displayCommand(cmd, includePaths) {
  const sanitized = cmd
    .replace(/\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))=([^\s]+)/gi, "$1=<redacted>")
    .replace(/(--(?:api-key|token|secret|password)\s+)([^\s]+)/gi, "$1<redacted>");
  return includePaths ? sanitized : sanitized.split(tmpdir()).join("<tmp>");
}

function fixtureLabel(run, opts) {
  return opts.includeFixturePaths ? run.fixture : path.basename(run.fixture);
}

// A report suitable for comparison and sharing by default. Raw transcripts and
// absolute fixture paths are opt-in because real-repository runs may contain
// proprietary context.
export function renderReport(results, opts) {
  const allRuns = results.flatMap(({ runs }) => runs);
  const calls = allRuns.flatMap((run) => run.calls ?? []);
  const elapsedMs = allRuns.reduce((sum, run) => sum + (run.elapsedMs ?? run.ms ?? 0), 0);
  const knownCost = calls.reduce((sum, call) => sum + (call.costUSD ?? 0), 0);
  const unpriced = calls.filter((call) => call.costUSD == null).length;
  const lines = [
    `# ADR eval report`,
    ``,
    `- generated: ${new Date().toISOString()}`,
    `- repository commit: \`${gitCommit()}\``,
    `- runtime: Node ${process.version} (${process.platform}/${process.arch})`,
    `- agent: \`${displayCommand(opts.cmd ?? "claude (isolated)", opts.includeFixturePaths)}\``,
    `- runs per scenario: ${opts.runs}`,
    `- elapsed evaluation time: ${elapsedMs} ms (complete trials, including judging)`,
    `- known reported cost: $${knownCost.toFixed(4)}; unpriced calls: ${unpriced} (unknown is not free)`,
    `- transcripts: ${opts.includeTranscript ? "included by explicit request" : "omitted"}`,
    ``,
    `> Rates, not pass/fail. A check failing 3/10 is a real but intermittent`,
    `> defect; one failing 10/10 is deterministic. Error and unscored runs are`,
    `> reported separately and never enter the behaviour-rate denominator.`,
    ``,
  ];
  for (const { scenario, runs } of results) {
    lines.push(`## ${scenario.name}`, ``, scenario.description, ``);
    if (scenario.bugReport) lines.push(`**Reported as**: ${scenario.bugReport}`, ``);
    const scored = runs.filter((r) => r.scored);
    const unscored = runs.filter((r) => r.unscored);
    const errored = runs.filter((r) => r.error);
    const prompt = runs.find((r) => r.promptHash);
    lines.push(
      `- scored: ${scored.length}/${runs.length}`,
      `- errors: ${errored.length}`,
      `- unscored: ${unscored.length}`,
      `- prompt: ${prompt ? `${prompt.promptChars} chars · sha256 \`${prompt.promptHash}\`` : "unavailable"}`,
      ``,
    );
    const agg = aggregate(runs);
    if (agg.length) {
      lines.push(`| rate | check |`, `| --- | --- |`);
      for (const c of agg) lines.push(`| ${rate(c.passed, c.total)} | ${c.label} |`);
      lines.push(``);
      const failing = agg.filter((c) => c.passed < c.total);
      if (failing.length) {
        lines.push(`### Failures`, ``);
        for (const c of failing) {
          lines.push(`- **${c.label}** (${rate(c.passed, c.total)})`);
          for (const d of [...new Set(c.details)].slice(0, 3)) lines.push(`  - ${d}`);
        }
        lines.push(``);
      }
    }
    if (errored.length) {
      lines.push(`### Runs that could not be scored`, ``);
      for (const r of errored) lines.push(`- ${r.error}`);
      lines.push(``);
    }
    if (unscored.length) {
      lines.push(`### Runs with unparseable output`, ``);
      for (const r of unscored) lines.push(`- ${r.unscored}`);
      lines.push(``);
    }
    lines.push(`Fixtures: ${runs.map((r) => `\`${fixtureLabel(r, opts)}\``).join(", ")}`, ``);
    const sample =
      scored.find((r) => r.checks.some((check) => !check.pass)) ?? scored.find((r) => r.output);
    if (sample && opts.includeTranscript) {
      lines.push(
        `<details><summary>Representative ${sample.checks.some((c) => !c.pass) ? "failing " : ""}agent reply</summary>`,
        ``,
        "```",
        sample.output.trim(),
        "```",
        ``,
        `</details>`,
        ``,
      );
    } else if (sample) {
      lines.push(
        `Representative transcript omitted. Re-run with \`--include-transcript\` to include it.`,
        ``,
      );
    }
  }
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
