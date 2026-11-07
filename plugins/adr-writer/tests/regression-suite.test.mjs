import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chmodSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { cases, selectCases } from "../evals/regression/cases.mjs";
import {
  compareRuns,
  compareVerdicts,
  evidenceSources,
  validateJudgment,
  gradeEvidence,
} from "../evals/regression/judge.mjs";
import { parseArgs, copyPlugin, runPool, calendarDate } from "../evals/regression/run.mjs";
import { renderReport } from "../evals/regression/report.mjs";
import { invokeClaude } from "../evals/regression/claude.mjs";
import { PLUGIN, tempDirs, temp, sources, judgment } from "./regression-suite-helpers.mjs";

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

test("evaluation CLI disables installed skills as well as hooks, native tools and session reuse", async () => {
  const directory = temp();
  const executable = path.join(directory, "cli.mjs");
  writeFileSync(
    executable,
    `#!/usr/bin/env bun
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write(JSON.stringify({result: JSON.stringify(process.argv.slice(2)), modelUsage: {"shim-model": {}}})));
`,
  );
  chmodSync(executable, 0o755);
  const response = await invokeClaude({ prompt: "/adr-sync", cwd: directory, executable });
  const args = JSON.parse(response.text);
  for (const flag of [
    "--bare",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--no-session-persistence",
  ])
    assert.ok(args.includes(flag), flag);
  assert.equal(args[args.indexOf("--tools") + 1], "");
  assert.deepEqual(JSON.parse(args[args.indexOf("--mcp-config") + 1]), { mcpServers: {} });
});

test("explicit Bedrock credentials use only the chosen profile and do not mutate parent credentials", async () => {
  const directory = temp();
  const executable = path.join(directory, "profile-cli.mjs");
  writeFileSync(
    executable,
    `#!/usr/bin/env bun
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write(JSON.stringify({
  result: JSON.stringify({ args: process.argv.slice(2), profile: process.env.AWS_PROFILE,
    region: process.env.AWS_REGION, bedrock: process.env.CLAUDE_CODE_USE_BEDROCK,
    bearer: Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK), staticKey: Boolean(process.env.AWS_ACCESS_KEY_ID) }),
  modelUsage: {"profile-test":{}}
})));
`,
  );
  chmodSync(executable, 0o755);
  const previous = process.env.AWS_BEARER_TOKEN_BEDROCK;
  process.env.AWS_BEARER_TOKEN_BEDROCK = "fixture-only-bearer";
  try {
    const response = await invokeClaude({
      prompt: "test",
      cwd: directory,
      executable,
      model: "test-model",
      bedrock: { profile: "fixture-profile", region: "us-east-1" },
    });
    const actual = JSON.parse(response.text);
    assert.equal(actual.profile, "fixture-profile");
    assert.equal(actual.region, "us-east-1");
    assert.equal(actual.bedrock, "1");
    assert.equal(actual.bearer, false);
    assert.equal(actual.staticKey, false);
    assert.equal(actual.args[actual.args.indexOf("--setting-sources") + 1], "");
    assert.doesNotMatch(actual.args.join(" "), /fixture-only-bearer/);
    assert.equal(process.env.AWS_BEARER_TOKEN_BEDROCK, "fixture-only-bearer");
    await assert.rejects(
      () =>
        invokeClaude({
          prompt: "test",
          cwd: directory,
          executable,
          bedrock: { profile: "fixture-profile", region: "us-east-1" },
        }),
      /requires profile, region and model/,
    );
  } finally {
    if (previous === undefined) delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    else process.env.AWS_BEARER_TOKEN_BEDROCK = previous;
  }
});

const obligation = [{ id: "contract", text: "preserve the declared contract" }];

test("judge output cannot pass on missing/duplicate obligations or invented evidence", () => {
  assert.equal(validateJudgment(judgment(), obligation, sources).verdict, "PASS");
  assert.throws(
    () => validateJudgment({ obligations: [] }, obligation, sources),
    /every obligation/,
  );
  const duplicate = judgment();
  duplicate.obligations.push(duplicate.obligations[0]);
  assert.throws(() => validateJudgment(duplicate, obligation, sources), /duplicate/);
  const invented = judgment();
  invented.obligations[0].evidence[0].quote = "the limit is thirty";
  assert.throws(() => validateJudgment(invented, obligation, sources), /unsupported/);
  const absent = judgment();
  absent.obligations[0].evidence[0].source = "after:not-present.md";
  assert.throws(() => validateJudgment(absent, obligation, sources), /unsupported/);
  const empty = judgment();
  empty.obligations[0].evidence = [];
  assert.throws(() => validateJudgment(empty, obligation, sources), /requires evidence/);
});

test("FAIL and missing evidence are never flattened into PASS, and existing failure is not preserved success", () => {
  assert.equal(validateJudgment(judgment("FAIL"), obligation, sources).verdict, "FAIL");
  const unknown = judgment("UNVERIFIED");
  unknown.obligations[0].evidence = [];
  assert.equal(validateJudgment(unknown, obligation, sources).verdict, "UNVERIFIED");
  assert.equal(compareVerdicts("PASS", "FAIL"), "REGRESSION");
  assert.equal(compareVerdicts("FAIL", "FAIL"), "EXISTING_FAILURE");
  assert.equal(compareVerdicts("FAIL", "PASS"), "IMPROVED");
  assert.equal(compareVerdicts("PASS", "UNVERIFIED"), "INCONCLUSIVE");
  assert.equal(compareVerdicts(null, "PASS"), "NO_BASELINE");
});

test("judge format repair keeps strict evidence validation and records both attempts", async () => {
  const attempts = [];
  let calls = 0;
  const result = await gradeEvidence({
    obligations: obligation,
    sources,
    invoke: async (prompt) => {
      calls++;
      const raw = judgment();
      if (calls === 1) raw.obligations[0].evidence[0].quote = "invented quotation";
      else {
        assert.match(prompt, /unsupported evidence/);
        assert.match(prompt, /Do not force PASS/);
      }
      return { structured: raw };
    },
    onAttempt: (attempt) => attempts.push(attempt),
  });
  assert.equal(result.verdict, "PASS");
  assert.equal(calls, 2);
  assert.ok(attempts[0].error);
  assert.equal(attempts[1].error, null);
});

test("a semantic FAIL is not retried and two invalid citations remain an error", async () => {
  let calls = 0;
  const result = await gradeEvidence({
    obligations: obligation,
    sources,
    invoke: async () => {
      calls++;
      return { structured: judgment("FAIL") };
    },
  });
  assert.equal(result.verdict, "FAIL");
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    () =>
      gradeEvidence({
        obligations: obligation,
        sources,
        invoke: async () => {
          calls++;
          const raw = judgment();
          raw.obligations[0].evidence[0].quote = "not in evidence";
          return { structured: raw };
        },
      }),
    /unsupported evidence/,
  );
  assert.equal(calls, 2);
});

test("check output is available as verbatim text without nested JSON escape guessing", () => {
  const stdout = '{\n  "ok": true,\n  "errors": []\n}';
  const data = evidenceSources({
    before: {},
    after: {},
    replies: [],
    turns: [],
    events: [{ seq: 1, kind: "result", tool: "run_check", result: { stdout } }],
  });
  assert.equal(data["event:1:stdout"], stdout);
});

test("case selection and CLI flags reject accidental empty or mixed execution", () => {
  assert.equal(selectCases({ skill: "adr-sync" }).length, 4);
  assert.equal(selectCases({ only: "encbird" }).length, 6);
  assert.throws(() => selectCases({ skill: "adr-new" }));
  assert.throws(() => selectCases({ only: "not-a-case" }));
  assert.throws(() => parseArgs(["--live", "--prepare"]));
  assert.throws(() => parseArgs(["--runs", "0"]));
  assert.throws(() => parseArgs(["--out"]));
  assert.equal(parseArgs([]).live, false);
  assert.throws(() => parseArgs(["--jobs", "0"]));
  assert.throws(() => parseArgs(["--reference-date", "2026-02-30"]));
  assert.equal(parseArgs(["--reference-date", "2026-09-19"])["reference-date"], "2026-09-19");
});

test("calendar dates use the local day and comparison refuses different evaluation clocks", () => {
  assert.equal(calendarDate(new Date(2026, 8, 19, 0, 5)), "2026-09-19");
  const calls = [
    { stage: "target", models: ["same"] },
    { stage: "judge", models: ["same"] },
  ];
  assert.equal(
    compareRuns(
      { verdict: "PASS", referenceDate: "2026-09-18", calls },
      { verdict: "PASS", referenceDate: "2026-09-19", calls },
    ),
    "INCONCLUSIVE",
  );
});

test("parallel case workers keep a bounded count and await owned work after an error", async () => {
  let active = 0;
  let maximum = 0;
  const completed = [];
  await runPool([1, 2, 3, 4], 2, async (value) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setImmediate(resolve));
    completed.push(value);
    active--;
  });
  assert.equal(maximum, 2);
  assert.deepEqual(completed.sort(), [1, 2, 3, 4]);
  let otherFinished = false;
  await assert.rejects(
    () =>
      runPool([1, 2], 2, async (value) => {
        if (value === 1) throw new Error("worker failed");
        await new Promise((resolve) => setImmediate(resolve));
        otherFinished = true;
      }),
    /worker failed/,
  );
  assert.equal(otherFinished, true);
});

test("a model change or missing model identity prevents a prompt-regression conclusion", () => {
  const before = {
    verdict: "PASS",
    conditionHash: "same-fixed-task-rubric-verifier-and-limits",
    referenceDate: "2026-09-19",
    calls: [
      { stage: "target", models: ["model-a"] },
      { stage: "judge", models: ["judge"] },
    ],
  };
  const after = { ...before, verdict: "FAIL" };
  assert.equal(compareRuns(before, after), "REGRESSION");
  assert.equal(
    compareRuns(before, { ...after, calls: [{ stage: "target", models: ["model-b"] }] }),
    "INCONCLUSIVE",
  );
  assert.equal(compareRuns({ verdict: "PASS" }, after), "INCONCLUSIVE");
  assert.equal(
    compareRuns(before, { ...after, conditionHash: "different-rubric" }),
    "INCONCLUSIVE",
  );
  assert.equal(
    compareRuns(before, {
      ...after,
      calls: [
        {
          stage: "target",
          models: ["model-a"],
          modelEvidence: "requested-bedrock-inference-profile",
        },
        { stage: "judge", models: ["judge"] },
      ],
    }),
    "INCONCLUSIVE",
  );
  assert.equal(
    compareRuns({ ...before, pluginHash: "identical" }, { ...after, pluginHash: "identical" }),
    "SAME_SNAPSHOT",
  );
});

test("the selected current plugin is copied and hashed before an execution", () => {
  const target = path.join(temp(), "plugin");
  const selected = copyPlugin(target, PLUGIN);
  assert.match(selected.hash, /^[a-f0-9]{64}$/);
  assert.equal(
    readFileSync(path.join(target, "skills/adr-sync/SKILL.md"), "utf8"),
    readFileSync(path.join(PLUGIN, "skills/adr-sync/SKILL.md"), "utf8"),
  );
});

test("HTML escapes source responses and never labels preparation as a live success", () => {
  const report = {
    mode: "PREPARED_NOT_RUN",
    generatedAt: "test",
    cases: [cases[0]],
    runsPerCase: 1,
    variants: {},
    runs: [],
    datasetHash: "test",
    judgeHash: "test",
  };
  let html = renderReport(report);
  assert.match(html, /0\/1/);
  assert.match(html, /기준 버전이 없으면 회귀를 주장하지 않습니다/);
  report.runs.push({
    caseId: cases[0].id,
    variant: "candidate",
    repeat: 1,
    verdict: "ERROR",
    error: "<img src=x onerror=alert(1)>",
    replies: ["<script>bad()</script>"],
    artifactDirectory: "runs/test",
    changes: [],
  });
  html = renderReport(report);
  assert.doesNotMatch(html, /<img src=x|<script>bad/);
  assert.match(html, /&lt;script&gt;bad/);
});
