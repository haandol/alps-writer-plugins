import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { areaBoard } from "./eventstorming-landscape-fixture.mjs";
import { BOARD } from "./eventstorming-fixture.mjs";
import { eventLandscape } from "../scripts/eventstorming-landscape.mjs";
import {
  eventBoardPage,
  modelEventBoard,
  validateEventBoard,
} from "../scripts/eventstorming-board.mjs";
import { validateModel } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";

test("a domain groups sourced subdomains while shared and equal-named contexts keep their identities", () => {
  const board = areaBoard(),
    before = JSON.stringify(board),
    area = eventLandscape(board);
  assert.deepEqual(validateEventBoard(board), []);
  assert.equal(area.contexts.length, 5);
  assert.equal(area.contexts.filter((c) => c.name === "Ordering").length, 2);
  const membership = (key) => area.groups.find((g) => g.key === key).contexts.map((c) => c.id);
  assert.deepEqual(membership("subdomain:0"), ["ordering"]);
  assert.deepEqual(membership("subdomain:1"), ["payment", "partner"]);
  assert.deepEqual(membership("shared:"), ["reconciliation"]);
  assert.deepEqual(membership("unassigned:"), ["other-ordering"]);
  assert.deepEqual(
    area.contexts.find((c) => c.id === "reconciliation").memberships.map((g) => g.name),
    ["Sales", "Finance"],
  );
  assert.equal(area.groups.flatMap((g) => g.contexts).length, area.contexts.length);
  assert.deepEqual(area.links.flatMap((l) => l.links.map((r) => r.index)).sort(), [0, 1, 2, 3]);
  assert.equal(JSON.stringify(board), before);
});

test("legacy labels, unknown boundaries and external actors do not invent membership or external contexts", () => {
  const board = structuredClone(BOARD);
  board.stages[0].contextId = null;
  const area = eventLandscape(board);
  assert.equal(
    area.groups[0].contexts.length,
    0,
    "Matching the subdomain's label is not membership evidence",
  );
  assert.equal(
    area.groups.find((g) => g.kind === "unassigned").contexts.length,
    area.contexts.length,
  );
  assert.equal(
    area.contexts.some((c) => c.external),
    false,
  );
  assert.equal(area.contexts.find((c) => c.key === "unknown:").verdict, "unconfirmed");
  const source = readFileSync(
    new URL("../templates/ontology/example.ttl", import.meta.url),
    "utf8",
  );
  const { index } = validateModel([{ doc: "example.ttl", text: source }]);
  const model = modelEventBoard({ index, mapping: { categories: {} } });
  assert.deepEqual(validateEventBoard(model), []);
  assert.equal(model.domain, undefined);
  assert.deepEqual(model.subdomains, []);
  assert.ok(model.stages.every((s) => s.views === undefined));
  assert.ok(eventLandscape(model).contexts.every((c) => !c.external && c.memberships.length === 0));
});

test("view roles and context memberships reject invalid identity references without requiring screens or human actors", () => {
  const cases = [
    (b) => b.subdomains[0].contextIds.push("missing"),
    (b) => b.subdomains[0].contextIds.push("ordering"),
    (b) => (b.subdomains[0].classification = "important"),
    (b) => b.contexts.push({ ...b.contexts[0] }),
    (b) => (b.contexts[0].name = "Different name"),
    (b) => (b.contexts[0].external = "true"),
    (b) => (b.stages[0].views[0].role = "triggers"),
    (b) => (b.stages[0].views = [null]),
    (b) => (b.subdomains = [null]),
    (b) => (b.domain = null),
  ];
  for (const mutate of cases) {
    const board = areaBoard();
    mutate(board);
    assert.ok(validateEventBoard(board).length);
    assert.throws(() => eventBoardPage(board));
  }
  const board = areaBoard();
  board.stages[0].actor = null;
  board.stages[0].views = [];
  board.stages[0].event = null;
  assert.deepEqual(validateEventBoard(board), []);
  assert.match(eventBoardPage(board), /Performer unconfirmed/);
});

test("area and view source text stays inert and missing evidence never gains a confirmed classification", () => {
  const board = areaBoard();
  const text = '<img src=x onerror="alert(1)"></script>';
  board.domain.name = text;
  board.contexts[2].description = text;
  board.subdomains[0].name = text;
  board.subdomains[0].evidence = [];
  board.stages[0].views[0].name = text;
  board.stages[0].views[0].evidence = [];
  const html = eventBoardPage(board);
  assert.ok(!html.includes("<img src=x") && !html.includes('</script>\"'));
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /class="land-region land-unconfirmed"/);
  assert.match(html, /story-view-verdict">Unconfirmed/);
  assert.match(html, /No source location · unconfirmed/);
});

test("context-level sequence and missing-source-event links retain their meaning without an animated reaction", () => {
  const board = areaBoard();
  board.links = [{ ...board.links[0], relation: "sequence" }, board.links[1]];
  board.stages.find((s) => s.id === "pay").event = null;
  const area = eventLandscape(board);
  assert.deepEqual(
    area.links.map((l) => [l.relation, l.animated]),
    [
      ["sequence", false],
      ["causal", false],
    ],
  );
  assert.equal(area.links[0].links[0].sourceAction, "Submit order");
  assert.equal(area.links[1].links[0].event, undefined);
});

test("invalid model context identities remain visible as validation errors without preventing the view from opening", () => {
  const source = readFileSync(
    new URL("../templates/ontology/example.ttl", import.meta.url),
    "utf8",
  );
  const model = validateModel([
    {
      doc: "example.ttl",
      text:
        source +
        '\n<https://external.invalid/context> a onto:BoundedContext ; rdfs:label "Untrusted context" ; onto:definition "Invalid namespace" .\n',
    },
  ]);
  assert.ok(model.findings.some((f) => f.code === "ontology-element-iri"));
  const html = renderView({ ...model, mapping: { categories: {} } });
  assert.match(html, /ontology-element-iri/);
  const board = modelEventBoard({ ...model, mapping: { categories: {} } });
  assert.deepEqual(validateEventBoard(board), []);
  assert.ok(board.contexts.every((c) => c.id !== null));
  const emptyLabel = validateModel([
    { doc: "example.ttl", text: source.replace('rdfs:label "Ordering"', 'rdfs:label ""') },
  ]);
  assert.doesNotThrow(() => renderView({ ...emptyLabel, mapping: { categories: {} } }));
  const namedById = modelEventBoard({ ...emptyLabel, mapping: { categories: {} } });
  assert.equal(namedById.contexts.find((c) => c.id === "ordering").name, "ordering");
  assert.ok(
    namedById.stages
      .filter((s) => s.contextId === "ordering")
      .every((s) => s.context === "ordering"),
  );
});
