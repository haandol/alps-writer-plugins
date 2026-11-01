// Commits history cannot read: an Accepted Status that first shows after them, models
// moved in from outside the repository or absorbed from a submodule, and a change judged
// from the readable commit before them. A promotion they may hide is in
// process-model-history-hidden.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { commitAll, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  EXTRA,
  MAPPING,
  OPEN_PATH,
  PAYMENT_STATUS,
  REFUND_PROCESS,
  STEP_DEFINITION,
  UNLINKED_PAYMENTS,
  absorbSubmodule,
  addSubmodule,
  cli,
  directEdit,
  head,
  json,
  model,
  read,
  repo,
} from "./process-model-history-helpers.mjs";

test("an unreadable commit never moves the Accepted baseline", () => {
  withTmp((dir) => {
    repo(dir);
    model(
      dir,
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "direct edit",
    );
    write(dir, "docs/process/broken.ttl", "@prefix m: <urn:adr-writer:model:> .\nm:x a");
    commitAll(dir, "broken");
    write(dir, "docs/process/broken.ttl", "");
    commitAll(dir, "fixed");
    const flags = json(dir, ["changes"]).unsyncedAccepted.map((u) => u.process);
    assert.ok(flags.includes("payment.take-payment"), JSON.stringify(flags));
  });
});

test("an Accepted Status that first shows after commits history cannot read leaves the edits since then unknown", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    // Accepted together with a document that does not parse, then repaired with an edit.
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    model(dir, ACCEPTED, "accepted, with a broken document");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    directEdit(dir);
    const changes = json(dir, ["changes"]);
    assert.deepEqual(
      changes.unsyncedUnknown.find((u) => u.process === "payment.take-payment"),
      {
        process: "payment.take-payment",
        reason: "where its Accepted Status first appeared is not in the readable history",
      },
      JSON.stringify(changes),
    );
    assert.equal(
      changes.unsyncedAccepted.find((u) => u.process === "payment.take-payment"),
      undefined,
    );
    // The promotion itself is judged from the commit before; holding gates leave it unjudged.
    assert.match(
      cli(dir, ["lifecycle"]).out,
      /payment\.take-payment: its current lifecycle value appeared right after a commit whose model does not parse/,
    );
  });
});

test("a model moved into the repository after edits history could not see leaves those edits unknown", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(outside, { recursive: true });
    mkdirSync(path.join(work, "docs"), { recursive: true });
    initRepo(work);
    write(work, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(work, MAPPING);
    // The model lives outside the repository, where history cannot follow its edits.
    symlinkSync(outside, path.join(work, "docs/process"));
    write(work, "docs/process/model.ttl", ACCEPTED);
    commitAll(work, "the model kept outside the repository");
    write(
      work,
      "docs/process/model.ttl",
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
    );
    // It moves in, as the refusals over an unreadable HEAD advise.
    const text = readFileSync(path.join(outside, "model.ttl"), "utf8");
    unlinkSync(path.join(work, "docs/process"));
    write(work, "docs/process/model.ttl", text);
    commitAll(work, "the model moved into the repository");
    const changes = cli(work, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    assert.ok(
      JSON.parse(changes.out).unsyncedUnknown.some((u) => u.process === "payment.take-payment"),
      changes.out,
    );
    assert.match(
      cli(work, ["query", "--process", "payment.take-payment"]).out,
      /^Edits of Accepted process payment\.take-payment since it became Accepted are unknown: where its Accepted Status first appeared is not in the readable history$/m,
    );
    // Nor can a confirmation cover what history never showed.
    model(
      work,
      text.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const renewal = cli(work, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(
      renewal.out,
      /cannot tell what changed since "payment\.take-payment" became Accepted: where its Accepted Status first appeared is not in the readable history/,
    );
  });
});

test("an Accepted Status that first shows after commits history cannot read gives no baseline to renew from", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    model(dir, ACCEPTED, "accepted, with a broken document");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "the broken document removed, and an open path added",
    );
    const renewal = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(renewal.code, 1, renewal.out);
    assert.match(
      renewal.out,
      /cannot tell what changed since "payment\.take-payment" became Accepted: where its Accepted Status first appeared is not in the readable history/,
    );
  });
});

test("ADR Writer's own promotion after a first commit history cannot read stays its own, with nothing unknown", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(dir, MAPPING);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    model(dir, EXAMPLE, "the first model, with a broken document");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    commitAll(dir, "the broken document removed");
    const promoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(promoted.code, 0, promoted.out);
    commitAll(dir, "accepted after its review");
    const accepted = head(dir);
    const clean = cli(dir, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
    // An open-scope edit is flagged since that acceptance, renewed, and settled once committed.
    model(
      dir,
      read(dir).replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, false]);
    const renewed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-25",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
    commitAll(dir, "renewed after confirming the open path");
    const settled = cli(dir, ["changes", "--json"]);
    assert.equal(settled.code, 0, settled.out);
  });
});

test("a hand promotion committed right after a commit whose model does not parse is judged against the commit before it", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE, UNLINKED_PAYMENTS);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    commitAll(dir, "a document that does not parse");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "repaired, and promoted by hand",
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold: system step "payment\.request-payment" has no realizing feature/,
    );
    assert.match(
      cli(dir, ["query", "--process", "payment.take-payment"]).out,
      /^LIFECYCLE EDIT of process payment\.take-payment/m,
    );
  });
});

test("a hand re-date right after a commit whose model does not parse is reported, and once undone the earlier acceptance renews", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    commitAll(dir, "a document that does not parse");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "repaired, and re-dated by hand",
    );
    const redated = cli(dir, ["lifecycle"]);
    assert.equal(redated.code, 1, redated.out);
    assert.match(redated.out, /Accepted was re-dated without passing through Proposed/);
    model(dir, ACCEPTED, "the re-date undone");
    const undone = cli(dir, ["lifecycle"]);
    assert.equal(undone.code, 0, undone.out);
    assert.doesNotMatch(undone.out, /history audit limited/);
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const renewal = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(renewal.code, 0, renewal.out);
  });
});

test("a hand demotion and a process added as Accepted, right after a commit whose model does not parse, are lifecycle edits", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    commitAll(dir, "a document that does not parse");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    write(dir, "docs/process/refunds.ttl", REFUND_PROCESS);
    model(
      dir,
      ACCEPTED.replace(PAYMENT_STATUS, 'pm:status "Proposed" ;\n    pm:hasStep m:payment'),
      "repaired; payment demoted by hand, and refunds added as Accepted",
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /Accepted → Proposed without a change to the process's business composition/,
    );
    assert.match(
      lifecycle.out,
      /a new process was saved and became Accepted in one change while the alignment gates did not hold: criterion "payment\.refund-payment\.refunded" executes no system step/,
    );
  });
});

test("an undone hand re-date that first shows after a commit history cannot reach stays unknown, named for that history, never a shallow clone", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(outside, { recursive: true });
    repo(work);
    writeFileSync(path.join(outside, "extra.ttl"), EXTRA);
    symlinkSync(path.join(outside, "extra.ttl"), path.join(work, "docs/process/extra.ttl"));
    commitAll(work, "a model document linked from outside the repository");
    // An ADR Writer renewal could hide behind that link, so the undo cannot be told.
    unlinkSync(path.join(work, "docs/process/extra.ttl"));
    write(work, "docs/process/extra.ttl", EXTRA);
    model(
      work,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "the document moved in, and re-dated by hand",
    );
    model(work, ACCEPTED, "the re-date undone");
    const lifecycle = cli(work, ["lifecycle"]);
    assert.match(
      lifecycle.out,
      /payment\.take-payment: its current lifecycle value appeared where history cannot read the model/,
    );
    const changes = json(work, ["changes"]);
    assert.deepEqual(
      changes.unsyncedUnknown.find((u) => u.process === "payment.take-payment"),
      {
        process: "payment.take-payment",
        reason: "where its Accepted Status first appeared is not in the readable history",
      },
    );
    assert.doesNotMatch(`${lifecycle.out}${JSON.stringify(changes)}`, /shallow/);
  });
});

test("a model moved into the repository while Proposed keeps ADR Writer's later acceptance as the baseline", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(outside, { recursive: true });
    mkdirSync(path.join(work, "docs"), { recursive: true });
    initRepo(work);
    write(work, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(work, MAPPING);
    symlinkSync(outside, path.join(work, "docs/process"));
    write(work, "docs/process/model.ttl", EXAMPLE);
    commitAll(work, "the model kept outside the repository");
    unlinkSync(path.join(work, "docs/process"));
    write(work, "docs/process/model.ttl", EXAMPLE);
    commitAll(work, "the model moved into the repository, as the refusals advise");
    const promoted = cli(work, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-15",
    ]);
    assert.equal(promoted.code, 0, promoted.out);
    commitAll(work, "accepted after its review");
    const accepted = head(work);
    const clean = cli(work, ["changes", "--json"]);
    assert.equal(clean.code, 0, clean.out);
    model(
      work,
      read(work).replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "direct edit",
    );
    const flag = json(work, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
    const demoted = cli(work, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Proposed",
    ]);
    assert.equal(demoted.code, 0, demoted.out);
  });
});

test("an Accepted model absorbed from a docs/process submodule leaves the edits made inside it unknown", () => {
  withTmp((dir) => {
    const work = path.join(dir, "work");
    mkdirSync(work);
    initRepo(work);
    write(work, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(work, MAPPING);
    commitAll(work, "the ADR index");
    addSubmodule(dir, work, "docs/process", { "model.ttl": ACCEPTED });
    write(
      work,
      "docs/process/model.ttl",
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
    );
    absorbSubmodule(work, "docs/process");
    const changes = cli(work, ["changes", "--json"]);
    assert.equal(changes.code, 1, changes.out);
    assert.ok(
      JSON.parse(changes.out).unsyncedUnknown.some((u) => u.process === "payment.take-payment"),
      changes.out,
    );
  });
});

test("an undone hand re-date that leads back to an acceptance history cannot read leaves the edits unknown", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    model(dir, ACCEPTED, "accepted, with a broken document");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    commitAll(dir, "the broken document removed");
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "re-dated by hand",
    );
    model(dir, ACCEPTED, "the re-date undone");
    assert.deepEqual(
      json(dir, ["changes"]).unsyncedUnknown.find((u) => u.process === "payment.take-payment"),
      {
        process: "payment.take-payment",
        reason: "where its Accepted Status first appeared is not in the readable history",
      },
    );
  });
});

test("a hand re-date undone right after a commit whose model does not parse settles back on the acceptance before it", () => {
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
    write(dir, "docs/process/broken.ttl", "m:x a\n");
    commitAll(dir, "a document that does not parse");
    rmSync(path.join(dir, "docs/process/broken.ttl"));
    model(dir, ACCEPTED, "repaired, and the re-date undone");
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 0, lifecycle.out);
    assert.doesNotMatch(lifecycle.out, /history audit limited/);
    const changes = cli(dir, ["changes", "--json"]);
    assert.equal(changes.code, 0, changes.out);
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const renewal = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(renewal.code, 0, renewal.out);
  });
});
