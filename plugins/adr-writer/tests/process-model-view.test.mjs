// Read-only process views: landscape, process
// flows and element details from the same model reading as validation and
// queries, with realization computed from the ADR index at generation time.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MODEL,
  PM,
  RDFS,
  RELATIONS,
  elementId,
  elementIri,
  validateModel,
} from "../scripts/process-model-lib.mjs";
import { inFlowOrder, queryContext } from "../scripts/process-model-query.mjs";
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
  anchorOf,
  viewData,
  treeGroups,
  documentOf,
  manyProcesses,
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
  const markup = PAGE.replace(/<script\b[\s\S]*?<\/script>/g, "");
  assert.ok(!/<form|contenteditable|<textarea|<select/i.test(markup), "no editing control");
  // The one input finds elements; it changes nothing.
  assert.deepEqual(
    [...markup.matchAll(/<input\b[^>]*>/gi)].map((m) => /type="search"/.test(m[0])),
    [true],
  );
  // The page's own scripts: all but the vendored engine and the data they read.
  const own = [...HTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/data-mermaid-engine|application\/json/.test(attrs))
    .map(([, attrs, code]) => `<script${attrs}>${code}`)
    .join("\n");
  assert.match(own, /<script data-view-explorer>/);
  assert.match(own, /<script data-view-navigation>/);
  assert.doesNotMatch(own, /createElement\("(?:input|textarea|select|form)"|contentEditable\s*=/);
  assert.doesNotMatch(
    own,
    /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|showSaveFilePicker/,
  );
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
      inFlowOrder(q.steps).map((x) => x.step.id),
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
  // No step anywhere on the page is shown as having no realizing feature.
  assert.doesNotMatch(documentOf(unreadable), /no realizing feature/);
  assert.doesNotMatch(
    treeGroups(unreadable)
      .map((g) => g.chunk)
      .join(""),
    /state-unrealized/,
  );
  assert.ok(viewData(unreadable).elements.every((e) => e.s !== "unrealized"));
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

// ── The explorer (R18), relations in the details (R19) and the 3D business city (R20) ──

/** A step of "Place an order" in the payment context, after submitting the order. */
const CROSS_CONTEXT = `${HEAD}m:ordering.check-funds a pm:Step ;
    rdfs:label "Check the funds" ;
    pm:definition "The payment provider checks that the card has the funds." ;
    pm:stepKind "outside-system" ;
    pm:inContext m:payment .
m:ordering.place-order pm:hasStep m:ordering.check-funds .
m:ordering.submit-order pm:flowsTo m:ordering.check-funds .
m:payment-provider pm:performs m:ordering.check-funds .
`;

test("the explorer finds every element by name and identifier and lists it under the bounded context it names, a process's steps in flow order (R18)", () => {
  const model = validateModel([
    { doc: "docs/process/a.ttl", text: EXAMPLE },
    { doc: "docs/process/b.ttl", text: CROSS_CONTEXT },
  ]);
  const html = withoutEngine(
    renderView({ index: model.index, mapping: MAPPING, findings: model.findings }),
  );
  const { elements } = viewData(html);
  const targets = new Set(
    [...html.matchAll(/<(?:article class="element"|section class="process") id="([^"]+)"/g)].map(
      (m) => m[1],
    ),
  );
  const shown = [...model.index.subjects.keys()].filter((iri) => model.index.typeOf(iri));
  // Every element is found by its name and its identifier and leads to its details, or a
  // process to its flow.
  assert.deepEqual(elements.map((e) => e.k).sort(), shown.map(elementId).sort());
  for (const e of elements) {
    const label = model.index.literal(elementIri(e.k), `${RDFS}label`)[0]?.value;
    assert.equal(e.n, label ?? e.k, e.k);
    assert.ok(targets.has(e.h), `${e.k} leads to ${e.h}`);
  }
  const groups = treeGroups(html);
  const under = (href) => groups.filter((g) => g.links.includes(href)).map((g) => g.head);
  for (const iri of shown) {
    const id = elementId(iri);
    const type = model.index.typeOf(iri);
    const contexts = model.index.out(iri, "inContext").map((c) => anchorOf(elementId(c)));
    if (type === "BoundedContext") assert.deepEqual(under(anchorOf(id)), [anchorOf(id)], id);
    else if (contexts.length)
      for (const c of contexts) assert.ok(under(anchorOf(id)).includes(c), `${id} under ${c}`);
    else if (type !== "Process") assert.deepEqual(under(anchorOf(id)), [null], `${id} apart`);
  }
  // A process stands under every context of its steps, each time with all its steps in flow
  // order, and a step of another context names its own.
  const flow = `process-${anchorOf("ordering.place-order")}`;
  assert.deepEqual(under(flow), [anchorOf("ordering"), anchorOf("payment")]);
  const q = queryContext({
    index: model.index,
    mapping: MAPPING,
    findings: model.findings,
    target: { kind: "process", id: "ordering.place-order" },
  });
  const order = inFlowOrder(q.steps).map((c) => anchorOf(c.step.id));
  assert.deepEqual(
    order,
    ["ordering.submit-order", "ordering.check-funds", "ordering.confirm-order"].map(anchorOf),
  );
  for (const g of groups.filter((x) => x.links.includes(flow))) {
    const rest = g.chunk.slice(g.chunk.indexOf(`href="#${flow}"`));
    const steps = [...rest.slice(0, rest.indexOf("</ol>")).matchAll(/<a href="#([^"]+)"/g)];
    assert.deepEqual(
      steps.map((m) => m[1]),
      order,
      g.head,
    );
  }
  assert.match(
    groups.find((g) => g.head === anchorOf("ordering")).chunk,
    /Check the funds<span class="sr"> — outside the system<\/span><\/a> <span class="where">Payment<\/span>/,
  );
});

test("element details list every relation with its name and direction, each leading to the other element's details (R19)", () => {
  const html = withoutEngine(HTML);
  for (const iri of [...v.index.subjects.keys()].filter((x) => v.index.typeOf(x))) {
    const id = elementId(iri);
    const listed = [...articleOf(html, id).matchAll(/<li>(\w+) (to|from) <a href="#([^"]+)">/g)];
    const expected = RELATIONS.flatMap((r) => [
      ...v.index.out(iri, r.key).map((x) => `${r.key} to ${elementId(x)}`),
      ...v.index.into(iri, r.key).map((x) => `${r.key} from ${elementId(x)}`),
    ]);
    assert.deepEqual(
      listed.map((m) => `${m[1]} ${m[2]} ${decodeAnchor(m[3])}`).sort(),
      expected.sort(),
      id,
    );
    for (const m of listed) assert.ok(articleOf(html, decodeAnchor(m[3])), `${id} → ${m[3]}`);
  }
});

/** A trigger inside "Place an order": a placed order goes on to its own confirmation. */
const INNER_TRIGGER = `${HEAD}m:ordering.confirm-when-placed a pm:Policy ;
    rdfs:label "Confirm when placed" ;
    pm:definition "A placed order goes on to its confirmation." ;
    pm:reactionCondition "The order is placed." ;
    pm:basisKind "operating-policy" ;
    pm:basis "Store policy." ;
    pm:starts m:ordering.confirm-order ;
    pm:inContext m:ordering .
m:ordering.order-placed pm:triggers m:ordering.confirm-when-placed .
`;

test("the city holds every process with its steps in flow order and their realization, and every hand-off between processes (R20)", () => {
  const { elements, city } = viewData(PAGE);
  assert.deepEqual(
    city.towers.map((t) => elements[t.i].h).sort(),
    sections(PAGE)
      .map((s) => s.id)
      .sort(),
  );
  for (const t of city.towers) {
    const id = elements[t.i].k;
    const q = queryContext({
      index: v.index,
      mapping: MAPPING,
      findings: v.findings,
      target: { kind: "process", id },
    });
    assert.deepEqual(
      t.f.map((i) => elements[i].k),
      inFlowOrder(q.steps).map((c) => c.step.id),
      id,
    );
    for (const i of t.f) {
      const { k, s } = elements[i];
      assert.equal(s, realizationOf(v.index, MAPPING, elementIri(k)).state, k);
      assert.match(articleOf(PAGE, k), new RegExp(`<p class="state-${s}">`), k);
    }
  }
  // Each connection between processes in the landscape is a hand-off: the event beside a
  // floor of the emitting process, an arc to the policy, the policy beside a floor it starts.
  const landscape = landscapeOf(PAGE);
  const listed = landscape.slice(
    landscape.indexOf("<h3>Connections between processes</h3>"),
    landscape.indexOf("<h3>Bounded contexts</h3>"),
  );
  const placed = [...listed.matchAll(/<li>(.*?)<\/li>/g)].map((m) =>
    [...m[1].matchAll(/href="#([^"]+)"/g)].map((x) => decodeAnchor(x[1])),
  );
  assert.equal(placed.length, 2);
  const at = new Map(elements.map((e, i) => [e.k, i]));
  const tower = (id) => city.towers.find((t) => elements[t.i].k === id);
  for (const [from, event, policy, to] of placed) {
    assert.ok(
      city.links.some(([e, p, kind]) => e === at.get(event) && p === at.get(policy) && kind === 1),
      `${event} → ${policy}`,
    );
    const e = city.events.find((x) => x.i === at.get(event));
    const p = city.policies.find((x) => x.i === at.get(policy));
    assert.ok(
      e.from.some((s) => tower(from).f.includes(s)),
      `${event} beside ${from}`,
    );
    assert.ok(
      p.to.some((s) => tower(to).f.includes(s)),
      `${policy} beside ${to}`,
    );
  }
  // Every arc is a trigger the event's details list; only the landscape's connections cross.
  for (const [e, p, kind] of city.links) {
    assert.match(
      articleOf(PAGE, elements[e].k),
      new RegExp(`<li>triggers to <a href="#${anchorOf(elements[p].k)}">`),
    );
    const across = placed.some(([, ev, po]) => ev === elements[e].k && po === elements[p].k);
    assert.equal(kind === 1, across, `${elements[e].k} → ${elements[p].k}`);
  }
  // A trigger inside one process is drawn, but not as a hand-off between processes.
  const inner = validateModel([
    { doc: "docs/process/a.ttl", text: EXAMPLE },
    { doc: "docs/process/b.ttl", text: INNER_TRIGGER },
  ]);
  const d = viewData(
    renderView({ index: inner.index, mapping: MAPPING, findings: inner.findings }),
  );
  const of = (id) => d.elements.findIndex((e) => e.k === id);
  const kinds = (event) =>
    Object.fromEntries(
      d.city.links.filter(([e]) => e === of(event)).map(([, p, kind]) => [d.elements[p].k, kind]),
    );
  assert.deepEqual(kinds("ordering.order-placed"), {
    "ordering.confirm-when-placed": 0,
    "payment.request-on-order": 1,
  });
  // Who emits each event and what each policy starts, as the relations say.
  const ids = (list) => list.map((i) => elements[i].k).sort();
  for (const e of city.events)
    assert.deepEqual(
      ids(e.from),
      v.index.into(elementIri(elements[e.i].k), "emits").map(elementId).sort(),
    );
  for (const p of city.policies)
    assert.deepEqual(
      ids(p.to),
      v.index.out(elementIri(elements[p.i].k), "starts").map(elementId).sort(),
    );
});

test("the city leaves retired processes out unless asked, and marks incomplete, changed and retired ones as the document does (R20)", () => {
  const towersOf = (html) => {
    const { elements, city } = viewData(html);
    return new Map(city.towers.map((t) => [elements[t.i].k, elements[t.i].m ?? 0]));
  };
  const text = EXAMPLE.replace(
    'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    'pm:status "Deprecated (2020-01-20)" ;\n    pm:hasStep m:payment',
  );
  const r = validateModel([{ doc: "d.ttl", text }]);
  const plain = renderView({ index: r.index, mapping: MAPPING, findings: r.findings });
  assert.deepEqual([...towersOf(plain).keys()], ["ordering.place-order"]);
  const all = renderView({
    index: r.index,
    mapping: MAPPING,
    findings: r.findings,
    includeRetired: true,
  });
  assert.equal(towersOf(all).get("payment.take-payment") & 1, 1);
  // A process validation errors reach is incomplete in the city as in its flow.
  const broken = validateModel([
    { doc: "docs/process/a.ttl", text: EXAMPLE },
    { doc: "docs/process/b.ttl", text: `${HEAD}m:ordering.submit-order pm:emits m:ghost .\n` },
  ]);
  const html = withoutEngine(
    renderView({ index: broken.index, mapping: MAPPING, findings: broken.findings }),
  );
  const marks = towersOf(html);
  for (const s of sections(html))
    assert.equal(
      Boolean(marks.get(decodeAnchor(s.id)) & 8),
      s.body.includes('class="incomplete"'),
      s.id,
    );
  assert.ok(marks.get("ordering.place-order") & 8);
  const changes = flagsWith({ uncommitted: new Set(["ordering.submit-order"]) });
  const changed = viewData(
    renderView({ index: v.index, mapping: MAPPING, findings: v.findings, changes }),
  );
  assert.equal(changed.elements.find((e) => e.k === "ordering.submit-order").m & 2, 2);
});

test("model text cannot end the page's data or scripts, and the same model renders the same page", () => {
  const sly = "Place </script><script>alert(1)</script><!-- an order";
  const r = validateModel([
    {
      doc: "docs/process/a.ttl",
      text: EXAMPLE.replace('rdfs:label "Place an order"', `rdfs:label "${sly}"`),
    },
  ]);
  const html = renderView({ index: r.index, mapping: MAPPING, findings: r.findings });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.equal(viewData(html).elements.find((e) => e.k === "ordering.place-order").n, sly);
  assert.equal(renderView({ index: v.index, mapping: MAPPING, findings: v.findings }), HTML);
});

test("a large landscape is drawn on request with its source closed, while a small one and the flows are drawn as they come near", () => {
  assert.doesNotMatch(landscapeOf(PAGE), /data-draw=/);
  const model = validateModel([
    { doc: "docs/process/a.ttl", text: EXAMPLE },
    { doc: "docs/process/b.ttl", text: manyProcesses(70) },
  ]);
  const html = withoutEngine(
    renderView({ index: model.index, mapping: MAPPING, findings: model.findings }),
  );
  const landscape = landscapeOf(html);
  assert.match(landscape, /<figure data-targets="[^"]*" data-draw="on-request" /);
  assert.match(
    landscape,
    /<figcaption class="diagram-status" role="status">This landscape is large[^<]*<button type="button" class="diagram-draw">Draw the landscape<\/button><\/figcaption>/,
  );
  assert.match(landscape, /<details class="diagram-source">/);
  assert.ok(sections(html).length > 70);
  for (const s of sections(html)) assert.doesNotMatch(s.body, /data-draw=/, s.id);
});

test("element details sit in groups of at most 40, so the browser follows few of them to skip their layout", () => {
  const model = validateModel([
    { doc: "docs/process/a.ttl", text: EXAMPLE },
    { doc: "docs/process/b.ttl", text: manyProcesses(30) },
  ]);
  const html = withoutEngine(
    renderView({ index: model.index, mapping: MAPPING, findings: model.findings }),
  );
  const elements = html.slice(html.indexOf('<section id="elements">'));
  const groups = elements.split('<div class="element-group">').slice(1);
  const counts = groups.map((g) => (g.match(/<article class="element" /g) ?? []).length);
  assert.ok(groups.length > 1, `${groups.length} groups`);
  assert.ok(
    counts.every((n) => n > 0 && n <= 40),
    counts.join(),
  );
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    (elements.match(/<article class="element" /g) ?? []).length,
  );
});
