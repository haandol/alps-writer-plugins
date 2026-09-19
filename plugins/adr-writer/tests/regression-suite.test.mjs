import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { cases, selectCases } from "../evals/regression/cases.mjs";
import {
  confined,
  createWorkspace,
  diff,
  makeTools,
  snapshot,
} from "../evals/regression/workspace.mjs";
import {
  compareRuns,
  compareVerdicts,
  evidenceSources,
  validateJudgment,
  gradeEvidence,
} from "../evals/regression/judge.mjs";
import { parseArgs, copyPlugin, runCase, runPool, calendarDate } from "../evals/regression/run.mjs";
import { renderReport } from "../evals/regression/report.mjs";
import { invokeClaude } from "../evals/regression/claude.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(PLUGIN, "evals/regression/run.mjs");
const SERVER = path.join(PLUGIN, "evals/regression/tool-server.mjs");
const temp = () => mkdtempSync(path.join(tmpdir(), "adr-regression-test-"));

function fixture(item = cases[0]) {
  const directory = temp();
  const root = path.join(directory, "workspace");
  const logPath = path.join(directory, "events.jsonl");
  createWorkspace(root, item.build(), PLUGIN);
  return { root, logPath, tools: makeTools({ root, pluginRoot: PLUGIN, logPath, turn: 1 }) };
}

test("the eleven cases have reproducible, executable fixtures and complete source/adaptation metadata", () => {
  assert.equal(cases.length, 11);
  assert.equal(new Set(cases.map((item) => item.id)).size, 11);
  for (const item of cases) {
    assert.deepEqual(
      item.build(),
      item.build(),
      `${item.id} fixture must not depend on time/randomness`,
    );
    assert.ok(item.sources.length > 0 && item.adaptation.length > 25, item.id);
    assert.ok(item.turns.length && item.obligations.length >= 2, item.id);
    assert.equal(new Set(item.obligations.map((o) => o.id)).size, item.obligations.length);
    const { tools } = fixture(item);
    const tests = tools.call("run_check", { kind: "policy-tests" });
    const lint = tools.call("run_check", { kind: "structure" });
    assert.equal(tests.exitCode, 0, `${item.id}: ${tests.stdout}${tests.stderr}`);
    assert.match(tests.stdout, /\btests [1-9]\d*/, `${item.id}: policy tests must actually run`);
    assert.doesNotMatch(tests.stderr, /skipping running files/);
    assert.equal(lint.exitCode, 0, `${item.id}: ${lint.stdout}${lint.stderr}`);
  }
});

test("fixture writes cannot escape through traversal, symlinks, source files, or plugin rules", () => {
  const { root, tools } = fixture();
  for (const file of [
    "../outside.md",
    "/tmp/outside.md",
    "docs/../../outside.md",
    "docs\\outside.md",
  ]) {
    assert.throws(() => confined(root, file));
  }
  for (const file of [
    "src/policy.mjs",
    "test/policy.test.mjs",
    "docs/adr/concepts.md",
    "plugin/skills/adr-sync/SKILL.md",
  ]) {
    assert.throws(() => tools.call("write_file", { path: file, content: "damage" }));
  }
  const outside = path.join(temp(), "not-yet-created.md");
  symlinkSync(outside, path.join(root, "docs", "escape.md"));
  assert.throws(
    () => tools.call("write_file", { path: "docs/escape.md", content: "damage" }),
    /symlink/,
  );
  assert.equal(existsSync(outside), false);
});

test("mutation history catches write-then-restore even when the final snapshot is identical", () => {
  const { root, logPath, tools } = fixture();
  const before = snapshot(root);
  const target = "docs/adr/chat/0001-session-length.md";
  tools.call("write_file", { path: target, content: "temporary contract loss" });
  tools.call("write_file", { path: target, content: before[target] });
  assert.deepEqual(diff(before, snapshot(root)), []);
  const events = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
  const sources = evidenceSources({
    before,
    after: snapshot(root),
    events,
    replies: ["unchanged"],
    turns: ["plan only"],
  });
  assert.match(sources.execution, /Mutating requests in turn 1: 2/);
  assert.ok(events.some((event) => event.result?.after === "temporary contract loss"));
});

test("remote inspection is denied but its attempted action remains visible to the judge", () => {
  const { logPath, tools } = fixture();
  assert.throws(() => tools.call("inspect_runtime", { resource: "production" }), /outside/);
  const events = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
  const sources = evidenceSources({ before: {}, after: {}, events, turns: ["sync"], replies: [] });
  assert.match(sources.execution, /Remote inspection requests: 1/);
  assert.equal(events.at(-1).ok, false);
});

test("moves retain independent document identity and refuse overwrites", () => {
  const { root, tools } = fixture(cases[2]);
  const from = "docs/adr/token/0005-free-entitlement-compensation.md";
  const to = "docs/adr/token/0002-free-entitlement-compensation.md";
  const content = readFileSync(path.join(root, from), "utf8");
  tools.call("move_file", { from, to });
  assert.equal(readFileSync(path.join(root, to), "utf8"), content);
  assert.equal(existsSync(path.join(root, from)), false);
  assert.throws(
    () =>
      tools.call("move_file", {
        from: to,
        to: "docs/adr/token/0001-project-pricing.md",
      }),
    /destination exists/,
  );
});

test("status check changes only the exact ADR and its mapping entry", () => {
  const { root, tools } = fixture();
  tools.call("demote_adr_status", {
    path: "docs/adr/chat/0004-private-learning-memory.md",
  });
  const mapping = JSON.parse(readFileSync(path.join(root, "docs/adr/.mapping.json")));
  const entries = mapping.categories.chat.adrs;
  assert.equal(entries.find((e) => e.path.includes("0004")).status, "Proposed");
  assert.match(entries.find((e) => e.path.includes("0001")).status, /^Accepted/);
  assert.match(
    readFileSync(path.join(root, "docs/adr/chat/0004-private-learning-memory.md"), "utf8"),
    /## Status\s+Proposed/,
  );
});

test("status reads cannot accidentally invoke the mutating transition", () => {
  const { root, tools } = fixture();
  const before = snapshot(root);
  assert.throws(() => tools.call("run_check", { kind: "status" }), /unknown local check/);
  assert.deepEqual(snapshot(root), before);
  const check = tools.definitions.find((tool) => tool.name === "run_check");
  assert.equal(check.inputSchema.properties.kind.enum.includes("status"), false);
  assert.match(
    tools.definitions.find((tool) => tool.name === "demote_adr_status").description,
    /MUTATES/,
  );
});

const obligation = [{ id: "contract", text: "preserve the declared contract" }];
const sources = { "after:policy.md": "The actual learner-turn limit is five. This is not six." };
function judgment(verdict = "PASS") {
  return {
    obligations: [
      {
        id: "contract",
        verdict,
        reason: "실제 문서의 다섯 턴 계약이 확인된다.",
        evidence: [{ source: "after:policy.md", quote: "actual learner-turn limit is five" }],
      },
    ],
  };
}

test("judge output cannot pass on missing/duplicate obligations or invented evidence", () => {
  assert.equal(validateJudgment(judgment(), obligation, sources).verdict, "PASS");
  assert.throws(
    () => validateJudgment({ obligations: [] }, obligation, sources),
    /every obligation/,
  );
  const duplicate = judgment();
  duplicate.obligations.push(duplicate.obligations[0]);
  assert.throws(() => validateJudgment(duplicate, obligation, sources), /duplicate/);
  const invented = judgment();
  invented.obligations[0].evidence[0].quote = "the limit is thirty";
  assert.throws(() => validateJudgment(invented, obligation, sources), /unsupported/);
  const absent = judgment();
  absent.obligations[0].evidence[0].source = "after:not-present.md";
  assert.throws(() => validateJudgment(absent, obligation, sources), /unsupported/);
  const empty = judgment();
  empty.obligations[0].evidence = [];
  assert.throws(() => validateJudgment(empty, obligation, sources), /requires evidence/);
});

test("FAIL and missing evidence are never flattened into PASS, and existing failure is not preserved success", () => {
  assert.equal(validateJudgment(judgment("FAIL"), obligation, sources).verdict, "FAIL");
  const unknown = judgment("UNVERIFIED");
  unknown.obligations[0].evidence = [];
  assert.equal(validateJudgment(unknown, obligation, sources).verdict, "UNVERIFIED");
  assert.equal(compareVerdicts("PASS", "FAIL"), "REGRESSION");
  assert.equal(compareVerdicts("FAIL", "FAIL"), "EXISTING_FAILURE");
  assert.equal(compareVerdicts("FAIL", "PASS"), "IMPROVED");
  assert.equal(compareVerdicts("PASS", "UNVERIFIED"), "INCONCLUSIVE");
  assert.equal(compareVerdicts(null, "PASS"), "NO_BASELINE");
});

test("judge format repair keeps strict evidence validation and records both attempts", async () => {
  const attempts = [];
  let calls = 0;
  const result = await gradeEvidence({
    obligations: obligation,
    sources,
    invoke: async (prompt) => {
      calls++;
      const raw = judgment();
      if (calls === 1) raw.obligations[0].evidence[0].quote = "invented quotation";
      else {
        assert.match(prompt, /unsupported evidence/);
        assert.match(prompt, /Do not force PASS/);
      }
      return { structured: raw };
    },
    onAttempt: (attempt) => attempts.push(attempt),
  });
  assert.equal(result.verdict, "PASS");
  assert.equal(calls, 2);
  assert.ok(attempts[0].error);
  assert.equal(attempts[1].error, null);
});

test("a semantic FAIL is not retried and two invalid citations remain an error", async () => {
  let calls = 0;
  const result = await gradeEvidence({
    obligations: obligation,
    sources,
    invoke: async () => {
      calls++;
      return { structured: judgment("FAIL") };
    },
  });
  assert.equal(result.verdict, "FAIL");
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    () =>
      gradeEvidence({
        obligations: obligation,
        sources,
        invoke: async () => {
          calls++;
          const raw = judgment();
          raw.obligations[0].evidence[0].quote = "not in evidence";
          return { structured: raw };
        },
      }),
    /unsupported evidence/,
  );
  assert.equal(calls, 2);
});

test("check output is available as verbatim text without nested JSON escape guessing", () => {
  const stdout = '{\n  "ok": true,\n  "errors": []\n}';
  const data = evidenceSources({
    before: {},
    after: {},
    replies: [],
    turns: [],
    events: [{ seq: 1, kind: "result", tool: "run_check", result: { stdout } }],
  });
  assert.equal(data["event:1:stdout"], stdout);
});

test("case selection and CLI flags reject accidental empty or mixed execution", () => {
  assert.equal(selectCases({ skill: "adr-sync" }).length, 4);
  assert.equal(selectCases({ only: "encbird" }).length, 6);
  assert.throws(() => selectCases({ skill: "adr-new" }));
  assert.throws(() => selectCases({ only: "not-a-case" }));
  assert.throws(() => parseArgs(["--live", "--prepare"]));
  assert.throws(() => parseArgs(["--runs", "0"]));
  assert.throws(() => parseArgs(["--out"]));
  assert.equal(parseArgs([]).live, false);
  assert.throws(() => parseArgs(["--jobs", "0"]));
  assert.throws(() => parseArgs(["--reference-date", "2026-02-30"]));
  assert.equal(parseArgs(["--reference-date", "2026-09-19"])["reference-date"], "2026-09-19");
});

test("calendar dates use the local day and comparison refuses different evaluation clocks", () => {
  assert.equal(calendarDate(new Date(2026, 8, 19, 0, 5)), "2026-09-19");
  const calls = [
    { stage: "target", models: ["same"] },
    { stage: "judge", models: ["same"] },
  ];
  assert.equal(
    compareRuns(
      { verdict: "PASS", referenceDate: "2026-09-18", calls },
      { verdict: "PASS", referenceDate: "2026-09-19", calls },
    ),
    "INCONCLUSIVE",
  );
});

test("parallel case workers keep a bounded count and await owned work after an error", async () => {
  let active = 0;
  let maximum = 0;
  const completed = [];
  await runPool([1, 2, 3, 4], 2, async (value) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setImmediate(resolve));
    completed.push(value);
    active--;
  });
  assert.equal(maximum, 2);
  assert.deepEqual(completed.sort(), [1, 2, 3, 4]);
  let otherFinished = false;
  await assert.rejects(
    () =>
      runPool([1, 2], 2, async (value) => {
        if (value === 1) throw new Error("worker failed");
        await new Promise((resolve) => setImmediate(resolve));
        otherFinished = true;
      }),
    /worker failed/,
  );
  assert.equal(otherFinished, true);
});

test("a model change or missing model identity prevents a prompt-regression conclusion", () => {
  const before = {
    verdict: "PASS",
    referenceDate: "2026-09-19",
    calls: [
      { stage: "target", models: ["model-a"] },
      { stage: "judge", models: ["judge"] },
    ],
  };
  const after = { verdict: "FAIL", referenceDate: before.referenceDate, calls: before.calls };
  assert.equal(compareRuns(before, after), "REGRESSION");
  assert.equal(
    compareRuns(before, { ...after, calls: [{ stage: "target", models: ["model-b"] }] }),
    "INCONCLUSIVE",
  );
  assert.equal(compareRuns({ verdict: "PASS" }, after), "INCONCLUSIVE");
  assert.equal(
    compareRuns({ ...before, pluginHash: "identical" }, { ...after, pluginHash: "identical" }),
    "SAME_SNAPSHOT",
  );
});

test("the selected current plugin is copied and hashed before an execution", () => {
  const target = path.join(temp(), "plugin");
  const selected = copyPlugin(target, PLUGIN);
  assert.match(selected.hash, /^[a-f0-9]{64}$/);
  assert.equal(
    readFileSync(path.join(target, "skills/adr-sync/SKILL.md"), "utf8"),
    readFileSync(path.join(PLUGIN, "skills/adr-sync/SKILL.md"), "utf8"),
  );
});

test("MCP stdio initializes, lists tools and reads the actual fixture without an SDK", () => {
  const { root, logPath } = fixture();
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "src/policy.mjs" } },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "../secret" } },
    },
  ];
  const result = spawnSync(process.execPath, [SERVER, root, PLUGIN, logPath, "1"], {
    input: messages.map(JSON.stringify).join("\n") + "\n",
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const responses = result.stdout.trim().split("\n").map(JSON.parse);
  assert.equal(responses.length, 4);
  assert.equal(responses[0].result.serverInfo.name, "adr-eval-fixture");
  assert.ok(responses[1].result.tools.some((tool) => tool.name === "inspect_runtime"));
  assert.match(responses[2].result.content[0].text, /textStoredLimit = 6/);
  assert.equal(responses[3].result.isError, true);
});

test("prepare creates a clearly unexecuted HTML report and refuses to overwrite it", () => {
  const directory = path.join(temp(), "prepared");
  const result = spawnSync(
    process.execPath,
    [RUNNER, "--prepare", "--only", "sync-encbird-turn-units", "--out", directory],
    {
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(path.join(directory, "results.json")));
  assert.equal(report.mode, "PREPARED_NOT_RUN");
  assert.equal(report.runs.length, 0);
  assert.match(
    readFileSync(path.join(directory, "index.html"), "utf8"),
    /아직 LLM을 실행하지 않았습니다/,
  );
  const again = spawnSync(process.execPath, [RUNNER, "--prepare", "--out", directory], {
    encoding: "utf8",
  });
  assert.equal(again.status, 2);
  assert.match(again.stderr, /new or empty/);
});

test("HTML escapes source responses and never labels preparation as a live success", () => {
  const report = {
    mode: "PREPARED_NOT_RUN",
    generatedAt: "test",
    cases: [cases[0]],
    runsPerCase: 1,
    variants: {},
    runs: [],
    datasetHash: "test",
    judgeHash: "test",
  };
  let html = renderReport(report);
  assert.match(html, /0\/1/);
  assert.match(html, /기준 버전이 없으면 회귀를 주장하지 않습니다/);
  report.runs.push({
    caseId: cases[0].id,
    variant: "candidate",
    repeat: 1,
    verdict: "ERROR",
    error: "<img src=x onerror=alert(1)>",
    replies: ["<script>bad()</script>"],
    artifactDirectory: "runs/test",
    changes: [],
  });
  html = renderReport(report);
  assert.doesNotMatch(html, /<img src=x|<script>bad/);
  assert.match(html, /&lt;script&gt;bad/);
});

test("CLI adapter rejects empty and failed outputs without any provider calls", async () => {
  const directory = temp();
  const executable = path.join(directory, "fake-claude");
  writeFileSync(
    executable,
    '#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on("end",()=>console.log(JSON.stringify({result:""})));\n',
  );
  chmodSync(executable, 0o755);
  await assert.rejects(
    () => invokeClaude({ prompt: "test", cwd: directory, executable }),
    /no result/,
  );
  writeFileSync(
    executable,
    '#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on("end",()=>console.log(JSON.stringify({is_error:true,result:"stub failure"})));\n',
  );
  await assert.rejects(
    () => invokeClaude({ prompt: "test", cwd: directory, executable }),
    /stub failure/,
  );
});

test("the real execution-to-judgment pipeline packages observable files and keeps the oracle out of target prompts", async () => {
  const directory = temp();
  const item = cases.find((c) => c.id === "sync-encbird-turn-units");
  let targets = 0;
  let judges = 0;
  const invoke = async ({ prompt, config, schema }) => {
    if (config) {
      targets++;
      assert.match(prompt, /evaluation calendar date is 2026-09-19/);
      assert.doesNotMatch(prompt, /존재하지 않는 계약 변경 승인을 요구하지/);
      const args = JSON.parse(readFileSync(config)).mcpServers.fixture.args;
      const messages = [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "run_check", arguments: { kind: "policy-tests" } },
        },
      ];
      const result = spawnSync(process.execPath, args, {
        input: messages.map(JSON.stringify).join("\n") + "\n",
        encoding: "utf8",
      });
      assert.equal(result.status, 0);
      return {
        text: "텍스트 시드 1개를 제외하면 5턴이며 음성은 6턴입니다. 파일은 변경하지 않았습니다.",
        models: ["stub-target"],
        ms: 1,
      };
    }
    judges++;
    assert.ok(schema);
    assert.match(prompt, /evidenceSources/);
    return {
      text: "",
      models: ["stub-judge"],
      ms: 1,
      structured: {
        obligations: item.obligations.map((o) => ({
          id: o.id,
          verdict: "PASS",
          reason: "연결 검증용 stub 판정이며 실제 LLM 의미 검증이 아니다.",
          evidence: [
            { source: "after:src/policy.mjs", quote: "export const textStoredLimit = 6;" },
          ],
        })),
      },
    };
  };
  const result = await runCase(item, { name: "candidate", root: PLUGIN }, 1, directory, {
    timeout: 30,
    invoke,
    referenceDate: "2026-09-19",
  });
  assert.equal(result.verdict, "PASS", result.error);
  assert.equal(targets, 1);
  assert.equal(judges, 1);
  assert.equal(result.changes.length, 0);
  assert.equal(result.referenceDate, "2026-09-19");
  const evidence = JSON.parse(
    readFileSync(path.join(directory, result.artifactDirectory, "evidence.json")),
  );
  assert.ok(evidence.events.some((e) => e.tool === "run_check"));
  assert.ok(evidence.evidenceSources["after:src/policy.mjs"]);
});

test("capture-only runs the target without double-charging a custom judge before DeepEval", async () => {
  const directory = temp();
  const item = cases.find((c) => c.id === "sync-encbird-turn-units");
  let invocations = 0;
  const result = await runCase(item, { name: "candidate", root: PLUGIN }, 1, directory, {
    timeout: 30,
    referenceDate: "2026-09-19",
    "capture-only": true,
    invoke: async ({ schema }) => {
      invocations++;
      assert.equal(schema, undefined, "capture mode must never invoke the custom judge");
      return { text: "수집용 응답입니다.", models: ["stub-target"], ms: 1 };
    },
  });
  assert.equal(invocations, 1);
  assert.equal(result.verdict, "UNSCORED");
  assert.equal(result.judgment, undefined);
  assert.ok(existsSync(path.join(directory, result.artifactDirectory, "evidence.json")));
  assert.throws(() => parseArgs(["--capture-only"]), /requires --live/);
});
