// Deterministic business-context queries: only the
// connected elements, with process and ADR Status, errors and change flags.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { changeFlags, ontologyFindings } from "../scripts/ontology-fs.mjs";
import { queryContext, renderContext } from "../scripts/ontology-query.mjs";
import { cachedRepo, commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import { EXAMPLE, cli } from "./ontology-helpers.mjs";
import { HEAD, SHIPPING, MAPPING, run } from "./ontology-query-helpers.mjs";

/**
 * The same reading the CLI query does, in-process, for a repository directory: one
 * reading of the model and its history serves every target asked about that state.
 */
function contextsIn(dir, targets) {
  const rel = (p) => path.relative(dir, p).split(path.sep).join("/");
  const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
  const { findings, index } = ontologyFindings({
    ontologyDir: path.join(dir, "docs/ontology"),
    adrRoot: path.join(dir, "docs/adr"),
    mapping,
    mappingPath: "docs/adr/.mapping.json",
    rel,
    cwd: dir,
  });
  const changes = changeFlags("docs/ontology", index, { cwd: dir });
  return targets.map((target) => queryContext({ index, mapping, findings, changes, target }));
}

function contextIn(dir, target) {
  return contextsIn(dir, [target])[0];
}

const changesOf = (dir, id) => contextIn(dir, { kind: "category", id }).changes;

/** A repository whose Accepted shipping process was first saved Proposed, as Ontology Writer saves it. */
function repo(dir) {
  cachedRepo(dir, "query: shipping accepted", (at) => {
    initRepo(at);
    write(at, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(at, MAPPING);
    write(at, "docs/ontology/ordering.ttl", EXAMPLE);
    write(
      at,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace('onto:status "Accepted (2020-01-01)"', 'onto:status "Proposed"'),
    );
    commitAll(at, "proposed");
    write(at, "docs/ontology/shipping.ttl", SHIPPING);
    commitAll(at, "accepted after the alignment review");
  });
}

/** That repository with the Accepted shipping process's packing step edited directly and committed. */
function shippingEdited(dir) {
  cachedRepo(dir, "query: shipping edited directly", (at) => {
    repo(at);
    write(
      at,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace(
        'onto:definition "The warehouse packs the order lines."',
        'onto:definition "The warehouse packs and labels the order lines."',
      ),
    );
    commitAll(at, "direct edit");
  });
}

test("uncommitted edits are flagged inside the scope and only counted outside it", () => {
  withTmp((dir) => {
    repo(dir);
    const clean = contextIn(dir, { kind: "category", id: "fulfilment" });
    assert.deepEqual(clean.changes, {
      available: true,
      lifecycleEdits: [],
      uncommitted: [],
      uncommittedChanges: [],
      uncommittedElsewhere: false,
      unsyncedAccepted: [],
      unsyncedAcceptedElsewhere: false,
    });

    write(
      dir,
      "docs/ontology/ordering.ttl",
      EXAMPLE.replace('rdfs:label "Order" ;', 'rdfs:label "Purchase order" ;').replace(
        'rdfs:label "Customer"',
        'rdfs:label "Shopper"',
      ),
    );
    const edited = contextIn(dir, { kind: "category", id: "fulfilment" });
    assert.deepEqual(edited.changes.uncommitted, ["ordering.order"]);
    assert.equal(
      edited.changes.uncommittedElsewhere,
      true,
      "the customer label is outside the fulfilment scope",
    );
    assert.match(renderContext(edited), /UNCOMMITTED model edits in scope[^\n]*ordering\.order/);
  });
});

test("committed direct edits of an Accepted process are flagged until it is accepted again", () => {
  withTmp((dir) => {
    // A committed direct edit of the Accepted shipping process's composition.
    shippingEdited(dir);
    const [r, viaConcept, other] = contextsIn(dir, [
      { kind: "category", id: "fulfilment" },
      { kind: "category", id: "ordering" },
      { kind: "category", id: "reports" },
    ]);
    assert.deepEqual(r.changes.unsyncedAccepted, [
      {
        process: "shipping.ship-order",
        elements: ["shipping.pack-order"],
        changes: [{ id: "shipping.pack-order", change: "changed" }],
        compositionChanged: true,
      },
    ]);
    assert.deepEqual(
      viaConcept.changes.unsyncedAccepted.map((u) => u.process),
      ["shipping.ship-order"],
      "packing shares the Order concept",
    );
    assert.equal(other.changes.unsyncedAcceptedElsewhere, true);

    // Description and lifecycle edits are not composition changes.
    write(
      dir,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace(
        'onto:definition "The warehouse packs the order lines."',
        'onto:definition "The warehouse packs and labels the order lines."',
      ).replace("onto:status", 'onto:summary "Packing." ; onto:status'),
    );
    commitAll(dir, "summary only");
    assert.deepEqual(
      contextIn(dir, { kind: "category", id: "fulfilment" }).changes.unsyncedAccepted[0].elements,
      ["shipping.pack-order"],
    );

    // Accepting again with a new literal resets the baseline.
    write(
      dir,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace(
        'onto:definition "The warehouse packs the order lines."',
        'onto:definition "The warehouse packs and labels the order lines."',
      ).replace('"Accepted (2020-01-01)"', '"Accepted (2020-01-30)"'),
    );
    commitAll(dir, "accepted again");
    assert.deepEqual(
      contextIn(dir, { kind: "category", id: "fulfilment" }).changes.unsyncedAccepted,
      [],
    );

    // A committed edit of a Proposed process is not this flag's concern.
    write(
      dir,
      "docs/ontology/ordering.ttl",
      EXAMPLE.replace(
        'onto:definition "The customer sends the cart as an order."',
        'onto:definition "The customer sends the whole cart as an order."',
      ),
    );
    commitAll(dir, "proposed edit");
    assert.deepEqual(
      contextIn(dir, { kind: "category", id: "ordering" }).changes.unsyncedAccepted,
      [],
    );

    // An open-scope edit of an Accepted process counts.
    write(
      dir,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace(
        'onto:definition "The warehouse packs the order lines."',
        'onto:definition "The warehouse packs and labels the order lines."',
      )
        .replace('"Accepted (2020-01-01)"', '"Accepted (2020-01-30)"')
        .replace('"none"^^onto:NoOpenScope', '"Damaged parcels."^^onto:OpenPath'),
    );
    commitAll(dir, "open scope");
    assert.deepEqual(
      contextIn(dir, { kind: "category", id: "fulfilment" }).changes.unsyncedAccepted,
      [
        {
          process: "shipping.ship-order",
          elements: ["shipping.ship-order"],
          changes: [{ id: "shipping.ship-order", change: "changed" }],
          compositionChanged: false,
        },
      ],
      "an open-scope edit is flagged but is no composition change",
    );
    assert.equal(git(dir, ["status", "--porcelain"]).trim(), "", "queries write nothing");
  });
});

test("a committed edit of a step outside the scope flags its in-scope Accepted process without naming the step", () => {
  withTmp((dir) => {
    repo(dir);
    const accepted = EXAMPLE.replace(
      /(m:payment\.take-payment a onto:Process ;[\s\S]*?onto:status )"Proposed"/,
      '$1"Accepted (2020-01-01)"',
    );
    write(dir, "docs/ontology/ordering.ttl", accepted);
    commitAll(dir, "payment accepted after the alignment review");
    write(
      dir,
      "docs/ontology/ordering.ttl",
      accepted.replace(
        '"The customer authorizes the card charge for the order."',
        '"The customer authorizes the whole card charge for the order."',
      ),
    );
    commitAll(dir, "direct edit of requesting the payment");
    const { changes, ...context } = contextIn(dir, { kind: "category", id: "fulfilment" });
    // Packing reacts to the payment captured in the payment process, never to its request step.
    assert.match(JSON.stringify(context), /"payment\.take-payment"/);
    assert.doesNotMatch(JSON.stringify(context), /payment\.request-payment/);
    assert.deepEqual(changes.unsyncedAccepted, [
      { process: "payment.take-payment", elements: [], changes: [], compositionChanged: true },
    ]);
  });
});

test("the query is silent where no model exists and exits non-zero for a missing target", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING));
    const none = cli(dir, ["query", "--category", "ordering"]);
    assert.equal(none.code, 0);
    assert.match(
      none.out,
      /no ontology in docs\/ontology; the business ontology level does not apply/,
    );
  });
  withTmp((dir) => {
    repo(dir);
    assert.equal(cli(dir, ["query", "--category", "ordering"]).code, 0);
    assert.equal(cli(dir, ["query", "--category", "billing"]).code, 1);
    assert.equal(cli(dir, ["query"]).code, 2);
    assert.equal(cli(dir, ["query", "--category", "a", "--event", "b"]).code, 2);
  });
});

test("an unreadable ADR index makes every result incomplete and never reads as an absent category", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2).slice(0, 120));
    const category = cli(dir, ["query", "--category", "ordering"]);
    assert.equal(category.code, 1);
    assert.match(
      category.out,
      /INCOMPLETE[\s\S]*ontology-index-unreadable\] docs\/adr\/\.mapping\.json:\d+:\d+/,
    );
    assert.doesNotMatch(category.out, /NOT FOUND/);
    for (const args of [
      ["--process", "payment.take-payment"],
      ["--concept", "ordering.order"],
      ["--event", "payment.payment-completed"],
    ])
      assert.equal(cli(dir, ["query", ...args]).code, 1, args.join(" "));
    assert.equal(cli(dir, ["validate"]).code, 1);
  });
});

test("an ADR index that exists but cannot be read is unreadable, never absent", () => {
  withTmp((dir) => {
    repo(dir);
    // A folder where the index file belongs: it exists, but no read succeeds.
    rmSync(path.join(dir, "docs/adr/.mapping.json"));
    mkdirSync(path.join(dir, "docs/adr/.mapping.json"));
    const category = cli(dir, ["query", "--category", "ordering"]);
    assert.equal(category.code, 1, category.out);
    assert.match(
      category.out,
      /INCOMPLETE[\s\S]*ontology-index-unreadable\] docs\/adr\/\.mapping\.json the ADR index cannot be read/,
    );
    assert.doesNotMatch(category.out, /NOT FOUND/);
    assert.equal(cli(dir, ["validate"]).code, 1);
    const impact = cli(dir, ["impact", "--base", "HEAD"]);
    assert.equal(impact.code, 1, impact.out);
    assert.match(
      impact.out,
      /\[ontology-index-unreadable\] docs\/adr\/\.mapping\.json: fix the ADR index before a change approval/,
    );
  });
});

test("while the ADR index cannot be read, the process query text says a system step's realization is unknown until that error is fixed", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2).slice(0, 120));
    const query = cli(dir, ["query", "--process", "ordering.place-order"]);
    assert.equal(query.code, 1);
    assert.match(
      query.out,
      /^Step ordering\.submit-order "Submit the order" — [^\n]*; realized by: unknown; realization unknown until the reported ADR index error is fixed$/m,
    );
  });
});

test("deleting an element connected to the target is an in-scope change, committed or not", () => {
  withTmp((dir) => {
    repo(dir);
    const withoutPolicy = EXAMPLE.replace(
      /m:ordering\.confirm-on-payment a onto:Policy ;[\s\S]*?\n\n/,
      "",
    ).replace("    onto:triggers m:ordering.confirm-on-payment ;\n", "");
    write(dir, "docs/ontology/ordering.ttl", withoutPolicy);
    const uncommitted = changesOf(dir, "ordering");
    assert.ok(
      uncommitted.uncommittedChanges.some(
        (c) => c.id === "ordering.confirm-on-payment" && c.change === "removed",
      ),
      JSON.stringify(uncommitted),
    );
    write(dir, "docs/ontology/ordering.ttl", EXAMPLE);
    // A committed deletion in an Accepted process names the deleted element.
    write(
      dir,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace(/m:shipping\.pack-when-paid a onto:Policy ;[\s\S]*?\.\n/, "").replace(
        "m:payment.payment-completed onto:triggers m:shipping.pack-when-paid .\n",
        "",
      ),
    );
    commitAll(dir, "remove the packing policy");
    const [flag] = changesOf(dir, "fulfilment").unsyncedAccepted;
    assert.ok(
      flag.changes.some((c) => c.id === "shipping.pack-when-paid" && c.change === "removed"),
      JSON.stringify(flag),
    );
  });
});

test("a concept or event target with its own type error is incomplete at the error's position, never absent", () => {
  withTmp((dir) => {
    repo(dir);
    const broken = EXAMPLE.replace(
      "m:ordering.order a onto:BusinessConcept ;",
      "m:ordering.order a onto:BusinessConcept, onto:Actor ;",
    ).replace(
      "m:payment.payment-completed a onto:BusinessEvent ;",
      "m:payment.payment-completed a onto:BusinessEvnt ;",
    );
    write(dir, "docs/ontology/ordering.ttl", broken);
    const lineOf = (subject) => broken.slice(0, broken.indexOf(`${subject} a `)).split("\n").length;
    for (const [flag, id, code] of [
      ["--concept", "ordering.order", "ontology-type-multiple"],
      ["--event", "payment.payment-completed", "ontology-unknown-term"],
    ]) {
      const query = cli(dir, ["query", flag, id, "--json"]);
      assert.equal(query.code, 1, flag);
      const r = JSON.parse(query.out);
      assert.equal(r.found, null, flag);
      assert.equal(r.complete, false, flag);
      const where = `docs/ontology/ordering.ttl:${lineOf(`m:${id}`)}`;
      assert.ok(
        r.errors.some((e) => e.code === code && e.element === id && e.where === where),
        `${where}: ${JSON.stringify(r.errors)}`,
      );
    }
  });
});

test("a committed deletion of a rule that applied to the target's step counts as in scope", () => {
  withTmp((dir) => {
    repo(dir);
    const rule = `${HEAD}m:pack-rule a onto:BusinessRule ; rdfs:label "Pack rule" ; onto:definition "d" ; onto:basisKind "user-decision" ; onto:basis "b" ; onto:constrains m:shipping.pack-order, m:ordering.confirm-order .\n`;
    write(dir, "docs/ontology/rules.ttl", rule);
    write(
      dir,
      "docs/ontology/shipping.ttl",
      SHIPPING.replace(
        'onto:status "Accepted (2020-01-01)"',
        'onto:status "Accepted (2020-01-02)"',
      ),
    );
    commitAll(dir, "accepted with its rule");
    write(dir, "docs/ontology/rules.ttl", "");
    commitAll(dir, "rule deleted directly");
    const [flag] = changesOf(dir, "fulfilment").unsyncedAccepted;
    assert.ok(
      flag?.changes.some((c) => c.id === "pack-rule" && c.change === "removed"),
      JSON.stringify(flag),
    );
  });
});

test("a shallow clone marks committed edits unknown, and an unparsable HEAD still shows uncommitted documents", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    mkdirSync(source);
    shippingEdited(source);
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${source}`, "clone"], { cwd: dir });
    const clone = path.join(dir, "clone");
    const shallow = JSON.parse(cli(clone, ["query", "--category", "fulfilment", "--json"]).out);
    assert.ok(
      shallow.changes.unsyncedUnknown?.some((u) => u.process === "shipping.ship-order"),
      JSON.stringify(shallow.changes),
    );
    // Agents read the text output.
    assert.match(
      cli(clone, ["query", "--category", "fulfilment"]).out,
      /Edits of Accepted process shipping\.ship-order since it became Accepted are unknown: the clone is shallow/,
    );
    assert.doesNotMatch(cli(clone, ["lifecycle"]).out, /starts as Proposed/);
  });
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/shipping.ttl", "m:x a [ ] .\n");
    commitAll(dir, "broken");
    write(dir, "docs/ontology/shipping.ttl", SHIPPING);
    const r = JSON.parse(cli(dir, ["query", "--category", "fulfilment", "--json"]).out);
    assert.match(r.changes.committedUnavailable, /cannot be parsed/);
    assert.deepEqual(r.changes.uncommittedDocuments, ["docs/ontology/shipping.ttl"]);
    assert.match(
      cli(dir, ["query", "--category", "fulfilment"]).out,
      /UNCOMMITTED model documents differ from HEAD \(not a settled reference\): docs\/ontology\/shipping\.ttl/,
    );
  });
});

test("a feature whose ADR body Status differs from its index record leaves its steps' realization unknown and the results showing them incomplete", () => {
  withTmp((dir) => {
    repo(dir);
    // The index records the ordering ADR as Proposed; its body says otherwise.
    write(
      dir,
      "docs/adr/ordering/0001-confirm.md",
      "# ADR 0001: confirm\n\n## Status\n\nAccepted (2020-01-01)\n",
    );
    const ordering = JSON.parse(cli(dir, ["query", "--category", "ordering", "--json"]).out);
    assert.equal(ordering.complete, false);
    assert.ok(
      ordering.errors.some(
        (e) => e.code === "ontology-adr-status-mismatch" && e.category === "ordering",
      ),
      JSON.stringify(ordering.errors),
    );
    const { step } = ordering.steps.find((s) => s.step.id === "ordering.submit-order");
    assert.equal(step.realizationUnknown, true);
    assert.deepEqual(
      step.realizedBy.map((r) => [r.category, r.untrusted]),
      [["ordering", true]],
    );
    const text = cli(dir, ["query", "--category", "ordering"]).out;
    assert.match(
      text,
      /^Step ordering\.submit-order [^\n]*; realized by: ordering; realization unknown until the reported ADR index error is fixed$/m,
    );
    assert.match(
      text,
      /^  ordering: docs\/adr\/ordering\/0001-confirm\.md \[Proposed\] — its index records do not match its ADR files$/m,
    );
  });
  // A scope that shows no step of that feature is not affected.
  const reports = {
    level: "error",
    code: "ontology-adr-status-mismatch",
    where: "docs/adr/reports/0001-r.md",
    element: null,
    category: "reports",
    msg: "realizing ADR's Status differs from its index record",
  };
  assert.equal(run({ kind: "category", id: "fulfilment" }, { extra: [reports] }).complete, true);
  assert.equal(run({ kind: "category", id: "reports" }, { extra: [reports] }).complete, false);
});

test("a feature whose indexed ADR file is missing, or whose folder holds an ADR file the index does not list, leaves its steps' realization unknown and its result incomplete", () => {
  withTmp((dir) => {
    repo(dir);
    const payments = () => contextIn(dir, { kind: "category", id: "payments" });
    const errorsOf = (r) => r.errors.map((e) => [e.code, e.category, e.where]);
    const realization = (r) => r.steps.map((s) => [s.step.id, s.step.realizationUnknown]);
    // Capturing the payment happens outside the system, so it is never a realization target.
    const unknown = [
      ["payment.capture-payment", undefined],
      ["payment.request-payment", true],
    ];

    rmSync(path.join(dir, "docs/adr/payments/0001-pay.md"));
    const missing = payments();
    assert.equal(missing.complete, false);
    assert.deepEqual(errorsOf(missing), [
      ["ontology-adr-missing", "payments", "docs/adr/payments/0001-pay.md"],
    ]);
    assert.deepEqual(realization(missing), unknown);

    // With every listed file back, an unlisted file alone makes the records untrustworthy.
    writeAdrFiles(dir, MAPPING);
    write(
      dir,
      "docs/adr/payments/0002-refunds.md",
      "# ADR 0002: refunds\n\n## Status\n\nProposed\n",
    );
    const unindexed = payments();
    assert.equal(unindexed.complete, false);
    assert.deepEqual(errorsOf(unindexed), [
      ["ontology-adr-unindexed", "payments", "docs/adr/payments/0002-refunds.md"],
    ]);
    assert.deepEqual(realization(unindexed), unknown);

    // Records that name no file — not a list, or a record without a path — likewise.
    rmSync(path.join(dir, "docs/adr/payments/0002-refunds.md"));
    for (const adrs of [{}, [{ status: "Accepted (2020-01-01)", summary: "s" }]]) {
      const mapping = structuredClone(MAPPING);
      mapping.categories.payments.adrs = adrs;
      write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
      const invalid = payments();
      assert.equal(invalid.complete, false);
      assert.ok(
        invalid.errors.some(
          (e) => e.code === "ontology-adr-record-invalid" && e.category === "payments",
        ),
        JSON.stringify(invalid.errors),
      );
      assert.deepEqual(realization(invalid), unknown);
    }
  });
});
