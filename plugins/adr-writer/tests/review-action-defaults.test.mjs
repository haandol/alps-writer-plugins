import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const renderer = fileURLToPath(new URL("../scripts/adr-impl-review-report.mjs", import.meta.url));

function render({ language = "en", finding = {}, coverage } = {}) {
  const data = {
    adr: "example.md",
    verdict: "FIX_REQUIRED",
    language,
    contractCoverage: coverage ?? [{ contractId: "R1", requirement: "Create at most one result." }],
    findings: [
      {
        category: "Spec violation",
        summary: "A retry creates a duplicate result.",
        confidence: "high",
        perspective: "sufficiency",
        code: "complete() writes twice",
        evidence: "Two writes were observed; the required count is one.",
        test: "node --test completion.test.mjs",
        testResult: "FAIL: expected 1, got 2",
        contractIds: ["R1"],
        ...finding,
      },
    ],
  };
  const result = spawnSync(process.execPath, [renderer, "-", "--stdout"], {
    input: JSON.stringify(data),
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  const card = result.stdout.match(/<article class="finding"[^]*?<\/article>/)?.[0];
  assert.ok(card);
  const fields = new Map(
    [...card.matchAll(/<span class="side__label">([^<]+)<\/span>\s*<p[^>]*>([^]*?)<\/p>/g)].map(
      ([, label, value]) => [label, value],
    ),
  );
  return { html: result.stdout, card, fields };
}

test("failed or unavailable observations never become the desired completion outcome", () => {
  for (const testResult of ["FAIL: expected 1, got 2", "NOT RUN: environment unavailable"]) {
    const { html, fields } = render({ finding: { testResult } });
    assert.equal(fields.get("Expected behavior"), "Create at most one result.");
    assert.match(fields.get("Requested change"), /correction supported by the supplied evidence/);
    assert.match(fields.get("Done when"), /expected outcome is verified.*checks pass/);
    assert.ok(fields.get("Done when").includes("node --test completion.test.mjs"));
    assert.ok(!fields.get("Done when").includes(testResult));
    assert.ok(html.includes(testResult), "current execution evidence must remain available");
    assert.ok(html.includes("Two writes were observed; the required count is one."));
  }
});

test("missing structured expectations request clarification instead of inventing a rule or repair", () => {
  for (const contractIds of [[], ["unknown"]]) {
    const { fields } = render({ finding: { contractIds } });
    assert.match(fields.get("Expected behavior"), /needs clarification from the supplied evidence/);
    assert.match(fields.get("Requested change"), /Specify the correction/);
    assert.ok(!fields.get("Expected behavior").includes("Create at most one"));
    assert.ok(!fields.get("Requested change").includes("complete()"));
  }
});

test("explicit precision fields override defaults even when FAILED is a valid domain state", () => {
  const { fields, html } = render({
    finding: {
      expectedBehavior: "Provider failure leaves the job FAILED.",
      requestedChange: "Keep the failure state after provider rejection.",
      completionCriteria: "The job is FAILED and no completion record exists.",
    },
  });
  assert.equal(fields.get("Expected behavior"), "Provider failure leaves the job FAILED.");
  assert.equal(fields.get("Requested change"), "Keep the failure state after provider rejection.");
  assert.equal(fields.get("Done when"), "The job is FAILED and no completion record exists.");
  assert.ok(html.includes("FAIL: expected 1, got 2"));
});

test("derived prompts follow report language and linked requirement text remains escaped", () => {
  const ko = render({ language: "ko", finding: { contractIds: [] } });
  assert.match(ko.fields.get("기대 동작"), /기대 결과를 명확히/);
  assert.match(ko.fields.get("요청하는 변경"), /수정 내용을 명확히/);
  assert.match(ko.fields.get("완료 조건"), /필요한 검사가 통과/);
  assert.ok(!ko.fields.get("완료 조건").includes("FAIL: expected"));

  const escaped = render({
    coverage: [{ contractId: "R1", requirement: "Reject <script>alert(1)</script>." }],
  });
  assert.ok(escaped.fields.get("Expected behavior").includes("&lt;script&gt;"));
  assert.ok(!escaped.card.includes("<script>alert(1)</script>"));
});
