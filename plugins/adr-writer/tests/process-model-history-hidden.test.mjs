// A promotion or renewal commits history cannot read may hide: every commit right after
// them where the Status may have last appeared counts, for the change flags, both
// renewals, the lifecycle checks, a query's scope and process sync's summary and save.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  HIDDEN_EDITS,
  HIDDEN_RENEWAL,
  MORE_OPEN_SCOPE,
  PAYMENT_STATUS,
  PROCESS_DEFINITION,
  STEP_DEFINITION,
  STEP_RENEWAL,
  approvedSave,
  cli,
  exits,
  head,
  hiddenRoundTrip,
  json,
  model,
  paymentFlag,
  read,
  renewPayment,
  repo,
} from "./process-model-history-helpers.mjs";

for (const redate of [null, "before"])
  test(`an edit back over a promotion commits history cannot read may hide is a composition change since it${redate ? `, with a hand re-date undone ${redate} it` : ""}`, () => {
    withTmp((dir) => {
      const repaired = hiddenRoundTrip(dir, { redate });
      const changes = cli(dir, ["changes", "--json"]);
      assert.equal(changes.code, 1, changes.out);
      const result = JSON.parse(changes.out);
      const flag = result.unsyncedAccepted.find((u) => u.process === "payment.take-payment");
      assert.deepEqual(
        [flag?.since, flag?.compositionChanged, flag?.lastAcceptedUncertain],
        [repaired, true, "commits history cannot read may hide where its Status last appeared"],
      );
      assert.deepEqual(result.unsyncedUnknown ?? [], []);
      assert.match(
        cli(dir, ["changes"]).out,
        new RegExp(
          `edited since ${repaired.slice(0, 12)} \\(right after commits history cannot read, where its Status may have appeared\\)`,
        ),
      );
    });
  });

test("lifecycle names a process unjudged where a commit right after ones history cannot read differs from HEAD", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir);
    assert.match(
      exits(dir, ["lifecycle"], 0).out,
      /payment\.take-payment: commits history cannot read may hide a lifecycle change before an edit since then/,
    );
  });
});

test("process sync's renewal over a promotion history cannot read is refused for the composition it may hold, though nothing changed since the readable acceptance", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir);
    // Against the readable acceptance alone there is nothing to confirm; against the
    // hidden promotion, the step changed.
    const renewal = renewPayment(dir);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(renewal.out, HIDDEN_RENEWAL);
    assert.doesNotMatch(renewal.out, /there is nothing to confirm/);
  });
});

test("a demotion over a promotion history cannot read is a composition change, in the working tree and once committed", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir);
    exits(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"], 0);
    exits(dir, ["lifecycle"], 0);
    commitAll(dir, "sync marks Proposed");
    assert.doesNotMatch(exits(dir, ["lifecycle"], 0).out, /payment\.take-payment.*Proposed/);
  });
});

test("a renewal confirming an open-scope edit only a promotion history cannot read may have held is ADR Writer's renewal, in the working tree and once committed", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir, { edited: MORE_OPEN_SCOPE });
    const renewed = renewPayment(dir);
    assert.equal(renewed.code, 0, renewed.out);
    exits(dir, ["lifecycle"], 0);
    commitAll(dir, "renewed after confirming the open-scope edit");
    exits(dir, ["lifecycle"], 0);
    assert.equal(paymentFlag(dir), undefined);
  });
});

test("of two commits right after ones history cannot read, edits count from the later one, and the earlier is listed too", () => {
  withTmp((dir) => {
    repo(dir);
    const hidden = (step) => {
      write(dir, "docs/process/broken.ttl", "m:x a\n");
      model(
        dir,
        ACCEPTED.replace(STEP_DEFINITION, step).replace(
          PAYMENT_STATUS,
          'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        ),
        "demoted with an edit, beside a document that does not parse",
      );
      rmSync(path.join(dir, "docs/process/broken.ttl"));
      model(dir, ACCEPTED.replace(STEP_DEFINITION, step), "repaired, and promoted by hand");
      const repaired = head(dir);
      model(dir, ACCEPTED, "the edit undone");
      return repaired;
    };
    const earlier = hidden('"The customer approves the card charge."');
    const later = hidden('"The customer grants the card charge."');
    const flag = paymentFlag(dir);
    assert.deepEqual([flag?.since, flag?.alsoSince], [later, [earlier]]);
  });
});

test("a hand re-date after the edit back over a promotion history cannot read may hide is judged as readable history judges it", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir, { redate: "after" });
    // Against the hidden promotion, the re-date follows a composition change, as a
    // reviewed one may; its undoing to the earlier date is then a hand edit.
    const changes = cli(dir, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    const result = JSON.parse(changes.out);
    assert.deepEqual(
      [result.unsyncedAccepted, result.unsyncedUnknown, result.lifecycleEdits[0]?.findings],
      [
        [],
        [],
        [
          `Accepted was re-dated from 2020-01-15 to the earlier 2020-01-01; a renewal only records a later confirmation (commit ${head(dir).slice(0, 12)})`,
        ],
      ],
    );
  });
});

test("after the edit back over a promotion history cannot read, a committed open-scope edit is still a composition change since that promotion", () => {
  withTmp((dir) => {
    const repaired = hiddenRoundTrip(dir);
    model(dir, MORE_OPEN_SCOPE, "open path");
    const flag = paymentFlag(dir);
    assert.deepEqual([flag?.since, flag?.compositionChanged], [repaired, true]);
    assert.ok(flag.changes.some((c) => c.id === "payment.request-payment"));
    const renewal = renewPayment(dir);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(renewal.out, HIDDEN_RENEWAL);
  });
});

test("neither process sync nor an approved save renews an Accepted date a promotion history cannot read may have changed the composition of", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir);
    write(dir, "docs/process/model.ttl", MORE_OPEN_SCOPE);
    const renewal = renewPayment(dir);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(renewal.out, HIDDEN_RENEWAL);
    write(dir, "docs/process/model.ttl", ACCEPTED);
    const saved = approvedSave(dir, MORE_OPEN_SCOPE);
    assert.match(saved.out, HIDDEN_EDITS);
    assert.match(read(dir), new RegExp(PAYMENT_STATUS.replace(/[()]/g, "\\$&")));
    commitAll(dir, "open path saved");
    assert.equal(paymentFlag(dir)?.compositionChanged, true);
  });
});

test("a later edit after the edit back over a promotion history cannot read lists every element changed since any commit where the Status may have last appeared", () => {
  withTmp((dir) => {
    const repaired = hiddenRoundTrip(dir);
    model(
      dir,
      ACCEPTED.replace(PROCESS_DEFINITION, '"The store collects the money for an order."'),
      "the process reworded",
    );
    // Against the acceptance history can read, the process changed; against the hidden
    // promotion, the step changed too.
    const accepted = git(dir, [
      "log",
      "--format=%H",
      "--grep=accepted after the alignment review",
    ]).trim();
    const flag = paymentFlag(dir);
    assert.deepEqual(
      [flag?.since, flag?.alsoSince, flag?.compositionChanged, flag?.elements],
      [accepted, [repaired], true, ["payment.request-payment", "payment.take-payment"]],
    );
    assert.match(
      cli(dir, ["changes"]).out,
      new RegExp(`and since ${repaired.slice(0, 12)}, where it may have last appeared too`),
    );
  });
});

test("a query shows in its scope what was removed since any commit where the Status may have last appeared", () => {
  withTmp((dir) => {
    // The hidden promotion's model has a concept the payment request uses; the edit back
    // removes it, and a later edit makes the readable acceptance count first.
    const card =
      '\nm:payment.card a pm:BusinessConcept ;\n    rdfs:label "Card" ;\n    pm:definition "The card the customer pays with." ;\n    pm:inContext m:payment .\n\nm:payment.request-payment pm:uses m:payment.card .\n';
    hiddenRoundTrip(dir, { edited: `${ACCEPTED}${card}` });
    model(
      dir,
      ACCEPTED.replace(PROCESS_DEFINITION, '"The store collects the money for an order."'),
      "the process reworded",
    );
    const query = JSON.parse(cli(dir, ["query", "--category", "payments", "--json"]).out);
    const flag = query.changes.unsyncedAccepted.find((u) => u.process === "payment.take-payment");
    assert.ok(flag?.elements.includes("payment.card"), JSON.stringify(query.changes));
    assert.equal(
      flag.lastAcceptedUncertain,
      "commits history cannot read may hide where its Status last appeared",
    );
    assert.match(
      cli(dir, ["query", "--category", "payments"]).out,
      /UNSYNCED direct edit of Accepted process payment\.take-payment since a commit where it may have last become Accepted/,
    );
  });
});

test("process sync's summary and save of a direct edit cover every commit where the Status may have last appeared", () => {
  withTmp((dir) => {
    const repaired = hiddenRoundTrip(dir);
    // The process relabelled, with the same meaning as the user confirms.
    model(
      dir,
      ACCEPTED.replace('rdfs:label "Take a payment"', 'rdfs:label "Take the payment"'),
      "the process relabelled",
    );
    const { since, alsoSince } = paymentFlag(dir);
    assert.deepEqual(alsoSince, [repaired]);
    exits(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"], 0);
    const scope = [
      "--process",
      "payment.take-payment",
      "--same-meaning",
      "payment.take-payment=rdfs:label",
    ];
    // Against the readable acceptance alone, the payment step's change is not in sight.
    const one = json(dir, ["impact", "--base", since, ...scope]);
    assert.deepEqual(one.affectedAdrs, []);
    const also = ["--also-base", repaired];
    const both = json(dir, ["impact", "--base", since, ...also, ...scope]);
    assert.deepEqual(both.directlyAffectedCategories, ["payments"]);
    assert.deepEqual(both.affectedAdrs, ["docs/adr/payments/0001-b.md"]);
    // The approval binds that ADR, and the bases: neither may change before the save.
    const fewer = cli(dir, ["apply", "--base", since, ...scope, "--base-hash", both.baseHash]);
    assert.equal(fewer.code, 1, fewer.out);
    assert.match(fewer.out, /changed after the approval summary; nothing was written/);
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      "# ADR 0001: b\n\n## Status\n\nAccepted (2020-01-01)\n\nEdited.\n",
    );
    const stale = cli(dir, [
      "apply",
      "--base",
      since,
      ...also,
      ...scope,
      "--base-hash",
      both.baseHash,
    ]);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary; nothing was written/);
    const fresh = json(dir, ["impact", "--base", since, ...also, ...scope]);
    exits(dir, ["apply", "--base", since, ...also, ...scope, "--base-hash", fresh.baseHash], 0);
  });
});

test("process sync's confirmation of a text keeps the meaning of the one text it replaced, so it cannot cover two possible baselines that held different ones", () => {
  withTmp((dir) => {
    hiddenRoundTrip(dir);
    // Committed, the step reworded once more, after the text the hidden promotion held.
    model(
      dir,
      ACCEPTED.replace(STEP_DEFINITION, '"The customer grants the card charge."'),
      "the step reworded",
    );
    const refused = renewPayment(dir, STEP_RENEWAL);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /--same-meaning payment\.request-payment=pm:definition: the commits where "payment\.take-payment" may have last become Accepted hold different texts there, so one confirmation cannot keep the meaning of each; mark it Proposed for an alignment review/,
    );
    exits(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"], 0);
  });
});

test("process sync's confirmation of the text a promotion history cannot read may have accepted renews the process", () => {
  withTmp((dir) => {
    const repaired = hiddenRoundTrip(dir);
    const flag = paymentFlag(dir);
    assert.deepEqual([flag?.since, flag?.compositionChanged], [repaired, true]);
    // The user confirms the step's text, reworded back, keeps the meaning it had there.
    const renewed = renewPayment(dir, STEP_RENEWAL);
    assert.equal(renewed.code, 0, renewed.out);
    commitAll(dir, "renewed after confirming the wording");
    assert.equal(paymentFlag(dir), undefined);
    exits(dir, ["lifecycle"], 0);
  });
});

test("an open-scope edit a promotion history cannot read may hide is confirmed by process sync's renewal, not by an approved save", () => {
  withTmp((dir) => {
    const repaired = hiddenRoundTrip(dir, { edited: MORE_OPEN_SCOPE });
    const flag = paymentFlag(dir);
    assert.deepEqual([flag?.since, flag?.compositionChanged], [repaired, false]);
    const refused = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Proposed",
    ]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /an open-scope edit alone changes no Status/);
    const reworded = ACCEPTED.replace(
      'rdfs:label "Request the payment"',
      'rdfs:label "Ask for the payment"',
    );
    const sameMeaning = ["--same-meaning", "payment.request-payment=rdfs:label"];
    const saved = approvedSave(dir, reworded, sameMeaning);
    assert.match(saved.out, HIDDEN_EDITS);
    commitAll(dir, "wording saved");
    const renewed = renewPayment(dir, sameMeaning);
    assert.equal(renewed.code, 0, renewed.out);
    assert.match(read(dir), /pm:status "Accepted \(2020-01-20\)" ;\n    pm:hasStep m:payment/);
    exits(dir, ["lifecycle"], 0);
    commitAll(dir, "renewed after confirming the open-scope edit");
    assert.equal(paymentFlag(dir), undefined);
    exits(dir, ["lifecycle"], 0);
  });
});
