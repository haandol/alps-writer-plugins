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
//   node evals/run.mjs                          # every scenario, 1 run each
//   node evals/run.mjs --runs 10                # 10 runs each (rates)
//   node evals/run.mjs --only requirement-value # one scenario (substring match)
//   node evals/run.mjs --changed main            # scenarios affected since main
//   node evals/run.mjs --list                   # names, no agent calls
//   node evals/run.mjs --dry-run                # build fixtures + print prompts
//   node evals/run.mjs --out report.md          # write a shareable report
//   node evals/run.mjs --out report.md --include-transcript
//                                                # opt in to raw replies
//
// Env:
//   ADR_EVAL_CMD   agent command; prompt arrives on stdin
//                  (default: claude -p --allowedTools '')
//
// Exit: 0 = at least one run was scored (even with failing checks — a failure
//       is the finding, not an error), 2 = usage / no scenario matched / no
//       scorable output.

import { readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CMD, runAgent } from "./lib/harness.mjs";
import { scenarioNamesForChangedPaths } from "./impact-map.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const o = {
    runs: 1,
    only: null,
    changed: null,
    list: false,
    dryRun: false,
    out: null,
    cmd: DEFAULT_CMD,
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
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--cmd") o.cmd = argv[++i];
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
  return o;
}

function readHelp() {
  return `adr evals — run behaviour scenarios against a real agent

  node evals/run.mjs [--runs N] [--only <substring> | --changed <git-base>]
                     [--list] [--dry-run]
                     [--out report.md] [--cmd '<agent command>']
                     [--include-transcript] [--include-fixture-paths]

Scenarios live in evals/scenarios/*.mjs. Each exports { name, description,
bugReport?, build(dir) -> prompt, score({tail, output, dir}) -> checks[] }.
`;
}

function die(msg, code = 2) {
  process.stderr.write(`adr-evals: ${msg}\n`);
  process.exit(code);
}

async function loadScenarios() {
  const dir = path.join(HERE, "scenarios");
  const out = [];
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".mjs"))
    .sort()) {
    const mod = await import(path.join(dir, f));
    if (!mod.default) die(`${f} has no default export`);
    out.push({ file: f, ...mod.default });
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
async function runOnce(scenario, opts) {
  const { mkFixture } = await import("./lib/harness.mjs");
  const dir = mkFixture(`adr-eval-${scenario.name}-`);
  let prompt;
  try {
    prompt = await scenario.build(dir);
  } catch (e) {
    return { fixture: dir, error: `build failed: ${e.message}`, checks: [] };
  }
  const promptMeta = {
    promptChars: prompt.length,
    promptHash: createHash("sha256").update(prompt.split(dir).join("<FIXTURE>")).digest("hex"),
  };

  if (opts.dryRun) return { fixture: dir, prompt, dry: true, checks: [], ...promptMeta };

  const res = runAgent(prompt, { cmd: opts.cmd, cwd: dir });
  if (!res.ok) {
    return {
      fixture: dir,
      error:
        `agent command failed (status ${res.status}${res.error ? `: ${res.error}` : ""}). ` +
        `${res.stderr.slice(0, 300) || res.stdout.slice(0, 300)}`,
      checks: [],
      ms: res.ms,
      ...promptMeta,
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
    };
  }

  const { parseTail } = await import("./lib/harness.mjs");
  const tail = parseTail(res.stdout);
  if (!tail.complete) {
    return {
      fixture: dir,
      unscored: "agent omitted the required machine-readable tail",
      checks: [],
      ms: res.ms,
      output: res.stdout,
      tail,
      ...promptMeta,
    };
  }
  let checks;
  try {
    checks = (await scenario.score({ tail, output: res.stdout, dir, cmd: opts.cmd })) ?? [];
  } catch (e) {
    return {
      fixture: dir,
      error: `scoring threw: ${e.message}`,
      checks: [],
      ms: res.ms,
      ...promptMeta,
    };
  }
  return {
    fixture: dir,
    tail,
    checks,
    ms: res.ms,
    output: res.stdout,
    scored: true,
    ...promptMeta,
  };
}

// ── aggregate ─────────────────────────────────────────────────────────────
function aggregate(runs) {
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

function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadScenarios().then(async (all) => {
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
        `agent: ${opts.dryRun ? "(dry run, not invoked)" : opts.cmd}\n\n`,
    );

    const results = [];
    let agentScored = false;

    for (const s of scenarios) {
      process.stdout.write(`## ${s.name}\n${s.description}\n`);
      const runs = [];
      for (let i = 0; i < opts.runs; i++) {
        process.stdout.write(`  run ${i + 1}/${opts.runs} … `);
        const r = await runOnce(s, opts);
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
          process.stdout.write(`UNSCORED — ${r.unscored} (${(r.ms / 1000).toFixed(0)}s)\n`);
          continue;
        }
        agentScored = true;
        const failed = r.checks.filter((c) => !c.pass).length;
        process.stdout.write(
          `${r.checks.length - failed}/${r.checks.length} checks` +
            `, verdict ${r.tail.verdict}` +
            ` (${(r.ms / 1000).toFixed(0)}s)\n`,
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
  });
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
function renderReport(results, opts) {
  const lines = [
    `# ADR eval report`,
    ``,
    `- generated: ${new Date().toISOString()}`,
    `- repository commit: \`${gitCommit()}\``,
    `- runtime: Node ${process.version} (${process.platform}/${process.arch})`,
    `- agent: \`${displayCommand(opts.cmd, opts.includeFixturePaths)}\``,
    `- runs per scenario: ${opts.runs}`,
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

main();
