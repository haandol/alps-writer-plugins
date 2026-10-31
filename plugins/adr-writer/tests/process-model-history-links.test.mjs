// How history reads the model through links where the working tree does: linked
// documents and folders, chains of links and their earlier targets, links nobody can
// follow, and submodules. Clones, git settings, encodings, folding volumes and the change
// log behind a link are in process-model-history-clones.test.mjs.
import assert from "node:assert/strict";
import { cpSync, mkdirSync, renameSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { findModelDocuments } from "../scripts/process-model-fs.mjs";
import { commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  EXTRA,
  MAPPING,
  OPEN_PATH,
  STEP_DEFINITION,
  cli,
  directEdit,
  exits,
  head,
  json,
  model,
  read,
  renewPayment,
  repo,
} from "./process-model-history-helpers.mjs";

test("a model document linked through an absolute path inside the repository has committed history", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "shared/extra.ttl", EXTRA);
    // Spelled through the temporary directory's name, which may itself be a link (macOS /tmp).
    symlinkSync(path.join(dir, "shared"), path.join(dir, "docs/process/shared"));
    commitAll(dir, "shared documents linked into the model");
    const clean = cli(dir, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
    assert.equal(JSON.parse(clean.out).committedUnavailable, undefined);
    const diff = cli(dir, ["diff"]);
    assert.equal(diff.code, 0, diff.out);
    assert.match(diff.out, /✓ no semantic change against HEAD/);
    write(dir, "shared/extra.ttl", EXTRA.replace('"Courier"', '"Delivery partner"'));
    assert.deepEqual(json(dir, ["changes"]).uncommitted, ["courier"]);
  });
});

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

for (const [what, target, at, local] of [
  ["file", "../../local/local.ttl", "docs/process/local.ttl", "local/local.ttl"],
  ["folder of model documents", "../../local/extra", "docs/process/shared", "local/extra"],
  ["change log", "../../local/change-log.md", "docs/process/change-log.md", "local/change-log.md"],
])
  test(`a committed link to an ignored ${what} leaves committed-edit flags unavailable instead of failing`, () => {
    withTmp((dir) => {
      repo(dir);
      write(dir, ".gitignore", "local/\n");
      if (what === "change log") write(dir, local, "# Change log\n");
      else write(dir, what === "file" ? local : `${local}/local.ttl`, EXTRA);
      symlinkSync(target, path.join(dir, at));
      commitAll(dir, `a local ${what} linked into the model`);
      const changes = cli(dir, ["changes", "--json"]);
      assert.equal(changes.code, 1, changes.out);
      assert.doesNotMatch(changes.out, /^\s+at /m, changes.out);
      assert.match(
        JSON.parse(changes.out).committedUnavailable,
        new RegExp(`links to ${local.replaceAll(".", "\\.")}, which the commit does not hold`),
      );
      // A comparison with HEAD reads its change log too.
      const lifecycle = cli(dir, ["lifecycle"]);
      assert.equal(lifecycle.code, 2, lifecycle.out);
      assert.match(
        lifecycle.out,
        new RegExp(`links to ${local.replaceAll(".", "\\.")}, which the commit does not hold`),
      );
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

test("HEAD is read like the working tree: a committed linked document and a committed draft change nothing", () => {
  const unchanged = (dir) => {
    const diff = cli(dir, ["diff"]);
    assert.equal(diff.code, 0, diff.out);
    assert.match(diff.out, /✓ no semantic change against HEAD/);
    const impact = cli(dir, ["impact", "--base", "HEAD", "--json"]);
    assert.equal(impact.code, 0, impact.out);
    assert.deepEqual(JSON.parse(impact.out).processesToPropose, []);
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 0, lifecycle.out);
    assert.match(lifecycle.out, /✓ no unexplained lifecycle change against HEAD/);
  };
  withTmp((dir) => {
    repo(dir);
    write(dir, "shared/extra.ttl", EXTRA);
    symlinkSync("../../shared/extra.ttl", path.join(dir, "docs/process/extra.ttl"));
    commitAll(dir, "a shared document linked into the model");
    unchanged(dir);
  });
  withTmp((dir) => {
    repo(dir);
    // The working tree skips dot-entries such as an approval draft, so HEAD must too.
    write(
      dir,
      "docs/process/.drafts/old.ttl",
      EXAMPLE.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
    );
    commitAll(dir, "a draft committed by accident");
    unchanged(dir);
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

test("a link to a link is followed in history as the file system follows it", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    mkdirSync(path.join(dir, "shared/real"), { recursive: true });
    symlinkSync("real/model.ttl", path.join(dir, "shared/model.ttl"));
    symlinkSync("../../shared/model.ttl", path.join(dir, "docs/process/model.ttl"));
    repo(dir);
    const accepted = head(dir);
    const clean = cli(dir, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
    // A commit that changes only the last file of the chain still changes the model.
    directEdit(dir);
    assert.equal(
      git(dir, ["show", "--name-only", "--format=", "HEAD"]).trim(),
      "shared/real/model.ttl",
    );
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("a committed edit through a link stays flagged after the link is replaced by its file", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    mkdirSync(path.join(dir, "shared"));
    symlinkSync("../../shared/model.ttl", path.join(dir, "docs/process/model.ttl"));
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    const text = read(dir);
    unlinkSync(path.join(dir, "docs/process/model.ttl"));
    write(dir, "docs/process/model.ttl", text);
    commitAll(dir, "the model is copied in place of its link");
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

for (const [linked, real] of [
  ["docs", "documentation"],
  ["docs/adr", "adr-shared"],
])
  test(`with ${linked} linked, history reads the ADR index where the working tree does`, () => {
    withTmp((dir) => {
      mkdirSync(path.join(dir, real), { recursive: true });
      mkdirSync(path.dirname(path.join(dir, linked)), { recursive: true });
      symlinkSync(
        path.relative(path.dirname(path.join(dir, linked)), path.join(dir, real)),
        path.join(dir, linked),
      );
      repo(dir);
      // ADR Writer's own promotion is judged by the index it was made with.
      const changes = cli(dir, ["changes", "--json"]);
      assert.equal(changes.code, 0, changes.out);
      assert.deepEqual(JSON.parse(changes.out).lifecycleEdits, []);
      exits(dir, ["lifecycle"], 0);
      model(
        dir,
        ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
        "open path",
      );
      const renewed = cli(dir, [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        "2020-01-20",
      ]);
      assert.equal(renewed.code, 0, renewed.out);
      commitAll(dir, "renewed after confirming the open path");
      exits(dir, ["changes"], 0);
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

test("history keeps what was committed through a linked docs/ after the link is replaced by its folder", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "documentation"), { recursive: true });
    symlinkSync("documentation", path.join(dir, "docs"));
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    // The link gives way to the folder it led to.
    git(dir, ["rm", "-q", "docs"]);
    git(dir, ["mv", "documentation", "docs"]);
    commitAll(dir, "docs is a folder now");
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("history keeps what was committed through a linked docs/ after the link is retargeted", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "documentation-v1"), { recursive: true });
    symlinkSync("documentation-v1", path.join(dir, "docs"));
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    renameSync(path.join(dir, "documentation-v1"), path.join(dir, "documentation-v2"));
    unlinkSync(path.join(dir, "docs"));
    symlinkSync("documentation-v2", path.join(dir, "docs"));
    commitAll(dir, "the documentation moved");
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("a committed link to an ignored folder without model documents is ignored in history, as in the working tree", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, ".gitignore", "local/\n");
    write(dir, "local/notes/readme.md", "notes\n");
    symlinkSync("../../local/notes", path.join(dir, "docs/process/notes"));
    commitAll(dir, "a local folder of notes linked into the model");
    const changes = JSON.parse(cli(dir, ["changes", "--json"]).out);
    assert.equal(changes.committedUnavailable, undefined, JSON.stringify(changes));
    exits(dir, ["lifecycle"], 0);
  });
});

test("a link that leads nowhere under a name the model does not read is ignored in history, as in the working tree", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    symlinkSync("../gone.md", path.join(dir, "docs/process/notes.md"));
    symlinkSync("round", path.join(dir, "docs/process/round"));
    repo(dir);
    const clean = cli(dir, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
    assert.equal(JSON.parse(clean.out).committedUnavailable, undefined);
  });
});

test("a committed edit through a chain of links stays flagged after the link in the middle is retargeted", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    mkdirSync(path.join(dir, "shared/real"), { recursive: true });
    symlinkSync("real/model.ttl", path.join(dir, "shared/model.ttl"));
    symlinkSync("../../shared/model.ttl", path.join(dir, "docs/process/model.ttl"));
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    mkdirSync(path.join(dir, "shared/moved"));
    renameSync(path.join(dir, "shared/real/model.ttl"), path.join(dir, "shared/moved/model.ttl"));
    unlinkSync(path.join(dir, "shared/model.ttl"));
    symlinkSync("moved/model.ttl", path.join(dir, "shared/model.ttl"));
    commitAll(dir, "the shared document moved, and the link in the middle with it");
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("documents of a linked model directory keep their own names when HEAD's model cannot be parsed", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "model"), { recursive: true });
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    symlinkSync("../model", path.join(dir, "docs/process"));
    repo(dir);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    commitAll(dir, "a document that does not parse");
    // The working tree drops it again: only that document differs from HEAD.
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    const changes = json(dir, ["changes"]);
    assert.match(changes.committedUnavailable, /cannot be parsed/);
    assert.deepEqual(changes.uncommittedDocuments, ["docs/process/broken.ttl"]);
  });
});

test("history follows the middle link of a chain through every target it had, so a hand promotion made through an earlier one is judged where it happened", () => {
  withTmp((dir) => {
    const retarget = (to) => {
      unlinkSync(path.join(dir, "shared/model.ttl"));
      symlinkSync(`${to}/model.ttl`, path.join(dir, "shared/model.ttl"));
    };
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    mkdirSync(path.join(dir, "shared/v1"), { recursive: true });
    symlinkSync("v1/model.ttl", path.join(dir, "shared/model.ttl"));
    symlinkSync("../../shared/model.ttl", path.join(dir, "docs/process/model.ttl"));
    repo(dir, EXAMPLE);
    // The middle link moves to a copy, and the process is promoted by hand through it
    // while its realizing ADR says Proposed.
    cpSync(path.join(dir, "shared/v1"), path.join(dir, "shared/v2"), { recursive: true });
    retarget("v2");
    commitAll(dir, "the middle link moves to a copy");
    write(dir, "docs/adr/payments/0001-b.md", "# 0001-b\n\n## Status\n\nProposed\n");
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand while the ADR says Proposed",
    );
    // Later the ADR is back in lockstep, and the middle link moves again.
    write(dir, "docs/adr/payments/0001-b.md", "# 0001-b\n\n## Status\n\nAccepted (2020-01-01)\n");
    cpSync(path.join(dir, "shared/v2"), path.join(dir, "shared/v3"), { recursive: true });
    retarget("v3");
    commitAll(dir, "the ADR repaired, and the middle link moved again");
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(lifecycle.out, /became Accepted while the alignment gates did not hold/);
  });
});

test("a committed edit through a linked parent folder with a non-ASCII name stays flagged after the link is replaced by its folder", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "documentation"));
    symlinkSync("documentation", path.join(dir, "문서"));
    initRepo(dir);
    const mapping = JSON.parse(JSON.stringify(MAPPING).replaceAll("docs/adr/", "문서/adr/"));
    write(dir, "문서/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    writeAdrFiles(dir, mapping);
    write(dir, "문서/process/model.ttl", EXAMPLE);
    commitAll(dir, "proposed");
    write(dir, "문서/process/model.ttl", ACCEPTED);
    commitAll(dir, "accepted after the alignment review");
    const accepted = head(dir);
    write(
      dir,
      "문서/process/model.ttl",
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
    );
    commitAll(dir, "direct edit through the link");
    unlinkSync(path.join(dir, "문서"));
    renameSync(path.join(dir, "documentation"), path.join(dir, "문서"));
    commitAll(dir, "the link replaced by its folder");
    const flag = json(dir, ["changes", "--adr-dir", "문서/adr"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("a model directory linked to a folder the commit does not hold has no history here, as one linked out of the repository", () => {
  withTmp((dir) => {
    repo(dir);
    // The model moves to an ignored local folder the work tree reads through a committed link.
    write(dir, ".gitignore", "local-process/\n");
    renameSync(path.join(dir, "docs/process"), path.join(dir, "local-process"));
    symlinkSync("../local-process", path.join(dir, "docs/process"));
    commitAll(dir, "the model linked to an ignored local folder");
    const changes = cli(dir, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    const result = JSON.parse(changes.out);
    assert.equal(result.available, false, changes.out);
    assert.match(
      result.reason,
      /docs\/process links to local-process, which the commit does not hold .*, so the model's documents have no history here/,
    );
    const demotion = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Proposed",
    ]);
    assert.equal(demotion.code, 1, demotion.out);
    assert.match(
      demotion.out,
      /cannot tell whether "payment\.take-payment" changed its business composition since it became Accepted: docs\/process links to local-process/,
    );
    const renewal = renewPayment(dir);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(
      renewal.out,
      /cannot tell what changed since "payment\.take-payment" became Accepted/,
    );
  });
});
