// How history reads the model through links where the working tree does: linked
// documents and folders, chains of links and their earlier targets, links nobody can
// follow, and submodules. Clones, git settings, encodings, a volume that folds letter
// case and the change log behind a link are in
// process-model-history-clones.integration.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync, renameSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { findModelDocuments } from "../scripts/process-model-fs.mjs";
import { commitAll, git, initRepo, withTmp, write } from "./helpers.mjs";
import {
  EXTRA,
  STEP_DEFINITION,
  cli,
  directEdit,
  exits,
  head,
  json,
  model,
  read,
  repo,
} from "./process-model-history-helpers.mjs";

test("a committed direct edit through a linked model document is flagged, though its commit touches only the link's target", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    mkdirSync(path.join(dir, "shared"));
    symlinkSync("../../shared/model.ttl", path.join(dir, "docs/process/model.ttl"));
    // Written through the link, so every commit after the first changes only shared/model.ttl.
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    assert.equal(git(dir, ["show", "--name-only", "--format=", "HEAD"]).trim(), "shared/model.ttl");
    const changes = cli(dir, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    const flag = JSON.parse(changes.out).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true], changes.out);
  });
});

test("a model directory that is itself a link has committed history, so a clean tree has no uncommitted edits", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "model"));
    mkdirSync(path.join(dir, "docs"));
    symlinkSync("../model", path.join(dir, "docs/process"));
    // Written through the link: the documents are committed under model/.
    repo(dir);
    assert.equal(git(dir, ["status", "--porcelain"]), "");
    const changes = cli(dir, ["changes", "--json"]);
    assert.equal(changes.code, 0, changes.out);
    const result = JSON.parse(changes.out);
    assert.deepEqual(result.uncommitted, []);
    assert.equal(result.committedUnavailable, undefined);
    const diff = cli(dir, ["diff"]);
    assert.equal(diff.code, 0, diff.out);
    assert.match(diff.out, /✓ no semantic change against HEAD/);
  });
});

test("a model link out of the repository leaves committed-edit flags unavailable and uncommitted edits flagged", () => {
  withTmp((dir) => {
    const work = path.join(dir, "repo");
    repo(work);
    write(dir, "outside/extra.ttl", EXTRA);
    symlinkSync(path.join(dir, "outside"), path.join(work, "docs/process/shared"));
    commitAll(work, "documents from outside the repository linked into the model");
    const query = cli(work, ["query", "--category", "payments"]);
    assert.doesNotMatch(query.out, /^\s+at /m, query.out);
    assert.match(
      query.out,
      /Committed-edit flags unavailable: docs\/process\/shared links outside the repository \(/,
    );
    assert.match(query.out, /treat Accepted processes in this scope as possibly edited directly/);
    const changes = cli(work, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    const { committedUnavailable } = JSON.parse(changes.out);
    assert.match(committedUnavailable, /links outside the repository/);
    assert.match(
      committedUnavailable,
      /edits of those documents, committed or not, cannot be flagged/,
    );
    model(work, read(work).replace(STEP_DEFINITION, '"The customer approves the card charge."'));
    assert.deepEqual(json(work, ["changes"]).uncommitted, ["payment.request-payment"]);
  });
});

test("a submodule under the model directory leaves committed-edit flags unavailable without flagging its documents", () => {
  withTmp((dir) => {
    const shared = path.join(dir, "shared");
    mkdirSync(shared);
    initRepo(shared);
    write(shared, "extra.ttl", EXTRA);
    commitAll(shared, "shared documents");
    const work = path.join(dir, "repo");
    repo(work);
    const add = ["submodule", "--quiet", "add", shared, "docs/process/shared"];
    git(work, ["-c", "protocol.file.allow=always", ...add]);
    commitAll(work, "shared documents as a submodule");
    const changes = JSON.parse(cli(work, ["changes", "--json"]).out);
    assert.deepEqual(changes.uncommitted, [], "its documents are compared on neither side");
    assert.match(changes.committedUnavailable, /is a git submodule/);
  });
});

test("a committed edit through a link stays flagged after the link is moved to another target", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "shared/v1"), { recursive: true });
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    symlinkSync("../../shared/v1/model.ttl", path.join(dir, "docs/process/model.ttl"));
    repo(dir);
    directEdit(dir);
    // The document moves; the link now leads to the new place.
    mkdirSync(path.join(dir, "shared/v2"), { recursive: true });
    renameSync(path.join(dir, "shared/v1/model.ttl"), path.join(dir, "shared/v2/model.ttl"));
    unlinkSync(path.join(dir, "docs/process/model.ttl"));
    symlinkSync("../../shared/v2/model.ttl", path.join(dir, "docs/process/model.ttl"));
    commitAll(dir, "the shared model moved");
    const changes = json(dir, ["changes"]);
    const flag = changes.unsyncedAccepted.find((u) => u.process === "payment.take-payment");
    assert.equal(flag?.compositionChanged, true, JSON.stringify(changes));
  });
});

test("a link that loops back into the model directory is read once, in the working tree and in history", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    symlinkSync(".", path.join(dir, "docs/process/again"));
    repo(dir);
    assert.deepEqual(
      findModelDocuments(path.join(dir, "docs/process")).map((f) => path.relative(dir, f)),
      [path.join("docs", "process", "model.ttl")],
    );
    exits(dir, ["validate"], 0);
    const clean = cli(dir, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
  });
});
