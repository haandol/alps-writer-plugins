import { capturedChecks } from "../evals/skills/mechanical-checks.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { withTmp, PLUGIN_ROOT } from "./helpers.mjs";
import { makeTools } from "../evals/regression/workspace.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import importScenario, {
  mechanicalScore as importScore,
} from "../evals/scenarios/import-asks-intent-before-writing.mjs";

const reportPath = ".adr-review/import/report.md";
const report =
  "# decision-1\nObserved order submission rules and the business owner are available. The original reason for the three-item limit is not established and must be confirmed before recording a contract.\n";
function fixture(root) {
  importScenario.build(root);
  const logPath = path.join(root, "events.jsonl");
  const tools = makeTools({
    root,
    pluginRoot: PLUGIN_ROOT,
    logPath,
    turn: 1,
    artifactPaths: importScenario.artifactPaths,
  });
  const events = () =>
    readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  return { tools, logPath, events };
}

test("resumed trace writers preserve sequence and request references across UTF-8 appends", () =>
  withTmp((root) => {
    const logPath = path.join(root, "events.jsonl");
    const writer = (turn) => makeTools({ root, pluginRoot: PLUGIN_ROOT, logPath, turn });
    const first = writer(1);
    const second = writer(2);
    for (const tools of [first, first, second, first])
      tools.call("write_file", { path: "docs/notes.md", content: "관찰 기록" });
    const events = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(
      events.map((e) => e.seq),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      events.filter((e) => e.kind === "result").map((e) => [e.turn, e.request]),
      [
        [1, 1],
        [1, 3],
        [2, 5],
        [1, 7],
      ],
    );
    appendFileSync(logPath, "incomplete\n");
    assert.throws(() => first.call("list_files", {}), SyntaxError);
  }));

test("only case-declared report files gain write permission, never source or report deletion", () =>
  withTmp((root) => {
    const { tools, logPath } = fixture(root);
    tools.call("write_file", { path: reportPath, content: report });
    assert.equal(readFileSync(path.join(root, reportPath), "utf8"), report);
    for (const file of [
      ".adr-review/other.md",
      "package.json",
      "src/app.mjs",
      "docs/adr/concepts.md",
      "../report.md",
      ".adr-review/../outside.md",
    ])
      assert.throws(() => tools.call("write_file", { path: file, content: "damage" }), file);
    assert.throws(() => tools.call("delete_file", { path: reportPath }));
    assert.throws(() => tools.call("move_file", { from: reportPath, to: "docs/moved.md" }));
    const defaultTools = makeTools({ root, pluginRoot: PLUGIN_ROOT, logPath, turn: 2 });
    assert.throws(() => defaultTools.call("write_file", { path: reportPath, content: report }));
    for (const artifactPaths of [
      ["docs/adr/concepts.md"],
      [".adr-review/../../escape.md"],
      [".adr-review/run.js"],
      [reportPath, reportPath],
    ])
      assert.throws(() =>
        makeTools({ root, pluginRoot: PLUGIN_ROOT, logPath, turn: 2, artifactPaths }),
      );
    symlinkSync(path.join(root, "package.json"), path.join(root, ".adr-review/link.md"));
    assert.throws(() =>
      makeTools({
        root,
        pluginRoot: PLUGIN_ROOT,
        logPath,
        turn: 2,
        artifactPaths: [".adr-review/link.md"],
      }),
    );
  }));

test("the actual MCP transport accepts the declared report and rejects undeclared output", () =>
  withTmp((root) => {
    const { logPath } = fixture(root);
    const messages = [reportPath, ".adr-review/other.md", "package.json"].map((file, i) => ({
      jsonrpc: "2.0",
      id: i + 1,
      method: "tools/call",
      params: { name: "write_file", arguments: { path: file, content: report } },
    }));
    const result = spawnSync(
      process.execPath,
      [
        path.join(PLUGIN_ROOT, "evals/regression/tool-server.mjs"),
        root,
        PLUGIN_ROOT,
        logPath,
        "1",
        "on",
        PLUGIN_ROOT,
        JSON.stringify(importScenario.artifactPaths),
      ],
      { input: messages.map(JSON.stringify).join("\n") + "\n", encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const replies = result.stdout.trim().split("\n").map(JSON.parse);
    assert.ok(!replies[0].result.isError);
    assert.equal(replies[1].result.isError, true);
    assert.equal(replies[2].result.isError, true);
  }));

test("discovery requires successful correlated reads of exact fixture files", () =>
  withTmp((root) => {
    const { tools, events } = fixture(root);
    tools.call("write_file", { path: reportPath, content: report });
    const files = ["package.json", "deploy.md", "packages/checkout/backend/submit.mjs"];
    for (const file of files)
      assert.throws(() => tools.call("read_file", { path: "missing/" + file }));
    assert.ok(importScore({ dir: root, events: events() }).some((c) => !c.pass));
    for (const file of files) {
      const shadow = path.join(root, "shadow", file);
      mkdirSync(path.dirname(shadow), { recursive: true });
      writeFileSync(shadow, "Unrelated file");
      tools.call("read_file", { path: "shadow/" + file });
    }
    assert.ok(importScore({ dir: root, events: events() }).some((c) => !c.pass));
    for (const file of files) tools.call("read_file", { path: file });
    const success = events();
    assert.ok(importScore({ dir: root, events: success }).every((c) => c.pass));
    assert.ok(
      importScore({ dir: root, events: success.filter((e) => e.kind !== "result") }).some(
        (c) => !c.pass,
      ),
    );
    const broken = structuredClone(success);
    broken.findLast((e) => e.kind === "result" && e.tool === "read_file").request = -1;
    assert.ok(importScore({ dir: root, events: broken }).some((c) => !c.pass));
  }));

test("catalog routing preserves semantic obligations and actual mutation guards", async () => {
  const entries = await catalog();
  const ids = [
    "sync-batches-unclear-decisions",
    "sync-resumes-confirmed-batch",
    "author-groups-features-by-business-boundary",
    "alps-groups-features-by-business-boundary",
    "lite-alps-groups-features-by-business-boundary",
    "feature-handoff-preserves-business-boundaries",
  ];
  for (const id of ids) {
    const { default: original } = await import(`../evals/scenarios/${id}.mjs`);
    const item = entries.find((c) => c.id === id);
    assert.equal(item.score, undefined);
    assert.deepEqual(item.semanticObligations, original.obligations);
    const input = { events: [] };
    assert.ok(capturedChecks(item, { ...input, before: {}, files: {} }).every((c) => c.pass));
    input.events.push({
      kind: "request",
      tool: "write_file",
      arguments: { path: "docs/unapproved.md" },
    });
    assert.ok(
      capturedChecks(item, { ...input, before: {}, files: {} }).some((c) => !c.pass),
      id,
    );
  }
});
