import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { main, parseSkillsArgs } from "../skills/run.mjs";
import { catalog } from "../skills/catalog.mjs";

const response = "It stays Accepted. The approved work continues without another approval.";
const judgeReply = (item, score, reason) => ({
  models: ["judge-stub"],
  costUSD: 0,
  structured: {
    score,
    reason,
    obligations: item.semanticObligations.map(({ id }) => ({
      id,
      verdict: score ? "PASS" : "FAIL",
      reason,
      evidence: [{ source: "reply:1", quote: response }],
    })),
  },
});

test("rejudge uses GPT-6.1/default, reuses exact evidence, excludes prior grades, and never calls target", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "semantic-rejudge-"));
  try {
    const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
    const first = await main(["--live", "--runs", "1", "--out", path.join(root, "original")], {
      cases: [item],
      target: async () => ({ text: response, models: ["target-stub"] }),
      judge: async () => judgeReply(item, 1, "PRIOR_JUDGE_REASON_DO_NOT_SEND"),
    });
    assert.equal(first.report.runs[0].verdict, "PASS");
    const sourceBytes = readFileSync(path.join(first.output, "results.json"));
    let calls = 0;
    const rerun = await main(
      ["--live", "--rejudge", first.output, "--out", path.join(root, "new")],
      {
        cases: [item],
        target: async () => {
          throw new Error("target must not run");
        },
        judge: async ({ model, profile, region, prompt }) => {
          calls++;
          assert.equal(model, "us.openai.gpt-6.1-sol");
          assert.equal(profile, "default");
          assert.equal(region, "us-east-1");
          assert.ok(prompt.includes(response));
          assert.ok(!prompt.includes("PRIOR_JUDGE_REASON_DO_NOT_SEND"));
          return judgeReply(
            item,
            0,
            "Controlled SDK test verifies that a new verdict replaces no source evidence.",
          );
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(rerun.report.targetReexecuted, false);
    assert.ok(rerun.report.runs[0].elapsedMs > 0);
    assert.equal(rerun.report.runs[0].verdict, "NOT_PROVEN");
    assert.equal(rerun.report.runs[0].previousVerdict, "PASS");
    assert.deepEqual(readFileSync(path.join(first.output, "results.json")), sourceBytes);
    const oldInput = readFileSync(
      path.join(first.output, first.report.runs[0].artifactDirectory, "test-case.json"),
      "utf8",
    );
    const newInput = readFileSync(
      path.join(rerun.output, rerun.report.runs[0].artifactDirectory, "test-case.json"),
      "utf8",
    );
    assert.deepEqual(JSON.parse(newInput), JSON.parse(oldInput));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejudge rejects target/repeat overrides instead of quietly generating more responses", () => {
  for (const args of [
    ["--runs", "2"],
    ["--model", "other"],
    ["--target-profile", "other"],
  ])
    assert.throws(
      () => parseSkillsArgs(["--rejudge", "saved", ...args]),
      /Rejudge reuses captured/,
    );
  const args = parseSkillsArgs(["--rejudge", "saved"]);
  assert.equal(args.judge.model, "us.openai.gpt-6.1-sol");
  assert.equal(args.judge.profile, "default");
});

test("a classification without meaning criteria cannot pass through mechanical checks alone", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "missing-meaning-"));
  try {
    const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
    const never = async () => {
      throw new Error("No paid call may run without fixed criteria");
    };
    const result = await main(["--live", "--runs", "1", "--out", path.join(root, "run")], {
      cases: [{ ...item, semanticObligations: [] }],
      target: never,
      judge: never,
    });
    assert.equal(result.status, 2);
    assert.equal(result.report.runs[0].verdict, "ERROR");
    assert.equal(result.report.runs[0].calls.length, 0);
    assert.match(result.report.runs[0].error, /fixed semantic obligations/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const mode of ["authorized-edit", "invalid-schema", "missing-checkpoint", "untrusted-code"]) {
  test(`execution rejudge preserves ${mode} checks without regenerating the target`, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "execution-rejudge-"));
    try {
      const base = (await catalog()).find((c) => c.id === "sync-encbird-turn-units");
      const item = {
        ...base,
        ...(mode === "missing-checkpoint"
          ? {
              verifyEvidence: () => [
                { label: "required checkpoint", pass: false, detail: "Missing execution proof" },
              ],
            }
          : {}),
      };
      const file = Object.keys(item.build()).find((f) => f.startsWith("docs/adr/chat/0001-"));
      const { makeTools } = await import("../regression/workspace.mjs");
      let targetCalls = 0;
      const original = await main(["--live", "--runs", "1", "--out", path.join(root, "original")], {
        cases: [item],
        target: async ({ cwd, config }) => {
          targetCalls++;
          if (mode === "authorized-edit" || mode === "invalid-schema") {
            const [, workspace, pluginRoot, logPath, turn, guidance, checkerRoot] = JSON.parse(
              readFileSync(config, "utf8"),
            ).mcpServers.fixture.args;
            const tools = makeTools({
              root: workspace,
              pluginRoot,
              logPath,
              turn: Number(turn),
              guidance: guidance !== "off",
              checkerRoot,
            });
            tools.call("write_file", {
              path: file,
              content:
                mode === "invalid-schema"
                  ? "# Invalid document\n"
                  : readFileSync(path.join(cwd, file), "utf8") + "\n",
            });
          }
          return { text: "Captured response", models: ["target-stub"], costUSD: 0 };
        },
        evaluate: async () => ({ verdict: "PASS", frameworkResult: { testResults: [] } }),
      });
      const priorCalls = targetCalls;
      if (mode === "untrusted-code") {
        const evidenceFile = path.join(
          original.output,
          original.report.runs[0].artifactDirectory,
          "judge-input-evidence.json",
        );
        const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"));
        evidence.after["test/policy.test.mjs"] =
          "throw new Error('Captured code must never execute');";
        writeFileSync(evidenceFile, JSON.stringify(evidence));
      }
      const replay = await main(
        ["--live", "--rejudge", original.output, "--out", path.join(root, "replay")],
        {
          cases: [item],
          target: async () => {
            targetCalls++;
            throw Error("No target replay");
          },
          evaluate: async () => ({ verdict: "PASS", frameworkResult: { testResults: [] } }),
        },
      );
      assert.equal(targetCalls, priorCalls);
      const run = replay.report.runs[0];
      assert.equal(
        run.verdict,
        mode === "authorized-edit" ? "PASS" : mode === "untrusted-code" ? "ERROR" : "NOT_PROVEN",
      );
      assert.equal(typeof replay.report.rejudgeVerifierHash, "string");
      if (mode === "untrusted-code") assert.match(run.error, /immutable fixture/);
      else {
        assert.ok(run.checks.some((c) => c.label === "final policy-tests"));
        assert.ok(run.checks.some((c) => c.label === "final structure"));
        if (mode === "missing-checkpoint")
          assert.ok(run.checks.some((c) => c.label === "required checkpoint" && !c.pass));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
