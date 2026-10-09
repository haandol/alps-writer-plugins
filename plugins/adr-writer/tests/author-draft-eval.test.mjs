import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, symlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { withTmp, PLUGIN_ROOT } from "./helpers.mjs";
import scenario, {
  deterministicScore,
  obligations,
} from "../evals/scenarios/author-keeps-values-and-lints.mjs";
import { authoringEvidenceChecks } from "../evals/lib/authoring-evidence.mjs";
import { makeTools, snapshot } from "../evals/regression/workspace.mjs";

const adr = "docs/adr/media/upload/0001-direct-upload.md";
const mapping = "docs/adr/.mapping.json";
const body = `# ADR 0001: direct upload

Date: 2026-10-09

## Status

Proposed

## Purpose

Keep large file bodies off the API server without exposing storage credentials.

## Decision Drivers

- A 100MB upload must not spike API memory.
- Storage credentials stay on the server.
- Support is available within two weeks.

## Decision

Clients upload directly to storage using signed URLs.

### Requirement contract

- Attachments are capped at 100MB.
- Signed URLs expire after 10 minutes.
- Free users can make 20 uploads per day.
- Files are 업로드중, 검증중, 사용가능 or 삭제됨; 삭제됨 is terminal.
- Upload failures explain whether retry is possible.
- Storage credentials never reach the client.

### Alternatives

- API proxy: retains the memory problem.
- Upload server: requires additional operations.

## Consequences

The client sends bytes directly to storage and handles failed uploads.

## Related

- None
`;
const index = JSON.stringify({
  categories: {
    "media/upload": {
      feature: "Upload",
      dependsOn: [],
      adrs: [{ path: adr, status: "Proposed", summary: "Signed direct upload with plan limits" }],
    },
  },
});

function fixture(dir) {
  const root = path.join(dir, "workspace"),
    log = path.join(dir, "events.jsonl");
  mkdirSync(root);
  scenario.build(root);
  const tools = makeTools({
    root,
    pluginRoot: PLUGIN_ROOT,
    logPath: log,
    turn: 1,
    draftRoot: scenario.draftRoot,
  });
  const events = () => readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  const put = (file, content) => tools.call("write_file", { path: file, content });
  const candidate = () => {
    tools.call("prepare_draft");
    put(`${scenario.draftRoot}/${adr}`, body);
    put(`${scenario.draftRoot}/${mapping}`, index);
  };
  const check = (draft = true, category = "media/upload") =>
    tools.call("run_check", { kind: "structure", draft, category });
  const apply = () => {
    put(adr, body);
    put(mapping, index);
  };
  return {
    root,
    log,
    tools,
    events,
    put,
    candidate,
    check,
    apply,
    checks: () =>
      authoringEvidenceChecks(events(), {
        draftRoot: scenario.draftRoot,
        category: "media/upload",
      }),
  };
}

test("candidate copies are independent, ignored, checked in their own root, and applied after verification", () =>
  withTmp((dir) => {
    const f = fixture(dir),
      before = snapshot(f.root);
    f.candidate();
    assert.notEqual(
      statSync(path.join(f.root, mapping)).ino,
      statSync(path.join(f.root, scenario.draftRoot, mapping)).ino,
    );
    assert.equal(readFileSync(path.join(f.root, mapping), "utf8"), before[mapping]);
    assert.equal(spawnSync("git", ["check-ignore", scenario.draftRoot], { cwd: f.root }).status, 0);
    const result = f.check();
    assert.equal(result.exitCode, 0, result.stdout + result.stderr);
    assert.equal(result.checkedRoot, scenario.draftRoot);
    assert.ok(result.documentHashes[adr]);
    assert.ok(!existsSync(path.join(f.root, adr)));
    f.apply();
    f.check(false);
    assert.ok(
      f.checks().every((c) => c.pass),
      JSON.stringify(f.checks()),
    );
    assert.ok(deterministicScore({ dir: f.root, events: f.events() }).every((c) => c.pass));
    const evidence = snapshot(f.root, scenario);
    assert.equal(evidence[`${scenario.draftRoot}/${adr}`], body);
    assert.ok(
      !(`${scenario.draftRoot}/docs/adr/authoring-rules.md` in evidence),
      "only immutable duplicate rules are excluded",
    );
    assert.equal(obligations[0].id, "scenario-behavior");
    assert.equal(obligations[1].id, "candidate-before-apply");
  }));

test("a clean official tree cannot hide an invalid candidate", () =>
  withTmp((dir) => {
    const f = fixture(dir);
    f.candidate();
    f.put(`${scenario.draftRoot}/${adr}`, body.replace("## Decision\n", "## Details\n"));
    assert.notEqual(f.check().exitCode, 0);
    assert.equal(f.tools.call("run_check", { kind: "structure" }).exitCode, 0);
    f.apply();
    f.check(false);
    assert.equal(f.checks()[1].pass, false);
  }));

test("moving a validated new ADR into place preserves the same validation evidence", () =>
  withTmp((dir) => {
    const f = fixture(dir);
    f.candidate();
    f.check();
    f.tools.call("move_file", { from: `${scenario.draftRoot}/${adr}`, to: adr });
    f.put(mapping, index);
    f.check(false);
    assert.ok(
      f.checks().every((c) => c.pass),
      JSON.stringify(f.checks()),
    );
  }));

test("final lint and later draft validation do not erase an early official write", () =>
  withTmp((dir) => {
    const f = fixture(dir);
    f.apply();
    f.check(false);
    f.candidate();
    f.check();
    assert.equal(f.checks()[1].pass, false);
  }));

test("changed, unchecked or differently applied candidates fail even when final lint passes", () => {
  for (const variant of ["changed-draft", "different-official", "wrong-category", "no-final-check"])
    withTmp((dir) => {
      const f = fixture(dir);
      f.candidate();
      f.check(true, variant === "wrong-category" ? "another" : "media/upload");
      if (variant === "changed-draft")
        f.put(`${scenario.draftRoot}/${adr}`, body + "\nChanged candidate.\n");
      if (variant === "different-official") {
        f.put(adr, body + "\nUnchecked addition.\n");
        f.put(mapping, index);
      } else f.apply();
      if (variant !== "no-final-check") f.check(false);
      assert.ok(
        f.checks().some((c) => !c.pass),
        variant,
      );
    });
});

test("draft access is opt-in and cannot modify source, rules, another run or symlink targets", () =>
  withTmp((dir) => {
    const f = fixture(dir);
    const plain = makeTools({ root: f.root, pluginRoot: PLUGIN_ROOT, logPath: f.log, turn: 1 });
    for (const draftRoot of [
      "docs/draft",
      ".adr-review/../../out",
      "/tmp/draft",
      ".adr-review/a/.git",
      "",
    ])
      assert.throws(
        () =>
          makeTools({ root: f.root, pluginRoot: PLUGIN_ROOT, logPath: f.log, turn: 1, draftRoot }),
        /draftRoot/,
      );
    assert.ok(!plain.definitions.some((t) => t.name === "prepare_draft"));
    assert.throws(
      () => plain.call("run_check", { kind: "structure", draft: true }),
      /unexpected argument/,
    );
    assert.throws(
      () => plain.call("write_file", { path: `${scenario.draftRoot}/${adr}`, content: body }),
      /writable/,
    );
    assert.throws(
      () => f.tools.call("run_check", { kind: "structure", draft: true }),
      /no ADR mapping/,
    );
    f.candidate();
    for (const file of [
      `${scenario.draftRoot}/src/handler.ts`,
      `${scenario.draftRoot}/test/policy.test.mjs`,
      `${scenario.draftRoot}/docs/adr/authoring-rules.md`,
      ".adr-review/another/docs/adr/new.md",
      `${scenario.draftRoot}/../escape.md`,
    ])
      assert.throws(() => f.put(file, "blocked"));
    assert.throws(() => f.tools.call("prepare_draft"), /already exists/);
    assert.throws(
      () => f.tools.call("run_check", { kind: "policy-tests", draft: true }),
      /kind=structure/,
    );
    assert.throws(
      () =>
        makeTools({
          root: f.root,
          pluginRoot: PLUGIN_ROOT,
          logPath: f.log,
          turn: 1,
          draftRoot: scenario.draftRoot,
          artifactPaths: [`${scenario.draftRoot}/docs/adr/authoring-rules.md`],
        }),
      /overlap/,
    );
    symlinkSync(dir, path.join(f.root, scenario.draftRoot, "docs", "outside"));
    assert.throws(
      () => f.put(`${scenario.draftRoot}/docs/outside/escape.md`, "blocked"),
      /symlinks/,
    );
  }));

test("the real MCP transport exposes and executes only its declared draft capability", () =>
  withTmp((dir) => {
    const f = fixture(dir);
    const request = (id, method, params = {}) => ({ jsonrpc: "2.0", id, method, params });
    const result = spawnSync(
      process.execPath,
      [
        path.join(PLUGIN_ROOT, "evals/regression/tool-server.mjs"),
        f.root,
        PLUGIN_ROOT,
        f.log,
        "1",
        "on",
        PLUGIN_ROOT,
        "[]",
        scenario.draftRoot,
      ],
      {
        encoding: "utf8",
        input:
          [
            request(1, "tools/list"),
            request(2, "tools/call", { name: "prepare_draft", arguments: {} }),
          ]
            .map(JSON.stringify)
            .join("\n") + "\n",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const replies = result.stdout.trim().split("\n").map(JSON.parse);
    assert.ok(replies[0].result.tools.some((t) => t.name === "prepare_draft"));
    assert.ok(!replies[1].result.isError, result.stdout);
    assert.equal(
      f.events().filter((e) => e.tool === "prepare_draft" && e.kind === "result" && e.ok).length,
      1,
    );
  }));

test("dot and case aliases cannot bypass immutable rule or draft boundaries", () =>
  withTmp((dir) => {
    const f = fixture(dir);
    f.candidate();
    const rule = "docs/adr/authoring-rules.md";
    const original = readFileSync(path.join(f.root, rule), "utf8");
    for (const file of [
      "docs/./adr/authoring-rules.md",
      "docs/adr/Authoring-rules.md",
      `${scenario.draftRoot}/docs/./adr/authoring-rules.md`,
      `${scenario.draftRoot}/docs/adr/Authoring-rules.md`,
      `.adr-review/./author-candidate/${rule}`,
    ])
      assert.throws(() => f.put(file, "must remain immutable"));
    assert.throws(
      () =>
        makeTools({
          root: f.root,
          pluginRoot: PLUGIN_ROOT,
          logPath: f.log,
          turn: 1,
          draftRoot: scenario.draftRoot,
          artifactPaths: [`.adr-review/./author-candidate/${rule}`],
        }),
      /confined relative path/,
    );
    assert.equal(readFileSync(path.join(f.root, rule), "utf8"), original);
    assert.throws(
      () => f.tools.call("read_file", { path: ".GIT/config" }),
      /confined relative path/,
    );
    assert.equal(readFileSync(path.join(f.root, scenario.draftRoot, rule), "utf8"), original);
  }));
