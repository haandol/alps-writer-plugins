// Dependency-free fixture, transport, aggregation and report regressions.
// Semantic correctness is measured separately by live LLM evaluations.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  scratchDirs,
  scratch,
  built,
  scenarioFiles,
  loadScenario,
  needsEnv,
} from "./evals-harness-helpers.mjs";

after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/** `runOnce` for these tests: its fixture folder joins the ones removed at the end. */
async function runScenario(...args) {
  const { runOnce } = await import("../evals/run.mjs");
  const result = await runOnce(...args);
  if (result.fixture) scratchDirs.push(path.dirname(result.fixture));
  return result;
}

// The prompt has to carry the SHIPPED instruction text. If a scenario ever
// paraphrased the rules instead, the eval would measure the paraphrase — the one
// failure mode that makes the whole directory misleading.
test("prompts embed the real skill/agent text, not a paraphrase", async () => {
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
    // Scenarios that point at a repo supplied via the environment cannot build
    // without it; the real-repo one has its own test below.
    if (needsEnv(s)) continue;
    const { prompt } = await built(file);
    assert.ok(prompt.length > 5000, `${s.name}: prompt is too short to hold a real skill body`);
    assert.ok(
      prompt.length <= 100_000,
      `${s.name}: prompt exceeds the non-invasive 100k-character budget (${prompt.length})`,
    );
    // a distinctive line from the shipped docs, not something a summary would coin
    if (s.name.startsWith("alps-") || s.name.startsWith("lite-alps-")) {
      assert.match(
        prompt,
        /Atomic is the default|top-3 focus set|separately labeled draft|plain-text approval digest|Comprehension load/i,
      );
    } else {
      assert.match(
        prompt,
        /abstraction ladder|requirement gate|admission gate|Regeneration|decision ledger/i,
      );
    }
    // and the machine-readable tail the scorer depends on
    assert.match(prompt, /EVAL-VERDICT/);
    assert.match(prompt, /EVAL-FINDINGS/);
  }
});

test("legacy invocation forwards untagged replies to the independent configured judge", async () => {
  let calls = 0;
  const scenario = {
    name: "probe",
    description: "An approved plan proceeds without another approval.",
    build: () => "The plan is approved. Explain the next action.",
    score: () => {
      throw new Error("Legacy lexical scorer must never run");
    },
  };
  const reply = "The decision stays Accepted. I will proceed with the approved work.";
  const result = await runScenario(
    scenario,
    { dryRun: false, cmd: "unused" },
    {
      target: () => ({ ok: true, stdout: reply, stderr: "", status: 0, ms: 1 }),
      evaluate: async (request) => {
        calls++;
        assert.equal(request.model, "us.openai.gpt-6.1-sol");
        assert.equal(request.profile, "default");
        assert.equal(request.region, "us-east-1");
        assert.equal(request.evidence.replies[0], reply);
        assert.equal(request.evidence.toolTraceUnavailable, true);
        return {
          verdict: "PASS",
          obligationJudgments: [
            {
              id: "scenario-behavior",
              verdict: "PASS",
              reason: "The independent judge established the requested behavior.",
            },
          ],
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.scored, true);
  assert.ok(result.checks.every((c) => c.pass));
});

test("legacy invocation keeps failed/empty targets and judge errors out of scored results", async () => {
  const scenario = {
    name: "probe",
    description: "Preserve the approved contract.",
    build: () => "Review the contract.",
  };
  for (const target of [
    { ok: false, stdout: "partial", stderr: "failed", status: 1 },
    { ok: true, stdout: "", stderr: "", status: 0 },
  ]) {
    const result = await runScenario(
      scenario,
      { dryRun: false },
      {
        target: () => target,
        evaluate: () => {
          throw new Error("must not judge incomplete target");
        },
      },
    );
    assert.ok(result.error);
    assert.equal(result.scored, undefined);
  }
  const result = await runScenario(
    scenario,
    { dryRun: false },
    {
      target: () => ({ ok: true, stdout: "A reply without tags", stderr: "", status: 0 }),
      evaluate: async () => {
        throw new Error("Judge unavailable");
      },
    },
  );
  assert.match(result.error, /Judge unavailable/);
  assert.equal(result.scored, undefined);
});

test("legacy loading retains artifact gates and a semantic PASS cannot waive a missing artifact", async () => {
  const { loadScenarios } = await import("../evals/run.mjs");
  const item = (await loadScenarios()).find((s) => s.name === "author-keeps-values-and-lints");
  assert.equal(typeof item.mechanicalScore, "function");
  const result = await runScenario(
    item,
    { dryRun: false },
    {
      target: () => ({ ok: true, stdout: "Claimed completion", stderr: "", status: 0 }),
      evaluate: async () => ({
        verdict: "PASS",
        obligationJudgments: [
          { id: "meaning", verdict: "PASS", reason: "Controlled positive judgment" },
        ],
      }),
    },
  );
  assert.equal(result.scored, true);
  assert.ok(result.checks.some((c) => !c.pass));
  assert.ok(
    result.checks.some((c) => c.label.includes("indexed") || c.label.includes("category owns")),
  );
});

test("legacy rates and disclosure remain independent from response wording", async () => {
  const { aggregate, renderReport } = await import("../evals/run.mjs");
  const runs = [true, false, true, false].map((pass) => ({
    scored: true,
    checks: [{ label: "fixed semantic obligation", pass, detail: "Captured judgment" }],
    fixture: path.join(tmpdir(), "private-fixture"),
    output: "PRIVATE_RESPONSE",
    promptChars: 42,
    promptHash: "abc",
  }));
  const result = aggregate([...runs, { error: "judge unavailable", checks: [] }]);
  assert.equal(result[0].passed, 2);
  assert.equal(result[0].total, 4);
  const entries = [
    { scenario: { name: "probe", description: "Preserve a fixed obligation." }, runs },
  ];
  const base = { cmd: "target-command", runs: 4 };
  const safe = renderReport(entries, base);
  assert.ok(safe.includes("2/4"));
  assert.ok(safe.includes("Representative transcript omitted"));
  assert.ok(!safe.includes("PRIVATE_RESPONSE"));
  assert.ok(!safe.includes(runs[0].fixture));
  const explicit = renderReport(entries, {
    ...base,
    includeTranscript: true,
    includeFixturePaths: true,
  });
  assert.ok(explicit.includes("PRIVATE_RESPONSE"));
  assert.ok(explicit.includes(runs[0].fixture));
});

test("legacy default invocation uses isolated fixture tools and retains their action evidence", async () => {
  const { makeTools } = await import("../evals/regression/workspace.mjs");
  const { toolServerOptions } = await import("../evals/regression/tool-config.mjs");
  let launched = false;
  const item = {
    name: "isolated-probe",
    description: "Write only the declared report.",
    artifactPaths: [".adr-review/report.md"],
    build: () => "Write the report.",
  };
  const result = await runScenario(
    item,
    { dryRun: false },
    {
      invokeClaude: async ({ cwd, config }) => {
        launched = true;
        const [server, ...args] = JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args;
        assert.ok(server.endsWith("regression/tool-server.mjs"));
        const options = toolServerOptions(args);
        assert.equal(options.root, cwd);
        makeTools(options).call("write_file", {
          path: ".adr-review/report.md",
          content: "Actual report",
        });
        return { text: "Written", ms: 1 };
      },
      evaluate: async ({ evidence }) => {
        assert.equal(evidence.toolTraceUnavailable, false);
        assert.equal(
          evidence.events.filter((e) => e.kind === "request" && e.tool === "write_file").length,
          1,
        );
        assert.equal(evidence.after[".adr-review/report.md"], "Actual report");
        return {
          verdict: "PASS",
          obligationJudgments: [
            { id: "meaning", verdict: "PASS", reason: "Controlled transport test" },
          ],
        };
      },
    },
  );
  assert.equal(launched, true);
  assert.equal(result.scored, true);
  assert.ok(result.checks.every((c) => c.pass));
});

test("legacy CLI reports untagged semantic results with complete timing and unknown judging cost", async () => {
  const { main } = await import("../evals/run.mjs");
  const dir = scratch("untagged-cli-");
  const report = path.join(dir, "report.md");
  // The runner keeps its fixture as evidence; here it lives in the scratch folder.
  const systemTemp = process.env.TMPDIR;
  process.env.TMPDIR = dir;
  try {
    await main(["--live", "--only", "untagged-cli", "--out", report], {
      scenarios: [
        {
          name: "untagged-cli",
          description: "Proceed with an approved unchanged plan.",
          build: () => "The unchanged plan is approved.",
        },
      ],
      target: () => ({
        ok: true,
        stdout: "I will proceed without another approval.",
        stderr: "",
        status: 0,
        ms: 1,
        costUSD: 0.25,
      }),
      evaluate: async ({ onCall }) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        onCall({ models: ["judge-stub"], ms: 5, costUSD: null, usage: { inputTokens: 10 } });
        return {
          verdict: "PASS",
          obligationJudgments: [
            { id: "meaning", verdict: "PASS", reason: "Controlled configured judgment" },
          ],
        };
      },
    });
  } finally {
    if (systemTemp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = systemTemp;
  }
  const body = readFileSync(report, "utf8");
  assert.ok(body.includes("scored: 1/1"));
  assert.ok(body.includes("elapsed evaluation time:"));
  assert.ok(body.includes("$0.2500; unpriced calls: 1 (unknown is not free)"));
});
