// What history reads in other repository shapes and settings: shallow and partial
// clones, refused git transports and user git settings, documents that are not UTF-8,
// volumes that fold letter case or Unicode form, and a change log kept behind a link.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { indexGraph, parseTurtle } from "../scripts/process-model-lib.mjs";
import { GIT_ENV, changeFlags, readModelHistory } from "../scripts/process-model-fs.mjs";
import { commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import {
  ACCEPTED,
  AUDIT,
  EXAMPLE,
  MAPPING,
  OPEN_PATH,
  PAYMENT_PROCESS,
  PAYMENT_STATUS,
  RETIRED,
  RETIRED_LINE,
  SHALLOW,
  STEP_DEFINITION,
  UNLINKED_PAYMENTS,
  cli,
  cloneOf,
  directEdit,
  directlyEdited,
  exits,
  head,
  json,
  linkChangeLog,
  model,
  read,
  repo,
  trackChangeLog,
  undoneRedate,
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

test("a shallow clone cut at a commit that does not parse reports Accepted edits as unknown, never clean", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    directlyEdited(source);
    write(source, "docs/process/notes.ttl", "m:x a\n");
    commitAll(source, "broken notes");
    rmSync(path.join(source, "docs/process/notes.ttl"));
    commitAll(source, "notes removed");
    assert.ok(
      json(source, ["changes"]).unsyncedAccepted.some((u) => u.process === "payment.take-payment"),
      "the full history sees the edit",
    );
    const clone = cloneOf(source, path.join(dir, "clone"), "--depth", "2");
    const changes = cli(clone, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    assert.deepEqual(
      JSON.parse(changes.out).unsyncedUnknown?.find((u) => u.process === "payment.take-payment"),
      { process: "payment.take-payment", reason: SHALLOW },
    );
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

test("a query warns that unknown edits of an Accepted process outside its scope may reach it", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    const mapping = structuredClone(MAPPING);
    mapping.categories.records = {
      adrs: [{ path: "docs/adr/records/0001-c.md", status: "Accepted (2020-01-01)", summary: "s" }],
      realizes: ["audit.record-order"],
    };
    // Only the audit process is Accepted; its rule reaches checkout's step, the process does not.
    repo(source, EXAMPLE, mapping);
    write(source, "docs/process/audit.ttl", AUDIT("Proposed"));
    commitAll(source, "audit proposed");
    write(source, "docs/process/audit.ttl", AUDIT("Accepted (2020-01-01)"));
    commitAll(source, "audit accepted after the alignment review");
    const clone = cloneOf(source, path.join(dir, "clone"), "--depth", "1");
    const result = JSON.parse(cli(clone, ["query", "--category", "checkout", "--json"]).out);
    const scope = JSON.stringify(result.steps);
    assert.ok(
      scope.includes('"audit.record-before-submit"') && !scope.includes('"audit.keep-records"'),
      scope,
    );
    assert.equal(result.changes.unsyncedUnknown, undefined, "no Accepted process in scope");
    assert.deepEqual(result.changes.unsyncedUnknownElsewhere, [SHALLOW]);
    assert.match(
      cli(clone, ["query", "--category", "checkout"]).out,
      /Edits of Accepted processes outside this scope since they became Accepted are unknown \(/,
    );
  });
});

test("in a partial clone, changes reports committed-edit flags as unavailable and is not clean", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    directlyEdited(source);
    git(source, ["config", "uploadpack.allowFilter", "true"]);
    const clone = cloneOf(source, path.join(dir, "clone"), "--filter=blob:none");
    renameSync(source, path.join(dir, "gone"));
    const changes = cli(clone, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    assert.match(JSON.parse(changes.out).committedUnavailable, /partial clone/);
    assert.match(cli(clone, ["changes"]).out, /committed-edit flags unavailable:/);
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

test("a shallow clone cut at the removal of a process added again reports its edits as unknown", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    repo(source);
    model(source, ACCEPTED.replace(PAYMENT_PROCESS, ""), "removed");
    model(
      source,
      ACCEPTED.replace('"The order has a completed payment."', '"The order is paid in full."'),
      "added again with another outcome",
    );
    // The clone holds the re-add and the removal; the removal is where it was cut.
    const clone = cloneOf(source, path.join(dir, "clone"), "--depth", "2");
    const changes = cli(clone, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    assert.deepEqual(
      JSON.parse(changes.out).unsyncedUnknown?.find((u) => u.process === "payment.take-payment"),
      { process: "payment.take-payment", reason: SHALLOW },
    );
    model(
      clone,
      read(clone).replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
    );
    const renewal = cli(clone, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(
      renewal.out,
      /cannot tell what changed since "payment\.take-payment" became Accepted: the clone is shallow/,
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

for (const depth of ["2", "3"])
  test(`a depth-${depth} clone cut inside an undone hand edit reports the edits since acceptance as unknown`, () => {
    withTmp((dir) => {
      const source = path.join(dir, "source");
      undoneRedate(source);
      // Depth 2 cuts where the re-dating appeared; depth 3, where the undone value appeared.
      const clone = cloneOf(source, path.join(dir, "clone"), "--depth", depth);
      const changes = cli(clone, ["changes", "--json"]);
      assert.equal(changes.code, 1, changes.out);
      assert.deepEqual(
        JSON.parse(changes.out).unsyncedUnknown?.find((u) => u.process === "payment.take-payment"),
        { process: "payment.take-payment", reason: SHALLOW },
        changes.out,
      );
    });
  });

test("lifecycle reads the base change log through the model directory's link", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "model"), { recursive: true });
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    symlinkSync("../model", path.join(dir, "docs/process"));
    repo(dir);
    write(
      dir,
      "docs/process/change-log.md",
      "# Process model change log\n\n- 2020-01-02 — `payment.take-payment` reworded\n",
    );
    commitAll(dir, "a change-log line about the payment process");
    // A retirement by hand: the committed line is no line for it.
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /Deprecated without a change-log line naming "payment\.take-payment"/,
    );
  });
});

test("lifecycle names what a shallow clone keeps it from judging, never a clean result alone", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    undoneRedate(source);
    const clone = cloneOf(source, path.join(dir, "clone"), "--depth", "2");
    const out = cli(clone, ["lifecycle"]);
    assert.match(
      out.out,
      /history audit limited: .*payment\.take-payment: the clone is shallow and cuts off where its current lifecycle value appeared/,
    );
    assert.match(
      out.out,
      /✓ no unexplained lifecycle change against HEAD among the changes history could judge/,
    );
  });
});

test("a change log linked into the model directory is read in history, so a retirement with its line is ADR Writer's", () => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    mkdirSync(path.join(dir, "shared"));
    write(dir, "shared/change-log.md", "# Process model change log\n");
    symlinkSync("../../shared/change-log.md", path.join(dir, "docs/process/change-log.md"));
    repo(dir, ACCEPTED, UNLINKED_PAYMENTS);
    write(
      dir,
      "docs/process/change-log.md",
      "# Process model change log\n\n- 2020-01-15 — `payment.take-payment` deprecated: moved to invoicing\n",
    );
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "payment retired with its change-log line",
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.doesNotMatch(lifecycle.out, /without a change-log line/, lifecycle.out);
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

test("on a volume that folds letter case, a realizing ADR folder linked under another spelling is read at each commit", (t) => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "shared/payments"), { recursive: true });
    if (!existsSync(path.join(dir, "shared/PAYMENTS")))
      return t.skip("this volume keeps the two spellings apart");
    mkdirSync(path.join(dir, "docs/adr"), { recursive: true });
    symlinkSync("../../shared/PAYMENTS", path.join(dir, "docs/adr/payments"));
    repo(dir);
    // ADR Writer's own promotion, judged with the ADR files of its commit.
    exits(dir, ["lifecycle"], 0);
  });
});

test("on a volume that folds Unicode form, a link to a name stored in another form is the model document it names", (t) => {
  withTmp((dir) => {
    const stored = "공유".normalize("NFC");
    mkdirSync(path.join(dir, stored), { recursive: true });
    if (!existsSync(path.join(dir, "공유".normalize("NFD"))))
      return t.skip("this volume keeps the two forms apart");
    mkdirSync(path.join(dir, "docs/process"), { recursive: true });
    symlinkSync(
      `../../${"공유".normalize("NFD")}/model.ttl`,
      path.join(dir, "docs/process/model.ttl"),
    );
    repo(dir);
    const clean = cli(dir, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
  });
});

test("an inherited pathspec mode never changes which commits history reads", () => {
  withTmp((dir) => {
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    const env = { ...process.env, GIT_LITERAL_PATHSPECS: "1", GIT_ICASE_PATHSPECS: "0" };
    const changes = JSON.parse(cli(dir, ["changes", "--json"], env).out);
    const flag = changes.unsyncedAccepted.find((u) => u.process === "payment.take-payment");
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("on a volume that folds letter case, a Docs link replaced by its folder keeps what was committed through it", (t) => {
  withTmp((dir) => {
    mkdirSync(path.join(dir, "documentation"), { recursive: true });
    symlinkSync("documentation", path.join(dir, "Docs"));
    if (!existsSync(path.join(dir, "docs")))
      return t.skip("this volume keeps the two spellings apart");
    repo(dir);
    const accepted = head(dir);
    directEdit(dir);
    unlinkSync(path.join(dir, "Docs"));
    renameSync(path.join(dir, "documentation"), path.join(dir, "Docs"));
    commitAll(dir, "the Docs link replaced by its folder");
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

test("two commits in a row whose change log is a link to an ignored file hide no return of a Status", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/process/change-log.md", "# Process model change log\n");
    commitAll(dir, "a change log");
    linkChangeLog(dir);
    commitAll(dir, "the change log linked to an ignored file");
    write(dir, "docs/process/notes.md", "notes\n");
    commitAll(dir, "notes beside it");
    trackChangeLog(dir, "the change log tracked again");
    const result = JSON.parse(cli(dir, ["changes", "--json"]).out);
    assert.deepEqual([result.unsyncedAccepted, result.unsyncedUnknown], [[], []]);
  });
});

for (const where of ["the retiring commit", "the commit before it"])
  test(`a retirement whose change log in ${where} was a link to an ignored file is unjudged, never an error`, () => {
    withTmp((dir) => {
      repo(dir, ACCEPTED, UNLINKED_PAYMENTS);
      linkChangeLog(dir, RETIRED_LINE);
      if (where === "the retiring commit") {
        model(dir, RETIRED, "payment retired, its line in a change log history cannot see");
        trackChangeLog(dir, "the change log tracked");
      } else {
        commitAll(dir, "the change log linked to an ignored file");
        model(dir, RETIRED);
        trackChangeLog(dir, "payment retired, and the change log tracked with its line");
      }
      assert.match(
        exits(dir, ["lifecycle"], 0).out,
        /payment\.take-payment: the change log at commit \w+ or the commit before it lies behind a link history cannot follow, so its retirement's change-log line cannot be checked/,
      );
      assert.deepEqual(json(dir, ["changes"]).lifecycleEdits, []);
    });
  });

test("on a volume that folds names, history reads a realizing ADR's link into the model spelled in another case and form", (t) => {
  withTmp((dir) => {
    const folder = "문서".normalize("NFC");
    mkdirSync(path.join(dir, folder, "process"), { recursive: true });
    const other = `${"문서".normalize("NFD")}/Process`;
    if (!existsSync(path.join(dir, other))) return t.skip("this volume keeps the spellings apart");
    initRepo(dir);
    const mapping = JSON.parse(JSON.stringify(MAPPING).replaceAll("docs/adr/", `${folder}/adr/`));
    write(dir, `${folder}/adr/.mapping.json`, JSON.stringify(mapping, null, 2));
    writeAdrFiles(dir, mapping);
    write(dir, `${folder}/process/model.ttl`, EXAMPLE);
    commitAll(dir, "proposed");
    // The payment ADR cites the model, and payment is promoted by hand in the same commit.
    write(
      dir,
      `${folder}/adr/payments/0001-b.md`,
      `# 0001-b\n\n## Status\n\nAccepted (2020-01-01)\n\nSee [the flow](../../../${other}/model.ttl).\n`,
    );
    write(
      dir,
      `${folder}/process/model.ttl`,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
    );
    commitAll(dir, "promoted by hand while the ADR cites the model");
    const lifecycle = exits(dir, ["lifecycle", "--adr-dir", `${folder}/adr`], 1);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold.*process-adr-identifier/s,
    );
  });
});
