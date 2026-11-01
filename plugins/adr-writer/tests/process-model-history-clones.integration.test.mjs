// What history reads in other repository shapes and settings: shallow and partial
// clones, refused git transports and user git settings, documents that are not UTF-8,
// volumes that fold letter case or Unicode form, and a change log kept behind a link.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { indexGraph, parseTurtle } from "../scripts/process-model-lib.mjs";
import { GIT_ENV, changeFlags, readModelHistory } from "../scripts/process-model-fs.mjs";
import { commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  OPEN_PATH,
  STEP_DEFINITION,
  cli,
  cloneOf,
  directEdit,
  directlyEdited,
  exits,
  head,
  json,
  linkChangeLog,
  read,
  repo,
  trackChangeLog,
} from "./process-model-history-helpers.mjs";

test("a partial clone reports history as unavailable instead of fetching or failing", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    directlyEdited(source);
    git(source, ["config", "uploadpack.allowFilter", "true"]);
    execFileSync("git", ["clone", "-q", "--filter=blob:none", `file://${source}`, "clone"], {
      cwd: dir,
    });
    renameSync(source, path.join(dir, "gone"));
    const clone = path.join(dir, "clone");
    const r = cli(clone, ["query", "--category", "payments", "--json"]);
    const result = JSON.parse(r.out);
    assert.equal(result.found, true, "the business context is still returned");
    assert.match(result.changes.committedUnavailable, /not available locally/);
    const index = indexGraph(parseTurtle(read(clone)).triples);
    const flags = changeFlags("docs/process", index, { cwd: clone });
    assert.equal(flags.history.available, false, "committed history needs the missing objects");
    // HEAD is local, so an uncommitted edit is still flagged without the network.
    write(
      clone,
      "docs/process/model.ttl",
      read(clone).replace('rdfs:label "Submit the order"', 'rdfs:label "Send the order"'),
    );
    const edited = JSON.parse(cli(clone, ["query", "--category", "checkout", "--json"]).out);
    assert.deepEqual(edited.changes.uncommitted, ["ordering.submit-order"]);
  });
});

test("a depth-1 clone reports edits since acceptance as unknown and refuses a demotion it cannot judge", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    directlyEdited(source);
    const clone = cloneOf(source, path.join(dir, "clone"), "--depth", "1");
    const changes = cli(clone, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    assert.deepEqual(
      JSON.parse(changes.out).unsyncedUnknown?.map((u) => u.process),
      ["ordering.place-order", "payment.take-payment"],
    );
    const text = cli(clone, ["changes"]).out;
    assert.match(
      text,
      /edits of Accepted process payment\.take-payment since it became Accepted are unknown: the clone is shallow/,
    );
    assert.doesNotMatch(
      text,
      /no unsynced direct edits/,
      "unknown edits are never reported as none",
    );
    const demoted = cli(clone, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Proposed",
    ]);
    assert.equal(demoted.code, 1, demoted.out);
    assert.match(
      demoted.out,
      /cannot tell whether "payment\.take-payment" changed its business composition since it became Accepted: the clone is shallow/,
    );
  });
});

test("history reads refuse every git transport, so a git ignoring the lazy-fetch switch still cannot fetch", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    // Two earlier model documents the clone lacks: one for each read below that fetches.
    directlyEdited(source);
    git(source, ["config", "uploadpack.allowFilter", "true"]);
    const clone = cloneOf(source, path.join(dir, "clone"), "--filter=blob:none");
    const missing = () =>
      git(clone, ["rev-list", "--objects", "--missing=print", "--all"])
        .split("\n")
        .filter((l) => l.startsWith("?"))
        .map((l) => l.slice(1));
    const before = missing();
    assert.ok(before.length >= 2, "the clone lacks the earlier commits' model documents");
    const catFile = (object, env) => {
      delete env.GIT_NO_LAZY_FETCH; // as a git that ignores it would
      try {
        return execFileSync("git", ["cat-file", "--batch"], {
          cwd: clone,
          env,
          input: `${object}\n`,
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch (e) {
        return `${e.stdout ?? ""}${e.stderr ?? ""}`;
      }
    };
    const blob = (object) => new RegExp(`^${object} blob`, "m");
    const refused = (env) => {
      const guarded = catFile(before[0], env);
      assert.doesNotMatch(guarded, blob(before[0]), guarded);
      assert.match(guarded, /transport 'file' not allowed/);
      assert.deepEqual(missing(), before, "nothing was fetched");
    };
    refused({ ...GIT_ENV });
    // An allow list inherited from the environment is replaced by an empty one.
    assert.equal(GIT_ENV.GIT_ALLOW_PROTOCOL, "");
    refused({ ...process.env, GIT_ALLOW_PROTOCOL: "file", ...GIT_ENV });
    // A listed transport overrides the refusing configuration, so a kept list would fetch.
    const reopened = catFile(before[0], { ...GIT_ENV, GIT_ALLOW_PROTOCOL: "file" });
    assert.match(reopened, blob(before[0]), reopened);
    assert.deepEqual(missing(), before.slice(1));
    // The same read without the guard fetches, so the fixture would reach the source.
    const unguarded = catFile(before[1], { ...process.env });
    assert.match(unguarded, blob(before[1]), unguarded);
    assert.deepEqual(missing(), before.slice(2));
  });
});

test("lifecycle says what history it could not audit instead of reporting a clean result alone", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    directlyEdited(source);
    const shallow = cloneOf(source, path.join(dir, "shallow"), "--depth", "1");
    const cut = JSON.parse(cli(shallow, ["lifecycle", "--json"]).out);
    assert.match(cut.historyLimited, /the clone is shallow/);
    assert.match(cli(shallow, ["lifecycle"]).out, /history audit limited: the clone is shallow/);
    git(source, ["config", "uploadpack.allowFilter", "true"]);
    const partial = cloneOf(source, path.join(dir, "partial"), "--filter=blob:none");
    renameSync(source, path.join(dir, "gone"));
    assert.match(
      JSON.parse(cli(partial, ["lifecycle", "--json"]).out).historyUnavailable,
      /partial clone/,
    );
  });
});

test("history reads a committed document that is not valid UTF-8 as unreadable, as the working tree does", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/process/notes.ttl", "");
    writeFileSync(
      path.join(dir, "docs/process/notes.ttl"),
      Buffer.concat([
        Buffer.from("@prefix m: <urn:adr-writer:model:> .\n# caf"),
        Buffer.from([0xe9]),
        Buffer.from("\n"),
      ]),
    );
    commitAll(dir, "a document that is not UTF-8");
    const broken = head(dir);
    const history = readModelHistory("docs/process", { cwd: dir });
    assert.equal(history.graphAt(broken), null);
  });
});

test("on a volume that folds letter case, a docs folder stored as Docs still has its history", (t) => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "Docs"), { recursive: true });
    if (!readdirSync(dir).includes("Docs") || !existsSync(path.join(dir, "docs")))
      return t.skip("this volume keeps the two spellings apart");
    repo(dir);
    const accepted = head(dir);
    assert.match(git(dir, ["ls-files"]), /^Docs\/process\/model\.ttl$/m);
    directEdit(dir);
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("a signature check in the user's git log output never hides committed edits", () => {
  withTmp((dir) => {
    const work = path.join(dir, "work");
    repo(work);
    const accepted = head(work);
    // A direct edit, committed with a signature history cannot check.
    write(
      work,
      "docs/process/model.ttl",
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
    );
    git(work, ["add", "-A"]);
    const tree = git(work, ["write-tree"]).trim();
    writeFileSync(
      path.join(dir, "signed-commit"),
      `tree ${tree}\nparent ${accepted}\nauthor t <t@t.co> 1577836800 +0000\ncommitter t <t@t.co> 1577836800 +0000\ngpgsig -----BEGIN SSH SIGNATURE-----\n U1NIU0lH\n -----END SSH SIGNATURE-----\n\ndirect edit, signed\n`,
    );
    const signed = git(work, [
      "hash-object",
      "-t",
      "commit",
      "-w",
      path.join(dir, "signed-commit"),
    ]);
    git(work, ["update-ref", "HEAD", signed.trim()]);
    // The user's git configuration shows signatures in every log.
    writeFileSync(
      path.join(dir, "gitconfig"),
      "[log]\n\tshowSignature = true\n[gpg]\n\tformat = ssh\n",
    );
    const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(dir, "gitconfig") };
    const changes = JSON.parse(cli(work, ["changes", "--json"], env).out);
    assert.equal(changes.committedUnavailable, undefined, JSON.stringify(changes));
    const flag = changes.unsyncedAccepted.find((u) => u.process === "payment.take-payment");
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("a change log once committed as a link to an ignored file leaves only that commit's change log unknown, not its model", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    linkChangeLog(dir);
    exits(
      dir,
      [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        "2020-01-15",
      ],
      0,
    );
    commitAll(dir, "accepted after its review, the change log linked to an ignored file");
    trackChangeLog(dir, "the change log tracked");
    assert.deepEqual(JSON.parse(cli(dir, ["changes", "--json"]).out).unsyncedUnknown, []);
    write(
      dir,
      "docs/process/model.ttl",
      read(dir).replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
    );
    exits(
      dir,
      [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        "2020-01-20",
      ],
      0,
    );
  });
});
