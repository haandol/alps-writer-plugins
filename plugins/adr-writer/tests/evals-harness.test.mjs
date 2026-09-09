// Tests for the eval harness itself — the scorer, the tail parser, and the
// fixtures. Runs in pnpm test with NO model calls: a stub agent script stands in
// for the real one, so this stays deterministic and free.
//
// Why this matters: an eval whose scorer cannot tell a bad reply from a good one
// is worse than no eval, because it reports green. During development the
// requirement-value scenario's prose check did exactly that — its regex assumed
// English verb-first word order ("remove the 20-turn cap") and silently passed
// every Korean reply ("20턴 제한은 … 삭제한다"), which is the language these ADRs
// are written in. These tests pin the discriminating power that fixed it.
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "..");
const EVALS = path.join(PLUGIN_ROOT, "evals");
const RUN = path.join(EVALS, "run.mjs");

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
function stubAgent(reply) {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-stub-"));
  const script = path.join(dir, "stub.mjs");
  writeFileSync(
    script,
    `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => {
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
    assert.equal(typeof s.score, "function", `${file}: score must be a function`);
  }
});

test("behaviour scenarios cover destructive rollup and optional review roles", () => {
  const sources = scenarioFiles()
    .map((file) => readFileSync(path.join(EVALS, "scenarios", file), "utf8"))
    .join("\n");

  assert.match(sources, /skillText\("adr-rollup"\)/);
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
  assert.match(out, /impl-high-load-asks-before-split/);
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

test("the requirement-value scorer passes a compliant reply", () => {
  const { code, out } = runEvals(["--only", "review-requirement-value"], stubAgent(GOOD_REVIEW));
  assert.equal(code, 0);
  assert.doesNotMatch(out, /✗/, `a compliant reply must fail no check:\n${out}`);
});

test("the requirement-value scorer catches the delete-my-value defect", () => {
  const { code, out } = runEvals(["--only", "review-requirement-value"], stubAgent(BAD_REVIEW));
  assert.equal(code, 0, "a failing check is a finding, not a harness error");
  // the rule-tag route
  assert.match(out, /✗.*no rule fires against a recorded requirement value/);
  // and the prose route — Korean word order (object before verb), which a
  // verb-first-only regex misses
  assert.match(out, /✗.*no prose advice to remove a value/);
});

test("the implementation-detail admission scorer distinguishes rejection from over-creation", async () => {
  const scenario = await loadScenario("author-rejects-implementation-detail.mjs");

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-admission-good-"));
  await scenario.build(goodDir);
  const goodChecks = scenario.score({
    tail: { verdict: "PASS", findings: [] },
    output:
      "ADR admission gate: AWS SDK v3와 default credential provider chain은 기존 GPT-5.6 Amazon Bedrock provider boundary를 유지하는 구현 디테일이므로 ADR을 만들지 않습니다.\n=== EVAL-VERDICT: PASS ===",
    dir: goodDir,
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks),
  );

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-admission-bad-"));
  await scenario.build(badDir);
  const adrDir = path.join(badDir, "docs", "adr", "llm", "bedrock-client");
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(
    path.join(adrDir, "0001-use-aws-sdk-v3.md"),
    "# ADR 0001: Use AWS SDK v3\n\n## Status\n\nProposed\n",
  );
  writeFileSync(
    path.join(badDir, "docs", "adr", ".mapping.json"),
    JSON.stringify({
      categories: {
        "llm/bedrock-client": {
          feature: "Bedrock client",
          adrs: [
            {
              path: "docs/adr/llm/bedrock-client/0001-use-aws-sdk-v3.md",
              status: "Proposed",
              summary: "AWS SDK v3와 credential provider chain을 사용한다",
            },
          ],
          dependsOn: [],
        },
      },
    }),
  );
  const badChecks = scenario.score({
    tail: { verdict: "PASS", findings: [] },
    output: "AWS SDK v3와 credential provider chain을 위한 ADR을 작성하고 저장했습니다.",
    dir: badDir,
  });
  assert.equal(badChecks.find((check) => check.label.includes("creates no ADR"))?.pass, false);
  assert.equal(badChecks.find((check) => check.label.includes("creates no mapping"))?.pass, false);
});

test("the implementation-review Evidence Package scorer distinguishes verified and unverified rows", async () => {
  const scenario = await loadScenario("impl-review-evidence-package-unverified.mjs");
  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-evidence-good-"));
  await scenario.build(goodDir);
  const goodChecks = scenario.score({
    dir: goodDir,
    tail: {
      verdict: "INCONCLUSIVE",
      findings: [
        {
          tag: "COVERAGE_D0",
          summary:
            "status=UNVERIFIED; implementation=idempotency verified but provider failure unverified; evidence=injection unavailable; tests=NOT RUN",
        },
        {
          tag: "COVERAGE_R1",
          summary:
            "status=PROVEN; implementation=idempotency guard; evidence=duplicate remains one; tests=PASS",
        },
        {
          tag: "COVERAGE_R2",
          summary:
            "status=UNVERIFIED; implementation=failure leaves pending; evidence=failure injection unavailable; tests=NOT RUN",
        },
        {
          tag: "CHOICE",
          summary:
            "value=250 ms; evidence=fixed delay; intentFit=bounded retries preserve failure contract; impact=recovery latency and request rate",
        },
        {
          tag: "HUMAN_REVIEW",
          summary:
            "verdict=INCONCLUSIVE; exception=의무 2 미검증; action=verify failure injection or accept risk; noPerRowApproval=true",
        },
        {
          tag: "COMPREHENSION",
          summary: "questionCount=1; answersHidden=true; prReadyBeforeQuiz=false",
        },
      ],
    },
    output: `# ADR implementation review
## At a glance
- Verdict: INCONCLUSIVE
- Impact: Provider failure behavior remains unverified.
- Action: Verify provider failure injection or accept the documented risk.
- Risk: A provider failure could record completion without executed evidence.
## Review mode
full
## Scope
payment settlement
## Context
<!-- generated review context from findings.json -->
## A retry reaches the idempotent boundary
Can a retry create more than one completion?

<!-- generated container zoom from findings.json -->

<!-- generated component zoom from findings.json -->

Completion is recorded only after the provider result crosses the boundary.

<!-- generated hill evidence from findings.json -->

## Provider failure remains the important unknown
Can provider failure record completion?

<!-- generated container zoom from findings.json -->

<!-- generated component zoom from findings.json -->

The duplicate path ran, but the provider-failure path could not be executed.

<!-- generated hill evidence from findings.json -->

## Findings
<!-- generated review diagnostics from findings.json -->

Provider failure remains unverified. Coverage and choices are read-only.
## ADR contract coverage
| Contract ID | Requirement | Status | ADR basis | How the implementation meets it | Evidence | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| D0 | Settlement decision | UNVERIFIED | Decision | Partly verified | Injection unavailable | NOT RUN |
| R1 | Payment completes at most once | PROVEN | R1 basis | Idempotency guard | Duplicate remains one | PASS |
| R2 | Provider failure never records completion | UNVERIFIED | R2 basis | Remains pending | Injection unavailable | NOT RUN |
## Notable implementation choices
| Selected value or behavior | Code evidence | Why it fits the ADR intent | Why it matters |
| --- | --- | --- | --- |
| 250 ms | fixed delay | bounded retries preserve failure contract | recovery latency |
## Tests
Duplicate settlement PASS; provider failure NOT RUN.
## Residual risks
Provider failure remains unverified.
## Comprehension check
Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.

1. Q1 — What remains unknown about provider failure, and why does that prevent a complete review verdict?
=== EVAL-VERDICT: INCONCLUSIVE ===`,
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks, null, 2),
  );

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-evidence-bad-"));
  await scenario.build(badDir);
  const badChecks = scenario.score({
    dir: badDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "COVERAGE_D0",
          summary: "status=PROVEN; implementation=partial; evidence=unknown; tests=NOT RUN",
        },
        {
          tag: "COVERAGE_R1",
          summary: "status=PROVEN; implementation=idempotency guard; evidence=guard; tests=PASS",
        },
        {
          tag: "COVERAGE_R2",
          summary: "status=UNVERIFIED; implementation=pending; evidence=unknown; tests=NOT RUN",
        },
        {
          tag: "CHOICE",
          summary: "value=250 ms; evidence=delay; intentFit=bounded; impact=latency",
        },
        {
          tag: "HUMAN_REVIEW",
          summary: "verdict=PASS; exception=none; action=approve each row; noPerRowApproval=false",
        },
      ],
    },
    output: `## ADR contract coverage
Provider failure never records payment completion — UNVERIFIED
## Notable implementation choices
250 ms
## Findings
Approve each row?
=== EVAL-VERDICT: PASS ===`,
  });
  assert.ok(
    badChecks.some((check) => !check.pass),
    "collapsed Evidence Package must fail",
  );
  assert.equal(badChecks.find((check) => check.label.includes("INCONCLUSIVE"))?.pass, false);
  assert.equal(badChecks.find((check) => check.label.includes("complete table row"))?.pass, false);
});

test("the PASS Evidence Package scorer rejects architecture approval while allowing a separate comprehension gate", async () => {
  const scenario = await loadScenario("impl-review-evidence-package-pass.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-evidence-pass-gate-"));
  await scenario.build(dir);
  const checks = scenario.score({
    dir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "COVERAGE_D0",
          summary:
            "status=PROVEN; implementation=guarded settlement flow; evidence=both paths verified; tests=PASS",
        },
        {
          tag: "COVERAGE_R1",
          summary:
            "status=PROVEN; implementation=idempotency guard; evidence=duplicate remains one; tests=PASS",
        },
        {
          tag: "COVERAGE_R2",
          summary:
            "status=PROVEN; implementation=failure leaves pending; evidence=injection confirmed pending; tests=PASS",
        },
        {
          tag: "CHOICE",
          summary:
            "value=250 ms; evidence=fixed delay; intentFit=bounded retries preserve failure contract; impact=recovery latency and request rate",
        },
        {
          tag: "HUMAN_REVIEW",
          summary: "verdict=PASS; decisionRequired=true; noPerRowApproval=false",
        },
        {
          tag: "COMPREHENSION",
          summary: "questionCount=1; answersHidden=true; prReadyBeforeQuiz=false",
        },
      ],
    },
    output: `# ADR implementation review
## At a glance
- Verdict: PASS
- Impact: Settlement behavior matches the recorded contract.
- Action: Approve each row.
- Risk: None.
## Review mode
full
## Scope
payment settlement
## Context
Settlement must create one durable completion and preserve pending state on provider failure.
## A duplicate request cannot create a second completion
The idempotent boundary admits one completion.
## Provider failure leaves the payment pending
The duplicate and provider-failure paths both passed their targeted tests.
## Findings
<!-- generated review diagnostics from findings.json -->

Approve each choice?
## ADR contract coverage
| Contract ID | Requirement | Status | ADR basis | How the implementation meets it | Evidence | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| D0 | Settlement decision | PROVEN | Decision | Both paths verified | Guard and failure injection | PASS |
| R1 | Payment completes at most once | PROVEN | R1 basis | Idempotency guard | Duplicate remains one | PASS |
| R2 | Provider failure never records completion | PROVEN | R2 basis | Remains pending | Injection confirmed | PASS |
## Notable implementation choices
| Selected value or behavior | Code evidence | Why it fits the ADR intent | Why it matters |
| --- | --- | --- | --- |
| 250 ms | fixed delay | bounded retries preserve failure contract | recovery latency |
## Tests
Both targeted tests passed.
## Residual risks
Unverified core risk: none.
## Comprehension check
Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.

1. Q1 — Why does a provider failure leave the payment pending instead of completed?
=== EVAL-VERDICT: PASS ===`,
  });
  assert.equal(
    checks.find((check) => check.label.includes("without another architecture decision"))?.pass,
    false,
  );
  assert.equal(
    checks.find((check) => check.label.includes("approve each coverage row"))?.pass,
    false,
  );
});

test("the comprehension gate scorer separates retry from final PR readiness", async () => {
  const retryScenario = await loadScenario("impl-review-comprehension-retry.mjs");
  const retryDir = mkdtempSync(path.join(tmpdir(), "adr-eval-comprehension-retry-"));
  await retryScenario.build(retryDir);
  const retryChecks = retryScenario.score({
    dir: retryDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "QUIZ_RESULT",
          summary: "question=Q1; correct=false; prReady=false; retry=Q1; verdict=PASS",
        },
      ],
    },
    output: `Your answer focuses on retry timing, not the completion rule. The PR is not comprehension-ready. A provider result must succeed before it crosses the completion boundary and records completion; provider failure therefore leaves the payment pending.

Q1: Why does provider failure leave the payment pending instead of completed?
=== EVAL-VERDICT: PASS ===`,
  });
  assert.ok(
    retryChecks.every((check) => check.pass),
    JSON.stringify(retryChecks, null, 2),
  );

  const passScenario = await loadScenario("impl-review-comprehension-pass.mjs");
  const passDir = mkdtempSync(path.join(tmpdir(), "adr-eval-comprehension-pass-"));
  await passScenario.build(passDir);
  const passChecks = passScenario.score({
    dir: passDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "QUIZ_RESULT",
          summary: "question=Q1; correct=true; prReady=true; verdict=PASS",
        },
      ],
    },
    output: `Correct. You identified that a successful provider result must cross the completion boundary before completion is recorded. The PR is comprehension-ready.
=== EVAL-VERDICT: PASS ===`,
  });
  assert.ok(
    passChecks.every((check) => check.pass),
    JSON.stringify(passChecks, null, 2),
  );

  const prematureChecks = passScenario.score({
    dir: passDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "QUIZ_RESULT",
          summary: "question=Q1; correct=false; prReady=true; verdict=PASS",
        },
      ],
    },
    output: "The PR is comprehension-ready.",
  });
  assert.equal(
    prematureChecks.find((check) => check.label.includes("only after the final correct answer"))
      ?.pass,
    false,
  );
});

test("the implementation-review completion scorer rejects an automatic Q1 prompt", async () => {
  const scenario = await loadScenario("impl-review-completion-does-not-auto-quiz.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-completion-no-quiz-"));
  await scenario.build(dir);

  const goodChecks = scenario.score({
    dir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "COMPLETION",
          summary: "autoQuiz=false; questionVisible=false; reportPath=true; verdict=PASS",
        },
      ],
    },
    output: "PASS. All targeted tests passed. HTML report: /tmp/review/adr-impl-review-report.html",
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks, null, 2),
  );

  const badChecks = scenario.score({
    dir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "COMPLETION",
          summary: "autoQuiz=false; questionVisible=false; reportPath=true; verdict=PASS",
        },
      ],
    },
    output: `PASS. All tests passed. HTML report: /tmp/review/adr-impl-review-report.html

Q1: Why does provider failure leave the payment pending instead of completed?`,
  });
  assert.equal(
    badChecks.find((check) => check.label.includes("does not expose or ask"))?.pass,
    false,
  );
});

test("the implementation documentation scorer requires why/how, no ADR reference, and ideal plus edge tests", async () => {
  const scenario = await loadScenario("impl-requires-standard-docs-and-ideal-edge-tests.mjs");
  const goodChecks = scenario.score({
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "CASE_A",
          summary:
            "verdict=FIX_REQUIRED; documentation=missing; ideal=present; edge=missing; action=add GoDoc and provider failure plus duplicate edge tests",
        },
        {
          tag: "CASE_B",
          summary:
            "verdict=PASS; documentation=GoDoc standard; why=present; how=present; terminology=reused; adrReference=none; ideal=present; edge=present",
        },
        {
          tag: "CASE_C",
          summary:
            "verdict=FIX_REQUIRED; adrReference=present; action=remove the reference and preserve domain contract terms",
        },
      ],
    },
    output: `Case A — FIX_REQUIRED. Add GoDoc explaining why SettlePayment exists and how it preserves pending payment behavior, then add provider-failure and duplicate-settlement tests.

Case B — PASS on this policy axis. The GoDoc carries why/how with the contract vocabulary, and the ideal and relevant edge tests are present.

Case C — FIX_REQUIRED. Remove the decision-document reference while retaining the pending payment, provider failure, and at-most-once completion terms.
=== EVAL-VERDICT: PASS ===`,
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks, null, 2),
  );

  const badChecks = scenario.score({
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "CASE_A",
          summary:
            "verdict=PASS; documentation=optional; ideal=present; edge=optional; action=none",
        },
        {
          tag: "CASE_B",
          summary:
            "verdict=PASS; documentation=GoDoc; why=present; how=present; terminology=reused; adrReference=none; ideal=present; edge=present",
        },
        {
          tag: "CASE_C",
          summary: "verdict=PASS; adrReference=allowed; action=keep it",
        },
      ],
    },
    output: "Case A — PASS. Case B — PASS. Case C — PASS because an ADR reference is acceptable.",
  });
  assert.equal(
    badChecks.some((check) => !check.pass),
    true,
    "optional comments, happy-path-only tests, and direct ADR references must fail",
  );
});

test("the hidden-assumption scorer rejects PASS when a contract premise is omitted", async () => {
  const scenario = await loadScenario("impl-review-surfaces-hidden-contract-assumption.mjs");

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-assumption-good-"));
  await scenario.build(goodDir);
  const goodChecks = scenario.score({
    dir: goodDir,
    tail: {
      verdict: "INCONCLUSIVE",
      findings: [
        {
          tag: "CONTRACT_R1",
          summary:
            "status=UNVERIFIED; reason=x-tenant-id provenance and authenticated tenant binding are not established",
        },
        {
          tag: "ASSUMPTION_RISK",
          summary:
            "premise=the gateway supplies a trusted x-tenant-id that callers cannot override; impactIfFalse=cross-tenant mutation violates tenant isolation and R1; evidenceMissing=gateway configuration, callback signature verification, or a provenance test",
        },
        {
          tag: "SAFE_CHOICE",
          summary:
            "value=250 ms retry delay; classification=Notable implementation choice below ADR resolution; reason=verified timing preserves both contracts",
        },
        {
          tag: "HUMAN_REVIEW",
          summary:
            "verdict=INCONCLUSIVE; action=verify gateway header provenance or callback signature before completion; routineApproval=false",
        },
      ],
    },
    output:
      "The tenant-header premise is an Unverified risk. The 250 ms retry remains implementation discretion.",
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks, null, 2),
  );

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-assumption-bad-"));
  await scenario.build(badDir);
  const badChecks = scenario.score({
    dir: badDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "CONTRACT_R1",
          summary: "status=PROVEN; reason=repository query includes the tenant header",
        },
        {
          tag: "SAFE_CHOICE",
          summary:
            "value=250 ms retry delay; classification=implementation discretion; reason=preserves contracts",
        },
        {
          tag: "HUMAN_REVIEW",
          summary: "verdict=PASS; action=none; routineApproval=false",
        },
      ],
    },
    output: "All contract rows are proven, so the review passes.",
  });
  assert.equal(badChecks.find((check) => check.label.includes("instead of PASS"))?.pass, false);
  assert.equal(
    badChecks.find((check) => check.label.includes("premise, contract impact"))?.pass,
    false,
  );
  assert.equal(
    badChecks.find((check) => check.label.includes("tenant-isolation contract"))?.pass,
    false,
  );
});

test("the gap-resolution scorer separates domain defaults from product decisions", async () => {
  const scenario = await loadScenario("impl-resolves-domain-gaps-before-escalation.mjs");

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-gap-resolution-good-"));
  await scenario.build(goodDir);
  const goodChecks = scenario.score({
    dir: goodDir,
    tail: {
      verdict: "INCONCLUSIVE",
      findings: [
        {
          tag: "AUTO_RESOLVE",
          summary:
            "gap=retry timing; resolution=capped exponential backoff with full jitter, 100 ms base and 5 s cap; basis=three neighboring workers establish the project convention; approval=false",
        },
        {
          tag: "DECISION_REQUEST",
          summary:
            "gap=terminal delivery failure; recommendation=send to a DLQ and raise an operator alert; basis=preserves durability and observable recovery; alternatives=drop the event or keep it pending for manual recovery; impact=changes durability, recovery operations, and cost; adrPatch=After delivery failure is exhausted, place the event in the DLQ and alert operators.",
        },
        {
          tag: "PROGRESS",
          summary:
            "proceed=implement Gap A retry timing; blockedOn=Gap B durable fallback decision; routinePlanApproval=false",
        },
      ],
    },
    output:
      "Retry timing follows the established project convention. Only terminal fallback needs a product decision.",
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks, null, 2),
  );

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-gap-resolution-bad-"));
  await scenario.build(badDir);
  const badChecks = scenario.score({
    dir: badDir,
    tail: {
      verdict: "INCONCLUSIVE",
      findings: [
        {
          tag: "AUTO_RESOLVE",
          summary:
            "gap=retry timing; resolution=ask the user to choose; basis=ADR omitted it; approval=true",
        },
        {
          tag: "DECISION_REQUEST",
          summary:
            "gap=terminal delivery failure; recommendation=drop it; basis=simple; alternatives=none; impact=unknown; adrPatch=todo",
        },
        {
          tag: "PROGRESS",
          summary: "proceed=none; blockedOn=Gap A and Gap B; routinePlanApproval=true",
        },
      ],
    },
    output: "Please approve the 100 ms retry timing and terminal behavior.",
  });
  assert.equal(badChecks.find((check) => check.label.includes("auto-resolves"))?.pass, false);
  assert.equal(
    badChecks.find((check) => check.label.includes("complete Decision request"))?.pass,
    false,
  );
  assert.equal(badChecks.find((check) => check.label.includes("blocks only"))?.pass, false);
});

test("the planning scorer rejects a routine approval gate for an unchanged ADR", async () => {
  const scenario = await loadScenario("impl-plans-without-routine-approval.mjs");

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-plan-progress-good-"));
  await scenario.build(goodDir);
  const goodChecks = scenario.score({
    dir: goodDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "PLAN_UPDATE",
          summary:
            "presentation=non-blocking progress update; scope=existing webhook handler signature verification; tests=signature rejection, duplicate redelivery, and audit emission; comprehensionLoad=4/10; proceed=true",
        },
        {
          tag: "APPROVAL",
          summary: "required=no; reason=the exact approved ADR revision is unchanged",
        },
        {
          tag: "ADR_CHANGE",
          summary: "required=no; status=Accepted unchanged; reason=no contract or decision change",
        },
      ],
    },
    output:
      "Signature, duplicate, and audit tests are scoped. This is a non-blocking progress update and implementation proceeds now. The existing Accepted (2026-08-18) status is retained without a transition.",
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks, null, 2),
  );

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-plan-progress-bad-"));
  await scenario.build(badDir);
  const badChecks = scenario.score({
    dir: badDir,
    tail: {
      verdict: "PASS",
      findings: [
        {
          tag: "PLAN_UPDATE",
          summary:
            "presentation=non-blocking progress update; scope=webhook handler; tests=signature and duplicate tests; comprehensionLoad=4/10; proceed=true",
        },
        {
          tag: "APPROVAL",
          summary: "required=false; reason=the approved ADR is unchanged",
        },
        {
          tag: "ADR_CHANGE",
          summary: "required=false; status=Proposed until review passes; reason=no contract change",
        },
      ],
    },
    output:
      "Progress update: the webhook handler and tests are scoped. Please approve the implementation plan before I proceed. Status stays Proposed until review passes.",
  });
  assert.equal(
    badChecks.find((check) => check.label.includes("visible report does not ask"))?.pass,
    false,
  );
  assert.equal(
    badChecks.find((check) => check.label.includes("authoritative and Accepted"))?.pass,
    false,
  );
});

test("refactor safety scorers distinguish safe, protected, and orchestration-discretion outcomes", () => {
  const cases = [
    [
      "refactor-safe-local-duplicate",
      "APPLY_NOW | extract current duplicate normalization into one local helper",
    ],
    [
      "refactor-protected-state-transition",
      "PROPOSE_ONLY | state-transition change touches the ADR contract",
    ],
    [
      "refactor-orchestration-discretion",
      "ORCHESTRATION_DISCRETION | main-session or subagent review may verify the same safety gates\nAPPLY_NOW | exact local duplicate with passing before/after tests",
    ],
  ];

  for (const [name, finding] of cases) {
    const reply = `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
${finding}
=== EVAL-END ===`;
    const { code, out } = runEvals(["--only", name], stubAgent(reply));
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /✗/, `${name} compliant classification failed:\n${out}`);
  }
});

test("unsupported orchestration scorer requires no retry and preserves review safety", async () => {
  const scenario = await loadScenario("bedrock-subagent-fallback.mjs");
  const compliant = scenario.score({
    tail: {
      findings: [
        { tag: "NO_DISPATCH", summary: "Amazon Bedrock is known before dispatch" },
        { tag: "NO_RETRY", summary: "the validation error is terminal for this command" },
        { tag: "MAIN_SESSION_FALLBACK", summary: "review passes continue without isolation" },
        {
          tag: "SAFETY_GATE",
          summary: "refactor classification still requires exact evidence and before/after tests",
        },
      ],
    },
  });
  assert.ok(
    compliant.every((check) => check.pass),
    JSON.stringify(compliant, null, 2),
  );

  const unsafe = scenario.score({
    tail: {
      findings: [
        { tag: "SPAWN_SUBAGENT", summary: "try a generic reviewer after the named agent fails" },
        { tag: "WEAKEN_GATE", summary: "skip the before/after tests in the fallback" },
      ],
    },
  });
  assert.ok(
    unsafe.some((check) => !check.pass),
    "unsafe Bedrock routing must fail the scorer",
  );
});

test("feature enrichment scorer separates provider failure context from provider selection", async () => {
  const scenario = await loadScenario("feature-handoff-enriches-underspecified-prd.mjs");
  const baseFindings = [
    { tag: "ENRICHMENT_QUESTION", summary: "초대 만료 기간과 정책 근거 확인" },
    { tag: "ENRICHMENT_QUESTION", summary: "활성 중복 초대 처리 규칙 확인" },
    {
      tag: "ENRICHMENT_QUESTION",
      summary: "provider 오류가 나도 유지할 이메일 전달 실패 보장과 초대 상태 확인",
    },
    {
      tag: "IMPLEMENTATION_DISCRETION",
      summary: "이메일 SDK와 provider 선택은 구현 재량",
    },
    { tag: "NOT_TRANSFERRED", summary: "Result: ASK — 답변 전 handoff 미완료" },
  ];
  const compliant = scenario.score({
    tail: { verdict: "ASK", findings: baseFindings },
    output: "Result: ASK",
  });
  const implementationChoiceCheck = compliant.find(
    (check) => check.label === "does not ask the user to choose a replaceable email implementation",
  );
  assert.equal(implementationChoiceCheck?.pass, true);

  const unsafe = scenario.score({
    tail: {
      verdict: "ASK",
      findings: [
        ...baseFindings,
        { tag: "ENRICHMENT_QUESTION", summary: "어떤 이메일 provider를 선택할지 정해주세요" },
      ],
    },
    output: "Result: ASK",
  });
  const unsafeImplementationChoiceCheck = unsafe.find(
    (check) => check.label === "does not ask the user to choose a replaceable email implementation",
  );
  assert.equal(unsafeImplementationChoiceCheck?.pass, false);
});

test("critical workflow scorers accept compliant classifications and reject collapsed ones", () => {
  const cases = [
    {
      name: "feature-handoff-ownership-transfer",
      good: `Feature: F1 워크스페이스 멤버 초대
**ADR-owned** (category: workspace-member-invitation)
- 관리자만 이메일로 초대할 수 있다.
- 같은 워크스페이스와 이메일의 활성 초대가 있으면 요청을 거부한다.
- 초대는 7일 뒤 만료된다.

**Implementation discretion**
- SendGrid SDK와 대체 이메일 클라이언트

Transfer coverage: 4/4
Result: 1 ADR

Feature: F2 워크스페이스 내보내기
**ADR-owned** (category: workspace-export)
- 활성 워크스페이스 멤버만 내보내기를 요청할 수 있다.
- 완료된 export는 30일 뒤 삭제한다.

**ADR-owned** (category: workspace-export)
- ArchiveCo 장애 시 24시간 fallback 후 재전송한다.

Implementation discretion:
- ArchiveCo SDK와 adapter

Transfer coverage: 5/5
Result: 2 ADRs

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ADR_CANDIDATE | workspace-member-invitation: 워크스페이스 멤버 초대 계약
ADR_CANDIDATE | workspace-export: 내보내기 권한 및 완료 데이터 수명 계약
ADR_CANDIDATE | workspace-export: 장기 보관 경계 및 장애 복구 정책
ADR_DEPENDENCY | workspace-member-invitation is prerequisite for workspace-export
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ADR_CANDIDATE | F1 AWS SDK v3 선택
=== EVAL-END ===`,
    },
    {
      name: "feature-handoff-idempotent-reimport",
      good: `동일한 30일과 ArchiveCo 계약은 변경하지 않고, PRD에서 빠진 24시간 fallback은 자동 삭제하지 않는다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
SEMANTIC_NOOP | 30일 삭제 계약은 표현만 변경됨
SEMANTIC_NOOP | ArchiveCo 경계는 표현만 변경됨
REMOVAL_REVIEW | 24시간 fallback 누락은 명시적 contract change 확인 필요
NO_MUTATION | ADR과 mapping은 현재 상태 유지
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ADR_UPDATE | PRD 문장에 맞춰 ADR을 다시 작성
CONTRACT_DELETE | PRD에서 빠진 24시간 fallback 삭제
=== EVAL-END ===`,
    },
    {
      name: "feature-handoff-enriches-underspecified-prd",
      good: `Feature: F1 워크스페이스 멤버 초대
Enrichment needed:
- 초대 만료 기간과 정책 근거는 무엇인가?
- 활성 중복 초대는 거부, 기존 초대 대체, 재전송 중 어떤 동작이어야 하는가?
- 이메일 전달 실패 시 사용자에게 보이는 결과와 초대 상태는 무엇이어야 하는가?

Implementation discretion:
- 교체 가능한 이메일 SDK/provider/client

Result: ASK
=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
ENRICHMENT_QUESTION | 초대 만료 기간과 정책 근거 확인
ENRICHMENT_QUESTION | 활성 중복 초대의 계약 동작 확인
ENRICHMENT_QUESTION | 이메일 전달 실패 보장과 초대 상태 확인
IMPLEMENTATION_DISCRETION | 이메일 SDK와 provider는 교체 가능
NOT_TRANSFERRED | 답변 전에는 ADR 작성과 handoff 완료를 진행하지 않음
=== EVAL-END ===`,
      bad: `초대는 3일 뒤 만료하고 SendGrid SDK를 사용하면 된다.
=== EVAL-VERDICT: BLOCKED ===
=== EVAL-FINDINGS ===
ADR_CANDIDATE | 3일 초대와 SendGrid 구현으로 바로 ADR 작성
=== EVAL-END ===`,
    },
    {
      name: "impl-blocks-proposed-prerequisite",
      good: `identity/login이 Accepted가 된 뒤 진행해야 한다. checkout-only 우회 구현은 허용하지 않는다.
=== EVAL-VERDICT: BLOCK ===
=== EVAL-FINDINGS ===
BLOCKED | identity/login 선행 ADR이 Proposed라 downstream 구현 중단
=== EVAL-END ===`,
      bad: `checkout-only로 우회 구현을 허용한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NONE
=== EVAL-END ===`,
    },
    {
      name: "hook-admission-routing",
      good: `=== EVAL-VERDICT: A=EXEMPT, B=ADR_FIRST ===
=== EVAL-FINDINGS ===
EXEMPT | SDK와 credential adapter 교체는 코드 수준
ADR_FIRST | 업로드 quota를 5에서 3으로 바꾸는 요구사항 변경
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ADR_FIRST | SDK 교체를 ADR로 작성
=== EVAL-END ===`,
    },
    {
      name: "alps-batch-preserves-mandatory-nfr",
      good: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
BATCH_ALLOWED | 완전한 입력과 명시적 요청으로 batch 승인
SEPARATE_SAVE_UNIT | 각 section과 7.1, 7.2 Feature를 별도 저장
FOCUS_SET | 선택 NFR 중 상위 3개를 집중 항목으로 표시
MANDATORY_NFR | 결제 데이터를 저장하지 않음, GDPR 삭제는 30일 이내, WCAG 2.2 AA, 정산 API 99.9% 가용성
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FOCUS_SET | NFR은 최대 3개이므로 WCAG를 삭제
=== EVAL-END ===`,
    },
    {
      name: "alps-approval-digest-preserves-contract",
      good: `[Feature 승인 요청: 팀 작업 세션]
목적: 팀 작업 결과를 승인하고 보관한다.
필수 규칙:
- 세션은 최대 20턴이다.
- 미승인 세션은 30일 뒤 삭제한다.
- owner만 결과를 내보낼 수 있다.
- 상태는 draft, approved, archived이며 archived는 draft로 돌아갈 수 없다.
완료 결과: 승인 후 팀 대시보드에 결과가 표시된다.
답변: 승인 / 수정: 변경 내용 / 보류
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
CONTRACT_ITEM | 세션은 최대 20턴
CONTRACT_ITEM | 미승인 세션은 30일 뒤 삭제
CONTRACT_ITEM | owner만 결과를 내보냄
CONTRACT_ITEM | draft, approved, archived 상태이며 archived에서 draft 전이 금지
RESPONSE_OPTIONS | 승인, 수정, 보류
NO_UNSEEN_CONTRACT | digest에 없던 요구사항은 저장 내용에 추가하지 않음
SEPARATE_SAVE_UNIT | Feature 7.x를 독립 저장
=== EVAL-END ===`,
      bad: `### 팀 작업 세션
PostgreSQL과 Redis를 사용하고 3회 재시도한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
CONTRACT_ITEM | 구현 방식 승인
=== EVAL-END ===`,
    },
    {
      name: "alps-high-load-suggests-feature-split",
      good: `인지비용: 9/10
분할 후보:
1. 멤버 이메일 초대
2. 멤버 역할 및 접근 관리
3. 감사 기록 내보내기
원본 유지로 하나의 Feature를 계속 진행할 수도 있습니다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | 9/10
SPLIT_CANDIDATE | 멤버 이메일 초대
SPLIT_CANDIDATE | 멤버 역할 및 접근 관리
SPLIT_CANDIDATE | 감사 기록 내보내기
KEEP_ORIGINAL | 원본 단일 Feature 유지 가능
NON_BLOCKING | 분할 여부는 승인과 저장의 전제 조건이 아님
=== EVAL-END ===`,
      bad: `인지비용: 9/10
frontend, backend, database로 반드시 분할해야 하며 승인과 저장을 중단한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | 9/10
SPLIT_CANDIDATE | frontend
SPLIT_CANDIDATE | backend
SPLIT_CANDIDATE | database
      === EVAL-END ===`,
    },
    {
      name: "impl-high-load-asks-before-split",
      good: `Comprehension load: 8/10
구현 전에 선택해 주세요: 분할을 검토할까요, 아니면 원래 ADR대로 진행할까요?
=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
PLAN_SCORE | 8/10
NEXT_STEP | 분할 검토 또는 원래 ADR대로 진행 중 하나를 질문
CANDIDATE_STATE | 구체적인 분할 후보는 사용자 선택 전에는 생성하지 않음
EXECUTION_STATE | 사용자 선택을 기다린 뒤 구현 진행
=== EVAL-END ===`,
      bad: `Comprehension load: 8/10
분할 후보:
1. 결제 예약
2. 재고 예약
3. 보상 처리
후보를 자동 선택하고 바로 구현한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
PLAN_SCORE | 8/10
NEXT_STEP | 자동 분할
CANDIDATE_STATE | 후보 세 개 생성 완료
EXECUTION_STATE | 즉시 구현 진행
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-asks-business-impact-before-solution",
      good: `이 직장인이 PoC를 통해 얻어야 할 최종 비즈니스 임팩트는 무엇이며, 그것이 왜 중요한가요?

=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
BUSINESS_IMPACT_QUESTION | Desired Business Impact와 중요성을 확인
BEFORE_SOLUTION | 솔루션이나 데모보다 비즈니스 임팩트를 먼저 확인
FOCUSED_QUESTION | Section 1의 누락 정보만 한 질문으로 확인
WAIT_FOR_ANSWER | 답변 전 초안 작성이나 저장을 하지 않음
=== EVAL-END ===`,
      bad: `어떤 솔루션과 화면을 만들까요? 시작 상태와 사용자 행동, 데모 절차를 알려주세요.

=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
SOLUTION_FIRST | 비즈니스 임팩트보다 솔루션과 데모 흐름을 먼저 질문
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-follows-full-conversation",
      good: `이 PoC의 주 사용자는 누구이고, 여행 준비 과정에서 어떤 핵심 문제를 해결하려고 하나요?

=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
FOCUSED_QUESTION | 대상 사용자와 핵심 문제를 확인하는 한 번의 집중 질문
MISSING_CONTEXT | Section 1에 필요한 대상 사용자와 핵심 문제가 아직 없음
WAIT_FOR_ANSWER | 답변을 받은 뒤 Section 초안과 승인을 진행
=== EVAL-END ===`,
      bad: `대상 사용자는 개인 여행자이며 문제는 준비 누락입니다. Section 1을 저장했습니다.

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
AUTO_DRAFT | 사용자 답변 없이 Section 1을 완성하고 저장
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-resume-preserves-proposal-first",
      good: `Section 2 승인 요청

Solution Strategy:
해외 출장 직장인이 업무 상황을 선택하면 AI 영어 강사가 짧은 자기소개 대화 연습을 제안한다.

Essential User Experiences:
- 상황에 맞는 첫 영어 질문이 보인다.
- 답변에 맞는 응답과 다음 질문이 보인다.
- 사용자가 연습을 종료하면 완료 상태가 보인다.

승인 / 수정 / 보류

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
PROFILE_AWARE_RESUME | Lite 재개 안내가 proposal-first 규칙을 유지
AI_PROPOSES_SOLUTION | 승인된 Desired Business Impact에서 최소 Solution Strategy를 제안
NO_SOLUTION_DESIGN_QUESTION | 사용자에게 솔루션이나 데모 흐름 설계를 요구하지 않음
APPROVAL_BEFORE_SAVE | 저장 전 승인, 수정, 보류 선택을 제공
=== EVAL-END ===`,
      bad: `재개했습니다. 어떤 솔루션과 기능 흐름을 원하시나요? 시작 상태와 사용자 행동도 알려주세요.

=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
BLANKET_NO_AUTOGENERATE | DO NOT auto-generate content
SOLUTION_DESIGN_QUESTION | 사용자가 Solution과 실행 흐름을 직접 작성
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-proposes-solution-from-business-impact",
      good: `Section 2 승인 요청

Solution Strategy:
해외 출장 직장인이 업무 상황을 입력하면 AI 영어 강사가 상황별 질문으로 짧은 대화 연습을 제공한다.

Essential User Experiences:
- 상황별 연습이 시작된다: 선택한 업무 상황에 맞는 첫 영어 질문이 보인다. 자기소개 대화를 바로 연습하는 데 기여한다.
- 대화가 답변에 맞춰 이어진다: 영어 답변 뒤 관련 응답과 다음 질문이 보인다. 실제 대화에 가까운 연습에 기여한다.
- 사용자가 연습을 종료할 수 있다: 종료 뒤 완료 상태가 보인다. 제한된 준비 시간에 맞춘 연습에 기여한다.

승인 / 수정 / 보류

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
AI_PROPOSES_SOLUTION | Desired Business Impact에서 최소 Solution Strategy를 제안
AI_PROPOSES_ESSENTIAL_EXPERIENCES | 빠져서는 안 되는 세 핵심 사용자 경험을 제안
BUSINESS_IMPACT_TRACE | 각 핵심 사용자 경험이 출장 준비 시간과 대화 준비감에 기여
NO_SOLUTION_DESIGN_QUESTION | 사용자에게 솔루션이나 데모 흐름 작성을 요구하지 않음
APPROVAL_BEFORE_SAVE | 저장 전 승인, 수정, 보류 선택을 제시
=== EVAL-END ===`,
      bad: `어떤 최소 솔루션을 원하시나요? 시작 상태와 사용자 행동, 화면 결과를 알려주세요.

=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
SOLUTION_DESIGN_QUESTION | 사용자가 솔루션과 데모 흐름을 직접 작성해야 함
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-generates-demo-from-essential-user-experiences",
      good: `역설계한 Demo Scenario

시작 상태: 해외 출장을 앞둔 직장인이 영어 대화 연습 서비스를 연다.
데모 입력: 해외 출장에서 자기소개하기

| 단계 | 사용자 행동 | 보이는 예상 결과 | 보여주는 핵심 사용자 경험 |
| --- | --- | --- | --- |
| 1 | 자기소개 주제를 입력하고 대화를 시작한다 | AI 강사의 첫 영어 질문이 보인다 | 상황별 연습이 시작된다 |
| 2 | 영어로 답한다 | 관련 영어 응답과 다음 질문이 보인다 | 대화가 사용자 답변에 맞춰 이어진다 |
| 3 | 대화를 종료한다 | 대화가 멈추고 완료 상태가 보인다 | 사용자가 연습을 종료할 수 있다 |

전체 통과 조건: 모든 Essential User Experiences가 관찰된다.
비즈니스 임팩트 연결: 직장인이 짧은 시간에 자기소개를 반복 연습해 출장 준비 시간을 줄이고 대화를 시작할 준비감을 얻도록 지원한다. 데모는 실제 업무 성과를 증명하지 않는다.
승인 / 수정 / 보류

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
AUTO_GENERATED_DEMO | 승인된 핵심 사용자 경험에서 구체적인 데모를 역설계
COVERS_ALL_ESSENTIAL_EXPERIENCES | 세 핵심 사용자 경험을 모두 커버
SHOWS_FULL_SCENARIO | 전체 단계와 예상 결과 및 커버리지를 승인 전에 표시
NO_RESTATEMENT_QUESTION | 시작 상태와 행동을 사용자에게 묻지 않고 AI가 제안
OVERALL_PASS_SHOWS_ALL | 모든 핵심 사용자 경험이 보여야 전체 통과
=== EVAL-END ===`,
      bad: `데모 흐름은 어떻게 구성할까요? 어떤 시작 상태와 입력, 사용자 행동을 사용할지 알려주세요.

=== EVAL-VERDICT: ASK ===
=== EVAL-FINDINGS ===
RESTATEMENT_QUESTION | 사용자가 데모 흐름을 다시 작성해야 함
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-skips-empty-optional-section",
      good: `명시적으로 제외할 항목이 없으므로 optional Section 3은 작성하거나 저장하지 않고 건너뜁니다. 이제 필수 Section 4 Demo Scenario 승인 초안을 준비합니다.

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
SKIP_SECTION_3 | 명시적 제외 범위가 없어 optional Section 3을 저장하지 않음
NO_INVENTED_EXCLUSIONS | 템플릿을 채우기 위한 제외 항목을 만들지 않음
LITE_INDEPENDENT | Lite 완료는 다른 문서나 작성 상태와 무관함
DEMO_READY | 필수 Demo Scenario 작성을 계속할 수 있음
=== EVAL-END ===`,
      bad: `제외 범위를 채우기 위해 관리자 기능, 결제, 모바일 화면을 지원하지 않는 것으로 기록하겠습니다. 다음 단계로 /alps-init을 실행해 Full ALPS를 작성하세요.

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
EXCLUSIONS | 관리자, 결제, 모바일을 자동 제외
NEXT_STEP | Full ALPS 작성
=== EVAL-END ===`,
    },
    {
      name: "lite-alps-records-explicit-exclusions",
      good: `Section 3 승인 요청
명시적 제외:
- 팀 관리자 페르소나
- 음성 입력 화면
- 오프라인 복구 데모
가격 정책은 미결정이며 제외 범위에 포함하지 않습니다.
승인 / 수정 / 보류

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
EXPLICIT_EXCLUSION | 팀 관리자 페르소나
EXPLICIT_EXCLUSION | 음성 입력 화면
EXPLICIT_EXCLUSION | 오프라인 복구 데모
UNRESOLVED_NOT_EXCLUDED | 가격 정책은 미결정이며 제외하지 않음
OPTIONAL_SECTION | Section 3은 명시적 제외가 있을 때만 작성하는 선택 Section
=== EVAL-END ===`,
      bad: `Section 4:
- 팀 관리자
- 음성 입력
- 오프라인 복구
- 가격 정책
완료 후 Full ALPS로 전환합니다.

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
EXPLICIT_EXCLUSION | 모든 항목과 가격 정책
=== EVAL-END ===`,
    },
    {
      name: "impl-review-selects-risk-mode",
      good: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
STANDARD | A private local helper consolidation; public API unchanged
FULL | B retention 30 to 90 days and public API change
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
STANDARD | B public API retention change
=== EVAL-END ===`,
    },
    {
      name: "comprehension-load-score-only",
      good: `Comprehension load (A, ALPS Feature): 1/10
Comprehension load (B, ADR): 9/10
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | A 1/10
ADR_SCORE | B 9/10
=== EVAL-END ===`,
      bad: `A — 인지비용: 0/10
B — 인지비용: 9/10
B는 여러 시스템이 연결되어 있어서 이해하기 어렵다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | A 0/10
ADR_SCORE | B 9/10
=== EVAL-END ===`,
    },
    {
      name: "comprehension-load-calibration-bands",
      good: `A — 인지비용: 2/10
B — 인지비용: 5/10
C — 인지비용: 8/10
D — 인지비용: 10/10
점수는 자문용이며 승인이나 구현을 차단하지 않고 품질 점수가 아니다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
comprehension-load-A | A 2/10 — LOW_SCORE
comprehension-load-B | B 5/10 — RECOMMENDED_SCORE
comprehension-load-C | C 8/10 — HIGH_SCORE
comprehension-load-D | D 10/10 — VERY_HIGH_SCORE
=== EVAL-END ===`,
      bad: `A — 품질: 9/10
B — 인지비용: 2/10
C — 인지비용: 4/10
D — 차단됨
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
LOW_SCORE | A 9/10
RECOMMENDED_SCORE | B 2/10
HIGH_SCORE | C 4/10
VERY_HIGH_SCORE | D 6/10
=== EVAL-END ===`,
    },
    {
      name: "impl-offers-stacked-pr-fallback",
      good: `Feature와 ADR은 하나로 유지한다. 구현 전달만 세 개의 dependency-ordered Stacked PR로 나누고 각 layer는 하나의 review question을 가진다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
KEEP_ONE_ADR | 하나의 Feature와 하나의 ADR 계약을 유지
STACK_FALLBACK | Stacked PR을 dependency 순서로 구성하고 PR마다 하나의 review question 사용
STACK_BOUNDARY | 하나의 conceptual change와 review question 단위로 나눔
EPHEMERAL | Stack 계획은 ADR, mapping, registry에 저장하지 않음
NO_AUTOPUBLISH | 사용자의 게시 요청과 GitHub capability 확인 전에는 publish하지 않음
STATUS_LIFECYCLE | 전체 Stack의 테스트와 review가 끝날 때까지 ADR은 Proposed이고 이후에만 Accepted
=== EVAL-END ===`,
      bad: `인지비용이 높으므로 ADR 세 개를 만들고 PR도 즉시 게시했다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NEW_ADR | 새 ADR 세 개 생성
AUTO_PUBLISH | 자동 게시 완료
=== EVAL-END ===`,
    },
    {
      name: "author-routes-existing-provider-change",
      good: `기존 ADR 0001이 같은 결정을 소유하므로 제자리 재작성하고 /adr-impl ai/model-provider로 라우팅한다. 원복도 같은 ADR이며 새 ADR이나 0002는 없다.
=== EVAL-VERDICT: ROUTE_TO_EXISTING ===
=== EVAL-FINDINGS ===
DECISION_IDENTITY | 기존 provider boundary ADR을 유지하고 Bedrock 원복도 같은 0001에 반영
=== EVAL-END ===`,
      bad: `OpenAI API 전환용 ADR 0002를 새로 작성한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NEW_ADR | provider 변경마다 새 ADR 생성
=== EVAL-END ===`,
    },
    {
      name: "impl-completes-without-reconfirmation",
      good: `PASS_PATH는 추가 승인 없이 Accepted로 완료한다. FIX_PATH는 사용자 승인 없이 자동 수정하고 최종 보고에 수정과 검증을 정리한다. ESCALATE_ONLY만 사용자에게 묻는다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
PASS_PATH | 추가 승인 없이 Accepted로 전환
FIX_PATH | 사용자 승인 없이 자동으로 Spec violation 코드를 수정하고 Test gap 테스트를 추가한 뒤 재실행하고 동일 모드로 재리뷰
ESCALATE_ONLY | 계약 변경 결정만 사용자에게 질문하며 자동 수정 없음
=== EVAL-END ===`,
      bad: `구현 후 재생성 가능한지 다시 확인받고 각 finding을 apply/skip/defer로 판정받는다.
=== EVAL-VERDICT: BLOCK ===
=== EVAL-FINDINGS ===
PASS_PATH | 사용자 승인 대기
=== EVAL-END ===`,
    },
  ];

  for (const { name, good, bad } of cases) {
    const goodRun = runEvals(["--only", name], stubAgent(good));
    assert.equal(goodRun.code, 0, goodRun.out);
    assert.doesNotMatch(goodRun.out, /✗/, `${name} rejected a compliant result:\n${goodRun.out}`);

    const badRun = runEvals(["--only", name], stubAgent(bad));
    assert.equal(badRun.code, 0, badRun.out);
    assert.match(badRun.out, /✗/, `${name} scorer failed to reject the collapsed behavior`);
  }
});

test("score-only scorer rejects visible scores that disagree with the machine tail", () => {
  const reply = `A — 인지비용: 9/10 — 단순하지만 높게 평가했다.
B — 인지비용: 1/10 — 복잡하지만 낮게 평가했다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | A 1/10
ADR_SCORE | B 9/10
=== EVAL-END ===`;
  const { code, out } = runEvals(["--only", "comprehension-load-score-only"], stubAgent(reply));
  assert.equal(code, 0, out);
  assert.match(out, /✗.*matches the visible Feature score to the machine tail/);
  assert.match(out, /✗.*matches the visible ADR score to the machine tail/);
  assert.match(out, /✗.*shows only the exact two score lines/);
});

test("stack scorer rejects technical-layer delivery and premature ADR promotion", () => {
  const reply = `하나의 ADR은 유지하지만 PR은 frontend, backend, database 기술 계층으로 나눈다.
각 layer가 끝날 때 ADR을 Accepted로 바꾼다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
KEEP_ONE_ADR | 하나의 ADR 유지
STACK_FALLBACK | Stacked PR을 dependency 순서로 만들고 PR마다 one review question 사용
STACK_BOUNDARY | frontend, backend, database 기술 계층으로 나눔
EPHEMERAL | Stack 상태는 ADR과 mapping에 저장하지 않음
NO_AUTOPUBLISH | GitHub capability 확인 후 publish
STATUS_LIFECYCLE | 각 layer가 끝나면 ADR을 Accepted로 변경
=== EVAL-END ===`;
  const { code, out } = runEvals(["--only", "impl-offers-stacked-pr-fallback"], stubAgent(reply));
  assert.equal(code, 0, out);
  assert.match(out, /✗.*keeps every layer under the same approved ADR contract/);
  assert.match(out, /✗.*splits by conceptual review unit, not technical layer/);
  assert.match(out, /✗.*requires both an explicit publish request and GitHub capability/);
  assert.match(out, /✗.*keeps the ADR Proposed until the whole Stack is verified/);
});

test("final-state sync scorer rejects transition residue and preserves current prohibitions", async () => {
  const scenario = await loadScenario("sync-rewrites-final-state-only.mjs");

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-final-state-bad-"));
  await scenario.build(badDir);
  const badChecks = await scenario.score({ dir: badDir, output: "", tail: null });
  assert.ok(
    badChecks.some((check) => !check.pass),
    "the planted transition narration must not score as compliant",
  );

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-final-state-good-"));
  await scenario.build(goodDir);
  const adrPath = path.join(goodDir, "docs/adr/runtime/event/0001-event-name.md");
  const mappingPath = path.join(goodDir, "docs/adr/.mapping.json");
  writeFileSync(
    adrPath,
    readFileSync(adrPath, "utf8").replace(
      "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다.",
      "이벤트 이름은 `CURRENT_EVENT`다.",
    ),
  );
  writeFileSync(
    mappingPath,
    readFileSync(mappingPath, "utf8").replace(
      "LEGACY_EVENT와 CURRENT_EVENT를 혼용하지 않고 CURRENT_EVENT만 사용한다",
      "이벤트 이름은 CURRENT_EVENT다",
    ),
  );

  const goodChecks = await scenario.score({ dir: goodDir, output: "", tail: null });
  assert.deepEqual(
    goodChecks.filter((check) => !check.pass),
    [],
    `a direct final-state rewrite must pass: ${JSON.stringify(goodChecks)}`,
  );
});

test("infrastructure sync scorer separates repository evidence from live state", async () => {
  const scenario = await loadScenario("sync-stays-local-for-infrastructure.mjs");

  const good = {
    complete: true,
    findings: [
      { tag: "LOCAL_EVIDENCE", summary: "IaC source and local policy tests are the evidence" },
      {
        tag: "LIVE_ACCESS",
        summary: "NO — read-only provider access is forbidden even when credentials exist",
      },
      { tag: "REPOSITORY_ALIGNMENT", summary: "ADR and repository IaC are aligned" },
      { tag: "RUNTIME_STATE", summary: "UNVERIFIED — no deployed environment was inspected" },
      { tag: "STATUS", summary: "UNCHANGED — runtime uncertainty does not demote the ADR" },
    ],
  };
  const goodChecks = scenario.score({ tail: good });
  assert.deepEqual(
    goodChecks.filter((check) => !check.pass),
    [],
    `local-only classification must pass: ${JSON.stringify(goodChecks)}`,
  );

  const unsafe = {
    complete: true,
    findings: [
      { tag: "LOCAL_EVIDENCE", summary: "IaC source is present" },
      {
        tag: "LIVE_ACCESS",
        summary: "Use the existing credentials for a read-only provider query",
      },
      { tag: "REPOSITORY_ALIGNMENT", summary: "Production is in sync" },
      { tag: "RUNTIME_STATE", summary: "Verified from the provider API" },
      { tag: "STATUS", summary: "Demote if the deployed resource differs" },
      { tag: "PRODUCTION_IN_SYNC", summary: "The live environment matches the ADR" },
    ],
  };
  const unsafeChecks = scenario.score({ tail: unsafe });
  assert.ok(
    unsafeChecks.filter((check) => !check.pass).length >= 3,
    `live-access behavior must fail several checks: ${JSON.stringify(unsafeChecks)}`,
  );
});

// ── the author-side scorer must discriminate too ───────────────────────────
// author-self-checks-missing-value scores an ARTIFACT, not just a reply, so its
// stub has to write the ADR the way a real run would. That makes it the one
// scenario whose scorer could pass vacuously: most of its checks assert the
// ABSENCE of a bad value in the body, and an empty body satisfies every one of
// them. The "an ADR was written" check exists for that reason, and these two
// tests pin that it actually carries the weight.
//
// The pair matters as much here as it does on the review side. A stub that
// blurs the contract must fail, and a stub that names the gaps must pass — a
// scorer tuned to catch only one of those directions would greenlight the
// behaviour that reintroduces the defect.
const AUTHOR_ADR_PATH = "docs/adr/pricing/0001-free-plan-session-limit.md";

// The correct behaviour: contracts the brief never gave are named as open
// questions, nothing is invented, tuning values stay out.
const GOOD_AUTHOR_ADR = `# ADR 0001: 무료 플랜 채팅 세션 제한

Date: 2026-07-01

## Status

Proposed

## Context

무료 사용자의 LLM 호출 비용이 예측 불가능하게 늘고 있다. 재무팀이 원가 상한을 승인했다.

## Decision Drivers

- 무료 플랜 1인당 월 LLM 원가를 통제해야 한다
- 상한에 걸린 사용자의 이탈을 최소화해야 한다
- 서버가 세션 상태를 오래 들고 있지 않아야 한다

## Decision

세션 단위로 대화 길이를 제한하고, 상한에 도달하면 새 세션을 시작하도록 안내한다.

### Requirement contract

- 세션당 대화 길이 상한: **아직 정해지지 않았다 — 오너에게 확인 필요**
- 세션 기록 보관 기간: **미정, 확인 필요**
- 세션의 허용 상태 집합: 브리프가 어떤 상태인지 말하지 않아 **미정, 확인 필요**

## Consequences

### Positive

원가가 예측 가능해진다.

### Negative

긴 대화가 필요한 사용자는 맥락을 다시 제공해야 한다.

### Alternatives

- **토큰 총량 제한**: 원가와 정확히 연동되지만 남은 양을 예측할 수 없다.
- **월 누적 턴 수 제한**: 단순하지만 서버가 누적치를 들고 있어야 해 운영 제약에 어긋난다.
`;

// The pre-fix behaviour: the hole is written into the ADR as "적절히", the state
// set is summarized away, and the draft is reported clean.
const BAD_AUTHOR_ADR = GOOD_AUTHOR_ADR.replace(
  /### Requirement contract[\s\S]*?\n\n## Consequences/,
  `### Requirement contract

- 한 세션의 대화 길이는 적절히 제한된다
- 세션 기록은 일정 기간 보관 후 삭제된다
- 세션에는 몇 가지 상태가 있으며 상태 전이를 관리한다
- 세션 캐시 TTL은 300초다

## Consequences`,
);

// A stub that writes the ADR into its cwd (the fixture) and then prints a reply.
// The runner passes cwd=fixture, which is what makes an author-side stub possible.
function stubAuthor(adrBody, reply) {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-author-stub-"));
  const bodyFile = path.join(dir, "adr.md");
  writeFileSync(bodyFile, adrBody);
  const script = path.join(dir, "stub.sh");
  writeFileSync(
    script,
    `#!/bin/bash\ncat > /dev/null\n` +
      `mkdir -p "$(dirname ${AUTHOR_ADR_PATH})"\ncp ${bodyFile} ${AUTHOR_ADR_PATH}\n` +
      `cat <<'ADREOF'\n${reply}\nADREOF\n`,
  );
  chmodSync(script, 0o755);
  return script;
}

const GOOD_AUTHOR_REPLY = `step 6(a) 하네스: 통과.

step 6(b) 자기 점검 — R19 재생성 테스트를 적어냅니다.

재구축이 지켜야 할 계약:
- 세션당 대화 길이 상한 — **없음. 브리프에 숫자가 없어 확인 필요**
- 세션 기록 보관 기간 — **없음, 미정이라 물어봐야 합니다**
- 허용 상태 집합 — **어떤 상태인지 정해지지 않았습니다**

숫자를 만들어 넣지 않았고, 캐시 TTL과 워커 수는 튜닝값이라 본문에서 제외했습니다.

=== EVAL-VERDICT: FIX_REQUIRED ===
=== EVAL-FINDINGS ===
R18a | 세션당 대화 길이 상한이 브리프에 없어 미정 — 오너 확인 필요
R19 | 보관 기간과 허용 상태 집합이 비어 재구축 불가
=== EVAL-END ===`;

const BAD_AUTHOR_REPLY = `ADR을 작성했고 하네스도 통과했습니다. 계약은 완전합니다.

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NONE
=== EVAL-END ===`;

test("the author self-check scorer passes a draft that names its gaps", () => {
  const { code, out } = runEvals(
    ["--only", "author-self-checks"],
    stubAuthor(GOOD_AUTHOR_ADR, GOOD_AUTHOR_REPLY),
  );
  assert.equal(code, 0);
  assert.doesNotMatch(out, /✗/, `a compliant author run must fail no check:\n${out}`);
});

test("the author self-check scorer catches a blurred contract reported as clean", () => {
  const { code, out } = runEvals(
    ["--only", "author-self-checks"],
    stubAuthor(BAD_AUTHOR_ADR, BAD_AUTHOR_REPLY),
  );
  assert.equal(code, 0, "a failing check is a finding, not a harness error");
  // the exact pre-fix behaviour: the hole written in as 적절히 / 일정 기간
  assert.match(out, /✗.*does not blur the missing contract/);
  // a self-reviewer's default conclusion — "the contract is complete"
  assert.match(out, /✗.*does not report a clean pass while contracts are unresolved/);
  // the gaps went unnamed, so the open-question checks must fail rather than
  // being satisfied by the ADR merely mentioning the subject
  assert.match(out, /✗.*names the missing retention period as an open question/);
  // and the tuning value pulled up into the body is still scored
  assert.match(out, /✗.*leaves the cache TTL out/);
});

// The costliest failure this scenario watches for: a value the brief never gave,
// written into the ADR as though approved. /adr-impl enforces ADR values at face
// value, so a fabricated cap becomes a real product limit nobody signed off on.
//
// This test exists because the check's first version silently passed it. JS `\b`
// is defined over ASCII word characters, so it never matches after a Hangul
// syllable: `/\d+\s*(턴|일)\b/` does not match "최대 20턴으로" or "30일 후". The
// scenario reported green on an ADR that had invented both numbers — the same
// defect class as the Korean word-order bug this file's header describes, and the
// reason a scorer needs its own adversarial fixture rather than just a good one.
test("the invented-value check fires on Korean units, where \\b does not apply", () => {
  const invented = GOOD_AUTHOR_ADR.replace(
    /### Requirement contract[\s\S]*?\n\n## Consequences/,
    `### Requirement contract

- 한 세션은 최대 20턴으로 제한된다
- 세션 기록은 30일 후 삭제된다

## Consequences`,
  );
  const { code, out } = runEvals(
    ["--only", "author-self-checks"],
    stubAuthor(invented, BAD_AUTHOR_REPLY),
  );
  assert.equal(code, 0);
  assert.match(out, /✗.*invents no requirement value the brief never gave/);
});

// The vacuous-pass guard. Most of this scenario's checks assert an ABSENCE, so an
// agent that writes no ADR at all satisfies them — which would report a run that
// produced nothing as mostly green. The "an ADR was written" check must fail, and
// the open-question checks must not be satisfied by an empty artifact.
test("an author run that writes no ADR fails rather than passing vacuously", () => {
  const { code, out } = runEvals(["--only", "author-self-checks"], stubAgent(GOOD_AUTHOR_REPLY));
  assert.equal(code, 0);
  assert.match(out, /✗.*an ADR was written/);
  // the brief's alternatives can only be scored against a body, so this one too
  assert.match(out, /✗.*records the token-quota alternative/);
});

// A reply with no tail block cannot be scored against domain checks. Report it
// separately so negative checks do not pass vacuously.
test("a reply with no tail block is unscored", () => {
  const { code, out } = runEvals(
    ["--only", "review-requirement-value"],
    stubAgent("리뷰를 완료했습니다. 문제 없습니다."),
  );
  assert.equal(code, 2);
  assert.match(out, /UNSCORED.*required machine-readable tail/);
  assert.match(out, /never produced scorable output/);
});

// Rates are the whole output of this tool, so an all-or-nothing summary would
// defeat it. With a stub that alternates, the run must report a fraction.
test("runs are aggregated as a rate, not collapsed to pass/fail", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-flaky-"));
  const counter = path.join(dir, "n");
  const good = stubAgent(GOOD_REVIEW);
  const bad = stubAgent(BAD_REVIEW);
  const script = path.join(dir, "flaky.sh");
  writeFileSync(
    script,
    `#!/bin/bash\nN=$(cat ${counter} 2>/dev/null || echo 0)\necho $((N+1)) > ${counter}\n` +
      `if [ $((N % 2)) -eq 0 ]; then exec ${bad}; else exec ${good}; fi\n`,
  );
  chmodSync(script, 0o755);

  const { code, out } = runEvals(["--only", "review-requirement-value", "--runs", "4"], script);
  assert.equal(code, 0);
  // 2 of 4 replies commit the defect, so the check must read 2/4 — not ✔ and not 0/4
  assert.match(out, /✗\s+2\/4\s+no rule fires against a recorded requirement value/);
  assert.match(out, /scored 4\/4; errors 0; unscored 0/);
});

test("shareable reports omit transcripts and absolute fixture paths by default", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-report-safe-"));
  const report = path.join(dir, "report.md");
  const { code } = runEvals(
    ["--only", "review-requirement-value", "--out", report],
    stubAgent(GOOD_REVIEW),
  );
  assert.equal(code, 0);
  const body = readFileSync(report, "utf8");
  assert.match(body, /transcripts: omitted/);
  assert.match(body, /prompt: \d+ chars · sha256/);
  assert.match(body, /Representative transcript omitted/);
  assert.doesNotMatch(body, /One full agent reply|GOOD_REVIEW/);
  assert.doesNotMatch(body, new RegExp(tmpdir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("full transcripts are included only by explicit opt-in", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-report-transcript-"));
  const report = path.join(dir, "report.md");
  const { code } = runEvals(
    [
      "--only",
      "review-requirement-value",
      "--out",
      report,
      "--include-transcript",
      "--include-fixture-paths",
    ],
    stubAgent(GOOD_REVIEW),
  );
  assert.equal(code, 0);
  const body = readFileSync(report, "utf8");
  assert.match(body, /transcripts: included by explicit request/);
  assert.match(body, /Representative agent reply/);
  assert.match(body, /Regeneration check/);
  assert.match(body, new RegExp(tmpdir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// The runner must fail loudly when the agent command is wrong, or a
// misconfigured run reads as "everything passed".
test("an agent that produces nothing is an error, not a silent pass", () => {
  const { code, out } = runEvals(["--only", "review-requirement-value"], "true");
  assert.equal(code, 2);
  assert.match(out, /agent never produced scorable output|did not run/);
});

test("a nonzero agent exit is an error even when it prints partial output", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-failed-agent-"));
  const script = path.join(dir, "stub.sh");
  writeFileSync(
    script,
    `#!/bin/bash\ncat > /dev/null\necho 'partial response that must not be scored'\nexit 1\n`,
  );
  chmodSync(script, 0o755);

  const { code, out } = runEvals(["--only", "review-requirement-value"], script);
  assert.equal(code, 2);
  assert.match(out, /agent command failed \(status 1\)/);
});

// The real-repo scenario copies a shipped ADR into a throwaway fixture. If it
// copies the ADR but not what the ADR LINKS to, every outbound link reads as
// broken and the reviewer spends R10 findings on the fixture's own trimming.
// The first pixelbank run did exactly that: it reported ../../FREE_USAGE.md as
// missing when the file exists. A fixture that manufactures findings is worse
// than a noisy one — it teaches the reader to discount that rule.
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
