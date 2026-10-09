import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReportArtifact, REPORT_OUTPUT } from "../evals/skills/report-artifact-checks.mjs";

const source = "A published revision remains visible when notification fails.";
const document = () => ({
  title: "Publication",
  language: "en",
  summary: [source],
  requiredEvidenceIds: ["S1"],
  review: { status: "reviewed", basis: "Source comparison only", limitations: "No live checks" },
  sections: [
    {
      id: "publication",
      title: "Publication",
      domain: "Membership",
      scope: "Notification failure",
      paragraphs: [source],
      evidence: [{ id: "S1", label: "Original", source: "../source.md" }],
    },
  ],
});
function fixture(doc = document()) {
  const events = [];
  for (const [tool, file] of [
    ["read_file", "source.md"],
    ["read_file", "plugin/skills/report-writer/SKILL.md"],
    ["read_file", "plugin/skills/report-writer/references/report-document.md"],
    ["write_file", REPORT_OUTPUT],
  ]) {
    const seq = events.length + 1;
    events.push({ seq, kind: "request", tool, arguments: { path: file } });
    events.push({ seq: seq + 1, kind: "result", request: seq, ok: true });
  }
  return { source, files: { "source.md": source, [REPORT_OUTPUT]: JSON.stringify(doc) }, events };
}
const failures = (input) => checkReportArtifact(input).filter((c) => !c.pass);

test("a real saved document with completed reads and resolvable evidence passes artifact checks", () => {
  assert.deepEqual(failures(fixture()), []);
});

test("self-reported success cannot replace a missing file, successful read or write", () => {
  const missing = fixture();
  delete missing.files[REPORT_OUTPUT];
  assert.ok(failures(missing).some((c) => c.label === "saved JSON parses"));
  for (const index of [1, 3, 5, 7]) {
    const input = fixture();
    input.events[index].ok = false;
    assert.ok(failures(input).some((c) => /completed/.test(c.label)));
  }
  const wrongRequest = fixture();
  wrongRequest.events[1].request = 999;
  assert.ok(failures(wrongRequest).some((c) => c.label === "read completed: source.md"));
});

test("a correct-looking suffix and write-then-restore cannot bypass captured scope", () => {
  const wrongPath = fixture();
  wrongPath.events[0].arguments.path = "unrelated/source.md";
  assert.ok(failures(wrongPath).some((c) => c.label === "read completed: source.md"));
  const restored = fixture();
  restored.events.push({ kind: "request", tool: "write_file", arguments: { path: "source.md" } });
  assert.ok(failures(restored).some((c) => c.label === "no out-of-scope mutation attempted"));
  const changed = fixture();
  changed.files["source.md"] = "Changed";
  assert.ok(failures(changed).some((c) => c.label === "original source preserved"));
  const extra = fixture();
  extra.files["plan.md"] = "extra artifact";
  assert.ok(failures(extra).some((c) => c.label === "only declared output exists"));
});

test("source inventory, source targets and renderer compatibility are independent gates", () => {
  const missingId = document();
  missingId.requiredEvidenceIds = [];
  assert.ok(failures(fixture(missingId)).some((c) => c.label === "native document format"));
  for (const target of [
    "source.md (Publication)",
    "source.md",
    "../missing.md",
    "#publication",
    "/source.md",
    "https://example.test/source.md",
    "../source.md#unknown",
    "%ZZ",
  ]) {
    const doc = document();
    doc.sections[0].evidence[0].source = target;
    assert.ok(
      failures(fixture(doc)).some((c) => c.label === "evidence resolves to supplied original"),
      target,
    );
  }
  const unsupported = document();
  unsupported.sections[0].diagram = {
    source: "not-a-supported-diagram",
    explanation: "Not rendered",
  };
  assert.ok(failures(fixture(unsupported)).some((c) => c.label === "native document format"));
  unsupported.sections[0].diagram.required = false;
  assert.deepEqual(failures(fixture(unsupported)), []);
  assert.ok(
    checkReportArtifact(fixture(unsupported)).find((c) => c.label === "native HTML renders").detail,
  );
});

test("artifact checks do not pretend to judge the meaning of valid prose", () => {
  const badMeaning = document();
  badMeaning.sections[0].paragraphs = ["A notification failure revokes publication."];
  assert.deepEqual(failures(fixture(badMeaning)), []);
  // The independent semantic obligation must reject this; syntax cannot do so.
});
