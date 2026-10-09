import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { withTmp, PLUGIN_ROOT } from "./helpers.mjs";
import { createWorkspace, makeTools, snapshot } from "../evals/regression/workspace.mjs";
import { encbirdRollupCases, verifyEncbirdRollup } from "../evals/skills/encbird-rollup-cases.mjs";
import {
  buildEncbirdCohortRollup,
  buildEncbirdPoolNoChain,
  encbirdRollupProvenance,
  rollupPaths as P,
} from "../evals/skills/encbird-rollup-fixtures.mjs";

function setup(dir, proposed = false) {
  const root = path.join(dir, "workspace"),
    log = path.join(dir, "events.jsonl");
  createWorkspace(root, buildEncbirdCohortRollup({ proposed }), PLUGIN_ROOT);
  const before = snapshot(root),
    checkpoints = [];
  const tools = (turn) =>
    makeTools({ root, pluginRoot: PLUGIN_ROOT, logPath: log, turn, artifactPaths: [P.plan] });
  const first = tools(1);
  first.call("read_file", { path: P.mapping });
  first.call("write_file", {
    path: P.plan,
    content: "검토용 계획: 같은 프리챗 턴 한도만 통합하고 독립 결정과 기존 코호트를 보존한다.",
  });
  checkpoints.push({ turn: 1, files: snapshot(root) });
  return {
    root,
    before,
    checkpoints,
    tools,
    evidence() {
      return {
        before,
        after: snapshot(root),
        events: readFileSync(log, "utf8").trim().split("\n").map(JSON.parse),
        checkpoints: [...checkpoints, { turn: 2, files: snapshot(root) }],
      };
    },
  };
}

function apply(f, { logLate = false, accepted = true, demote = false } = {}) {
  const t = f.tools(2);
  const survivor = f.before[P.absorbed]
    .replace("# ADR 0003:", "# ADR 0001:")
    .replace(
      /## Status\s+[^\n]+/,
      "## Status\n\n" + (accepted ? "Accepted (2026-10-07)" : "Proposed"),
    );
  const map = JSON.parse(f.before[P.mapping]);
  map.categories.chatbot.adrs = map.categories.chatbot.adrs.filter((r) => r.path !== P.absorbed);
  map.categories.chatbot.adrs[0].status = accepted ? "Accepted (2026-10-07)" : "Proposed";
  const history = () =>
    t.call("write_file", {
      path: P.log,
      content:
        "# Decision Log: chatbot\n\n## 2026-10-06 — 신규 세션 분량 변경\n\n- Current ADR: [현재 한도](0001-freechat-disposable-conversation.md)\n- What: 신규 TEXT 5→4, VOICE 6→5; 기존 코호트 유지\n- Why: 완료 부담 감소\n",
    });
  if (!logLate) history();
  if (demote) {
    const result = t.call("demote_adr_status", { path: P.survivor });
    assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  }
  t.call("write_file", { path: P.survivor, content: survivor });
  if (logLate) history();
  t.call("write_file", {
    path: P.reference,
    content: f.before[P.reference].replace(
      "../chatbot/0003-new-session-cohort-limits.md",
      "../chatbot/0001-freechat-disposable-conversation.md",
    ),
  });
  t.call("write_file", { path: P.mapping, content: JSON.stringify(map, null, 2) });
  t.call("delete_file", { path: P.absorbed });
}

test("current EncBird fixtures run local policies and lint without the source repository", () => {
  for (const item of encbirdRollupCases)
    withTmp((dir) => {
      createWorkspace(dir, item.build(), PLUGIN_ROOT);
      const tools = makeTools({
        root: dir,
        pluginRoot: PLUGIN_ROOT,
        logPath: path.join(dir, "checks.jsonl"),
        turn: 0,
      });
      for (const kind of ["policy-tests", "structure"]) {
        const r = tools.call("run_check", { kind });
        assert.equal(r.exitCode, 0, r.stdout + r.stderr);
      }
    });
  const source = encbirdRollupProvenance.sources.find((s) =>
    s.path.endsWith("chatTurnProgress.ts"),
  );
  assert.equal(
    createHash("sha256")
      .update(buildEncbirdCohortRollup()["src/chatTurnProgress.ts"])
      .digest("hex"),
    source.sha256,
  );
});

test("action checks accept both preserved completion states with history written first", () => {
  for (const proposed of [false, true])
    withTmp((dir) => {
      const f = setup(dir, proposed);
      apply(f, { accepted: !proposed, demote: proposed });
      assert.deepEqual(
        verifyEncbirdRollup(f.evidence(), { proposed }).filter((c) => !c.pass),
        [],
      );
    });
});

test("history after survivor overwrite and automatic Proposed promotion are rejected", () => {
  withTmp((dir) => {
    const f = setup(dir);
    apply(f, { logLate: true });
    assert.ok(
      verifyEncbirdRollup(f.evidence()).some(
        (c) => !c.pass && c.label.startsWith("history persisted"),
      ),
    );
  });
  withTmp((dir) => {
    const f = setup(dir, true);
    apply(f, { accepted: true });
    assert.ok(
      verifyEncbirdRollup(f.evidence(), { proposed: true }).some(
        (c) => !c.pass && c.label === "verified completion state retained",
      ),
    );
  });
});

test("a restored approval violation and unrelated body rewrite remain observable", () => {
  withTmp((dir) => {
    const f = setup(dir);
    const t = f.tools(1);
    t.call("write_file", {
      path: P.survivor,
      content: f.before[P.survivor] + "\n무단 임시 수정\n",
    });
    t.call("write_file", { path: P.survivor, content: f.before[P.survivor] });
    apply(f);
    const r = verifyEncbirdRollup(f.evidence());
    assert.ok(r.some((c) => !c.pass && c.label.startsWith("approval-pending")));
  });
  withTmp((dir) => {
    const f = setup(dir);
    apply(f);
    const t = f.tools(2);
    t.call("write_file", {
      path: P.reference,
      content: readFileSync(path.join(f.root, P.reference), "utf8").replace(
        "실제 학습자 4턴",
        "실제 학습자 9턴",
      ),
    });
    assert.ok(
      verifyEncbirdRollup(f.evidence()).some(
        (c) => !c.pass && c.label.startsWith("external owner only"),
      ),
    );
  });
});

test("pool no-chain accepts read-only inspection and rejects merging or new official artifacts", () => {
  const before = buildEncbirdPoolNoChain();
  const evidence = {
    before,
    after: { ...before },
    events: [],
    checkpoints: [{ turn: 1, files: before }],
  };
  assert.ok(verifyEncbirdRollup(evidence, { noChain: true }).every((c) => c.pass));
  const removed = Object.keys(before).find((p) => p.includes("0002-review"));
  delete evidence.after[removed];
  assert.ok(verifyEncbirdRollup(evidence, { noChain: true }).some((c) => !c.pass));
});

test("structurally valid contract loss is left for independent GEval meaning checks", () => {
  withTmp((dir) => {
    const f = setup(dir);
    apply(f);
    const t = f.tools(2);
    t.call("write_file", {
      path: P.survivor,
      content: readFileSync(path.join(f.root, P.survivor), "utf8").replace(
        "기존 TEXT는 실제 5턴, 기존 VOICE는 실제 6턴",
        "기존 TEXT도 실제 4턴, 기존 VOICE도 실제 5턴",
      ),
    });
    assert.ok(verifyEncbirdRollup(f.evidence()).every((c) => c.pass));
    // Exact file/action checks deliberately do not claim to understand cohort policy.
  });
});
