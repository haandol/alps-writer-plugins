// Deterministic business-context queries: only the
// connected elements, with process and ADR Status, errors and change flags.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRealizes, validateModel } from "../scripts/process-model-lib.mjs";
import { queryContext, renderContext } from "../scripts/process-model-query.mjs";
import { withTmp, write } from "./helpers.mjs";
import { EXAMPLE, cli } from "./process-model-helpers.mjs";
import { HEAD, SHIPPING, MAPPING, run } from "./process-model-query-helpers.mjs";

/** A rule on two reacting policies, neither of which starts an ordering step. */
const FAR_RULE = `${HEAD}m:far-rule a pm:BusinessRule ; rdfs:label "Far rule" ; pm:definition "d" ; pm:basisKind "user-decision" ; pm:basis "b" ; pm:constrains m:shipping.pack-when-paid, m:payment.request-on-order .\n`;

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

test("the text names each step's realizing features and lists their ADRs once", () => {
  const text = renderContext(run({ kind: "process", id: "ordering.place-order" }));
  assert.match(
    text,
    /^Step ordering\.submit-order "Submit the order" — ordering\.place-order "Place an order" \[Proposed\]; realized by: ordering$/m,
  );
  for (const adr of [
    "docs/adr/fulfilment/0001-pack.md",
    "docs/adr/ordering/0001-confirm.md",
    "docs/adr/payments/0001-pay.md",
  ])
    assert.equal(text.split(adr).length, 2, `${adr} is listed once:\n${text}`);
  assert.ok(
    text.includes(
      "ADRs of the realizing features named above:\n  fulfilment: docs/adr/fulfilment/0001-pack.md [Accepted (2020-01-01)]\n  ordering: docs/adr/ordering/0001-confirm.md [Proposed]\n  payments: docs/adr/payments/0001-pay.md [Accepted (2020-01-01)]\n",
    ),
    text,
  );
  // The stated absence of open scope reads as that, not as a kind and its placeholder.
  assert.match(
    renderContext(run({ kind: "process", id: "shipping.ship-order" })),
    /^  open scope: no open scope$/m,
  );
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
