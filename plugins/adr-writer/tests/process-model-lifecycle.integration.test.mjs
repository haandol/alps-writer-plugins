// Process lifecycle, change impact and alignment-review plan: Status values
// and transitions, which processes a
// semantic change makes Proposed, the approval summary's data, the one-change-
// unit apply, and the mechanical gates of the alignment review.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  PLUGIN_ROOT,
  cachedRepo,
  commitAll,
  initRepo,
  withTmp,
  write,
  writeAdrFiles,
} from "./helpers.mjs";
import { ACCEPTED, EXAMPLE, cli } from "./process-model-helpers.mjs";
import { MAPPING } from "./process-model-lifecycle-helpers.mjs";

test("impact, apply and transition move one approved change unit and refuse stale or unexplained edits", () => {
  withTmp((dir) => {
    // The tool's view of "committed" is this repository, wherever the temp directory lives.
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(dir, MAPPING);
    write(
      dir,
      "docs/adr/glossary.md",
      "| Term | Meaning |\n| --- | --- |\n| Order | a request |\n| Settlement | paying sellers |\n",
    );
    write(dir, "docs/process/model.ttl", ACCEPTED);
    commitAll(dir, "accepted model");
    cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), { recursive: true });
    write(
      dir,
      "draft/model.ttl",
      ACCEPTED.replace(
        '"The money for an order was collected."',
        '"The money for an order was collected and settled."',
      ),
    );

    const impact = JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json"]).out);
    assert.deepEqual(impact.processesToPropose, ["ordering.place-order", "payment.take-payment"]);
    assert.deepEqual(
      impact.glossaryCleanup.map((g) => g.term),
      ["Order"],
    );

    // The approved unit: model, glossary without the owned term, and a change-log line.
    write(
      dir,
      "glossary.next.md",
      "| Term | Meaning |\n| --- | --- |\n| Settlement | paying sellers |\n",
    );
    const bound = JSON.parse(
      cli(dir, ["impact", "--draft", "draft", "--glossary", "glossary.next.md", "--json"]).out,
    );
    write(dir, "docs/process/model.ttl", `${ACCEPTED}\n`); // a concurrent edit after the summary
    const stale = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      bound.baseHash,
      "--glossary",
      "glossary.next.md",
    ]);
    assert.equal(stale.code, 1);
    assert.match(stale.out, /changed after the approval summary/);
    assert.equal(
      readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8"),
      `${ACCEPTED}\n`,
      "nothing is overwritten",
    );

    const fresh = JSON.parse(
      cli(dir, ["impact", "--draft", "draft", "--glossary", "glossary.next.md", "--json"]).out,
    );
    const applied = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      fresh.baseHash,
      "--glossary",
      "glossary.next.md",
      "--log",
      "`payment.payment-completed` now means collected and settled: settlement moved into payment",
    ]);
    assert.equal(applied.code, 0, applied.out);
    const model = readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8");
    assert.equal(
      (model.match(/pm:status "Proposed"/g) ?? []).length,
      2,
      "both affected processes are Proposed",
    );
    assert.doesNotMatch(
      readFileSync(path.join(dir, "docs/adr/glossary.md"), "utf8"),
      /\| Order \|/,
    );
    assert.match(
      readFileSync(path.join(dir, "docs/process/change-log.md"), "utf8"),
      /^# Process model change log[\s\S]*\n- \d{4}-\d{2}-\d{2} — `payment\.payment-completed` now means/,
    );

    // A draft cannot make a process Accepted or retire it without its log line.
    write(
      dir,
      "draft/model.ttl",
      model.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
    );
    const unexplained = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json"]).out).baseHash,
    ]);
    assert.equal(unexplained.code, 1);
    assert.match(unexplained.out, /change-log line/);

    // Transition only promotes after the alignment gates or marks a directly edited process Proposed.
    assert.match(
      cli(dir, ["transition", "--process", "payment.take-payment", "--to", "Superseded"]).out,
      /Superseded is applied with its index-link changes and change-log line through `apply`/,
    );
    const unlinkedPayments = { categories: { checkout: MAPPING.categories.checkout } };
    write(dir, "docs/adr/.mapping.json", JSON.stringify(unlinkedPayments, null, 2));
    assert.match(
      cli(dir, ["transition", "--process", "payment.take-payment", "--to", "Accepted"]).out,
      /alignment gates do not hold/,
    );
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    const ok = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-02",
    ]);
    assert.equal(ok.code, 0, ok.out);
    const accepted = readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8");
    assert.match(accepted, /pm:status "Accepted \(2020-01-02\)" ;\n    pm:hasStep m:payment/);
    commitAll(dir, "payment accepted after its review");
    assert.match(
      cli(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"]).out,
      /no business-composition change/,
      "Accepted → Proposed needs a detected composition change",
    );

    // Retirement is one approved unit: Status and replacement, removed links, a change-log line.
    const retired = accepted.replace(
      'pm:status "Accepted (2020-01-02)" ;\n    pm:hasStep m:payment',
      'pm:status "Superseded" ;\n    pm:replacedBy m:ordering.place-order ;\n    pm:hasStep m:payment',
    );
    write(dir, "draft/model.ttl", retired);
    const withoutPayments = {
      categories: {
        checkout: MAPPING.categories.checkout,
        payments: { ...MAPPING.categories.payments, realizes: [] },
      },
    };
    write(dir, "mapping.next.json", JSON.stringify(withoutPayments, null, 2));
    const hash = JSON.parse(
      cli(dir, ["impact", "--draft", "draft", "--mapping", "mapping.next.json", "--json"]).out,
    ).baseHash;
    const missingLog = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      hash,
      "--mapping",
      "mapping.next.json",
    ]);
    assert.equal(missingLog.code, 1);
    assert.match(missingLog.out, /change-log line/);
    const retire = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      hash,
      "--mapping",
      "mapping.next.json",
      "--log",
      "`payment.take-payment` superseded by `ordering.place-order`: payment moved into ordering",
    ]);
    assert.equal(retire.code, 0, retire.out);
    assert.match(
      readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8"),
      /pm:status "Superseded" ;\n    pm:replacedBy m:ordering\.place-order ;/,
    );
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8")).categories.payments
        .realizes,
      [],
    );
    assert.match(
      readFileSync(path.join(dir, "docs/process/change-log.md"), "utf8"),
      /— `payment\.take-payment` superseded by `ordering\.place-order`: payment moved into ordering\n/,
    );
    assert.equal(cli(dir, ["validate"]).code, 0);
    assert.ok(existsSync(path.join(dir, "docs/process/model.ttl")));
  });
});

/** A realizing ADR file whose body states `status`. */
const adrFile = (title, status) => `# ADR 0001: ${title}

Date: 2020-01-01

## Status

${status}

## Purpose

The store collects the money for an order before the order is confirmed.

## Decision

${title}.

## Consequences

- Every confirmed order is paid.
`;

test("a realizing ADR whose body Status differs from its index record blocks the alignment gates until they agree", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    write(
      dir,
      "docs/adr/checkout/0001-a.md",
      adrFile("Confirm paid orders", "Accepted (2020-01-01)"),
    );
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      adrFile("Request payment for new orders", "Proposed"),
    );
    write(dir, "docs/process/model.ttl", EXAMPLE);
    commitAll(dir);
    const promote = () =>
      cli(dir, [
        "transition",
        "--process",
        "payment.take-payment",
        "--to",
        "Accepted",
        "--date",
        "2020-01-02",
      ]);

    const aligned = cli(dir, ["align", "--process", "payment.take-payment", "--json"]);
    assert.equal(aligned.code, 1, aligned.out);
    assert.ok(
      JSON.parse(aligned.out).blocking.some((b) =>
        /process-adr-status-mismatch docs\/adr\/payments\/0001-b\.md/.test(b),
      ),
      aligned.out,
    );
    const refused = promote();
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /alignment gates do not hold[\s\S]*process-adr-status-mismatch/);
    assert.equal(readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8"), EXAMPLE);

    write(
      dir,
      "docs/adr/payments/0001-b.md",
      adrFile("Request payment for new orders", "Accepted (2020-01-01)"),
    );
    const promoted = promote();
    assert.equal(promoted.code, 0, promoted.out);
    assert.match(
      readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8"),
      /pm:status "Accepted \(2020-01-02\)" ;\n    pm:hasStep m:payment/,
    );
  });
});

/** A committed repository whose index lists exactly its ADR files, each stating its recorded Status. */
function inLockstep(dir) {
  cachedRepo(dir, "lifecycle: in lockstep", (at) => {
    initRepo(at);
    write(at, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(at, MAPPING);
    write(at, "docs/process/model.ttl", EXAMPLE);
    commitAll(at);
  });
}

const promotePayment = (dir) =>
  cli(dir, [
    "transition",
    "--process",
    "payment.take-payment",
    "--to",
    "Accepted",
    "--date",
    "2020-01-02",
  ]);

/** align and transition both refuse payment.take-payment over `code` at `adr`, and the model is left as it was. */
function assertGatesBlocked(dir, code, adr) {
  const aligned = cli(dir, ["align", "--process", "payment.take-payment", "--json"]);
  assert.equal(aligned.code, 1, aligned.out);
  assert.ok(
    JSON.parse(aligned.out).blocking.some((b) => b.includes(`${code} ${adr}`)),
    aligned.out,
  );
  const refused = promotePayment(dir);
  assert.equal(refused.code, 1, refused.out);
  assert.match(refused.out, new RegExp(`alignment gates do not hold[\\s\\S]*${code}`));
  assert.equal(readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8"), EXAMPLE);
}

function assertPromoted(dir) {
  const promoted = promotePayment(dir);
  assert.equal(promoted.code, 0, promoted.out);
  assert.match(
    readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8"),
    /pm:status "Accepted \(2020-01-02\)" ;\n    pm:hasStep m:payment/,
  );
}

test("a realizing feature whose only indexed ADR file is missing blocks the alignment gates until the file is back", () => {
  withTmp((dir) => {
    inLockstep(dir);
    rmSync(path.join(dir, "docs/adr/payments/0001-b.md"));
    assertGatesBlocked(dir, "process-adr-missing", "docs/adr/payments/0001-b.md");
    writeAdrFiles(dir, MAPPING);
    assertPromoted(dir);
  });
});

for (const [label, where, change] of [
  [
    "an ADR record without a path",
    "payments",
    (dir) => {
      rmSync(path.join(dir, "docs/adr/payments/0001-b.md"));
      return [{ status: "Accepted (2020-01-01)", summary: "s" }];
    },
  ],
  [
    "an ADR record naming another feature's ADR",
    "docs/adr/checkout/0001-a.md",
    (dir) => {
      rmSync(path.join(dir, "docs/adr/payments/0001-b.md"));
      return [
        { path: "docs/adr/checkout/0001-a.md", status: "Accepted (2020-01-01)", summary: "s" },
      ];
    },
  ],
  [
    "an ADR record naming a file that is not an ADR",
    "docs/adr/payments/notes.md",
    (dir) => {
      renameSync(
        path.join(dir, "docs/adr/payments/0001-b.md"),
        path.join(dir, "docs/adr/payments/notes.md"),
      );
      return [
        { path: "docs/adr/payments/notes.md", status: "Accepted (2020-01-01)", summary: "s" },
      ];
    },
  ],
  ["ADR records that are not a list", "payments", () => ({})],
])
  test(`a realizing feature with ${label} blocks the alignment gates until the index names its ADR files`, () => {
    withTmp((dir) => {
      inLockstep(dir);
      const mapping = structuredClone(MAPPING);
      mapping.categories.payments.adrs = change(dir);
      write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
      assertGatesBlocked(dir, "process-adr-record-invalid", where);
      // The structure lint reports the record itself, once, and never crashes on it.
      const lint = spawnSync(
        "node",
        [path.join(PLUGIN_ROOT, "scripts", "adr-structure-lint.mjs")],
        {
          cwd: dir,
          encoding: "utf8",
        },
      );
      assert.equal(lint.status, 1, lint.stderr);
      assert.match(lint.stdout, /\[map-adrs?-|\[mapping-dangling-adr\]/);
      assert.doesNotMatch(lint.stdout, /process-adr-record-invalid/);
      rmSync(path.join(dir, "docs/adr/payments"), { recursive: true, force: true });
      write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
      writeAdrFiles(dir, MAPPING);
      assertPromoted(dir);
    });
  });

test("an unindexed Proposed ADR file in a realizing feature's directory blocks the alignment gates until the index and the files agree", () => {
  withTmp((dir) => {
    inLockstep(dir);
    // The index alone still counts the feature as Accepted 1, Proposed 0.
    write(dir, "docs/adr/payments/0002-c.md", adrFile("Retry declined cards", "Proposed"));
    assertGatesBlocked(dir, "process-adr-unindexed", "docs/adr/payments/0002-c.md");
    rmSync(path.join(dir, "docs/adr/payments/0002-c.md"));
    assertPromoted(dir);
  });
});

/** A committed repository holding the example model and its index, built once per test process. */
function committedExample(dir) {
  cachedRepo(dir, "lifecycle: example committed", (at) => {
    initRepo(at);
    write(at, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    write(at, "docs/process/model.ttl", EXAMPLE);
    commitAll(at);
  });
}

test("change-log lines are newest first across saves", () => {
  withTmp((dir) => {
    committedExample(dir);
    const save = (from, to, line) => {
      cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), {
        recursive: true,
        force: true,
      });
      write(
        dir,
        "draft/model.ttl",
        readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8").replace(from, to),
      );
      rmSync(path.join(dir, "draft/change-log.md"), { force: true });
      const { baseHash } = JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json"]).out);
      assert.equal(
        cli(dir, ["apply", "--draft", "draft", "--base-hash", baseHash, "--log", line]).code,
        0,
      );
    };
    save('"The order has no payment yet."', '"The order is unpaid."', "first change");
    save('"The order is unpaid."', '"The order has no payment."', "second change");
    const log = readFileSync(path.join(dir, "docs/process/change-log.md"), "utf8");
    assert.ok(log.indexOf("second change") < log.indexOf("first change"), log);
  });
});

test("the dates a save records are ISO calendar dates whatever locale data the runtime has", () => {
  withTmp((dir) => {
    committedExample(dir);
    // A runtime without the Swedish locale data formats a date the way its default locale does.
    const preload = write(
      dir,
      "us-dates.mjs",
      'Date.prototype.toLocaleDateString = () => "11/1/2026";\n',
    );
    const env = { ...process.env, NODE_OPTIONS: `--import ${pathToFileURL(preload).href}` };
    cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), { recursive: true });
    write(
      dir,
      "draft/model.ttl",
      EXAMPLE.replace('"The order has no payment yet."', '"The order is unpaid."'),
    );
    const { baseHash } = JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json"], env).out);
    const saved = cli(
      dir,
      ["apply", "--draft", "draft", "--base-hash", baseHash, "--log", "reworded"],
      env,
    );
    assert.equal(saved.code, 0, saved.out);
    const log = readFileSync(path.join(dir, "docs/process/change-log.md"), "utf8");
    assert.match(log, /^- \d{4}-\d{2}-\d{2} — reworded$/m, log);
  });
});
