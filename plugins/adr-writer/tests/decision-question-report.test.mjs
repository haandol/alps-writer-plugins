import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderHtml, validateReport } from "../skills/report-writer/scripts/render-report.mjs";

test("the shipped nested question example exposes each requested answer key in rendered body text", () => {
  const guide = readFileSync(
    new URL("../references/decision-questions.md", import.meta.url),
    "utf8",
  );
  const node = JSON.parse(guide.match(/```json\n([\s\S]*?)\n```/)[1]);
  const report = {
    title: "Decision questions",
    language: "en",
    summary: ["Answer the scoped questions together."],
    sections: [node],
    requiredEvidenceIds: [],
    review: {
      status: "reviewed",
      basis: "Visible-key regression fixture.",
      limitations: "No browser automation.",
    },
  };
  assert.deepEqual(validateReport(report).warnings, []);
  const html = renderHtml(report);
  const visible = html
    .replace(/<script\b[\s\S]*?<\/script>/g, "")
    .replace(/<style\b[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]*>/g, "");
  for (const question of node.children) {
    assert.ok(html.includes(`id="${question.id}" open`));
    assert.ok(visible.includes(question.title), "the ID must appear in its visible question title");
    assert.ok(question.title.includes(question.id));
    assert.ok(visible.includes(`Reply using ${question.id}`));
  }
  assert.equal(new Set(node.children.map((q) => q.id)).size, 2);
});
