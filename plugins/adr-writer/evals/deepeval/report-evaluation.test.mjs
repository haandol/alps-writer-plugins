import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateEvidence } from "./engine.mjs";
import { reportEvaluationControls } from "./report-controls.mjs";
import { REPORT_OUTPUT } from "../skills/report-evaluation.mjs";
import { main } from "../skills/run.mjs";
import { catalog, PLUGIN } from "../skills/catalog.mjs";
import { makeTools } from "../regression/workspace.mjs";

const temp = () => mkdtempSync(path.join(os.tmpdir(), "report-eval-contract-"));
const quote = "Member and Order are classes";
const judgment = (item, source = `after:${REPORT_OUTPUT}`, failAxis) => ({
  score: failAxis ? 0 : 1,
  reason: "Controlled judge response tests evidence transport and aggregation.",
  obligations: (item.obligations ?? item.semanticObligations).map((o) => ({
    id: o.id,
    verdict: o.axis === failAxis ? "FAIL" : "PASS",
    reason: "Controlled obligation result with an exact source quote.",
    evidence: [{ source, quote }],
  })),
});

test("real GEval receives final content and retains validated per-obligation verdicts", async () => {
  const { item, evidence } = reportEvaluationControls.find((c) => c.id === "repaired-draft");
  const before = JSON.stringify(evidence);
  let calls = 0;
  const result = await evaluateEvidence({
    item,
    evidence,
    name: item.id,
    cwd: temp(),
    invoke: async ({ prompt }) => {
      calls++;
      assert.doesNotMatch(prompt, /Every query finishes within one second/);
      assert.match(prompt, /final-report-v1/);
      assert.match(prompt, /Member and Order are classes/);
      return { structured: judgment(item), models: ["stub-judge"], costUSD: 0 };
    },
  });
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(evidence), before);
  assert.equal(result.verdict, "PASS", result.error);
  assert.equal(result.obligationJudgments.length, item.obligations.length);
  assert.ok(result.obligationJudgments.every((o) => o.verdict === "PASS"));
});

test("real GEval validates decoded JSON-field citations without weakening exact quotation checks", async () => {
  const { item, evidence } = reportEvaluationControls.find((c) => c.id === "quoted-diagram");
  for (const exact of [true, false]) {
    let calls = 0;
    const result = await evaluateEvidence({
      item,
      evidence,
      name: `decoded-${exact}`,
      cwd: temp(),
      invoke: async ({ prompt }) => {
        calls++;
        assert.match(prompt, /finalReportFields/);
        const raw = judgment(item, `after:${REPORT_OUTPUT}#/sections/0/diagram/source`);
        for (const o of raw.obligations)
          o.evidence[0].quote = exact ? 'A["Upload"]' : "invented arrow";
        return { structured: raw, models: ["stub-judge"], costUSD: 0 };
      },
    });
    assert.equal(result.verdict, exact ? "PASS" : "ERROR", result.error);
    assert.equal(calls, exact ? 1 : 2);
  }
});

test("stale report citations cannot pass, even after the one permitted citation repair", async () => {
  const { item, evidence } = reportEvaluationControls.find((c) => c.id === "repaired-draft");
  for (const staleSource of ["event:2:after", "reply:1"]) {
    let calls = 0;
    const result = await evaluateEvidence({
      item,
      evidence,
      name: staleSource,
      cwd: temp(),
      invoke: async () => {
        calls++;
        const raw = judgment(item, staleSource);
        if (staleSource === "reply:1")
          for (const o of raw.obligations) o.evidence[0].quote = "Saved the final report";
        return { structured: raw, models: ["stub-judge"], costUSD: 0 };
      },
    });
    assert.equal(calls, 2);
    assert.equal(result.verdict, "ERROR");
    assert.equal(result.obligationJudgments, undefined);
  }
});

test("a factual failure stays overall NOT_PROVEN while terminology remains separately PASS", async () => {
  const { item, evidence } = reportEvaluationControls.find((c) => c.id === "invented-timing");
  const result = await evaluateEvidence({
    item,
    evidence,
    name: item.id,
    cwd: temp(),
    invoke: async () => ({
      structured: judgment(item, `after:${REPORT_OUTPUT}`, "source"),
      models: ["stub-judge"],
      costUSD: 0,
    }),
  });
  assert.equal(result.verdict, "NOT_PROVEN");
  assert.equal(result.obligationJudgments.find((o) => o.id === "terminology").verdict, "PASS");
  assert.equal(result.obligationJudgments.find((o) => o.id === "source").verdict, "FAIL");
});

test("report self-repair uses the final snapshot; forbidden source attempts still fail local gates", async () => {
  const item = (await catalog()).find((c) => c.id === "report-terminology-source-hierarchy");
  const control = reportEvaluationControls.find((c) => c.id === "repaired-draft");
  for (const forbidden of [false, true]) {
    const result = await main(
      ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
      {
        cases: [item],
        target: async ({ cwd }) => {
          const tools = makeTools({
            root: cwd,
            pluginRoot: PLUGIN,
            logPath: path.join(cwd, "..", "events.jsonl"),
            turn: 1,
            artifactPaths: item.artifactPaths,
          });
          for (const file of [
            "source.md",
            "plugin/skills/report-writer/SKILL.md",
            "plugin/skills/report-writer/references/report-document.md",
          ])
            tools.call("read_file", { path: file });
          tools.call("write_file", {
            path: REPORT_OUTPUT,
            content: control.evidence.events[0].arguments.content,
          });
          if (forbidden) {
            try {
              tools.call("write_file", {
                path: "source.md",
                content: "Unauthorized source mutation",
              });
            } catch {
              /* keep the failed attempt */
            }
          }
          tools.call("write_file", {
            path: REPORT_OUTPUT,
            content: control.evidence.after[REPORT_OUTPUT],
          });
          return {
            text: "Saved.\n=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\nNONE\n=== EVAL-END ===",
            models: ["stub-target"],
            costUSD: 0,
          };
        },
        judge: async ({ prompt }) => {
          assert.doesNotMatch(prompt, /Every query finishes within one second/);
          if (forbidden) assert.match(prompt, /Unauthorized source mutation/);
          return { structured: judgment(item), models: ["stub-judge"], costUSD: 0 };
        },
      },
    );
    const run = result.report.runs[0];
    assert.equal(run.verdict, forbidden ? "NOT_PROVEN" : "PASS", run.error);
    const folder = path.join(result.output, run.artifactDirectory);
    const raw = readFileSync(path.join(folder, "evidence.json"), "utf8");
    assert.match(raw, /Every query finishes within one second/);
    const judged = JSON.parse(readFileSync(path.join(folder, "test-case.json"), "utf8"));
    assert.doesNotMatch(judged.actualOutput, /Every query finishes within one second/);
    assert.ok(run.obligationJudgments.every((o) => o.verdict === "PASS"));
    if (forbidden)
      assert.ok(
        run.checks.some((c) => !c.pass && c.label === "no out-of-scope mutation attempted"),
      );
  }
});
