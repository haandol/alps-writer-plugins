import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { withTmp, PLUGIN_ROOT } from "./helpers.mjs";
import { makeTools } from "../evals/regression/workspace.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import importScenario from "../evals/scenarios/import-asks-intent-before-writing.mjs";

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
    assert.ok(importScenario.score({ dir: root, events: events() }).some((c) => !c.pass));
    for (const file of files) {
      const shadow = path.join(root, "shadow", file);
      mkdirSync(path.dirname(shadow), { recursive: true });
      writeFileSync(shadow, "Unrelated file");
      tools.call("read_file", { path: "shadow/" + file });
    }
    assert.ok(importScenario.score({ dir: root, events: events() }).some((c) => !c.pass));
    for (const file of files) tools.call("read_file", { path: file });
    const success = events();
    assert.ok(importScenario.score({ dir: root, events: success }).every((c) => c.pass));
    assert.ok(
      importScenario
        .score({ dir: root, events: success.filter((e) => e.kind !== "result") })
        .some((c) => !c.pass),
    );
    const broken = structuredClone(success);
    broken.findLast((e) => e.kind === "result" && e.tool === "read_file").request = -1;
    assert.ok(importScenario.score({ dir: root, events: broken }).some((c) => !c.pass));
  }));

test("catalog routing preserves authored obligations and the same strong local guards", async () => {
  const entries = await catalog();
  const cases = {
    "sync-batches-unclear-decisions": ["READY", "ASK_INTENT", "ASK_CONFLICT"],
    "sync-resumes-confirmed-batch": ["CONTINUE", "APPLY", "DEFER"],
    "author-groups-features-by-business-boundary": [
      "TWO_CONTEXTS",
      "TWO_CONTEXTS",
      "HEADLESS",
      "PARTIAL",
    ],
    "alps-groups-features-by-business-boundary": [
      "TWO_CONTEXTS",
      "TWO_CONTEXTS",
      "HEADLESS",
      "PARTIAL",
    ],
    "lite-alps-groups-features-by-business-boundary": [
      "TWO_CONTEXTS",
      "TWO_CONTEXTS",
      "HEADLESS",
      "PARTIAL",
    ],
    "feature-handoff-preserves-business-boundaries": [
      "TWO_CONTEXTS",
      "TWO_CONTEXTS",
      "HEADLESS",
      "PARTIAL",
      "REUSE",
      "PROPOSE",
      "ASK_BOUNDARY",
    ],
  };
  for (const [id, summaries] of Object.entries(cases)) {
    const { default: original } = await import(`../evals/scenarios/${id}.mjs`);
    const item = entries.find((c) => c.id === id);
    assert.equal(item.score, original.deterministicScore);
    assert.deepEqual(item.semanticObligations, original.obligations);
    const input = {
      events: [],
      tail: { findings: summaries.map((summary, i) => ({ tag: "ABCDEFG"[i], summary })) },
    };
    assert.ok(item.score(input).every((c) => c.pass));
    input.events.push({
      kind: "request",
      tool: "write_file",
      arguments: { path: "docs/unapproved.md" },
    });
    assert.ok(
      item.score(input).some((c) => !c.pass),
      id,
    );
  }
});
