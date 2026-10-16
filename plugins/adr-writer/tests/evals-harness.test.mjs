// Dependency-free fixture, transport, aggregation and report regressions.
// Semantic correctness is measured separately by live LLM evaluations.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  mkdtempSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { obligations as digestObligations } from "../evals/scenarios/alps-approval-digest-preserves-contract.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "..");
const EVALS = path.join(PLUGIN_ROOT, "evals");
const RUN = path.join(EVALS, "run.mjs");

test("comprehension scoring prompts include the shipping rubric without requiring tools", async () => {
  const rubric = readFileSync(path.join(PLUGIN_ROOT, "references/comprehension-load.md"), "utf8");
  for (const name of ["comprehension-load-score-only", "comprehension-load-calibration-bands"]) {
    const scenario = await loadScenario(`${name}.mjs`);
    const dir = mkdtempSync(path.join(tmpdir(), "adr-comprehension-input-"));
    const prompt = await scenario.build(dir);
    assert.ok(prompt.includes(rubric), `${name} must receive the full current rubric`);
    assert.equal(prompt.split(rubric).length - 1, 1, `${name} receives the rubric only once`);
  }
});

function scenarioFiles() {
  return readdirSync(path.join(EVALS, "scenarios")).filter((f) => f.endsWith(".mjs"));
}

async function loadScenario(file) {
  return (await import(path.join(EVALS, "scenarios", file))).default;
}

// A scenario that reads its target out of the environment (the real-repo one)
// throws from build() when it is unset. That is correct behaviour — a silent
// empty fixture would be worse — so the sweep tests skip it and it gets its own.
function needsEnv(scenario) {
  return scenario.name === "review-real-repo-adr";
}

// A stub "agent": ignores stdin, prints the canned reply. Stands in for the real
// command so the scorer can be exercised without a model.
function stubAgent(reply, semanticVerdict) {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-stub-"));
  const script = path.join(dir, "stub.mjs");
  writeFileSync(
    script,
    `#!/usr/bin/env node
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  if (${JSON.stringify(semanticVerdict)} && input.startsWith("You evaluate observable behavior")) {
    const payload = JSON.parse(input.split("\\n\\nReturn only JSON")[0].split("\\n\\n").slice(1).join("\\n\\n"));
    const judgment = { obligations: ${JSON.stringify(digestObligations)}.map(({id}) => ({
      id, verdict: ${JSON.stringify(semanticVerdict)},
      reason: "고정된 테스트 판정으로 실행기 전달 경로를 검증합니다.",
      evidence: [{source: "visible", quote: payload.evidenceSources.visible.trim()}],
    })) };
    process.stdout.write(JSON.stringify(judgment));
    return;
  }
  process.stdout.write(${JSON.stringify(`${reply}\n`)});
});
`,
  );
  chmodSync(script, 0o755);
  return script;
}

function runEvals(args, cmd) {
  const r = spawnSync("node", [RUN, ...args], {
    cwd: PLUGIN_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...(cmd ? { ADR_EVAL_CMD: cmd } : {}) },
    // Match the production eval timeout. The full test command schedules
    // several subprocess-heavy files together, so 120 seconds can kill a
    // completed stub run while its parent runner is still exiting.
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

test("every scenario exports the shape the runner requires", async () => {
  const files = scenarioFiles();
  assert.ok(files.length >= 3, "expected several scenarios");
  for (const file of files) {
    const s = await loadScenario(file);
    assert.match(s.name, /^[a-z0-9-]+$/, `${file}: name must be kebab-case`);
    assert.ok(s.description?.length > 20, `${file}: needs a real description`);
    assert.equal(typeof s.build, "function", `${file}: build must be a function`);
    // Behavioral meaning is judged by the configured LLM, not scenario word scorers.
  }
});

test("behaviour scenarios cover destructive rollup and optional review roles", () => {
  const sources = scenarioFiles()
    .map((file) => readFileSync(path.join(EVALS, "scenarios", file), "utf8"))
    .join("\n");

  assert.match(sources, /skillText\("adr-rollup"(?:,|\))/);
  assert.match(sources, /agentText\("adr-impl-explainer"\)/);
  assert.match(sources, /agentText\("adr-impl-necessity-reviewer"\)/);
  assert.match(sources, /review-document-only-boundary/);
  assert.match(sources, /impl-review-pre-promotion-lifecycle/);
});

test("--list names every scenario without invoking an agent", () => {
  const { code, out } = runEvals(["--list"]);
  assert.equal(code, 0);
  assert.match(out, /review-requirement-value-preserved/);
  assert.match(out, /author-keeps-values-and-lints/);
  assert.match(out, /author-rejects-implementation-detail/);
  assert.match(out, /refactor-safe-local-duplicate/);
  assert.match(out, /refactor-protected-state-transition/);
  assert.match(out, /refactor-orchestration-discretion/);
  assert.match(out, /review-document-only-boundary/);
  assert.match(out, /impl-review-pre-promotion-lifecycle/);
  assert.match(out, /rollup-preserves-decision-boundaries/);
  assert.match(out, /impl-review-role-boundaries/);
  assert.match(out, /feature-handoff-ownership-transfer/);
  assert.match(out, /feature-handoff-enriches-underspecified-prd/);
  assert.match(out, /feature-handoff-idempotent-reimport/);
  assert.match(out, /impl-blocks-proposed-prerequisite/);
  assert.match(out, /hook-admission-routing/);
  assert.match(out, /alps-batch-preserves-mandatory-nfr/);
  assert.match(out, /alps-approval-digest-preserves-contract/);
  assert.match(out, /alps-high-load-suggests-feature-split/);
  assert.match(out, /lite-alps-follows-full-conversation/);
  assert.match(out, /lite-alps-asks-business-impact-before-solution/);
  assert.match(out, /lite-alps-proposes-solution-from-business-impact/);
  assert.match(out, /lite-alps-generates-demo-from-essential-user-experiences/);
  assert.match(out, /lite-alps-skips-empty-optional-section/);
  assert.match(out, /lite-alps-records-explicit-exclusions/);
  assert.match(out, /lite-alps-resume-preserves-proposal-first/);
  assert.match(out, /impl-review-selects-risk-mode/);
  assert.match(out, /impl-review-evidence-package/);
  assert.match(out, /impl-review-evidence-package-pass/);
  assert.match(out, /impl-review-surfaces-hidden-contract-assumption/);
  assert.match(out, /impl-resolves-domain-gaps-before-escalation/);
  assert.match(out, /impl-plans-without-routine-approval/);
  assert.match(out, /impl-high-load-keeps-progress/);
  assert.match(out, /bedrock-subagent-fallback/);
  assert.match(out, /comprehension-load-score-only/);
  assert.match(out, /comprehension-load-calibration-bands/);
  assert.match(out, /sync-stays-local-for-infrastructure/);
});

// The prompt has to carry the SHIPPED instruction text. If a scenario ever
// paraphrased the rules instead, the eval would measure the paraphrase — the one
// failure mode that makes the whole directory misleading.
test("prompts embed the real skill/agent text, not a paraphrase", async () => {
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
    // Scenarios that point at a repo supplied via the environment cannot build
    // without it; the real-repo one has its own test below.
    if (needsEnv(s)) continue;
    const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-shape-"));
    const prompt = await s.build(dir);
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

test("prompt loaders include only explicitly selected direct references", async () => {
  const { skillText } = await import(path.join(EVALS, "lib", "harness.mjs"));

  const reviewBase = skillText("adr-review");
  assert.doesNotMatch(reviewBase, /# Loaded reference:/);
  assert.doesNotMatch(reviewBase, /Invalid 'input': value did not match any expected variant/);

  const review = skillText("adr-review", {
    references: ["references/subagent-dispatch.md", "references/non-invasive-harness.md"],
  });
  assert.match(review, /# Loaded reference: references\/subagent-dispatch\.md/);
  assert.match(review, /# Loaded reference: references\/non-invasive-harness\.md/);
  assert.match(review, /Invalid 'input': value did not match any expected variant/);
  assert.match(review, /Durable context survives the plugin/);

  const sync = skillText("adr-sync", {
    references: [
      "skills/adr-sync/references/deep-verification.md",
      "skills/adr-sync/references/repository-hygiene.md",
      "skills/adr-sync/references/local-evidence-boundary.md",
      "skills/adr-sync/references/current-state-reconstruction.md",
      "skills/adr-sync/references/reconciliation-boundary.md",
    ],
  });
  assert.match(sync, /# Loaded reference: skills\/adr-sync\/references\/repository-hygiene\.md/);
  assert.match(
    sync,
    /# Loaded reference: skills\/adr-sync\/references\/local-evidence-boundary\.md/,
  );
  assert.match(
    sync,
    /# Loaded reference: skills\/adr-sync\/references\/current-state-reconstruction\.md/,
  );
  assert.match(
    sync,
    /# Loaded reference: skills\/adr-sync\/references\/reconciliation-boundary\.md/,
  );
  assert.match(sync, /^## Canonical stale Feature-ID naming$/m);

  assert.throws(
    () =>
      skillText("adr-review", {
        references: ["references/not-directly-referenced.md"],
      }),
    /not directly referenced/,
  );
});

test("the Lite resume eval embeds the shipping profile-aware runtime guidance", async () => {
  const scenario = await loadScenario("lite-alps-resume-preserves-proposal-first.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "lite-resume-eval-"));
  const prompt = await scenario.build(dir);

  assert.match(prompt, /get_lite_alps_section_guide/);
  assert.match(prompt, /propose Sections 2 and 4 before asking the user to design them/i);
  assert.doesNotMatch(prompt, /Ask 1-2 focused questions at a time - DO NOT auto-generate content/);
});

test("prompt reference resolution uses the selected plugin root", () => {
  const source = readFileSync(path.join(EVALS, "lib", "harness.mjs"), "utf8");
  assert.match(source, /directMarkdownReferences\(source, entryDir, pluginRoot\)/);
  assert.match(
    source,
    /path\.join\(pluginRoot, reference\.slice\("\$\{CLAUDE_PLUGIN_ROOT\}\/"\.length\)\)/,
  );
});

// Fixtures must be repos the plugin would accept. A fixture that trips the
// shipped lint teaches the agent about a defect the scenario never meant to test
// — during development the enum scenario shipped a bare "Accepted" in the
// mapping, which the lint flags as status-index-mismatch.
test("review fixtures are valid repos by the shipped lint", async () => {
  const lint = path.join(PLUGIN_ROOT, "scripts", "adr-structure-lint.mjs");
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
    // author-* scenarios start from an empty mapping on purpose — there is no
    // ADR yet, which is the point of the scenario. Env-driven ones lint whatever
    // the target repo holds, which is not this harness's business.
    if (s.name.startsWith("author-") || needsEnv(s)) continue;
    const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-lint-"));
    await s.build(dir);
    const r = spawnSync("node", [lint, "--no-invariants", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
    const report = JSON.parse(r.stdout);
    assert.deepEqual(
      report.errors ?? [],
      [],
      `${s.name}: fixture has lint errors: ${JSON.stringify(report.errors)}`,
    );
  }
});

// ── the scorer must discriminate ──────────────────────────────────────────
// The reply that follows the rules, and the reply that commits the exact defect
// the scenario names. Both in Korean, since that is what these ADRs are written
// in and the word-order bug lived there.
const GOOD_REVIEW = `## ADR Review

### Verdict
PASS

### Findings
- [R20] 문장이 길다 (confidence: low) — "세션 단위로 대화 길이를 제한하고"
  Suggested fix: 두 문장으로 나눈다

### Regeneration check (R19)
- Contracts honored when rebuilding from this ADR alone: 20턴, 월 5회, 30일
- Missing, must be asked about: none

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
R20 | 문장이 길다 — 분리 권고
=== EVAL-END ===`;

const BAD_REVIEW = `## ADR Review

### Verdict
FIX_REQUIRED

### Findings
- [R4] 코드 통독으로 알 수 있다 (confidence: high) — "한 채팅 세션은 최대 20턴"
  Suggested fix: 20턴 제한은 코드에 이미 있으므로 ADR에서 삭제한다

### Regeneration check (R19)
- Contracts honored when rebuilding from this ADR alone: 월 5회
- Missing, must be asked about: none

=== EVAL-VERDICT: FIX_REQUIRED ===
=== EVAL-FINDINGS ===
R4 | 20턴 제한은 코드에 있으므로 ADR에서 삭제
=== EVAL-END ===`;

test("legacy invocation forwards untagged replies to the independent configured judge", async () => {
  const { runOnce } = await import("../evals/run.mjs");
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
  const result = await runOnce(
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
  const { runOnce } = await import("../evals/run.mjs");
  const scenario = {
    name: "probe",
    description: "Preserve the approved contract.",
    build: () => "Review the contract.",
  };
  for (const target of [
    { ok: false, stdout: "partial", stderr: "failed", status: 1 },
    { ok: true, stdout: "", stderr: "", status: 0 },
  ]) {
    const result = await runOnce(
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
  const result = await runOnce(
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

test("the real-repo fixture resolves the ADR's own local links", async (t) => {
  const scenario = await loadScenario("review-real-repo-adr.mjs");

  // Build a miniature "real repo": an ADR that links to a sibling and to a doc
  // outside docs/adr/, plus a link that is genuinely absent.
  const repo = mkdtempSync(path.join(tmpdir(), "adr-eval-fakerepo-"));
  const w = (rel, body) => {
    const full = path.join(repo, rel);
    require$mkdir(path.dirname(full));
    writeFileSync(full, body);
  };
  w("docs/adr/README.md", "# ADR\n");
  w("docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
  w("docs/FREE_USAGE.md", "# free usage\n");
  w("docs/adr/token/0001-billing.md", "# ADR 0001: billing\n\n## Status\n\nProposed\n");
  w(
    "docs/adr/token/0002-free-trial.md",
    `# ADR 0002: free trial\n\nDate: 2026-01-01\n\n## Status\n\nProposed\n\n## Context\n\nc\n\n## Decision\n\nd\n\n## Consequences\n\nok\n\n## Related\n\n- [0001](./0001-billing.md)\n- [FREE_USAGE.md](../../FREE_USAGE.md)\n- [gone](../../NOPE.md)\n- [external](https://example.com/x.md)\n`,
  );

  // The scenario reads its target from the environment, so drive it that way.
  const prev = { repo: process.env.ADR_EVAL_REPO, adr: process.env.ADR_EVAL_ADR };
  process.env.ADR_EVAL_REPO = repo;
  process.env.ADR_EVAL_ADR = "docs/adr/token/0002-free-trial.md";
  t.after(() => {
    if (prev.repo === undefined) delete process.env.ADR_EVAL_REPO;
    else process.env.ADR_EVAL_REPO = prev.repo;
    if (prev.adr === undefined) delete process.env.ADR_EVAL_ADR;
    else process.env.ADR_EVAL_ADR = prev.adr;
  });

  // Re-import with a cache-busting query so the module re-reads the env.
  const fresh = (
    await import(
      `${path.join(EVALS, "scenarios", "review-real-repo-adr.mjs")}?repo=${encodeURIComponent(repo)}`
    )
  ).default;
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-real-"));
  await fresh.build(dir);

  const exists = (rel) => existsSync(path.join(dir, rel));
  assert.ok(exists("docs/adr/token/0002-free-trial.md"), "the ADR itself must be copied");
  assert.ok(exists("docs/adr/token/0001-billing.md"), "a sibling ADR link must resolve");
  assert.ok(exists("docs/FREE_USAGE.md"), "a link outside docs/adr/ must resolve");
  // A link with no target stays absent — that is a real finding, not an artifact.
  assert.ok(!exists("NOPE.md"), "a genuinely missing target must stay missing");
  // The real repo is read-only from here.
  assert.ok(
    !existsSync(path.join(repo, "docs", "adr", "concepts.md")),
    "must not write to the source repo",
  );
  assert.equal(scenario.name, "review-real-repo-adr");
});

function require$mkdir(dir) {
  mkdirSync(dir, { recursive: true });
}

test("legacy loading retains artifact gates and a semantic PASS cannot waive a missing artifact", async () => {
  const { runOnce, loadScenarios } = await import("../evals/run.mjs");
  const item = (await loadScenarios()).find((s) => s.name === "author-keeps-values-and-lints");
  assert.equal(typeof item.mechanicalScore, "function");
  const result = await runOnce(
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

test("legacy CLI prepares by default even when an executable command was supplied", () => {
  const result = runEvals(["--only", "impl-plans-without-routine-approval", "--cmd", "exit 91"]);
  assert.equal(result.code, 0);
  assert.ok(!result.out.includes("agent command failed"));
});

test("legacy default invocation uses isolated fixture tools and retains their action evidence", async () => {
  const { runOnce } = await import("../evals/run.mjs");
  const { makeTools } = await import("../evals/regression/workspace.mjs");
  let launched = false;
  const item = {
    name: "isolated-probe",
    description: "Write only the declared report.",
    artifactPaths: [".adr-review/report.md"],
    build: () => "Write the report.",
  };
  const result = await runOnce(
    item,
    { dryRun: false },
    {
      invokeClaude: async ({ cwd, config }) => {
        launched = true;
        const [server, root, pluginRoot, logPath, turn, guidance, checkerRoot, artifacts] =
          JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args;
        assert.ok(server.endsWith("regression/tool-server.mjs"));
        assert.equal(root, cwd);
        makeTools({
          root,
          pluginRoot,
          logPath,
          turn: Number(turn),
          guidance: guidance !== "off",
          checkerRoot,
          artifactPaths: JSON.parse(artifacts),
        }).call("write_file", { path: ".adr-review/report.md", content: "Actual report" });
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
  const dir = mkdtempSync(path.join(tmpdir(), "untagged-cli-"));
  const report = path.join(dir, "report.md");
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
  const body = readFileSync(report, "utf8");
  assert.ok(body.includes("scored: 1/1"));
  assert.ok(body.includes("elapsed evaluation time:"));
  assert.ok(body.includes("$0.2500; unpriced calls: 1 (unknown is not free)"));
});
