import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MODEL,
  contextCollaborations,
  indexGraph,
  knowledgeLayerFindings,
  parseTurtle,
  serializeTurtle,
  validateModel,
} from "../scripts/ontology-lib.mjs";
import { impactSummary } from "../scripts/ontology-align.mjs";
import { queryContext, renderContext } from "../scripts/ontology-query.mjs";
import { EXAMPLE } from "./ontology-helpers.mjs";
import { HEAD, MAPPING } from "./ontology-query-helpers.mjs";

const mapping = {
  categories: { ordering: MAPPING.categories.ordering, payments: MAPPING.categories.payments },
};
const model = (text = EXAMPLE, options = {}) =>
  validateModel([{ doc: "model.ttl", text }], options);
function query(target, { text = EXAMPLE, extra = [], ...options } = {}) {
  const v = model(text);
  return queryContext({
    index: v.index,
    mapping,
    findings: [...v.findings, ...extra],
    target,
    ...options,
  });
}
function allPages(target, options = {}) {
  let r = query(target, options);
  const pages = [r];
  while (r.next) {
    r = query(r.next.target, { ...options, ...r.next });
    pages.push(r);
  }
  return { pages, items: pages.flatMap((p) => p.items) };
}

/** Extra internal work in an existing BC; it must never inflate the BC-only layer. */
function manySteps(count) {
  let out = EXAMPLE;
  for (let i = 0; i < count; i++)
    out += `
m:ordering.internal-${i} a onto:Step ; rdfs:label "Internal task ${i}" ;
  onto:definition "Quarantine the parcel marker ${i}." ; onto:stepKind "system" ; onto:inContext m:ordering .
m:ordering.place-order onto:hasStep m:ordering.internal-${i} .
m:customer onto:performs m:ordering.internal-${i} .
`;
  return out;
}

test("the authored BC layer contains responsibilities, core logic and symmetric collaboration only", () => {
  const r = query({ kind: "overview" });
  assert.equal(r.complete, true);
  assert.equal(r.knowledgeLayerComplete, true);
  assert.equal(r.page.nextOffset, null);
  assert.deepEqual(
    r.items.map((i) => i.kind),
    ["context", "context", "collaboration"],
  );
  assert.deepEqual(
    r.items.filter((i) => i.kind === "context").map((i) => i.id),
    ["ordering", "payment"],
  );
  assert.match(r.items[0].coreLogic, /confirmed after the matching payment completes/);
  assert.deepEqual([r.items[2].from.id, r.items[2].to.id], ["ordering", "payment"]);
  assert.doesNotMatch(JSON.stringify(r.items), /order-placed|confirm-on-payment|0001-confirm/);
  const reversed = EXAMPLE + "\nm:payment onto:collaboratesWith m:ordering .\n";
  assert.deepEqual(query({ kind: "overview" }, { text: reversed }).items, r.items);
});

test("hundreds of internal steps do not change or enlarge the top-level business knowledge", () => {
  const small = query({ kind: "overview" });
  const large = query({ kind: "overview" }, { text: manySteps(300) });
  assert.deepEqual(large.items, small.items);
  assert.equal(Buffer.byteLength(JSON.stringify(large)), Buffer.byteLength(JSON.stringify(small)));
  const internal = query({ kind: "context", id: "ordering" }, { text: manySteps(300) });
  assert.equal(internal.items.length, 20);
  assert.ok(internal.page.total > 600);
  assert.equal(internal.page.nextOffset, 20);
});

test("the whole BC layer is returned by default even when it contains more than one context page", () => {
  let text = EXAMPLE;
  for (let i = 0; i < 25; i++)
    text += `\nm:c${i} a onto:BoundedContext ; rdfs:label "BC ${i}" ; onto:definition "Responsibility ${i}." ; onto:coreLogic "Business outcome ${i}." .\n`;
  const r = query({ kind: "overview" }, { text });
  assert.equal(r.contextCount, 27);
  assert.equal(r.items.filter((i) => i.kind === "context").length, 27);
  assert.equal(r.next, null);
  const paged = allPages({ kind: "overview" }, { text, limit: 3 });
  assert.deepEqual(paged.items, r.items);
});

test("an internal search finds the BC first, then its actual knowledge without leaking other BC internals", () => {
  const text = manySteps(3);
  const top = query({ kind: "overview" }, { text, search: "QUARANTINE" });
  const contexts = top.items.filter((i) => i.kind === "context");
  assert.deepEqual(
    contexts.map((i) => i.id),
    ["ordering"],
  );
  assert.equal(contexts[0].matchingElements, 3);
  assert.deepEqual(contexts[0].query, { kind: "context", id: "ordering", search: "QUARANTINE" });
  assert.doesNotMatch(JSON.stringify(top.items), /internal-0|Quarantine the parcel/);
  const inside = allPages(
    { kind: "context", id: "ordering" },
    { text, search: "quarantine", limit: 2 },
  );
  assert.equal(inside.items.filter((i) => i.kind === "element").length, 3);
  assert.ok(inside.items.some((i) => i.definition?.includes("Quarantine the parcel marker 0")));
  assert.ok(inside.pages.every((p) => p.items.length <= 2));
  const absent = query({ kind: "context", id: "ordering" }, { search: "no-such-business" });
  assert.equal(absent.page.total, 0);
  assert.equal(absent.found, true);
  assert.match(absent.note, /no match is not evidence/);
});

test("BC navigation keeps internal actors, policies, rules, criteria and external hand-offs accessible", () => {
  const { items } = allPages({ kind: "context", id: "ordering" }, { limit: 5 });
  const types = new Set(items.filter((i) => i.kind === "element").map((i) => i.type));
  for (const type of [
    "Process",
    "Step",
    "Actor",
    "BusinessEvent",
    "Policy",
    "BusinessConcept",
    "BusinessRule",
    "ObservationCriterion",
  ])
    assert.ok(types.has(type), type);
  assert.ok(items.some((i) => i.kind === "open-scope" && /payment fails/.test(i.value)));
  assert.ok(items.some((i) => i.kind === "neighbor" && i.id === "payment"));
  assert.ok(items.some((i) => i.kind === "relation" && i.relation === "triggers" && i.external));
  assert.ok(items.some((i) => i.kind === "relation" && i.relation === "flowsTo"));
  assert.ok(!items.some((i) => i.kind === "element" && i.id === "payment.request-payment"));
  const rule = items.find((i) => i.kind === "element" && i.type === "BusinessRule");
  assert.equal(rule.basis, "Store accounting policy.");
});

test("a process crossing BCs retains participation and exposes external step references without their details", () => {
  const text = EXAMPLE.replace(
    "onto:emits m:ordering.order-confirmed ;\n    onto:uses m:ordering.order ;\n    onto:inContext m:ordering",
    "onto:emits m:ordering.order-confirmed ;\n    onto:uses m:ordering.order ;\n    onto:inContext m:payment",
  );
  const { items } = allPages({ kind: "context", id: "ordering" }, { text });
  const process = items.find((i) => i.id === "ordering.place-order");
  assert.match(process.participation, /not exclusive ownership/);
  assert.ok(
    items.some(
      (i) =>
        i.kind === "relation" &&
        i.relation === "hasStep" &&
        i.to.id === "ordering.confirm-order" &&
        i.external,
    ),
  );
  assert.ok(!items.some((i) => i.kind === "element" && i.id === "ordering.confirm-order"));
});

test("paging is deterministic and lossless across equivalent document ordering", () => {
  const target = { kind: "context", id: "ordering" };
  const unpaged = query(target, { limit: 100 });
  const { pages, items } = allPages(target, { limit: 3 });
  assert.deepEqual(items, unpaged.items);
  assert.equal(new Set(items.map((i) => i.key)).size, items.length);
  assert.ok(pages.every((p) => p.navigationOnly));
  const reversed = serializeTurtle([...parseTurtle(EXAMPLE).triples].reverse());
  assert.deepEqual(query(target, { text: reversed, limit: 100 }), unpaged);
});

test("step detail is reachable from a BC and preserves actors, event context and realizing ADRs", () => {
  const { items } = allPages({ kind: "context", id: "ordering" });
  const link = items.find((i) => i.id === "ordering.confirm-order").query;
  assert.deepEqual(link, { kind: "step", id: "ordering.confirm-order" });
  const r = query(link);
  assert.equal(r.steps[0].context.id, "ordering");
  assert.equal(r.steps[0].performers[0].id, "order-system");
  assert.equal(r.steps[0].startedBy[0].events[0].id, "payment.payment-completed");
  assert.equal(r.steps[0].step.realizedBy[0].adrs[0].path, "docs/adr/ordering/0001-confirm.md");
  assert.match(renderContext(r), /performed by: order-system/);
});

test("retired internal work is excluded and its explicit inclusion survives pagination", () => {
  const text = EXAMPLE.replaceAll(
    'onto:status "Proposed"',
    'onto:status "Deprecated (2026-01-01)"',
  );
  const hidden = allPages({ kind: "context", id: "ordering" }, { text });
  assert.ok(
    !hidden.items.some((i) => i.type === "Step" || i.type === "Process" || i.type === "Policy"),
  );
  assert.equal(query({ kind: "step", id: "ordering.confirm-order" }, { text }).found, false);
  const included = allPages(
    { kind: "context", id: "ordering" },
    { text, includeRetired: true, limit: 2 },
  );
  assert.ok(included.pages[0].next.includeRetired);
  assert.ok(included.items.some((i) => i.type === "Process" && i.retired));
  const step = query(
    { kind: "step", id: "ordering.confirm-order" },
    { text, includeRetired: true },
  );
  assert.equal(step.steps[0].step.process.retired, true);
});

test("off-page validation failures affect the whole selected scope and keep their original positions", () => {
  const extra = Array.from({ length: 30 }, (_, i) => ({
    level: "error",
    code: "ontology-test-error",
    where: `model.ttl:${i + 1}`,
    element: "ordering.confirm-order",
    msg: `Bad rule ${i}`,
  }));
  const { pages, items } = allPages({ kind: "context", id: "ordering" }, { extra, limit: 3 });
  assert.ok(pages.every((p) => !p.complete && p.errorCount === 30 && p.items.length <= 3));
  assert.deepEqual(
    items.filter((i) => i.flag === "validation-error").map((i) => i.error),
    extra,
  );
  assert.match(renderContext(pages.at(-1)), /INCOMPLETE/);
  const broken = query({ kind: "overview" }, { text: "bad Turtle" });
  assert.equal(broken.found, null);
  assert.equal(broken.complete, false);
  assert.ok(broken.errorCount > 0);
  assert.match(broken.validationSample[0].where, /model\.ttl:/);
});

test("malformed BC membership cannot recurse forever or pass as a valid scope", () => {
  const text = EXAMPLE + "\nm:ordering.place-order onto:hasStep m:ordering.place-order .\n";
  const r = query({ kind: "overview" }, { text, search: "Place an order" });
  assert.equal(r.complete, false);
  assert.ok(r.errorCount > 0);
  assert.equal(query({ kind: "context", id: "ghost" }).found, false);
  const wrongType = query(
    { kind: "context", id: "ordering" },
    { text: EXAMPLE + "\nm:ordering a onto:Step .\n" },
  );
  assert.equal(wrongType.found, null);
  assert.equal(wrongType.complete, false);
});

test("large change sets stay aggregate at BC level and individually accessible in bounded internal pages", () => {
  const changes = {
    available: true,
    history: { available: true },
    head: null,
    baseline: new Map(),
    uncommitted: new Set(["ordering.confirm-order"]),
    uncommittedKinds: new Map([["ordering.confirm-order", "changed"]]),
    unsynced: new Map(),
    unsyncedKinds: new Map(),
    compositionChanged: new Set(),
    lifecycleEdits: new Map([
      [
        "ordering.place-order",
        Array.from({ length: 35 }, (_, i) => ({ msg: `Unconfirmed lifecycle change ${i}` })),
      ],
    ]),
    uncertain: new Map(),
  };
  const overview = query({ kind: "overview" }, { changes });
  assert.equal(overview.changeSummary.uncommittedElements, 1);
  assert.equal(overview.changeSummary.lifecycleEdits, 1);
  assert.doesNotMatch(JSON.stringify(overview.items), /confirm-order|lifecycle change/);
  const { items, pages } = allPages({ kind: "context", id: "ordering" }, { changes, limit: 4 });
  assert.ok(pages.every((p) => p.items.length <= 4));
  assert.equal(items.filter((i) => i.flag === "lifecycle-edit").length, 35);
  assert.ok(items.some((i) => i.flag === "uncommitted" && i.id === "ordering.confirm-order"));
});

test("legacy knowledge is readable but missing upper facts never become generated facts or a construction pass", () => {
  const legacy = EXAMPLE.replace(/\s*onto:coreLogic "[^"]*"\s*[;.]/g, (s) =>
    s.endsWith(".") ? "." : "",
  ).replace(/;\s*\./g, ".");
  const v = model(legacy);
  assert.equal(v.ok, true);
  assert.equal(v.findings.filter((f) => f.code === "ontology-layer-core-missing").length, 2);
  assert.equal(model(legacy, { requireKnowledgeLayers: true }).ok, false);
  const r = query({ kind: "overview" }, { text: legacy });
  assert.equal(r.knowledgeLayerComplete, false);
  assert.ok(
    r.items
      .filter((i) => i.kind === "context")
      .every((i) => i.coreLogic === null && !i.knowledgeComplete),
  );
});

test("construction catches missing collaboration, invalid endpoints and a missing requested BC", () => {
  const missing = EXAMPLE.replace(";\n    onto:collaboratesWith m:payment", "");
  const v = model(missing, { requireKnowledgeLayers: true });
  assert.equal(v.ok, false);
  assert.deepEqual(
    v.findings.filter((f) => f.code === "ontology-layer-link-missing").map((f) => f.element),
    ["ordering", "payment"],
  );
  assert.ok(
    model(EXAMPLE + "\nm:ordering onto:collaboratesWith m:ordering .\n").findings.some(
      (f) => f.code === "ontology-context-collaboration",
    ),
  );
  assert.ok(
    model(EXAMPLE + "\nm:ordering onto:collaboratesWith m:ordering.order .\n").findings.some(
      (f) => f.code === "ontology-relation-target",
    ),
  );
  assert.ok(
    knowledgeLayerFindings(model().index, { requiredContexts: new Set([MODEL + "ghost"]) }).some(
      (f) => f.level === "error" && f.element === "ghost",
    ),
  );
  assert.deepEqual(contextCollaborations(model().index), [[MODEL + "ordering", MODEL + "payment"]]);
});

test("a scoped extension checks new BC knowledge without silently demanding changes to unrelated legacy BCs", () => {
  const old = `${HEAD}m:legacy a onto:BoundedContext ; rdfs:label "Legacy" ; onto:definition "Existing responsibility." .\n`;
  const next = EXAMPLE + old;
  const before = new Set([MODEL + "legacy"]);
  assert.equal(model(next, { previousContexts: before }).ok, true);
  assert.equal(model(next, { requireKnowledgeLayers: true }).ok, false);
  assert.equal(
    model(next, { requiredContexts: new Set([MODEL + "ordering", MODEL + "payment"]) }).ok,
    true,
  );
  const unlayeredNew =
    next + '\nm:new a onto:BoundedContext ; rdfs:label "New" ; onto:definition "New work." .\n';
  assert.ok(
    model(unlayeredNew, { previousContexts: before }).findings.some(
      (f) => f.level === "error" && f.element === "new",
    ),
  );
});

test("upper core logic and collaboration changes reach the affected processes and realizing features", () => {
  const text = EXAMPLE.replaceAll('onto:status "Proposed"', 'onto:status "Accepted (2020-01-01)"');
  const before = model(text).index;
  const after = model(
    text.replace(
      "An order asks for payment and is confirmed after the matching payment completes.",
      "An order is reviewed by staff before it can be confirmed.",
    ),
  ).index;
  const changed = impactSummary({ before, after, mapping, glossary: null });
  assert.ok(changed.processesToPropose.includes("ordering.place-order"));
  assert.ok(!changed.processesToPropose.includes("payment.take-payment"));
  assert.ok(changed.affectedAdrs.includes("docs/adr/ordering/0001-confirm.md"));
  assert.ok(
    changed.majorChangeCandidates.some(
      (c) => c.id === "ordering" && c.properties.includes("onto:coreLogic"),
    ),
  );
  const responsibility = model(
    text.replace(
      "Taking a customer's purchase request and confirming it.",
      "Reviewing purchase requests for staff approval.",
    ),
  ).index;
  assert.deepEqual(
    impactSummary({ before, after: responsibility, mapping, glossary: null }).processesToPropose,
    ["ordering.place-order"],
  );
  const removed = indexGraph(before.triples.filter((t) => !t.p.endsWith("collaboratesWith")));
  const disconnected = impactSummary({ before, after: removed, mapping, glossary: null });
  assert.deepEqual(disconnected.processesToPropose, [
    "ordering.place-order",
    "payment.take-payment",
  ]);
  assert.ok(
    disconnected.majorChangeCandidates.some(
      (c) => c.id === "ordering" && c.properties.includes("onto:collaboratesWith"),
    ),
  );
});

test("navigation rejects invalid page sizes and offsets rather than silently skipping knowledge", () => {
  for (const options of [
    { limit: 0 },
    { limit: 101 },
    { offset: -1 },
    { offset: 0.5 },
    { limit: NaN },
  ])
    assert.throws(() => query({ kind: "context", id: "ordering" }, options), /must be/);
});
