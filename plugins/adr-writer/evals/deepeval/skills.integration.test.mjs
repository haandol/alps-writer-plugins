import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { main, parseSkillsArgs, selectImpacted } from "../skills/run.mjs";
import { catalog, skillCatalog, checkReferences, PLUGIN } from "../skills/catalog.mjs";
import { routingCases } from "../skills/catalog.mjs";
import { comparePairs } from "../skills/metrics.mjs";
import { makeTools } from "../regression/workspace.mjs";
import { executionOutcome } from "../lib/execution-checks.mjs";
import { toolServerOptions } from "../regression/tool-config.mjs";
import { cases } from "../regression/cases.mjs";
import { renderSavedReport } from "./render-report.mjs";

// These SDK tests use disposable copies, not user-requested evaluation runs.
const temporaryRoots = [];
const temp = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "skill-eval-system-"));
  temporaryRoots.push(directory);
  return directory;
};
after(() => {
  for (const directory of temporaryRoots) rmSync(directory, { recursive: true, force: true });
});
const noCall = () => {
  throw new Error("A free operation called a model");
};

test("invalid fixture evidence and an empty registered verifier cannot reach final checks", () => {
  const tools = { call: noCall };
  const item = { type: "execution" };
  const fixture = { "test/policy.test.mjs": "original" };
  const evidence = { before: fixture, after: { ...fixture }, events: [] };
  assert.throws(
    () => executionOutcome(tools, item, evidence, fixture, () => undefined),
    /Invalid execution evidence checks/,
  );
  evidence.after["test/policy.test.mjs"] = "changed";
  assert.throws(() => executionOutcome(tools, item, evidence, fixture), /immutable fixture/);
});

test("one preflight on the actual fixture and the same mandatory action checks on execution and replay", async () => {
  const source = cases.find((c) => c.id === "rollup-encbird-withheld-approval");
  let builds = 0;
  const item = {
    ...source,
    type: "execution",
    group: source.skill,
    build() {
      builds++;
      return source.build();
    },
  };
  const evaluate = async () => ({ verdict: "PASS", frameworkResult: { testResults: [] } });
  const first = await main(["--live", "--suite", "execution", "--runs", "1", "--out", temp()], {
    cases: [item],
    evaluate,
    target: async ({ config }) => {
      const args = JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args.slice(1);
      const tools = makeTools(toolServerOptions(args));
      assert.throws(() => tools.call("write_file", { path: "working-notes.md", content: "draft" }));
      return { text: "No official documents changed.", models: ["local-stub"], costUSD: 0 };
    },
  });
  assert.equal(builds, 1);
  const run = first.report.runs[0];
  assert.equal(run.verdict, "NOT_PROVEN");
  const folder = path.join(first.output, run.artifactDirectory);
  assert.equal(existsSync(path.join(folder, "prepared")), false);
  const captured = path.dirname(path.join(first.output, run.capture));
  const checks = JSON.parse(readFileSync(path.join(captured, "fixture-checks.json"), "utf8"));
  assert.deepEqual(JSON.parse(readFileSync(path.join(folder, "preflight.json"), "utf8")), [
    checks.policy,
    checks.lint,
  ]);
  const replay = await main(["--live", "--rejudge", first.output, "--out", temp()], {
    cases: [item],
    evaluate,
    target: noCall,
  });
  const other = replay.report.runs[0];
  assert.equal(other.verdict, run.verdict);
  const outcomes = (r) => r.checks.map(({ label, pass }) => [label, pass]);
  assert.deepEqual(outcomes(other), outcomes(run));
  assert.ok(
    run.checks.some(
      (c) => c.label === "mutations remain within fixture task permissions" && !c.pass,
    ),
  );
});

test("an unfinished live evaluation checkpoints the completed case and can render the snapshot offline", async () => {
  const out = temp();
  const typo = routingCases.find((c) => c.id === "routing-typo");
  const items = [typo, { ...typo, id: "routing-typo-second" }];
  let calls = 0;
  const result = await main(
    ["--live", "--suite", "routing", "--jobs", "1", "--runs", "1", "--out", out],
    {
      cases: items,
      judge: noCall,
      target: async () => {
        if (++calls === 2) {
          const raw = readFileSync(path.join(out, "results.json"), "utf8");
          const checkpoint = JSON.parse(raw);
          assert.deepEqual(
            checkpoint.runs.map((r) => r.verdict),
            ["PASS", "NOT_RUN"],
          );
          assert.equal(
            JSON.parse(readFileSync(path.join(out, "case-results", items[0].id + ".json"))).runs[0]
              .verdict,
            "PASS",
          );
          const restored = temp();
          writeFileSync(path.join(restored, "results.json"), raw);
          const recovered = await main(["--report", restored], { target: noCall, judge: noCall });
          assert.ok(existsSync(recovered.html));
          assert.ok(readFileSync(path.join(out, "index.html"), "utf8").includes("실행 시작 시점"));
        }
        return { structured: { selected: [] }, text: "{}", models: ["local-stub"], costUSD: 0 };
      },
    },
  );
  assert.deepEqual(
    result.report.runs.map((r) => r.verdict),
    ["PASS", "PASS"],
  );
  assert.ok(!readFileSync(result.html, "utf8").includes("실행 시작 시점"));
});

test("five-repeat preparation groups outcomes without dropping native trial records", async () => {
  const item = (await catalog()).find((entry) => entry.id === "impl-uses-intent-for-file-lookup");
  const result = await main(
    ["--prepare", "--suite", "classification", "--runs", "5", "--out", temp()],
    { cases: [item], target: noCall, judge: noCall },
  );
  assert.equal(result.status, 0);
  assert.equal(result.report.runs.length, 5);
  assert.ok(result.report.runs.every((run) => run.verdict === "NOT_RUN" && !run.calls.length));
  const saved = JSON.parse(readFileSync(path.join(result.output, `case-results/${item.id}.json`)));
  assert.equal(saved.runs.length, 5);
  assert.ok(existsSync(result.html));
});

test("a payment fixture edit selects exactly its consumers and a shared change still selects all", async () => {
  const all = await catalog();
  const { loadScenarios } = await import("../run.mjs");
  const scenarios = await loadScenarios();
  const expected = scenarios
    .filter((item) =>
      readFileSync(path.join(PLUGIN, "evals/scenarios", item.file), "utf8").includes(
        "../lib/payment-change.mjs",
      ),
    )
    .map((item) => item.name)
    .sort();
  const { scenarioNamesForChangedPaths } = await import("../impact-map.mjs");
  const fixture = "plugins/adr-writer/evals/lib/payment-change.mjs";
  assert.equal(expected.length, 4);
  assert.deepEqual([...scenarioNamesForChangedPaths([fixture], scenarios)].sort(), expected);
  assert.deepEqual(
    selectImpacted(all, [fixture])
      .map((item) => item.id)
      .sort(),
    expected,
  );
  assert.equal(
    selectImpacted(all, [fixture, "plugins/adr-writer/evals/lib/harness.mjs"]).length,
    all.length,
  );
});

test("one case fills the requested workers while each repeat keeps its own results and failures", async () => {
  const item = routingCases.find((item) => item.required.length === 0);
  for (const jobs of [1, 2]) {
    let active = 0;
    let peak = 0;
    const directories = new Set();
    const result = await main(
      ["--live", "--suite", "routing", "--runs", "5", "--jobs", String(jobs), "--out", temp()],
      {
        cases: [item],
        target: async ({ cwd }) => {
          directories.add(cwd);
          peak = Math.max(peak, ++active);
          await new Promise((resolve) => setImmediate(resolve));
          active--;
          if (cwd.endsWith("-2")) throw new Error("isolated fixture failure");
          return { structured: { selected: [] }, text: '{"selected":[]}', models: ["target-stub"] };
        },
        judge: noCall,
      },
    );
    assert.equal(peak, jobs);
    assert.equal(directories.size, 5);
    const saved = JSON.parse(readFileSync(path.join(result.output, "results.json"), "utf8"));
    assert.deepEqual(
      saved.runs.map((run) => [run.repeat, run.verdict]),
      [
        [1, "PASS"],
        [2, "ERROR"],
        [3, "PASS"],
        [4, "PASS"],
        [5, "PASS"],
      ],
    );
  }
});

test("every classification probe finds the guidance its sibling-plugin skills reference", async () => {
  const items = (await catalog()).filter((entry) => entry.type === "classification");
  assert.ok(items.some((entry) => entry.id.startsWith("ontology-")));
  const result = await main(
    ["--prepare", "--suite", "classification", "--runs", "1", "--out", temp()],
    { cases: items, target: noCall, judge: noCall },
  );
  const errors = result.report.runs.filter((run) => run.verdict === "ERROR");
  assert.deepEqual(
    errors.map((run) => `${run.caseId}: ${run.error ?? run.notRunReason ?? ""}`),
    [],
  );
  // Preparing the whole classification corpus builds every fixture.
}, 30_000);

test("unified CLI rejects ambiguous live intent and undefined comparison conditions", () => {
  for (const args of [
    ["--live", "--prepare"],
    ["--live", "--list"],
    ["--live", "--report", "x"],
    ["--compare", "versions"],
    ["--baseline", "HEAD"],
    ["--runs", "0"],
    ["--suite", "wrong"],
    ["--changed", "HEAD", "--only", "sync"],
    ["--report", "x", "--runs", "3"],
  ])
    assert.throws(() => parseSkillsArgs(args));
  // Regression evidence runs once by default; measurements keep a repeat count.
  assert.equal(parseSkillsArgs([]).runs, "auto");
  assert.equal(parseSkillsArgs(["--runs", "2"]).runs, 2);
  // Routine regression targets a lower-cost model; a release check runs the default fresh.
  assert.equal(parseSkillsArgs([]).model, "sonnet");
  assert.equal(parseSkillsArgs(["--model", "opus"]).model, "opus");
  assert.equal(parseSkillsArgs(["--release"]).model, undefined);
  assert.equal(parseSkillsArgs(["--release"])["no-reuse"], true);
  assert.equal(parseSkillsArgs(["--runs", "2"]).model, undefined);
  assert.equal(parseSkillsArgs(["--suite", "execution", "--compare", "without-skill"]).runs, 3);
  assert.throws(() => parseSkillsArgs(["--runs", "2", "--confirm"]), /--confirm/);
  assert.throws(() => parseSkillsArgs(["--runs", "0"]), /auto or a positive integer/);
  assert.equal(parseSkillsArgs(["--compare", "both", "--baseline", "HEAD"]).compare, "both");
});

test("a broad review filter cannot opt into a separate real repository", async () => {
  let builds = 0;
  const item = {
    id: "review-real-repo-adr",
    type: "classification",
    title: "Explicit real-repository opt-in",
    semanticObligations: [
      { id: "scope", text: "Inspect only the explicitly selected local repository." },
    ],
    build: () => {
      builds++;
      return "Local probe";
    },
    score: noCall,
  };
  for (const only of ["review-", "review-real-repo-adr"]) {
    const result = await main(
      ["--prepare", "--suite", "classification", "--only", only, "--runs", "1", "--out", temp()],
      { cases: [item], target: noCall, judge: noCall },
    );
    assert.equal(result.status, 0);
    assert.equal(result.report.runs[0].verdict, "NOT_RUN");
    assert.equal(builds, only === item.id ? 1 : 0);
  }
});

test("preparation and regeneration never call a model and preserve captured JSON byte for byte", async () => {
  const out = temp();
  const result = await main(["--prepare", "--suite", "routing", "--runs", "1", "--out", out], {
    target: noCall,
    judge: noCall,
  });
  assert.equal(result.status, 0);
  assert.equal(result.report.runs.length, routingCases.length);
  assert.deepEqual(
    result.report.runs.map((r) => r.caseId).sort(),
    routingCases.map((c) => c.id).sort(),
  );
  assert.ok(result.report.runs.every((r) => r.verdict === "NOT_RUN"));
  assert.ok(existsSync(result.html));
  const before = readFileSync(path.join(out, "results.json"), "utf8");
  await main(["--report", out], { target: noCall, judge: noCall });
  await renderSavedReport(out);
  assert.equal(readFileSync(path.join(out, "results.json"), "utf8"), before);
  const html = readFileSync(result.html, "utf8");
  assert.match(html, /<svg/);
  assert.match(html, /실제 클라이언트/);
  assert.match(html, /미실행/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  const modelReason =
    "근거를 확인할 수 없습니다.\n- 누락된 값\n<script>alert('untrusted')</script>";
  result.report.runs[0].verdict = "NOT_PROVEN";
  result.report.runs[0].testResult = { metricsData: [{ reason: modelReason }] };
  writeFileSync(path.join(out, "results.json"), JSON.stringify(result.report));
  await renderSavedReport(out);
  assert.match(readFileSync(result.html, "utf8"), /&lt;script&gt;/);
  const generated = JSON.parse(readFileSync(path.join(out, "report.json"), "utf8"));
  const failedId = `case-${result.report.runs[0].caseId}`;
  const route = (nodes) => {
    for (const node of nodes) {
      if (node.id === failedId) return [node];
      const child = route(node.children ?? []);
      if (child) return [node, ...child];
    }
    return null;
  };
  assert.ok(
    route(generated.sections).every((node) => node.expanded),
    "failed evidence and every ancestor are open",
  );
  assert.equal(
    JSON.parse(readFileSync(path.join(out, "results.json"))).runs[0].testResult.metricsData[0]
      .reason,
    modelReason,
  );
  await assert.rejects(() => main(["--out", out]), /new or empty/);
});

test("version and no-skill preparation keep the same fixed fixture and verifier conditions", async () => {
  const item = cases.find((c) => c.id === "sync-encbird-turn-units");
  const result = await main(
    [
      "--prepare",
      "--suite",
      "execution",
      "--compare",
      "both",
      "--baseline",
      "HEAD",
      "--runs",
      "1",
      "--out",
      temp(),
    ],
    {
      cases: [{ ...item, type: "execution", group: item.skill }],
      target: noCall,
      judge: noCall,
    },
  );
  assert.equal(result.status, 0);
  assert.deepEqual(result.report.variants, ["candidate", "baseline", "without-skill"]);
  assert.equal(new Set(result.report.runs.map((r) => r.conditionHash)).size, 1);
  assert.equal(new Set(result.report.runs.map((r) => r.inputHash)).size, 1);
});

test("a semantic PASS cannot compensate for a failed mandatory final structure check", async () => {
  const item = cases.find((c) => c.id === "sync-encbird-turn-units");
  const file = Object.keys(item.build()).find((f) => /docs\/adr\/chat\/0001-/.test(f));
  const result = await main(["--live", "--suite", "execution", "--runs", "1", "--out", temp()], {
    cases: [{ ...item, type: "execution", group: item.skill }],
    target: async ({ cwd }) => {
      writeFileSync(path.join(cwd, file), "# Invalid document\n");
      return { text: "claimed complete", models: ["stub"], costUSD: 0 };
    },
    evaluate: async () => ({ verdict: "PASS", frameworkResult: { testResults: [] } }),
  });
  assert.equal(result.report.runs[0].verdict, "NOT_PROVEN");
  assert.ok(result.report.runs[0].checks.some((c) => !c.pass));
});

test("routing reads only shipped metadata before selection and preserves both error directions", async () => {
  let calls = 0;
  const chosen = routingCases.filter((c) => ["routing-sync", "routing-typo"].includes(c.id));
  const result = await main(["--live", "--suite", "routing", "--runs", "1", "--out", temp()], {
    cases: chosen,
    target: async ({ prompt, schema }) => {
      calls++;
      if (schema) {
        const metadata = JSON.parse(prompt.split("Catalog:\n")[1].split("\nRequest:")[0]);
        assert.ok(
          metadata.every((item) => Object.keys(item).sort().join(",") === "description,name"),
        );
        assert.doesNotMatch(prompt, /# adr-sync/);
        const selected = prompt.includes("'teh' 오타") ? ["adr-sync"] : ["adr-review"];
        return { text: "", structured: { selected }, models: ["target"], costUSD: null };
      }
      assert.match(prompt, /# adr-(sync|review)/);
      return { text: "Selected bodies read.", models: ["target"], costUSD: null };
    },
  });
  assert.equal(calls, 4);
  assert.equal(result.status, 0);
  assert.ok(result.report.runs.every((r) => r.verdict === "NOT_PROVEN"));
  const sync = result.report.runs.find((r) => r.caseId === "routing-sync");
  assert.equal(sync.routing.fn, 1);
  assert.equal(sync.routing.fp, 1);
  const invalid = await main(["--live", "--suite", "routing", "--runs", "1", "--out", temp()], {
    cases: [chosen[0]],
    target: async () => ({ structured: { selected: ["invented"] }, models: ["target"] }),
  });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.report.runs[0].verdict, "ERROR");
});

test("shared instruction changes select the appropriate suites and metadata comes from installed sources", async () => {
  const all = await catalog();
  const affected = selectImpacted(all, ["plugins/adr-writer/references/comprehension-load.md"]);
  assert.ok(affected.some((c) => c.id === "comprehension-load-score-only"));
  // Routing carries only shipped skill names, descriptions and selected bodies.
  assert.ok(!affected.some((c) => c.type === "routing"));
  assert.ok(affected.some((c) => c.type === "execution"));
  assert.ok(
    selectImpacted(all, ["plugins/adr-writer/skills/adr-new/SKILL.md"]).some(
      (c) => c.type === "routing",
    ),
  );
  assert.equal(selectImpacted(all, ["README.md"]).length, 0);
  assert.equal(selectImpacted(all, ["shared/report-writer/SKILL.md"]).length, all.length);
  for (const e of skillCatalog()) assert.ok(readFileSync(e.file, "utf8").includes(e.description));
  assert.throws(
    () => checkReferences("${CLAUDE_PLUGIN_ROOT}/references/missing.md", PLUGIN),
    /unavailable/,
  );
  assert.doesNotThrow(() => checkReferences("${CLAUDE_PLUGIN_ROOT}/agents/*.md", PLUGIN));
});

test("semantic classification uses the same DeepEval path without falling back to the legacy judge", async () => {
  const item = (await catalog()).find((c) => c.id === "alps-approval-digest-preserves-contract");
  let judgeCalls = 0;
  const result = await main(
    ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
    {
      cases: [{ ...item, score: noCall }],
      target: async () => ({
        text: "검증할 응답\n=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\nNONE\n=== EVAL-END ===",
        models: ["target-stub"],
        costUSD: 0,
      }),
      judge: async ({ schema }) => {
        judgeCalls++;
        assert.ok(schema.required.includes("obligations"));
        return {
          structured: {
            score: 0,
            reason: "테스트 응답이 계약을 입증하지 않음을 고정 판정합니다.",
            obligations: item.semanticObligations.map(({ id }) => ({
              id,
              verdict: "UNVERIFIED",
              reason: "응답에 해당 계약을 확인할 구체적인 근거가 없습니다.",
              evidence: [],
            })),
          },
          models: ["judge-stub"],
          costUSD: 0,
        };
      },
    },
  );
  assert.equal(judgeCalls, 1);
  assert.equal(result.report.runs[0].verdict, "NOT_PROVEN");
  assert.ok(result.report.runs[0].frameworkResult.testResults.length);
  assert.deepEqual(
    result.report.runs[0].calls.map((c) => c.stage),
    ["target", "judge"],
  );
});

test("execution ablation keeps task files and verifiers fixed, blocks guidance, and uses real DeepEval", async () => {
  const item = cases.find((c) => c.id === "sync-encbird-turn-units");
  const selected = { ...item, type: "execution", group: item.skill };
  const replies = [];
  const initial = [];
  let judgeCalls = 0;
  const result = await main(
    [
      "--live",
      "--suite",
      "execution",
      "--compare",
      "without-skill",
      "--runs",
      "1",
      "--out",
      temp(),
    ],
    {
      cases: [selected],
      target: async ({ prompt, cwd, config }) => {
        const args = JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args;
        const [, root, pluginRoot, logPath, turn, guidance, checkerRoot] = args;
        assert.equal(root, cwd);
        const tools = makeTools({
          root,
          pluginRoot,
          logPath,
          turn: Number(turn),
          guidance: guidance !== "off",
          checkerRoot,
        });
        initial.push(readFileSync(path.join(root, "docs/adr/concepts.md"), "utf8"));
        if (guidance === "off") {
          assert.doesNotMatch(prompt, /<shipped-skill>/);
          for (const [tool, input] of [
            ["read_file", { path: "plugin/skills/adr-sync/SKILL.md" }],
            ["read_file", { path: "plugin/references/reader-first-writing.md" }],
            ["list_files", { prefix: "plugin/" }],
          ])
            assert.throws(() => tools.call(tool, input), /unavailable/);
        } else {
          assert.match(prompt, /<shipped-skill>/);
          assert.match(
            tools.call("read_file", { path: "plugin/skills/adr-sync/SKILL.md" }),
            /adr-sync/,
          );
        }
        assert.throws(() => tools.call("read_file", { path: "../other-run/evidence.json" }));
        const text =
          guidance === "off"
            ? "STUB: outcome not established"
            : "STUB: controlled successful outcome";
        replies.push(text);
        return { text, models: ["target-stub"], costUSD: 0, ms: 1 };
      },
      judge: async ({ prompt, schema }) => {
        judgeCalls++;
        assert.ok(schema.required.includes("obligations"));
        const pass = prompt.includes("controlled successful outcome");
        const quote = pass
          ? "STUB: controlled successful outcome"
          : "STUB: outcome not established";
        return {
          text: "",
          structured: {
            score: pass ? 1 : 0,
            reason: "테스트용 모델 응답으로 실제 SDK와 의무별 증거 전달을 확인합니다.",
            obligations: item.obligations.map(({ id }) => ({
              id,
              verdict: pass ? "PASS" : "UNVERIFIED",
              reason: "테스트용 고정 판정",
              evidence: pass ? [{ source: "reply:1", quote }] : [],
            })),
          },
          models: ["judge-stub"],
          costUSD: 0,
          ms: 1,
        };
      },
    },
  );
  assert.equal(judgeCalls, 2);
  assert.equal(replies.length, 2);
  assert.equal(initial[0], initial[1]);
  assert.equal(result.status, 0);
  assert.equal(comparePairs(result.report.runs).differencePP, 100);
  assert.ok(result.report.runs.every((r) => r.frameworkResult?.testResults.length === 1));
  assert.equal(result.report.runs[0].conditionHash, result.report.runs[1].conditionHash);
  assert.ok(existsSync(path.join(result.output, result.report.runs[0].capture)));
});
