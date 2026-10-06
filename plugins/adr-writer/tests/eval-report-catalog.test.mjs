import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { withTmp } from "./helpers.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import { saveSkillsReport } from "../evals/skills/report.mjs";

test("the complete catalog retains every scenario inside bounded report groups", async () => {
  const cases = await catalog();
  withTmp((dir) => {
    const report = {
      schemaVersion: 1,
      framework: "skill-evals",
      generatedAt: "2026-09-30T00:00:00Z",
      runsPerCase: 1,
      variants: ["candidate"],
      selection: { suite: "all" },
      runtime: {},
      datasetHash: "fixture",
      cases,
      runs: cases.map((c) => ({
        caseId: c.id,
        type: c.type,
        variant: "candidate",
        repeat: 1,
        verdict: "NOT_RUN",
        notRunReason: "Structure-only catalog check",
        calls: [],
      })),
    };
    saveSkillsReport(dir, report);
    const html = readFileSync(path.join(dir, "index.html"), "utf8");
    const subsections = [...html.matchAll(/<details class="report-node"[^>]*>/g)];
    assert.ok(subsections.length >= cases.length);
    assert.ok(
      subsections.every(([tag]) => /\bopen(?:\s|>)/.test(tag)),
      "ordinary evaluation results also start expanded",
    );
    const doc = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8"));
    const leaves = [];
    const visit = (nodes) => {
      assert.ok(nodes.length <= 4);
      for (const n of nodes) {
        if (n.id.startsWith("case-")) leaves.push(n.id.slice(5));
        if (n.children) visit(n.children);
      }
    };
    visit(doc.sections);
    assert.deepEqual(leaves.sort(), cases.map((c) => c.id).sort());
    for (const c of cases)
      assert.ok(readFileSync(path.join(dir, `case-results/${c.id}.json`), "utf8").includes(c.id));
  });
});
