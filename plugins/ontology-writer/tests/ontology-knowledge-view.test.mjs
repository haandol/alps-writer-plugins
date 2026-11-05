import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTurtle, serializeTurtle, validateModel } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";
import { EXAMPLE } from "./ontology-helpers.mjs";
import { MAPPING } from "./ontology-query-helpers.mjs";

function view(text = EXAMPLE) {
  const v = validateModel([{ doc: "model.ttl", text }]);
  const html = renderView({ index: v.index, findings: v.findings, mapping: MAPPING });
  const data = JSON.parse(
    html.match(/<script type="application\/json" id="knowledge-data">([\s\S]*?)<\/script>/)[1],
  );
  return { html, data };
}

test("the model view starts with authored BC knowledge and leaves whole-workflow initialization deferred", () => {
  const { html, data } = view();
  assert.match(html, /data-knowledge-level="contexts"/);
  assert.match(html, /<section id="whole-workspace" hidden>/);
  assert.match(html, /window\.ontologyInitializeLegacy/);
  assert.deepEqual(
    data.contexts.map((c) => c.id),
    ["ordering", "payment"],
  );
  assert.deepEqual(data.collaborations, [["ordering", "payment"]]);
  assert.match(data.contexts[0].coreLogic, /matching payment completes/);
  const initial = html.slice(
    html.indexOf('<main id="knowledge-workspace"'),
    html.indexOf('<section id="whole-workspace"'),
  );
  assert.ok(!initial.includes("ordering.confirm-order"));
  assert.ok(!initial.includes("payment.request-payment"));
});

test("BC membership contains its internal work and shared knowledge, with external BC entry points", () => {
  const { data } = view();
  assert.ok(data.scopes.ordering.members.includes("ordering.confirm-order"));
  assert.ok(!data.scopes.ordering.members.includes("payment.request-payment"));
  assert.ok(data.scopes.ordering.members.includes("payment.amount-matches-order"));
  assert.ok(data.scopes.ordering.neighbors.includes("payment"));
  assert.deepEqual(data.elements["payment.request-payment"].contexts, ["payment"]);
  assert.deepEqual(data.elements["payment.amount-matches-order"].contexts, ["ordering", "payment"]);
  assert.equal(data.elements["payment.amount-matches-order"].shared, true);
  assert.equal(data.elements["ordering.confirm-order"].shared, false);
  assert.ok(
    data.elements["ordering.confirm-order"].adrs.some(
      (a) => a.path === "docs/adr/ordering/0001-confirm.md",
    ),
  );
});

test("missing authored core logic stays missing and visible as incomplete knowledge", () => {
  const text = serializeTurtle(
    parseTurtle(EXAMPLE).triples.filter((t) => !t.p.endsWith("coreLogic")),
  );
  const { data, html } = view(text);
  assert.ok(data.contexts.every((c) => !c.complete && c.coreLogic === null));
  assert.match(html, /Core business logic has not been recorded/);
  assert.ok(data.scopes.ordering.issues.some((f) => f.code === "ontology-layer-core-missing"));
});

test("equal labels and prototype-like identifiers remain separate BC identities", () => {
  const text =
    EXAMPLE +
    `
m:constructor a onto:BoundedContext ; rdfs:label "Ordering" ; onto:definition "Another business." ; onto:coreLogic "A request receives a response." .
m:__proto__ a onto:BoundedContext ; rdfs:label "Prototype work" ; onto:definition "A distinct context." ; onto:coreLogic "A request receives a result." .
`;
  const { data } = view(text);
  assert.equal(data.contexts.filter((c) => c.name === "Ordering").length, 2);
  assert.ok(Object.hasOwn(data.scopes, "constructor"));
  assert.ok(Object.hasOwn(data.scopes, "__proto__"));
  assert.deepEqual(data.scopes.__proto__.members, []);
});

test("model text cannot escape a BC card or the embedded knowledge data", () => {
  const dangerous = '</script><img src=x onerror="globalThis.knowledgeExecuted=1">';
  const text = EXAMPLE.replace('rdfs:label "Ordering"', `rdfs:label ${JSON.stringify(dangerous)}`);
  const { html, data } = view(text);
  assert.equal(data.contexts.find((c) => c.id === "ordering").name, dangerous);
  assert.ok(!html.includes(dangerous));
  assert.match(html, /&lt;\/script&gt;&lt;img/);
});
