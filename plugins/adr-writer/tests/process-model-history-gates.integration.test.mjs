// The alignment gates history judges a promotion by: an invalid model or ADR Status fails
// them, and a promotion committed by hand is judged with the index and the realizing ADR
// records as its commit holds them — unknown where history cannot read them, failed
// where they do not hold.
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  MAPPING,
  OPEN_PATH,
  REFUND_PROCESS,
  cli,
  directEdit,
  exits,
  json,
  model,
  repo,
} from "./process-model-history-helpers.mjs";

test("the alignment gates refuse an invalid model and an invalid ADR Status", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    model(
      dir,
      EXAMPLE.replace(
        /(m:payment\.request-payment a pm:Step ;[\s\S]*?pm:stepKind )"system"/,
        '$1"System"',
      ),
    );
    const invalid = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(invalid.code, 1);
    assert.match(invalid.out, /validation error/);
    model(dir, EXAMPLE);
    const malformed = structuredClone(MAPPING);
    malformed.categories.payments.adrs.push({
      path: "docs/adr/payments/0002-c.md",
      status: "Proposed (2020-01-01)",
    });
    write(dir, "docs/adr/.mapping.json", JSON.stringify(malformed, null, 2));
    const status = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(status.code, 1);
    assert.match(status.out, /Status is invalid/);
    assert.match(cli(dir, ["align", "--process", "payment.take-payment"]).out, /Status is invalid/);
  });
});

test("a hand promotion is an error when its gates fail, uncommitted or committed, and queries mark it", () => {
  withTmp((dir) => {
    const unlinked = { categories: { checkout: MAPPING.categories.checkout } };
    repo(dir, EXAMPLE, unlinked);
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
    );
    const uncommitted = cli(dir, ["lifecycle"]);
    assert.equal(uncommitted.code, 1, uncommitted.out);
    assert.match(uncommitted.out, /became Accepted while the alignment gates did not hold/);
    commitAll(dir, "hand promotion");
    const query = cli(dir, ["query", "--process", "payment.take-payment"]);
    assert.match(query.out, /LIFECYCLE EDIT of process payment\.take-payment/);
    assert.ok(
      json(dir, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
    );
  });
});

test("a hand promotion committed together with an unrelated validation error is judged with that commit's errors", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    const promoted = EXAMPLE.replace(
      'pm:status "Proposed" ;\n    pm:hasStep m:payment',
      'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
    );
    // The realization gates hold, so only the unrelated validation error can fail them.
    model(dir, `${promoted}\nm:ordering.submit-order m:nonsense "x" .\n`, "hand promotion");
    assert.match(cli(dir, ["validate"]).out, /✗ \[process-unknown-term\]/);
    const judged = () => {
      const lifecycle = cli(dir, ["lifecycle"]);
      assert.equal(lifecycle.code, 1, lifecycle.out);
      assert.match(
        lifecycle.out,
        /payment\.take-payment\n\s+became Accepted while the alignment gates did not hold: [^\n]*process-unknown-term/,
      );
      assert.ok(
        json(dir, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
      );
    };
    judged();
    // A later fix leaves the promotion judged by the model it was committed with.
    model(dir, promoted, "unrelated error removed");
    assert.equal(cli(dir, ["validate"]).code, 0);
    judged();
  });
});

test("an index history cannot read leaves the gates of a promotion unknown, never judged without links", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(path.join(outside, "adr"), { recursive: true });
    mkdirSync(path.join(work, "docs"), { recursive: true });
    symlinkSync(path.join(outside, "adr"), path.join(work, "docs/adr"));
    repo(work);
    // The index lives outside the repository: the promotion cannot be judged by its gates.
    const changes = cli(work, ["changes", "--json"]);
    assert.deepEqual(JSON.parse(changes.out).lifecycleEdits, [], changes.out);
    // Nor can ADR Writer's renewal once committed: it stays its own, never a hand edit.
    model(
      work,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const renewed = cli(work, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
    commitAll(work, "renewed after confirming the open path");
    const after = cli(work, ["lifecycle"]);
    assert.equal(after.code, 0, after.out);
    assert.match(
      after.out,
      /payment\.take-payment: the alignment gates of its change at commit \w+ cannot be read from history/,
    );
  });
});

test("a realizing ADR folder history cannot reach leaves the gates of a committed promotion unknown", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(path.join(outside, "payments"), { recursive: true });
    mkdirSync(path.join(work, "docs/adr"), { recursive: true });
    symlinkSync(path.join(outside, "payments"), path.join(work, "docs/adr/payments"));
    repo(work);
    const lifecycle = cli(work, ["lifecycle"]);
    assert.equal(lifecycle.code, 0, lifecycle.out);
    assert.deepEqual(json(work, ["changes"]).lifecycleEdits, []);
  });
});

test("a hand promotion committed with an index that does not parse is a lifecycle edit", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    write(dir, "docs/adr/.mapping.json", "{ not json");
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand with a broken index",
    );
    const committed = cli(dir, ["lifecycle"]);
    assert.equal(committed.code, 1, committed.out);
    assert.match(committed.out, /became Accepted while the alignment gates did not hold/);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    commitAll(dir, "the index repaired");
    assert.ok(
      json(dir, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
    );
  });
});

test("a committed hand promotion is judged with the realizing ADR files of its commit", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    const promoted = EXAMPLE.replace(
      'pm:status "Proposed" ;\n    pm:hasStep m:payment',
      'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
    );
    // In one commit: the payments ADR body says Proposed while the index records
    // Accepted, and the process is promoted by hand — ADR Writer's gate refuses that state.
    write(dir, "docs/adr/payments/0001-b.md", "# 0001-b\n\n## Status\n\nProposed\n");
    model(dir, promoted, "promoted by hand while the ADR says Proposed");
    const committed = cli(dir, ["lifecycle"]);
    assert.equal(committed.code, 1, committed.out);
    assert.match(committed.out, /became Accepted while the alignment gates did not hold/);
    // Repairing the ADR afterwards does not make the promotion a reviewed one.
    write(dir, "docs/adr/payments/0001-b.md", "# 0001-b\n\n## Status\n\nAccepted (2020-01-01)\n");
    commitAll(dir, "the ADR body back in lockstep");
    assert.ok(
      json(dir, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
    );
  });
});

test("a committed hand promotion over a realizing ADR that links into the model is judged by its gates", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      "# 0001-b\n\n## Status\n\nAccepted (2020-01-01)\n\nSee [the flow](../../process/model.ttl).\n",
    );
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand while the ADR cites the model",
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold.*process-adr-identifier/s,
    );
  });
});

test("a committed hand promotion fails its gates on what history can read, whatever else it cannot", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(path.join(outside, "adr"), { recursive: true });
    mkdirSync(path.join(work, "docs"), { recursive: true });
    symlinkSync(path.join(outside, "adr"), path.join(work, "docs/adr"));
    repo(work, EXAMPLE);
    // The index lives outside the repository; the model at the commit has a validation error.
    model(
      work,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ).replace(
        /m:customer a pm:Actor ;\n    rdfs:label "Customer" ;\n/,
        "m:customer a pm:Actor ;\n",
      ),
      "promoted by hand with an actor left without a name",
    );
    const lifecycle = cli(work, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold.*validation error/s,
    );
  });
});

test("a hand promotion committed over an index that does not parse names the index as the reason", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    write(dir, "docs/adr/.mapping.json", "{ not json");
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand with a broken index",
    );
    assert.match(cli(dir, ["lifecycle"]).out, /the ADR index does not parse at that commit/);
  });
});

test("a committed hand promotion over a hand-off no criterion passes through fails its gates where history cannot read the index, and no renewal absorbs it", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(path.join(outside, "adr"), { recursive: true });
    mkdirSync(path.join(work, "docs"), { recursive: true });
    symlinkSync(path.join(outside, "adr"), path.join(work, "docs/adr"));
    repo(work, EXAMPLE);
    const promoted = EXAMPLE.replace(
      'pm:status "Proposed" ;\n    pm:hasStep m:payment',
      'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
    );
    const covering =
      "m:ordering.order-confirmed, m:ordering.order-placed, m:payment.payment-completed";
    // The order-placed hand-off into payment loses its only criterion; the model alone shows it.
    model(
      work,
      promoted.replace(covering, "m:ordering.order-confirmed, m:payment.payment-completed"),
      "promoted by hand over a hand-off no criterion passes through",
    );
    const committed = cli(work, ["lifecycle"]);
    assert.equal(committed.code, 1, committed.out);
    assert.match(
      committed.out,
      /became Accepted while the alignment gates did not hold: hand-off of "ordering\.order-placed" between "ordering\.place-order" and "payment\.take-payment" has no observation criterion/,
    );
    // Covered again and edited in open scope, the promotion stays a lifecycle edit.
    model(work, promoted, "the criterion passes through the event again");
    model(
      work,
      promoted.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    assert.ok(
      json(work, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
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
    assert.match(renewal.out, /has lifecycle edits ADR Writer's transitions do not explain/);
  });
});

test("a process added by hand as Accepted fails on a criterion that executes nothing where history cannot read the index", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(path.join(outside, "adr"), { recursive: true });
    mkdirSync(path.join(work, "docs"), { recursive: true });
    symlinkSync(path.join(outside, "adr"), path.join(work, "docs/adr"));
    repo(work, EXAMPLE);
    write(work, "docs/process/refunds.ttl", REFUND_PROCESS);
    commitAll(work, "a process added by hand as Accepted");
    const lifecycle = cli(work, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /a new process was saved and became Accepted in one change while the alignment gates did not hold: criterion "payment\.refund-payment\.refunded" executes no system step/,
    );
  });
});

test("an index linked to a file the commit does not hold leaves ADR Writer's own promotion unjudged, never a hand edit", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    // The index lives in an ignored local folder the work tree reads.
    write(dir, ".gitignore", "local/\n");
    write(dir, "local/mapping.json", JSON.stringify(MAPPING, null, 2));
    git(dir, ["rm", "-q", "--cached", "docs/adr/.mapping.json"]);
    unlinkSync(path.join(dir, "docs/adr/.mapping.json"));
    symlinkSync("../../local/mapping.json", path.join(dir, "docs/adr/.mapping.json"));
    commitAll(dir, "the index linked to an ignored local file");
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
    const lifecycle = exits(dir, ["lifecycle"], 0);
    assert.match(
      lifecycle.out,
      /payment\.take-payment: the alignment gates of its change at commit \w+ cannot be read from history/,
    );
    assert.deepEqual(json(dir, ["changes"]).lifecycleEdits, []);
  });
});

test("a history object shorter than its stored size never spills into the index read", () => {
  withTmp((dir) => {
    repo(dir);
    directEdit(dir);
    // The first commit's model blob claims more bytes than it holds, so in a batch shared
    // with the index blobs every later answer would be read from the wrong place.
    const first = git(dir, ["rev-list", "--max-parents=0", "HEAD"]).trim();
    const blob = git(dir, ["rev-parse", `${first}:docs/process/model.ttl`]).trim();
    const loose = path.join(dir, ".git/objects", blob.slice(0, 2), blob.slice(2));
    chmodSync(loose, 0o644);
    writeFileSync(loose, deflateSync(Buffer.from("blob 4000\0@prefix m: <urn:x:> .\n")));
    const lifecycle = json(dir, ["lifecycle"]);
    assert.deepEqual(lifecycle.findings, []);
    assert.equal(lifecycle.historyLimited, undefined, "the gates read the index on their own");
  });
});
