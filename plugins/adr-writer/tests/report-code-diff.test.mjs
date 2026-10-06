import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { renderHtml, renderMarkdown } from "../skills/report-writer/scripts/render-report.mjs";

const patch = [
  "diff --git a/src/retry.ts b/src/retry.ts",
  "--- a/src/retry.ts",
  "+++ b/src/retry.ts",
  "@@ -40,2 +40,2 @@ function retry()",
  "-if (retry) send();",
  "+if (retry && !completed) send();",
  " return result;",
  "@@ -97 +97 @@ function message()",
  '-const markup = "<script>alert(1)</script>";',
  '+const markup = "<img src=x onerror=alert(1)>";',
  "",
].join("\n");

function report() {
  return {
    title: "Retry review",
    language: "en",
    summary: ["Completed requests do not send again."],
    review: { status: "reviewed", basis: "Authored test fixture", limitations: "" },
    requiredEvidenceIds: ["D1"],
    sections: [
      {
        id: "retry",
        title: "Retry behavior",
        domain: "Requests",
        scope: "Completion guard",
        paragraphs: ["The completion condition prevents a duplicate send."],
        evidence: [
          {
            id: "D1",
            label: "Guard change",
            source: "changes.patch",
            kind: "diff",
            excerpt: patch,
            expanded: true,
          },
        ],
      },
    ],
  };
}

test("diff2html renders real hunks and line numbers in static HTML while Markdown retains the patch", () => {
  const html = renderHtml(report());
  assert.match(html, /class="d2h-diff-table"/);
  assert.match(html, /class="line-num1">40</);
  assert.match(html, /class="line-num2">97</);
  assert.match(html, /class="d2h-code-line-prefix">\+</);
  assert.match(html, /class="d2h-code-line-prefix">-/);
  assert.match(html, /@@ -97 \+97 @@ function message/);
  assert.match(html, /class="evidence" open data-print-expanded="true"/);
  const withoutHighlights = html.replace(/<\/?(?:ins|del)>/g, "");
  assert.match(withoutHighlights, /&lt;script&gt;/);
  assert.match(withoutHighlights, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script>alert|<img src=x|<script[^>]+src=|<link[^>]+stylesheet/);
  assert.ok(renderMarkdown(report()).includes("```diff\n" + patch));
});

test("separate evidence for the same file keeps unique rendered anchors and the plain excerpt path", () => {
  const doc = report();
  doc.requiredEvidenceIds.push("D2", "E1");
  doc.sections[0].evidence.push(
    { ...doc.sections[0].evidence[0], id: "D2", expanded: false },
    { id: "E1", label: "Current code", source: "retry.ts", excerpt: "if (retry) send();" },
  );
  const html = renderHtml(doc);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(html, /<pre><code>if \(retry\) send\(\);<\/code><\/pre>/);
});

test("invalid evidence formats and missing patch hunks fail instead of pretending to show a diff", () => {
  for (const override of [
    { kind: "patch" },
    { excerpt: "plain source text" },
    { excerpt: "" },
    { excerpt: undefined },
  ]) {
    const doc = report();
    Object.assign(doc.sections[0].evidence[0], override);
    assert.throws(() => renderHtml(doc), /kind must|unified patch/);
  }
});

test("a copied marketplace skill renders diffs without node_modules or browser downloads", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "report-diff-install-"));
  try {
    const skill = path.join(directory, "report-writer");
    cpSync(new URL("../skills/report-writer/", import.meta.url), skill, { recursive: true });
    const input = path.join(directory, "report.json");
    const output = path.join(directory, "report.html");
    writeFileSync(input, JSON.stringify(report()));
    const result = spawnSync(
      process.execPath,
      [path.join(skill, "scripts/render-report.mjs"), input, "--out", output],
      { cwd: directory, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(output, "utf8"), /class="d2h-diff-table"/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
