import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { PLUGIN_ROOT } from "../evals/lib/harness.mjs";
import { reportCases, reportReferences } from "../evals/skills/report-cases.mjs";

const ref = (name) => `skills/report-writer/references/${name}.md`;
const COMMON = ["explanation-design", "editorial-review", "format-and-layout"].map(ref);
const loaded = (prompt) =>
  [...prompt.matchAll(/^# Loaded reference: (\S+)$/gm)].map((match) => match[1]);
const obligationText = (item) => item.semanticObligations.map((o) => o.text).join("\n");

test("each inline report case inlines exactly its declared, existing references", () => {
  assert.ok(reportCases.length);
  for (const item of reportCases) {
    assert.ok(Array.isArray(item.references) && item.references.length, item.id);
    for (const reference of item.references)
      assert.ok(existsSync(path.join(PLUGIN_ROOT, reference)), `${item.id}: ${reference}`);
    for (const reference of COMMON) assert.ok(item.references.includes(reference), item.id);
    assert.deepEqual(loaded(item.build()), item.references, item.id);
  }
});

test("obligations about figures or numbers keep the module that owns them", () => {
  for (const item of reportCases) {
    const text = obligationText(item);
    if (/diagram|figure|mermaid/i.test(text))
      assert.ok(item.references.includes(ref("diagrams")), item.id);
    if (/\d+\s*\/\s*\d+|USD/.test(text))
      assert.ok(item.references.includes(ref("quantitative-claims")), item.id);
  }
  const slop = reportCases.filter((item) => item.id.startsWith("report-slop-"));
  assert.ok(slop.length);
  for (const item of slop) {
    assert.ok(item.references.includes(ref("writing-style")), item.id);
    assert.match(item.build(), /## Remove AI slop that obscures meaning/);
  }
});

test("a case must declare its references and unknown modules are rejected", () => {
  assert.throws(() => reportReferences(), /must declare its references/);
  // Declaration order does not change the prompt order of the modules a case keeps.
  assert.deepEqual(reportReferences(["review-results", "diagrams"]), [
    ref("explanation-design"),
    ref("editorial-review"),
    ref("diagrams"),
    ref("format-and-layout"),
    ref("review-results"),
  ]);
  assert.throws(() => reportReferences(["diagram"]), /Unknown report-writer reference: diagram/);
});
