import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { importExecutionCases } from "../evals/skills/import-execution.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import { createWorkspace, makeTools, snapshot } from "../evals/regression/workspace.mjs";
import { toolServerOptions } from "../evals/regression/tool-config.mjs";
import { runCase } from "../evals/regression/run.mjs";
import { PLUGIN_ROOT } from "./helpers.mjs";

import { adopt } from "./fixtures/import-approved-documents.mjs";

// One cache of initial fixture checks for this file's runs: identical fixtures check alike.
const fixtureChecks = new Map();

const DATE = "2026-09-30";
// Removed when the file finishes, so repeated runs do not fill the temporary directory.
const tempDirs = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "import-execution-"));
  tempDirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const questionReport =
  "# decision-1 — Order intent\nConfirm the exact member and three-item order contract and its current purpose.\n# decision-2 — Payment intent\nConfirm that provider failure leaves payment pending and completed outcomes remain completed. Original history is unknown.\n";

async function execute(item, mutant) {
  const folder = temp();
  const result = await runCase(
    item,
    { name: "candidate", root: PLUGIN_ROOT, hash: "local" },
    1,
    folder,
    {
      timeout: 10,
      referenceDate: DATE,
      "capture-only": true,
      fixtureChecks,
      invoke: async ({ cwd, config }) => {
        const options = toolServerOptions(
          JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args.slice(1),
        );
        assert.equal(options.root, cwd);
        const { turn } = options;
        const tools = makeTools(options);
        const domains = item.approvedDomains;
        if (turn === 1) {
          for (const file of [
            "package.json",
            "README.md",
            "deploy.md",
            "packages/checkout/backend/submit.mjs",
            "packages/settlement/backend/pay.mjs",
          ])
            tools.call("read_file", { path: file });
          tools.call("write_file", { path: item.artifactPaths[0], content: questionReport });
          if (mutant === "early") {
            const file = "docs/adr/ordering/0001-early.md";
            tools.call("write_file", { path: file, content: "# Unapproved temporary ADR\n" });
            tools.call("delete_file", { path: file });
          }
        } else if (turn === 2) {
          if (domains.length || mutant === "overreach")
            adopt(tools, mutant === "overreach" ? ["ordering", "billing"] : domains, {
              status: mutant === "accepted" ? `Accepted (${DATE})` : "Proposed",
              omit: mutant === "incomplete" ? ["billing"] : [],
            });
          if (mutant === "transient-accepted") {
            const file = "docs/adr/ordering/0001-ordering.md";
            const original = tools.call("read_file", { path: file });
            tools.call("write_file", {
              path: file,
              content: original.replace("\nProposed\n", `\nAccepted (${DATE})\n`),
            });
            tools.call("write_file", { path: file, content: original });
          }
          if (mutant === "transient-index-accepted") {
            const file = "docs/adr/.mapping.json";
            const original = tools.call("read_file", { path: file });
            const mapping = JSON.parse(original);
            Object.values(mapping.categories)[0].adrs[0].status = `Accepted (${DATE})`;
            tools.call("write_file", { path: file, content: JSON.stringify(mapping) });
            tools.call("write_file", { path: file, content: original });
          }
        } else {
          if (domains.length) tools.call("read_file", { path: "docs/adr/.mapping.json" });
          if (mutant === "repeat-write") {
            const file = `docs/adr/ordering/0001-ordering.md`;
            tools.call("write_file", {
              path: file,
              content: tools.call("read_file", { path: file }),
            });
          }
        }
        return {
          text: turn === 1 ? "질문 보고서를 준비했습니다." : "승인 범위를 반영하고 확인했습니다.",
          models: ["stub"],
          ms: 1,
          costUSD: 0,
        };
      },
    },
  );
  assert.equal(result.verdict, "UNSCORED", result.error);
  const evidence = JSON.parse(
    readFileSync(path.join(folder, result.artifactDirectory, "evidence.json"), "utf8"),
  );
  return { evidence, checks: item.verifyEvidence(evidence) };
}

test("full, partial and unresolved approvals execute real tool turns without changing repeats", async () => {
  const entries = await catalog();
  for (const item of importExecutionCases) {
    assert.ok(entries.some((c) => c.id === item.id && c.type === "execution"));
    const { evidence, checks } = await execute(item);
    assert.ok(
      checks.every((c) => c.pass),
      JSON.stringify(checks),
    );
    assert.equal(evidence.checkpoints.length, 3);
    assert.deepEqual(evidence.checkpoints[1].files, evidence.checkpoints[2].files);
  }
});

test("lifecycle verifier rejects restored preapproval writes, scope expansion, premature Accepted and repeat rewrites", async () => {
  for (const mutant of [
    "early",
    "overreach",
    "accepted",
    "repeat-write",
    "incomplete",
    "transient-accepted",
    "transient-index-accepted",
  ]) {
    const item = importExecutionCases[mutant === "overreach" ? 1 : 0];
    const { checks } = await execute(item, mutant);
    assert.ok(
      checks.some((c) => !c.pass),
      mutant,
    );
  }
});

test("missing checkpoints and original-source changes cannot look like completed adoption", async () => {
  const item = importExecutionCases[0];
  const { evidence } = await execute(item);
  const incomplete = structuredClone(evidence);
  incomplete.checkpoints.pop();
  assert.ok(item.verifyEvidence(incomplete).some((c) => !c.pass));
  const sourceChange = structuredClone(evidence);
  sourceChange.checkpoints[1].files["README.md"] = "overwritten";
  assert.ok(item.verifyEvidence(sourceChange).some((c) => !c.pass));
});

test("new import fixtures are initially valid and application checks are independently executable", () => {
  for (const item of importExecutionCases) {
    const root = temp();
    createWorkspace(root, item.build(), PLUGIN_ROOT);
    const logPath = path.join(root, "checks.jsonl");
    const tools = makeTools({
      root,
      pluginRoot: PLUGIN_ROOT,
      logPath,
      turn: 0,
      artifactPaths: item.artifactPaths,
    });
    for (const kind of ["policy-tests", "structure"]) {
      const result = tools.call("run_check", { kind });
      assert.equal(result.exitCode, 0, result.stdout + result.stderr);
    }
    assert.ok(!Object.hasOwn(snapshot(root), "docs/adr/.mapping.json"));
  }
});
