import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cases } from "../regression/cases.mjs";
import { CASE_CODES, coverageFor, coverageDiagrams } from "./coverage.mjs";
import { renderCoverage } from "./coverage-html.mjs";
import { prepareCoverageVisuals } from "./coverage-render.mjs";

const report = () => ({
  cases: structuredClone(cases.map(({ build, ...item }) => item)),
  runs: [],
});

test("coverage references resolve to existing obligations for all eight cases", () => {
  const mapped = coverageFor(report());
  assert.deepEqual(mapped.invalid, []);
  assert.deepEqual(mapped.unmapped, []);
  assert.deepEqual(
    new Set(mapped.stages.flatMap((stage) => stage.references.map((ref) => ref.caseId))),
    new Set(cases.map((item) => item.id)),
  );
  assert.equal(Object.keys(CASE_CODES).length, 8);
  assert.ok(mapped.stages.some((stage) => stage.effective === "gap"));
});

test("subset selection, changed obligations and new cases cannot silently claim coverage", () => {
  const subset = report();
  subset.cases = subset.cases.filter((item) => item.id === "sync-encbird-turn-units");
  assert.equal(
    coverageFor(subset).stages.find((s) => s.id === "ru_merge").effective,
    "not-selected",
  );
  subset.cases[0].obligations = subset.cases[0].obligations.filter((o) => o.id !== "units");
  assert.equal(
    coverageFor(subset).stages.find((s) => s.id === "sy_boundary").effective,
    "mapping-error",
  );
  assert.match(renderCoverage(subset), /연결 검토 필요/);
  subset.cases.push({ id: "new-case", title: "New", obligations: [] });
  assert.deepEqual(coverageFor(subset).unmapped, ["new-case"]);
});

test("case scores stay separate from design coverage and missing runs remain ungraded", () => {
  const input = report();
  const sources = coverageDiagrams(input);
  assert.match(renderCoverage(input), /후보 미채점/);
  input.runs = [{ caseId: input.cases[0].id, variant: "candidate", verdict: "PASS" }];
  assert.deepEqual(coverageDiagrams(input), sources);
  const html = renderCoverage(input);
  assert.match(html, /케이스 전체 판정/);
  assert.match(html, /후보 1\/1 충족/);
  assert.match(html, /각 노드를 독립적으로 채점했다고 보지 않습니다/);
});

test("three diagrams include no-write, withheld, conflict, quick and error paths", () => {
  const [overview, rollup, sync] = coverageDiagrams(report());
  assert.match(overview.source, /평가 호출 오류/);
  assert.match(rollup.source, /ru_independent -->\|변경 없이 보고\| ru_report/);
  assert.match(rollup.source, /ru_approval -->\|보류·거절\| ru_hold/);
  assert.match(rollup.source, /ru_conflict/);
  assert.match(sync.source, /sy_mode -->\|quick\| sy_quick/);
  assert.match(sync.source, /sy_missing/);
});

test("rendered diagrams are inert images and stale renders cannot hide changed coverage", async () => {
  const input = report();
  const directory = mkdtempSync(path.join(os.tmpdir(), "eval-coverage-"));
  try {
    const visuals = await prepareCoverageVisuals(input, directory, {
      render: async (sourceFile) => {
        assert.match(readFileSync(sourceFile, "utf8"), /^flowchart TD/);
        return '<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>';
      },
    });
    assert.equal(visuals.length, 3);
    input.cases[0].title = "<script>untrusted()</script>";
    const html = renderCoverage(input);
    assert.equal((html.match(/class="coverage-svg"/g) ?? []).length, 3);
    assert.ok(!html.includes("<svg"));
    assert.ok(!html.includes("<script>"));
    assert.match(html, /&lt;script&gt;untrusted/);
    input.coverageVisuals[0].source += "\nchanged";
    assert.equal((renderCoverage(input).match(/class="coverage-svg"/g) ?? []).length, 2);
    assert.match(renderCoverage(input), /도표가 아직 렌더링되지 않았습니다/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
