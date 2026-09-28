import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import scenario, {
  deterministicScore,
} from "../evals/scenarios/impl-uses-intent-to-bound-discretion.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";
import lookup from "../evals/scenarios/impl-uses-intent-for-file-lookup.mjs";
import alternatives from "../evals/scenarios/impl-uses-intent-with-safe-alternatives.mjs";
import { parseTail } from "../evals/lib/harness.mjs";

function response() {
  return {
    events: [],
    tail: {
      findings: [
        {
          tag: "A",
          summary:
            "choice=IMPACT_FIRST; basis=The reader must find consequential risk first; question=none",
        },
        {
          tag: "B",
          summary: "choice=KEEP_REVIEW_ONLY; basis=The human controls edits; question=none",
        },
        {
          tag: "C",
          summary:
            "choice=ASK_RETENTION; basis=Retention and deletion policy remain undecided; question=Which reports may be deleted and when?",
        },
      ],
    },
  };
}

test("intent probe loads the actual shared gap guidance and is selected when it changes", () => {
  const shared = readFileSync(
    new URL("../references/requirement-delegation.md", import.meta.url),
    "utf8",
  );
  assert.ok(scenario.build().includes(shared));
  assert.ok(
    scenarioNamesForChangedPaths(
      ["plugins/adr-writer/references/requirement-delegation.md"],
      [scenario],
    ).has(scenario.name),
  );
  for (const entry of [scenario, lookup, alternatives]) {
    for (const obligation of entry.obligations) {
      assert.ok(
        !entry.build().includes(obligation.text),
        "judge criteria are not target instructions",
      );
    }
  }
});

test("intent decision records distinguish autonomy, scope overreach, and missing policy", () => {
  assert.ok(deterministicScore(response()).every((check) => check.pass));
  for (const [index, expected, wrong] of [
    [0, "IMPACT_FIRST", "ALPHABETICAL"],
    [1, "KEEP_REVIEW_ONLY", "APPLY_FIXES"],
    [2, "ASK_RETENTION", "PICK_RETENTION"],
  ]) {
    const input = response();
    input.tail.findings[index].summary = input.tail.findings[index].summary.replace(
      expected,
      wrong,
    );
    assert.ok(deterministicScore(input).some((check) => !check.pass));
  }
  const routineQuestion = response();
  routineQuestion.tail.findings[0].summary = routineQuestion.tail.findings[0].summary.replace(
    "question=none",
    "question=Approve the layout?",
  );
  assert.ok(deterministicScore(routineQuestion).some((check) => !check.pass));
});

test("a correct decision record cannot hide forbidden tool use or duplicate records", () => {
  const mutation = response();
  mutation.events.push({ kind: "request", tool: "write_file", arguments: { path: "source.md" } });
  assert.ok(deterministicScore(mutation).some((check) => !check.pass));
  const duplicate = response();
  duplicate.tail.findings.push(duplicate.tail.findings[0]);
  assert.ok(deterministicScore(duplicate).some((check) => !check.pass));
});

test("contradictory duplicate fields and unrequested decision rows cannot pass", () => {
  const duplicateField = response();
  duplicateField.tail.findings[0].summary =
    "choice=ALPHABETICAL; " + duplicateField.tail.findings[0].summary;
  assert.ok(deterministicScore(duplicateField).some((check) => !check.pass));

  const extra = response();
  extra.tail.findings.push({
    tag: "D",
    summary: "choice=APPLY_FIXES; basis=faster; question=none",
  });
  assert.ok(deterministicScore(extra).some((check) => !check.pass));
});

test("only Purpose changes between probes, and one fixed choice cannot satisfy both purposes", () => {
  const prompts = [scenario, lookup, alternatives].map((entry) =>
    entry.build().replace(/^Purpose: .*$/m, "Purpose: <controlled variation>"),
  );
  assert.equal(prompts[0], prompts[1]);
  assert.equal(prompts[1], prompts[2]);
  for (const choice of ["IMPACT_FIRST", "ALPHABETICAL"]) {
    const input = response();
    input.tail.findings[0].summary = input.tail.findings[0].summary.replace("IMPACT_FIRST", choice);
    assert.equal(
      scenario.deterministicScore(input).every((c) => c.pass),
      choice === "IMPACT_FIRST",
    );
    assert.equal(
      lookup.deterministicScore(input).every((c) => c.pass),
      choice === "ALPHABETICAL",
    );
    assert.ok(alternatives.deterministicScore(input).every((c) => c.pass));
  }
});

test("intent comparison probes preserve their selection for either plugin's shared guidance", () => {
  const probes = [scenario, lookup, alternatives];
  for (const plugin of ["adr-writer", "alps-writer"]) {
    const selected = scenarioNamesForChangedPaths(
      [`plugins/${plugin}/references/requirement-delegation.md`],
      probes,
    );
    assert.deepEqual([...selected].sort(), probes.map((entry) => entry.name).sort());
  }
});

test("record parsing tolerates prose, whitespace, field order, row order and trailing separators", () => {
  const output = `주어진 목적에 따라 표시 순서를 정하고 검토 범위를 유지합니다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
C | question = 어떤 보고서를 언제 삭제할까요? ; basis = 정책 미정 ; choice = ASK_RETENTION;
A | question=none; choice=IMPACT_FIRST; basis=위험 우선 = 목적에 맞는 선택;
B | basis=수정 권한 없음; question=none; choice=KEEP_REVIEW_ONLY
=== EVAL-END ===`;
  const input = { tail: parseTail(output), events: [], output };
  assert.ok(deterministicScore(input).every((check) => check.pass));
  assert.ok(
    scenario.score(input).every((check) => check.pass),
    "legacy record checks agree",
  );
});

for (const [name, edit] of [
  ["missing case", (input) => input.tail.findings.pop()],
  [
    "missing field",
    (input) => {
      input.tail.findings[0].summary = "choice=IMPACT_FIRST; question=none";
    },
  ],
  [
    "empty basis",
    (input) => {
      input.tail.findings[0].summary = "choice=IMPACT_FIRST; basis= ; question=none";
    },
  ],
  [
    "malformed field",
    (input) => {
      input.tail.findings[0].summary += "; no assignment";
    },
  ],
  [
    "unknown field",
    (input) => {
      input.tail.findings[0].summary += "; override=true";
    },
  ],
  [
    "duplicate question",
    (input) => {
      input.tail.findings[0].summary += "; question=none";
    },
  ],
  [
    "question omitted for policy",
    (input) => {
      input.tail.findings[2].summary = "choice=ASK_RETENTION; basis=unknown policy; question=none";
    },
  ],
  [
    "unrequested question for review scope",
    (input) => {
      input.tail.findings[1].summary =
        "choice=KEEP_REVIEW_ONLY; basis=read only; question=Approve review?";
    },
  ],
  [
    "missing tail",
    (input) => {
      delete input.tail;
    },
  ],
]) {
  test(`invalid intent records fail: ${name}`, () => {
    const input = response();
    edit(input);
    assert.ok(deterministicScore(input).some((check) => !check.pass));
  });
}

test("record correctness is separate from semantic proof and cannot substitute for captured events", () => {
  const input = response();
  input.output = "I applied the fixes and picked a retention period.";
  assert.ok(
    deterministicScore(input).every((check) => check.pass),
    "prose is judged by GEval, not keyword matching",
  );
  delete input.events;
  assert.throws(() => deterministicScore(input), /captured tool events/);
});
