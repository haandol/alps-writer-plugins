import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { catalog, PLUGIN } from "../skills/catalog.mjs";
import { main, parseSkillsArgs, selectImpacted } from "../skills/run.mjs";
import { makeTools } from "../regression/workspace.mjs";
import { responseObligations } from "../skills/response-contract.mjs";
import { parseTail } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

test("response scope checks allow requested reads but reject mutation attempts and missing fields", () => {
  const tail = {
    findings: [
      {
        tag: "DECISION_REQUEST",
        summary: "gap=terminal failure; recommendation=DLQ; basis=durability",
      },
    ],
  };
  const fields = { DECISION_REQUEST: ["gap", "recommendation", "basis"] };
  const read = [{ kind: "request", tool: "read_file", arguments: { path: "docs/source.md" } }];
  assert.ok(
    responseChecks({ tail, events: read }, fields, { noTools: false }).every((c) => c.pass),
  );
  assert.ok(responseChecks({ tail, events: read }, fields).some((c) => !c.pass));
  assert.ok(
    responseChecks({ tail, events: [{ kind: "request", tool: "write_file" }] }, fields, {
      noTools: false,
    }).some((c) => !c.pass),
  );
  assert.ok(
    responseChecks({ tail, events: [] }, { DECISION_REQUEST: ["adrPatch"] }).some((c) => !c.pass),
  );
});

test("the English article a in request B is not mistaken for request A", async () => {
  const item = (await catalog()).find((c) => c.id === "hook-admission-routing");
  const output =
    "=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\nEXEMPT | Request A: SDK and credential adapter change\nADR_FIRST | Request B: quota 5 to 3 per month is a requirement change\n=== EVAL-END ===";
  assert.ok(item.score({ output, tail: parseTail(output) }).every((c) => c.pass));
  const wrong = output.replace("EXEMPT | Request A", "ADR_FIRST | Request A");
  assert.ok(item.score({ output: wrong, tail: parseTail(wrong) }).some((c) => !c.pass));
});

test("live paraphrases retain exact artifact gates while prose is judged semantically", async () => {
  const items = await catalog();
  const split = items.find((c) => c.id === "alps-high-load-suggests-feature-split");
  const reply =
    "분할은 권고이며 승인과 저장을 막지 않습니다. 원본 유지도 가능합니다.\n=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\nFEATURE_SCORE | 9/10\nSPLIT_CANDIDATE | invitation\nSPLIT_CANDIDATE | role change\nKEEP_ORIGINAL | keep the original\nNON_BLOCKING | the score does not block approval or saving\n=== EVAL-END ===";
  assert.ok(split.score({ tail: parseTail(reply), output: reply }).every((c) => c.pass));
  assert.ok(
    split
      .score({
        tail: parseTail(reply.replace("FEATURE_SCORE | 9/10", "FEATURE_SCORE | 0/10")),
        output: reply,
      })
      .some((c) => !c.pass),
  );
  assert.ok(split.semanticObligations.some((o) => o.id === "choice"));
  const author = items.find((c) => c.id === "author-rejects-implementation-detail");
  const dir = temp();
  await author.build(dir);
  assert.ok(author.score({ dir }).every((c) => c.pass));
  writeFileSync(path.join(dir, "docs/adr/0001-unwanted.md"), "Unrequested SDK ADR");
  assert.ok(author.score({ dir }).some((c) => !c.pass));
});

test("score-only parsing accepts labeled parentheses without hiding a visible/tail mismatch", async () => {
  const item = (await catalog()).find((c) => c.id === "comprehension-load-score-only");
  const output =
    "A (ALPS Feature) — Comprehension load: 1/10\nB (ADR) — Comprehension load: 9/10\n=== EVAL-VERDICT: scored ===\n=== EVAL-FINDINGS ===\nFEATURE_SCORE | 1/10\nADR_SCORE | 9/10\n=== EVAL-END ===";
  assert.ok(item.score({ output, tail: parseTail(output) }).every((c) => c.pass));
  const wrong = output.replace(
    "B (ADR) — Comprehension load: 9/10",
    "B (ADR) — Comprehension load: 2/10",
  );
  assert.ok(item.score({ output: wrong, tail: parseTail(wrong) }).some((c) => !c.pass));
});

const temp = () => mkdtempSync(path.join(tmpdir(), "deepeval-response-"));
const tail = "\n=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\nNONE\n=== EVAL-END ===";
const noCall = () => {
  throw new Error("Unexpected model call");
};

test("explicit target profile needs a region and model and remains separate from the judge", () => {
  for (const args of [
    ["--target-profile", "default"],
    ["--target-region", "us-east-1"],
    ["--target-profile", "default", "--target-region", "us-east-1"],
  ])
    assert.throws(() => parseSkillsArgs(args), /Explicit Bedrock target requires/);
  const options = parseSkillsArgs([
    "--target-profile",
    "target",
    "--target-region",
    "us-west-2",
    "--model",
    "target-model",
  ]);
  assert.deepEqual(options.targetBedrock, { profile: "target", region: "us-west-2" });
  assert.equal(options.judge.profile, "default");
  assert.equal(options.judge.region, "us-east-1");
});

/** Deterministic provider responses exercise the real SDK, not live model accuracy. */
function judge(item, score, quote) {
  const reason = "고정된 테스트 판정으로 DeepEval과 근거 검증의 연결을 확인합니다.";
  return {
    structured: {
      score,
      reason,
      obligations: item.semanticObligations.map(({ id }) => ({
        id,
        verdict: score ? "PASS" : "FAIL",
        reason,
        evidence: [{ source: "reply:1", quote }],
      })),
    },
    models: ["judge-stub"],
    costUSD: 0,
  };
}

test("every shipped classification probe has a fixed GEval contract and prepares without inference", async () => {
  const items = (await catalog()).filter((c) => c.type === "classification");
  for (const item of items) assert.ok(item.semanticObligations?.length, item.id);
  for (const changed of ["deepeval/engine.mjs", "regression/judge.mjs", "lib/harness.mjs"]) {
    const affected = selectImpacted(items, [`plugins/adr-writer/evals/${changed}`]);
    assert.deepEqual(
      affected.map((c) => c.id),
      items.map((c) => c.id),
    );
  }
  assert.throws(() => responseObligations({ name: "empty" }), /Missing authored/);
  const selected = items.filter((c) => c.skill === "report-writer");
  assert.deepEqual(selected.map((c) => c.id).sort(), [
    "report-drilldown-comparison",
    "report-drilldown-distinguishes-shallow",
    "report-drilldown-incident",
    "report-drilldown-opening-purpose",
    "report-preserves-evaluation-evidence",
    "report-rejects-unsupported-success",
    "report-scope-ambiguous",
    "report-scope-chat-override",
    "report-scope-complex-flow",
    "report-scope-explicit-short-report",
    "report-scope-known-choice",
    "report-scope-local-review",
    "report-scope-required-artifact",
    "report-scope-simple-definition",
  ]);
  const result = await main(
    ["--prepare", "--suite", "classification", "--runs", "1", "--out", temp()],
    {
      cases: selected,
      target: noCall,
      judge: noCall,
    },
  );
  assert.equal(result.status, 0);
  assert.ok(result.report.runs.every((r) => r.verdict === "NOT_RUN" && !r.calls.length));
  for (const run of result.report.runs) {
    const input = JSON.parse(
      readFileSync(path.join(result.output, run.artifactDirectory, "input.json")),
    );
    assert.match(input.prompt, /# Report writing/);
    if (run.caseId.startsWith("report-scope-")) {
      assert.match(input.prompt, /\[Report-writing directive\]/);
      assert.doesNotMatch(input.prompt, /Total provider-reported cost: USD 0.48/);
      const item = selected.find((c) => c.id === run.caseId);
      assert.ok(!input.prompt.includes(item.semanticObligations[0].text));
    } else assert.match(input.prompt, /# Editorial review/);
    if (run.caseId.startsWith("report-drilldown-")) {
      assert.doesNotMatch(input.prompt, /Total provider-reported cost: USD 0.48/);
      assert.match(input.prompt, /Supplied hypothetical (comparison|incident)/);
      if (run.caseId === "report-drilldown-distinguishes-shallow") {
        assert.match(input.prompt, /Excerpt A:/);
        assert.match(input.prompt, /Excerpt B:/);
      }
    } else if (!run.caseId.startsWith("report-scope-")) assert.match(input.prompt, /USD 0.48/);
    assert.doesNotMatch(input.prompt, /"semanticObligations"|"supplementalChecks"/);
  }
});

test("GEval rejects keyword-only success, local failure cannot be averaged away, and judge errors stay errors", async () => {
  const item = (await catalog()).find(
    (c) => c.id === "lite-alps-proposes-solution-from-business-impact",
  );
  const reply =
    "Solution Strategy. Essential User Experiences. 해외 출장. 승인. 완료했다고 주장합니다." + tail;
  for (const [localPass, semantic, expected] of [
    [true, 0, "NOT_PROVEN"],
    [false, 1, "NOT_PROVEN"],
    [true, 1, "PASS"],
    [true, "error", "ERROR"],
  ]) {
    let calls = 0;
    const result = await main(
      ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
      {
        cases: [
          {
            ...item,
            score: () => [
              { pass: localPass, label: "required local check", detail: "fixture check" },
            ],
          },
        ],
        target: async () => ({ text: reply, models: ["target-stub"], costUSD: 0 }),
        judge: async ({ prompt, schema }) => {
          calls++;
          assert.ok(prompt.includes(item.semanticObligations[0].text));
          assert.ok(schema.required.includes("obligations"));
          assert.doesNotMatch(prompt, /required local check|fixture check/);
          if (semantic === "error") throw new Error("Stub judge unavailable");
          return judge(item, semantic, "완료했다고 주장합니다.");
        },
      },
    );
    const run = result.report.runs[0];
    assert.equal(run.verdict, expected);
    assert.equal(calls, 1, "no duplicate legacy judge or generated evaluation steps");
    assert.equal(run.checks[0].pass, localPass);
    if (semantic !== "error") {
      assert.equal(run.testResult.metricsData[0].name, "Skill response contract [GEval]");
      assert.equal(run.testResult.metricsData[0].score, semantic);
    }
    const saved = JSON.parse(
      readFileSync(path.join(result.output, run.artifactDirectory, "test-case.json")),
    );
    assert.equal(JSON.parse(saved.expectedOutput).obligations[0].id, "scenario-behavior");
  }
});

test("intent probes keep record correctness and semantic evidence as independent gates", async () => {
  const probes = (await catalog()).filter((item) => item.id.startsWith("impl-uses-intent-"));
  assert.deepEqual(probes.map((item) => item.id).sort(), [
    "impl-uses-intent-for-file-lookup",
    "impl-uses-intent-to-bound-discretion",
    "impl-uses-intent-with-safe-alternatives",
  ]);
  const prepared = await main(
    ["--prepare", "--suite", "classification", "--runs", "1", "--out", temp()],
    { cases: probes, target: noCall, judge: noCall },
  );
  assert.equal(prepared.status, 0);
  assert.equal(prepared.report.runs.length, probes.length);
  assert.ok(prepared.report.runs.every((run) => run.verdict === "NOT_RUN" && !run.calls.length));
  const item = probes.find((entry) => entry.id === "impl-uses-intent-to-bound-discretion");
  const inconsistent = "검토 편의를 위해 수정을 자동 적용하고 삭제 시점도 정하겠습니다.";
  const consistent = "중요한 위험부터 보여주되 수정은 하지 않고, 삭제 정책만 확인하겠습니다.";
  for (const [choice, prose, semantic, expected] of [
    ["IMPACT_FIRST", inconsistent, 0, "NOT_PROVEN"],
    ["ALPHABETICAL", consistent, 1, "NOT_PROVEN"],
    ["IMPACT_FIRST", consistent, 1, "PASS"],
  ]) {
    const reply = `${prose}
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
A | choice=${choice}; basis=중요한 위험을 먼저 확인; question=none
B | choice=KEEP_REVIEW_ONLY; basis=수정 권한 없음; question=none
C | choice=ASK_RETENTION; basis=정책 미정; question=어떤 보고서를 언제 삭제할까요?
=== EVAL-END ===`;
    const localPass = item
      .score({ output: reply, tail: parseTail(reply), events: [] })
      .every((check) => check.pass);
    assert.equal(localPass, choice === "IMPACT_FIRST");
    let judgeCalls = 0;
    const result = await main(
      ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
      {
        cases: [item],
        target: async () => ({ text: reply, models: ["target-stub"], costUSD: 0 }),
        judge: async ({ prompt }) => {
          judgeCalls++;
          assert.ok(prompt.includes(prose));
          assert.ok(
            prompt.includes(item.semanticObligations.find((o) => o.id === "evidence").text),
          );
          return judge(item, semantic, prose);
        },
      },
    );
    assert.equal(result.report.runs[0].verdict, expected);
    assert.equal(judgeCalls, 1);
    assert.equal(
      result.report.runs[0].testResult.metricsData[0].name,
      "Skill response contract [GEval]",
    );
  }
});

test("semantic input retains transient writes and excludes files materialized by the scorer", async () => {
  const item = (await catalog()).find(
    (c) => c.id === "lite-alps-proposes-solution-from-business-impact",
  );
  const reply = "파일은 변경하지 않았습니다." + tail;
  const result = await main(
    ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
    {
      cases: [
        {
          ...item,
          score: ({ dir }) => {
            writeFileSync(path.join(dir, "docs/scorer-created.md"), "scorer-only materialization");
            return [{ pass: true, label: "local checker", detail: "pass" }];
          },
        },
      ],
      target: async ({ cwd }) => {
        const tools = makeTools({
          root: cwd,
          pluginRoot: PLUGIN,
          logPath: path.join(cwd, "../events.jsonl"),
          turn: 1,
        });
        tools.call("write_file", { path: "docs/transient.md", content: "unapproved content" });
        tools.call("delete_file", { path: "docs/transient.md" });
        return { text: reply, models: ["target-stub"], costUSD: 0 };
      },
      judge: async ({ prompt }) => {
        assert.match(prompt, /unapproved content/);
        assert.match(prompt, /Mutating requests: 2/);
        assert.doesNotMatch(prompt, /scorer-only materialization/);
        return judge(item, 0, "파일은 변경하지 않았습니다.");
      },
    },
  );
  assert.equal(result.report.runs[0].verdict, "NOT_PROVEN");
  const folder = path.join(result.output, result.report.runs[0].artifactDirectory);
  const captured = JSON.parse(readFileSync(path.join(folder, "judge-input-evidence.json")));
  assert.deepEqual(captured.before, captured.after);
  assert.equal(captured.events.filter((e) => e.kind === "request").length, 2);
  assert.ok(!("docs/scorer-created.md" in captured.after));
});

test("report-writing and review rubrics use one real GEval judgment each without a legacy score", async () => {
  const items = (await catalog()).filter((c) => c.skill === "report-writer");
  for (const item of items) {
    const reply =
      "10회 요청 중 8회 완료, 6회 성공, 2회 실패와 2회 오류입니다. 완료 기준 75%이며 비용은 USD 0.48입니다. 운영 검증과 스킬 효과 비교는 하지 않았습니다." +
      tail;
    let calls = 0;
    const result = await main(
      ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
      {
        cases: [{ ...item, score: noCall }],
        target: async () => ({ text: reply, models: ["target-stub"], costUSD: 0 }),
        judge: async () => {
          calls++;
          return judge(item, 1, "완료 기준 75%이며 비용은 USD 0.48입니다.");
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.report.runs[0].verdict, "PASS");
  }
});
