// Read-only process views: landscape, process
// flows and element details from the same model reading as validation and
// queries, with realization computed from the ADR index at generation time.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MODEL, PM, RDFS, elementId, validateModel } from "../scripts/process-model-lib.mjs";
import { queryContext } from "../scripts/process-model-query.mjs";
import { realizationOf, renderView } from "../scripts/process-model-view.mjs";
import { EXAMPLE } from "./process-model-helpers.mjs";
import {
  MAPPING,
  sections,
  v,
  withoutEngine,
  decodeAnchor,
  articleOf,
  landscapeOf,
  diagrams,
  UNKNOWN,
} from "./process-model-view-helpers.mjs";

const HEAD = `@prefix m: <${MODEL}> .\n@prefix pm: <${PM}> .\n@prefix rdfs: <${RDFS}> .\n\n`;

const sourceOf = (html, key) => {
  const figures = [...html.matchAll(/<figure [^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  const figure = figures.find((f) => f.includes(`data-mermaid`) && f.includes(key)) ?? "";
  return (figure.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)?.[1] ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
};

const HTML = renderView({ index: v.index, mapping: MAPPING, findings: v.findings });

/** The page without the vendored diagram engine, whose library source is not page behavior. */
const PAGE = HTML.replace(/<script data-mermaid-engine>[\s\S]*?<\/script>/, "");

/** The element a node stands for: its detail anchor, or the identifier its label starts with. */
const elementOf = (d, node) => {
  const target = d.targets[node] ?? "";
  return /^(?:process-)?el-/.test(target)
    ? decodeAnchor(target)
    : d.nodes.get(node).label.split(" · ")[0];
};

const nodeLabelled = (d, prefix) => [...d.nodes].find(([, n]) => n.label.startsWith(prefix));

const RELATION_OF = {
  "box --> box": "flowsTo",
  "actor -.-> box": "performs",
  "box ==> event": "emits",
  "box --> event": "emits",
  "event --> policy": "triggers",
  "policy --> box": "starts",
};

const drawnRelation = (d, e) =>
  `${elementOf(d, e.from)} ${RELATION_OF[`${d.nodes.get(e.from).shape} ${e.arrow} ${d.nodes.get(e.to).shape}`]} ${elementOf(d, e.to)}`;

/** Relations and element identifiers of a process query result, as the flow draws them. */
function flowFacts(q) {
  const relations = new Set();
  const ids = new Set();
  const add = (a, rel, b) => {
    relations.add(`${a.id} ${rel} ${b.id}`);
    ids.add(a.id).add(b.id);
  };
  for (const c of q.steps) {
    ids.add(c.step.id);
    for (const n of c.next) add(c.step, "flowsTo", n);
    for (const n of c.previous) add(n, "flowsTo", c.step);
    for (const a of c.performers) add(a, "performs", c.step);
    for (const e of c.emits) {
      add(c.step, "emits", e);
      for (const r of e.reactions) {
        add(e, "triggers", r.policy);
        for (const x of r.starts) add(r.policy, "starts", x);
      }
    }
    for (const u of c.startedBy) {
      add(u.policy, "starts", c.step);
      for (const e of u.events) add(e, "triggers", u.policy);
    }
    if (c.context) add(c.step, "inContext", c.context);
  }
  return { relations, ids };
}

/** Cross-process relations of the event queries, as the landscape draws them. */
function landscapeFacts(model) {
  const relations = new Set();
  for (const e of model.index.ofType("BusinessEvent")) {
    const q = queryContext({
      index: model.index,
      mapping: MAPPING,
      findings: model.findings,
      target: { kind: "event", id: elementId(e) },
    });
    for (const s of q.emittedBy)
      if (s.process) relations.add(`${s.process.id} emits ${q.event.id}`);
    for (const r of q.reactions) {
      relations.add(`${q.event.id} triggers ${r.policy.id}`);
      for (const s of r.starts)
        if (s.process) relations.add(`${r.policy.id} starts ${s.process.id}`);
    }
    if (q.event.context) relations.add(`${q.event.id} inContext ${q.event.context.id}`);
  }
  return relations;
}

// Models with one kind of validation error each, rendered once and shared.
const BROKEN = {
  danglingEmit: [EXAMPLE, `${HEAD}m:ordering.submit-order pm:emits m:ghost .\n`],
  actorTrigger: [EXAMPLE, `${HEAD}m:ordering.order-placed pm:triggers m:customer .\n`],
  invalidStepIri: [
    EXAMPLE,
    `${HEAD}<${MODEL}bad.> a pm:Step ;\n    rdfs:label "Bad id step" ;\n    pm:definition "A step whose identifier ends with a dot." ;\n    pm:stepKind "system" ;\n    pm:inContext m:ordering .\n\nm:ordering.place-order pm:hasStep <${MODEL}bad.> .\n\nm:customer pm:performs <${MODEL}bad.> .\n`,
  ],
  stepInTwoProcesses: [
    EXAMPLE,
    `${HEAD}m:payment.take-payment pm:hasStep m:ordering.submit-order .\n`,
  ],
  eventWithoutContext: [
    EXAMPLE.replace(
      "pm:triggers m:payment.request-on-order ;\n    pm:inContext m:ordering .",
      "pm:triggers m:payment.request-on-order .",
    ),
  ],
};

const rendered = new Map();

const view = (name) => {
  if (!rendered.has(name)) {
    const texts = name === "example" ? [EXAMPLE] : BROKEN[name];
    const model = validateModel(
      texts.map((text, i) => ({ doc: `docs/process/${"ab"[i]}.ttl`, text })),
    );
    const html = renderView({ index: model.index, mapping: MAPPING, findings: model.findings });
    rendered.set(name, { model, html: withoutEngine(html) });
  }
  return rendered.get(name);
};

test("the view is one standalone file with no external resources and no editing behavior", () => {
  assert.ok(
    !/<(?:script|img|link|iframe)[^>]+(?:src|href)=["']?(?:https?:)?\/\//i.test(HTML),
    "no external resource",
  );
  assert.match(HTML, /<script data-mermaid-engine>/);
  assert.ok(!/<form|contenteditable|<input|<textarea/i.test(PAGE), "no editing control");
  const own = HTML.slice(HTML.indexOf("<script data-view-navigation>"));
  assert.doesNotMatch(own, /fetch\(|XMLHttpRequest|localStorage|indexedDB|showSaveFilePicker/);
  assert.equal(
    (HTML.match(/data-render-state="failed"/g) ?? []).length,
    0,
    "every diagram passes the bundled parser",
  );
});

test("the landscape shows contexts, processes and every event and policy between processes", () => {
  const src = sourceOf(HTML, "data-diagram-type");
  for (const label of [
    "Order placed",
    "Request payment for a new order",
    "Payment completed",
    "Confirm once paid",
    "Place an order",
    "Take a payment",
  ])
    assert.ok(src.includes(label), label);
  assert.match(src, /subgraph \w+_ctx\["Ordering"\]/);
  assert.match(src, /subgraph \w+_ctx\["Payment"\]/);
  const connections = HTML.slice(
    HTML.indexOf("<h3>Connections between processes</h3>"),
    HTML.indexOf("<h3>Bounded contexts</h3>"),
  );
  assert.equal((connections.match(/<li>/g) ?? []).length, 2);
});

test("each process flow draws its flow, emits, triggers, starts and performers", () => {
  const ordering = sections(HTML).find((s) => s.id.includes("ordering_2e_place-order"));
  const src = sourceOf(ordering.body, "data-diagram-type");
  const node = (label) => new RegExp(`(n\\d+)[\\[({/]+"${label}`).exec(src)?.[1];
  const [
    submit,
    confirm,
    placed,
    customer,
    system,
    paid,
    confirmPolicy,
    requestPolicy,
    requestStep,
  ] = [
    "Submit the order",
    "Confirm the order",
    "Order placed",
    "Customer",
    "Order system",
    "Payment completed",
    "Confirm once paid",
    "Request payment for a new order",
    "Request the payment",
  ].map(node);
  for (const edge of [
    `${submit} --> ${confirm}`,
    `${submit} ==> ${placed}`,
    `${customer} -.-> ${submit}`,
    `${system} -.-> ${confirm}`,
    `${paid} --> ${confirmPolicy}`,
    `${confirmPolicy} --> ${confirm}`,
    `${placed} --> ${requestPolicy}`,
    `${requestPolicy} --> ${requestStep}`,
  ])
    assert.ok(src.includes(edge), `missing ${edge}`);
  assert.match(
    src,
    /"Request the payment · Take a payment"/,
    "a step of another process is labeled with its process",
  );
});

test("element details show every fact attribute, related rules, the identifier and the document", () => {
  const article = (id) =>
    HTML.match(
      new RegExp(
        `<article class="element" id="el-${id.replace(/\./g, "_2e_")}"[^>]*>([\\s\\S]*?)</article>`,
      ),
    )?.[1] ?? "";
  const policy = article("payment.request-on-order");
  for (const row of ["label", "definition", "reactionCondition", "basisKind", "basis"])
    assert.match(policy, new RegExp(`<th scope="row">${row}</th>`), row);
  assert.match(policy, /<td>The order has no payment yet\.<\/td>/);
  assert.match(policy, /<code>m:payment\.request-on-order<\/code>/);
  assert.match(policy, /<code>docs\/process\/example\.ttl:\d+<\/code>/);
  const process = article("ordering.place-order");
  assert.match(
    process,
    /class="description"[\s\S]*From order submission to order confirmation\./,
    "description attributes are shown apart",
  );
  assert.match(process, /<th scope="row">status<\/th><td>Proposed<\/td>/);
  assert.match(
    article("ordering.submit-order"),
    /Related business rules[\s\S]*Payment covers the order/,
    "a step lists rules reaching it",
  );
  assert.match(
    article("ordering.order"),
    /Related business rules[\s\S]*Payment covers the order/,
    "a concept lists rules constraining it",
  );
});

test("realization is implemented only with an Accepted and no Proposed ADR; outside and unrealized steps differ", () => {
  const index = v.index;
  const state = (id, mapping = MAPPING) => realizationOf(index, mapping, `${MODEL}${id}`).state;
  assert.equal(state("ordering.submit-order"), "implemented");
  assert.equal(state("ordering.confirm-order"), "notImplemented", "a Proposed ADR remains");
  assert.equal(state("payment.request-payment"), "unrealized");
  assert.equal(state("payment.capture-payment"), "outside");
  const later = structuredClone(MAPPING);
  later.categories.confirmation.adrs[1].status = "Accepted (2020-01-30)";
  assert.equal(
    state("ordering.confirm-order", later),
    "implemented",
    "recomputed from the current index",
  );
  const retired = {
    categories: {
      checkout: {
        adrs: [{ path: "a.md", status: "Superseded by [ADR 2](b.md)" }],
        realizes: ["ordering.submit-order"],
      },
    },
  };
  assert.equal(
    state("ordering.submit-order", retired),
    "notImplemented",
    "retired ADRs do not count",
  );
  assert.match(HTML, /state-implemented">implemented/);
  assert.match(HTML, /state-unrealized">no realizing feature/);
  assert.match(HTML, /state-outside">outside the system/);
});

test("the view and the query read the model the same way", () => {
  for (const s of sections(HTML)) {
    const id = s.id.replace(/^process-el-/, "").replace(/_2e_/g, ".");
    const q = queryContext({
      index: v.index,
      mapping: MAPPING,
      findings: v.findings,
      target: { kind: "process", id },
    });
    const drawn = [...s.body.matchAll(/<li><a href="#el-([^"]+)">/g)].map((m) =>
      m[1].replace(/_2e_/g, "."),
    );
    assert.deepEqual(
      drawn,
      q.steps.map((x) => x.step.id),
      id,
    );
  }
});

test("retired processes are drawn only on request, marked retired", () => {
  const text = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Deprecated (2020-01-20)" ;\n    pm:hasStep m:payment',
  );
  const r = validateModel([{ doc: "d.ttl", text }]);
  const plain = renderView({ index: r.index, mapping: MAPPING, findings: r.findings });
  assert.doesNotMatch(plain, /id="process-el-payment_2e_take-payment"/);
  const all = renderView({
    index: r.index,
    mapping: MAPPING,
    findings: r.findings,
    includeRetired: true,
  });
  assert.match(
    all,
    /id="process-el-payment_2e_take-payment"[\s\S]*?Deprecated \(2020-01-20\) · retired/,
  );
});

/** Change flags shaped as changeFlags returns them, with the given fields set. */
const flagsWith = (fields) => ({
  available: true,
  head: v.index,
  history: { available: true },
  uncommitted: new Set(),
  uncommittedKinds: new Map(),
  uncommittedDocuments: null,
  unsynced: new Map(),
  unsyncedKinds: new Map(),
  compositionChanged: new Set(),
  since: new Map(),
  baseline: new Map(),
  uncertain: new Map(),
  lifecycleEdits: new Map(),
  ...fields,
});

test("uncommitted and unsynced edits are marked", () => {
  const changes = flagsWith({
    uncommitted: new Set(["customer", "ordering.gone"]),
    unsynced: new Map([
      ["payment.take-payment", new Set(["payment.capture-payment", "payment.gone"])],
    ]),
  });
  const html = renderView({ index: v.index, mapping: MAPPING, findings: v.findings, changes });
  assert.match(
    html,
    /<section class="changes"[\s\S]*Uncommitted edits in the working tree: <a href="#el-customer">customer<\/a>, <span class="removed">ordering\.gone \(removed since the last commit\)<\/span>/,
  );
  // A committed removal is counted from where the process may have last become Accepted.
  assert.match(
    html,
    /<span class="removed">payment\.gone \(removed since it may have last become Accepted\)<\/span>/,
  );
  assert.match(
    html,
    /Committed direct edits of an Accepted process[\s\S]*payment\.take-payment[\s\S]*payment\.capture-payment/,
  );
  assert.match(
    sourceOf(
      html.slice(html.indexOf('id="process-el-ordering_2e_place-order"')),
      "data-diagram-type",
    ),
    /"Customer · changed"/,
  );
});

test("validation errors are shown at their position and their scope is marked incomplete", () => {
  const broken = validateModel([
    { doc: "docs/process/a.ttl", text: EXAMPLE },
    { doc: "docs/process/b.ttl", text: `${HEAD}m:ordering.submit-order pm:emits m:ghost .\n` },
  ]);
  const html = renderView({ index: broken.index, mapping: MAPPING, findings: broken.findings });
  assert.match(
    html,
    /<section class="errors"[\s\S]*process-relation-dangling[\s\S]*docs\/process\/b\.ttl:5/,
  );
  assert.match(
    html,
    /id="process-el-ordering_2e_place-order"[\s\S]*?Incomplete: validation errors affect this process\./,
  );
  const unparsable = validateModel([{ doc: "docs/process/a.ttl", text: "m:x a [ ] ." }]);
  const none = renderView({
    index: unparsable.index,
    mapping: MAPPING,
    findings: unparsable.findings,
  });
  assert.match(none, /The model could not be parsed, so nothing is drawn\./);
  assert.doesNotMatch(none, /<figure/);
});

test("Korean labels follow the user's language", () => {
  const ko = renderView({ index: v.index, mapping: MAPPING, findings: v.findings, lang: "ko" });
  assert.match(ko, /<html lang="ko">/);
  assert.match(ko, /전체 업무 전경/);
  assert.match(ko, /구현됨/);
});

test("a missing relation target is drawn as an invalid reference with a broken link, never as an element", () => {
  const { html } = view("danglingEmit");
  const ordering = sections(html).find((s) => s.id === "process-el-ordering_2e_place-order");
  const [flow] = diagrams(ordering.body);
  const [ghost, node] = nodeLabelled(flow, "ghost");
  assert.equal(node.label, "ghost · not in the model");
  assert.deepEqual(node.classes, ["invalid"], "not drawn as an event");
  assert.equal(flow.targets[ghost], "errors", "it leads to the validation errors");
  assert.ok(flow.broken.has(flow.edges.findIndex((e) => e.to === ghost)), "the link is broken");
  assert.match(
    ordering.body,
    /Incomplete: validation errors affect this process\.[\s\S]*process-relation-dangling<\/code> <code>docs\/process\/b\.ttl:5<\/code>/,
  );
  assert.match(
    articleOf(html, "ordering.submit-order"),
    /emits to <code>ghost<\/code> <span class="badge broken">not in the model<\/span>/,
  );
});

test("a relation to an element of the wrong type is not drawn, and every flow reaching its subject is incomplete", () => {
  const { html } = view("actorTrigger");
  for (const s of sections(html)) {
    const [flow] = diagrams(s.body);
    const [placed, node] = nodeLabelled(flow, "Order placed");
    assert.equal(node.label, "Order placed · error", s.id);
    assert.ok(node.classes.includes("broken"), s.id);
    const customer = nodeLabelled(flow, "Customer")?.[0];
    assert.ok(
      !flow.edges.some((e) => e.from === placed && e.to === customer),
      "no trigger to an actor",
    );
    assert.match(s.body, /class="incomplete"/, s.id);
  }
  assert.match(
    articleOf(html, "ordering.order-placed"),
    /triggers to <a href="#el-customer">Customer<\/a> <span class="badge broken">error<\/span>/,
  );
});

test("an element a finding names by its IRI is marked where it is drawn and linked from the error", () => {
  const { html } = view("invalidStepIri");
  const ordering = sections(html).find((s) => s.id === "process-el-ordering_2e_place-order");
  const [flow] = diagrams(ordering.body);
  const [bad, node] = nodeLabelled(flow, "Bad id step");
  assert.equal(node.label, "Bad id step · no realizing feature · error");
  assert.ok(node.classes.includes("broken"));
  assert.equal(flow.targets[bad], "el-bad_2e_");
  assert.match(
    ordering.body,
    /Incomplete: validation errors affect this process\.[\s\S]*process-element-iri/,
  );
  const detail = articleOf(html, "bad.");
  assert.match(detail, /<span class="badge broken">Validation errors<\/span>/);
  assert.match(
    detail,
    /<code>&lt;urn:adr-writer:model:bad\.&gt;<\/code>/,
    "the identifier as written",
  );
  assert.match(
    html.slice(html.indexOf('<section class="errors"'), html.indexOf("<nav aria-label")),
    /process-element-iri<\/code> <code>docs\/process\/b\.ttl:5<\/code> <a href="#el-bad_2e_">bad\.<\/a>/,
  );
});

test("a connection whose step belongs to two processes is listed as not placed and drawn broken", () => {
  const { html } = view("stepInTwoProcesses");
  const landscape = landscapeOf(html);
  const [d] = diagrams(landscape);
  assert.match(
    landscape,
    /Incomplete: validation errors affect the marked processes[\s\S]*Connections that cannot be placed[\s\S]*Order placed<\/a> → <a [^>]+>Request payment for a new order<\/a>: <a [^>]+>Submit the order<\/a> does not belong to exactly one process/,
  );
  const [event] = nodeLabelled(d, "Order placed");
  const [policy] = nodeLabelled(d, "Request payment for a new order");
  assert.ok(d.broken.has(d.edges.findIndex((e) => e.from === event && e.to === policy)));
  for (const p of ["Place an order", "Take a payment"])
    assert.match(nodeLabelled(d, p)[1].label, / · incomplete$/, p);
  const payment = sections(html).find((s) => s.id === "process-el-payment_2e_take-payment");
  const [flow] = diagrams(payment.body);
  const [submit] = nodeLabelled(flow, "Submit the order");
  const [confirm] = nodeLabelled(flow, "Confirm the order");
  assert.ok(
    flow.broken.has(flow.edges.findIndex((e) => e.from === submit && e.to === confirm)),
    "a flow into a step of another process is broken",
  );
});

test("an event without a context is still declared in the landscape and marked", () => {
  const { html } = view("eventWithoutContext");
  assert.notEqual(BROKEN.eventWithoutContext[0], EXAMPLE);
  const landscape = landscapeOf(html);
  const [d] = diagrams(landscape);
  const [, node] = nodeLabelled(d, "Order placed");
  assert.equal(node.context, null);
  assert.equal(node.label, "Order placed · error");
  assert.match(landscape, /class="incomplete"/);
});

test("every diagram declares the nodes its links use, every node leads to a target on the page, and no link is dead", () => {
  for (const name of ["example", ...Object.keys(BROKEN)]) {
    const { html } = view(name);
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const d of diagrams(html)) {
      for (const e of d.edges)
        for (const n of [e.from, e.to]) assert.ok(d.nodes.has(n), `${name}: ${n} is not declared`);
      for (const m of d.source.matchAll(/^\s*class (n\d+) /gm))
        assert.ok(d.nodes.has(m[1]), `${name}: ${m[1]} is not declared`);
      for (const n of d.nodes.keys())
        assert.ok(ids.has(d.targets[n]), `${name}: ${n} leads nowhere`);
    }
    for (const m of html.matchAll(/href="#([^"]+)"/g))
      assert.ok(ids.has(m[1]), `${name}: #${m[1]}`);
    assert.equal((html.match(/data-render-state="failed"/g) ?? []).length, 0, `${name}: syntax`);
  }
});

test("every drawn node, relation and incomplete mark is the query's, also on erroneous models", () => {
  for (const name of ["example", ...Object.keys(BROKEN)]) {
    const { model, html } = view(name);
    for (const s of sections(html)) {
      const id = decodeAnchor(s.id);
      const q = queryContext({
        index: model.index,
        mapping: MAPPING,
        findings: model.findings,
        target: { kind: "process", id },
      });
      const facts = flowFacts(q);
      const [flow] = diagrams(s.body);
      for (const node of flow.nodes.keys())
        assert.ok(facts.ids.has(elementOf(flow, node)), `${name} ${id}: ${elementOf(flow, node)}`);
      for (const e of flow.edges)
        assert.ok(
          facts.relations.has(drawnRelation(flow, e)),
          `${name} ${id}: ${drawnRelation(flow, e)}`,
        );
      for (const [node, { context }] of flow.nodes) {
        if (!context) continue;
        const ctx = model.index
          .ofType("BoundedContext")
          .find(
            (c) => model.index.literal(c, `${RDFS}label`)[0]?.value === context.split(" · ")[0],
          );
        assert.ok(facts.relations.has(`${elementOf(flow, node)} inContext ${elementId(ctx)}`));
      }
      assert.equal(s.body.includes('class="incomplete"'), !q.complete, `${name} ${id}: incomplete`);
      const listed = [...s.body.matchAll(/<li><code>([^<]+)<\/code> <code>([^<]+)<\/code>/g)];
      assert.deepEqual(
        listed.map((m) => `${m[1]} ${m[2]}`).sort(),
        q.errors.map((e) => `${e.code} ${e.where}`).sort(),
        `${name} ${id}: the errors of the query`,
      );
    }
    const [landscape] = diagrams(landscapeOf(html));
    const relations = landscapeFacts(model);
    for (const e of landscape.edges)
      assert.ok(
        relations.has(drawnRelation(landscape, e)),
        `${name}: ${drawnRelation(landscape, e)}`,
      );
    for (const [node, n] of landscape.nodes)
      if (n.shape === "event" && n.context) {
        const ctx = model.index
          .ofType("BoundedContext")
          .find(
            (c) => model.index.literal(c, `${RDFS}label`)[0]?.value === n.context.split(" · ")[0],
          );
        assert.ok(relations.has(`${elementOf(landscape, node)} inContext ${elementId(ctx)}`), name);
      }
  }
});

test("by default no member of a retired process is named or linked; on request each is marked retired", () => {
  // A retired step with an error: the error is still listed, by its position only.
  const text = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Deprecated (2020-01-20)" ;\n    pm:hasStep m:payment',
  ).replace(
    '    pm:definition "The payment provider approves the card charge and collects the money." ;\n',
    "",
  );
  const r = validateModel([{ doc: "d.ttl", text }]);
  assert.deepEqual(
    r.findings.filter((f) => f.level === "error").map((f) => `${f.code} ${f.element}`),
    ["process-attribute-missing payment.capture-payment"],
  );
  const page = (includeRetired) =>
    withoutEngine(
      renderView({ index: r.index, mapping: MAPPING, findings: r.findings, includeRetired }),
    );
  const members = {
    "payment.take-payment": "Take a payment",
    "payment.request-payment": "Request the payment",
    "payment.capture-payment": "Capture the payment",
    "payment.take-payment.completed": "A placed order gets paid",
    "payment.request-on-order": "Request payment for a new order",
  };
  const plain = page(false);
  for (const [id, label] of Object.entries(members)) {
    assert.ok(!plain.includes(id), `${id} is not named`);
    assert.ok(!plain.includes(label), `${label} is not named`);
  }
  const ids = new Set([...plain.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of plain.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(m[1]), `#${m[1]}`);
  assert.match(
    plain,
    /<section class="errors"[^>]*>[\s\S]*<li><code>process-attribute-missing<\/code> <code>d\.ttl:111<\/code> — in a retired process hidden by this view; include retired processes to see it<\/li>/,
  );

  const all = page(true);
  for (const id of Object.keys(members))
    assert.match(
      articleOf(all, id),
      /^<h3>[^\n]*<span class="badge retired">retired<\/span>[^\n]*<\/h3>/,
      id,
    );
  assert.match(
    all,
    /process-attribute-missing<\/code> <code>d\.ttl:111<\/code> <a href="#el-payment_2e_capture-payment">/,
  );
  let drawn = 0;
  for (const d of diagrams(all))
    for (const [, n] of d.nodes)
      if (Object.values(members).some((label) => n.label.startsWith(label))) {
        drawn++;
        assert.ok(n.classes.includes("retired"), n.label);
        assert.match(n.label, / · retired/);
      }
  assert.ok(drawn >= 4, "retired members are drawn in their flow, other flows and the landscape");
  assert.match(
    articleOf(all, "customer"),
    /performs to <a href="#el-payment_2e_request-payment">Request the payment<\/a> <span class="badge retired">retired<\/span>/,
  );
});

test("a policy starting steps of a live and a retired process is drawn and listed unmarked; its retired step appears only on request, marked retired", () => {
  const text = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Deprecated (2020-01-20)" ;\n    pm:hasStep m:payment',
  );
  // The retired process's payment request policy also starts confirming the order.
  const shared = `${HEAD}m:payment.request-on-order pm:starts m:ordering.confirm-order .\n`;
  const r = validateModel([
    { doc: "docs/process/a.ttl", text },
    { doc: "docs/process/b.ttl", text: shared },
  ]);
  const page = (includeRetired) =>
    withoutEngine(
      renderView({ index: r.index, mapping: MAPPING, findings: r.findings, includeRetired }),
    );
  const orderingFlow = (html) =>
    diagrams(sections(html).find((s) => s.id === "process-el-ordering_2e_place-order").body)[0];
  const POLICY = "Request payment for a new order";

  const plain = page(false);
  const [, policy] = nodeLabelled(orderingFlow(plain), POLICY);
  assert.deepEqual([policy.label, policy.classes], [POLICY, ["policy"]]);
  assert.match(
    articleOf(plain, "payment.request-on-order"),
    /^<h3>Policy: Request payment for a new order<\/h3>/,
  );
  assert.ok(!plain.includes("Request the payment"), "the retired step is neither drawn nor listed");

  const all = page(true);
  const flow = orderingFlow(all);
  const [policyNode, stillLive] = nodeLabelled(flow, POLICY);
  assert.deepEqual([stillLive.label, stillLive.classes], [POLICY, ["policy"]]);
  const [stepNode, step] = nodeLabelled(flow, "Request the payment");
  assert.equal(step.label, "Request the payment · Take a payment · retired");
  assert.ok(step.classes.includes("retired"), step.classes.join());
  assert.ok(flow.edges.some((e) => e.from === policyNode && e.to === stepNode));
  assert.match(
    articleOf(all, "payment.request-payment"),
    /^<h3>Step: Request the payment <span class="badge retired">retired<\/span><\/h3>/,
  );
});

test("element details name every model document holding the element's statements, the typing document first", () => {
  const main = EXAMPLE.replace(
    "    pm:emits m:ordering.order-placed ;\n    pm:uses m:ordering.order ;\n",
    "    pm:emits m:ordering.order-placed ;\n",
  );
  assert.notEqual(main, EXAMPLE);
  const split = validateModel([
    {
      doc: "docs/process/a-shared.ttl",
      text: `${HEAD}m:ordering.submit-order pm:uses m:ordering.order .\n`,
    },
    { doc: "docs/process/model.ttl", text: main },
  ]);
  assert.deepEqual(
    split.findings.filter((f) => f.level === "error"),
    [],
  );
  const html = renderView({ index: split.index, mapping: MAPPING, findings: split.findings });
  assert.match(
    articleOf(html, "ordering.submit-order"),
    /<span>Model document<\/span> <code>docs\/process\/model\.ttl:102<\/code>, <code>docs\/process\/a-shared\.ttl:5<\/code><\/p>/,
  );
});

test("unavailable change flags are shown with their reason", () => {
  const changes = { available: false, reason: "the committed model cannot be parsed" };
  const html = renderView({ index: v.index, mapping: MAPPING, findings: v.findings, changes });
  assert.match(
    html,
    /<section class="changes" id="changes-unavailable"><h2>Change flags unavailable<\/h2><p>Uncommitted model edits and unsynced edits of Accepted processes could not be determined, so none are marked: the committed model cannot be parsed<\/p>/,
  );
  const ko = renderView({
    index: v.index,
    mapping: MAPPING,
    findings: v.findings,
    changes,
    lang: "ko",
  });
  assert.match(
    ko,
    /<h2>변경 표시를 확인할 수 없음<\/h2><p>[^<]+: the committed model cannot be parsed<\/p>/,
  );
});

test("lifecycle edits and edits history cannot show are marked like the queries mark them", () => {
  const lifecycleEdits = new Map([
    [
      "payment.take-payment",
      [
        {
          element: "payment.take-payment",
          msg: "became Accepted while the alignment gates did not hold",
        },
      ],
    ],
  ]);
  const uncertain = new Map([["ordering.place-order", "the clone is shallow"]]);
  const changes = flagsWith({ uncertain, lifecycleEdits });
  const html = withoutEngine(
    renderView({ index: v.index, mapping: MAPPING, findings: v.findings, changes }),
  );
  assert.match(
    html,
    /Lifecycle edit ADR Writer&#39;s transitions do not explain[^<]*— <a href="#el-payment_2e_take-payment">payment\.take-payment<\/a>: became Accepted while the alignment gates did not hold/,
  );
  assert.match(
    html,
    /Edits since it became Accepted are unknown — <a href="#el-ordering_2e_place-order">ordering\.place-order<\/a>: the clone is shallow/,
  );
  // A lifecycle edit marks its process changed where it is drawn and headed.
  const flowHeading = (page, id) =>
    /<h2>[\s\S]*?<\/h2>/.exec(sections(page).find((x) => decodeAnchor(x.id) === id).body)[0];
  assert.match(flowHeading(html, "payment.take-payment"), /badge changed">changed</);
  const partial = withoutEngine(
    renderView({
      index: v.index,
      mapping: MAPPING,
      findings: v.findings,
      changes: {
        ...changes,
        uncertain: new Map(),
        lifecycleEdits: new Map(),
        history: { available: false, reason: "partial clone" },
        uncommitted: new Set(["customer"]),
      },
    }),
  );
  assert.match(partial, /<h2>Committed-edit flags unavailable<\/h2>/);
  assert.match(
    partial,
    /Edits of Accepted processes since they became Accepted could not be determined; treat those processes as possibly edited directly:/,
  );
  assert.match(
    partial,
    /Uncommitted edits in the working tree: <a href="#el-customer">customer<\/a>/,
  );
});

test("a realization the index cannot be trusted for is shown as undeterminable, never as a state", () => {
  // A realizing ADR whose body Status differs from its index record: only the steps
  // that feature realizes are affected.
  const mismatch = {
    level: "error",
    code: "process-adr-status-mismatch",
    where: "docs/adr/checkout/0001-a.md",
    element: null,
    category: "checkout",
    msg: "realizing ADR's Status differs from its index record",
  };
  const html = withoutEngine(
    renderView({ index: v.index, mapping: MAPPING, findings: [...v.findings, mismatch] }),
  );
  const submit = articleOf(html, "ordering.submit-order");
  assert.match(submit, UNKNOWN);
  assert.doesNotMatch(
    submit,
    /Accepted \(2020-01-01\)|>implemented</,
    "no recorded Status as settled",
  );
  assert.match(articleOf(html, "ordering.confirm-order"), /not implemented/);
  const flow = sections(html).find((s) => decodeAnchor(s.id) === "ordering.place-order");
  assert.match(flow.body, /class="incomplete"[\s\S]*process-adr-status-mismatch/);
  // A link record that is not a list of step ids could link any step.
  const shape = { ...mismatch, code: "process-link-shape", where: "docs/adr/.mapping.json" };
  const unreadable = withoutEngine(
    renderView({ index: v.index, mapping: MAPPING, findings: [...v.findings, shape] }),
  );
  for (const id of ["ordering.submit-order", "ordering.confirm-order", "payment.request-payment"])
    assert.match(articleOf(unreadable, id), UNKNOWN, id);
  assert.match(
    articleOf(unreadable, "payment.capture-payment"),
    /outside the system — not realized by a feature/,
  );
  assert.doesNotMatch(unreadable, /no realizing feature/);
});

test("the flow heading carries the process's change mark, and unknown edits are marked apart from changes", () => {
  const changed = withoutEngine(
    renderView({
      index: v.index,
      mapping: MAPPING,
      findings: v.findings,
      changes: flagsWith({
        unsynced: new Map([["payment.take-payment", new Set(["payment.capture-payment"])]]),
      }),
    }),
  );
  const heading = (html, id) =>
    /<h2>[\s\S]*?<\/h2>/.exec(sections(html).find((s) => decodeAnchor(s.id) === id).body)[0];
  assert.match(heading(changed, "payment.take-payment"), /badge changed/);
  assert.doesNotMatch(heading(changed, "ordering.place-order"), /badge changed|badge uncertain/);
  const unknown = withoutEngine(
    renderView({
      index: v.index,
      mapping: MAPPING,
      findings: v.findings,
      changes: flagsWith({
        uncertain: new Map([["ordering.place-order", "the clone is shallow"]]),
      }),
    }),
  );
  assert.match(heading(unknown, "ordering.place-order"), /badge uncertain">edits unknown</);
  assert.doesNotMatch(heading(unknown, "ordering.place-order"), /badge changed/);
  const [landscape] = diagrams(landscapeOf(unknown));
  const place = [...landscape.nodes.values()].find((n) => n.label.startsWith("Place an order"));
  assert.match(place.label, /· edits unknown/);
  assert.doesNotMatch(place.label, /· changed/);
});

test("a lifecycle edit of a hidden retired process leaves no empty change section", () => {
  const retired = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Deprecated (2020-01-20)" ;\n    pm:hasStep m:payment',
  );
  const r = validateModel([{ doc: "docs/process/example.ttl", text: retired }]);
  const changes = flagsWith({
    head: r.index,
    lifecycleEdits: new Map([
      [
        "payment.take-payment",
        [
          {
            element: "payment.take-payment",
            msg: "Deprecated is final; its lifecycle attributes never change",
          },
        ],
      ],
    ]),
  });
  const view = (includeRetired) =>
    withoutEngine(
      renderView({
        index: r.index,
        mapping: MAPPING,
        findings: r.findings,
        changes,
        includeRetired,
      }),
    );
  assert.doesNotMatch(view(false), /<section class="changes" id="changes">/);
  assert.match(view(true), /<section class="changes" id="changes">[\s\S]*Deprecated is final/);
});
