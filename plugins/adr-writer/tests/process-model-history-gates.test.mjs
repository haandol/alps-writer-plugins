// The alignment gates history judges a promotion by: an invalid model or ADR Status fails
// them, and a promotion committed by hand is judged with the index and the realizing ADR
// records as its commit holds them — unknown where history cannot read them, failed
// where they do not hold.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  MAPPING,
  OPEN_PATH,
  REFUND_PROCESS,
  UNLINKED_PAYMENTS,
  cli,
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

test("a committed hand promotion over a realizing ADR whose file is a link loop fails its gates, as on disk", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    rmSync(path.join(dir, "docs/adr/payments/0001-b.md"));
    symlinkSync("0001-b.md", path.join(dir, "docs/adr/payments/0001-b.md"));
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand while the ADR file is a loop",
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold.*process-adr-missing/s,
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

test("a realizing ADR folder kept in a submodule leaves the gates of a committed promotion unknown", () => {
  withTmp((dir) => {
    const sub = path.join(dir, "payments-adrs");
    mkdirSync(sub);
    initRepo(sub);
    write(sub, "0001-b.md", "# 0001-b\n\n## Status\n\nAccepted (2020-01-01)\n");
    commitAll(sub, "the payment ADRs");
    const work = path.join(dir, "work");
    mkdirSync(work);
    initRepo(work);
    write(work, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(work, { categories: { checkout: MAPPING.categories.checkout } });
    git(work, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      "-q",
      sub,
      "docs/adr/payments",
    ]);
    model(work, EXAMPLE, "proposed");
    model(work, ACCEPTED, "accepted after the alignment review");
    const lifecycle = cli(work, ["lifecycle"]);
    assert.equal(lifecycle.code, 0, lifecycle.out);
    assert.match(lifecycle.out, /cannot be read from history/);
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

test("a committed hand promotion fails on a Proposed ADR record though the realizing ADR folder lies outside the repository", () => {
  withTmp((dir) => {
    const outside = path.join(dir, "outside");
    const work = path.join(dir, "work");
    mkdirSync(path.join(outside, "payments"), { recursive: true });
    mkdirSync(path.join(work, "docs/adr"), { recursive: true });
    symlinkSync(path.join(outside, "payments"), path.join(work, "docs/adr/payments"));
    const [record] = MAPPING.categories.payments.adrs;
    repo(work, EXAMPLE, {
      categories: {
        ...MAPPING.categories,
        payments: { ...MAPPING.categories.payments, adrs: [{ ...record, status: "Proposed" }] },
      },
    });
    model(
      work,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand while the payment ADR is Proposed",
    );
    const lifecycle = cli(work, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold: feature "payments" needs at least one Accepted ADR and no Proposed ADR/,
    );
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

test("a hand promotion right after a commit whose model directory is a link that loops is judged against the commit before it", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE, UNLINKED_PAYMENTS);
    rmSync(path.join(dir, "docs/process"), { recursive: true });
    symlinkSync("process", path.join(dir, "docs/process"));
    commitAll(dir, "the model directory is a link to itself");
    unlinkSync(path.join(dir, "docs/process"));
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "the model back, and promoted by hand",
    );
    const lifecycle = exits(dir, ["lifecycle"], 1);
    assert.match(
      lifecycle.out,
      /became Accepted while the alignment gates did not hold: system step "payment\.request-payment" has no realizing feature/,
    );
  });
});

for (const index of ["a link to itself", "a directory"])
  test(`a hand promotion committed with an index that is ${index} is judged with no index`, () => {
    withTmp((dir) => {
      repo(dir, EXAMPLE);
      unlinkSync(path.join(dir, "docs/adr/.mapping.json"));
      if (index === "a directory") write(dir, "docs/adr/.mapping.json/keep.md", "kept\n");
      else symlinkSync(".mapping.json", path.join(dir, "docs/adr/.mapping.json"));
      model(
        dir,
        EXAMPLE.replace(
          'pm:status "Proposed" ;\n    pm:hasStep m:payment',
          'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
        ),
        `promoted by hand over an index that is ${index}`,
      );
      rmSync(path.join(dir, "docs/adr/.mapping.json"), { recursive: true });
      write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
      commitAll(dir, "the index repaired");
      assert.ok(
        json(dir, ["changes"]).lifecycleEdits.some((l) => l.process === "payment.take-payment"),
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

for (const [placement, link] of [
  ["an index reached through a chain of links", "index"],
  ["a realizing ADR file linked", "adr"],
])
  test(`${placement} to a file the commit does not hold leaves ADR Writer's own promotion unjudged, never a hand edit`, () => {
    withTmp((dir) => {
      repo(dir, EXAMPLE);
      // The file lives in an ignored part of a tracked folder that a committed link names.
      write(dir, ".gitignore", "shared/*.json\nshared/*.md\n");
      write(dir, "shared/README.txt", "local copies\n");
      symlinkSync("shared", path.join(dir, "local"));
      const [file, target] =
        link === "index"
          ? ["docs/adr/.mapping.json", "../../local/mapping.json"]
          : ["docs/adr/payments/0001-b.md", "../../../local/0001-b.md"];
      writeFileSync(
        path.join(dir, "shared", path.basename(target)),
        readFileSync(path.join(dir, file), "utf8"),
      );
      git(dir, ["rm", "-q", "--cached", file]);
      unlinkSync(path.join(dir, file));
      symlinkSync(target, path.join(dir, file));
      commitAll(dir, `${placement} to an ignored file`);
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

test("a hand promotion over a realizing ADR missing under a link history follows fails its gates, as on disk", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    // The payments ADRs move to a tracked folder a committed link names, without the realizing ADR.
    write(dir, "shared/payments/README.md", "payments ADRs\n");
    rmSync(path.join(dir, "docs/adr/payments"), { recursive: true });
    symlinkSync("../../shared/payments", path.join(dir, "docs/adr/payments"));
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand while the realizing ADR is missing",
    );
    const lifecycle = exits(dir, ["lifecycle"], 1);
    assert.match(lifecycle.out, /became Accepted while the alignment gates did not hold/);
  });
});
