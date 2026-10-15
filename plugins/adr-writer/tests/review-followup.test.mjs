import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scenario, {
  deterministicScore,
  obligations,
} from "../evals/scenarios/author-review-followup.mjs";
import { parseTail, skillText } from "../evals/lib/harness.mjs";
import { catalog } from "../evals/skills/catalog.mjs";

function response() {
  const output = `=== EVAL-VERDICT: CLASSIFIED ===
=== EVAL-FINDINGS ===
A | action=RUN_DOCUMENT_REVIEW; target=saved; status=Proposed; approval=none
B | action=WAIT_FOR_APPROVAL; target=none; status=unsaved; approval=baseline
C | action=SKIP_RECOMMENDED; target=saved; status=Proposed; approval=none
D | action=REUSE_DOCUMENT_REVIEW; target=saved; status=Proposed; approval=none
E | action=RUN_IMPLEMENTATION_REVIEW; target=selected; status=Proposed; approval=none
F | action=REUSE_IMPLEMENTATION_REVIEW; target=selected; status=Accepted; approval=none
G | action=RERUN_IMPLEMENTATION_REVIEW; target=selected; status=Proposed; approval=none
H | action=REPORT_INCOMPLETE; target=selected; status=Proposed; approval=none
I | action=REPORT_REVIEW_UNAVAILABLE; target=saved; status=Proposed; approval=none
=== EVAL-END ===`;
  return { output, tail: parseTail(output), events: [] };
}

test("follow-up scoring distinguishes recommended review from required completion", () => {
  const input = response();
  input.tail.findings.reverse();
  for (const row of input.tail.findings) row.summary = row.summary.split(";").reverse().join(";");
  assert.ok(deterministicScore(input).every((check) => check.pass));

  for (const [tag, from, to] of [
    ["A", "RUN_DOCUMENT_REVIEW", "SKIP_RECOMMENDED"],
    ["A", "target=saved", "target=category"],
    ["A", "approval=none", "approval=baseline"],
    ["B", "WAIT_FOR_APPROVAL", "RUN_DOCUMENT_REVIEW"],
    ["C", "SKIP_RECOMMENDED", "RUN_DOCUMENT_REVIEW"],
    ["C", "status=Proposed", "status=Accepted"],
    ["D", "REUSE_DOCUMENT_REVIEW", "RUN_DOCUMENT_REVIEW"],
    ["E", "status=Proposed", "status=Accepted"],
    ["F", "REUSE_IMPLEMENTATION_REVIEW", "RUN_IMPLEMENTATION_REVIEW"],
    ["G", "RERUN_IMPLEMENTATION_REVIEW", "REUSE_IMPLEMENTATION_REVIEW"],
    ["H", "status=Proposed", "status=Accepted"],
    ["I", "REPORT_REVIEW_UNAVAILABLE", "PASS"],
  ]) {
    const candidate = response();
    const row = candidate.tail.findings.find((item) => item.tag === tag);
    assert.ok(row.summary.includes(from));
    row.summary = row.summary.replace(from, to);
    assert.equal(
      deterministicScore(candidate).find((check) => check.label === `case ${tag}`).pass,
      false,
    );
  }
});

test("follow-up scoring rejects missing/duplicate decisions and fabricated tool execution", () => {
  for (const mutate of [
    (input) => input.tail.findings.pop(),
    (input) => input.tail.findings.push(input.tail.findings[0]),
    (input) => {
      input.tail.findings[0].summary += "; status=Accepted";
    },
    (input) => {
      input.tail.findings[0] = null;
    },
    (input) => {
      input.tail = null;
    },
    (input) => input.events.push({ kind: "request", tool: "write_file" }),
  ]) {
    const input = response();
    mutate(input);
    assert.ok(deterministicScore(input).some((check) => !check.pass));
  }
});

test("post-save policy is reachable explicitly without loading it during authoring discovery", () => {
  const relative = "skills/adr-new/references/after-save-review.md";
  const body = readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
  assert.ok(!skillText("adr-new").includes(body));
  assert.ok(skillText("adr-new", { references: [relative] }).includes(body));
  const prompt = scenario.build();
  assert.ok(prompt.includes(body));
  for (const row of response().tail.findings) {
    const action = row.summary.match(/action=([^;]+)/)[1];
    assert.ok(prompt.includes(action), `the requested response schema must declare ${action}`);
  }
  for (const obligation of obligations) assert.ok(!prompt.includes(obligation.text));
});

test("follow-up catalog keeps decision checks separate from semantic review evidence", async () => {
  const item = (await catalog()).find((entry) => entry.id === scenario.name);
  assert.equal(item.score, deterministicScore);
  assert.deepEqual(item.semanticObligations, obligations);
  assert.ok(item.score(response()).every((check) => check.pass));
});
