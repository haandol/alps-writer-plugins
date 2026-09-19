import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calibrationCases,
  calibrationDefinition,
  buildCalibrationEvidence,
} from "./calibration-set.mjs";
import { deepEvalInput } from "./engine.mjs";
import { parseCalibrationArgs, summarizeCalibration } from "./calibrate.mjs";
import { renderCalibrationReport } from "./calibration-report.mjs";
import { CASE_CODES, coverageFor } from "./coverage.mjs";
import { cases } from "../regression/cases.mjs";
import { renderGoldenReport } from "./golden-report.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("all calibration labels are explicit unreviewed drafts with valid primary obligations", () => {
  assert.equal(calibrationCases.length, 21);
  assert.equal(new Set(calibrationCases.map((c) => c.id)).size, 21);
  assert.ok(calibrationCases.every((c) => c.labelStatus === "needs-human-review"));
  for (const split of ["development", "holdout"]) {
    const selected = calibrationCases.filter((c) => c.split === split);
    assert.ok(selected.some((c) => c.expectedScore === 1));
    assert.ok(selected.some((c) => c.expectedScore === 0));
  }
  for (const entry of calibrationCases) {
    const { item } = calibrationDefinition(entry);
    assert.ok([0, 1].includes(entry.expectedScore));
    assert.ok(
      entry.expectedScore === 1 || item.obligations.some((o) => o.id === entry.targetObligation),
    );
  }
});

test("control evidence is complete and changed outputs or first-turn timing survive grading input", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "calibration-corpus-"));
  const prepared = new Map();
  try {
    for (const entry of calibrationCases) {
      const folder = path.join(directory, entry.id);
      mkdirSync(folder);
      const evidence = buildCalibrationEvidence(entry, folder, PLUGIN);
      const { item } = calibrationDefinition(entry);
      const input = deepEvalInput(item, {
        ...evidence,
        labelSecret: "DO_NOT_SEND_LABEL",
        expectedScore: entry.expectedScore,
      });
      assert.doesNotMatch(
        JSON.stringify(input),
        /DO_NOT_SEND_LABEL|needs-human-review|contract-derived authored example/,
      );
      assert.deepEqual(JSON.parse(input.expectedOutput), { obligations: item.obligations });
      assert.equal(evidence.replies.length, item.turns.length);
      for (const event of evidence.events.filter(
        (e) => e.kind === "result" && e.tool === "run_check",
      ))
        assert.equal(
          event.result.exitCode,
          0,
          `${entry.id}: reference fixture must remain mechanically valid`,
        );
      prepared.set(entry.id, evidence);
    }
    const normal = prepared.get("rollup-approved");
    const early = prepared.get("rollup-before-approval");
    const wrong = prepared.get("rollup-wrong-first-plan");
    assert.deepEqual(early.after, normal.after);
    assert.deepEqual(wrong.after, normal.after);
    assert.notEqual(wrong.replies[0], normal.replies[0]);
    assert.equal(wrong.replies[1], normal.replies[1]);
    assert.ok(early.events.some((e) => e.tool === "write_file" && e.turn === 1));
    assert.ok(!normal.events.some((e) => e.tool === "write_file" && e.turn === 1));
    const correctPriceHistory = prepared.get("price-history-preserved");
    const inventedPriceHistory = prepared.get("price-history-invented");
    assert.deepEqual(inventedPriceHistory.before, correctPriceHistory.before);
    assert.deepEqual(inventedPriceHistory.replies, correctPriceHistory.replies);
    assert.deepEqual(
      Object.keys(inventedPriceHistory.after).filter(
        (file) => inventedPriceHistory.after[file] !== correctPriceHistory.after[file],
      ),
      ["docs/adr/token/decision-log.md"],
    );
    assert.match(
      correctPriceHistory.before["docs/adr/token/0001-project-pricing.md"],
      /최초 실제 차감량을 환불/,
    );
    assert.match(
      inventedPriceHistory.after["docs/adr/token/decision-log.md"],
      /환불 기준을 "현재 가격"에서/,
    );
    const reference = prepared.get("retention-complete").after;
    for (const name of [
      "retention-loses-metadata",
      "retention-loses-size-boundary",
      "retention-wrong-30-days",
      "retention-wrong-90-days",
      "retention-allows-archive",
    ]) {
      const after = prepared.get(name).after;
      const changed = Object.keys(after).filter((key) => after[key] !== reference[key]);
      assert.deepEqual(changed, ["docs/adr/storage/0001-asset-retention.md"]);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("calibration distinguishes false accepts, false rejects and errors without inventing human labels", () => {
  const runs = [
    { expectedScore: 0, actualScore: 1, verdict: "PASS", labelStatus: "needs-human-review" },
    { expectedScore: 1, actualScore: 0, verdict: "NOT_PROVEN", labelStatus: "needs-human-review" },
    { expectedScore: 1, actualScore: 1, verdict: "PASS", labelStatus: "needs-human-review" },
    { expectedScore: 1, actualScore: 1, verdict: "ERROR", labelStatus: "needs-human-review" },
    { expectedScore: 0, actualScore: null, verdict: "NOT_RUN", labelStatus: "needs-human-review" },
  ];
  assert.deepEqual(summarizeCalibration(runs), {
    requested: 5,
    scored: 3,
    matched: 1,
    falseAcceptances: 1,
    falseRejections: 1,
    errors: 1,
    notRun: 1,
    humanReviewed: 0,
  });
  assert.equal(parseCalibrationArgs(["--split", "holdout", "--live"]).split, "holdout");
  assert.throws(() => parseCalibrationArgs(["--split", "unknown"]), /Invalid/);
  assert.throws(() => parseCalibrationArgs(["--model", "target"]), /authored evidence/);
  const html = renderCalibrationReport({
    summary: summarizeCalibration(runs),
    judge: { model: "<script>bad()</script>", profile: "default", region: "us-east-1" },
    diagram: { svg: "<svg></svg>", source: "flowchart TD\n A-->B" },
    runs: [],
    definitions: [],
  });
  assert.doesNotMatch(html, /<script>bad/);
  assert.match(html, /사람이 검수한 라벨이 아닙니다/);
});

test("all expanded obligations have coverage links and the golden report contains exact criteria", () => {
  const records = cases.map(({ build, ...item }) => ({ ...item, files: build() }));
  const report = {
    cases: records,
    runs: [],
    calibration: calibrationCases,
    sharedRules: {},
    checks: records.map((c) => ({
      caseId: c.id,
      fixtureHash: c.id,
      testCount: 0,
      policy: { exitCode: 0 },
      structure: { exitCode: 0 },
    })),
  };
  const coverage = coverageFor(report);
  const mapped = new Set(
    coverage.stages.flatMap((s) =>
      s.references.flatMap((r) => r.obligations.map((o) => `${r.caseId}/${o}`)),
    ),
  );
  for (const item of cases) {
    assert.ok(CASE_CODES[item.id]);
    for (const o of item.obligations)
      assert.ok(mapped.has(`${item.id}/${o.id}`), `${item.id}/${o.id}`);
  }
  const html = renderGoldenReport(report);
  assert.equal((html.match(/class="obligations"/g) ?? []).length, 11);
  assert.match(html, /metadata·tiering·archive/);
  assert.match(html, /사람 검수는 아직 완료되지 않음/);
});
