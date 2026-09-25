import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { main, parseSkillsArgs, selectImpacted } from "../skills/run.mjs";
import { catalog, skillCatalog, checkReferences, PLUGIN } from "../skills/catalog.mjs";
import { routingCases } from "../skills/catalog.mjs";
import { comparePairs } from "../skills/metrics.mjs";
import { makeTools } from "../regression/workspace.mjs";
import { cases } from "../regression/cases.mjs";
import { renderSavedReport } from "./render-report.mjs";

const temp = () => mkdtempSync(path.join(tmpdir(), "skill-eval-system-"));
const noCall = () => {
  throw new Error("A free operation called a model");
};

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
  assert.equal(parseSkillsArgs([]).runs, 3);
  assert.equal(parseSkillsArgs(["--compare", "both", "--baseline", "HEAD"]).compare, "both");
});

test("a broad review filter cannot opt into a separate real repository", async () => {
  let builds = 0;
  const item = {
    id: "review-real-repo-adr",
    type: "classification",
    title: "Explicit real-repository opt-in",
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
  assert.equal(result.report.runs.length, 8);
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
  const chosen = routingCases.filter((c) => ["routing-sync", "routing-arithmetic"].includes(c.id));
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
        const selected = prompt.includes("17 더하기") ? ["adr-sync"] : ["adr-review"];
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
  assert.ok(affected.some((c) => c.type === "routing"));
  assert.ok(affected.some((c) => c.type === "execution"));
  assert.equal(selectImpacted(all, ["README.md"]).length, 0);
  assert.equal(selectImpacted(all, ["shared/report-write/SKILL.md"]).length, all.length);
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
