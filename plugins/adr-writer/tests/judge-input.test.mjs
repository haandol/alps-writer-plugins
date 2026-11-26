import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deepEvalInput, judgingTurn } from "../evals/deepeval/input.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the judge reads the task and evidence, not the shipped guidance the target was given", () => {
  const skill = readFileSync(path.join(PLUGIN, "skills/adr-new/SKILL.md"), "utf8").replace(
    /^---\n[\s\S]*?\n---\n/,
    "",
  );
  const turn = `${skill}\n\nUser request: record the retry limit of 3 in an ADR.`;
  const judged = judgingTurn(turn);
  assert.ok(judged.includes("User request: record the retry limit of 3 in an ADR."));
  assert.ok(!judged.includes(skill), "the embedded skill body is not sent to the judge");
  assert.match(
    judged,
    /shipped guidance omitted from judging: adr-writer\/skills\/adr-new\/SKILL\.md sha256 [0-9a-f]{12}/,
  );

  const item = { obligations: [{ id: "a", text: "keep" }], turns: [turn] };
  const evidence = {
    before: { "docs/a.md": "same", "docs/b.md": "old", "docs/c.md": "gone" },
    after: { "docs/a.md": "same", "docs/b.md": "new" },
    events: [],
    replies: ["done"],
    turns: [turn],
  };
  const { input, actualOutput } = deepEvalInput(item, evidence);
  assert.ok(!JSON.parse(input).userTurns[0].includes(skill));
  const output = JSON.parse(actualOutput);
  assert.deepEqual(output.resultingFiles, { "docs/b.md": "new" });
  assert.deepEqual(output.unchangedFiles, ["docs/a.md"]);
  assert.deepEqual(output.deletedFiles, ["docs/c.md"]);
  const kept = deepEvalInput({ ...item, judgeGuidance: true }, evidence);
  assert.ok(JSON.parse(kept.input).userTurns[0].includes(skill), "a case can opt back in");
});

test("each command output reaches the judge once, and a repeat names the first", () => {
  const item = { obligations: [{ id: "a", text: "keep" }], turns: ["run the checks"] };
  const run = (seq, stdout) => ({
    seq,
    kind: "result",
    tool: "run_check",
    ok: true,
    result: { exitCode: 0, stdout },
  });
  const evidence = {
    before: {},
    after: {},
    events: [run(2, "big report"), run(4, "big report"), run(6, "other")],
    replies: ["done"],
    turns: ["run the checks"],
  };
  const output = JSON.parse(deepEvalInput(item, evidence).actualOutput);
  assert.deepEqual(output.checkOutput, {
    "event:2:stdout": "big report",
    "event:4:stdout": "[identical to checkOutput event:2:stdout]",
    "event:6:stdout": "other",
  });
  assert.deepEqual(
    output.events.map((event) => event.result.stdout),
    [
      "[see checkOutput event:2:stdout]",
      "[see checkOutput event:4:stdout]",
      "[see checkOutput event:6:stdout]",
    ],
  );
  assert.equal(output.events[0].result.exitCode, 0, "other result fields stay as observed");
  assert.equal(evidence.events[0].result.stdout, "big report", "the archived trace is not changed");
});
