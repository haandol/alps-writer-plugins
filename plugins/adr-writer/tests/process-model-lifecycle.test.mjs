// Process lifecycle, change impact and alignment-review plan: Status values
// and transitions, which processes a
// semantic change makes Proposed, the approval summary's data, the one-change-
// unit apply, and the mechanical gates of the alignment review.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  MODEL,
  businessComposition,
  classifyProcessStatus,
  indexGraph,
  lifecycleFindings,
  majorChangeCandidates,
  parseTurtle,
  processesToPropose,
  sameMeaningKeys,
  validateModel,
} from "../scripts/process-model-lib.mjs";
import { alignmentPlan, impactSummary } from "../scripts/process-model-align.mjs";
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

const index = (text) => indexGraph(parseTurtle(text).triples);
const errors = (r) => r.findings.filter((f) => f.level === "error");

test("process Status values follow the lifecycle set and a Superseded process names its replacement", () => {
  for (const ok of ["Proposed", "Accepted (2020-01-30)", "Deprecated (2024-02-29)", "Superseded"])
    assert.equal(classifyProcessStatus(ok).ok, true, ok);
  for (const bad of [
    "Accepted",
    "Accepted (2026-02-30)",
    "accepted (2020-01-30)",
    "Done",
    "Superseded by x",
    "Proposed (2020-01-30)",
  ])
    assert.equal(classifyProcessStatus(bad).ok, false, bad);
  const status = (value, extra = "") =>
    validateModel([
      {
        doc: "d.ttl",
        text: EXAMPLE.replace(
          'pm:status "Proposed" ;\n    pm:hasStep m:payment',
          `pm:status "${value}" ;${extra}\n    pm:hasStep m:payment`,
        ),
      },
    ]);
  assert.ok(errors(status("Done")).some((f) => f.code === "process-status"));
  assert.ok(
    errors(status("Superseded")).some((f) => /names exactly one other process/.test(f.msg)),
  );
  assert.equal(status("Superseded", "\n    pm:replacedBy m:ordering.place-order ;").ok, true);
  assert.ok(
    errors(status("Superseded", "\n    pm:replacedBy m:payment.take-payment ;")).some((f) =>
      /exactly one other/.test(f.msg),
    ),
    "a process cannot replace itself",
  );
  assert.ok(
    errors(status("Superseded", "\n    pm:replacedBy m:customer ;")).some(
      (f) => f.code === "process-attribute-value",
    ),
  );
  assert.ok(
    errors(status("Accepted (2020-01-30)", "\n    pm:replacedBy m:ordering.place-order ;")).some(
      (f) => /only a Superseded process/.test(f.msg),
    ),
  );
});

test("only lifecycle transitions ADR Writer performs are explained; retired states are final", () => {
  const before = index(ACCEPTED);
  const after = (from, to) => index(ACCEPTED.replace(from, to));
  const codes = (findings) => findings.map((f) => `${f.code}:${f.element}`);
  const payment = 'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment';

  assert.deepEqual(lifecycleFindings(before, before), []);
  // Accepted → Proposed needs a composition change.
  assert.deepEqual(
    codes(
      lifecycleFindings(before, after(payment, 'pm:status "Proposed" ;\n    pm:hasStep m:payment')),
    ),
    ["process-lifecycle:payment.take-payment"],
  );
  const changed = ACCEPTED.replace(
    payment,
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
  ).replace(
    '"The customer authorizes the card charge for the order."',
    '"The customer approves the card charge."',
  );
  assert.deepEqual(lifecycleFindings(before, index(changed)), []);
  // Re-dating Accepted without passing through Proposed.
  assert.match(
    lifecycleFindings(
      before,
      after(payment, 'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:payment'),
    )[0].msg,
    /re-dated/,
  );
  // A renewal only moves the date later: an earlier one is an edit by hand, even
  // beside a composition change whose gates hold.
  const later = index(
    ACCEPTED.replace(payment, 'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:payment'),
  );
  const earlier = index(
    ACCEPTED.replace(
      payment,
      'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
    ).replace(
      '"The customer authorizes the card charge for the order."',
      '"The customer approves the card charge."',
    ),
  );
  assert.deepEqual(
    lifecycleFindings(later, earlier, { promotion: () => "holds" }).map((f) => [f.level, f.msg]),
    [
      [
        "error",
        "Accepted was re-dated from 2020-01-30 to the earlier 2020-01-15; a renewal only records a later confirmation",
      ],
    ],
  );
  // Retirement needs its change-log line.
  const deprecated = after(
    payment,
    'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
  );
  assert.match(lifecycleFindings(before, deprecated)[0].msg, /change-log line/);
  // With its line it is the warning an unapproved-looking retirement gets, never an error.
  assert.deepEqual(
    lifecycleFindings(before, deprecated, {
      changeLogAdded: "- 2020-01-30 — `payment.take-payment` deprecated: replaced by invoicing",
    }).map((f) => [f.level, f.code, f.element]),
    [["warn", "process-lifecycle-needs-approval", "payment.take-payment"]],
  );
  // Final states never change; new processes start as Proposed.
  const retired = index(
    ACCEPTED.replace(payment, 'pm:status "Deprecated (2020-01-01)" ;\n    pm:hasStep m:payment'),
  );
  assert.match(
    lifecycleFindings(retired, before).find((f) => f.element === "payment.take-payment").msg,
    /is final/,
  );
  const fresh = (status) =>
    `${EXAMPLE}\nm:returns a pm:Process ; rdfs:label "Returns" ; pm:definition "d" ; pm:startCondition "s" ; pm:businessOutcome "o" ; pm:openScope "none"^^pm:NoOpenScope ; pm:status "${status}" .\n`;
  assert.deepEqual(lifecycleFindings(index(EXAMPLE), index(fresh("Proposed"))), []);
  assert.match(
    lifecycleFindings(index(EXAMPLE), index(fresh("Accepted (2020-01-30)")))[0].msg,
    /starts as Proposed/,
  );
  // Proposed → Accepted is flagged for the alignment review to confirm.
  const accepted = lifecycleFindings(
    index(EXAMPLE),
    index(
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
    ),
  );
  assert.deepEqual(
    accepted.map((f) => [f.level, f.code]),
    [["warn", "process-lifecycle-needs-alignment"]],
  );
  assert.match(
    lifecycleFindings(
      index(EXAMPLE),
      index(
        EXAMPLE.replace(
          'pm:status "Proposed" ;\n    pm:hasStep m:payment',
          'pm:status "Superseded" ;\n    pm:hasStep m:payment',
        ),
      ),
    )[0].msg,
    /Proposed → Superseded is not an allowed transition/,
  );
});

test("a semantic change makes only processes whose business composition changed Proposed", () => {
  const base = index(ACCEPTED);
  const propose = (from, to) => processesToPropose(base, index(ACCEPTED.replace(from, to)));
  // The shared event's meaning: both the emitting and the reacting processes.
  assert.deepEqual(
    propose(
      '"The money for an order was collected."',
      '"The money for an order was collected and settled."',
    ),
    ["ordering.place-order", "payment.take-payment"],
  );
  // A process outcome: that process only.
  assert.deepEqual(
    propose(
      '"The order has a completed payment."',
      '"The order has a completed and receipted payment."',
    ),
    ["payment.take-payment"],
  );
  // Open scope, descriptions and formatting: nothing.
  assert.deepEqual(
    propose(
      '"Retrying after the payment provider declines a card."',
      '"Retrying a declined card."',
    ),
    [],
  );
  assert.deepEqual(
    propose('pm:summary "From payment request to payment completion."', 'pm:summary "Payment."'),
    [],
  );
  // A new reaction in another process leaves the emitting process unchanged.
  const reaction = `${ACCEPTED}\nm:audit a pm:Process ; rdfs:label "Audit" ; pm:definition "d" ; pm:startCondition "s" ; pm:businessOutcome "o" ; pm:openScope "none"^^pm:NoOpenScope ; pm:status "Proposed" ; pm:hasStep m:audit.record .
m:audit.record a pm:Step ; rdfs:label "Record" ; pm:definition "d" ; pm:stepKind "system" ; pm:inContext m:payment .
m:audit.on-payment a pm:Policy ; rdfs:label "On payment" ; pm:definition "d" ; pm:reactionCondition "c" ; pm:basisKind "regulation" ; pm:basis "b" ; pm:inContext m:payment ; pm:starts m:audit.record .
m:payment.payment-completed pm:triggers m:audit.on-payment .\n`;
  assert.deepEqual(processesToPropose(base, index(reaction)), ["audit"]);
  // Retired processes never change Status.
  const retired = ACCEPTED.replace(
    '"Accepted (2020-01-01)" ;\n    pm:hasStep m:payment',
    '"Deprecated (2020-01-01)" ;\n    pm:hasStep m:payment',
  );
  assert.deepEqual(
    processesToPropose(
      index(retired),
      index(retired.replace('"The order has a completed payment."', '"x"')),
    ),
    [],
  );
});

test("change-log candidates are the major change kinds; wording of names is not one", () => {
  const before = parseTurtle(EXAMPLE).triples;
  const candidates = (text) =>
    majorChangeCandidates(before, parseTurtle(text).triples).map((c) => `${c.id}:${c.change}`);
  assert.deepEqual(
    candidates(EXAMPLE.replace('rdfs:label "Customer"', 'rdfs:label "Shopper"')),
    [],
  );
  assert.deepEqual(
    candidates(EXAMPLE.replace('"The order has no payment yet."', '"The order is unpaid."')),
    ["payment.request-on-order:changed"],
  );
  assert.deepEqual(candidates(`${EXAMPLE}\nm:customer pm:performs m:ordering.confirm-order .\n`), [
    "customer:changed",
  ]);
  assert.deepEqual(
    candidates(
      EXAMPLE.replace(
        'pm:definition "A customer submitted an order."',
        'pm:definition "A customer submitted and confirmed an order."',
      ),
    ),
    ["ordering.order-placed:changed"],
  );
});

const MAPPING = {
  categories: {
    checkout: {
      adrs: [
        { path: "docs/adr/checkout/0001-a.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["ordering.submit-order", "ordering.confirm-order"],
    },
    payments: {
      adrs: [
        { path: "docs/adr/payments/0001-b.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["payment.request-payment"],
    },
  },
};

test("the impact summary lists processes, features, link changes, unrealized steps and glossary cleanup", () => {
  const draft = EXAMPLE.replace(/m:ordering\.confirm-order a pm:Step[\s\S]*?\n\n/, "")
    .replace(
      "pm:hasStep m:ordering.confirm-order, m:ordering.submit-order",
      "pm:hasStep m:ordering.submit-order",
    )
    .replace("    pm:flowsTo m:ordering.confirm-order ;\n", "")
    .replace(
      "    pm:starts m:ordering.confirm-order ;\n",
      "    pm:starts m:ordering.submit-order ;\n",
    )
    .replace("    pm:performs m:ordering.confirm-order .", '    rdfs:comment "no step" .');
  const v = validateModel([{ doc: "d.ttl", text: draft }]);
  assert.deepEqual(errors(v), []);
  const s = impactSummary({
    before: index(EXAMPLE),
    after: v.index,
    mapping: MAPPING,
    glossary: "| Term | Meaning |\n| --- | --- |\n| Order | a request |\n",
  });
  assert.deepEqual(s.processesToPropose, ["ordering.place-order"]);
  assert.deepEqual(s.linkChanges, [
    { category: "checkout", step: "ordering.confirm-order", reason: "removed" },
  ]);
  assert.deepEqual(s.affectedAdrs, ["docs/adr/checkout/0001-a.md"]);
  assert.deepEqual(s.directlyAffectedCategories, ["checkout"]);
  assert.deepEqual(s.unrealizedSystemSteps, []);
  assert.deepEqual(
    s.glossaryCleanup.map((g) => g.term),
    ["Order"],
  );
  assert.ok(
    s.majorChangeCandidates.some(
      (c) => c.id === "ordering.confirm-order" && c.change === "removed",
    ),
  );
  const unrealized = impactSummary({
    before: index(EXAMPLE),
    after: index(
      EXAMPLE.replace(
        '"The customer sends the cart as an order."',
        '"The customer sends the whole cart."',
      ),
    ),
    mapping: { categories: {} },
    glossary: null,
  });
  assert.deepEqual(unrealized.unrealizedSystemSteps, [
    "ordering.confirm-order",
    "ordering.submit-order",
  ]);
});

test("the alignment plan gates realization and ADR Status and places compliance contracts", () => {
  const plan = alignmentPlan({
    index: index(EXAMPLE),
    mapping: MAPPING,
    processId: "payment.take-payment",
  });
  assert.deepEqual(
    plan.realization.unrealizedSystemSteps,
    [],
    "capture-payment is outside the system",
  );
  assert.deepEqual(plan.blocking, []);
  const handoff = plan.compliance.find(
    (c) => c.kind === "hand-off" && c.event === "payment.payment-completed",
  );
  assert.deepEqual(
    [handoff.from.step, handoff.to.step, handoff.categories],
    ["payment.capture-payment", "ordering.confirm-order", ["checkout"]],
  );
  assert.ok(
    plan.compliance.some(
      (c) =>
        c.kind === "policy" &&
        c.policy === "payment.request-on-order" &&
        c.categories.join() === "payments",
    ),
  );
  assert.deepEqual(plan.compliance.find((c) => c.kind === "rule").categories, [
    "checkout",
    "payments",
  ]);

  const proposedAdr = structuredClone(MAPPING);
  proposedAdr.categories.payments.adrs.push({
    path: "docs/adr/payments/0002-c.md",
    status: "Proposed",
    summary: "s",
  });
  assert.match(
    alignmentPlan({
      index: index(EXAMPLE),
      mapping: proposedAdr,
      processId: "payment.take-payment",
    }).blocking[0],
    /payments.*Proposed 1/,
  );
  const retiredOnly = {
    categories: {
      ...MAPPING.categories,
      payments: {
        adrs: [{ path: "x.md", status: "Deprecated (2020-01-01)" }],
        realizes: ["payment.request-payment"],
      },
    },
  };
  assert.match(
    alignmentPlan({
      index: index(EXAMPLE),
      mapping: retiredOnly,
      processId: "payment.take-payment",
    }).blocking[0],
    /Accepted 0/,
  );
  const unlinked = { categories: { checkout: MAPPING.categories.checkout } };
  assert.match(
    alignmentPlan({ index: index(EXAMPLE), mapping: unlinked, processId: "payment.take-payment" })
      .blocking[0],
    /request-payment" has no realizing feature/,
  );
});

test("criteria run their system steps; cross-process steps run only when current or verified together", () => {
  const plan = (text, together) =>
    alignmentPlan({
      index: index(text),
      mapping: MAPPING,
      processId: "ordering.place-order",
      together,
    });
  const proposed = plan(EXAMPLE).criteria[0];
  assert.deepEqual(
    proposed.processSystemSteps.map((s) => s.step),
    ["ordering.confirm-order", "ordering.submit-order"],
  );
  assert.deepEqual(
    proposed.run,
    [],
    "the payment process is still a target, so its steps are deferred",
  );
  assert.deepEqual(
    proposed.deferred.map((s) => s.step),
    ["payment.capture-payment", "payment.request-payment"],
  );
  assert.deepEqual(
    proposed.outsideSystem.map((s) => s.step),
    ["payment.capture-payment"],
    "outside-system results are given as inputs",
  );
  assert.deepEqual(
    plan(EXAMPLE, ["payment.take-payment"]).criteria[0].run.map((s) => s.step),
    ["payment.request-payment"],
  );
  const current = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment',
  );
  const handoffs = plan(current).handoffs;
  assert.deepEqual(
    handoffs.map((h) => [h.event, h.counterpart, h.execute]),
    [
      ["ordering.order-placed", "payment.take-payment", true],
      ["payment.payment-completed", "payment.take-payment", true],
    ],
  );
  assert.deepEqual(
    plan(EXAMPLE).handoffs.map((h) => h.execute),
    [false, false],
    "deferred until the counterpart is verified",
  );

  // A cross-process hand-off without a criterion passing through its event blocks the review.
  const uncovered = EXAMPLE.replace(
    "pm:passesThrough m:ordering.order-confirmed, m:ordering.order-placed, m:payment.payment-completed",
    "pm:passesThrough m:ordering.order-confirmed",
  ).replace("    pm:passesThrough m:payment.payment-completed .", '    rdfs:comment "no events" .');
  assert.ok(
    plan(uncovered).blocking.some((b) =>
      /hand-off of "ordering.order-placed".*no observation criterion/.test(b),
    ),
  );
});

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

test("a removed process and any change of a retired process are lifecycle errors", () => {
  const before = index(ACCEPTED);
  const without = ACCEPTED.replace(/m:payment\.take-payment a pm:Process ;[\s\S]*?\n\n/, "");
  assert.ok(
    lifecycleFindings(before, index(without)).some(
      (f) => f.element === "payment.take-payment" && /was removed/.test(f.msg),
    ),
  );
  const payment = 'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment';
  const deprecated = (date) =>
    index(
      ACCEPTED.replace(payment, `pm:status "Deprecated (${date})" ;\n    pm:hasStep m:payment`),
    );
  assert.match(
    lifecycleFindings(deprecated("2020-01-01"), deprecated("2020-01-30"))[0].msg,
    /Deprecated is final/,
  );
});

test("Accepted → Proposed is judged against the composition where Accepted appeared", () => {
  const accepted = index(ACCEPTED);
  const edited = ACCEPTED.replace(
    '"The customer authorizes the card charge for the order."',
    '"The customer approves the card charge."',
  );
  const proposed = index(
    edited.replace(
      'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment',
      'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    ),
  );
  const iri = `${MODEL}payment.take-payment`;
  // A committed direct edit, then the transition: against the edited base alone it looks unexplained.
  assert.equal(lifecycleFindings(index(edited), proposed).length, 1);
  assert.deepEqual(
    lifecycleFindings(index(edited), proposed, {
      acceptedBaseline: new Map([[iri, { composition: businessComposition(accepted, iri) }]]),
    }),
    [],
  );
});

test("confirmed same-meaning wording moves no Status, affects no feature and is no log candidate", () => {
  const before = index(ACCEPTED);
  const after = index(
    ACCEPTED.replace('rdfs:label "Submit the order"', 'rdfs:label "Submit an order"'),
  );
  const { keys } = sameMeaningKeys(["ordering.submit-order=rdfs:label"], before, after);
  assert.deepEqual(
    processesToPropose(before, after),
    ["ordering.place-order"],
    "unconfirmed: a change",
  );
  assert.deepEqual(processesToPropose(before, after, { sameMeaning: keys }), []);
  const s = impactSummary({ before, after, mapping: MAPPING, glossary: null, sameMeaning: keys });
  assert.deepEqual(
    [s.processesToPropose, s.directlyAffectedCategories, s.affectedAdrs],
    [[], [], []],
  );
  assert.equal(s.diff[0].properties[0].sameMeaning, true, "the confirmed change stays visible");
  const definition = index(
    ACCEPTED.replace('"The order has no payment yet."', '"The order is unpaid."'),
  );
  const confirmed = sameMeaningKeys(
    ["payment.request-on-order=pm:reactionCondition"],
    before,
    definition,
  ).keys;
  assert.deepEqual(
    majorChangeCandidates(before.triples, definition.triples, { sameMeaning: confirmed }),
    [],
  );
});

test("description edits touch no feature; a retirement lists the links it leaves", () => {
  const before = index(ACCEPTED);
  const described = impactSummary({
    before,
    after: index(
      ACCEPTED.replace(
        'pm:summary "From payment request to payment completion."',
        'pm:summary "Payment."',
      ),
    ),
    mapping: MAPPING,
    glossary: null,
  });
  assert.equal(described.same, false);
  assert.deepEqual([described.directlyAffectedCategories, described.processesToPropose], [[], []]);
  const retired = impactSummary({
    before,
    after: index(
      ACCEPTED.replace(
        'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment',
        'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
    ),
    mapping: MAPPING,
    glossary: null,
  });
  assert.deepEqual(retired.linkChanges, [
    { category: "payments", step: "payment.request-payment", reason: "retired" },
  ]);
  assert.deepEqual(retired.directlyAffectedCategories, ["payments"]);
  assert.deepEqual(retired.affectedAdrs, ["docs/adr/payments/0001-b.md"]);
});

test("a scoped summary keeps only that process's composition and open scope", () => {
  const before = index(ACCEPTED);
  const after = index(
    ACCEPTED.replace(
      '"The order has a completed payment."',
      '"The order has a receipted payment."',
    ).replace(
      'pm:definition "The customer sends the cart as an order."',
      'pm:definition "The customer sends the whole cart."',
    ),
  );
  const whole = impactSummary({ before, after, mapping: MAPPING, glossary: null });
  assert.deepEqual(whole.processesToPropose, ["ordering.place-order", "payment.take-payment"]);
  const scoped = impactSummary({
    before,
    after,
    mapping: MAPPING,
    glossary: null,
    scope: "payment.take-payment",
  });
  assert.deepEqual(scoped.processesToPropose, ["payment.take-payment"]);
  assert.deepEqual(
    scoped.diff.map((e) => e.id),
    ["payment.take-payment"],
  );
  assert.equal(scoped.scope, "payment.take-payment");
});

test("alignment gates fail closed on invalid inputs and on criteria that execute nothing", () => {
  const plan = (text, mapping = MAPPING, errors = []) =>
    alignmentPlan({ index: index(text), mapping, processId: "payment.take-payment", errors });
  assert.match(
    plan(EXAMPLE, MAPPING, [{ code: "process-attribute-enum", where: "d.ttl:9" }]).blocking[0],
    /1 validation error/,
  );
  const malformed = structuredClone(MAPPING);
  malformed.categories.payments.adrs.push({
    path: "docs/adr/payments/0002-c.md",
    status: "proposed",
  });
  assert.ok(
    plan(EXAMPLE, malformed).blocking.some((b) =>
      /payments" has 1 ADR record\(s\) whose Status is invalid/.test(b),
    ),
  );
  // A process whose steps are all outside the system executes no realizing feature.
  const outside = EXAMPLE.replace(
    /(m:payment\.request-payment a pm:Step ;[\s\S]*?pm:stepKind )"system"/,
    '$1"outside-system"',
  );
  const p = plan(outside, { categories: {} });
  assert.ok(
    p.blocking.some((b) => /executes no system step/.test(b)),
    p.blocking.join("\n"),
  );
  assert.equal(p.criteria[0].executesNoSystemStep, true);
});

test("a Superseded process must name an existing process as its replacement", () => {
  const superseded = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Superseded" ;\n    pm:replacedBy m:ghost ;\n    pm:hasStep m:payment',
  );
  const result = validateModel([{ doc: "d.ttl", text: superseded }]);
  assert.ok(
    errors(result).some((f) => f.code === "process-attribute-value"),
    JSON.stringify(errors(result)),
  );
});

test("the alignment plan's hand-offs are event and policy hand-offs, never the flow inside a process", () => {
  const plan = alignmentPlan({
    index: index(EXAMPLE),
    mapping: MAPPING,
    processId: "ordering.place-order",
  });
  const handoffs = plan.compliance.filter((c) => c.kind === "hand-off");
  assert.ok(handoffs.length > 0);
  assert.ok(
    handoffs.every((h) => h.event && h.policy),
    JSON.stringify(handoffs),
  );
  assert.ok(
    !handoffs.some(
      (h) => h.from.step === "ordering.submit-order" && h.to.step === "ordering.confirm-order",
    ),
    "submit → confirm is a flow, not a hand-off",
  );
});

test("change-log lines are newest first across saves", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    write(dir, "docs/process/model.ttl", EXAMPLE);
    commitAll(dir);
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

test("a same-meaning confirmation never covers a changed closed value such as the step kind", () => {
  const before = index(ACCEPTED);
  const after = index(
    ACCEPTED.replace(
      /(m:payment\.request-payment a pm:Step ;[\s\S]*?pm:stepKind )"system"/,
      '$1"outside-system"',
    ),
  );
  assert.equal(
    sameMeaningKeys(["payment.request-payment=pm:stepKind"], before, after).errors.length,
    1,
  );
});

test("an ADR record whose Status has stray spaces still counts as that Status in the alignment gates", () => {
  const spaced = structuredClone(MAPPING);
  spaced.categories.payments.adrs.push({
    path: "docs/adr/payments/0002-c.md",
    status: "Proposed ",
  });
  assert.ok(
    alignmentPlan({
      index: index(EXAMPLE),
      mapping: spaced,
      processId: "payment.take-payment",
    }).blocking.some((b) =>
      /payments" needs at least one Accepted ADR and no Proposed ADR \(Accepted 1, Proposed 1\)/.test(
        b,
      ),
    ),
  );
});
