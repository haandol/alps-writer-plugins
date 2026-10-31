// Renewals and promotions judged with repository history: a confirmed edit that keeps
// the business composition renews the Accepted date, the gates and the same-day limit
// still apply, and a promotion waits for an uncommitted demotion to be committed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { commitAll, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  MAPPING,
  MORE_OPEN_SCOPE,
  OPEN_PATH,
  PAYMENT_STATUS,
  REWORDED,
  cli,
  exits,
  json,
  model,
  paymentFlag,
  read,
  renewPayment,
  repo,
} from "./process-model-history-helpers.mjs";

test("a confirmed edit that keeps the business composition renews the Accepted date, and its flag clears", () => {
  withTmp((dir) => {
    repo(dir);
    const renew = (args = []) =>
      cli(dir, [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        "2020-01-20",
        ...args,
      ]);
    assert.match(renew().out, /no change since it became Accepted; there is nothing to confirm/);
    // Open scope only.
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const renewed = renew();
    assert.equal(renewed.code, 0, renewed.out);
    assert.match(read(dir), /pm:status "Accepted \(2020-01-20\)" ;\n    pm:hasStep m:payment/);
    commitAll(dir, "renewed after confirming the open path");
    assert.deepEqual(
      json(dir, ["changes"]).unsyncedAccepted.map((u) => u.process),
      [],
    );
    exits(dir, ["lifecycle"], 0);
    // Wording confirmed to keep its meaning; a real change of meaning is refused.
    model(
      dir,
      read(dir).replace('rdfs:label "Request the payment"', 'rdfs:label "Ask for the payment"'),
      "reworded",
    );
    const unconfirmed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-25",
    ]);
    assert.match(unconfirmed.out, /changed its business composition since it became Accepted/);
    const confirmed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-25",
      "--same-meaning",
      "payment.request-payment=rdfs:label",
    ]);
    assert.equal(confirmed.code, 0, confirmed.out);
    commitAll(dir, "renewed after confirming the wording");
    assert.deepEqual(json(dir, ["changes"]).unsyncedAccepted, []);
    assert.equal(cli(dir, ["lifecycle"]).code, 0);
  });
});

test("a renewal needs the gates to hold", () => {
  withTmp((dir) => {
    repo(dir);
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({ categories: { checkout: MAPPING.categories.checkout } }, null, 2),
    );
    const refused = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-29",
    ]);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /alignment gates do not hold/);
  });
});

test("a renewal is refused while the process has a committed lifecycle edit made by hand", () => {
  withTmp((dir) => {
    repo(dir);
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "re-dated by hand",
    );
    model(
      dir,
      read(dir).replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
    );
    const refused = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-29",
    ]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /has lifecycle edits ADR Writer's transitions do not explain/);
  });
});

test("a confirmation on the day of the Accepted date is refused with the reason, and the edit stays flagged", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    const promoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(promoted.code, 0, promoted.out);
    commitAll(dir, "accepted after the alignment review");
    model(
      dir,
      read(dir).replace('rdfs:label "Request the payment"', 'rdfs:label "Ask for the payment"'),
    );
    const sameDay = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--same-meaning",
      "payment.request-payment=rdfs:label",
    ]);
    assert.equal(sameDay.code, 1, sameDay.out);
    assert.match(sameDay.out, /is already Accepted \(/);
    assert.match(
      sameDay.out,
      /a confirmation on the day of its Accepted date cannot be recorded, so the edit stays flagged until it is confirmed again on a later day/,
    );
    commitAll(dir, "reworded");
    assert.deepEqual(
      json(dir, ["changes"]).unsyncedAccepted.map((u) => u.process),
      ["payment.take-payment"],
    );
  });
});

test("a confirmation over a renewal not committed yet is refused with that reason, not the same-day one", () => {
  withTmp((dir) => {
    repo(dir);
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
    );
    const renewed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
    model(
      dir,
      read(dir).replace('rdfs:label "Request the payment"', 'rdfs:label "Ask for the payment"'),
    );
    const again = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--same-meaning",
      "payment.request-payment=rdfs:label",
    ]);
    assert.equal(again.code, 1, again.out);
    assert.match(
      again.out,
      /is already Accepted \([^)]*\) in the working tree, from a confirmation not committed yet; commit it together with this edit/,
    );
    assert.doesNotMatch(again.out, /on the day of its Accepted date/);
  });
});

test("a transition never records an Accepted date later than today, nor renews to one before the current Accepted date", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    const day = new Date();
    day.setDate(day.getDate() + 1);
    const tomorrow = day.toLocaleDateString("sv-SE");
    const accept = (date) =>
      cli(dir, [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        date,
      ]);
    const promotion = accept(tomorrow);
    assert.equal(promotion.code, 1, promotion.out);
    assert.match(promotion.out, new RegExp(`--date ${tomorrow} is later than today`));
    assert.equal(read(dir), EXAMPLE, "nothing was written");
    model(dir, ACCEPTED, "accepted after the alignment review");
    // An open-scope edit any valid date could renew.
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
    );
    const edited = read(dir);
    const renewal = accept(tomorrow);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(renewal.out, new RegExp(`--date ${tomorrow} is later than today`));
    const backdated = accept("2019-12-31");
    assert.equal(backdated.code, 1, backdated.out);
    assert.match(backdated.out, /--date 2019-12-31 is before the current Accepted date 2020-01-01/);
    assert.equal(read(dir), edited, "nothing was written");
  });
});

test("an uncommitted renewal is the warning that names ADR Writer's renewal, not an error", () => {
  withTmp((dir) => {
    repo(dir);
    model(
      dir,
      read(dir).replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
    );
    const renewed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-29",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 0, lifecycle.out);
    assert.match(
      lifecycle.out,
      /⚠ \[process-lifecycle-needs-alignment\][\s\S]*its composition or open scope changed and its Accepted date was renewed; that is ADR Writer's renewal only when the user confirmed the change keeps the business composition, and otherwise needs a passing alignment review/,
    );
  });
});

test("a promotion over a demotion not committed yet, dated on or before the Accepted date HEAD holds, waits until the approved change is committed", () => {
  withTmp((dir) => {
    const status = (value) => `pm:status "${value}" ;\n    pm:hasStep m:payment`;
    repo(dir, ACCEPTED.replace(PAYMENT_STATUS, status("Accepted (2020-01-20)")));
    // The approved change made the process Proposed; its review passed the same day or,
    // on another calendar, the day before.
    model(dir, REWORDED.replace(PAYMENT_STATUS, status("Proposed")));
    const promote = (date) =>
      cli(dir, [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        date,
      ]);
    for (const date of ["2020-01-15", "2020-01-20"]) {
      const refused = promote(date);
      assert.equal(refused.code, 1, refused.out);
      assert.match(
        refused.out,
        new RegExp(
          `"payment\\.take-payment" is Accepted \\(2020-01-20\\) at HEAD and Proposed only in the working tree, so a promotion dated ${date} would not read as a new acceptance once committed; commit the approved change first, then promote`,
        ),
      );
    }
    commitAll(dir, "the approved change");
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
    commitAll(dir, "accepted after its review");
    exits(dir, ["lifecycle"], 0);
    assert.equal(paymentFlag(dir), undefined);
  });
});

test("a promotion over a demotion made by hand names that lifecycle edit, not the commit the guard asks for", () => {
  withTmp((dir) => {
    const status = (value) => `pm:status "${value}" ;\n    pm:hasStep m:payment`;
    repo(dir, ACCEPTED.replace(PAYMENT_STATUS, status("Accepted (2020-01-20)")));
    // Set Proposed by hand, with nothing else changed.
    model(dir, ACCEPTED.replace(PAYMENT_STATUS, status("Proposed")));
    const refused = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /has lifecycle edits ADR Writer's transitions do not explain/);
    assert.doesNotMatch(refused.out, /commit the approved change first/);
  });
});

test("a same-meaning confirmation of a text no possible baseline changed is a usage error", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/process/model.ttl", MORE_OPEN_SCOPE);
    const unchanged = renewPayment(dir, ["--same-meaning", "payment.request-payment=rdfs:label"]);
    assert.equal(unchanged.code, 2, unchanged.out);
    assert.match(unchanged.out, /did not change, so there is nothing to confirm/);
  });
});
