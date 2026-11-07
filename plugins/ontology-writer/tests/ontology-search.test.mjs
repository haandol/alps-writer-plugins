import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateModel } from "../scripts/ontology-lib.mjs";
import { ontologySearchUnits } from "../scripts/ontology-search.mjs";
import { queryContext } from "../scripts/ontology-query.mjs";
import { searchWithSqlite } from "../scripts/search/search-index.mjs";
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

test("SQLite and in-memory navigation return identical ranked pages and scope diagnostics", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ontology-search-"));
  try {
    const model = make();
    for (const query of [
      "확정 결제",
      "parcel quarantine",
      "operating-policy",
      '"quarantine parcel"',
    ]) {
      const hits = await searchWithSqlite(ontologySearchUnits(model.index), query, {
        root: dir,
        namespace: "business",
        cacheDir: path.join(dir, "cache"),
      });
      const searchHits = new Map(hits.map((hit) => [hit.id, hit]));
      assert.deepEqual(
        invoke(model, query, { searchHits, limit: 2 }),
        invoke(model, query, { limit: 2 }),
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test("a nonmatching invalid element cannot disappear from the search scope diagnostics", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ontology-search-"));
  try {
    const model = make(
      EXAMPLE +
        EXTRA +
        '\nm:ordering.broken a onto:Step ; rdfs:label "Broken" ; onto:definition "Unrelated work." ; onto:inContext m:ordering .\n',
    );
    const searchHits = new Map(
      (
        await searchWithSqlite(ontologySearchUnits(model.index), "확정", {
          root: dir,
          namespace: "business",
          cacheDir: path.join(dir, "cache"),
        })
      ).map((hit) => [hit.id, hit]),
    );
    const r = invoke(model, "확정", { searchHits, limit: 1 });
    assert.equal(r.complete, false);
    assert.ok(r.errorCount > 0);
    assert.equal(r.items[0].kind, "diagnostic");
    assert.ok(r.next);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
