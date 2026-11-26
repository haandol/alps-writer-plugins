// The business-change fixture and its model change tool run for real: Ontology
// Writer's query, impact and apply in a committed fixture, the boundaries the
// tool keeps, and one scripted trial through the fixture MCP server with a stub
// target instead of a model.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createWorkspace, makeTools, snapshot } from "../evals/regression/workspace.mjs";
import { runCase } from "../evals/regression/run.mjs";
import {
  commitWorkspace,
  MODEL_DRAFT,
  MODEL_TOOL,
  modelChangeScope,
  ONTOLOGY_ROOT,
  sessionStartContext,
  withModelChange,
} from "../evals/regression/model-change.mjs";
import { executionOutcome } from "../evals/lib/execution-checks.mjs";
import {
  businessChangeCases,
  courseEnrollment,
  DRAFT_ROOT,
  ROWS,
  RULE,
} from "../evals/skills/business-change-cases.mjs";
import { PLUGIN_ROOT } from "./helpers.mjs";

const dirs = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "business-change-"));
  dirs.push(dir);
  return dir;
};
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const MODEL = "docs/ontology/enrollment.ttl";
const BILLING = "docs/adr/billing/fee/0001-collect-course-fee.md";
const SEAT = "docs/adr/enrollment/seat/0001-confirm-paid-seat.md";
const CURRENT = "좌석은 그 신청의 수강료 전액이 결제된 뒤에만 확정된다.";
const CHANGED = "좌석은 그 신청의 선납금이 결제된 뒤 확정되고, 남은 수강료는 개강 전까지 결제된다.";

/** A committed copy of the fixture and a tool factory for one of its turns. */
function fixture() {
  const root = temp();
  createWorkspace(root, courseEnrollment(), PLUGIN_ROOT);
  commitWorkspace(root);
  const logPath = path.join(temp(), "events.jsonl");
  const tools = (turn, modelChange = { approvalTurn: 2 }, guidance = true) =>
    withModelChange(
      makeTools({
        root,
        pluginRoot: PLUGIN_ROOT,
        logPath,
        turn,
        guidance,
        draftRoot: DRAFT_ROOT,
        businessContext: true,
      }),
      { root, logPath, turn, guidance, modelChange, draftRoot: DRAFT_ROOT },
    );
  const events = () => readFileSync(logPath, "utf8").split("\n").filter(Boolean).map(JSON.parse);
  return { root, tools, events };
}
const model = (root) => readFileSync(path.join(root, MODEL), "utf8");

test("the committed fixture passes its checks and the query reports a settled model with the rule", () => {
  const { root, tools } = fixture();
  const t = tools(0);
  for (const kind of ["policy-tests", "structure"]) {
    const check = t.call("run_check", { kind });
    assert.equal(check.exitCode, 0, `${kind}: ${check.stdout}${check.stderr}`);
  }
  const context = t.call("query_business_context", {
    scope: "step",
    id: "enrollment.confirm-seat",
  });
  assert.match(context, new RegExp(RULE.replaceAll(".", "\\.")));
  assert.doesNotMatch(context, /UNCOMMITTED/);
  for (const scope of [
    ["category", "billing/fee"],
    ["process", "billing.collect"],
  ])
    assert.ok(
      t.call("query_business_context", { scope: scope[0], id: scope[1] }).includes(RULE),
      scope.join(" "),
    );
  const validate = spawnSync(
    process.execPath,
    [path.join(ONTOLOGY_ROOT, "scripts/ontology.mjs"), "validate"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(validate.status, 0, validate.stdout + validate.stderr);
  const session = sessionStartContext(root);
  assert.match(session, /\[ADR-first directive\]/);
  assert.match(session, /\[Business-context directive\]/);
  assert.match(session, /run \/ontology-edit before the ADR/);
});

test("the change tool runs the real impact and applies only from the approval turn with the shown hash", () => {
  const { root, tools, events } = fixture();
  const original = model(root);
  const first = tools(1);
  assert.throws(
    () => first.call(MODEL_TOOL, { action: "write", document: "x.ttl", content: "x" }),
    /prepare first/,
  );
  assert.throws(() => first.call(MODEL_TOOL, { action: "impact" }), /prepare first/);
  const prepared = first.call(MODEL_TOOL, { action: "prepare" });
  assert.deepEqual(prepared.documents, [`${MODEL_DRAFT}/enrollment.ttl`]);
  assert.throws(() => first.call(MODEL_TOOL, { action: "prepare" }), /already exists/);
  for (const document of ["../escape.ttl", "/abs.ttl", "notes.md", "a/../b.ttl", ""])
    assert.throws(
      () => first.call(MODEL_TOOL, { action: "write", document, content: "x" }),
      /relative \.ttl path|confined/,
      document,
    );
  assert.throws(
    () => first.call(MODEL_TOOL, { action: "impact", baseHash: "a".repeat(64) }),
    /impact takes only/,
  );
  for (const action of ["shell", "constructor", "__proto__"])
    assert.throws(() => first.call(MODEL_TOOL, { action }), /expected action/, action);
  assert.throws(
    () => first.call(MODEL_TOOL, { action: "impact", extra: 1 }),
    /unexpected argument/,
  );
  const draft = readFileSync(path.join(root, MODEL_DRAFT, "enrollment.ttl"), "utf8");
  assert.equal(draft, original, "the draft is an independent copy of the model");
  first.call(MODEL_TOOL, {
    action: "write",
    document: "enrollment.ttl",
    content: draft.replace(CURRENT, CHANGED),
  });
  const impact = first.call(MODEL_TOOL, { action: "impact" });
  assert.equal(impact.exitCode, 0, impact.stderr);
  const summary = JSON.parse(impact.stdout);
  assert.equal(summary.draftValid, true);
  assert.equal(summary.same, false);
  assert.deepEqual(summary.processesToPropose, ["billing.collect", "enrollment.enroll"]);
  assert.ok(summary.affectedAdrs.includes(BILLING) && summary.affectedAdrs.includes(SEAT));
  assert.throws(
    () => first.call(MODEL_TOOL, { action: "apply", baseHash: summary.baseHash }),
    /refused before the user's approval turn/,
  );
  assert.equal(model(root), original);
  // A turn without an approval turn never applies.
  assert.throws(
    () => tools(5, {}).call(MODEL_TOOL, { action: "apply", baseHash: summary.baseHash }),
    /refused before the user's approval turn/,
  );
  const second = tools(2);
  for (const bad of [{ baseHash: "HEAD" }, { baseHash: summary.baseHash, log: ["a\nb"] }])
    assert.throws(() => second.call(MODEL_TOOL, { action: "apply", ...bad }), /baseHash|log/);
  const stale = second.call(MODEL_TOOL, { action: "apply", baseHash: "0".repeat(64) });
  assert.notEqual(stale.exitCode, 0, "the real apply refuses a base hash no summary showed");
  assert.deepEqual(stale.changed, []);
  assert.equal(model(root), original);
  const saved = second.call(MODEL_TOOL, {
    action: "apply",
    baseHash: summary.baseHash,
    log: [`${RULE}: 전액 결제 뒤 확정에서 선납금 결제 뒤 확정으로 — 학원이 분할 납부를 허용`],
  });
  assert.equal(saved.exitCode, 0, saved.stdout + saved.stderr);
  assert.deepEqual(saved.changed, ["docs/ontology/change-log.md", MODEL]);
  assert.ok(model(root).includes(CHANGED) && !model(root).includes(CURRENT));
  assert.match(model(root), /onto:status "Proposed"/);
  // Every call of both tool layers is in one ordered log.
  const log = events();
  assert.deepEqual(
    log.map((e) => e.seq),
    log.map((_, i) => i + 1),
  );
  const applies = log.filter((e) => e.kind === "request" && e.arguments?.action === "apply");
  assert.deepEqual(
    applies.map((e) => e.turn),
    [1, 5, 2, 2, 2, 2],
  );
});

test("the document tools refuse the model and Ontology Writer's guidance stays read-only", () => {
  const { root, tools, events } = fixture();
  const before = snapshot(root);
  const t = tools(1);
  t.call("prepare_draft", {});
  for (const [name, args] of [
    ["write_file", { path: "docs/ontology/change-log.md", content: "x" }],
    ["write_file", { path: MODEL, content: "x" }],
    ["write_file", { path: `${DRAFT_ROOT}/docs/ontology/change-log.md`, content: "x" }],
    ["delete_file", { path: MODEL }],
    ["move_file", { from: MODEL, to: "docs/ontology/other.ttl" }],
    ["move_file", { from: BILLING, to: "docs/ontology/billing.md" }],
  ])
    assert.throws(() => t.call(name, args), /changes only through change_business_model apply/);
  assert.equal(readFileSync(path.join(root, MODEL), "utf8"), before[MODEL]);
  // Other documents keep their usual permissions.
  t.call("write_file", { path: `${DRAFT_ROOT}/${SEAT}`, content: "draft" });
  const skill = t.call("read_file", { path: "ontology-plugin/skills/ontology-edit/SKILL.md" });
  assert.match(skill, /^---\nname: ontology-edit/);
  const listed = t.call("list_files", { prefix: "ontology-plugin/references" });
  assert.ok(listed.includes("ontology-plugin/references/change-unit.md"));
  assert.ok(listed.every((file) => file.startsWith("ontology-plugin/references/")));
  for (const args of [
    { path: "ontology-plugin/scripts/ontology.mjs" },
    { path: "ontology-plugin/../adr-writer/skills/adr-new/SKILL.md" },
    { path: "ontology-plugin/skills/ontology-edit/SKILL.md", extra: true },
  ])
    assert.throws(() => t.call("read_file", args), /advertised|confined|unexpected/);
  const ablated = tools(1, {}, false);
  assert.throws(
    () => ablated.call("read_file", { path: "ontology-plugin/skills/ontology-edit/SKILL.md" }),
    /unavailable in this condition/,
  );
  assert.throws(
    () => ablated.call("list_files", { prefix: "ontology-plugin/" }),
    /unavailable in this condition/,
  );
  const refused = events().filter((e) => e.kind === "result" && e.ok === false);
  assert.ok(refused.length >= 9, "every refusal is recorded as evidence");
  const reads = events().filter(
    (e) => e.kind === "result" && e.ok && ["read_file", "list_files"].includes(e.tool),
  );
  assert.ok(reads.every((e) => e.result === "(read completed)"));
});

/** Call the fixture tools as the target would, through the MCP server the run configured. */
function callTools(config, calls) {
  const args = JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args;
  const messages = calls.map(([name, args], index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method: "tools/call",
    params: { name, arguments: args },
  }));
  const result = spawnSync(process.execPath, args, {
    input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line).result);
}
const text = (result) => {
  assert.notEqual(result.isError, true, result.content[0].text);
  return result.content[0].text;
};

test("a scripted approved trial runs through the fixture MCP server and passes every gate", async () => {
  const item = {
    ...businessChangeCases.find((c) => c.id === "business-change-approved-meaning-settles-rows"),
    type: "execution",
  };
  const files = courseEnrollment();
  const prompts = [];
  let baseHash;
  const invoke = async ({ prompt, config, timeoutMs }) => {
    prompts.push({ prompt, timeoutMs });
    if (prompts.length === 1) {
      const [query, , draft] = callTools(config, [
        ["query_business_context", { scope: "step", id: "enrollment.confirm-seat" }],
        [MODEL_TOOL, { action: "prepare" }],
        ["read_file", { path: `${MODEL_DRAFT}/enrollment.ttl` }],
      ]);
      assert.match(text(query), /enrollment\.full-fee-before-seat/);
      const [, impact, , revision] = callTools(config, [
        [
          MODEL_TOOL,
          {
            action: "write",
            document: "enrollment.ttl",
            content: text(draft).replace(CURRENT, CHANGED),
          },
        ],
        [MODEL_TOOL, { action: "impact" }],
        ["prepare_draft", {}],
        [
          "write_file",
          {
            path: `${DRAFT_ROOT}/${SEAT}`,
            content: files[SEAT].replace(
              ROWS.seat,
              "좌석은 그 신청의 수강료 50% 선납금이 결제된 것을 확인한 뒤 확정한다.",
            ),
          },
        ],
      ]);
      text(revision);
      baseHash = JSON.parse(JSON.parse(text(impact)).stdout).baseHash;
    } else {
      const [saved] = callTools(config, [[MODEL_TOOL, { action: "apply", baseHash }]]);
      assert.equal(JSON.parse(text(saved)).exitCode, 0);
      for (const result of callTools(config, [
        [
          "write_file",
          {
            path: BILLING,
            content: files[BILLING].replace(
              ROWS.billing,
              "수강료의 50%를 선납금으로 먼저 받고 잔금은 개강 전까지 받는다.",
            ),
          },
        ],
        [
          "write_file",
          {
            path: SEAT,
            content: files[SEAT].replace(
              ROWS.seat,
              "좌석은 그 신청의 수강료 50% 선납금이 결제된 것을 확인한 뒤 확정한다.",
            ),
          },
        ],
        ["demote_adr_status", { path: BILLING }],
        ["demote_adr_status", { path: SEAT }],
      ]))
        text(result);
    }
    return { text: "응답", models: ["stub-target"], ms: 1 };
  };
  const directory = temp();
  const result = await runCase(item, { name: "candidate", root: PLUGIN_ROOT }, 1, directory, {
    timeout: 30,
    invoke,
    referenceDate: "2026-11-27",
    "capture-only": true,
  });
  assert.equal(result.verdict, "UNSCORED", result.error);
  assert.deepEqual(
    prompts.map((p) => p.timeoutMs),
    [1_200_000, 1_200_000],
  );
  for (const { prompt } of prompts) {
    assert.match(prompt, /<session-start-context>\n\[ADR-first directive\]/);
    assert.match(prompt, /\[Business-context directive\]/);
  }
  assert.match(prompts[1].prompt, /baseHash/, "the next turn replays the shown summary");
  const evidence = JSON.parse(
    readFileSync(path.join(directory, result.artifactDirectory, "evidence.json"), "utf8"),
  );
  assert.deepEqual(
    item.verifyEvidence(evidence).filter((c) => !c.pass),
    [],
  );
  assert.equal(evidence.checkpoints[0].files[MODEL], files[MODEL], "turn 1 leaves the model");
  assert.ok(
    !Object.keys(evidence.after).some((f) => f.startsWith(`${DRAFT_ROOT}/docs/adr/README`)),
  );
  const root = path.join(directory, result.artifactDirectory, "workspace");
  const finalTools = makeTools({
    root,
    pluginRoot: PLUGIN_ROOT,
    logPath: path.join(temp(), "final.jsonl"),
    turn: 2,
  });
  const { checks } = executionOutcome(
    finalTools,
    modelChangeScope(item, evidence),
    evidence,
    item.build(),
    item.verifyEvidence,
  );
  assert.deepEqual(
    checks.filter((c) => !c.pass).map((c) => c.label),
    [],
  );
  // Without the scope, the shared checks would reject the saved model as an unauthorized change.
  assert.throws(
    () => executionOutcome(finalTools, item, evidence, item.build(), item.verifyEvidence),
    /immutable fixture differs/,
  );
});
