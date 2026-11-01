// Business process model library: vocabulary, Turtle subset, closed-world
// validation, canonical form and semantic diff.
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ATTRIBUTES,
  BASIS_KINDS,
  CLASSES,
  MODEL,
  PM,
  RDF,
  RDFS,
  RELATIONS,
  STEP_KINDS,
  checkRealizes,
  diffGraphs,
  glossaryOverlap,
  indexGraph,
  modelReferenceHits,
  openScopeOf,
  parseTurtle,
  ruleReach,
  sameMeaningKeys,
  serializeTurtle,
  unionGraph,
  validateModel,
} from "../scripts/process-model-lib.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const EXAMPLE = read("../templates/process/example.ttl");
const VOCABULARY = read("../templates/process/vocabulary.ttl");
const HEAD = `@prefix m: <${MODEL}> .\n@prefix pm: <${PM}> .\n@prefix rdfs: <${RDFS}> .\n\n`;

const validate = (...texts) =>
  validateModel(texts.map((text, i) => ({ doc: `docs/process/doc${i}.ttl`, text })));
const codes = (result) => result.findings.map((f) => f.code);
const errorsFor = (result, code) =>
  result.findings.filter((f) => f.level === "error" && f.code === code);
/** The example model with one statement replaced, removed or appended. */
const edit = (from, to) => {
  assert.ok(EXAMPLE.includes(from), `fixture edit target missing: ${from}`);
  return EXAMPLE.replace(from, to);
};

test("the vocabulary publishes exactly the ADR's nine types, fourteen relations and attribute families", () => {
  const vocab = indexGraph(parseTurtle(VOCABULARY, "vocabulary.ttl").triples);
  const ofType = (type) =>
    [...vocab.subjects.values()]
      .filter((n) => n.types.includes(type))
      .map((n) => n.iri)
      .sort();
  const ko = (iri) => vocab.literal(iri, `${RDFS}label`).find((l) => l.lang === "ko")?.value;

  assert.deepEqual(ofType(`${RDFS}Class`), CLASSES.map((c) => PM + c.key).sort());
  assert.deepEqual(
    CLASSES.map((c) => ko(PM + c.key)),
    [
      "행위자",
      "바운디드 컨텍스트",
      "업무 개념",
      "업무 사건",
      "프로세스",
      "단계",
      "정책",
      "업무 규칙",
      "관찰 기준",
    ],
  );
  assert.deepEqual(
    RELATIONS.map((r) => ko(PM + r.key)),
    [
      "포함",
      "흐름",
      "수행",
      "발생",
      "촉발",
      "시작",
      "사용",
      "제약",
      "구성",
      "참조",
      "대응",
      "컨텍스트 소속",
      "기준 소속",
      "경유",
    ],
  );
  const family = (kind) => ATTRIBUTES.filter((a) => a.kind === kind).map((a) => a.ko);
  assert.deepEqual(family("fact"), [
    "이름",
    "정의",
    "단계 구분",
    "반응 조건",
    "근거 종류",
    "근거",
    "시작 조건",
    "업무 결과",
    "관찰 결과",
    "미정 범위",
  ]);
  assert.deepEqual(family("description"), ["한 줄 요약", "메모"]);
  assert.deepEqual(family("lifecycle"), ["Status", "대체 대상"]);
  for (const a of ATTRIBUTES.filter((a) => a.iri.startsWith(PM)))
    assert.equal(ko(a.iri), a.ko, `${a.key} label`);

  // Every vocabulary property is a relation or an attribute, and nothing else.
  assert.deepEqual(
    ofType(`${RDF}Property`),
    [
      ...RELATIONS.map((r) => PM + r.key),
      ...ATTRIBUTES.filter((a) => a.iri.startsWith(PM)).map((a) => a.iri),
    ].sort(),
  );
});

test("a relation declares domain and range only when both ends accept one element type", () => {
  const vocab = indexGraph(parseTurtle(VOCABULARY, "vocabulary.ttl").triples);
  for (const r of RELATIONS) {
    const iri = PM + r.key;
    const domain = vocab.subjects.get(iri).props.get(`${RDFS}domain`) ?? [];
    const range = vocab.subjects.get(iri).props.get(`${RDFS}range`) ?? [];
    const single = r.from.length === 1 && r.to.length === 1;
    assert.equal(domain.length, single ? 1 : 0, `${r.key} domain`);
    assert.equal(range.length, single ? 1 : 0, `${r.key} range`);
    if (domain.length) assert.equal(domain[0].o.value, PM + r.from[0]);
    if (range.length) assert.equal(range[0].o.value, PM + r.to[0]);
  }
  for (const a of ATTRIBUTES.filter((a) => a.iri.startsWith(PM))) {
    const domain = vocab.subjects.get(a.iri).props.get(`${RDFS}domain`) ?? [];
    assert.equal(domain.length, a.on.length === 1 ? 1 : 0, `${a.key} domain`);
  }
});

test("RDFS inference over a valid model infers no element type the model does not declare", () => {
  const vocab = indexGraph(parseTurtle(VOCABULARY, "vocabulary.ttl").triples);
  const model = indexGraph(parseTurtle(EXAMPLE, "example.ttl").triples);
  const declared = new Map([...model.subjects.values()].map((n) => [n.iri, new Set(n.types)]));
  const inferred = [];
  for (const t of model.triples) {
    const prop = vocab.subjects.get(t.p);
    if (!prop) continue;
    for (const d of prop.props.get(`${RDFS}domain`) ?? [])
      if (!declared.get(t.s)?.has(d.o.value)) inferred.push(`${t.s} a ${d.o.value}`);
    for (const r of prop.props.get(`${RDFS}range`) ?? [])
      if (t.o.type === "iri" && !declared.get(t.o.value)?.has(r.o.value))
        inferred.push(`${t.o.value} a ${r.o.value}`);
  }
  assert.deepEqual(inferred, []);
});

test("the example model uses every element type and relation, validates and is canonical", () => {
  const result = validate(EXAMPLE);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.deepEqual(result.findings, []);
  const index = result.index;
  for (const c of CLASSES) assert.ok(index.ofType(c.key).length > 0, c.key);
  for (const r of RELATIONS)
    assert.ok(
      index.triples.some((t) => t.p === PM + r.key),
      r.key,
    );
  assert.equal(serializeTurtle(parseTurtle(EXAMPLE).triples), EXAMPLE);
});

test("unsupported Turtle is a positioned failure and the model is not validated", () => {
  const cases = [
    ['m:a pm:uses [ rdfs:label "x" ] .', "process-blank-node"],
    ["_:b a pm:Actor .", "process-blank-node"],
    ["m:a pm:uses ( m:b ) .", "process-collection"],
    ["@base <urn:x:> .", "process-base"],
    ["m:a a <relative> .", "process-relative-iri"],
    ["m:a a nope:Step .", "process-unknown-prefix"],
    ['m:a rdfs:label "open', "process-parse"],
    ["m:a a pm:Actor", "process-parse"],
  ];
  for (const [statement, code] of cases) {
    const result = validate(EXAMPLE, `${HEAD}${statement}\n`);
    assert.equal(result.ok, false, statement);
    const error = result.findings.find((f) => f.code === code);
    assert.ok(error, `${statement}: expected ${code}, got ${codes(result)}`);
    assert.match(error.where, /^docs\/process\/doc1\.ttl:[56]:\d+$/, statement);
    assert.ok(codes(result).includes("process-not-validated"), statement);
    assert.equal(result.index, null, "graph checks never run on a partial model");
  }
});

test("only vocabulary classes and properties plus rdf:type, rdfs:label and rdfs:comment are allowed", () => {
  const ok = validate(
    edit(
      'rdfs:label "Customer" ;',
      'rdfs:label "Customer" ;\n    rdfs:comment "Note for people." ;',
    ),
  );
  assert.equal(ok.ok, true);
  for (const [statement, code] of [
    ['m:customer <urn:other:prop> "x" .', "process-unknown-term"],
    ["m:customer rdfs:seeAlso m:ordering .", "process-unknown-term"],
    ['m:extra a <urn:other:Thing> ; rdfs:label "x" .', "process-unknown-term"],
    ['m:extra a <http://www.w3.org/2002/07/owl#Class> ; rdfs:label "x" .', "process-owl"],
    ["m:customer <http://www.w3.org/2002/07/owl#sameAs> m:order-system .", "process-owl"],
    [`m:customer <${RDF}subject> m:ordering .`, "process-unknown-term"],
    ['m:customer pm:definition "x"^^pm:Unknown .', "process-unknown-term"],
  ]) {
    const result = validate(EXAMPLE, `${HEAD}${statement}\n`);
    assert.ok(errorsFor(result, code).length, `${statement}: ${codes(result)}`);
    assert.equal(result.ok, false);
  }
});

test("every element has a model identifier and exactly one of the nine types", () => {
  assert.ok(
    errorsFor(validate(EXAMPLE, `${HEAD}m:loose rdfs:label "x" .\n`), "process-type-missing")
      .length,
  );
  assert.ok(
    errorsFor(validate(EXAMPLE, `${HEAD}m:customer a pm:Step .\n`), "process-type-multiple").length,
    "one identifier cannot name two element types",
  );
  assert.ok(
    errorsFor(
      validate(EXAMPLE, `${HEAD}<urn:other:x> a pm:Actor ; rdfs:label "x" ; pm:definition "y" .\n`),
      "process-element-iri",
    ).length,
  );
});

test("relation ends follow the relation table and exist in the model", () => {
  assert.ok(
    errorsFor(
      validate(
        edit(
          "    pm:triggers m:payment.request-on-order ;",
          "    pm:starts m:payment.request-on-order ;",
        ),
      ),
      "process-relation-source",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:customer pm:performs m:ordering.order .\n`),
      "process-relation-target",
    ).length,
    "an actor performs steps, not concepts",
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:customer pm:performs m:ghost .\n`),
      "process-relation-dangling",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:customer pm:performs "Submit" .\n`),
      "process-relation-target",
    ).length,
  );
});

test("required attributes per type, single values, text values and enumerations", () => {
  const missing = [
    ['rdfs:label "Customer" ;\n', "Actor without a name"],
    [
      '    pm:definition "A person who buys products from the store." ;\n',
      "Actor without a definition",
    ],
    [
      '    pm:stepKind "system" ;\n    pm:emits m:ordering.order-confirmed',
      "Step without a step kind",
    ],
    [
      '    pm:reactionCondition "The order has no payment yet." ;\n',
      "Policy without a reaction condition",
    ],
    [
      '    pm:basisKind "operating-policy" ;\n    pm:basis "Store accounting policy." ;\n',
      "Rule without basis kind and basis",
    ],
    [
      '    pm:businessOutcome "The order has a completed payment." ;\n',
      "Process without an outcome",
    ],
    ['    pm:status "Proposed" ;\n    pm:hasStep m:payment', "Process without a Status"],
    [
      '    pm:observedResult "The order shows a completed payment." ;\n',
      "Criterion without an observed result",
    ],
  ];
  for (const [from, label] of missing) {
    const to = from.includes("pm:emits")
      ? "    pm:emits m:ordering.order-confirmed"
      : from.includes("pm:hasStep m:payment")
        ? "    pm:hasStep m:payment"
        : "";
    const result = validate(edit(from, to));
    assert.ok(errorsFor(result, "process-attribute-missing").length, `${label}: ${codes(result)}`);
  }
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:customer rdfs:label "Client" .\n`),
      "process-attribute-multiple",
    ).length,
  );
  assert.ok(
    errorsFor(validate(`${EXAMPLE}\nm:customer pm:summary "x" .\n`), "process-attribute-scope")
      .length,
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:ordering.place-order.confirmed pm:definition "x" .\n`),
      "process-attribute-scope",
    ).length,
    "criteria carry no definition",
  );
  assert.ok(
    errorsFor(
      validate(edit('pm:basisKind "user-decision"', 'pm:basisKind "best-practice"')),
      "process-attribute-enum",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(edit('pm:stepKind "outside-system"', 'pm:stepKind "manual"')),
      "process-attribute-enum",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(
        edit('pm:definition "A person who buys products from the store."', "pm:definition 42"),
      ),
      "process-attribute-value",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(
        edit('pm:definition "A person who buys products from the store."', 'pm:definition " "'),
      ),
      "process-attribute-value",
    ).length,
  );
  for (const kind of ["regulation", "contract", "operating-policy", "user-decision"])
    assert.equal(
      validate(edit('pm:basisKind "user-decision"', `pm:basisKind "${kind}"`)).ok,
      true,
      kind,
    );
});

test("membership counts, performers and process criteria", () => {
  const twoProcesses = validate(
    `${EXAMPLE}\nm:payment.take-payment pm:hasStep m:ordering.submit-order .\n`,
  );
  assert.ok(errorsFor(twoProcesses, "process-membership").some((f) => /2 processes/.test(f.msg)));
  assert.ok(
    errorsFor(
      validate(
        edit("m:order-system a pm:Actor ;", "m:order-system a pm:Actor ;").replace(
          "    pm:performs m:ordering.confirm-order .",
          '    rdfs:comment "no longer performs" .',
        ),
      ),
      "process-membership",
    ).some((f) => /no performing actor/.test(f.msg)),
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:ordering.order pm:inContext m:payment .\n`),
      "process-membership",
    ).some((f) => /2 contexts/.test(f.msg)),
  );
  assert.ok(
    errorsFor(
      validate(
        `${EXAMPLE}\nm:payment.take-payment.completed pm:criterionOf m:ordering.place-order .\n`,
      ),
      "process-membership",
    ).length,
  );
  const noCriterion = edit("    pm:criterionOf m:payment.take-payment ;\n", "");
  assert.ok(
    errorsFor(validate(noCriterion), "process-membership").some((f) =>
      /no observation criterion/.test(f.msg),
    ),
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:payment.request-on-order pm:inContext m:ordering .\n`),
      "process-membership",
    ).some((f) => /^Policy "payment\.request-on-order" belongs to 2 contexts/.test(f.msg)),
    "a policy in two contexts",
  );
  assert.ok(
    errorsFor(
      validate(
        edit(
          "    pm:starts m:payment.request-payment ;\n    pm:inContext m:payment .",
          "    pm:starts m:payment.request-payment .",
        ),
      ),
      "process-membership",
    ).some((f) => /^Policy "payment\.request-on-order" belongs to 0 contexts/.test(f.msg)),
    "a policy in no context",
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:ordering.order-placed pm:inContext m:payment .\n`),
      "process-membership",
    ).some((f) => /^BusinessEvent "ordering\.order-placed" belongs to 2 contexts/.test(f.msg)),
    "an event in two contexts",
  );
  assert.ok(
    errorsFor(
      validate(
        edit(
          '    pm:definition "One product and its quantity inside an order." ;\n    pm:inContext m:ordering .',
          '    pm:definition "One product and its quantity inside an order." .',
        ),
      ),
      "process-membership",
    ).some((f) => /^BusinessConcept "ordering\.order-line" belongs to 0 contexts/.test(f.msg)),
    "a concept in no context",
  );
});

test("policies need a trigger and a started step; correspondence crosses contexts", () => {
  assert.ok(
    errorsFor(
      validate(edit("    pm:triggers m:payment.request-on-order ;\n", "")),
      "process-policy",
    ).some((f) => /no triggering event/.test(f.msg)),
  );
  assert.ok(
    errorsFor(
      validate(edit("    pm:starts m:payment.request-payment ;\n", "")),
      "process-policy",
    ).some((f) => /starts no step/.test(f.msg)),
  );
  const sameContext = validate(
    `${EXAMPLE}\nm:ordering.order pm:correspondsTo m:ordering.buyer .\n`,
  );
  assert.ok(errorsFor(sameContext, "process-correspondence").length);
  assert.equal(validate(EXAMPLE).ok, true, "buyer ↔ payer crosses ordering and payment");
});

test("a business rule reaches at least two steps through any of its four paths", () => {
  const index = validate(EXAMPLE).index;
  assert.deepEqual(ruleReach(index, `${MODEL}payment.amount-matches-order`), [
    `${MODEL}ordering.confirm-order`,
    `${MODEL}ordering.submit-order`,
    `${MODEL}payment.capture-payment`,
    `${MODEL}payment.request-payment`,
  ]);
  const rule = (targets) =>
    `${HEAD}m:r a pm:BusinessRule ; rdfs:label "r" ; pm:definition "d" ; pm:basisKind "contract" ; pm:basis "b" ; pm:constrains ${targets} .\n`;
  assert.ok(
    errorsFor(validate(EXAMPLE, rule("m:ordering.submit-order")), "process-rule-reach").length,
    "one step is inside a single step",
  );
  assert.equal(
    validate(EXAMPLE, rule("m:ordering.submit-order, m:payment.capture-payment")).ok,
    true,
  );
  assert.equal(
    validate(EXAMPLE, rule("m:ordering.place-order")).ok,
    true,
    "a process contributes its steps",
  );
  assert.ok(
    errorsFor(validate(EXAMPLE, rule("m:ordering.confirm-on-payment")), "process-rule-reach")
      .length,
    "a policy contributes the one step it starts",
  );
  assert.equal(
    validate(EXAMPLE, rule("m:ordering.confirm-on-payment, m:payment.request-on-order")).ok,
    true,
  );
  const noTarget = `${HEAD}m:r a pm:BusinessRule ; rdfs:label "r" ; pm:definition "d" ; pm:basisKind "contract" ; pm:basis "b" .\n`;
  assert.ok(
    errorsFor(validate(EXAMPLE, noTarget), "process-rule-reach").some((f) =>
      /constrains nothing/.test(f.msg),
    ),
  );
});

test("flow stays inside one process; processes connect through events and policies", () => {
  const cross = validate(
    `${EXAMPLE}\nm:ordering.submit-order pm:flowsTo m:payment.request-payment .\n`,
  );
  assert.ok(errorsFor(cross, "process-flow-cross").length);
});

test("open scope is required on processes and only open paths keep it open", () => {
  assert.ok(
    errorsFor(
      validate(
        edit('    pm:openScope "Handling an order whose payment fails."^^pm:OpenPath ;\n', ""),
      ),
      "process-attribute-missing",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(
        edit(
          '"Handling an order whose payment fails."^^pm:OpenPath',
          '"Handling an order whose payment fails."',
        ),
      ),
      "process-open-scope",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:ordering.place-order pm:openScope "none"^^pm:NoOpenScope .\n`),
      "process-open-scope",
    ).length,
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:ordering.submit-order pm:openScope "x"^^pm:NotApplicable .\n`),
      "process-open-scope",
    ).length,
  );
  assert.equal(
    validate(
      `${EXAMPLE}\nm:ordering.submit-order pm:openScope "Gift wrapping requests."^^pm:OpenPath .\n`,
    ).ok,
    true,
  );

  const index = validate(EXAMPLE).index;
  assert.equal(openScopeOf(index, `${MODEL}payment.take-payment`).open, true);
  const closed = validate(
    edit(
      '"Handling an order whose payment fails."^^pm:OpenPath',
      '"Exceptions: none in this business."^^pm:NotApplicable',
    ),
  ).index;
  assert.equal(
    openScopeOf(closed, `${MODEL}ordering.place-order`).open,
    false,
    "not-applicable items alone leave no open scope",
  );
  const none = validate(
    edit('"Handling an order whose payment fails."^^pm:OpenPath', '"none"^^pm:NoOpenScope'),
  ).index;
  assert.equal(openScopeOf(none, `${MODEL}ordering.place-order`).open, false);
});

test("the union of documents is the model wherever an element is written", () => {
  const blocks = EXAMPLE.split("\n\n");
  const header = blocks[0];
  const half = Math.ceil(blocks.length / 2);
  const a = [header, ...blocks.slice(1, half)].join("\n\n") + "\n";
  const b = [header, ...blocks.slice(half)].join("\n");
  const whole = validate(EXAMPLE);
  const split = validate(a, b);
  assert.equal(split.ok, whole.ok);
  const shape = (r) =>
    r.findings.map(({ level, code, element, msg }) => ({ level, code, element, msg }));
  assert.deepEqual(shape(split), shape(whole));

  // Moving one invalid element keeps the same finding.
  const bad = `${HEAD}m:extra a pm:Actor ; rdfs:label "Extra" .\n`;
  assert.deepEqual(shape(validate(a, b, bad)), shape(validate(EXAMPLE, bad)));
  assert.equal(
    unionGraph([parseTurtle(EXAMPLE), parseTurtle(EXAMPLE)]).length,
    parseTurtle(EXAMPLE).triples.length,
  );
});

test("the same graph has one canonical text and formatting is not a semantic change", () => {
  const reformatted =
    `PREFIX x: <${MODEL}>\n@prefix p: <${PM}> .\n@prefix rdfs: <${RDFS}> .\n` +
    `# a comment the model does not keep\n` +
    parseTurtle(EXAMPLE)
      .triples.slice()
      .reverse()
      .map(
        (t) =>
          `<${t.s}> <${t.p}> ${t.o.type === "iri" ? `<${t.o.value}>` : `'${t.o.value.replace(/'/g, "\\'")}'${t.o.lang ? `@${t.o.lang}` : t.o.datatype.endsWith("#string") ? "" : `^^<${t.o.datatype}>`}`} .`,
      )
      .join("\n");
  const parsed = parseTurtle(reformatted, "r.ttl");
  assert.deepEqual(parsed.errors, []);
  assert.equal(serializeTurtle(parsed.triples), EXAMPLE);
  assert.equal(diffGraphs(parseTurtle(EXAMPLE).triples, parsed.triples).same, true);

  const commented = validate(`# heading\n${EXAMPLE}`);
  assert.equal(commented.ok, true);
  assert.ok(commented.findings.some((f) => f.level === "warn" && f.code === "process-comment"));
  assert.doesNotMatch(serializeTurtle(parseTurtle(`# heading\n${EXAMPLE}`).triples), /^\s*#/m);

  // The `a` keyword may run straight into a comment, and into a term the model rejects.
  const keyword = EXAMPLE.replace(
    "m:ordering a pm:BoundedContext",
    "m:ordering a# kind\n  pm:BoundedContext",
  );
  assert.notEqual(keyword, EXAMPLE);
  const tight = parseTurtle(keyword, "a.ttl");
  assert.deepEqual(tight.errors, []);
  assert.equal(serializeTurtle(tight.triples), EXAMPLE);
  assert.match(
    parseTurtle(`${HEAD}m:x a[ rdfs:label "y" ] .\n`, "b.ttl").errors[0].message,
    /blank nodes are not allowed/,
  );
});

test("the semantic diff names each change with its attribute family", () => {
  const before = parseTurtle(EXAMPLE).triples;
  const diff = (from, to) => diffGraphs(before, parseTurtle(EXAMPLE.replace(from, to)).triples);
  const summary = diff(
    'pm:summary "From order submission to order confirmation."',
    'pm:summary "Order intake."',
  );
  assert.deepEqual(
    summary.elements.map((e) => [e.id, e.change, e.properties.map((p) => [p.property, p.family])]),
    [["ordering.place-order", "changed", [["pm:summary", "description"]]]],
  );
  const status = diff(
    'pm:status "Proposed" ;\n    pm:hasStep m:ordering',
    'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:ordering',
  );
  assert.equal(status.elements[0].properties[0].family, "lifecycle");
  const fact = diff('rdfs:label "Customer"', 'rdfs:label "Shopper"');
  assert.equal(fact.elements[0].properties[0].family, "fact");
  const relation = diffGraphs(
    before,
    parseTurtle(`${EXAMPLE}\nm:customer pm:performs m:ordering.confirm-order .\n`).triples,
  );
  assert.deepEqual(relation.elements[0].properties[0], {
    property: "pm:performs",
    family: "relation",
    added: ["m:ordering.confirm-order"],
    removed: [],
  });
  const added = diffGraphs(
    before,
    parseTurtle(
      `${EXAMPLE}\nm:clerk a pm:Actor ; rdfs:label "Clerk" ; pm:definition "Store staff." .\n`,
    ).triples,
  );
  assert.equal(added.elements[0].change, "added");
});

test("index links point at existing steps; an empty record is not a link", () => {
  const index = validate(EXAMPLE).index;
  const mapping = (realizes) => ({ categories: { "ordering/checkout": { adrs: [], realizes } } });
  assert.deepEqual(checkRealizes(mapping(["ordering.submit-order"]), index), []);
  assert.deepEqual(checkRealizes(mapping([]), index), []);
  assert.deepEqual(
    checkRealizes(mapping([]), null),
    [],
    "a confirmed no-link record needs no model",
  );
  assert.match(checkRealizes(mapping(["ordering.cancel-order"]), index)[0].msg, /not a step/);
  assert.match(
    checkRealizes(mapping(["ordering.order"]), index)[0].msg,
    /not a step/,
    "a concept is not a step",
  );
  const orphan = checkRealizes(mapping(["ordering.submit-order"]), null);
  assert.equal(orphan[0].code, "process-link-dangling");
  assert.match(orphan[0].msg, /ordering\/checkout.*no process model/);
});

test("a realizes item that is not a string is a link-shape error, never skipped", () => {
  const index = validate(EXAMPLE).index;
  for (const item of [5, null, { step: "ordering.submit-order" }]) {
    const findings = checkRealizes(
      {
        categories: {
          "ordering/checkout": { adrs: [], realizes: ["ordering.submit-order", item] },
        },
      },
      index,
    );
    assert.deepEqual(
      findings.map((f) => [f.level, f.code, f.category]),
      [["error", "process-link-shape", "ordering/checkout"]],
      JSON.stringify(item),
    );
    assert.match(findings[0].msg, /which is not a step id/);
  }
});

test("the model never records ADR paths, numbers or category keys and flags code locations and exact values", () => {
  for (const text of [
    "See docs/adr/ordering/0001-x.md",
    "Decided in 0003-refund-window.md",
    "ADR 0003 owns it",
    "Owned by ordering/checkout",
  ]) {
    const r = validateModel(
      [{ doc: "d.ttl", text: edit('"Store accounting policy."', JSON.stringify(text)) }],
      {
        categoryKeys: ["ordering/checkout", "auth"],
      },
    );
    assert.ok(errorsFor(r, "process-adr-reference").length, text);
  }
  const code = validate(edit('"Store accounting policy."', '"See src/billing/amount.ts"'));
  assert.ok(code.findings.some((f) => f.code === "process-technical-detail" && f.level === "warn"));
  const value = validate(
    edit(
      '"The collected amount equals the amount of the order it pays for."',
      '"The payment is collected within 30 days."',
    ),
  );
  assert.ok(value.findings.some((f) => f.code === "process-exact-value" && f.level === "warn"));
  assert.equal(validate(EXAMPLE).findings.length, 0);
});

test("realizing ADR bodies must not cite the model location or element identifiers", () => {
  const index = validate(EXAMPLE).index;
  // An ADR of docs/adr/ordering/, and the model in docs/process/.
  const inModel = (target) => {
    const to = path.posix.normalize(path.posix.join("docs/adr/ordering", target));
    return to === "docs/process" || to.startsWith("docs/process/");
  };
  const hits = (body) => modelReferenceHits(body, index, { inModel }).map((h) => h.text);
  for (const [body, cited] of [
    ["See docs/process/ordering.ttl", ["docs/process"]],
    ["See ./docs/process/ordering.ttl", ["docs/process"]],
    ["[the model](/docs/process/ordering.ttl)", ["docs/process"]],
    ["[the model](../../../docs/process/ordering.ttl)", ["docs/process"]],
    [
      "[the model](https://github.com/acme/shop/blob/main/docs/process/ordering.ttl)",
      ["docs/process"],
    ],
    ["[model]: ../../process/ordering.ttl", ["../../process/ordering.ttl"]],
    ["<../../process/ordering.ttl>", ["../../process/ordering.ttl"]],
    ["[the model](../../process/)", ["../../process/"]],
    // An inline link with an angle-bracket target matches two link forms and is one citation.
    ["[the model](<../../process/ordering.ttl>)", ["../../process/ordering.ttl"]],
    ["[the model](./../../process/ordering.ttl)", ["./../../process/ordering.ttl"]],
    ['<a href="../../process/ordering.ttl">model</a>', ["../../process/ordering.ttl"]],
    [`Realizes <${MODEL}ordering.submit-order>.`, [`${MODEL}ordering.submit-order`]],
    ["Realizes m:ordering.submit-order.", ["m:ordering.submit-order"]],
  ])
    assert.deepEqual(hits(body), cited, body);
  for (const body of [
    "Orders are confirmed after payment.",
    "Use `customer` in code.",
    "[guide](../process-guide.md)",
    "[img](./process/flow.png)",
    // Another process/ folder — in code, or under the ADR's own folder — is not the model.
    "[code](../../src/process/)",
    "[x](process/a.ttl)",
    "[root](../../../process/)",
  ])
    assert.deepEqual(hits(body), [], body);
  assert.deepEqual(
    hits("Item:ordering.submit-order and m:unrelated-thing"),
    [],
    "only identifiers of model elements count",
  );
});

test("glossary terms the model owns are detected for cleanup", () => {
  const index = validate(EXAMPLE).index;
  const glossary =
    "# Glossary\n\n| Term | Meaning in these documents |\n| :--- | --- |\n| Order | a request |\n| Settlement | paying sellers |\n";
  assert.deepEqual(glossaryOverlap(glossary, index), [
    { id: "ordering.order", term: "Order", type: "BusinessConcept" },
  ]);
  assert.deepEqual(
    glossaryOverlap("- **payment** — collecting money\n", index)
      .map((o) => o.type)
      .sort(),
    ["BoundedContext", "BusinessConcept"],
  );
  assert.deepEqual(glossaryOverlap(glossary, null), []);
});

test("escapes must name a Unicode character and IRIs never decode to a forbidden one", () => {
  for (const [statement, message] of [
    ['m:customer pm:summary "x\\U00110000" .', /outside the Unicode range/],
    ['m:customer pm:summary "\\uD800" .', /surrogate/],
    ["<urn:t\\u0020y> a pm:Actor .", /IRIs do not allow/],
  ]) {
    const result = validate(EXAMPLE, `${HEAD}${statement}\n`);
    const error = result.findings.find((f) => f.code === "process-parse");
    assert.ok(error, `${statement}: ${codes(result)}`);
    assert.match(error.msg, message);
    assert.match(error.where, /^docs\/process\/doc1\.ttl:5:\d+$/);
    assert.equal(result.index, null);
  }
  assert.equal(
    validate(edit('rdfs:label "Customer" ;', 'rdfs:label "Customer \\u00e9" ;')).ok,
    true,
    "a valid escape stays valid",
  );
});

test("an element type given as a literal is an error, not ignored", () => {
  const result = validate(
    edit("m:customer a pm:Actor ;", 'm:customer a pm:Actor, "Customer type" ;'),
  );
  assert.ok(errorsFor(result, "process-type-literal").length, codes(result).join());
  assert.equal(result.ok, false);
});

test("the step-kind and basis-kind sets are closed", () => {
  assert.deepEqual(STEP_KINDS, ["system", "outside-system"]);
  assert.deepEqual(BASIS_KINDS, ["regulation", "contract", "operating-policy", "user-decision"]);
  for (const kind of ["law", "hybrid"]) {
    assert.ok(
      errorsFor(
        validate(edit('pm:basisKind "user-decision"', `pm:basisKind "${kind}"`)),
        "process-attribute-enum",
      ).length,
      kind,
    );
    assert.ok(
      errorsFor(
        validate(edit('pm:stepKind "outside-system"', `pm:stepKind "${kind}"`)),
        "process-attribute-enum",
      ).length,
      kind,
    );
  }
});

test("a process needs its start condition and a bounded context its definition", () => {
  const process = EXAMPLE.match(/m:payment\.take-payment a pm:Process ;[\s\S]*?\n\n/)[0];
  const withoutStart = process.replace(/    pm:startCondition "[^"]*" ;\n/, "");
  assert.notEqual(withoutStart, process, "fixture has a start condition");
  assert.ok(
    errorsFor(validate(EXAMPLE.replace(process, withoutStart)), "process-attribute-missing").some(
      (f) => /startCondition|start condition/i.test(f.msg),
    ),
  );
  const context = EXAMPLE.match(/m:payment a pm:BoundedContext ;[\s\S]*?\n\n/)[0];
  const withoutDefinition = context
    .replace(/    pm:definition "[^"]*" ;\n/, "")
    .replace(/ ;\n    pm:definition "[^"]*" \.\n/, " .\n");
  assert.notEqual(withoutDefinition, context, "fixture has a context definition");
  assert.ok(
    errorsFor(validate(EXAMPLE.replace(context, withoutDefinition)), "process-attribute-missing")
      .length,
  );
});

test("relation ends are checked for every relation, including uses and constrains", () => {
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:customer pm:uses m:ordering.order .\n`),
      "process-relation-source",
    ).length,
    "an actor uses no concept",
  );
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:payment.amount-matches-order pm:constrains m:customer .\n`),
      "process-relation-target",
    ).length,
    "a rule does not constrain an actor",
  );
});

test("a step belongs to exactly one bounded context", () => {
  const two = validate(`${EXAMPLE}\nm:payment.request-payment pm:inContext m:ordering .\n`);
  assert.ok(
    errorsFor(two, "process-membership").some((f) =>
      /request-payment" belongs to 2 contexts/.test(f.msg),
    ),
  );
  const none = validate(
    edit(
      "    pm:uses m:payment.payment ;\n    pm:inContext m:payment .",
      "    pm:uses m:payment.payment .",
    ),
  );
  assert.ok(
    errorsFor(none, "process-membership").some((f) => /belongs to 0 contexts/.test(f.msg)),
    codes(none).join(),
  );
});

test("glossary terms are found in every layout the glossary rules allow", () => {
  const model = indexGraph(
    parseTurtle(
      `${EXAMPLE}\nm:ordering.refund a pm:BusinessConcept ; rdfs:label "Refund" ; pm:definition "Money returned to a customer." ; pm:inContext m:ordering .\n` +
        `m:shipping a pm:BoundedContext ; rdfs:label "Shipping" ; pm:definition "Delivering orders to customers." .\n` +
        `m:ordering.hwanbul a pm:BusinessConcept ; rdfs:label "환불" ; pm:definition "구매자에게 돌려주는 돈." ; pm:inContext m:ordering .\n`,
    ).triples,
  );
  const owned = (glossary) => glossaryOverlap(glossary, model).map((g) => g.term);
  for (const glossary of [
    "| Term | Meaning |\n| --- | --- |\n| `Order` | x |",
    "| 용어 | 뜻 |\n| --- | --- |\n| Order (주문) | x |",
    "- **Order:** a request",
    "- **Order** — a request",
    "# Glossary\n\n### Order\n\nA request.",
    "Term | Meaning\n--- | ---\nOrder | x",
  ])
    assert.deepEqual(owned(glossary), ["Order"], glossary);
  assert.deepEqual(owned("The order | is prose, not a table"), []);
  assert.deepEqual(owned("| Term | Meaning |\n| --- | --- |\n| Cart | x |"), []);
  for (const glossary of ["**Refund** — money given back.", "Refund\n: Money given back."])
    assert.deepEqual(owned(glossary), ["Refund"], glossary);

  // Every heading is an entry, whatever its body holds; the entries under it are read too.
  assert.deepEqual(owned("# Glossary\n\n## Refund\n\nMoney returned to a customer."), ["Refund"]);
  for (const definition of [
    "- Money given back to a buyer.",
    "1. Money given back to a buyer.",
    "Money | given back.",
  ])
    assert.deepEqual(owned(`# Glossary\n\n## Refund\n\n${definition}`), ["Refund"], definition);
  assert.deepEqual(owned("# Glossary\n\n### Shipping\n\nDelivering orders to customers."), [
    "Shipping",
  ]);
  assert.deepEqual(owned("# Glossary\n\n## Shipping\n\n- **Parcel**: a box"), ["Shipping"]);
  assert.deepEqual(
    owned("# Glossary\n\n### Shipping\n\n| Term | Meaning |\n| --- | --- |\n| Parcel | a box |"),
    ["Shipping"],
  );
  assert.deepEqual(
    owned("# Glossary\n\n## Order\n\n| Term | Meaning |\n| --- | --- |\n| Settlement | paying |"),
    ["Order"],
  );

  // A term a list item or paragraph starts with, plain, italic or in a code span,
  // before a colon or a dash; numbered items, setext headings and HTML lists too.
  for (const glossary of [
    "- Refund: Money given back.",
    "Refund: Money given back.",
    "1. **Refund**: money given back",
    "1. Refund: money given back",
    "- *Refund*: money given back",
    "_Refund_ — money given back",
    "- `Refund`: money given back",
    "- Refund — money given back",
    "- Refund - money given back",
    "Refund\n\n: Money given back.",
    "| # | Term | Meaning |\n| --- | --- | --- |\n| 1 | Refund | money |",
    "<dl><dt>Refund</dt><dd>money given back</dd></dl>",
    "# Glossary\n\nRefund\n------\n\nMoney given back.",
    "# Glossary\n\n## Refund:\n\nMoney given back.",
    "# Glossary\n\n## Refund\n\n**Refund** is money given back.",
    "# Glossary\n\n## Refund\n\n- **Meaning**: money given back\n- **Owner**: payments",
  ])
    assert.deepEqual(owned(glossary), ["Refund"], glossary);
  // A heading over entries of other terms is an entry too: one named like a model term
  // is reworded once rather than read as a group nobody can tell from a definition.
  assert.deepEqual(
    owned(
      "# Glossary\n\n## Ordering\n\n- Order: a customer's request to buy.\n- Cart: the items before ordering.",
    ),
    ["Order", "Ordering"],
  );
  assert.deepEqual(
    owned(
      "# Glossary\n\n## Shipping\n\nThe terms of delivery.\n\n| Term | Meaning |\n| --- | --- |\n| Parcel | a box |",
    ),
    ["Shipping"],
  );
  assert.deepEqual(owned("```\n- Refund: money given back\n```"), [], "fenced code");
  // Prose and facet items under a term heading are entries named by the words they
  // start with, whatever the punctuation; none here names a model term, so the
  // heading's term is the only one owned.
  for (const body of [
    "Money given back to the buyer: the full amount or a part of it.",
    "Money returned to a buyer, for example: a partial refund after a dispute.",
    "Money given back - fully or in part.",
    "Money given back.\n\n**Important**: a refund needs approval.",
    "- Description: money given back to the buyer\n- Owner: payments",
    "- Notes: partial refunds are allowed",
    "Money given back to a buyer.\n\n- Partial refund: some of the money.\n- Full refund: all of it.",
  ])
    assert.deepEqual(owned(`# Glossary\n\n## Refund\n\n${body}`), ["Refund"], body);
  for (const body of ["- 설명: 구매자에게 돌려주는 돈", "구매자에게 돌려주는 돈: 전액 또는 일부."])
    assert.deepEqual(owned(`# 용어집\n\n## 환불\n\n${body}`), ["환불"], body);
  assert.deepEqual(owned("# Glossary\n\n## Order\n\n- Placed by: a customer"), ["Order"]);
  assert.deepEqual(owned("# Glossary\n\n## Refund\n\n- **Summary**: money given back"), ["Refund"]);
  // Deeper headings are entries as well.
  assert.deepEqual(
    owned("# Glossary\n\n## Ordering\n\nTerms of taking orders.\n\n### Order\n\nA request to buy."),
    ["Order", "Ordering"],
  );
  assert.deepEqual(
    owned("# Glossary\n\n## Refund\n\nMoney given back.\n\n### Description\n\nThe whole amount."),
    ["Refund"],
  );
  // A facet of a term leaves the heading its term, and a facet line whose label the model
  // owns is read as well: one proposal too many costs a question, one too few a term
  // defined twice.
  const facetModel = indexGraph(
    parseTurtle(
      `${EXAMPLE}\nm:ordering.owner a pm:BusinessConcept ; rdfs:label "Owner" ; pm:definition "Who owns an order." ; pm:inContext m:ordering .\n`,
    ).triples,
  );
  assert.deepEqual(
    glossaryOverlap(
      "# Glossary\n\n## Order\n\nA request.\n\n- Owner: the customer",
      facetModel,
    ).map((g) => g.term),
    ["Order", "Owner"],
  );
  assert.deepEqual(owned("See https://example.com/refund: details"), []);
});

test("every glossary heading names its term whatever its body holds, and the entries, tables and definition lists under it are read", () => {
  const concept = (id, label) =>
    `m:payment.${id} a pm:BusinessConcept ; rdfs:label "${label}" ; pm:definition "d" ; pm:inContext m:payment .\n`;
  const model = indexGraph(
    parseTurtle(
      `${EXAMPLE}\n${concept("refund", "Refund")}${concept("chargeback", "Chargeback")}${concept("hwanbul", "환불")}${concept("account", "Account")}${concept("category", "Category")}${concept("partial-refund", "Partial refund")}` +
        `m:fulfilment a pm:BoundedContext ; rdfs:label "Fulfilment" ; pm:definition "d" .\n`,
    ).triples,
  );
  const owned = (glossary) =>
    glossaryOverlap(glossary, model)
      .map((g) => g.term)
      .sort();
  for (const [glossary, terms] of [
    // A heading over an introduction and entries of other terms: the heading and the entries.
    [
      "# Glossary\n\n## Payment\n\nTerms of the payment context.\n\n- Refund: money given back.\n- Charge: money taken.",
      ["Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Payment\n\nTerms of the payment context.\n\n- **Refund**: money given back.\n- **Chargeback**: a forced refund.",
      ["Chargeback", "Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Ordering\n\nTerms used when taking orders.\n\n- Order: a customer's request to buy.\n- Cart: the items before ordering.",
      ["Order", "Ordering"],
    ],
    [
      "# Glossary\n\n## Payment\n\nThe payment terms are:\n\n- Refund: money given back.\n- Charge: money taken.",
      ["Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Payment\n\nTerms:\n\n1. Refund — money given back.\n2. Chargeback — a forced refund.",
      ["Chargeback", "Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Payment\n\nTerms the payment team uses.\n\n**Refund**: money given back.\n\n**Chargeback**: a forced refund.",
      ["Chargeback", "Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Payment\n\n> Terms the payment team uses.\n\n- **Refund**: money given back.",
      ["Payment", "Payment", "Refund"],
    ],
    [
      "# 용어집\n\n## 결제\n\n결제 팀이 쓰는 용어.\n\n- **환불**: 구매자에게 돌려주는 돈.",
      ["환불"],
    ],
    ["## Glossary\n\nTerms used in these ADRs.\n\n- **Refund**: money given back.", ["Refund"]],
    [
      "# Glossary\n\n## Ordering\n\nTerms of the ordering context.\n\n- **Order**: a request to buy.",
      ["Order", "Ordering"],
    ],
    // Entries that open the body, list items or paragraphs alike.
    [
      "# Glossary\n\n## Ordering\n\n**Order**: a customer's request to buy.\n\n**Refund**: money given back.",
      ["Order", "Ordering", "Refund"],
    ],
    [
      "# Glossary\n\n## O\n\n**Order**: a customer's request to buy.\n\n## R\n\n**Refund**: money given back.",
      ["Order", "Refund"],
    ],
    [
      "# Glossary\n\n## Payment terms\n\nRefund: money given back.\n\nChargeback: a forced refund.",
      ["Chargeback", "Refund"],
    ],
    ["## Glossary\n\n**Refund**: money given back.\n\n**Order**: a request.", ["Order", "Refund"]],
    [
      "# Glossary\n\n## Payment\n\n**Refund** — money given back.\n\n**Chargeback** — a forced refund.",
      ["Chargeback", "Payment", "Payment", "Refund"],
    ],
    [
      "# 용어집\n\n## 결제\n\n**환불**: 구매자에게 돌려주는 돈.\n\n**Chargeback**: 강제 환불.",
      ["Chargeback", "환불"],
    ],
    ["# Glossary\n\n## Terms\n\n**Refund**: money given back.", ["Refund"]],
    ["# Glossary\n\n## Catalog\n\n- **Category**: a group of products.", ["Category"]],
    // A definition list under a heading, with or without an introduction.
    ["# Glossary\n\n## Payment\n\nRefund\n: money given back.", ["Payment", "Payment", "Refund"]],
    [
      "# Glossary\n\n## Payment\n\nTerms of payment.\n\nRefund\n: money given back.",
      ["Payment", "Payment", "Refund"],
    ],
    // Two headings: both are read.
    [
      "# Glossary\n\n## Payment\n\nTerms of payment.\n\n- **Refund**: money given back.\n\n## Chargeback\n\nA forced refund.",
      ["Chargeback", "Payment", "Payment", "Refund"],
    ],
    // A heading over its definition, parts, notes and facets: all of them are read.
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Partial refund**: some of it.",
      ["Partial refund", "Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back.\n\n**Chargeback**: a forced refund.",
      ["Chargeback", "Refund"],
    ],
    ["# Glossary\n\n## Refund\n\n- **Notes**: partial refunds are allowed", ["Refund"]],
    ["# Glossary\n\n## Refund\n\n- **Examples**: a partial refund after a dispute", ["Refund"]],
    // Facets of a term, whatever their label, in a list or as deeper headings.
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Type**: full or partial",
      ["Refund"],
    ],
    ["# Glossary\n\n## Refund\n\nMoney given back.\n\n- **Kinds**: full, partial", ["Refund"]],
    ["# Glossary\n\n## Refund\n\n- Status: requested or paid\n- Scope: one order", ["Refund"]],
    ["# Glossary\n\n## Refund\n\nMoney given back.\n\n### Rules\n\nWithin 30 days.", ["Refund"]],
    ["# 용어집\n\n## 환불\n\n구매자에게 돌려주는 돈.\n\n- **유형**: 전액 또는 부분", ["환불"]],
    // A heading's alias is a term too.
    [
      "# Glossary\n\n## Refund (환불)\n\nMoney given back.\n\n- Partial refund: some of it.",
      ["Partial refund", "Refund", "환불"],
    ],
    // Entries named after the heading are read beside it.
    [
      "# Glossary\n\n## Payment\n\n- Payment method: how it is paid.\n- Payment status: where it stands.",
      ["Payment", "Payment"],
    ],
    [
      "# Glossary\n\n## Order\n\n- Order line: one product.\n- Order total: the sum.",
      ["Order", "Order line"],
    ],
    // Whatever details follow a definition, the heading keeps its term.
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Status**: placed, paid or shipped.\n- **Owner**: the ordering team.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Context**: Ordering",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n**Rule**: within 30 days.\n\n**Scope**: card payments.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- Status: requested or paid.\n- Scope: card payments only.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Source**: the billing system.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- Type: full or partial.\n- Rule: within 30 days.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- Definition: money given back.\n- Type: full or partial.\n- Status: paid.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\nKind\n: full or partial.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Status values**: requested, paid.\n- **Also known as**: reimbursement.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Example**: a returned shirt.\n- **Counter-example**: a discount.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Not to be confused with**: a discount.\n- **Valid values**: full, partial.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Approver**: the finance team.",
      ["Refund"],
    ],
    ["# Glossary\n\n## Refund\n\n**Refunds** are money given back to buyers.", ["Refund"]],
    [
      "# Glossary\n\n## Refund\n\nMoney given back.\n\n| Kind | Meaning |\n| --- | --- |\n| Full | all of it |",
      ["Refund"],
    ],
    [
      "# 용어집\n\n## 환불\n\n구매자에게 돌려주는 돈.\n\n- **상태**: 요청, 승인, 지급\n- **컨텍스트**: 결제",
      ["환불"],
    ],
    // Sentences before a colon are entries named by their words, which no model term matches.
    [
      "# Glossary\n\n## Refund\n\nPaid back, fully: when returned.\n\nKept, partly: when damaged.",
      ["Refund"],
    ],
    // A facet line that opens the body.
    [
      "# Glossary\n\n## Ordering\n\nContext: the ordering team.\n\n- Cart: the items.\n- Basket: the bag.",
      ["Ordering"],
    ],
    // A heading with nothing under it but another heading.
    ["# Glossary\n\n## Ordering\n\n## Terms\n\n- **Order**: a request.", ["Order", "Ordering"]],
    // Definition sentences with a colon are entries named by their opening words, which no
    // model term matches, however many there are.
    [
      "# Glossary\n\n## Refund\n\nMoney given back to the buyer: the full amount.\n\nPaid by the seller: after a return.",
      ["Refund"],
    ],
    // A facet sub-heading that opens a term's body.
    ["# Glossary\n\n## Refund\n\n### Definition\n\nMoney given back to a buyer.", ["Refund"]],
    [
      "# Glossary\n\n## Refund\n\n### Meaning\n\nMoney given back to a buyer.\n\n### Rules\n\nOnly after delivery.",
      ["Refund"],
    ],
    ["# 용어집\n\n## 환불\n\n### 정의\n\n구매자에게 돌려주는 돈.", ["환불"]],
    [
      "# Glossary\n\n## Refund\n\n### Description\n\nMoney given back to a buyer.\n\n### Examples\n\nA returned shirt.",
      ["Refund"],
    ],
    // A definition written as a facet line or an entry of the heading's own term, with
    // parts, attributes and other entries after it.
    [
      "# Glossary\n\n## Refund\n\n- **Definition**: Money given back to a buyer.\n- **Partial refund**: some of it.",
      ["Partial refund", "Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- Definition: money given back to a buyer.\n- Partial refund: some of it.\n- Full refund: all of it.",
      ["Partial refund", "Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- **Definition**: Money given back to a buyer.\n- **Approver**: the finance team.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- **Meaning**: Money given back to a buyer.\n- **Category**: payments.",
      ["Category", "Refund"],
    ],
    ["# 용어집\n\n## 환불\n\n- **정의**: 구매자에게 돌려주는 돈.\n- **승인자**: 재무팀", ["환불"]],
    [
      "# Glossary\n\n## Refund\n\n**Definition**: Money given back to a buyer.\n\n**Approver**: the finance team.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- Definition: money given back.\n- Approver: the finance team.\n- Trigger: a return.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- **Description**: Money given back to a buyer.\n- **Calculation**: the paid amount minus fees.",
      ["Refund"],
    ],
    ["# Glossary\n\n## Refund (환불)\n\n- **환불**: 구매자에게 돌려주는 돈.", ["Refund", "환불"]],
    ["# 용어집\n\n## 환불\n\n- **유형**: 전액 또는 부분\n- **상태**: 요청 또는 지급", ["환불"]],
    ["# Glossary\n\n## Refund\n\n- **Kinds**: full and partial.", ["Refund"]],
    [
      "# Glossary\n\n## Refund\n\n- **Also known as**: reimbursement\n- **Valid values**: full, partial",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- **Status values**: requested, paid\n- **Owner**: payments",
      ["Refund"],
    ],
    ["# Glossary\n\n## Refund\n\n- **Aliases**: reimbursement", ["Refund"]],
    [
      "# Glossary\n\n## Refund\n\n- **Status**: requested or paid.\n- **Approver**: the finance team.",
      ["Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\n- **Context**: Payment\n- **Approver**: the finance team.",
      ["Refund"],
    ],
    ["# 용어집\n\n## 환불\n\n- **English**: Refund\n- **정의**: 구매자에게 돌려주는 돈.", ["환불"]],
    [
      "# Glossary\n\n## Refund\n\n- **Category**: payments\n- **Definition**: money given back.",
      ["Category", "Refund"],
    ],
    [
      "# Glossary\n\n### Order\n\n- **Definition**: a customer's request to buy.\n- **Category**: Sales",
      ["Category", "Order"],
    ],
    // A table of details, or of terms, before or after a definition.
    [
      "# Glossary\n\n## Refund\n\n| Kind | Meaning |\n| --- | --- |\n| Full | all of it |\n\n- **Chargeback**: a forced refund.",
      ["Chargeback", "Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back.\n\n| Term | Meaning |\n| --- | --- |\n| Partial refund | some of it |",
      ["Partial refund", "Refund"],
    ],
    [
      "# Glossary\n\n## Refund\n\nMoney given back.\n\n<dl><dt>Kind</dt><dd>full or partial</dd></dl>",
      ["Refund"],
    ],
    // A table of details after an introduction.
    [
      "# Glossary\n\n## Payment\n\nTerms of payment.\n\n| Code | Meaning |\n| --- | --- |\n| P1 | paid |\n\n- **Refund**: money given back.",
      ["Payment", "Payment", "Refund"],
    ],
    // A table of terms is read in every column a term, a word or a language names.
    [
      "# 용어집\n\n## 결제\n\n| English | 한국어 | 설명 |\n| --- | --- | --- |\n| Refund | 환불 | 구매자에게 돌려주는 돈 |",
      ["Refund", "환불"],
    ],
    [
      "# Glossary\n\n## Payment\n\n| # | Term (EN) | Term (KO) | Meaning |\n| --- | --- | --- | --- |\n| 1 | Chargeback | 환불 | a forced refund |",
      ["Chargeback", "Payment", "Payment", "환불"],
    ],
    [
      "# Glossary\n\n## Ordering\n\n| English | 한국어 | 설명 |\n| --- | --- | --- |\n| Cart | 장바구니 | the items before ordering |\n| Basket | 바구니 | a bag |",
      ["Ordering"],
    ],
    [
      "# Glossary\n\n## Payment\n\n| Word | Meaning |\n| --- | --- |\n| Refund | money given back |",
      ["Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Ordering\n\n| Term (EN) | Term (KO) | Meaning |\n| --- | --- | --- |\n| Cart | 장바구니 | the items |",
      ["Ordering"],
    ],
    [
      "# 용어집\n\n## Payment\n\n| 영문 | 한글 | 설명 |\n| --- | --- | --- |\n| Charge | 청구 | 받는 돈 |",
      ["Payment", "Payment"],
    ],
    [
      "# Glossary\n\n## Ordering\n\n| English | Korean | Description |\n| --- | --- | --- |\n| Order | 주문 | a request |",
      ["Order", "Ordering"],
    ],
    [
      "# Glossary\n\n## Ordering\n\nTerms of the ordering context.\n\n| Word | Meaning |\n| --- | --- | --- |\n| Cart | the items |",
      ["Ordering"],
    ],
    // An introduction under an alias heading or before parts.
    [
      "# Glossary\n\n## Ordering\n\nTerms of the ordering context.\n\n- Cart: the items before ordering.",
      ["Ordering"],
    ],
    [
      "# Glossary\n\n## 결제 (Payment)\n\nTerms of the payment context.\n\n- **Refund**: money given back.",
      ["Payment", "Payment", "Refund"],
    ],
    [
      "# 용어집\n\n## 결제 (Payment)\n\n결제 팀이 쓰는 용어.\n\n- **환불**: 구매자에게 돌려주는 돈.",
      ["Payment", "Payment", "환불"],
    ],
    [
      "# Glossary\n\n## Payment\n\nTerms of payment.\n\n- **Payment method**: how the buyer pays.",
      ["Payment", "Payment"],
    ],
    [
      "# Glossary\n\n## Payment\n\n<dl><dt>Refund</dt><dd>money given back</dd></dl>",
      ["Payment", "Payment", "Refund"],
    ],
    // A heading named after a context or a concept, whatever follows its prose.
    [
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer. There are two kinds:\n\n- Full refund: all of the money.\n- Partial refund: part of the money.",
      ["Partial refund", "Refund"],
    ],
    [
      "# 용어집\n\n## 환불\n\n구매자에게 돌려준 돈을 뜻하는 용어.\n\n- **부분 환불**: 일부만 돌려준 돈.",
      ["환불"],
    ],
    [
      "# Glossary\n\n## Payment\n\nCollecting the money for orders.\n\n- **Payment method**: how the buyer pays.",
      ["Payment", "Payment"],
    ],
    [
      "# Glossary\n\n## Payment\n\nThe record that the money for one order was collected.\n\n- **Payer**: the person whose card pays.",
      ["Payer", "Payment", "Payment"],
    ],
    [
      "# Glossary\n\n## Payment\n\nCollecting the money for an order.\n\n- **Refund**: money given back.",
      ["Payment", "Payment", "Refund"],
    ],
    [
      "# Glossary\n\n## Fulfilment\n\nGetting a paid order to the customer.\n\n- **Picking**: taking the items.\n- **Packing**: boxing them.",
      ["Fulfilment"],
    ],
    [
      "# Glossary\n\n## Payment\n\nMoney collected on the agreed terms.\n\n- **Refund**: money given back.",
      ["Payment", "Payment", "Refund"],
    ],
    ["# Glossary\n\n*Refund* is money given back.", []],
  ])
    assert.deepEqual(owned(glossary), terms, glossary);
});

test("a glossary table holds entries in the columns its header names as terms, names or a language — or, where none does, in its first column — and possible entries in its other columns but definitions", () => {
  const concept = (id, label) =>
    `m:payment.${id} a pm:BusinessConcept ; rdfs:label "${label}" ; pm:definition "d" ; pm:inContext m:payment .\n`;
  const model = indexGraph(
    parseTurtle(
      `${EXAMPLE}\n${concept("refund", "Refund")}${concept("hwanbul", "환불")}${concept("chargeback", "Chargeback")}${concept("term", "Term")}`,
    ).triples,
  );
  // Entries stop a save until cleaned up; possible entries are a question for the user.
  const read = (glossary) => {
    const overlap = glossaryOverlap(glossary, model);
    const terms = (possible) =>
      overlap
        .filter((g) => Boolean(g.possible) === possible)
        .map((g) => g.term)
        .sort();
    return [terms(false), terms(true)];
  };
  const table = (header, ...rows) =>
    `# Glossary\n\n| ${header.join(" | ")} |\n| ${header.map(() => "---").join(" | ")} |\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}`;
  const both = (header, first = "환불", second = "Refund") => [
    table(header, [first, second, "돌려주는 돈"]),
    ["Refund", "환불"],
  ];
  const payment = ["Payment", "Payment"];
  for (const [glossary, entries, possible = []] of [
    // Compound, qualified, abbreviated and parenthesized headers name every term column.
    both(["영문명", "한글명", "설명"], "Refund", "환불"),
    both(["한글명", "영문명", "설명"]),
    both(["용어", "영문명", "설명"]),
    both(["영문 용어", "한글 용어", "설명"], "Refund", "환불"),
    both(["English term", "Korean term", "Meaning"], "Refund", "환불"),
    both(["Term", "Korean term", "Meaning"], "Refund", "환불"),
    both(["EN", "KO", "Notes"], "Refund", "환불"),
    both(["KOR", "ENG", "설명"]),
    both(["한글", "영문 표기", "설명"]),
    both(["Term (Eng)", "Term (Kor)", "Meaning"], "Refund", "환불"),
    both(["용어(한)", "용어(영)", "설명"]),
    both(["용어(국)", "용어(영)", "설명"]),
    both(["용어(표준)", "용어(영문)", "설명"]),
    both(["Term (primary)", "Term (alternative)", "Meaning"], "Refund", "환불"),
    both(["Name (Eng.)", "Name (Kor.)", "Meaning"], "Refund", "환불"),
    both(["표준 용어", "영문명", "설명"]),
    both(["표준용어", "영문명", "설명"]),
    both(["표준 용어명", "영문 약어", "설명"]),
    both(["Preferred term", "Synonyms", "Meaning"], "Refund", "환불"),
    both(["Standard term", "Korean", "Meaning"], "Refund", "환불"),
    both(["Term", "Alias", "Meaning"], "Refund", "환불"),
    both(["원어", "번역어", "설명"], "Refund", "환불"),
    both(["한국어", "영어 표현", "설명"]),
    both(["한", "영", "설명"]),
    both(["국문", "영문 약자", "설명"]),
    both(["Term in English", "Term in Korean", "Meaning"], "Refund", "환불"),
    both(["Term", "Also known as", "Meaning"], "Refund", "환불"),
    both(["Display name", "Korean", "Meaning"], "Refund", "환불"),
    both(["용어", "약어·동의어", "설명"]),
    both(["용어", "약어,동의어", "설명"]),
    both(["Term", "Synonyms/aliases", "Meaning"], "Refund", "환불"),
    both(["한글용어", "영문용어", "설명"]),
    both(["국문용어", "영문표기", "설명"]),
    both(["영문용어", "한글용어", "약어"], "Refund", "환불"),
    both(["용어", "약칭", "설명"]),
    [
      table(["Abbr.", "Full name", "Meaning"], ["CB", "Chargeback", "a forced refund"]),
      ["Chargeback"],
    ],
    [table(["Ref", "Abbr.", "Meaning"], ["R-1", "Chargeback", "a forced refund"]), ["Chargeback"]],
    // A term column behind a number or category column.
    [
      table(["No.", "Business term", "Definition"], ["1", "Refund", "money given back"]),
      ["Refund"],
    ],
    [table(["번호", "용어명", "설명"], ["1", "환불", "구매자에게 돌려주는 돈"]), ["환불"]],
    [table(["#", "Term name", "Definition"], ["1", "Refund", "money given back"]), ["Refund"]],
    [table(["분류", "용어명", "설명"], ["결제", "환불", "돌려주는 돈"]), ["환불"]],
    // Beside a term column, any other column but a definition may hold a name as other
    // content — a context, a category, a code, a related term, a business area or its
    // name, or a column whose header names nothing: a question, never an entry.
    [
      table(["Context", "Term (Eng)", "Meaning"], ["Payment", "Refund", "money given back"]),
      ["Refund"],
      payment,
    ],
    [
      table(["Domain", "Term", "Meaning"], ["Payment", "Refund", "money given back"]),
      ["Refund"],
      payment,
    ],
    [table(["업무", "용어", "설명"], ["Payment", "환불", "돌려주는 돈"]), ["환불"], payment],
    [
      table(["Service", "Term", "Meaning"], ["Payment", "Refund", "money given back"]),
      ["Refund"],
      payment,
    ],
    [
      table(["Term", "Context", "Meaning"], ["Refund", "Payment", "money given back"]),
      ["Refund"],
      payment,
    ],
    [
      table(["Term", "Context name", "Meaning"], ["Refund", "Payment", "money given back"]),
      ["Refund"],
      payment,
    ],
    [
      table(["Term", "Owner name", "Meaning"], ["Refund", "Payment", "money given back"]),
      ["Refund"],
      payment,
    ],
    [
      table(["Term", "Related terms", "Meaning"], ["Refund", "Chargeback", "x"]),
      ["Refund"],
      ["Chargeback"],
    ],
    [
      table(["Term", "Broader term", "Meaning"], ["Refund", "Chargeback", "x"]),
      ["Refund"],
      ["Chargeback"],
    ],
    [
      table(["Term", "Child term", "Meaning"], ["Refund", "Chargeback", "x"]),
      ["Refund"],
      ["Chargeback"],
    ],
    [table(["용어", "하위 용어", "설명"], ["환불", "Refund", "돌려주는 돈"]), ["환불"], ["Refund"]],
    [
      table(["Code", "Term", "Meaning"], ["Chargeback", "Refund", "money given back"]),
      ["Refund"],
      ["Chargeback"],
    ],
    [table(["용어", "컨텍스트명", "설명"], ["환불", "Payment", "돌려주는 돈"]), ["환불"], payment],
    [table(["용어", "담당자명", "설명"], ["환불", "Payment", "돌려주는 돈"]), ["환불"], payment],
    [
      table(["용어", "관련용어", "설명"], ["환불", "Chargeback", "돌려주는 돈"]),
      ["환불"],
      ["Chargeback"],
    ],
    [
      table(["Domain name", "Term", "Meaning"], ["Payment", "Refund", "money given back"]),
      ["Refund"],
      payment,
    ],
    [table(["업무명", "용어", "설명"], ["Payment", "환불", "돌려주는 돈"]), ["환불"], payment],
    [table(["도메인명", "용어", "설명"], ["Payment", "환불", "돌려주는 돈"]), ["환불"], payment],
    [
      table(["Term", "Business name", "Meaning"], ["Refund", "환불", "money given back"]),
      ["Refund"],
      ["환불"],
    ],
    [table(["구분", "English", "설명"], ["환불", "Refund", "돌려주는 돈"]), ["Refund"], ["환불"]],
    [table(["Source term", "Target term"], ["Refund", "환불"]), ["환불"], ["Refund"]],
    [table(["Context", "Key terms"], ["Payment", "Refund"]), ["Refund"], payment],
    both(["표제", "영문명", "설명"])
      .with(1, ["Refund"])
      .concat([["환불"]]),
    [table(["", "English", "설명"], ["환불", "Refund", "돌려주는 돈"]), ["Refund"], ["환불"]],
    // A definition column holds no names at all.
    [table(["용어", "용어설명"], ["환불", "Refund"]), ["환불"]],
    [table(["용어", "설명"], ["환불", "Refund"]), ["환불"]],
    // No header names a term column: the first column that does not number the rows,
    // whatever it names.
    [table(["표제", "풀이"], ["환불", "구매자에게 돌려주는 돈"]), ["환불"]],
    [table(["구분", "설명"], ["환불", "구매자에게 돌려주는 돈"]), ["환불"]],
    [
      table(
        ["No.", "표제", "풀이"],
        ["1", "Refund", "money given back"],
        ["2", "Chargeback", "a forced refund"],
      ),
      ["Chargeback", "Refund"],
    ],
    [table(["#", "표제", "풀이"], ["#1", "Refund", "money given back"]), ["Refund"]],
    [
      table(
        ["No.", "표제", "풀이"],
        ["1.", "Refund", "money given back"],
        ["", "Chargeback", "a forced refund"],
      ),
      ["Chargeback", "Refund"],
    ],
    [table(["Context", "Responsibility"], ["Payment", "Collecting the money"]), payment],
    // A delimiter row of one hyphen per cell, as GitHub-flavored Markdown accepts it.
    ["# Glossary\n\n| Term | Meaning |\n|:--|:--|\n| Refund | money given back |", ["Refund"]],
    ["# Glossary\n\n|Term|Meaning|\n|-|-|\n|Refund|money given back|", ["Refund"]],
  ])
    assert.deepEqual(read(glossary), [entries, possible], glossary);
  // Each word for terms, names or a language marks a term column alone, as a compound
  // or beside a qualifier, behind a first column that names nothing.
  for (const header of [
    ...["Term", "Word", "Concept", "Entry", "Entries", "Item", "Keyword", "Abbr", "Abbrev"],
    ...["Abbreviation", "Acronym", "Synonym", "Alias", "Aliases", "Expansion", "Form", "Spelling"],
    ...["Phrase", "Expression", "Translation", "Vocabulary", "Glossary", "Name", "Label", "Title"],
    ...[
      "English",
      "Korean",
      "EN",
      "KO",
      "KR",
      "ENG",
      "KOR",
      "용어",
      "단어",
      "낱말",
      "어휘",
      "개념",
    ],
    ...[
      "항목",
      "표제어",
      "키워드",
      "약어",
      "약자",
      "약칭",
      "동의어",
      "유의어",
      "별칭",
      "원어",
      "번역",
    ],
    ...["번역어", "표기", "표현", "이름", "명칭", "영문", "영어", "한글", "국문", "국어", "한국어"],
    ...[
      "한",
      "영",
      "국",
      "Business term",
      "Domain term",
      "업무 용어",
      "비즈니스 용어",
      "도메인 용어",
    ],
    ...["Full name", "정식 명칭", "용어명", "영문명", "정식명", "표준용어", "영문명칭", "업무용어"],
    ...["Term (EN)", "Term(EN)", "용어(영문)", "Also known as", "Term in English"],
  ])
    assert.deepEqual(
      read(table(["Ref", header, "Meaning"], ["R-1", "Refund", "money given back"])),
      [["Refund"], []],
      header,
    );
  // A word for other content, or a business area, makes a name column one of other names.
  for (const header of [
    ...["Source", "Reference", "Related", "See", "Broader", "Narrower", "Child", "Children"],
    ...["Antonym", "Opposite", "Code", "ID", "Identifier", "Context", "Owner", "Team"],
    ...["Category", "Categories", "Group", "Type", "Kind", "Status", "System", "Process"],
    ...["Step", "Parent", "Unit", "Format", "Value", "Rule", "Domain", "Business", "Area"],
  ])
    assert.deepEqual(
      read(table(["Term", `${header} name`, "Meaning"], ["Refund", "Payment", "x"])),
      [["Refund"], payment],
      header,
    );
  for (const header of [
    ...["하위", "반의어", "코드", "식별자", "아이디", "출처", "참고", "참조", "관련", "컨텍스트"],
    ...["문맥", "담당", "담당자", "소유", "소유자", "팀", "분류", "범주", "그룹", "유형", "종류"],
    ...["상태", "시스템", "프로세스", "단계", "상위", "단위", "형식", "값", "규칙", "업무"],
    ...["도메인", "비즈니스", "영역", "분야"],
  ])
    assert.deepEqual(
      read(table(["용어", `${header}명`, "설명"], ["환불", "Payment", "x"])),
      [["환불"], payment],
      header,
    );
  // Header words split at every mark a header may join them with.
  for (const mark of [";", ":", "[", "]", "{", "}", "<", ">", "+", "&", "-", "・", "/", "·", ","])
    assert.deepEqual(
      read(table(["Ref", `용어${mark}별칭`, "설명"], ["R-1", "환불", "x"])),
      [["환불"], []],
      mark,
    );
  // A single syllable ends too many words to read one as its kind: 운영 is no language.
  assert.deepEqual(read(table(["Ref", "운영", "설명"], ["R-1", "환불", "x"])), [[], ["환불"]]);
  // A word for definitions or examples keeps its column unread.
  for (const header of [
    ...["Definition", "Description", "Meaning", "Explanation", "Note", "Remark", "Comment"],
    ...["Example", "Usage", "설명", "정의", "의미", "뜻", "풀이", "해설", "내용", "비고", "예"],
    ...["예시", "용례"],
  ])
    assert.deepEqual(
      read(table(["Term", header], ["Refund", "Payment"])),
      [["Refund"], []],
      header,
    );
});

test("a glossary entry is read in every form a glossary writes one, by its name alone", () => {
  const concept = (id, label) =>
    `m:payment.${id} a pm:BusinessConcept ; rdfs:label "${label}" ; pm:definition "d" ; pm:inContext m:payment .\n`;
  const model = indexGraph(
    parseTurtle(
      `${EXAMPLE}\n${concept("refund", "Refund")}${concept("hwanbul", "환불")}${concept("term", "Term")}`,
    ).triples,
  );
  const owned = (glossary) =>
    glossaryOverlap(glossary, model)
      .map((g) => g.term)
      .sort();
  for (const [glossary, terms] of [
    // A level-1 heading, an entry named Term, a run-in or linked term, and an alias after any marked term.
    ["# Refund\n\nMoney given back to a buyer.", ["Refund"]],
    ["# Glossary\n\n## Term\n\nThe length of a loan.", ["Term"]],
    ["# Glossary\n\n- **Term**: the length of a loan.", ["Term"]],
    ["# Glossary\n\n- **Refund.** Money given back to a buyer.", ["Refund"]],
    ["# Glossary\n\n**Refund.** Money given back to a buyer.", ["Refund"]],
    ["# Glossary\n\n- [Refund](https://example.com/refund): money given back.", ["Refund"]],
    [
      "# Glossary\n\n- [Refund](https://en.wikipedia.org/wiki/Refund_(finance)): money given back.",
      ["Refund"],
    ],
    ["# 용어집\n\n- **환불** (Refund): 구매자에게 돌려주는 돈.", ["Refund", "환불"]],
    ["# 용어집\n\n- *Refund* (환불): money given back.", ["Refund", "환불"]],
    ["# 용어집\n\n- `Refund` (환불): money given back.", ["Refund", "환불"]],
    // A plain term before a long dash, with or without spaces, or an equals sign; an
    // HTML bold term; a numbered heading; two names separated by a slash.
    ["# Glossary\n\n- Refund—money given back.", ["Refund"]],
    ["# Glossary\n\n- Refund – money given back.", ["Refund"]],
    ["# Glossary\n\n- Refund = money given back.", ["Refund"]],
    ["# Glossary\n\n- *Refund* = money given back.", ["Refund"]],
    ["# Glossary\n\n- `Refund`—money given back.", ["Refund"]],
    ["# Glossary\n\n- <b>Refund</b>: money given back.", ["Refund"]],
    ["# Glossary\n\n<strong>Refund</strong> — money given back.", ["Refund"]],
    ["# Glossary\n\n## 1. Refund\n\nMoney given back.", ["Refund"]],
    ["# Glossary\n\n### 2.3 Refund\n\nMoney given back.", ["Refund"]],
    ["# Glossary\n\n## Refund / 환불\n\nMoney given back.", ["Refund", "환불"]],
    ["# Glossary\n\n- **Refund / 환불**: money given back.", ["Refund", "환불"]],
    ["# Glossary\n\n## 환불/Refund\n\nMoney given back.", ["Refund", "환불"]],
    ["# Glossary\n\n- **Refund/환불**: money given back.", ["Refund", "환불"]],
    // A hyphenated or en-dashed compound, or a sentence about a term, names no entry.
    ["# Glossary\n\n- Refund-eligible orders: what qualifies.", []],
    ["# Glossary\n\n- Order–payment link: how an order pays.", []],
    ["# Glossary\n\n*Refund* is money given back.", []],
  ])
    assert.deepEqual(owned(glossary), terms, glossary);
});

test("a same-meaning confirmation names a changed fact text and never a structure change", () => {
  const before = indexGraph(parseTurtle(EXAMPLE).triples);
  const after = indexGraph(
    parseTurtle(EXAMPLE.replace('rdfs:label "Submit the order"', 'rdfs:label "Submit an order"'))
      .triples,
  );
  assert.equal(
    sameMeaningKeys(["ordering.submit-order=rdfs:label"], before, after).errors.length,
    0,
  );
  for (const bad of [
    "ordering.submit-order=pm:flowsTo",
    "ordering.submit-order=pm:summary",
    "ordering.submit-order=pm:definition",
    "ghost=rdfs:label",
    "ordering.submit-order",
  ])
    assert.equal(sameMeaningKeys([bad], before, after).errors.length, 1, bad);
});

// The closed tables as the ADR states them (each relation's source and target
// types, and the element types that must carry each required attribute), written
// out rather than read from the code, so a vocabulary edit the ADR does not make
// fails here.
const ELEMENT_TYPES = [
  "Actor",
  "BoundedContext",
  "BusinessConcept",
  "BusinessEvent",
  "Process",
  "Step",
  "Policy",
  "BusinessRule",
  "ObservationCriterion",
];
const RELATION_ENDS = {
  hasStep: { from: ["Process"], to: ["Step"] },
  flowsTo: { from: ["Step"], to: ["Step"] },
  performs: { from: ["Actor"], to: ["Step"] },
  emits: { from: ["Step"], to: ["BusinessEvent"] },
  triggers: { from: ["BusinessEvent"], to: ["Policy"] },
  starts: { from: ["Policy"], to: ["Step"] },
  uses: { from: ["Step", "Policy"], to: ["BusinessConcept"] },
  constrains: { from: ["BusinessRule"], to: ["Step", "Policy", "BusinessConcept", "Process"] },
  hasPart: { from: ["BusinessConcept"], to: ["BusinessConcept"] },
  refersTo: { from: ["BusinessConcept"], to: ["BusinessConcept"] },
  correspondsTo: { from: ["BusinessConcept"], to: ["BusinessConcept"] },
  inContext: {
    from: ["Step", "Policy", "BusinessConcept", "BusinessEvent"],
    to: ["BoundedContext"],
  },
  criterionOf: { from: ["ObservationCriterion"], to: ["Process"] },
  passesThrough: { from: ["ObservationCriterion"], to: ["BusinessEvent"] },
};
const REQUIRED_ON = {
  name: ELEMENT_TYPES,
  definition: ELEMENT_TYPES.filter((t) => t !== "ObservationCriterion"),
  stepKind: ["Step"],
  reactionCondition: ["Policy"],
  basisKind: ["Policy", "BusinessRule"],
  basis: ["Policy", "BusinessRule"],
  startCondition: ["Process", "ObservationCriterion"],
  businessOutcome: ["Process"],
  observedResult: ["ObservationCriterion"],
  openScope: ["Process"],
  status: ["Process"],
};
const attributeIri = (name) => (name === "name" ? `${RDFS}label` : PM + name);
const sorted = (list) => [...list].sort();

test("the relation table and the required attributes are exactly the ADR's", () => {
  assert.deepEqual(
    CLASSES.map((c) => c.key),
    ELEMENT_TYPES,
  );
  const ends = (rows) =>
    Object.fromEntries(rows.map(([key, r]) => [key, { from: sorted(r.from), to: sorted(r.to) }]));
  assert.deepEqual(ends(RELATIONS.map((r) => [r.key, r])), ends(Object.entries(RELATION_ENDS)));
  assert.deepEqual(
    Object.fromEntries(
      ATTRIBUTES.filter((a) => a.required?.length).map((a) => [a.iri, sorted(a.required)]),
    ),
    Object.fromEntries(
      Object.entries(REQUIRED_ON).map(([name, types]) => [attributeIri(name), sorted(types)]),
    ),
  );
});

test("every required attribute of every element type is required, one table row at a time", () => {
  const model = indexGraph(parseTurtle(EXAMPLE).triples);
  const triples = parseTurtle(EXAMPLE).triples;
  for (const [name, types] of Object.entries(REQUIRED_ON))
    for (const type of types) {
      const iri = attributeIri(name);
      const subject = model.ofType(type).find((s) => model.subjects.get(s).props.has(iri));
      assert.ok(subject, `the example model has a ${type} with ${name} to remove`);
      const without = triples.filter((t) => !(t.s === subject && t.p === iri));
      const result = validate(serializeTurtle(without));
      assert.ok(
        errorsFor(result, "process-attribute-missing").some(
          (f) => f.element === subject.slice(MODEL.length),
        ),
        `${type} without ${name}: ${codes(result)}`,
      );
    }
});

test("every relation rejects every source and target type outside its table row", () => {
  const model = indexGraph(parseTurtle(EXAMPLE).triples);
  const anyOf = (type) => {
    const element = model.ofType(type)[0];
    assert.ok(element, `the example model has a ${type}`);
    return element;
  };
  for (const [key, row] of Object.entries(RELATION_ENDS))
    for (const type of ELEMENT_TYPES) {
      if (!row.from.includes(type)) {
        const result = validate(`${EXAMPLE}\n<${anyOf(type)}> pm:${key} <${anyOf(row.to[0])}> .\n`);
        assert.ok(errorsFor(result, "process-relation-source").length, `${type} as ${key} source`);
      }
      if (!row.to.includes(type)) {
        const result = validate(
          `${EXAMPLE}\n<${anyOf(row.from[0])}> pm:${key} <${anyOf(type)}> .\n`,
        );
        assert.ok(errorsFor(result, "process-relation-target").length, `${type} as ${key} target`);
      }
    }
});

test("a step and a criterion each belong to exactly one process", () => {
  const triples = parseTurtle(EXAMPLE).triples;
  const step = `${MODEL}payment.capture-payment`;
  const loose = validate(
    serializeTurtle(triples.filter((t) => !(t.p === `${PM}hasStep` && t.o.value === step))),
  );
  assert.ok(
    errorsFor(loose, "process-membership").some((f) => /belongs to 0 processes/.test(f.msg)),
  );
  const criterion = `${MODEL}payment.take-payment.completed`;
  const orphan = validate(
    serializeTurtle(triples.filter((t) => !(t.s === criterion && t.p === `${PM}criterionOf`))),
  );
  assert.ok(
    errorsFor(orphan, "process-membership").some(
      (f) => f.element === "payment.take-payment.completed",
    ),
  );
});

test("element identifiers carry no ADR number, and realizing ADR bodies cite no model document or id", () => {
  assert.ok(
    errorsFor(
      validate(`${EXAMPLE}\nm:adr-0003-amount a pm:Actor ; rdfs:label "A" ; pm:definition "d" .\n`),
      "process-adr-reference",
    ).length,
  );
  const model = indexGraph(parseTurtle(EXAMPLE).triples);
  // From an ADR of docs/adr/ordering/, two levels up is docs/, which holds the model.
  const inModel = (target) =>
    path.posix.normalize(path.posix.join("docs/adr/ordering", target)).startsWith("docs/process");
  const hits = (line) => modelReferenceHits(line, model, { inModel }).map((h) => h.text);
  assert.deepEqual(hits("See [the flow](../../process/ordering.ttl)."), [
    "../../process/ordering.ttl",
  ]);
  assert.deepEqual(hits("The step `ordering.submit-order` is realized here."), [
    "`ordering.submit-order`",
  ]);
  assert.deepEqual(
    hits("Use `customer` in code."),
    [],
    "a one-word code name is not taken for an id",
  );
});
