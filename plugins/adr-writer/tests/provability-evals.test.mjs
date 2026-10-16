import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import scenario, {
  deterministicScore,
  obligations,
} from "../evals/scenarios/impl-review-provability.mjs";
import { parseTail } from "../evals/lib/harness.mjs";
import { catalog } from "../evals/skills/catalog.mjs";
import documentProbe from "../evals/scenarios/review-provability.mjs";
import implementationProbe from "../evals/scenarios/impl-provability.mjs";

function response() {
  const output = `=== EVAL-VERDICT: CLASSIFIED ===
=== EVAL-FINDINGS ===
A | verdict=FIX_REQUIRED; D0=UNVERIFIED; R1=PROVEN; R2=UNVERIFIED; category=Test gap; inspected=4/4; verified=3/4
B | verdict=FIX_REQUIRED; D0=VIOLATED; R1=PROVEN; R2=VIOLATED; category=Spec violation; inspected=4/4; verified=3/4
C | verdict=PASS; D0=PROVEN; R1=PROVEN; R2=PROVEN; category=none; inspected=4/4; verified=4/4
D | verdict=INCONCLUSIVE; D0=UNVERIFIED; R1=UNVERIFIED; R2=PROVEN; category=Unverified risk; inspected=4/4; verified=3/4
E | verdict=INCONCLUSIVE; D0=UNVERIFIED; R1=UNVERIFIED; R2=UNVERIFIED; category=Unverified risk; inspected=4/4; verified=0/4
F | verdict=FIX_REQUIRED; D0=VIOLATED; R1=VIOLATED; R2=PROVEN; category=Spec violation; inspected=4/4; verified=3/4
G | verdict=INCONCLUSIVE; D0=VIOLATED; R1=VIOLATED; R2=UNVERIFIED; category=Spec violation; inspected=4/4; verified=0/4
=== EVAL-END ===`;
  return { output, tail: parseTail(output), events: [] };
}

test("supplied outcomes pass both scorer entry points regardless of record/field order", () => {
  const input = response();
  input.tail.findings.reverse();
  for (const row of input.tail.findings)
    row.summary =
      row.summary
        .split(";")
        .reverse()
        .map((s) => s.trim().replace("=", " = "))
        .join(" ; ") + ";";
  assert.ok(scenario.score(input).every((c) => c.pass));
  assert.ok(deterministicScore(input).every((c) => c.pass));
});

test("each wrong classification and partial-parent claim fails independently", () => {
  for (const [tag, from, to] of [
    ["A", "R2=UNVERIFIED", "R2=PROVEN"],
    ["A", "category=Test gap", "category=Spec violation"],
    ["A", "verified=3/4", "verified=4/4"],
    ["A", "verified=3/4", "verified=3/3"],
    ["B", "category=Spec violation", "category=Test gap"],
    ["B", "R2=VIOLATED", "R2=UNVERIFIED"],
    ["C", "verdict=PASS", "verdict=INCONCLUSIVE"],
    ["C", "category=none", "category=Test gap"],
    ["D", "category=Unverified risk", "category=Test gap"],
    ["D", "category=Unverified risk", "category=Spec violation"],
    ["D", "R1=UNVERIFIED", "R1=PROVEN"],
    ["E", "category=Unverified risk", "category=Test gap"],
    ["E", "category=Unverified risk", "category=Spec violation"],
    ["E", "verdict=INCONCLUSIVE", "verdict=FIX_REQUIRED"],
    ["E", "verified=0/4", "verified=4/4"],
    ["F", "R1=VIOLATED", "R1=PROVEN"],
    ["F", "verified=3/4", "verified=4/4"],
    ["G", "R1=VIOLATED", "R1=UNVERIFIED"],
    ["G", "category=Spec violation", "category=Unverified risk"],
    ["G", "R2=UNVERIFIED", "R2=VIOLATED"],
    ["G", "verified=0/4", "verified=3/4"],
  ]) {
    const input = response();
    const row = input.tail.findings.find((r) => r.tag === tag);
    assert.ok(row.summary.includes(from));
    row.summary = row.summary.replace(from, to);
    for (const score of [scenario.score, deterministicScore])
      assert.equal(
        score(input).find((c) => c.label === `case ${tag}`).pass,
        false,
        `${tag}: ${to}`,
      );
  }
});

test("missing, duplicate, invented and contradictory records fail closed", () => {
  for (const mutate of [
    (i) => {
      delete i.tail;
    },
    (i) => {
      i.tail.findings = null;
    },
    (i) => {
      i.tail.findings[0] = null;
    },
    (i) => {
      i.tail.findings[0].summary = null;
    },
    (i) => i.tail.findings.pop(),
    (i) => i.tail.findings.push(i.tail.findings[0]),
    (i) => {
      i.tail.findings[0].tag = "EXTRA";
    },
    (i) => {
      i.tail.findings[0].summary += "; verdict=PASS";
    },
    (i) => {
      i.tail.findings[0].summary += "; extra=true";
    },
    (i) => {
      i.tail.findings[0].summary = i.tail.findings[0].summary.replace(
        "R2=UNVERIFIED",
        "R2a=UNVERIFIED",
      );
    },
    (i) => {
      i.tail.findings[0].summary = i.tail.findings[0].summary.replace("R2=UNVERIFIED", "R2=");
    },
    (i) => {
      i.tail.findings[0].summary = i.tail.findings[0].summary.replace(
        "R2=UNVERIFIED",
        "broken field",
      );
    },
  ]) {
    const input = response();
    mutate(input);
    assert.ok(deterministicScore(input).some((c) => !c.pass));
  }
  for (const tool of ["read_file", "write_file", "run_check"]) {
    const input = response();
    input.events.push({ kind: "request", tool });
    assert.ok(deterministicScore(input).some((c) => !c.pass));
  }
  const input = response();
  delete input.events;
  assert.throws(() => deterministicScore(input), /captured tool events/);
});

test("catalog delegates provability meaning to fixed semantic obligations", async () => {
  const item = (await catalog()).find((c) => c.id === scenario.name);
  assert.equal(item.score, undefined);
  assert.deepEqual(item.semanticObligations, obligations);
  assert.equal(item.supplementalChecks, false);
});

test("scenario embeds shipping review modules without leaking the semantic answer key", () => {
  const prompt = scenario.build();
  for (const file of [
    "references/implementation-evidence.md",
    "skills/adr-impl-review/references/full-review.md",
    "skills/adr-impl-review/references/evidence-synthesis.md",
  ])
    assert.ok(prompt.includes(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")));
  for (const obligation of obligations) assert.ok(!prompt.includes(obligation.text));
  assert.ok(prompt.length > 5000 && prompt.length <= 100_000);
  // Free prose and evidence/tests placement remain semantic obligations. This
  // deterministic suite checks decision discrimination, not live model quality.
});

// Canned outcomes are independent of the scorers' private expected tables.
const stage2 = [
  {
    probe: documentProbe,
    rows: [
      "A | verdict=FIX_REQUIRED; basis=SOURCE_COMPARED; criteria=INCOMPLETE; implementation=NOT_ASSESSED",
      "B | verdict=PASS; basis=ADR_INTERNAL; criteria=COMPLETE; implementation=NOT_ASSESSED",
      "C | verdict=PASS; basis=SOURCE_COMPARED; criteria=COMPLETE; implementation=NOT_ASSESSED",
      "D | verdict=FIX_REQUIRED; basis=ADR_INTERNAL; criteria=INCOMPLETE; implementation=NOT_ASSESSED",
    ],
    mutations: [
      ["A", "verdict=FIX_REQUIRED", "verdict=PASS"],
      ["A", "basis=SOURCE_COMPARED", "basis=ADR_INTERNAL"],
      ["A", "criteria=INCOMPLETE", "criteria=COMPLETE"],
      ["B", "verdict=PASS", "verdict=FIX_REQUIRED"],
      ["B", "basis=ADR_INTERNAL", "basis=SOURCE_COMPARED"],
      ["C", "verdict=PASS", "verdict=BLOCK"],
      ["C", "implementation=NOT_ASSESSED", "implementation=PROVEN"],
      ["D", "criteria=INCOMPLETE", "criteria=COMPLETE"],
      ["D", "verdict=FIX_REQUIRED", "verdict=PASS"],
    ],
    references: ["skills/adr-review/references/report.md"],
  },
  {
    probe: implementationProbe,
    rows: [
      "A | action=PLAN_CONTRACT_FIRST; limit=3; approval=NONE; evidence=DISPOSABLE",
      "B | action=REPAIR_ASSERTIONS; limit=3; approval=NONE; evidence=DISPOSABLE",
      "C | action=COMPLETE; limit=3; approval=NONE; evidence=DISPOSABLE",
      "D | action=REPAIR_RACE_AND_TEST; limit=3; approval=NONE; evidence=DISPOSABLE",
    ],
    mutations: [
      ["A", "action=PLAN_CONTRACT_FIRST", "action=IMPLEMENT_FIRST"],
      ["A", "limit=3", "limit=5"],
      ["A", "approval=NONE", "approval=REQUIRED"],
      ["A", "evidence=DISPOSABLE", "evidence=REGISTRY"],
      ["B", "action=REPAIR_ASSERTIONS", "action=COMPLETE"],
      ["B", "approval=NONE", "approval=REQUIRED"],
      ["C", "action=COMPLETE", "action=REPAIR_RACE_AND_TEST"],
      ["C", "action=COMPLETE", "action=REPAIR_ASSERTIONS"],
      ["C", "approval=NONE", "approval=REQUIRED"],
      ["D", "action=REPAIR_RACE_AND_TEST", "action=COMPLETE"],
      ["D", "action=REPAIR_RACE_AND_TEST", "action=REPAIR_ASSERTIONS"],
      ["D", "limit=3", "limit=4"],
      ["D", "approval=NONE", "approval=REQUIRED"],
    ],
    references: [
      "skills/adr-impl/references/planning.md",
      "references/implementation-evidence.md",
      "references/outcome-evaluation.md",
      "skills/adr-impl/references/completion.md",
    ],
  },
];

function stage2Response(rows) {
  const output = `=== EVAL-VERDICT: CLASSIFIED ===\n=== EVAL-FINDINGS ===\n${rows.join("\n")}\n=== EVAL-END ===`;
  return { output, tail: parseTail(output), events: [] };
}

test("stage2 paired responses pass with reordered rows, fields and whitespace", () => {
  for (const { probe, rows } of stage2) {
    const input = stage2Response(rows);
    input.tail.findings.reverse();
    for (const row of input.tail.findings)
      row.summary =
        row.summary
          .split(";")
          .reverse()
          .map((s) => s.trim().replace("=", " = "))
          .join(" ; ") + ";";
    for (const score of [probe.score, probe.deterministicScore])
      assert.ok(
        score(input).every((c) => c.pass),
        probe.name,
      );
  }
});

test("stage2 scorer mutants cannot hide source omissions, false proof, weak assertions or extra gates", () => {
  for (const { probe, rows, mutations } of stage2) {
    for (const [tag, from, to] of mutations) {
      const input = stage2Response(rows);
      const row = input.tail.findings.find((r) => r.tag === tag);
      assert.ok(row.summary.includes(from));
      row.summary = row.summary.replace(from, to);
      for (const score of [probe.score, probe.deterministicScore])
        assert.equal(
          score(input).find((c) => c.label === `case ${tag}`).pass,
          false,
          `${probe.name} ${tag}: ${to}`,
        );
    }
  }
});

test("stage2 malformed records and forbidden tool attempts cannot pass", () => {
  for (const { probe, rows } of stage2) {
    for (const mutate of [
      (i) => {
        delete i.tail;
      },
      (i) => {
        i.tail.findings = null;
      },
      (i) => {
        i.tail.findings[0] = null;
      },
      (i) => {
        i.tail.findings[0].summary = null;
      },
      (i) => i.tail.findings.pop(),
      (i) => i.tail.findings.push(i.tail.findings[0]),
      (i) => {
        i.tail.findings[0].tag = "EXTRA";
      },
      (i) => {
        i.tail.findings[0].summary += "; " + i.tail.findings[0].summary.split(";")[0];
      },
      (i) => {
        i.tail.findings[0].summary += "; registry=complete";
      },
      (i) => {
        i.tail.findings[0].summary = i.tail.findings[0].summary.replace(/^[^;]+/, "broken field");
      },
      (i) => {
        i.tail.findings[0].summary = i.tail.findings[0].summary.replace(/=[^;]+/, "=");
      },
      (i) => {
        i.tail.findings[0].summary = i.tail.findings[0].summary.replace(/;[^;]+$/, "");
      },
    ]) {
      const input = stage2Response(rows);
      mutate(input);
      assert.ok(
        probe.deterministicScore(input).some((c) => !c.pass),
        probe.name,
      );
    }
    for (const tool of ["read_file", "write_file", "run_check"]) {
      const input = stage2Response(rows);
      input.events.push({ kind: "request", tool });
      assert.ok(probe.deterministicScore(input).some((c) => !c.pass));
    }
    const input = stage2Response(rows);
    delete input.events;
    assert.throws(() => probe.deterministicScore(input), /captured tool events/);
  }
});

test("stage2 catalog preserves semantic evidence obligations without record-word scoring", async () => {
  const entries = await catalog();
  for (const { probe } of stage2) {
    const item = entries.find((c) => c.id === probe.name);
    assert.equal(item.score, undefined);
    assert.deepEqual(item.semanticObligations, probe.obligations);
    assert.equal(item.supplementalChecks, false);
  }
});

test("stage2 probes load current workflow evidence and keep semantic answer keys private", () => {
  for (const { probe, references } of stage2) {
    const prompt = probe.build();
    for (const file of references)
      assert.ok(prompt.includes(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")));
    for (const obligation of probe.obligations) assert.ok(!prompt.includes(obligation.text));
    assert.ok(prompt.length > 5000 && prompt.length <= 100_000, `${probe.name}: ${prompt.length}`);
  }
});
