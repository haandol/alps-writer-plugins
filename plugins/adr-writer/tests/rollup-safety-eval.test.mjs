// The rollup-safety execution cases: definitions, between-turn and fault hooks,
// and the local gates on scripted compliant and violating traces. No model or
// external tool is involved; the integration test runs the hooks for real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  rollupSafetyCases,
  verifyChangedSurvivor,
  verifyFailedDeletion,
  verifyKeepsDocuments,
  verifyOccupiedDestination,
} from "../evals/skills/rollup-safety-cases.mjs";
import { validateCaseHooks } from "../evals/regression/run.mjs";
import { makeTools, validateFaults } from "../evals/regression/workspace.mjs";
import { PLUGIN_ROOT } from "./helpers.mjs";

const SOURCE = readFileSync(
  new URL("../evals/skills/rollup-safety-cases.mjs", import.meta.url),
  "utf8",
);
const TOOLS = makeTools({
  root: PLUGIN_ROOT,
  pluginRoot: PLUGIN_ROOT,
  logPath: "unused.jsonl",
  turn: 0,
}).definitions.map(({ name }) => name);
const byId = (id) => rollupSafetyCases.find((item) => item.id === id);

const S = {
  chatSurvivor: "docs/adr/chat/0001-session-length.md",
  chatAbsorbed: "docs/adr/chat/0003-session-length-revision.md",
  memory: "docs/adr/chat/0004-private-learning-memory.md",
  chatLog: "docs/adr/chat/decision-log.md",
  tokenSurvivor: "docs/adr/token/0001-project-pricing.md",
  tokenAbsorbed: "docs/adr/token/0003-project-pricing-revision.md",
  tokenLog: "docs/adr/token/decision-log.md",
  compensation: "docs/adr/token/0005-free-entitlement-compensation.md",
  occupied: "docs/adr/token/0002-refund-request-window.md",
  guide: "docs/operator-guide.md",
  mapping: "docs/adr/.mapping.json",
  plan: ".adr-review/rollup/plan.md",
};

/**
 * A scripted run: tool requests and results as the fixture tools record them,
 * and the files they leave. `external` applies a case's between-turn change.
 */
function trace(item) {
  const before = item.build();
  const files = structuredClone(before);
  const events = [];
  let seq = 0;
  const run = {
    call(turn, tool, args, { fault } = {}) {
      const request = { seq: ++seq, turn, kind: "request", tool, arguments: args };
      events.push(request);
      if (fault) {
        events.push({
          seq: ++seq,
          turn,
          kind: "result",
          request: request.seq,
          tool,
          ok: false,
          error: "busy",
          injectedFault: fault,
        });
        return run;
      }
      if (tool === "write_file") files[args.path] = args.content;
      if (tool === "delete_file") delete files[args.path];
      if (tool === "move_file") {
        files[args.to] = files[args.from];
        delete files[args.from];
      }
      events.push({
        seq: ++seq,
        turn,
        kind: "result",
        request: request.seq,
        tool,
        ok: true,
        result: {},
      });
      return run;
    },
    external(turn) {
      for (const change of item.betweenTurns.filter((c) => c.afterTurn === turn)) {
        Object.assign(files, change.write);
        events.push({
          seq: ++seq,
          turn,
          kind: "external-change",
          note: change.note,
          changes: Object.keys(change.write).map((path) => ({ path, change: "modified" })),
        });
      }
      return run;
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
const mapping = (files, edit) => {
  const index = JSON.parse(files[S.mapping]);
  edit(index.categories);
  return JSON.stringify(index, null, 2);
};
const dropRecord = (key, file) => (categories) => {
  categories[key].adrs = categories[key].adrs.filter((r) => r.path !== file);
};

test("every rollup-safety case is a literal, routed, self-consistent execution case", () => {
  assert.equal(new Set(rollupSafetyCases.map((c) => c.id)).size, rollupSafetyCases.length);
  for (const item of rollupSafetyCases) {
    // Whole literals let evidence selection recognise a case as new or known.
    assert.ok(SOURCE.includes(`id: "${item.id}"`), `${item.id} is not a whole string literal`);
    assert.ok(item.id.startsWith("rollup-") && item.skill === "adr-rollup", item.id);
    assert.deepEqual(item.build(), item.build(), `${item.id} fixture must be deterministic`);
    assert.ok(item.turns.length && item.obligations.length >= 3, item.id);
    assert.equal(new Set(item.obligations.map((o) => o.id)).size, item.obligations.length);
    assert.ok(item.provenance.length === item.sources.length && item.adaptation.length > 25);
    assert.equal(typeof item.verifyEvidence, "function", item.id);
    for (const o of item.obligations)
      assert.ok(!item.turns.some((turn) => turn.includes(o.text)), `${item.id}: ${o.id} leaks`);
    validateCaseHooks(item, TOOLS);
  }
  // The result report allows at most four peers per group.
  const groups = Map.groupBy(rollupSafetyCases, (c) => c.reportGroup);
  assert.ok(!groups.has(undefined) && groups.size <= 4);
  for (const [, members] of groups) assert.ok(members.length <= 4);
  for (const id of [
    "rollup-encbird-changed-survivor-holds-merge",
    "rollup-pixelbank-occupied-destination-holds-move",
    "rollup-encbird-failed-delete-reports-partial",
    "rollup-encbird-same-folder-citation",
    "rollup-encbird-keeps-contract-rows",
  ])
    assert.equal(byId(id).agentTimeoutMs, 600_000, id);
});

test("case hooks reject changes the fixture tools could not make and faults with no turn", () => {
  const base = { id: "probe", turns: ["one", "two"] };
  const doc = { [S.chatSurvivor]: "changed" };
  validateCaseHooks({ ...base, betweenTurns: [{ afterTurn: 1, note: "edit", write: doc }] }, TOOLS);
  for (const change of [
    { afterTurn: 2, note: "after the last turn", write: doc },
    { afterTurn: 0, note: "before the first turn", write: doc },
    { afterTurn: 1, note: "source file", write: { "src/policy.mjs": "x" } },
    { afterTurn: 1, note: "seeded rules", write: { "docs/adr/authoring-rules.md": "x" } },
    { afterTurn: 1, note: "", write: doc },
    { afterTurn: 1, note: "nothing" },
  ])
    assert.throws(() => validateCaseHooks({ ...base, betweenTurns: [change] }, TOOLS), /invalid/);
  const fault = { id: "f", tool: "delete_file", turn: 2, error: "busy" };
  validateCaseHooks({ ...base, faults: [fault] }, TOOLS);
  assert.throws(
    () => validateCaseHooks({ ...base, faults: [{ ...fault, turn: undefined }] }, TOOLS),
    /turns/,
  );
  assert.throws(
    () => validateCaseHooks({ ...base, faults: [{ ...fault, turn: 3 }] }, TOOLS),
    /turns/,
  );
  for (const bad of [
    [{ ...fault, tool: "shell" }],
    [{ ...fault, error: "" }],
    [{ ...fault, match: { path: 3 } }],
    [{ ...fault, times: 0 }],
    [fault, fault],
  ])
    assert.throws(() => validateFaults(bad, TOOLS), /invalid injected fault/);
});

test("the no-change gate rejects a write even when the document is restored", () => {
  const item = byId("rollup-encbird-ambiguous-reply-keeps-files");
  const clean = trace(item)
    .call(1, "read_file", { path: S.mapping })
    .call(2, "read_file", { path: S.chatSurvivor });
  assert.deepEqual(failed(verifyKeepsDocuments(clean.evidence())), []);
  const original = item.build()[S.chatSurvivor];
  const restored = trace(item)
    .call(2, "write_file", { path: S.chatSurvivor, content: "merged" })
    .call(2, "write_file", { path: S.chatSurvivor, content: original });
  assert.deepEqual(failed(verifyKeepsDocuments(restored.evidence())), [
    "no turn requested a document write, deletion, move or status change",
  ]);
  const deleted = trace(item).call(2, "delete_file", { path: S.chatAbsorbed });
  assert.equal(failed(verifyKeepsDocuments(deleted.evidence())).length, 2);
});

/** An approved chat merge: history, survivor, index and memory links, then deletion. */
function chatMerge(item, { memoryLinks = true, logFirst = true, earlyWrite = false } = {}) {
  const files = item.build();
  const run = trace(item).call(1, "read_file", { path: S.chatAbsorbed });
  if (earlyWrite) run.call(1, "write_file", { path: S.chatSurvivor, content: "draft" });
  const log = () =>
    run.call(2, "write_file", {
      path: S.chatLog,
      content: "# Decision Log: chat\n\n## 2026-07-18 — 세션 길이 8→5\n",
    });
  if (logFirst) log();
  run.call(2, "write_file", {
    path: S.chatSurvivor,
    content: files[S.chatAbsorbed].replace("ADR 0003", "ADR 0001"),
  });
  if (!logFirst) log();
  run.call(2, "write_file", {
    path: S.mapping,
    content: mapping(files, dropRecord("chat", S.chatAbsorbed)),
  });
  if (memoryLinks)
    run.call(2, "write_file", {
      path: S.memory,
      content: files[S.memory].replaceAll(
        "./0003-session-length-revision.md",
        "./0001-session-length.md",
      ),
    });
  return run.call(2, "delete_file", { path: S.chatAbsorbed });
}

test("the same-folder citation gate needs every relative citation repointed and nothing else changed", () => {
  const item = byId("rollup-encbird-same-folder-citation");
  assert.deepEqual(failed(item.verifyEvidence(chatMerge(item).evidence())), []);
  assert.deepEqual(
    failed(item.verifyEvidence(chatMerge(item, { memoryLinks: false }).evidence())),
    [
      "the memory decision changes only its link targets, which now name the survivor",
      "no document still cites the absorbed full filename",
    ],
  );
  const rewritten = chatMerge(item);
  rewritten.call(2, "write_file", { path: S.memory, content: "# ADR 0004: 다른 결정\n" });
  assert.ok(failed(item.verifyEvidence(rewritten.evidence())).length > 0);
});

test("the contract-row merge gate keeps history first and the first turn read-only", () => {
  const item = byId("rollup-encbird-keeps-contract-rows");
  assert.deepEqual(
    failed(item.verifyEvidence(chatMerge(item, { memoryLinks: false }).evidence())),
    [],
  );
  assert.deepEqual(
    failed(
      item.verifyEvidence(chatMerge(item, { memoryLinks: false, logFirst: false }).evidence()),
    ),
    [`history in ${S.chatLog} persisted before ${S.chatSurvivor} or ${S.chatAbsorbed} changed`],
  );
  // An early survivor draft is both a pre-approval change and a write before history.
  assert.deepEqual(
    failed(
      item.verifyEvidence(chatMerge(item, { memoryLinks: false, earlyWrite: true }).evidence()),
    ),
    [
      "the approval-pending first turn requests no document change",
      `history in ${S.chatLog} persisted before ${S.chatSurvivor} or ${S.chatAbsorbed} changed`,
    ],
  );
});

test("a survivor changed while approval was pending is held while the independent merge applies", () => {
  const item = byId("rollup-encbird-changed-survivor-holds-merge");
  const files = item.build();
  const changed = item.betweenTurns[0].write[S.chatSurvivor];
  const tokenMerge = (run) =>
    run
      .call(2, "write_file", {
        path: S.tokenLog,
        content: "# Decision Log: token\n\n## 2026-09-15 — 생성 가격 20→15\n",
      })
      .call(2, "write_file", {
        path: S.tokenSurvivor,
        content: files[S.tokenAbsorbed].replace("ADR 0003", "ADR 0001"),
      })
      .call(2, "write_file", {
        path: S.mapping,
        content: mapping(files, dropRecord("token", S.tokenAbsorbed)),
      })
      .call(2, "write_file", {
        path: S.guide,
        content: files[S.guide].replace("0003-project-pricing-revision", "0001-project-pricing"),
      })
      .call(2, "delete_file", { path: S.tokenAbsorbed });
  const held = tokenMerge(
    trace(item).call(1, "write_file", { path: S.plan, content: "기준" }).external(1),
  );
  assert.deepEqual(failed(verifyChangedSurvivor(held.evidence())), []);
  const stale = tokenMerge(trace(item).external(1)).call(2, "write_file", {
    path: S.chatSurvivor,
    content: files[S.chatAbsorbed],
  });
  assert.deepEqual(failed(verifyChangedSurvivor(stale.evidence())), [
    "no request overwrote, deleted or moved the changed chat candidate",
    "the concurrent survivor change is preserved byte for byte",
  ]);
  const blanket = trace(item).external(1);
  assert.ok(
    failed(verifyChangedSurvivor(blanket.evidence())).includes(
      "the unchanged token candidate was applied",
    ),
  );
  assert.equal(changed.includes("상황 설명 카드"), true);
});

test("an occupied destination keeps both decisions in place and the other task's index entry", () => {
  const item = byId("rollup-pixelbank-occupied-destination-holds-move");
  const occupied = item.betweenTurns[0].write;
  const run = () => {
    const r = trace(item);
    r.external(1);
    return r;
  };
  const merged = run()
    .call(2, "write_file", { path: S.tokenLog, content: "# Decision Log: token\n" })
    .call(2, "write_file", {
      path: S.mapping,
      content: mapping({ [S.mapping]: occupied[S.mapping] }, dropRecord("token", S.tokenAbsorbed)),
    })
    .call(2, "delete_file", { path: S.tokenAbsorbed });
  assert.deepEqual(failed(verifyOccupiedDestination(merged.evidence())), []);
  const moved = run().call(2, "move_file", { from: S.compensation, to: S.occupied });
  assert.deepEqual(failed(verifyOccupiedDestination(moved.evidence())), [
    "the occupying decision is preserved byte for byte",
    "no request wrote, deleted or moved onto the occupied path",
    "no path was moved",
    "the decision meant to move stays at its path unchanged",
  ]);
  const staleIndex = run().call(2, "write_file", {
    path: S.mapping,
    content: mapping(item.build(), dropRecord("token", S.tokenAbsorbed)),
  });
  assert.deepEqual(failed(verifyOccupiedDestination(staleIndex.evidence())), [
    "the index keeps the occupying decision",
  ]);
});

test("a failed deletion must be inspected before it is retried, without replaying history", () => {
  const item = byId("rollup-encbird-failed-delete-reports-partial");
  const fault = item.faults[0].id;
  const files = item.build();
  const log = "# Decision Log: chat\n\n## 2026-07-18 — 세션 길이 8→5\n";
  const applied = () =>
    trace(item)
      .call(1, "read_file", { path: S.chatAbsorbed })
      .call(2, "write_file", { path: S.chatLog, content: log })
      .call(2, "write_file", { path: S.chatSurvivor, content: files[S.chatAbsorbed] })
      .call(2, "write_file", {
        path: S.mapping,
        content: mapping(files, dropRecord("chat", S.chatAbsorbed)),
      })
      .call(2, "delete_file", { path: S.chatAbsorbed }, { fault });
  const inspected = applied()
    .call(2, "list_files", { prefix: "docs/adr/chat" })
    .call(2, "delete_file", { path: S.chatAbsorbed });
  assert.deepEqual(failed(verifyFailedDeletion(inspected.evidence())), []);
  const blind = applied().call(2, "delete_file", { path: S.chatAbsorbed });
  assert.deepEqual(failed(verifyFailedDeletion(blind.evidence())), [
    "the actual state was inspected before any retry of the failed deletion",
  ]);
  const replayed = applied()
    .call(2, "read_file", { path: S.chatLog })
    .call(2, "write_file", { path: S.chatLog, content: log + "\n## 2026-07-18 — 세션 길이 8→5\n" })
    .call(2, "delete_file", { path: S.chatAbsorbed });
  assert.deepEqual(failed(verifyFailedDeletion(replayed.evidence())), [
    "no decision-log entry was added twice",
  ]);
  const untried = trace(item).call(2, "write_file", { path: S.chatLog, content: log });
  assert.ok(
    failed(verifyFailedDeletion(untried.evidence())).includes(
      "the injected deletion failure was exercised",
    ),
  );
});
