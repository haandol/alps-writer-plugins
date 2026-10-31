// Deterministic business-context queries: only the
// connected elements, with process and ADR Status, errors and change flags.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { MODEL, PM, RDFS, checkRealizes, validateModel } from "../scripts/process-model-lib.mjs";
import { changeFlags, processLevelFindings } from "../scripts/process-model-fs.mjs";
import { queryContext, renderContext } from "../scripts/process-model-query.mjs";
import { cachedRepo, commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import { EXAMPLE, cli } from "./process-model-helpers.mjs";

const HEAD = `@prefix m: <${MODEL}> .\n@prefix pm: <${PM}> .\n@prefix rdfs: <${RDFS}> .\n\n`;

/** A third process that reacts to "payment completed" and shares the Order concept. */
const SHIPPING = `${HEAD}m:shipping a pm:BoundedContext ; rdfs:label "Shipping" ; pm:definition "Getting paid orders to customers." .
m:warehouse a pm:Actor ; rdfs:label "Warehouse" ; pm:definition "Staff who pack orders." .
m:shipping.ship-order a pm:Process ; rdfs:label "Ship an order" ; pm:definition "A paid order is packed and sent." ;
  pm:startCondition "A payment completes." ; pm:businessOutcome "The parcel leaves the warehouse." ;
  pm:openScope "none"^^pm:NoOpenScope ; pm:status "Accepted (2020-01-01)" ; pm:hasStep m:shipping.pack-order .
m:shipping.pack-order a pm:Step ; rdfs:label "Pack the order" ; pm:definition "The warehouse packs the order lines." ;
  pm:stepKind "system" ; pm:inContext m:shipping ; pm:uses m:ordering.order .
m:warehouse pm:performs m:shipping.pack-order .
m:shipping.pack-when-paid a pm:Policy ; rdfs:label "Pack when paid" ; pm:definition "Paid orders go to packing." ;
  pm:reactionCondition "The order is paid." ; pm:basisKind "operating-policy" ; pm:basis "Fulfilment policy." ;
  pm:inContext m:shipping ; pm:starts m:shipping.pack-order .
m:payment.payment-completed pm:triggers m:shipping.pack-when-paid .
m:shipping.ship-order.sent a pm:ObservationCriterion ; rdfs:label "Paid orders leave" ; pm:startCondition "A payment completes." ;
  pm:observedResult "The parcel is sent." ; pm:criterionOf m:shipping.ship-order ; pm:passesThrough m:payment.payment-completed .
`;

const MAPPING = {
  categories: {
    ordering: {
      adrs: [{ path: "docs/adr/ordering/0001-confirm.md", status: "Proposed", summary: "s" }],
      realizes: ["ordering.confirm-order", "ordering.submit-order"],
    },
    payments: {
      adrs: [
        { path: "docs/adr/payments/0001-pay.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["payment.capture-payment", "payment.request-payment"],
    },
    fulfilment: {
      adrs: [
        { path: "docs/adr/fulfilment/0001-pack.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["shipping.pack-order"],
    },
    reports: { adrs: [], realizes: [] },
    admin: { adrs: [] },
  },
};

/** A rule on two reacting policies, neither of which starts an ordering step. */
const FAR_RULE = `${HEAD}m:far-rule a pm:BusinessRule ; rdfs:label "Far rule" ; pm:definition "d" ; pm:basisKind "user-decision" ; pm:basis "b" ; pm:constrains m:shipping.pack-when-paid, m:payment.request-on-order .\n`;

function run(
  target,
  {
    texts = [EXAMPLE, SHIPPING],
    mapping = MAPPING,
    includeRetired = false,
    changes = null,
    links = false,
    extra = [],
  } = {},
) {
  const v = validateModel(
    texts.map((text, i) => ({ doc: `docs/process/d${i}.ttl`, text })),
    { categoryKeys: Object.keys(mapping.categories) },
  );
  return queryContext({
    index: v.index,
    mapping,
    // `links` adds the ADR index link findings, as the CLI reads them; `extra` adds others.
    findings: [...v.findings, ...(links ? checkRealizes(mapping, v.index) : []), ...extra],
    changes,
    target,
    includeRetired,
  });
}
const ids = (refs) => refs.map((r) => r.id);
const stepOf = (result, id) => result.steps.find((s) => s.step.id === id);

test("a feature query returns its steps, neighbours and realizing features", () => {
  const r = run({ kind: "category", id: "ordering" });
  assert.equal(r.found, true);
  assert.equal(r.complete, true);
  assert.deepEqual(ids(r.steps.map((s) => s.step)), [
    "ordering.confirm-order",
    "ordering.submit-order",
  ]);
  const submit = stepOf(r, "ordering.submit-order");
  assert.deepEqual(ids(submit.next), ["ordering.confirm-order"]);
  assert.deepEqual(ids(stepOf(r, "ordering.confirm-order").previous), ["ordering.submit-order"]);
  assert.deepEqual(submit.step.process, {
    id: "ordering.place-order",
    label: "Place an order",
    status: "Proposed",
  });
  assert.deepEqual(submit.step.realizedBy, [
    {
      category: "ordering",
      adrs: [{ path: "docs/adr/ordering/0001-confirm.md", status: "Proposed" }],
    },
  ]);
});

test("upstream policies and the steps that emit their events come with their features", () => {
  const confirm = stepOf(run({ kind: "category", id: "ordering" }), "ordering.confirm-order");
  assert.equal(confirm.startedBy[0].policy.id, "ordering.confirm-on-payment");
  const event = confirm.startedBy[0].events[0];
  assert.equal(event.id, "payment.payment-completed");
  assert.deepEqual(ids(event.emittedBy), ["payment.capture-payment"]);
  assert.equal(event.emittedBy[0].realizedBy[0].category, "payments");
  assert.equal(event.emittedBy[0].realizedBy[0].adrs[0].status, "Accepted (2020-01-01)");
});

test("downstream reactions include steps of other processes", () => {
  const capture = stepOf(run({ kind: "category", id: "payments" }), "payment.capture-payment");
  const reactions = capture.emits.find((e) => e.id === "payment.payment-completed").reactions;
  assert.deepEqual(
    reactions.map((x) => x.policy.id),
    ["ordering.confirm-on-payment", "shipping.pack-when-paid"],
  );
  const pack = reactions[1].starts[0];
  assert.equal(pack.id, "shipping.pack-order");
  assert.deepEqual(pack.process, {
    id: "shipping.ship-order",
    label: "Ship an order",
    status: "Accepted (2020-01-01)",
  });
  assert.equal(pack.realizedBy[0].category, "fulfilment");
});

test("shared concepts reach every step using them and the steps their policies start", () => {
  const submit = stepOf(run({ kind: "category", id: "ordering" }), "ordering.submit-order");
  const order = submit.concepts.find((c) => c.id === "ordering.order");
  assert.deepEqual(ids(order.usedBySteps), ["ordering.confirm-order", "shipping.pack-order"]);
  assert.deepEqual(
    order.usedByPolicies.map((p) => [p.policy.id, ids(p.starts)]),
    [["ordering.confirm-on-payment", ["ordering.confirm-order"]]],
  );
});

test("applicable rules come with their basis and the open scope is returned", () => {
  const submit = stepOf(run({ kind: "category", id: "ordering" }), "ordering.submit-order");
  assert.deepEqual(
    submit.rules.map((r) => [r.id, r.basisKind, r.basis, r.via]),
    [
      [
        "payment.amount-matches-order",
        "operating-policy",
        "Store accounting policy.",
        ["concept ordering.order"],
      ],
    ],
  );
  assert.deepEqual(submit.openScope.process, [
    { kind: "open-path", text: "Handling an order whose payment fails." },
  ]);
  const ruleOnProcess = `${HEAD}m:one-cart a pm:BusinessRule ; rdfs:label "One cart" ; pm:definition "An order comes from one cart." ; pm:basisKind "user-decision" ; pm:basis "Product decision." ; pm:constrains m:ordering.place-order .\n`;
  const viaProcess = stepOf(
    run({ kind: "category", id: "ordering" }, { texts: [EXAMPLE, SHIPPING, ruleOnProcess] }),
    "ordering.submit-order",
  );
  assert.deepEqual(
    viaProcess.rules.map((r) => [r.id, r.via]),
    [
      ["one-cart", ["process"]],
      ["payment.amount-matches-order", ["concept ordering.order"]],
    ],
  );
});

test("process, concept and event inputs return their defined connections", () => {
  const p = run({ kind: "process", id: "ordering.place-order" });
  assert.deepEqual(ids(p.steps.map((s) => s.step)), [
    "ordering.confirm-order",
    "ordering.submit-order",
  ]);
  assert.deepEqual(
    stepOf(p, "ordering.submit-order").performers.map((a) => a.id),
    ["customer"],
  );
  assert.equal(stepOf(p, "ordering.submit-order").context.id, "ordering");
  assert.deepEqual(ids(p.criteria), ["ordering.place-order.confirmed"]);
  assert.ok(
    stepOf(p, "ordering.submit-order").emits[0].reactions.some(
      (x) => x.policy.id === "payment.request-on-order",
    ),
    "the other process that starts from this one",
  );

  const c = run({ kind: "concept", id: "ordering.order" });
  assert.equal(c.concept.context.id, "ordering");
  assert.deepEqual(ids(c.related.hasPart), ["ordering.order-line"]);
  assert.deepEqual(ids(c.related.refersTo), ["ordering.buyer"]);
  assert.deepEqual(ids(c.usedBySteps), [
    "ordering.confirm-order",
    "ordering.submit-order",
    "shipping.pack-order",
  ]);
  assert.deepEqual(
    c.usedByPolicies.map((x) => ids(x.starts)),
    [["ordering.confirm-order"]],
  );
  assert.deepEqual(ids(c.rules), ["payment.amount-matches-order"]);
  assert.deepEqual(ids(run({ kind: "concept", id: "ordering.buyer" }).related.correspondsTo), [
    "payment.payer",
  ]);

  const e = run({ kind: "event", id: "payment.payment-completed" });
  assert.deepEqual(ids(e.emittedBy), ["payment.capture-payment"]);
  assert.deepEqual(
    e.reactions.map((x) => ids(x.starts)),
    [["ordering.confirm-order"], ["shipping.pack-order"]],
  );
  assert.deepEqual(ids(e.criteria), [
    "ordering.place-order.confirmed",
    "payment.take-payment.completed",
    "shipping.ship-order.sent",
  ]);
});

test("results contain only connected elements and are deterministic", () => {
  const r = run({ kind: "category", id: "fulfilment" });
  const text = JSON.stringify(r);
  assert.doesNotMatch(
    text,
    /payment\.request-payment|request-on-order|"customer"/,
    "unconnected steps, policies and actors stay out",
  );
  assert.match(text, /ordering\.submit-order/, "a step sharing the Order concept is connected");
  assert.match(text, /ordering\.order/);
  assert.equal(JSON.stringify(run({ kind: "category", id: "fulfilment" })), text);
  assert.equal(renderContext(r), renderContext(run({ kind: "category", id: "fulfilment" })));
});

test("retired processes appear only on request, marked retired", () => {
  const retired = SHIPPING.replace(
    'pm:status "Accepted (2020-01-01)"',
    'pm:status "Deprecated (2020-01-20)"',
  );
  const capture = (opts) =>
    stepOf(
      run({ kind: "category", id: "payments" }, { texts: [EXAMPLE, retired], ...opts }),
      "payment.capture-payment",
    );
  const reacting = (c) => c.emits[0].reactions.flatMap((x) => ids(x.starts));
  assert.deepEqual(reacting(capture()), ["ordering.confirm-order"]);
  const withRetired = capture({ includeRetired: true });
  assert.deepEqual(reacting(withRetired), ["ordering.confirm-order", "shipping.pack-order"]);
  assert.equal(withRetired.emits[0].reactions[1].starts[0].process.retired, true);
  assert.equal(
    run({ kind: "process", id: "shipping.ship-order" }, { texts: [EXAMPLE, retired] }).found,
    false,
  );
  assert.match(
    run({ kind: "category", id: "fulfilment" }, { texts: [EXAMPLE, retired] }).retiredLinks[0],
    /shipping\.pack-order/,
  );
});

test("a policy starting steps of a live and a retired process stays in the result; the retired step appears only on request, marked retired", () => {
  const retired = SHIPPING.replace(
    'pm:status "Accepted (2020-01-01)"',
    'pm:status "Deprecated (2020-01-20)"',
  );
  // The retired process's packing policy also starts confirming the order.
  const shared = `${HEAD}m:shipping.pack-when-paid pm:starts m:ordering.confirm-order .\n`;
  const reactions = (includeRetired) =>
    stepOf(
      run(
        { kind: "category", id: "payments" },
        { texts: [EXAMPLE, retired, shared], includeRetired },
      ),
      "payment.capture-payment",
    ).emits.find((e) => e.id === "payment.payment-completed").reactions;
  const starts = (list) => list.map((x) => [x.policy.id, ids(x.starts)]);
  assert.deepEqual(starts(reactions(false)), [
    ["ordering.confirm-on-payment", ["ordering.confirm-order"]],
    ["shipping.pack-when-paid", ["ordering.confirm-order"]],
  ]);
  const all = reactions(true);
  assert.deepEqual(starts(all), [
    ["ordering.confirm-on-payment", ["ordering.confirm-order"]],
    ["shipping.pack-when-paid", ["ordering.confirm-order", "shipping.pack-order"]],
  ]);
  assert.deepEqual(
    all[1].starts.map((s) => s.process.retired ?? false),
    [false, true],
  );
});

test("validation errors in scope make the result incomplete at their position; parse failures stop it", () => {
  const broken = `${HEAD}m:payment.capture-payment pm:emits m:ghost .\n`;
  const r = run({ kind: "category", id: "payments" }, { texts: [EXAMPLE, SHIPPING, broken] });
  assert.equal(r.complete, false);
  assert.ok(
    r.errors.some(
      (e) => e.code === "process-relation-dangling" && e.where === "docs/process/d2.ttl:5",
    ),
  );
  assert.equal(
    run({ kind: "category", id: "fulfilment" }, { texts: [EXAMPLE, SHIPPING, broken] }).complete,
    false,
    "the emitter upstream of packing is in scope",
  );
  assert.equal(
    run({ kind: "concept", id: "ordering.order-line" }, { texts: [EXAMPLE, SHIPPING, broken] })
      .complete,
    true,
    "an error outside the scope does not leak in",
  );
  const unparsable = queryContext({
    index: null,
    mapping: MAPPING,
    findings: [
      { level: "error", code: "process-parse", where: "docs/process/x.ttl:1:1", msg: "bad" },
    ],
    target: { kind: "category", id: "ordering" },
  });
  assert.equal(unparsable.complete, false);
  assert.equal(unparsable.found, null);
  assert.match(
    renderContext(unparsable),
    /INCOMPLETE[\s\S]*process-parse[\s\S]*cannot be determined/,
  );
});

test("missing targets and unlinked features are reported, not returned empty", () => {
  const missing = run({ kind: "category", id: "billing" });
  assert.equal(missing.found, false);
  assert.match(renderContext(missing), /NOT FOUND: no category "billing"/);
  assert.match(
    run({ kind: "event", id: "ordering.order" }).note,
    /is a BusinessConcept, not a BusinessEvent/,
  );
  const unlinked = run({ kind: "category", id: "admin" });
  assert.equal(unlinked.link, "none");
  assert.match(unlinked.note, /not evidence that no business rule applies/);
  const confirmed = run({ kind: "category", id: "reports" });
  assert.equal(confirmed.link, "confirmed-none");
  assert.match(confirmed.note, /do not ask the three-way judgment again/);
});

/** The same reading the CLI query does, in-process, for a repository directory. */
function contextIn(dir, target) {
  const rel = (p) => path.relative(dir, p).split(path.sep).join("/");
  const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
  const { findings, index } = processLevelFindings({
    processDir: path.join(dir, "docs/process"),
    adrRoot: path.join(dir, "docs/adr"),
    mapping,
    mappingPath: "docs/adr/.mapping.json",
    rel,
    cwd: dir,
  });
  return queryContext({
    index,
    mapping,
    findings,
    changes: changeFlags("docs/process", index, { cwd: dir }),
    target,
  });
}
const changesOf = (dir, id) => contextIn(dir, { kind: "category", id }).changes;

/** A repository whose Accepted shipping process was first saved Proposed, as ADR Writer saves it. */
function repo(dir) {
  cachedRepo(dir, "query: shipping accepted", (at) => {
    initRepo(at);
    write(at, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    writeAdrFiles(at, MAPPING);
    write(at, "docs/process/ordering.ttl", EXAMPLE);
    write(
      at,
      "docs/process/shipping.ttl",
      SHIPPING.replace('pm:status "Accepted (2020-01-01)"', 'pm:status "Proposed"'),
    );
    commitAll(at, "proposed");
    write(at, "docs/process/shipping.ttl", SHIPPING);
    commitAll(at, "accepted after the alignment review");
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
      "docs/process/ordering.ttl",
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
    repo(dir);
    // A committed direct edit of the Accepted shipping process's composition.
    write(
      dir,
      "docs/process/shipping.ttl",
      SHIPPING.replace(
        'pm:definition "The warehouse packs the order lines."',
        'pm:definition "The warehouse packs and labels the order lines."',
      ),
    );
    commitAll(dir, "direct edit");
    const r = contextIn(dir, { kind: "category", id: "fulfilment" });
    assert.deepEqual(r.changes.unsyncedAccepted, [
      {
        process: "shipping.ship-order",
        elements: ["shipping.pack-order"],
        changes: [{ id: "shipping.pack-order", change: "changed" }],
        compositionChanged: true,
      },
    ]);
    const viaConcept = contextIn(dir, { kind: "category", id: "ordering" });
    assert.deepEqual(
      viaConcept.changes.unsyncedAccepted.map((u) => u.process),
      ["shipping.ship-order"],
      "packing shares the Order concept",
    );
    const other = contextIn(dir, { kind: "category", id: "reports" });
    assert.equal(other.changes.unsyncedAcceptedElsewhere, true);

    // Description and lifecycle edits are not composition changes.
    write(
      dir,
      "docs/process/shipping.ttl",
      SHIPPING.replace(
        'pm:definition "The warehouse packs the order lines."',
        'pm:definition "The warehouse packs and labels the order lines."',
      ).replace("pm:status", 'pm:summary "Packing." ; pm:status'),
    );
    commitAll(dir, "summary only");
    assert.deepEqual(
      contextIn(dir, { kind: "category", id: "fulfilment" }).changes.unsyncedAccepted[0].elements,
      ["shipping.pack-order"],
    );

    // Accepting again with a new literal resets the baseline.
    write(
      dir,
      "docs/process/shipping.ttl",
      SHIPPING.replace(
        'pm:definition "The warehouse packs the order lines."',
        'pm:definition "The warehouse packs and labels the order lines."',
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
      "docs/process/ordering.ttl",
      EXAMPLE.replace(
        'pm:definition "The customer sends the cart as an order."',
        'pm:definition "The customer sends the whole cart as an order."',
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
      "docs/process/shipping.ttl",
      SHIPPING.replace(
        'pm:definition "The warehouse packs the order lines."',
        'pm:definition "The warehouse packs and labels the order lines."',
      )
        .replace('"Accepted (2020-01-01)"', '"Accepted (2020-01-30)"')
        .replace('"none"^^pm:NoOpenScope', '"Damaged parcels."^^pm:OpenPath'),
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
      /(m:payment\.take-payment a pm:Process ;[\s\S]*?pm:status )"Proposed"/,
      '$1"Accepted (2020-01-01)"',
    );
    write(dir, "docs/process/ordering.ttl", accepted);
    commitAll(dir, "payment accepted after the alignment review");
    write(
      dir,
      "docs/process/ordering.ttl",
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
      /no process model in docs\/process; the business process level does not apply/,
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

test("an error on an element connected to the scope makes it incomplete, even when the type filter dropped it", () => {
  const extra = (statement) =>
    run(
      { kind: "category", id: "ordering" },
      { texts: [EXAMPLE, SHIPPING, `${HEAD}${statement}\n`] },
    );
  for (const statement of [
    "m:ordering.pick-cart a pm:Stpe ; pm:flowsTo m:ordering.submit-order .",
    "m:ordering.urge a pm:Polcy ; pm:starts m:ordering.submit-order .",
    "m:ordering.urge a pm:Policy, pm:Step ; pm:starts m:ordering.submit-order .",
    "<urn:other:p> a pm:Policy ; pm:starts m:ordering.submit-order .",
    "m:customer pm:starts m:ordering.submit-order .",
  ]) {
    const r = extra(statement);
    assert.equal(r.complete, false, statement);
    assert.ok(
      r.errors.some((e) => /docs\/process\/d2\.ttl:5/.test(e.where)),
      `${statement}: ${JSON.stringify(r.errors.map((e) => e.where))}`,
    );
  }
  const foreign = extra("<urn:other:p> a pm:Policy ; pm:starts m:ordering.submit-order .");
  assert.ok(
    stepOf(foreign, "ordering.submit-order").startedBy.every((u) => u.policy.id),
    "a non-model IRI is never shown as a connection",
  );
  // Another category's link error belongs to that category only.
  const mapping = structuredClone(MAPPING);
  mapping.categories.reports.realizes = ["ordering"];
  const v = validateModel(
    [EXAMPLE, SHIPPING].map((text, i) => ({ doc: `docs/process/d${i}.ttl`, text })),
    { categoryKeys: Object.keys(mapping.categories) },
  );
  const findings = [...v.findings, ...checkRealizes(mapping, v.index)];
  const ask = (id) =>
    queryContext({ index: v.index, mapping, findings, target: { kind: "category", id } });
  assert.equal(ask("ordering").complete, true);
  assert.equal(ask("reports").complete, false);
});

test("an unreadable ADR index makes every result incomplete and never reads as an absent category", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2).slice(0, 120));
    const category = cli(dir, ["query", "--category", "ordering"]);
    assert.equal(category.code, 1);
    assert.match(
      category.out,
      /INCOMPLETE[\s\S]*process-index-unreadable\] docs\/adr\/\.mapping\.json:\d+:\d+/,
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

test("an outside-system step's realization stays known while the ADR index cannot be read", () => {
  const unreadable = {
    level: "error",
    code: "process-index-unreadable",
    where: "docs/adr/.mapping.json:1:1",
    element: null,
    msg: "the ADR index cannot be read",
  };
  const r = run({ kind: "process", id: "payment.take-payment" }, { extra: [unreadable] });
  // Every reference to a step in the result, wherever it sits.
  const refs = [];
  const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      if (typeof x.id === "string" && "realizedBy" in x) refs.push(x);
      Object.values(x).forEach(walk);
    }
  };
  walk(r);
  const of = (id) => refs.filter((x) => x.id === id);
  assert.ok(of("payment.request-payment").length && of("payment.capture-payment").length);
  assert.ok(of("payment.request-payment").every((x) => x.realizationUnknown === true));
  assert.ok(
    of("payment.capture-payment").every((x) => x.realizationUnknown === undefined),
    "a step outside the system is never a realization target",
  );
});

test("deleting an element connected to the target is an in-scope change, committed or not", () => {
  withTmp((dir) => {
    repo(dir);
    const withoutPolicy = EXAMPLE.replace(
      /m:ordering\.confirm-on-payment a pm:Policy ;[\s\S]*?\n\n/,
      "",
    ).replace("    pm:triggers m:ordering.confirm-on-payment ;\n", "");
    write(dir, "docs/process/ordering.ttl", withoutPolicy);
    const uncommitted = changesOf(dir, "ordering");
    assert.ok(
      uncommitted.uncommittedChanges.some(
        (c) => c.id === "ordering.confirm-on-payment" && c.change === "removed",
      ),
      JSON.stringify(uncommitted),
    );
    write(dir, "docs/process/ordering.ttl", EXAMPLE);
    // A committed deletion in an Accepted process names the deleted element.
    write(
      dir,
      "docs/process/shipping.ttl",
      SHIPPING.replace(/m:shipping\.pack-when-paid a pm:Policy ;[\s\S]*?\.\n/, "").replace(
        "m:payment.payment-completed pm:triggers m:shipping.pack-when-paid .\n",
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

test("an event query leaves out retired processes' criteria and policies unless asked", () => {
  const retired = SHIPPING.replace(
    'pm:status "Accepted (2020-01-01)"',
    'pm:status "Deprecated (2020-01-20)"',
  );
  const event = (includeRetired) =>
    run(
      { kind: "event", id: "payment.payment-completed" },
      { texts: [EXAMPLE, retired], includeRetired },
    );
  assert.ok(!ids(event(false).criteria).includes("shipping.ship-order.sent"));
  assert.ok(!event(false).reactions.some((x) => x.policy.id === "shipping.pack-when-paid"));
  const all = event(true);
  const sent = all.criteria.find((c) => c.id === "shipping.ship-order.sent");
  assert.equal(sent.process.retired, true);
  assert.match(
    renderContext(all),
    /criterion shipping\.ship-order\.sent "Paid orders leave" of shipping\.ship-order \(retired\)/,
  );
});

test("both unlinked forms say the feature still needs its rules checked", () => {
  const confirmed = run({ kind: "category", id: "reports" });
  assert.match(confirmed.note, /not evidence that no business rule applies/);
  assert.match(confirmed.note, /do not ask the three-way judgment again/);
});

test("every connection route of a step context is returned, and nothing unconnected", () => {
  const rules = `${HEAD}m:step-rule a pm:BusinessRule ; rdfs:label "Step rule" ; pm:definition "d" ; pm:basisKind "user-decision" ; pm:basis "b" ; pm:constrains m:ordering.confirm-order, m:ordering.submit-order .
m:policy-rule a pm:BusinessRule ; rdfs:label "Policy rule" ; pm:definition "d" ; pm:basisKind "user-decision" ; pm:basis "b" ; pm:constrains m:ordering.confirm-on-payment, m:payment.request-on-order .
m:far-rule a pm:BusinessRule ; rdfs:label "Far rule" ; pm:definition "d" ; pm:basisKind "user-decision" ; pm:basis "b" ; pm:constrains m:shipping.pack-when-paid, m:payment.request-on-order .
m:ordering.confirm-order pm:openScope "Partial confirmation."^^pm:OpenPath .\n`;
  const r = run({ kind: "category", id: "ordering" }, { texts: [EXAMPLE, SHIPPING, rules] });
  const confirm = stepOf(r, "ordering.confirm-order");
  const via = Object.fromEntries(confirm.rules.map((x) => [x.id, x.via]));
  assert.deepEqual(via["step-rule"], ["step"]);
  assert.deepEqual(via["policy-rule"], ["policy ordering.confirm-on-payment"]);
  assert.equal(via["far-rule"], undefined, "a rule on an unconnected policy and step stays out");
  assert.deepEqual(confirm.openScope.step, [{ kind: "open-path", text: "Partial confirmation." }]);
  assert.equal(r.complete, true);
  const p = run({ kind: "process", id: "payment.take-payment" });
  assert.deepEqual(
    p.openScope.map((x) => x.kind),
    ["not-applicable", "open-path"],
  );
  assert.equal(
    run({ kind: "concept", id: "ordering.order" }).concept.definition,
    "A customer's confirmed request to buy products.",
  );
  assert.equal(run({ kind: "event", id: "payment.payment-completed" }).event.context.id, "payment");
});

test("a target or realized step with its own type error is incomplete, never absent, and a malformed link list is an error", () => {
  const typo = EXAMPLE.replace(
    "m:payment.take-payment a pm:Process ;",
    "m:payment.take-payment a pm:Proces ;",
  );
  const p = run({ kind: "process", id: "payment.take-payment" }, { texts: [typo, SHIPPING] });
  assert.equal(p.found, null);
  assert.equal(p.complete, false);
  assert.ok(p.errors.some((e) => e.element === "payment.take-payment"));
  const step = EXAMPLE.replace(
    "m:ordering.submit-order a pm:Step ;",
    "m:ordering.submit-order a pm:Stpe ;",
  );
  const v = validateModel(
    [step, SHIPPING].map((text, i) => ({ doc: `docs/process/d${i}.ttl`, text })),
    { categoryKeys: Object.keys(MAPPING.categories) },
  );
  const findings = [...v.findings, ...checkRealizes(MAPPING, v.index)];
  const ordering = queryContext({
    index: v.index,
    mapping: MAPPING,
    findings,
    target: { kind: "category", id: "ordering" },
  });
  assert.ok(
    ordering.errors.some(
      (e) => e.code === "process-unknown-term" && e.element === "ordering.submit-order",
    ),
    JSON.stringify(ordering.errors),
  );
  const mapping = structuredClone(MAPPING);
  mapping.categories.ordering.realizes = "ordering.submit-order";
  const vv = validateModel([{ doc: "d.ttl", text: EXAMPLE }]);
  const shaped = queryContext({
    index: vv.index,
    mapping,
    findings: [...vv.findings, ...checkRealizes(mapping, vv.index)],
    target: { kind: "category", id: "ordering" },
  });
  assert.equal(shaped.link, "invalid");
  assert.equal(shaped.complete, false);
  assert.ok(shaped.errors.some((e) => e.code === "process-link-shape"));
});

test("a realizes entry that is not a step id fails validation and makes the feature's link invalid and its context incomplete, never confirmed empty", () => {
  const mappingWith = (realizes) => {
    const mapping = structuredClone(MAPPING);
    mapping.categories.fulfilment.realizes = realizes;
    return mapping;
  };
  const fulfilment = (realizes) =>
    run({ kind: "category", id: "fulfilment" }, { mapping: mappingWith(realizes), links: true });
  for (const realizes of [[5], [null], [{ id: "shipping.pack-order" }]]) {
    const r = fulfilment(realizes);
    const shown = JSON.stringify(realizes);
    assert.equal(r.complete, false, shown);
    assert.equal(r.link, "invalid", shown);
    assert.ok(
      r.errors.some(
        (e) =>
          e.code === "process-link-shape" &&
          e.category === "fulfilment" &&
          e.msg.includes("which is not a step id"),
      ),
      `${shown}: ${JSON.stringify(r.errors)}`,
    );
  }
  assert.equal(fulfilment(["shipping.pack-order", 5]).complete, false);
  assert.equal(fulfilment([]).link, "confirmed-none");
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mappingWith([5])));
    write(dir, "docs/process/ordering.ttl", EXAMPLE);
    write(dir, "docs/process/shipping.ttl", SHIPPING);
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /\[process-link-shape\] docs\/adr\/\.mapping\.json\n\s*category "fulfilment" realizes 5, which is not a step id/,
    );
  });
});

test("a feature realizing only a step with its own type error carries that step's error", () => {
  const typo = SHIPPING.replace(
    "m:shipping.pack-order a pm:Step ;",
    "m:shipping.pack-order a pm:Stpe ;",
  );
  const r = run({ kind: "category", id: "fulfilment" }, { texts: [EXAMPLE, typo], links: true });
  assert.equal(r.complete, false);
  assert.ok(
    r.errors.some((e) => e.code === "process-unknown-term" && e.element === "shipping.pack-order"),
    JSON.stringify(r.errors),
  );
});

test("a concept or event target with its own type error is incomplete at the error's position, never absent", () => {
  withTmp((dir) => {
    repo(dir);
    const broken = EXAMPLE.replace(
      "m:ordering.order a pm:BusinessConcept ;",
      "m:ordering.order a pm:BusinessConcept, pm:Actor ;",
    ).replace(
      "m:payment.payment-completed a pm:BusinessEvent ;",
      "m:payment.payment-completed a pm:BusinessEvnt ;",
    );
    write(dir, "docs/process/ordering.ttl", broken);
    const lineOf = (subject) => broken.slice(0, broken.indexOf(`${subject} a `)).split("\n").length;
    for (const [flag, id, code] of [
      ["--concept", "ordering.order", "process-type-multiple"],
      ["--event", "payment.payment-completed", "process-unknown-term"],
    ]) {
      const query = cli(dir, ["query", flag, id, "--json"]);
      assert.equal(query.code, 1, flag);
      const r = JSON.parse(query.out);
      assert.equal(r.found, null, flag);
      assert.equal(r.complete, false, flag);
      const where = `docs/process/ordering.ttl:${lineOf(`m:${id}`)}`;
      assert.ok(
        r.errors.some((e) => e.code === code && e.element === id && e.where === where),
        `${where}: ${JSON.stringify(r.errors)}`,
      );
    }
  });
});

test("a rule on a downstream reacting policy is not applicable to the step that emits the event", () => {
  const r = run({ kind: "category", id: "ordering" }, { texts: [EXAMPLE, SHIPPING, FAR_RULE] });
  for (const id of ["ordering.submit-order", "ordering.confirm-order"])
    assert.ok(!stepOf(r, id).rules.some((x) => x.id === "far-rule"), id);
  assert.ok(
    stepOf(
      run({ kind: "category", id: "payments" }, { texts: [EXAMPLE, SHIPPING, FAR_RULE] }),
      "payment.request-payment",
    ).rules.some((x) => x.id === "far-rule"),
    "the rule applies where its policy starts the step",
  );
});

test("a rule that applies to none of a feature's steps appears nowhere in its result", () => {
  const text = JSON.stringify(
    run({ kind: "category", id: "ordering" }, { texts: [EXAMPLE, SHIPPING, FAR_RULE] }),
  );
  assert.match(text, /payment\.amount-matches-order/, "the applicable rule is listed");
  assert.doesNotMatch(text, /far-rule/);
});

test("a committed deletion of a rule that applied to the target's step counts as in scope", () => {
  withTmp((dir) => {
    repo(dir);
    const rule = `${HEAD}m:pack-rule a pm:BusinessRule ; rdfs:label "Pack rule" ; pm:definition "d" ; pm:basisKind "user-decision" ; pm:basis "b" ; pm:constrains m:shipping.pack-order, m:ordering.confirm-order .\n`;
    write(dir, "docs/process/rules.ttl", rule);
    write(
      dir,
      "docs/process/shipping.ttl",
      SHIPPING.replace('pm:status "Accepted (2020-01-01)"', 'pm:status "Accepted (2020-01-02)"'),
    );
    commitAll(dir, "accepted with its rule");
    write(dir, "docs/process/rules.ttl", "");
    commitAll(dir, "rule deleted directly");
    const [flag] = changesOf(dir, "fulfilment").unsyncedAccepted;
    assert.ok(
      flag?.changes.some((c) => c.id === "pack-rule" && c.change === "removed"),
      JSON.stringify(flag),
    );
  });
});

test("the history reads the same documents as the working tree: no dot-entries, links followed", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/process/.drafts/old.ttl", "@prefix m: <urn:adr-writer:model:> .\nm:x a\n");
    write(
      dir,
      "shared/extra.ttl",
      `${HEAD}m:auditor a pm:Actor ; rdfs:label "Auditor" ; pm:definition "Checks the books." .\n`,
    );
    symlinkSync("../../shared/extra.ttl", path.join(dir, "docs/process/extra.ttl"));
    write(
      dir,
      "shared/more/notes.ttl",
      `${HEAD}m:clerk a pm:Actor ; rdfs:label "Clerk" ; pm:definition "Files records." .\n`,
    );
    symlinkSync("../../shared/more", path.join(dir, "docs/process/more"));
    commitAll(dir, "dot directory and links");
    const clean = changesOf(dir, "fulfilment");
    assert.equal(clean.available, true);
    assert.equal(clean.committedUnavailable, undefined, JSON.stringify(clean));
    assert.deepEqual([clean.uncommitted, clean.uncommittedElsewhere], [[], false]);
  });
});

test("a shallow clone marks committed edits unknown, and an unparsable HEAD still shows uncommitted documents", () => {
  withTmp((dir) => {
    const source = path.join(dir, "source");
    mkdirSync(source);
    repo(source);
    write(
      source,
      "docs/process/shipping.ttl",
      SHIPPING.replace(
        '"The warehouse packs the order lines."',
        '"The warehouse packs and labels the order lines."',
      ),
    );
    commitAll(source, "direct edit");
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
    write(dir, "docs/process/shipping.ttl", "m:x a [ ] .\n");
    commitAll(dir, "broken");
    write(dir, "docs/process/shipping.ttl", SHIPPING);
    const r = JSON.parse(cli(dir, ["query", "--category", "fulfilment", "--json"]).out);
    assert.match(r.changes.committedUnavailable, /cannot be parsed/);
    assert.deepEqual(r.changes.uncommittedDocuments, ["docs/process/shipping.ttl"]);
    assert.match(
      cli(dir, ["query", "--category", "fulfilment"]).out,
      /UNCOMMITTED model documents differ from HEAD \(not a settled reference\): docs\/process\/shipping\.ttl/,
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
        (e) => e.code === "process-adr-status-mismatch" && e.category === "ordering",
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
      /ordering \(docs\/adr\/ordering\/0001-confirm\.md Proposed\) — its index records do not match its ADR files; realization unknown until the reported ADR index error is fixed/,
    );
  });
  // A scope that shows no step of that feature is not affected.
  const reports = {
    level: "error",
    code: "process-adr-status-mismatch",
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
      ["process-adr-missing", "payments", "docs/adr/payments/0001-pay.md"],
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
      ["process-adr-unindexed", "payments", "docs/adr/payments/0002-refunds.md"],
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
          (e) => e.code === "process-adr-record-invalid" && e.category === "payments",
        ),
        JSON.stringify(invalid.errors),
      );
      assert.deepEqual(realization(invalid), unknown);
    }
  });
});

test("a link record that is not a list of step ids leaves every realization unknown and every result incomplete", () => {
  const mapping = structuredClone(MAPPING);
  mapping.categories.reports.realizes = "ordering.submit-order";
  const r = run({ kind: "category", id: "ordering" }, { mapping, links: true });
  assert.equal(r.complete, false);
  assert.ok(r.errors.some((e) => e.code === "process-link-shape" && e.category === "reports"));
  const { step } = r.steps.find((s) => s.step.id === "ordering.submit-order");
  assert.equal(step.realizationUnknown, true);
  assert.deepEqual(
    step.realizedBy.map((x) => x.category),
    ["ordering"],
    "the readable links stay",
  );
  assert.equal(
    run({ kind: "category", id: "fulfilment" }, { mapping, links: true }).complete,
    false,
    "every result is incomplete",
  );
});
