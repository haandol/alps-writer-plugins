import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { git, initRepo, PLUGIN_ROOT, runHook, withTmp } from "./helpers.mjs";
import { cli } from "./ontology-helpers.mjs";

const script = path.join(PLUGIN_ROOT, "scripts", "ontology-preferences.mjs");
const read = (cwd, env, ...args) =>
  JSON.parse(execFileSync(process.execPath, [script, ...args], { cwd, env, encoding: "utf8" }));

test("saved setup and review choices survive sessions and are reset independently", () =>
  withTmp((dir) => {
    const project = path.join(dir, "project");
    const store = path.join(dir, "user-preferences");
    mkdirSync(project);
    const env = { ...process.env, ONTOLOGY_WRITER_PREFERENCES_DIR: store };
    const preferences = (...args) => read(project, env, ...args);
    const startup = () => runHook(project, { env });
    const view = () => cli(project, ["view", "--lang", "ko", "--no-open"], env).out;
    assert.deepEqual(preferences("show"), { setup: null, "adr-review": null });
    assert.match(startup(), /Would you like to create/);
    assert.match(view(), /만들까요\?/);
    assert.equal(existsSync(store), false);

    preferences("set", "adr-review", "review-first");
    assert.match(startup(), /Would you like to create/);
    for (const answer of ["skip", "later", "build"]) {
      preferences("set", "setup", answer);
      assert.equal(startup(), "");
      assert.doesNotMatch(view(), /만들까요\?/);
      assert.deepEqual(preferences("show"), { setup: answer, "adr-review": "review-first" });
    }
    preferences("set", "adr-review", "build-direct");
    assert.notEqual(
      spawnSync(process.execPath, [script, "set", "setup", "unknown"], { cwd: project, env })
        .status,
      0,
    );
    assert.deepEqual(preferences("show"), { setup: "build", "adr-review": "build-direct" });
    preferences("reset", "setup");
    assert.match(startup(), /Would you like to create/);
    assert.deepEqual(preferences("show", "adr-review"), { "adr-review": "build-direct" });
    preferences("reset", "adr-review");
    assert.deepEqual(preferences("show"), { setup: null, "adr-review": null });
    assert.equal(existsSync(path.join(project, "docs")), false);
  }));

test("linked worktrees share project choices but another repo or user's settings do not", () =>
  withTmp((dir) => {
    const repo = path.join(dir, "first", "sales");
    const other = path.join(dir, "second", "sales");
    const worktree = path.join(dir, "linked");
    for (const p of [repo, other]) {
      mkdirSync(p, { recursive: true });
      initRepo(p);
    }
    git(repo, ["commit", "--allow-empty", "-qm", "initial"]);
    git(repo, ["worktree", "add", "--detach", worktree]);
    const env = { ...process.env, ONTOLOGY_WRITER_PREFERENCES_DIR: path.join(dir, "user-one") };
    read(repo, env, "set", "setup", "skip");
    read(worktree, env, "set", "adr-review", "review-first");
    assert.deepEqual(read(repo, env, "show"), { setup: "skip", "adr-review": "review-first" });
    assert.equal(runHook(worktree, { env }), "");
    assert.match(runHook(other, { env }), /Would you like to create/);
    assert.match(
      runHook(repo, {
        env: { ...env, ONTOLOGY_WRITER_PREFERENCES_DIR: path.join(dir, "user-two") },
      }),
      /Would you like to create/,
    );
    for (const p of [repo, other, worktree]) assert.equal(git(p, ["status", "--porcelain"]), "");
  }));
