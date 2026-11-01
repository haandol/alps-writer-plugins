import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  chmodSync,
  existsSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cases } from "../evals/regression/cases.mjs";
import {
  confined,
  createWorkspace,
  diff,
  makeTools,
  snapshot,
} from "../evals/regression/workspace.mjs";
import { evidenceSources } from "../evals/regression/judge.mjs";
import { parseArgs, copyPlugin, runCase } from "../evals/regression/run.mjs";
import { invokeClaude } from "../evals/regression/claude.mjs";
import { PLUGIN, tempDirs, temp } from "./regression-suite-helpers.mjs";

const RUNNER = path.join(PLUGIN, "evals/regression/run.mjs");

const SERVER = path.join(PLUGIN, "evals/regression/tool-server.mjs");

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

// One cache of initial fixture checks for this file's runs: identical fixtures check alike.
const fixtureChecks = new Map();

test("a baseline snapshot holds every plugin file its commit lists, with the committed bytes", (t) => {
  const repo = path.resolve(PLUGIN, "../..");
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (git("rev-parse", "--verify", "HEAD^{commit}").status !== 0)
    return t.skip("needs a git checkout of the plugin");
  const listed = new Map(
    git("ls-tree", "-r", "-l", "HEAD", "--", "plugins/adr-writer")
      .stdout.trim()
      .split("\n")
      .map((line) => line.match(/^\d+ blob [0-9a-f]+\s+(\d+)\tplugins\/adr-writer\/(.+)$/))
      .filter(
        (m) =>
          m &&
          ["skills", "agents", "references", "templates", "scripts"].some((dir) =>
            m[2].startsWith(`${dir}/`),
          ),
      )
      .map((m) => [m[2], Number(m[1])]),
  );
  const root = path.join(temp(), "baseline");
  copyPlugin(root, null, "HEAD");
  for (const [file, size] of listed)
    assert.equal(readFileSync(path.join(root, file)).length, size, file);
  const files = [...listed.keys()];
  for (const file of [files[0], files[Math.floor(files.length / 2)], files.at(-1)])
    assert.equal(
      readFileSync(path.join(root, file), "utf8"),
      git("show", `HEAD:plugins/adr-writer/${file}`).stdout,
      file,
    );
  assert.ok(files.length > 50, "the listing names the plugin's files");
});

test("retiring a skill preserves its task and leaves the no-skill condition executable", async () => {
  const folder = temp();
  const selected = cases.find((c) => c.id === "sync-encbird-turn-units");
  const plugin = copyPlugin(path.join(folder, "plugin"), PLUGIN, null, {
    allowMissingSkills: true,
  });
  unlinkSync(path.join(plugin.root, "skills/adr-sync/SKILL.md"));
  const options = {
    timeout: 5,
    "capture-only": true,
    fixturePluginRoot: PLUGIN,
    checkerRoot: PLUGIN,
    fixtureChecks,
    invoke: async () => ({
      text: "Task still exists after retiring guidance.",
      models: ["stub"],
      ms: 1,
    }),
  };
  const enabled = await runCase(selected, { ...plugin, name: "candidate" }, 1, folder, options);
  const disabled = await runCase(
    selected,
    { ...plugin, name: "without-skill", guidance: false },
    1,
    folder,
    options,
  );
  assert.equal(enabled.verdict, "ERROR");
  assert.equal(disabled.verdict, "UNSCORED");
  assert.deepEqual(disabled.replies, ["Task still exists after retiring guidance."]);
});

function fixture(item = cases[0]) {
  const directory = temp();
  const root = path.join(directory, "workspace");
  const logPath = path.join(directory, "events.jsonl");
  createWorkspace(root, item.build(), PLUGIN);
  return { root, logPath, tools: makeTools({ root, pluginRoot: PLUGIN, logPath, turn: 1 }) };
}

test("both guidance conditions can read the shared decision-log seed without modifying its contract", () => {
  const { root, logPath } = fixture();
  const expected = readFileSync(
    path.join(PLUGIN, "templates/adr/decision-log.template.md"),
    "utf8",
  );
  for (const guidance of [true, false]) {
    const tools = makeTools({ root, pluginRoot: PLUGIN, logPath, turn: 1, guidance });
    assert.equal(tools.call("read_file", { path: "docs/adr/decision-log.template.md" }), expected);
    assert.throws(
      () =>
        tools.call("write_file", { path: "docs/adr/decision-log.template.md", content: "altered" }),
      /read-only/,
    );
  }
});

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
    fixtureChecks,
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
    fixtureChecks,
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
