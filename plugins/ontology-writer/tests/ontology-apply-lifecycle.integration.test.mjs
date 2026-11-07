// The lifecycle side of a save: lifecycle edits made by hand stop it, a HEAD history
// cannot read stops it, and an Accepted date is renewed only where the confirmation
// covers every edit since the process last became Accepted.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PLUGIN_ROOT, commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  AUDITOR,
  CLI,
  EXAMPLE,
  MAPPING,
  MORE_OPEN_SCOPE,
  OPEN_PATH,
  ORDER_EDIT,
  PREFIXES,
  SETTLED,
  STEP_EDIT,
  UNLINKED,
  apply,
  assertNotRenewed,
  cli,
  directSave,
  draft,
  exits,
  impact,
  insideGit,
  json,
  paymentIn,
  read,
  repo,
  saveWording,
  statusOf,
  today,
  unsynced,
} from "./ontology-apply-helpers.mjs";

test("confirmed same-meaning wording is saved without making a process Proposed and renews its Accepted date", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('rdfs:label "Submit the order"', 'rdfs:label "Submit an order"'));
    const unconfirmed = impact(dir);
    assert.deepEqual(unconfirmed.processesToPropose, ["ordering.place-order"]);
    const confirmation = ["--same-meaning", "ordering.submit-order=rdfs:label"];
    const confirmed = impact(dir, confirmation);
    assert.deepEqual(
      [confirmed.processesToPropose, confirmed.directlyAffectedCategories, confirmed.affectedAdrs],
      [[], [], []],
    );
    assert.notEqual(
      confirmed.baseHash,
      unconfirmed.baseHash,
      "the confirmations are part of the approval",
    );
    assert.match(apply(dir, confirmed.baseHash).out, /changed after the approval summary/);
    assert.equal(
      cli(dir, [
        "impact",
        "--draft",
        "draft",
        "--same-meaning",
        "ordering.submit-order=onto:flowsTo",
      ]).code,
      2,
      "a relation change can never be confirmed as same-meaning",
    );
    const applied = apply(dir, confirmed.baseHash, confirmation);
    assert.equal(applied.code, 0, applied.out);
    const model = read(dir, "docs/ontology/model.ttl");
    assert.match(model, /rdfs:label "Submit an order"/);
    assert.doesNotMatch(model, /onto:status "Proposed"/);
    assert.equal(
      statusOf(dir, "ordering.place-order"),
      `Accepted (${today()})`,
      "the confirmed wording renews the Accepted date of the process it belongs to",
    );
    assert.match(applied.out, /Accepted renewed: ordering\.place-order/);
  });
});

test("a save that only adds open scope renews the Accepted date", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace(OPEN_PATH, MORE_OPEN_SCOPE));
    const summary = impact(dir);
    assert.deepEqual(summary.processesToPropose, []);
    const saved = apply(dir, summary.baseHash);
    assert.equal(saved.code, 0, saved.out);
    assert.match(saved.out, /Accepted renewed: payment\.take-payment/);
    assert.equal(statusOf(dir, "payment.take-payment"), `Accepted (${today()})`);
  });
});

test("a save goes in without renewing an Accepted date a calendar a day ahead wrote", () => {
  withTmp((dir) => {
    // Another time zone's calendar recorded the acceptance on what is still tomorrow here.
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE");
    repo(dir, ACCEPTED.replaceAll("Accepted (2020-01-01)", `Accepted (${tomorrow})`));
    draft(dir, read(dir, "docs/ontology/model.ttl").replace(OPEN_PATH, MORE_OPEN_SCOPE));
    const saved = apply(dir, impact(dir).baseHash);
    assert.equal(saved.code, 0, saved.out);
    assert.match(
      saved.out,
      new RegExp(
        `⚠ Accepted date of payment\\.take-payment not renewed: "payment\\.take-payment" is Accepted \\(${tomorrow}\\), a later day than this confirmation's ${today()}; confirm it again on a later day`,
      ),
    );
    assert.equal(statusOf(dir, "payment.take-payment"), `Accepted (${tomorrow})`);
    exits(dir, ["lifecycle"], 0);
  });
});

test("a wording save does not renew the Accepted date of a process with a committed edit it does not cover", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(STEP_EDIT[0], STEP_EDIT[1]));
    commitAll(dir, "direct edit of a payment step");
    assertNotRenewed(
      saveWording(dir),
      /has edits since it became Accepted that this confirmation does not cover; run ontology sync/,
    );
    commitAll(dir, "wording saved");
    assert.equal(unsynced(dir, "payment.take-payment")?.compositionChanged, true);
  });
});

test("a wording save does not renew the Accepted date of a process with an uncommitted edit it does not cover", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(STEP_EDIT[0], STEP_EDIT[1]));
    assertNotRenewed(
      saveWording(dir),
      /has edits since it became Accepted that this confirmation does not cover; run ontology sync/,
    );
    commitAll(dir, "direct edit and wording saved");
    assert.equal(unsynced(dir, "payment.take-payment")?.compositionChanged, true);
  });
});

test("a wording save does not renew the Accepted date of a process with a committed open-scope edit it does not cover", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(OPEN_PATH, MORE_OPEN_SCOPE));
    commitAll(dir, "open scope added by hand");
    assert.equal(
      unsynced(dir, "payment.take-payment")?.compositionChanged,
      false,
      "the edit is open scope only",
    );
    assertNotRenewed(
      saveWording(dir),
      /has edits since it became Accepted that this confirmation does not cover; run ontology sync/,
    );
    commitAll(dir, "wording saved");
    assert.ok(
      unsynced(dir, "payment.take-payment")?.elements.includes("payment.take-payment"),
      "the open-scope edit is still flagged for ontology sync",
    );
  });
});

test("a wording save does not renew an Accepted date that a hand promotion produced", () => {
  withTmp((dir) => {
    repo(dir, paymentIn("Proposed"), UNLINKED);
    write(dir, "docs/ontology/model.ttl", paymentIn("Accepted (2020-01-15)"));
    commitAll(dir, "promoted by hand");
    const promoted = cli(dir, ["lifecycle"]);
    assert.equal(promoted.code, 1, promoted.out);
    assert.match(promoted.out, /became Accepted while the alignment gates did not hold/);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    commitAll(dir, "payments linked");
    assertNotRenewed(
      saveWording(dir),
      /has lifecycle edits Ontology Writer's transitions do not explain/,
    );
    commitAll(dir, "wording saved");
    assert.equal(cli(dir, ["lifecycle"]).code, 1, "the hand promotion is still reported");
  });
});

test("a wording save does not renew an Accepted date while a realizing ADR cites the model", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      "# ADR 0001: b\n\n## Status\n\nAccepted (2020-01-01)\n\n## Decision\n\nThe customer authorizes the charge in `payment.request-payment`.\n",
    );
    commitAll(dir, "an ADR citing the model");
    assertNotRenewed(
      saveWording(dir),
      /alignment gates do not hold:\n {2}- .*ontology-adr-identifier/,
    );
  });
});

test("a wording save does not renew an Accepted date while a system step has no realizing feature", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(UNLINKED, null, 2));
    commitAll(dir, "payments unlinked");
    assertNotRenewed(
      saveWording(dir),
      /alignment gates do not hold:\n {2}- system step "payment\.request-payment" has no realizing feature/,
    );
  });
});

test("a wording save on the day a process became Accepted says why its date cannot be renewed", () => {
  withTmp((dir) => {
    repo(dir, paymentIn("Proposed"));
    const promoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(promoted.code, 0, promoted.out);
    commitAll(dir, "accepted after the alignment review");
    const saved = saveWording(dir);
    assertNotRenewed(saved, /is already Accepted \(/);
    assert.match(saved.out, /cannot be recorded/);
  });
});

test("a direct-edit save refuses a retirement made by hand, even with its own change-log line", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", paymentIn("Deprecated (2020-01-30)"));
    write(dir, "mapping.next.json", JSON.stringify(UNLINKED, null, 2));
    const laundered = directSave(dir, {
      args: ["--mapping", "mapping.next.json"],
      save: ["--log", "`payment.take-payment` deprecated: by hand"],
    });
    assert.equal(laundered.code, 1);
    assert.match(laundered.out, /a lifecycle edit made by hand; report it instead of saving/);
    assert.equal(read(dir, "docs/adr/.mapping.json"), JSON.stringify(MAPPING, null, 2));
  });
});

test("a draft save is refused while the working tree holds a retirement made by hand", () => {
  withTmp((dir) => {
    // No index link to the payment steps, so only the retirement can stop the save.
    repo(dir, ACCEPTED, UNLINKED);
    const retired = paymentIn("Deprecated (2020-01-15)");
    const log =
      "# Ontology change log\n\n- 2020-01-15 — `payment.take-payment` deprecated: payment moved to invoicing\n";
    write(dir, "docs/ontology/model.ttl", retired);
    write(dir, "docs/ontology/change-log.md", log);
    draft(dir, `${retired}\n${AUDITOR}`);
    const refused = apply(dir, impact(dir).baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /payment\.take-payment: .* — no save includes a retirement it did not approve/,
    );
    assert.match(refused.out, /nothing was written/);
    assert.equal(read(dir, "docs/ontology/model.ttl"), retired);
    assert.equal(read(dir, "docs/ontology/change-log.md"), log);
  });
});

test("no save goes in while HEAD's model cannot be read, since a hand lifecycle edit could not be told from an approved one", () => {
  withTmp((dir) => {
    repo(dir, ACCEPTED, UNLINKED);
    const retired = paymentIn("Deprecated (2020-01-15)");
    const log = ["--log", "`payment.take-payment` deprecated: by hand"];
    // A committed document that does not parse; the working tree repairs it and retires a process by hand.
    write(dir, "docs/ontology/model.ttl", `${ACCEPTED}\nm:broken rdfs:label "unterminated .\n`);
    commitAll(dir, "a document that does not parse");
    write(dir, "docs/ontology/model.ttl", retired);
    draft(dir, retired.replace(ORDER_EDIT[0], ORDER_EDIT[1]));
    const unparsed = apply(dir, impact(dir).baseHash, log);
    assert.equal(unparsed.code, 1, unparsed.out);
    assert.match(
      unparsed.out,
      /lifecycle edits in the working tree cannot be told from approved ones: the committed model cannot be parsed; commit a model whose documents parse, then run ontology sync before saving/,
    );
    assert.match(unparsed.out, /nothing was written/);
    assert.equal(read(dir, "docs/ontology/model.ttl"), retired);
    assert.equal(existsSync(path.join(dir, "docs/ontology/change-log.md")), false);
    // A model document linked from outside the repository hides its history the same way.
    const outside = path.join(dir, "..", `${path.basename(dir)}-shared`);
    mkdirSync(outside, { recursive: true });
    try {
      write(dir, "docs/ontology/model.ttl", ACCEPTED);
      writeFileSync(path.join(outside, "auditor.ttl"), `${PREFIXES}${AUDITOR}`);
      symlinkSync(path.join(outside, "auditor.ttl"), path.join(dir, "docs/ontology/auditor.ttl"));
      commitAll(dir, "a document shared from outside the repository");
      write(dir, "docs/ontology/model.ttl", retired);
      draft(dir, retired.replace(ORDER_EDIT[0], ORDER_EDIT[1]));
      rmSync(path.join(dir, "draft/auditor.ttl"));
      write(dir, "draft/auditor.ttl", `${PREFIXES}${AUDITOR}`);
      const linked = apply(dir, impact(dir).baseHash, log);
      assert.equal(linked.code, 1, linked.out);
      assert.match(
        linked.out,
        /lifecycle edits in the working tree cannot be told from approved ones: docs\/ontology\/auditor\.ttl links outside the repository.*; keep the model's documents and its change log in this repository, committed — no link out of it or to an untracked or ignored file, no submodule, then run ontology sync before saving/,
      );
      assert.equal(read(dir, "docs/ontology/model.ttl"), retired);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test("no save goes in while git cannot read HEAD's model documents, as in a partial clone", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    mkdirSync(source);
    repo(source, ACCEPTED, UNLINKED);
    git(source, ["config", "uploadpack.allowFilter", "true"]);
    execFileSync(
      "git",
      ["clone", "-q", "--filter=blob:none", "--no-checkout", `file://${source}`, "clone"],
      { cwd: dir },
    );
    const clone = path.join(dir, "clone");
    // The index without the blobs, and the working tree written by hand.
    git(clone, ["read-tree", "HEAD"]);
    cpSync(path.join(source, "docs"), path.join(clone, "docs"), { recursive: true });
    renameSync(source, path.join(dir, "gone"));
    const retired = paymentIn("Deprecated (2020-01-15)");
    write(clone, "docs/ontology/model.ttl", retired);
    draft(clone, retired.replace(ORDER_EDIT[0], ORDER_EDIT[1]));
    const refused = apply(clone, impact(clone).baseHash, [
      "--log",
      "`payment.take-payment` deprecated: by hand",
    ]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /lifecycle edits in the working tree cannot be told from approved ones: git could not read HEAD's model: the committed model documents are not available locally; fetch the missing objects \(git fetch\), then run ontology sync before saving/,
    );
    assert.equal(read(clone, "docs/ontology/model.ttl"), retired);
  });
});

test("a promotion or renewal over a HEAD whose model does not parse says it cannot tell", () => {
  withTmp((dir) => {
    repo(dir, paymentIn("Proposed"));
    write(
      dir,
      "docs/ontology/model.ttl",
      `${paymentIn("Proposed")}\nm:broken rdfs:label "unterminated .\n`,
    );
    commitAll(dir, "a document that does not parse");
    write(dir, "docs/ontology/model.ttl", paymentIn("Proposed"));
    const promoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(promoted.code, 1, promoted.out);
    assert.match(
      promoted.out,
      /cannot tell whether "payment\.take-payment" has lifecycle edits Ontology Writer's transitions do not explain: the committed model cannot be parsed/,
    );
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(OPEN_PATH, MORE_OPEN_SCOPE));
    const renewal = cli(dir, [
      "transition",
      "--process",
      "ordering.place-order",
      "--to",
      "Accepted",
    ]);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(
      renewal.out,
      /cannot tell what changed since "ordering\.place-order" became Accepted: the committed model cannot be parsed/,
    );
  });
});

test("a save where the repository holds no history of the model says its lifecycle was not audited", (t) => {
  withTmp((dir) => {
    if (insideGit(dir)) return t.skip("the temporary directory lies inside a git work tree");
    write(dir, "docs/adr/.mapping.json", JSON.stringify(UNLINKED, null, 2));
    write(
      dir,
      "docs/adr/checkout/0001-a.md",
      "# ADR 0001: a\n\n## Status\n\nAccepted (2020-01-01)\n",
    );
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      "# ADR 0001: b\n\n## Status\n\nAccepted (2020-01-01)\n",
    );
    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    draft(dir, EXAMPLE.replace(ORDER_EDIT[0], ORDER_EDIT[1]));
    const saved = apply(dir, impact(dir).baseHash);
    assert.equal(saved.code, 0, saved.out);
    assert.match(
      saved.out,
      /note: lifecycle edits in the working tree were not audited against history: not a git work tree/,
    );
  });
});

test("a direct-edit save refuses an Accepted date changed by hand", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", paymentIn("Accepted (2020-01-15)"));
    const refused = directSave(dir);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /payment\.take-payment: Accepted was re-dated .* — a lifecycle edit made by hand; report it instead of saving/,
    );
  });
});

test("a direct-edit save is bound to the process scope its summary showed", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(STEP_EDIT[0], STEP_EDIT[1]));
    assert.equal(
      cli(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"]).code,
      0,
    );
    const scope = ["--process", "payment.take-payment"];
    const scoped = json(dir, ["impact", "--base", "HEAD", ...scope]);
    const whole = json(dir, ["impact", "--base", "HEAD"]);
    assert.notEqual(scoped.baseHash, whole.baseHash, "the scope is part of the approval");
    const save = (hash) => cli(dir, ["apply", "--base", "HEAD", "--base-hash", hash, ...scope]);
    assert.match(save(whole.baseHash).out, /changed after the approval summary/);
    assert.equal(save(scoped.baseHash).code, 0);
  });
});

test("ontology sync's save of direct edits accepts the Proposed marking and the renewal it made", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/ontology/model.ttl",
      ACCEPTED.replace(OPEN_PATH, MORE_OPEN_SCOPE).replace(ORDER_EDIT[0], ORDER_EDIT[1]),
    );
    for (const [id, to] of [
      ["ordering.place-order", "Proposed"],
      ["payment.take-payment", "Accepted"],
    ]) {
      const moved = cli(dir, ["transition", "--process", id, "--to", to]);
      assert.equal(moved.code, 0, moved.out);
    }
    const line = "`ordering.place-order`: the customer sends the cart, not an order";
    const saved = directSave(dir, { save: ["--log", line] });
    assert.equal(saved.code, 0, saved.out);
    assert.ok(read(dir, "docs/ontology/change-log.md").includes(line));
  });
});

test("a scoped save against an older Accepted Status is not stopped by another process's committed renewal", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(OPEN_PATH, MORE_OPEN_SCOPE));
    commitAll(dir, "open path");
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
    write(
      dir,
      "docs/ontology/model.ttl",
      read(dir, "docs/ontology/model.ttl").replace(ORDER_EDIT[0], ORDER_EDIT[1]),
    );
    commitAll(dir, "direct edit of the order flow");
    // The order flow's Accepted Status is older than the renewal, so the save spans it.
    const { since } = unsynced(dir, "ordering.place-order");
    assert.equal(since, git(dir, ["rev-list", "--max-parents=0", "HEAD"]).trim());
    const saved = directSave(dir, { base: since, args: ["--process", "ordering.place-order"] });
    assert.equal(saved.code, 0, saved.out);
  });
});

test("a write that fails and cannot be restored names the file left changed", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    mkdirSync(path.join(dir, "docs/ontology/change-log.md/blocked"), { recursive: true });
    const { baseHash } = impact(dir);
    let out;
    try {
      out = execFileSync(
        process.execPath,
        [
          "--preload",
          path.join(PLUGIN_ROOT, "tests/fixtures/fail-write.mjs"),
          CLI,
          "apply",
          "--draft",
          "draft",
          "--base-hash",
          baseHash,
          "--log",
          "`payment.payment-completed`: settled too",
        ],
        {
          cwd: dir,
          encoding: "utf8",
          env: {
            ...process.env,
            ADR_TEST_FAIL_WRITE: path.join(realpathSync(dir), "docs/ontology/model.ttl"),
          },
        },
      );
    } catch (e) {
      out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    assert.match(out, /writing failed .* and these files could not be restored: .*model\.ttl/);
  });
});

test("a direct-edit save, scoped or not, is refused while another process has a lifecycle edit made by hand", () => {
  withTmp((dir) => {
    repo(dir);
    // A hand re-dating of the payment process, and a composition edit of the order flow.
    write(
      dir,
      "docs/ontology/model.ttl",
      paymentIn("Accepted (2020-01-15)").replace(ORDER_EDIT[0], ORDER_EDIT[1]),
    );
    const marked = cli(dir, [
      "transition",
      "--process",
      "ordering.place-order",
      "--to",
      "Proposed",
    ]);
    assert.equal(marked.code, 0, marked.out);
    // A save scoped to another process could otherwise carry the hand edit in unseen.
    const line = "`ordering.place-order`: the customer sends the cart, not an order";
    for (const args of [["--process", "ordering.place-order"], []]) {
      const refused = directSave(dir, { args, save: ["--log", line] });
      assert.equal(refused.code, 1, refused.out);
      assert.match(
        refused.out,
        /payment\.take-payment: Accepted was re-dated .* — a lifecycle edit made by hand/,
      );
    }
  });
});

test("a direct-edit save meets the committed lifecycle edits of the processes it covers, not of others", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", paymentIn("Accepted (2020-01-15)"));
    commitAll(dir, "re-dated by hand");
    write(
      dir,
      "docs/ontology/model.ttl",
      paymentIn("Accepted (2020-01-15)").replace(ORDER_EDIT[0], ORDER_EDIT[1]),
    );
    const marked = cli(dir, [
      "transition",
      "--process",
      "ordering.place-order",
      "--to",
      "Proposed",
    ]);
    assert.equal(marked.code, 0, marked.out);
    const line = "`ordering.place-order`: the customer sends the cart, not an order";
    for (const args of [["--process", "payment.take-payment"], []]) {
      const refused = directSave(dir, { args, save: ["--log", line] });
      assert.equal(refused.code, 1, refused.out);
      assert.match(
        refused.out,
        /\[ontology-lifecycle\] payment\.take-payment: Accepted was re-dated .* — a lifecycle edit made by hand; report it instead of saving/,
      );
    }
    const scoped = directSave(dir, {
      args: ["--process", "ordering.place-order"],
      save: ["--log", line],
    });
    assert.equal(scoped.code, 0, scoped.out);
  });
});

test("a save after a renewal not committed yet says to commit the confirmation first", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/model.ttl", ACCEPTED.replace(OPEN_PATH, MORE_OPEN_SCOPE));
    commitAll(dir, "open scope edited by hand");
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
    draft(
      dir,
      read(dir, "docs/ontology/model.ttl").replace(
        MORE_OPEN_SCOPE,
        `${MORE_OPEN_SCOPE}, "Partial captures."^^onto:OpenPath`,
      ),
    );
    const saved = apply(dir, impact(dir).baseHash);
    assert.equal(saved.code, 0, saved.out);
    assert.match(
      saved.out,
      /⚠ Accepted date of payment\.take-payment not renewed: .*its Status changed in the working tree; commit what was already confirmed, then confirm this change/,
    );
  });
});

test("an approved save does not renew an Accepted date whose Status first shows after history it cannot read", () => {
  withTmp((root) => {
    const outside = path.join(root, "outside");
    const dir = path.join(root, "work");
    mkdirSync(outside, { recursive: true });
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    // The model was kept outside the repository, then moved in.
    symlinkSync(outside, path.join(dir, "docs/ontology"));
    repo(dir);
    const text = read(dir, "docs/ontology/model.ttl");
    unlinkSync(path.join(dir, "docs/ontology"));
    write(dir, "docs/ontology/model.ttl", text);
    commitAll(dir, "the model moved into the repository");
    assertNotRenewed(
      saveWording(dir),
      /where its Accepted Status first appeared is not in the readable history/,
    );
  });
});
