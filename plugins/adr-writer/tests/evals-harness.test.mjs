// Dependency-free fixture, transport, aggregation and report regressions.
// Semantic correctness is measured separately by live LLM evaluations.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  scratchDirs,
  scratch,
  PLUGIN_ROOT,
  EVALS,
  built,
  scenarioFiles,
  loadScenario,
  needsEnv,
  assertShippedPrompt,
} from "./evals-harness-helpers.mjs";

after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

const RUN = path.join(EVALS, "run.mjs");

test("comprehension scoring prompts include the shipping rubric without requiring tools", async () => {
  const rubric = readFileSync(path.join(PLUGIN_ROOT, "references/comprehension-load.md"), "utf8");
  for (const name of ["comprehension-load-score-only", "comprehension-load-calibration-bands"]) {
    const { prompt } = await built(`${name}.mjs`);
    assert.ok(prompt.includes(rubric), `${name} must receive the full current rubric`);
    assert.equal(prompt.split(rubric).length - 1, 1, `${name} receives the rubric only once`);
  }
});

function runEvals(args, cmd) {
  const r = spawnSync("node", [RUN, ...args], {
    cwd: PLUGIN_ROOT,
    encoding: "utf8",
    // The runner keeps each fixture as evidence; here they live in a scratch folder.
    env: {
      ...process.env,
      TMPDIR: scratch("adr-eval-run-"),
      ...(cmd ? { ADR_EVAL_CMD: cmd } : {}),
    },
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
  const { prompt } = await built("lite-alps-resume-preserves-proposal-first.mjs");

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

// The prompt has to carry the SHIPPED instruction text. The author-* scenarios build in a
// git workspace, so the integration file checks theirs; scenarios that point at a repo
// supplied through the environment cannot build without it.
test("prompts embed the real skill/agent text, not a paraphrase", async () => {
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
    if (s.name.startsWith("author-") || needsEnv(s)) continue;
    assertShippedPrompt(s, (await built(file)).prompt);
  }
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
    const { dir } = await built(file);
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

test("the real-repo fixture resolves the ADR's own local links", async (t) => {
  const scenario = await loadScenario("review-real-repo-adr.mjs");

  // Build a miniature "real repo": an ADR that links to a sibling and to a doc
  // outside docs/adr/, plus a link that is genuinely absent.
  const repo = scratch("adr-eval-fakerepo-");
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
  const dir = scratch("adr-eval-real-");
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

test("legacy CLI prepares by default even when an executable command was supplied", () => {
  const result = runEvals(["--only", "impl-plans-without-routine-approval", "--cmd", "exit 91"]);
  assert.equal(result.code, 0);
  assert.ok(!result.out.includes("agent command failed"));
});
