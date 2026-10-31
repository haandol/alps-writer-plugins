// Two or more commits in a row history cannot read, where a Status may leave and come
// back on a composition nobody can see, and two same-day acceptances on two branches:
// the process is unchecked until the user confirms, and every possible baseline counts.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  MORE_OPEN_SCOPE,
  OPEN_PATH,
  PAYMENT_STATUS,
  REWORDED,
  STEP_DEFINITION,
  UNREAD_UNCHANGED,
  UNSEEN_RUN,
  approvedSave,
  brokenBeside,
  cli,
  exits,
  head,
  json,
  model,
  paymentFlag,
  read,
  renewPayment,
  repo,
  unreadRun,
} from "./process-model-history-helpers.mjs";

test("one commit history cannot read holds one Status, so it hides no return of it", () => {
  withTmp((dir) => {
    unreadRun(dir, 1);
    const changes = JSON.parse(cli(dir, ["changes", "--json"]).out);
    const flag = changes.unsyncedAccepted.find((u) => u.process === "payment.take-payment");
    assert.deepEqual([flag, changes.unsyncedUnknown], [undefined, []]);
    write(dir, "docs/process/model.ttl", MORE_OPEN_SCOPE);
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

test("two commits history cannot read in a row leave a process unchecked until the user confirms they changed nothing, which renews it", () => {
  withTmp((dir) => {
    unreadRun(dir, 2);
    const changes = cli(dir, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    const result = JSON.parse(changes.out);
    assert.equal(
      result.unsyncedAccepted.find((u) => u.process === "payment.take-payment"),
      undefined,
      "nothing visible changed",
    );
    assert.deepEqual(
      result.unsyncedUnknown.find((u) => u.process === "payment.take-payment"),
      { process: "payment.take-payment", reason: UNSEEN_RUN },
    );
    assert.match(
      exits(dir, ["lifecycle"], 0).out,
      /payment\.take-payment: commits history cannot read may hide a lifecycle change before an edit since then/,
    );
    // Without the user's confirmation, a renewal cannot set the unseen composition aside.
    const refused = renewPayment(dir);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /inside two or more commits in a row that history cannot read, on a composition nobody can see; if the user confirms those commits changed nothing in its business composition, renew with --unread-unchanged, or mark it Proposed for an alignment review/,
    );
    // An approved save does not renew over it either.
    const saved = approvedSave(dir, MORE_OPEN_SCOPE);
    assert.match(
      saved.out,
      /not renewed: "payment\.take-payment" may have become Accepted again inside two or more commits in a row that history cannot read, on a composition nobody can see; run process sync, which asks the user whether those commits changed it/,
    );
    write(dir, "docs/process/model.ttl", ACCEPTED);
    // The user confirms: the date is renewed, as for a confirmed edit, and once committed
    // the next comparison starts after those commits.
    const renewed = renewPayment(dir, UNREAD_UNCHANGED);
    assert.equal(renewed.code, 0, renewed.out);
    assert.match(read(dir), /pm:status "Accepted \(2020-01-20\)" ;\n    pm:hasStep m:payment/);
    exits(dir, ["lifecycle"], 0);
    commitAll(dir, "renewed after the user confirmed the unreadable commits changed nothing");
    // The order process's Status shows unchanged in the document that parses there, so
    // those commits never hid a return of it.
    const after = JSON.parse(cli(dir, ["changes", "--json"]).out);
    assert.deepEqual([after.unsyncedAccepted, after.unsyncedUnknown], [[], []]);
    exits(dir, ["lifecycle"], 0);
  });
});

test("two commits history cannot read in a row the user does not confirm send the process to an alignment review", () => {
  withTmp((dir) => {
    unreadRun(dir, 2);
    exits(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"], 0);
    exits(dir, ["lifecycle"], 0);
    commitAll(dir, "sync marks Proposed");
    exits(dir, ["lifecycle"], 0);
  });
});

test("the user's confirmation of commits history cannot read in a row also covers a same-meaning rewording made since", () => {
  withTmp((dir) => {
    unreadRun(dir, 2);
    model(
      dir,
      ACCEPTED.replace('rdfs:label "Request the payment"', 'rdfs:label "Ask for the payment"'),
      "a step relabelled",
    );
    const renewed = renewPayment(dir, [
      ...UNREAD_UNCHANGED,
      "--same-meaning",
      "payment.request-payment=rdfs:label",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
  });
});

test("a confirmation of commits history cannot read in a row where none lie on the way is refused", () => {
  withTmp((plain) => {
    repo(plain);
    const stray = cli(plain, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
      ...UNREAD_UNCHANGED,
    ]);
    assert.equal(stray.code, 1, stray.out);
    assert.match(
      stray.out,
      /--unread-unchanged confirms two or more commits in a row that history cannot read, and none lie on the way/,
    );
  });
});

test("after two commits history cannot read in a row, a re-date by hand cannot be told from the confirmed renewal", () => {
  withTmp((dir) => {
    unreadRun(dir, 2);
    write(
      dir,
      "docs/process/model.ttl",
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
    );
    assert.match(
      exits(dir, ["lifecycle"], 0).out,
      /process-lifecycle-needs-alignment[\s\S]*its Accepted date was renewed; that is ADR Writer's renewal only when the user confirmed/,
    );
  });
});

test("two commits history cannot read in a row whose documents that parse show the Status throughout hide no return of it", () => {
  withTmp((dir) => {
    brokenBeside(dir);
    const result = JSON.parse(cli(dir, ["changes", "--json"]).out);
    assert.deepEqual([result.unsyncedAccepted, result.unsyncedUnknown], [[], []]);
    assert.doesNotMatch(exits(dir, ["lifecycle"], 0).out, /history audit limited/);
    // A confirmed open-scope edit renews, as after one such commit.
    write(dir, "docs/process/model.ttl", MORE_OPEN_SCOPE);
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

test("after two commits history cannot read in a row that show the Status throughout, a re-date by hand is the lifecycle edit it is after one", () => {
  withTmp((dir) => {
    brokenBeside(dir);
    write(
      dir,
      "docs/process/model.ttl",
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
    );
    assert.match(
      exits(dir, ["lifecycle"], 1).out,
      /Accepted was re-dated without passing through Proposed and an alignment review/,
    );
    commitAll(dir, "re-dated by hand");
    exits(dir, ["lifecycle"], 1);
    assert.ok(
      json(dir, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
    );
  });
});

test("two commits in a row where the document stating the Statuses does not parse leave each process stated there unchecked, each with its own confirmation", () => {
  withTmp((dir) => {
    repo(dir);
    model(dir, `${ACCEPTED}\nm:x a\n`, "the model document broken");
    model(dir, `${ACCEPTED}\nm:y a\n`, "still broken");
    model(dir, ACCEPTED, "repaired");
    const unknown = () =>
      JSON.parse(cli(dir, ["changes", "--json"]).out)
        .unsyncedUnknown.map((u) => `${u.process}: ${u.reason}`)
        .sort();
    assert.deepEqual(unknown(), [
      `ordering.place-order: ${UNSEEN_RUN}`,
      `payment.take-payment: ${UNSEEN_RUN}`,
    ]);
    assert.match(
      exits(dir, ["lifecycle"], 0).out,
      /ordering\.place-order: commits history cannot read may hide a lifecycle change before an edit since then/,
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
        ...UNREAD_UNCHANGED,
      ],
      0,
    );
    commitAll(dir, "renewed after the user confirmed those commits changed nothing in it");
    assert.deepEqual(unknown(), [`ordering.place-order: ${UNSEEN_RUN}`]);
  });
});

test("where the later of two commits history cannot read shows another Status, only the readable commit after them may hold its return", () => {
  withTmp((dir) => {
    repo(dir);
    model(dir, `${ACCEPTED}\nm:x a\n`, "the model document broken");
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    model(
      dir,
      ACCEPTED.replace(PAYMENT_STATUS, 'pm:status "Proposed" ;\n    pm:hasStep m:payment'),
      "payment demoted, beside a document that does not parse",
    );
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    model(dir, ACCEPTED, "repaired, and payment promoted back by hand");
    // The order process's Status shows only in the later commit, where it may have come
    // back after leaving in the earlier one.
    assert.deepEqual(
      JSON.parse(cli(dir, ["changes", "--json"]).out).unsyncedUnknown.map((u) => u.process),
      ["ordering.place-order"],
    );
  });
});

for (const run of [1, 2])
  test(`a hand re-date undone after ${run === 1 ? "a commit" : "two commits in a row"} history cannot read leaves the process ${run === 1 ? "flagged" : "unchecked"} as before`, () => {
    withTmp((dir) => {
      const status = (date) => `pm:status "Accepted (${date})" ;\n    pm:hasStep m:payment`;
      repo(dir);
      write(dir, "docs/process/broken.ttl", "m:x a\n");
      const demoted = REWORDED.replace(
        PAYMENT_STATUS,
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
      );
      model(dir, demoted, "demoted with a reworded step, beside a document that does not parse");
      if (run === 2) model(dir, REWORDED, "promoted back by hand, the document still broken");
      rmSync(path.join(dir, "docs/process/broken.ttl"));
      // After one such commit the repair shows the reworded step; after two, the step
      // is reworded back in the repair itself, so only the run can hide the change.
      model(
        dir,
        run === 1 ? REWORDED : ACCEPTED,
        "repaired, and promoted by hand to the first Accepted date",
      );
      const repaired = head(dir);
      if (run === 1) model(dir, ACCEPTED, "the step reworded back");
      // Re-dated by hand to an earlier day, then undone: the undo is looked through.
      model(dir, ACCEPTED.replace(PAYMENT_STATUS, status("2019-12-01")), "re-dated by hand");
      model(dir, ACCEPTED, "the re-date undone");
      if (run === 1) {
        const flag = paymentFlag(dir);
        assert.deepEqual([flag?.since, flag?.compositionChanged], [repaired, true]);
      } else
        assert.deepEqual(
          json(dir, ["changes"]).unsyncedUnknown.find((u) => u.process === "payment.take-payment"),
          { process: "payment.take-payment", reason: UNSEEN_RUN },
        );
    });
  });

for (const into of ["main", "scope"])
  test(`an approved save over two same-day acceptances on two branches, merged into ${into}, renews from neither, and names the other acceptance where it is the reason`, () => {
    withTmp((dir) => {
      repo(dir, EXAMPLE);
      const accepted = EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        PAYMENT_STATUS,
      );
      const main = git(dir, ["branch", "--show-current"]).trim();
      git(dir, ["checkout", "-q", "-b", "scope"]);
      model(
        dir,
        accepted.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
        "accepted with an open path",
      );
      git(dir, ["checkout", "-q", main]);
      // The other acceptance changes only a description, which no comparison counts.
      model(
        dir,
        accepted.replace(
          'pm:summary "From order submission to order confirmation."',
          'pm:summary "From the order submission to its confirmation."',
        ),
        "accepted as reviewed, with a description reworded",
      );
      if (into === "scope") git(dir, ["checkout", "-q", "scope"]);
      git(dir, ["merge", "-q", "--no-ff", into === "scope" ? main : "scope", "-m", "merge"]);
      const reworded = read(dir).replace(
        'rdfs:label "Request the payment"',
        'rdfs:label "Ask for the payment"',
      );
      const saved = approvedSave(dir, reworded, [
        "--same-meaning",
        "payment.request-payment=rdfs:label",
      ]);
      // Neither acceptance's comparison covers the other's edit, so the date stays; where
      // the model before the save matches the earlier acceptance, the other branch's
      // acceptance is named as the reason.
      assert.doesNotMatch(saved.out, /Accepted renewed/);
      assert.match(
        saved.out,
        into === "scope"
          ? /not renewed: "payment\.take-payment" became Accepted on more than one branch, with edits since the other acceptance that this confirmation does not cover; run process sync/
          : /not renewed: "payment\.take-payment" has edits since it became Accepted that this confirmation does not cover; run process sync/,
      );
    });
  });

for (const into of ["main", "scope"])
  test(`where two branches each accepted a process the same day, a merge into ${into} is judged against both acceptances`, () => {
    withTmp((dir) => {
      repo(dir, EXAMPLE);
      const accepted = EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        PAYMENT_STATUS,
      );
      const main = git(dir, ["branch", "--show-current"]).trim();
      git(dir, ["checkout", "-q", "-b", "scope"]);
      model(
        dir,
        accepted.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
        "accepted with an open path",
      );
      git(dir, ["checkout", "-q", main]);
      model(
        dir,
        accepted.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
        "accepted with a reworded step",
      );
      if (into === "scope") git(dir, ["checkout", "-q", "scope"]);
      git(dir, ["merge", "-q", "--no-ff", into === "scope" ? main : "scope", "-m", "merge"]);
      // Against the open-path acceptance, the merge brings the reworded step: the flag,
      // the renewal and the demotion all count that composition change.
      const flag = paymentFlag(dir);
      assert.deepEqual(
        [flag?.compositionChanged, flag?.lastAcceptedUncertain],
        [true, "it became Accepted on more than one branch"],
      );
      const renewal = renewPayment(dir);
      assert.equal(renewal.code, 1, renewal.out);
      assert.match(renewal.out, /changed its business composition|on more than one branch/);
      exits(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"], 0);
      exits(dir, ["lifecycle"], 0);
    });
  });
