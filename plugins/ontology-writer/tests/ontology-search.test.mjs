import assert from "node:assert/strict";
import { test } from "node:test";
import { validateModel } from "../scripts/ontology-lib.mjs";
import { queryContext } from "../scripts/ontology-query.mjs";
import { EXAMPLE } from "./ontology-helpers.mjs";
import { MAPPING } from "./ontology-query-helpers.mjs";

const EXTRA =
  '\nm:ordering.search-case a onto:Step ; rdfs:label "Search example" ; onto:definition "결제가 완료되면 주문을 확정한다. Quarantine the parcel marker." ; onto:stepKind "system" ; onto:inContext m:ordering .\nm:ordering.place-order onto:hasStep m:ordering.search-case .\nm:customer onto:performs m:ordering.search-case .\n';
const make = (text = EXAMPLE + EXTRA) => validateModel([{ doc: "model.ttl", text }]);
const invoke = (model, search, options = {}) =>
  queryContext({
    index: model.index,
    findings: model.findings,
    mapping: MAPPING,
    target: { kind: "context", id: "ordering" },
    search,
    limit: 100,
    ...options,
  });

test("business search matches reordered words and short Korean while preserving quoted phrases and sources", () => {
  const model = make();
  for (const query of ["parcel quarantine", "확정 결제", "결"]) {
    const r = invoke(model, query);
    assert.equal(r.complete, true);
    const row = r.items.find((i) => i.id === "ordering.search-case");
    assert.ok(row, query);
    const field = row.searchMatch.matches.find((m) => m.field === "definition");
    assert.equal(field.source.path, "model.ttl");
    assert.ok(field.source.lineStart > 0);
  }
  assert.equal(invoke(model, '"quarantine parcel"').itemCount, 0);
});

test("search is computed from the graph it is given: repeated pages agree and an edit shows at once", () => {
  const model = make();
  for (const query of [
    "확정 결제",
    "parcel quarantine",
    "operating-policy",
    '"quarantine parcel"',
  ]) {
    assert.deepEqual(invoke(model, query, { limit: 2 }), invoke(model, query, { limit: 2 }));
  }
  const edited = make(
    EXAMPLE + EXTRA.replace("결제가 완료되면 주문을 확정한다.", "환불을 확인한다."),
  );
  assert.ok(invoke(edited, "환불").items.some((i) => i.id === "ordering.search-case"));
  assert.ok(!invoke(edited, "확정 결제").items.some((i) => i.id === "ordering.search-case"));
});

test("global text discovery returns BCs without internal identifiers or matched field excerpts", () => {
  const r = invoke(make(), "확정 결제", { target: { kind: "overview" } });
  assert.equal(r.complete, true);
  assert.deepEqual(
    r.items.filter((i) => i.kind === "context").map((i) => i.id),
    ["ordering"],
  );
  const text = JSON.stringify(r.items);
  assert.doesNotMatch(text, /search-case|Quarantine|결제가|model\.ttl/);
  assert.equal(r.items.find((i) => i.kind === "context").searchMatch.kind, "internal");
});

test("a nonmatching invalid element cannot disappear from the search scope diagnostics", () => {
  const model = make(
    EXAMPLE +
      EXTRA +
      '\nm:ordering.broken a onto:Step ; rdfs:label "Broken" ; onto:definition "Unrelated work." ; onto:inContext m:ordering .\n',
  );
  const r = invoke(model, "확정", { limit: 1 });
  assert.equal(r.complete, false);
  assert.ok(r.errorCount > 0);
  assert.equal(r.items[0].kind, "diagnostic");
  assert.ok(r.next);
});

test("retired text stays opt-in and current model-only descriptions do not become searchable facts", () => {
  const model = make(
    EXAMPLE.replace('rdfs:label "Take a payment"', 'rdfs:label "Retired unique marker"')
      .replace(
        'onto:status "Proposed" ;\n    onto:hasStep m:payment.capture-payment',
        'onto:status "Deprecated (2020-01-01)" ;\n    onto:hasStep m:payment.capture-payment',
      )
      .replace("From order submission to order confirmation.", "description-only-marker"),
  );
  assert.equal(invoke(model, "retired unique").itemCount, 0);
  assert.ok(
    invoke(model, "retired unique", {
      includeRetired: true,
      target: { kind: "context", id: "payment" },
    }).itemCount > 0,
  );
  assert.equal(invoke(model, "description-only-marker").itemCount, 0);
});

test("a whole-model search lists every BC whose own view holds the matching rule", () => {
  const head =
    "@prefix m: <urn:ontology-writer:model:> .\n@prefix onto: <urn:ontology-writer:vocabulary:> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n";
  const cases = [
    // A rule on an Ordering concept that also constrains Payment's concept.
    `${head}m:ordering.line-limit a onto:BusinessRule ; rdfs:label "Line quantity cap" ;
  onto:definition "Zebra marker applies to each order line." ; onto:basisKind "operating-policy" ;
  onto:basis "Warehouse handling policy." ; onto:constrains m:ordering.order-line, m:payment.payment .
`,
    // A rule on an Ordering policy that starts a Payment step.
    `${head}m:ordering.notify-payment a onto:Policy ; rdfs:label "Notify payment" ;
  onto:definition "Ordering asks payment to start." ; onto:reactionCondition "An order exists." ;
  onto:basisKind "operating-policy" ; onto:basis "Store policy." ; onto:inContext m:ordering ;
  onto:starts m:payment.request-payment .
m:ordering.order-placed onto:triggers m:ordering.notify-payment .
m:ordering.notify-rule a onto:BusinessRule ; rdfs:label "Notification wording" ;
  onto:definition "Zebra phrase governs the ordering notification policy." ; onto:basisKind "operating-policy" ;
  onto:basis "Store policy." ; onto:constrains m:ordering.notify-payment, m:payment.capture-payment .
`,
  ];
  for (const extra of cases) {
    const model = validateModel([
      { doc: "model.ttl", text: EXAMPLE },
      { doc: "extra.ttl", text: extra },
    ]);
    assert.deepEqual(
      model.findings.filter((f) => f.level === "error"),
      [],
    );
    const query = (target) =>
      queryContext({
        index: model.index,
        mapping: MAPPING,
        findings: model.findings,
        target,
        search: "zebra",
      });
    const candidates = query({ kind: "overview" })
      .items.filter((i) => i.kind === "context")
      .map((i) => i.id)
      .sort();
    const holding = ["ordering", "payment"].filter((bc) =>
      query({ kind: "context", id: bc }).items.some(
        (i) => i.kind === "element" && i.type === "BusinessRule",
      ),
    );
    assert.deepEqual(
      candidates,
      holding,
      "the overview's candidates are the BCs whose views list the rule",
    );
    assert.ok(candidates.includes("ordering"));
  }
});
