// The regression runner's case hooks run for real: a between-turn fixture change
// and a one-shot tool failure through the fixture MCP server, with a stub target
// instead of a model. The rollup-safety fixtures run their own checks.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createWorkspace, makeTools } from "../evals/regression/workspace.mjs";
import { runCase } from "../evals/regression/run.mjs";
import { chatChain } from "../evals/regression/fixtures.mjs";
import { rollupSafetyCases } from "../evals/skills/rollup-safety-cases.mjs";
import { PLUGIN_ROOT } from "./helpers.mjs";

const dirs = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rollup-safety-"));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const survivor = "docs/adr/chat/0001-session-length.md";
const absorbed = "docs/adr/chat/0003-session-length-revision.md";
const memory = "docs/adr/chat/0004-private-learning-memory.md";

/** Call the fixture tools as the target would, through the MCP server the run configured. */
function callTools(config, calls) {
  const args = JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args;
  const messages = calls.map(([name, args], index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method: "tools/call",
    params: { name, arguments: args },
  }));
  const result = spawnSync(process.execPath, args, {
    input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line).result);
}

test("a between-turn change and a one-shot fault reach the target, the evidence and nowhere else", async () => {
  const changed = chatChain()[survivor] + "\n다른 작업이 추가한 문장.\n";
  const item = {
    id: "hook-probe",
    skill: "adr-rollup",
    build: chatChain,
    turns: ["계획을 보여줘.", "승인한 삭제를 적용해줘.", "결과를 알려줘."],
    obligations: [{ id: "probe", text: "unused" }],
    agentTimeoutMs: 600_000,
    betweenTurns: [
      {
        afterTurn: 1,
        note: "another task edits and removes",
        write: { [survivor]: changed },
        remove: [memory],
      },
    ],
    faults: [
      {
        id: "busy",
        tool: "delete_file",
        turn: 2,
        match: { path: absorbed },
        error: "EBUSY: locked",
      },
    ],
  };
  const seen = [];
  const invoke = async ({ prompt, config, timeoutMs }) => {
    seen.push({ prompt, timeoutMs });
    if (seen.length === 2) {
      const [read, first, second, third] = callTools(config, [
        ["read_file", { path: survivor }],
        ["delete_file", { path: absorbed }],
        ["delete_file", { path: absorbed }],
        ["read_file", { path: memory }],
      ]);
      assert.equal(read.content[0].text, changed, "the next turn sees the changed document");
      assert.equal(first.isError, true);
      assert.equal(first.content[0].text, "EBUSY: locked");
      assert.equal(second.isError, undefined, "the fault fires once");
      assert.equal(third.isError, true, "the removed document is gone");
    }
    return { text: "응답", models: ["stub-target"], ms: 1 };
  };
  const directory = temp();
  const result = await runCase(item, { name: "candidate", root: PLUGIN_ROOT }, 1, directory, {
    timeout: 30,
    invoke,
    referenceDate: "2026-11-26",
    "capture-only": true,
  });
  assert.equal(result.verdict, "UNSCORED", result.error);
  assert.deepEqual(
    seen.map((s) => s.timeoutMs),
    [600_000, 600_000, 600_000],
  );
  for (const { prompt } of seen) {
    assert.doesNotMatch(prompt, /external-change|another task edits|injectedFault/);
  }
  assert.match(seen[2].prompt, /EBUSY: locked/, "the target saw its tool error");
  const evidence = JSON.parse(
    readFileSync(path.join(directory, result.artifactDirectory, "evidence.json"), "utf8"),
  );
  const external = evidence.events.find((e) => e.kind === "external-change");
  assert.equal(external.turn, 1);
  assert.deepEqual(
    external.changes.map(({ path, change }) => [path, change]),
    [
      [survivor, "modified"],
      [memory, "deleted"],
    ],
  );
  const faulted = evidence.events.filter((e) => e.injectedFault === "busy");
  assert.equal(faulted.length, 1);
  assert.equal(evidence.after[survivor], changed);
  assert.ok(!(absorbed in evidence.after) && !(memory in evidence.after));
  assert.equal(evidence.checkpoints[0].files[survivor], chatChain()[survivor]);
  assert.ok(evidence.evidenceSources[`event:${external.seq}`].includes("another task edits"));
});

test("a run without a case timeout keeps the runner default", async () => {
  const seen = [];
  const item = {
    id: "timeout-probe",
    skill: "adr-rollup",
    build: chatChain,
    turns: ["계획을 보여줘."],
    obligations: [{ id: "probe", text: "unused" }],
  };
  const result = await runCase(item, { name: "candidate", root: PLUGIN_ROOT }, 1, temp(), {
    timeout: 30,
    invoke: async ({ timeoutMs }) => (seen.push(timeoutMs), { text: "응답", models: [], ms: 1 }),
    referenceDate: "2026-11-26",
    "capture-only": true,
  });
  assert.equal(result.verdict, "UNSCORED", result.error);
  assert.deepEqual(seen, [30_000]);
});

test("an invalid case hook stops the run before the target is invoked", async () => {
  let invoked = false;
  const item = {
    id: "invalid-hook",
    skill: "adr-rollup",
    build: chatChain,
    turns: ["하나", "둘"],
    obligations: [{ id: "probe", text: "unused" }],
    betweenTurns: [{ afterTurn: 1, note: "source edit", write: { "src/policy.mjs": "x" } }],
  };
  const result = await runCase(item, { name: "candidate", root: PLUGIN_ROOT }, 1, temp(), {
    timeout: 30,
    invoke: async () => ((invoked = true), { text: "응답", models: [], ms: 1 }),
    referenceDate: "2026-11-26",
    "capture-only": true,
  });
  assert.equal(result.verdict, "ERROR");
  assert.match(result.error, /invalid between-turn change/);
  assert.equal(invoked, false);
});

test("rollup-safety fixtures, including their between-turn states, pass local policies and lint", () => {
  for (const item of rollupSafetyCases) {
    const states = [item.build()];
    for (const change of item.betweenTurns ?? [])
      states.push({ ...states.at(-1), ...change.write });
    for (const files of states) {
      const root = temp();
      createWorkspace(root, files, PLUGIN_ROOT);
      const tools = makeTools({
        root,
        pluginRoot: PLUGIN_ROOT,
        logPath: path.join(temp(), "checks.jsonl"),
        turn: 0,
      });
      for (const kind of ["policy-tests", "structure"]) {
        const check = tools.call("run_check", { kind });
        assert.equal(check.exitCode, 0, `${item.id} ${kind}: ${check.stdout}${check.stderr}`);
      }
    }
  }
});

test("the same-folder citation fixture is found by the shipped pre-repoint locator", () => {
  const item = rollupSafetyCases.find((c) => c.id === "rollup-encbird-same-folder-citation");
  const root = temp();
  createWorkspace(root, item.build(), PLUGIN_ROOT);
  const tools = makeTools({
    root,
    pluginRoot: PLUGIN_ROOT,
    logPath: path.join(temp(), "checks.jsonl"),
    turn: 0,
  });
  const located = tools.call("run_check", { kind: "rollup-references", removed: "chat/0003" });
  assert.equal(located.exitCode, 1, located.stdout + located.stderr);
  const lines = located.stdout.split("\n").filter((line) => line.startsWith(memory));
  assert.equal(lines.length, 2, located.stdout);
});
