// The business-change execution cases: definitions, the model-change flag's
// isolation from every other case, and the local gates on scripted compliant
// and violating traces. No model or external tool is involved; the integration
// test runs the change tool and the fixture for real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  businessChangeCases,
  DRAFT_ROOT,
  ROWS,
  RULE,
  verifyApprovedMeaning,
  verifyContractOnly,
  verifyDeclinedMeaning,
  verifyMeaningFirst,
} from "../evals/skills/business-change-cases.mjs";
import { rollupSafetyCases } from "../evals/skills/rollup-safety-cases.mjs";
import {
  MODEL_DRAFT,
  MODEL_TOOL,
  modelChangeScope,
  targetsModel,
  validateModelChange,
} from "../evals/regression/model-change.mjs";
import { executionPrompt, validateCaseHooks } from "../evals/regression/run.mjs";
import { toolServerConfig, toolServerOptions } from "../evals/regression/tool-config.mjs";
import { makeTools } from "../evals/regression/workspace.mjs";
import { behaviourFingerprint, recordDependencies } from "../evals/lib/evaluation-cache.mjs";
import { evidenceSources } from "../evals/regression/judge.mjs";
import { PLUGIN_ROOT } from "./helpers.mjs";

const SOURCE = readFileSync(
  new URL("../evals/skills/business-change-cases.mjs", import.meta.url),
  "utf8",
);
const TOOLS = makeTools({
  root: PLUGIN_ROOT,
  pluginRoot: PLUGIN_ROOT,
  logPath: "unused.jsonl",
  turn: 0,
}).definitions.map(({ name }) => name);
const byId = (id) => businessChangeCases.find((item) => item.id === id);
const S = {
  model: "docs/ontology/enrollment.ttl",
  billing: "docs/adr/billing/fee/0001-collect-course-fee.md",
  seat: "docs/adr/enrollment/seat/0001-confirm-paid-seat.md",
  request: "docs/adr/enrollment/apply/0001-accept-seat-request.md",
  mapping: "docs/adr/.mapping.json",
};
const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const NEW_MEANING =
  "좌석은 그 신청의 선납금이 결제된 뒤 확정되고, 남은 수강료는 개강 전까지 결제된다.";

/**
 * A scripted run: tool requests and results as the fixture tools record them,
 * and the files they leave. The model change tool's actions change the draft
 * and, on a successful apply, the model.
 */
function trace(item) {
  const before = item.build();
  const files = structuredClone(before);
  const events = [];
  let seq = 0;
  const run = {
    call(turn, tool, args, { ok = true, result = {}, error = "refused" } = {}) {
      const request = { seq: ++seq, turn, kind: "request", tool, arguments: args };
      events.push(request);
      if (ok && tool === "write_file") files[args.path] = args.content;
      if (ok && tool === MODEL_TOOL && args.action === "write")
        files[`${MODEL_DRAFT}/${args.document}`] = args.content;
      if (ok && tool === MODEL_TOOL && args.action === "prepare")
        files[`${MODEL_DRAFT}/enrollment.ttl`] = before[S.model];
      events.push({
        seq: ++seq,
        turn,
        kind: "result",
        request: request.seq,
        tool,
        ok,
        ...(ok ? { result } : { error }),
      });
      return run;
    },
    query(turn, id = "enrollment.confirm-seat") {
      return run.call(
        turn,
        "query_business_context",
        { scope: "step", id },
        { result: `Business context — step "${id}"\n  rule ${RULE} "전액 결제 뒤 좌석 확정"` },
      );
    },
    /** prepare, write and impact: a valid proposal with a semantic difference. */
    propose(turn, { hash = HASH, valid = true } = {}) {
      return run
        .call(turn, MODEL_TOOL, { action: "prepare" })
        .call(turn, MODEL_TOOL, {
          action: "write",
          document: "enrollment.ttl",
          content: before[S.model].replace("수강료 전액이 결제된 뒤에만 확정된다.", NEW_MEANING),
        })
        .call(
          turn,
          MODEL_TOOL,
          { action: "impact" },
          {
            result: {
              exitCode: 0,
              stdout: JSON.stringify({ baseHash: hash, draftValid: valid, same: false }),
              stderr: "",
            },
          },
        );
    },
    apply(turn, { hash = HASH, ok = true } = {}) {
      if (ok) files[S.model] = files[`${MODEL_DRAFT}/enrollment.ttl`];
      return run.call(
        turn,
        MODEL_TOOL,
        { action: "apply", baseHash: hash },
        { ok, result: { exitCode: 0, stdout: "✓ applied", stderr: "", changed: [S.model] } },
      );
    },
    write(turn, file, edit) {
      return run.call(turn, "write_file", { path: file, content: edit(files[file] ?? "") });
    },
    evidence() {
      return {
        before,
        after: files,
        events,
        turns: item.turns,
        replies: item.turns.map(() => "응답"),
      };
    },
  };
  return run;
}
const failed = (checks) => checks.filter((c) => !c.pass).map((c) => c.label);
const settle = (text) =>
  text
    .replace(ROWS.billing, "수강료의 50%를 선납금으로 먼저 받고 잔금은 개강 전까지 받는다.")
    .replace(ROWS.seat, "좌석은 그 신청의 수강료 50% 선납금이 결제된 것을 확인한 뒤 확정한다.");
const pending = (text) =>
  text.replace(ROWS.seat, `[미정] ${ROWS.seat} 선납금 확정 규칙 승인 대기.`);
const toFive = (text) =>
  text.replace(
    ROWS.attempts,
    "카드 결제 시도는 신청당 최대 5회이며, 6번째 시도는 거절되고 신청은 미결제로 남는다.",
  );

test("every business-change case is a literal, routed, self-consistent execution case", () => {
  assert.equal(businessChangeCases.length, 4);
  assert.equal(new Set(businessChangeCases.map((c) => c.id)).size, businessChangeCases.length);
  assert.deepEqual(businessChangeCases.map((c) => c.criterion).sort(), [
    "business-change.approved-meaning",
    "business-change.contract-only",
    "business-change.declined-meaning",
    "business-change.meaning-first",
  ]);
  for (const item of businessChangeCases) {
    // Whole literals let evidence selection recognise a case as new or known.
    assert.ok(SOURCE.includes(`id: "${item.id}"`), `${item.id} is not a whole string literal`);
    assert.ok(item.id.startsWith("business-change-") && item.skill === "adr-new", item.id);
    assert.ok(item.id.includes(item.criterion.slice("business-change.".length)), item.id);
    assert.deepEqual(item.build(), item.build(), `${item.id} fixture must be deterministic`);
    assert.ok(item.turns.length && item.obligations.length >= 3, item.id);
    assert.equal(new Set(item.obligations.map((o) => o.id)).size, item.obligations.length);
    assert.ok(item.adaptation.length > 25 && item.sources.length, item.id);
    assert.equal(typeof item.verifyEvidence, "function", item.id);
    assert.equal(item.agentTimeoutMs, 1_200_000, item.id);
    assert.ok(item.businessContext && item.draftRoot === DRAFT_ROOT, item.id);
    for (const o of item.obligations)
      assert.ok(!item.turns.some((turn) => turn.includes(o.text)), `${item.id}: ${o.id} leaks`);
    validateCaseHooks(item, TOOLS);
  }
  // Only the approved case has a turn that approves a model change.
  assert.deepEqual(
    businessChangeCases.map((c) => c.modelChange.approvalTurn),
    [undefined, 2, undefined, undefined],
  );
  // The result report allows at most four peers per group.
  const groups = Map.groupBy(businessChangeCases, (c) => c.reportGroup);
  assert.ok(!groups.has(undefined) && groups.size <= 4);
  for (const [, members] of groups) assert.ok(members.length <= 4);
});

test("the model-change flag validates its approval turn", () => {
  validateModelChange({});
  validateModelChange({ approvalTurn: 2 }, 2);
  for (const bad of [null, [], { approvalTurn: 1 }, { approvalTurn: 2.5 }, { turn: 2 }, true])
    assert.throws(() => validateModelChange(bad), /modelChange/);
  assert.throws(() => validateModelChange({ approvalTurn: 3 }, 2), /modelChange/);
  const item = { id: "probe", turns: ["one", "two"], modelChange: { approvalTurn: 3 } };
  assert.throws(() => validateCaseHooks(item, TOOLS), /modelChange/);
});

test("a case without the flag keeps its prompt, tool server and fingerprint", () => {
  const plain = rollupSafetyCases[0];
  const prompt = executionPrompt(plain, PLUGIN_ROOT, [], "2026-11-27", true, {
    sessionContext: "ignored without the flag",
  });
  assert.equal(prompt, executionPrompt(plain, PLUGIN_ROOT, [], "2026-11-27", true));
  assert.doesNotMatch(prompt, /ontology-plugin|change_business_model|session-start-context/);
  const options = { root: "/r", pluginRoot: "/p", logPath: "/l", turn: 1, checkerRoot: "/p" };
  const args = toolServerConfig(options).mcpServers.fixture.args;
  assert.ok(!args.some((arg) => arg.startsWith("--model-change=")));
  assert.equal(toolServerOptions(args.slice(1)).modelChange, undefined);
  const flagged = toolServerConfig({ ...options, modelChange: { approvalTurn: 2 } }).mcpServers
    .fixture.args;
  assert.deepEqual(toolServerOptions(flagged.slice(1)).modelChange, { approvalTurn: 2 });
  const item = { type: "execution", artifactPaths: [] };
  const base = behaviourFingerprint({ prompt: "p", root: null, item, date: "2026-11-27" });
  assert.equal(
    behaviourFingerprint({
      prompt: "p",
      root: null,
      item: { ...item, modelChange: undefined },
      date: "2026-11-27",
    }),
    base,
  );
  assert.notEqual(
    behaviourFingerprint({
      prompt: "p",
      root: null,
      item: { ...item, modelChange: {} },
      date: "2026-11-27",
    }),
    base,
  );
  assert.equal(modelChangeScope(plain, { before: { [S.model]: "x" } }), plain);
});

test("a flagged prompt names the change tool, Ontology Writer's guidance and the session context", () => {
  const item = byId("business-change-approved-meaning-settles-rows");
  const prompt = executionPrompt(item, PLUGIN_ROOT, [], "2026-11-27", true, {
    sessionContext: "[Business-context directive] probe",
  });
  assert.match(prompt, /ontology-plugin\/skills\//);
  // The client's skill listing names the change entry point the directive describes by purpose.
  assert.match(
    prompt,
    /^- \/ontology-edit \(ontology-plugin\/skills\/ontology-edit\/SKILL\.md\): Change a business workflow/m,
  );
  assert.match(prompt, /change_business_model runs Ontology Writer's model change commands/);
  assert.match(prompt, /query_business_context runs/);
  assert.match(prompt, /prepare_draft creates the disposable ADR candidate tree/);
  assert.match(
    prompt,
    /<session-start-context>\n\[Business-context directive\] probe\n<\/session-start-context>/,
  );
  const ablated = executionPrompt(item, PLUGIN_ROOT, [], "2026-11-27", false, {
    sessionContext: "ctx",
  });
  assert.match(ablated, /its guidance is unavailable in this condition/);
  assert.doesNotMatch(ablated, /ontology-plugin\/skills\//);
  assert.doesNotMatch(ablated, /\/ontology-edit/);
});

test("model reads and the change tool are recorded as dependencies; apply is a mutation", () => {
  const events = [
    {
      kind: "request",
      tool: "read_file",
      arguments: { path: "ontology-plugin/skills/ontology-edit/SKILL.md" },
    },
    { kind: "request", tool: "list_files", arguments: { prefix: "ontology-plugin/references/" } },
    { kind: "request", tool: MODEL_TOOL, arguments: { action: "impact" } },
  ];
  const keys = Object.keys(recordDependencies(events, { pluginRoot: PLUGIN_ROOT }));
  assert.deepEqual(keys, [
    "ontology-list:references",
    "ontology-read:skills/ontology-edit/SKILL.md",
    "program:ontology",
  ]);
  const values = recordDependencies(events, { pluginRoot: PLUGIN_ROOT });
  assert.ok(Object.values(values).every((value) => typeof value === "string"));
  assert.deepEqual(
    Object.keys(recordDependencies(events, { pluginRoot: PLUGIN_ROOT }, { guidance: false })),
    ["program:ontology"],
  );
  const apply = {
    seq: 1,
    turn: 2,
    kind: "request",
    tool: MODEL_TOOL,
    arguments: { action: "apply" },
  };
  const sources = evidenceSources({
    before: {},
    after: {},
    events: [apply, { ...apply, seq: 2, arguments: { action: "impact" } }],
    turns: ["a", "b"],
    replies: ["a", "b"],
  });
  assert.match(sources.execution, /Mutating requests in turn 2: 1/);
});

test("only the model surfaces join a flagged case's authorized outputs", () => {
  const item = byId("business-change-declined-meaning-keeps-rows");
  const scoped = modelChangeScope(item, {
    before: { [S.model]: "m", [S.billing]: "b", "src/policy.mjs": "c" },
    after: {
      [S.model]: "m",
      "docs/ontology/change-log.md": "log",
      [`${MODEL_DRAFT}/enrollment.ttl`]: "d",
      [`${DRAFT_ROOT}/docs/ontology/enrollment.ttl`]: "copy",
      [`${DRAFT_ROOT}/docs/adr/.mapping.json`]: "{}",
    },
  });
  assert.deepEqual(scoped.artifactPaths.sort(), [
    `${DRAFT_ROOT}/docs/ontology/enrollment.ttl`,
    `${MODEL_DRAFT}/enrollment.ttl`,
    "docs/ontology/change-log.md",
    S.model,
  ]);
  assert.deepEqual(scoped.requiredArtifactPaths, []);
  assert.equal(item.artifactPaths, undefined, "the case itself is not changed");
  for (const [event, hit] of [
    [{ tool: "write_file", arguments: { path: "docs/ontology/change-log.md" } }, true],
    [{ tool: "write_file", arguments: { path: `${DRAFT_ROOT}/docs/ontology/x.md` } }, true],
    [{ tool: "move_file", arguments: { from: S.billing, to: "docs/ontology/a.md" } }, true],
    [{ tool: "write_file", arguments: { path: S.billing } }, false],
    [{ tool: "read_file", arguments: { path: S.model } }, false],
  ])
    assert.equal(targetsModel(event, DRAFT_ROOT), hit, JSON.stringify(event));
});

test("meaning-first needs the query, then the model proposal, before any ADR revision", () => {
  const item = byId("business-change-meaning-first-proposes-model");
  const draftAdr = `${DRAFT_ROOT}/${S.seat}`;
  const compliant = trace(item)
    .query(1)
    .propose(1)
    .call(1, "prepare_draft", {})
    .write(1, draftAdr, () => pending(item.build()[S.seat]));
  assert.deepEqual(failed(verifyMeaningFirst(compliant.evidence())), []);
  const adrFirst = trace(item)
    .query(1)
    .write(1, draftAdr, () => pending(item.build()[S.seat]))
    .propose(1);
  assert.deepEqual(failed(verifyMeaningFirst(adrFirst.evidence())), [
    "no ADR revision, candidate or official, was written before that proposal",
  ]);
  const settled = trace(item).query(1).propose(1).write(1, S.seat, settle);
  assert.deepEqual(failed(verifyMeaningFirst(settled.evidence())), [
    "no turn requested an official document change, even temporarily",
    "every original document is byte-identical and none was added",
  ]);
  const applied = trace(item).query(1).propose(1).apply(1, { ok: false });
  assert.deepEqual(failed(verifyMeaningFirst(applied.evidence())), [
    "no model change apply was requested",
  ]);
  const unqueried = trace(item).propose(1).query(1);
  assert.deepEqual(failed(verifyMeaningFirst(unqueried.evidence())), [
    "the business context with the cross-step rule was returned before the first model change step",
  ]);
  const invalid = trace(item).query(1).propose(1, { valid: false });
  assert.ok(
    failed(verifyMeaningFirst(invalid.evidence())).includes(
      "a valid model change proposal with a semantic difference was prepared",
    ),
  );
  const direct = trace(item)
    .query(1)
    .propose(1)
    .call(1, "write_file", { path: "docs/ontology/change-log.md", content: "x" }, { ok: false });
  assert.deepEqual(failed(verifyMeaningFirst(direct.evidence())), [
    "no turn requested an official document change, even temporarily",
    "no document tool request targets the model; only the change tool can change it",
  ]);
});

/** The approved unit: proposal in turn 1, then apply and both dependent revisions. */
function approvedRun(item, { revise = [S.billing, S.seat], early = [] } = {}) {
  const run = trace(item).query(1).propose(1);
  for (const file of early) run.write(2, file, settle);
  run.apply(2);
  for (const file of revise) run.write(2, file, settle);
  return run.write(2, S.mapping, (text) => text.replaceAll("Accepted (2026-10-01)", "Proposed"));
}

test("approved-meaning settles the dependent rows only after the shown change is saved", () => {
  const item = byId("business-change-approved-meaning-settles-rows");
  assert.deepEqual(failed(verifyApprovedMeaning(approvedRun(item).evidence())), []);
  assert.deepEqual(
    failed(
      verifyApprovedMeaning(approvedRun(item, { revise: [S.billing], early: [S.seat] }).evidence()),
    ),
    ["every official ADR or index change came after the model change was saved"],
  );
  assert.deepEqual(
    failed(verifyApprovedMeaning(approvedRun(item, { revise: [S.seat] }).evidence())),
    ["both ADRs whose rows relied on the rule were revised"],
  );
  const earlyApply = trace(item).query(1).propose(1).apply(1, { ok: false }).apply(2);
  earlyApply.write(2, S.billing, settle).write(2, S.seat, settle);
  assert.deepEqual(failed(verifyApprovedMeaning(earlyApply.evidence())), [
    "no apply was requested before the approval turn",
  ]);
  // A draft changed after approval carries another base hash than the one shown.
  const changed = trace(item).query(1).propose(1).propose(2, { hash: OTHER_HASH });
  changed.apply(2, { hash: OTHER_HASH }).write(2, S.billing, settle).write(2, S.seat, settle);
  assert.deepEqual(failed(verifyApprovedMeaning(changed.evidence())), [
    "the saved change carries the base hash of the proposal shown before approval",
  ]);
  const firstTurnSave = trace(item).query(1).propose(1).write(1, S.seat, settle).apply(2);
  firstTurnSave.write(2, S.billing, settle);
  assert.deepEqual(failed(verifyApprovedMeaning(firstTurnSave.evidence())), [
    "the approval-pending first turn requests no official document change",
    "every official ADR or index change came after the model change was saved",
  ]);
  const unsaved = trace(item).query(1).propose(1).write(2, S.billing, settle);
  assert.ok(
    failed(verifyApprovedMeaning(unsaved.evidence())).includes(
      "the model change was saved once, after the approval",
    ),
  );
});

test("declined-meaning keeps the model and leaves the dependent rows current or pending", () => {
  const item = byId("business-change-declined-meaning-keeps-rows");
  const kept = trace(item).query(1).propose(1);
  assert.deepEqual(failed(verifyDeclinedMeaning(kept.evidence())), []);
  const marked = trace(item).query(1).propose(1).write(2, S.seat, pending);
  assert.deepEqual(failed(verifyDeclinedMeaning(marked.evidence())), []);
  const settled = trace(item).query(1).propose(1).write(2, S.seat, settle);
  assert.deepEqual(failed(verifyDeclinedMeaning(settled.evidence())), [
    `${S.seat} keeps its rule-dependent row in the current meaning or marks it pending`,
  ]);
  const applied = trace(item).query(1).propose(1).apply(2);
  assert.deepEqual(failed(verifyDeclinedMeaning(applied.evidence())), [
    "no apply was requested in any turn",
    "the model documents are byte-identical",
  ]);
  const refused = trace(item).query(1).propose(1).apply(2, { ok: false });
  assert.deepEqual(failed(verifyDeclinedMeaning(refused.evidence())), [
    "no apply was requested in any turn",
  ]);
  const unshown = trace(item).query(1);
  assert.deepEqual(failed(verifyDeclinedMeaning(unshown.evidence())), [
    "the business context with the cross-step rule was returned before the first model change step",
    "a valid model change proposal was shown in the first turn",
  ]);
});

test("contract-only revises the payments ADR after approval without any model proposal", () => {
  const item = byId("business-change-contract-only-revises-adr");
  const draft = `${DRAFT_ROOT}/${S.billing}`;
  const compliant = () =>
    trace(item)
      .query(1, "billing.collect-fee")
      .call(1, "prepare_draft", {})
      .write(1, draft, () => toFive(item.build()[S.billing]));
  assert.deepEqual(
    failed(verifyContractOnly(compliant().write(2, S.billing, toFive).evidence())),
    [],
  );
  assert.deepEqual(failed(verifyContractOnly(compliant().evidence())), [
    "the payments ADR holds the new attempt limit in place of the old row",
  ]);
  const proposed = compliant().propose(1).write(2, S.billing, toFive);
  assert.deepEqual(failed(verifyContractOnly(proposed.evidence())), [
    "no model change was drafted, checked or applied",
  ]);
  const early = trace(item).query(1).write(1, S.billing, toFive);
  assert.deepEqual(failed(verifyContractOnly(early.evidence())), [
    "the approval-pending first turn requests no official document change",
  ]);
  const unqueried = trace(item)
    .write(1, draft, () => toFive(item.build()[S.billing]))
    .query(1)
    .write(2, S.billing, toFive);
  assert.deepEqual(failed(verifyContractOnly(unqueried.evidence())), [
    "the business context with the cross-step rule was returned before the first ADR revision",
  ]);
  const wider = compliant().write(2, S.billing, toFive).write(2, S.seat, settle);
  assert.deepEqual(failed(verifyContractOnly(wider.evidence())), [
    "the ADRs of the other features are unchanged",
  ]);
});
