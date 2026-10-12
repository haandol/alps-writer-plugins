import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  reportJudgingEvidence,
  summarizeReportAxes,
  validateReportJudgment,
  REPORT_OUTPUT,
  finalReportSources,
} from "../evals/skills/report-evaluation.mjs";
import { reportEvaluationControls } from "../evals/deepeval/report-controls.mjs";
import { evidenceSources, validateJudgment } from "../evals/regression/judge.mjs";
import { deepEvalInput } from "../evals/deepeval/input.mjs";
import { validateReport } from "../skills/report-writer/scripts/render-report.mjs";
import { saveSkillsReport } from "../evals/skills/report.mjs";

const get = (id) => reportEvaluationControls.find((c) => c.id === id);
test("decoded final fields retain exact quotes, newlines and JSON-pointer provenance", () => {
  const { item, evidence } = get("quoted-diagram");
  const original = JSON.stringify(evidence);
  const fields = finalReportSources(item, evidence);
  const id = `after:${REPORT_OUTPUT}#/sections/0/diagram/source`;
  const diagram = JSON.parse(evidence.after[REPORT_OUTPUT]).sections[0].diagram.source;
  assert.equal(fields[id], diagram);
  assert.match(fields[id], /A\["Upload"\]/);
  assert.equal(
    JSON.parse(deepEvalInput(item, evidence).actualOutput).finalReportFields[id],
    diagram,
  );
  const obligation = item.obligations.find((o) => o.axis === "diagrams");
  const judgment = {
    obligations: [
      {
        id: obligation.id,
        verdict: "PASS",
        reason: "Exact decoded field is valid evidence.",
        evidence: [{ source: id, quote: 'A["Upload"]' }],
      },
    ],
  };
  assert.doesNotThrow(() => validateJudgment(judgment, [obligation], fields));
  assert.doesNotThrow(() => validateReportJudgment(item, judgment));
  judgment.obligations[0].evidence[0].source = `after:${REPORT_OUTPUT}#/missing`;
  assert.throws(() => validateJudgment(judgment, [obligation], fields), {
    code: "UNSUPPORTED_EVIDENCE",
  });
  const unusual = { ...evidence, after: { [REPORT_OUTPUT]: '{"a~/b":"unchanged text"}' } };
  assert.equal(
    finalReportSources(item, unusual)[`after:${REPORT_OUTPUT}#/a~0~1b`],
    "unchanged text",
  );
  assert.deepEqual(
    finalReportSources(item, { ...evidence, after: { [REPORT_OUTPUT]: "invalid JSON" } }),
    {},
  );
  assert.equal(JSON.stringify(evidence), original);
});
test("final report view removes draft bodies while preserving raw records and unauthorized restores", () => {
  for (const id of ["repaired-draft", "incorrect-final", "source-write-restored"]) {
    const { item, evidence } = get(id);
    const raw = JSON.stringify(evidence);
    const view = reportJudgingEvidence(item, evidence);
    assert.equal(JSON.stringify(evidence), raw);
    assert.deepEqual(view.after, evidence.after);
    assert.equal(view.events.length, evidence.events.length);
    assert.equal(
      view.events.filter((e) => e.kind === "request").length,
      evidence.events.filter((e) => e.kind === "request").length,
    );
    assert.deepEqual(JSON.parse(deepEvalInput(item, evidence).actualOutput).events, view.events);
    const sources = evidenceSources(view);
    if (id === "repaired-draft") {
      assert.doesNotMatch(JSON.stringify(view), /Every query finishes within one second/);
      assert.match(raw, /Every query finishes within one second/);
      assert.equal(sources["event:2:after"], undefined);
    }
    if (id === "incorrect-final")
      assert.match(view.after[REPORT_OUTPUT], /Every query finishes within one second/);
    if (id === "source-write-restored") {
      assert.match(sources["event:1:content"], /Unauthorized source replacement/);
      assert.equal(sources["event:4:after"], evidence.before["source.md"]);
    }
    const ordinary = { ...item, reportEvaluation: undefined };
    assert.equal(reportJudgingEvidence(ordinary, evidence), evidence);
    assert.deepEqual(
      JSON.parse(deepEvalInput(ordinary, evidence).actualOutput).events,
      evidence.events,
    );
  }
});

test("report content citations require final-file evidence while action citations remain available", () => {
  const { item } = get("repaired-draft");
  const judgment = (id, sources) => ({
    obligations: [
      { id, verdict: "PASS", evidence: sources.map((source) => ({ source, quote: "example" })) },
    ],
  });
  assert.doesNotThrow(() =>
    validateReportJudgment(
      item,
      judgment("source", [`after:${REPORT_OUTPUT}`, "before:source.md"]),
    ),
  );
  for (const sources of [
    ["reply:1"],
    ["event:2:after"],
    ["before:source.md"],
    [`after:${REPORT_OUTPUT}`, "reply:1"],
  ])
    assert.throws(() => validateReportJudgment(item, judgment("source", sources)), {
      code: "UNSUPPORTED_EVIDENCE",
    });
  assert.doesNotThrow(() => validateReportJudgment(item, judgment("delivery", ["event:1"])));
});

test("axis counts preserve partial success, uncertainty, errors and missing legacy judgments", () => {
  const { item } = get("ordinary-definitions");
  const judgments = item.obligations.map((o) => ({
    id: o.id,
    verdict: o.axis === "source" ? "FAIL" : "PASS",
  }));
  const runs = [
    { verdict: "NOT_PROVEN", obligationJudgments: judgments },
    {
      verdict: "NOT_PROVEN",
      obligationJudgments: judgments.map((o) => ({
        ...o,
        verdict: o.id === "source" ? "UNVERIFIED" : o.verdict,
      })),
    },
    { verdict: "ERROR", obligationJudgments: judgments },
    { verdict: "NOT_RUN" },
    { verdict: "PASS" },
  ];
  const axes = summarizeReportAxes(item, runs);
  assert.deepEqual(axes.find((a) => a.axis === "source").counts, {
    PASS: 0,
    FAIL: 1,
    UNVERIFIED: 1,
    ERROR: 1,
    NOT_RUN: 1,
    MISSING: 1,
  });
  assert.equal(axes.find((a) => a.axis === "terminology").counts.PASS, 2);
  assert.equal(runs[0].verdict, "NOT_PROVEN");
  assert.deepEqual(summarizeReportAxes({ ...item, reportEvaluation: undefined }, runs), []);
});

test("authored positive and negative controls retain valid files and explicit draft label provenance", () => {
  for (const control of reportEvaluationControls) {
    assert.equal(control.labelStatus, "ai-draft");
    assert.doesNotThrow(() => validateReport(JSON.parse(control.evidence.after[REPORT_OUTPUT])));
    assert.doesNotThrow(() => deepEvalInput(control.item, control.evidence));
  }
});

test("saved result rendering displays independent axes without rewriting original scores", () => {
  const { item } = get("ordinary-definitions");
  const record = {
    caseId: item.id,
    type: "classification",
    variant: "candidate",
    repeat: 1,
    verdict: "NOT_PROVEN",
    calls: [],
    obligationJudgments: item.obligations.map((o) => ({
      id: o.id,
      verdict: o.axis === "source" ? "FAIL" : "PASS",
    })),
  };
  const report = {
    schemaVersion: 1,
    framework: "skill-evals",
    generatedAt: "2026-10-12T00:00:00Z",
    runsPerCase: 1,
    variants: ["candidate"],
    selection: {},
    runtime: {},
    datasetHash: "control",
    cases: [
      {
        ...item,
        id: "report-terminology-test",
        title: "Axis control",
        semanticObligations: item.obligations,
      },
    ],
    runs: [{ ...record, caseId: "report-terminology-test" }],
  };
  const unchanged = JSON.stringify(report);
  const dir = mkdtempSync(path.join(os.tmpdir(), "report-axis-"));
  try {
    saveSkillsReport(dir, report);
    assert.equal(JSON.stringify(report), unchanged);
    const html = readFileSync(path.join(dir, "index.html"), "utf8");
    assert.match(html, /용어 일관성: 통과 1회/);
    assert.match(html, /출처 충실성: 통과 0회, 위반 1회/);
    assert.match(html, /미충족·미검증 1회/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
