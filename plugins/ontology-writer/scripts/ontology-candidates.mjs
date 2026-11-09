#!/usr/bin/env bun
// ontology-candidates.mjs — turn an evidence-based candidate graph into the disposable
// artifacts of an ontology build, for any project.
//
// The agent writes one candidates file from the evidence it read (see
// skills/ontology-build/references/candidates.md). This command checks it and writes,
// inside the build's run directory only:
//   draft/                every current model document, with the candidates merged in
//   board.json            the EventStorming board for eventstorming-view.mjs
//   mapping.draft.json    the ADR index with the candidate `realizes` links
//   ask/questions.json    the web question session's questions
//   candidates-summary.json  per-context counts, verdicts, basis gaps and id warnings
// With --confirmed-only it writes only the save artifacts (save-draft/, mapping.save.json)
// from the candidates the user confirmed. It never writes the model, the index or ADRs.
//
// Usage:
//   bun ontology-candidates.mjs check <candidates.json> [--ontology-dir DIR] [--json]
//   bun ontology-candidates.mjs prepare <candidates.json> --run <run> [--ontology-dir DIR]
//                               [--mapping FILE] [--confirmed-only] [--json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateEventBoard } from "./eventstorming-board.mjs";
import { parseQuestions } from "./ontology-ask.mjs";
import { findModelDocuments, readDocument } from "./ontology-fs.mjs";
import {
  BASIS_KINDS,
  compareCodePoints,
  MODEL,
  ONTO,
  OPEN_SCOPE_KINDS,
  RDF,
  RDFS,
  STEP_KINDS,
  XSD,
  elementId,
  elementIri,
  indexGraph,
  isValidElementId,
  parseDocument,
  serializeTurtle,
} from "./ontology-lib.mjs";

const VERDICTS = ["stated", "inferred", "conflicting", "unconfirmed"];
const OPEN_KIND_TO_DATATYPE = Object.fromEntries(
  Object.entries(OPEN_SCOPE_KINDS).map(([key, kind]) => [kind, ONTO + key]),
);
// A number in place of meaning: `rule-01`, `credit.policy-7`, `step3`.
const SERIAL_ID = /(^|[.-])(rule|policy|concept|step|event|process|actor|criterion|item|q)-?\d+$/i;

/** The candidate lists, the model type each one becomes, and the label of one item. */
const KINDS = {
  contexts: "BoundedContext",
  actors: "Actor",
  concepts: "BusinessConcept",
  events: "BusinessEvent",
  processes: "Process",
  steps: "Step",
  policies: "Policy",
  rules: "BusinessRule",
  criteria: "ObservationCriterion",
};

const iri = (id) => elementIri(id);
const text = (value) => ({ type: "literal", value, lang: null, datatype: XSD + "string" });
const ref = (id) => ({ type: "iri", value: iri(id) });
const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

// ── reading ────────────────────────────────────────────────────────────────

/** The current model: parsed documents, every triple and which document holds each subject. */
export function readCurrentModel(ontologyDir) {
  const files = existsSync(ontologyDir) ? findModelDocuments(ontologyDir, () => {}) : [];
  const docs = files.map((file) => {
    const doc = path.relative(ontologyDir, file);
    const parsed = parseDocument({ doc, ...readDocument(file) });
    return { doc, file, parsed };
  });
  const broken = docs.filter((d) => d.parsed.errors.length);
  const triples = docs.flatMap((d) => d.parsed.triples);
  const home = new Map();
  for (const d of docs) for (const t of d.parsed.triples) if (!home.has(t.s)) home.set(t.s, d.doc);
  return { docs, broken, triples, index: indexGraph(triples), home };
}

/** Every candidate with its list name, in file order. */
function allCandidates(doc) {
  return Object.keys(KINDS).flatMap((kind) =>
    list(doc[kind]).map((item, i) => ({ kind, item, where: `${kind}[${i}]` })),
  );
}

// ── checking ───────────────────────────────────────────────────────────────

/**
 * Check a candidates file against itself and the current model. Errors make the
 * artifacts unusable; warnings are review items (serial ids, missing bases, kept wording).
 */
export function checkCandidates(doc, current = { index: indexGraph([]) }) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  if (!doc || typeof doc !== "object" || doc.version !== 1)
    return { errors: ["candidates: expected an object with version 1"], warnings };
  if (!nonEmpty(doc.title)) err("title", "expected nonempty text");
  if (!nonEmpty(doc.scope)) err("scope", "state the business scope the candidates cover");

  const types = new Map();
  for (const { kind, item, where } of allCandidates(doc)) {
    if (!item || typeof item !== "object") {
      err(where, "expected an object");
      continue;
    }
    const id = item.id;
    if (!isValidElementId(id)) err(where, `id ${JSON.stringify(id)} is not a model id`);
    else if (types.has(id)) err(where, `id ${id} is already used by ${types.get(id)}`);
    else types.set(id, KINDS[kind]);
    const existing = current.index.typeOf(iri(id));
    if (existing && existing !== KINDS[kind])
      err(where, `${id} is a ${existing} in the current model, not a ${KINDS[kind]}`);
    if (SERIAL_ID.test(id ?? ""))
      warn(where, `${id} names a number, not a meaning; name it from its business meaning`);
    if (kind !== "criteria" && !existing && !nonEmpty(item.definition))
      err(where, "a new element needs a definition");
    if (!existing && !nonEmpty(item.label)) err(where, "a new element needs a label");
    if (!VERDICTS.includes(item.verdict))
      err(where, `verdict must be one of ${VERDICTS.join(", ")}`);
    if (!Array.isArray(item.evidence))
      err(where, "evidence must be an array (empty means none found)");
    if (item.confirmed !== undefined && typeof item.confirmed !== "boolean")
      err(where, "confirmed must be true or false");
    if (item.planned !== undefined && typeof item.planned !== "boolean")
      err(where, "planned must be true or false");
    for (const s of list(item.openScope))
      if (!OPEN_KIND_TO_DATATYPE[s?.kind] || (s.kind !== "none" && !nonEmpty(s.text)))
        err(where, "openScope items are {kind: open-path | not-applicable, text} or {kind: none}");
    if (kind === "policies" || kind === "rules") {
      if (!item.basis && !existing)
        warn(where, "no basis was found; ask for its basis before saving");
      else if (item.basis && (!BASIS_KINDS.includes(item.basis.kind) || !nonEmpty(item.basis.text)))
        err(where, `basis is {kind: ${BASIS_KINDS.join(" | ")}, text}`);
    }
    if (kind === "steps" && item.kind !== undefined && !STEP_KINDS.includes(item.kind))
      err(where, `kind must be one of ${STEP_KINDS.join(", ")}`);
    if (kind === "steps" && !existing && item.kind === undefined)
      err(where, `a new step needs kind (${STEP_KINDS.join(" or ")})`);
    if (kind === "policies" && !existing && !nonEmpty(item.condition))
      err(where, "a new policy needs its reaction condition");
  }

  // Every reference resolves to a candidate or a current element of the right type.
  const typeOf = (id) => types.get(id) ?? current.index.typeOf(iri(id));
  const expect = (where, ids, wanted) => {
    for (const id of list(ids)) {
      const t = typeOf(id);
      if (!t) err(where, `${id} is neither a candidate nor a current element`);
      else if (!wanted.includes(t)) err(where, `${id} is a ${t}; expected ${wanted.join(" or ")}`);
    }
  };
  for (const { kind, item, where } of allCandidates(doc)) {
    if (!item || typeof item !== "object") continue;
    if (item.context !== undefined) expect(`${where}.context`, item.context, ["BoundedContext"]);
    if (kind === "contexts")
      expect(`${where}.collaboratesWith`, item.collaboratesWith, ["BoundedContext"]);
    if (kind === "concepts")
      for (const p of ["hasPart", "refersTo", "correspondsTo"])
        expect(`${where}.${p}`, item[p], ["BusinessConcept"]);
    if (kind === "processes") expect(`${where}.steps`, item.steps, ["Step"]);
    if (kind === "steps") {
      expect(`${where}.performers`, item.performers, ["Actor"]);
      expect(`${where}.flowsTo`, item.flowsTo, ["Step"]);
      expect(`${where}.emits`, item.emits, ["BusinessEvent"]);
      expect(`${where}.uses`, item.uses, ["BusinessConcept"]);
    }
    if (kind === "policies") {
      expect(`${where}.trigger`, item.trigger, ["BusinessEvent"]);
      expect(`${where}.starts`, item.starts, ["Step"]);
      expect(`${where}.uses`, item.uses, ["BusinessConcept"]);
    }
    if (kind === "rules")
      expect(`${where}.constrains`, item.constrains, [
        "Step",
        "Policy",
        "BusinessConcept",
        "Process",
      ]);
    if (kind === "criteria") {
      expect(`${where}.process`, item.process, ["Process"]);
      expect(`${where}.passesThrough`, item.passesThrough, ["BusinessEvent"]);
    }
  }
  list(doc.links).forEach((l, i) => {
    const where = `links[${i}]`;
    if (!nonEmpty(l?.category)) err(where, "a link names the feature's index category");
    expect(`${where}.step`, l?.step, ["Step"]);
    if (!VERDICTS.includes(l?.verdict)) err(where, `verdict must be one of ${VERDICTS.join(", ")}`);
    if (!nonEmpty(l?.reason)) err(where, "a link candidate needs its reason");
  });
  const qids = new Set();
  list(doc.questions).forEach((q, i) => {
    const where = `questions[${i}]`;
    if (qids.has(q?.id)) err(where, `duplicate question id ${q?.id}`);
    qids.add(q?.id);
    for (const s of list(q?.stages))
      if (typeOf(s) !== "Step") err(where, `stage ${s} is not a step`);
  });
  return { errors, warnings };
}

// ── the draft ──────────────────────────────────────────────────────────────

/** The single-valued attributes, which a candidate may only replace when it says so. */
const SINGLE = new Set(
  [
    "definition",
    "coreLogic",
    "stepKind",
    "reactionCondition",
    "basisKind",
    "basis",
    "startCondition",
    "businessOutcome",
    "observedResult",
    "summary",
  ]
    .map((k) => ONTO + k)
    .concat(RDFS + "label"),
);

/** The triples one candidate states, as subject-owned facts. */
function candidateTriples(kind, item, { isNew }) {
  const out = [];
  const s = iri(item.id);
  const add = (subject, p, o) => out.push({ s: subject, p, o });
  const attr = (key, value) =>
    nonEmpty(value) && add(s, key.startsWith("http") ? key : ONTO + key, text(value));
  const rel = (p, ids, subject = s) => list(ids).forEach((id) => add(subject, ONTO + p, ref(id)));
  if (isNew) add(s, RDF + "type", { type: "iri", value: ONTO + KINDS[kind] });
  attr(RDFS + "label", item.label);
  attr("definition", item.definition);
  for (const c of list(item.comment)) attr(RDFS + "comment", c);
  rel("inContext", item.context);
  for (const scope of list(item.openScope))
    add(s, ONTO + "openScope", {
      type: "literal",
      value: scope.kind === "none" ? "none" : scope.text,
      lang: null,
      datatype: OPEN_KIND_TO_DATATYPE[scope.kind],
    });
  if (kind === "contexts") {
    attr("coreLogic", item.coreLogic);
    rel("collaboratesWith", item.collaboratesWith);
  } else if (kind === "concepts") {
    for (const p of ["hasPart", "refersTo", "correspondsTo"]) rel(p, item[p]);
  } else if (kind === "processes") {
    attr("startCondition", item.startCondition);
    attr("businessOutcome", item.businessOutcome);
    attr("summary", item.summary);
    if (isNew) attr("status", "Proposed"); // a new process starts Proposed
    rel("hasStep", item.steps);
  } else if (kind === "steps") {
    attr("stepKind", item.kind);
    for (const a of list(item.performers)) add(iri(a), ONTO + "performs", ref(item.id));
    rel("flowsTo", item.flowsTo);
    rel("emits", item.emits);
    rel("uses", item.uses);
  } else if (kind === "policies") {
    attr("reactionCondition", item.condition);
    if (item.basis) (attr("basisKind", item.basis.kind), attr("basis", item.basis.text));
    for (const e of list(item.trigger)) add(iri(e), ONTO + "triggers", ref(item.id));
    rel("starts", item.starts);
    rel("uses", item.uses);
  } else if (kind === "rules") {
    if (item.basis) (attr("basisKind", item.basis.kind), attr("basis", item.basis.text));
    rel("constrains", item.constrains);
  } else if (kind === "criteria") {
    attr("startCondition", item.startCondition);
    attr("observedResult", item.observedResult);
    rel("criterionOf", item.process);
    rel("passesThrough", item.passesThrough);
  }
  return out;
}

/** Where each new subject goes: its context's document, the actors' document, or model.ttl. */
function documentPlacer(doc, current) {
  const byId = new Map(allCandidates(doc).map((c) => [c.item.id, c]));
  const ownerOfStep = new Map(
    list(doc.processes).flatMap((p) => list(p.steps).map((s) => [s, p.id])),
  );
  const memo = new Map();
  const contextOf = (cid, seen = new Set()) => {
    if (!cid || seen.has(cid)) return null;
    seen.add(cid);
    const c = byId.get(cid);
    if (!c) return null;
    const { kind, item } = c;
    if (kind === "contexts") return cid;
    if (item.context) return list(item.context)[0];
    const first = (ids) =>
      list(ids)
        .map((x) => contextOf(x, seen))
        .find(Boolean) ?? null;
    if (kind === "processes") return first(item.steps);
    if (kind === "criteria") return first(item.process);
    if (kind === "rules") return first(item.constrains);
    if (kind === "steps") return first(ownerOfStep.get(cid));
    return null;
  };
  return (subject) => {
    const known = current.home.get(subject) ?? memo.get(subject);
    if (known) return known;
    const id = elementId(subject);
    let home;
    if (byId.get(id)?.kind === "actors") home = "actors.ttl";
    else {
      const ctx = contextOf(id);
      home = (ctx && current.home.get(iri(ctx))) ?? `${ctx ?? "model"}.ttl`;
    }
    memo.set(subject, home);
    return home;
  };
}

/**
 * Merge the candidates into the current model. A current element keeps its wording unless
 * the candidate lists the attribute in `changes` (a document states the change), so the same
 * documents and model produce the same draft. Returns the documents to write and what was kept.
 */
export function mergeDraft(doc, current, { confirmedOnly = false } = {}) {
  const chosen = allCandidates(doc).filter(({ item }) => !confirmedOnly || item.confirmed === true);
  const chosenIds = new Set(chosen.map((c) => c.item.id));
  const exists = (id) => Boolean(current.index.typeOf(iri(id))) || chosenIds.has(id);
  const tripleKey = (t) => `${t.s}\0${t.p}\0${t.o.value}\0${t.o.datatype ?? ""}`;
  const single = new Map(); // `${s}\0${p}` → the current triple of a single-valued attribute
  for (const t of current.triples) if (SINGLE.has(t.p)) single.set(`${t.s}\0${t.p}`, t);
  const removed = new Set();
  const seen = new Set(current.triples.map(tripleKey));
  const added = [];
  const kept = [];
  const dropped = [];
  for (const { kind, item } of chosen) {
    const isNew = !current.index.typeOf(iri(item.id));
    const changes = new Set(
      list(item.changes).map((c) => (c === "label" ? RDFS + "label" : ONTO + c)),
    );
    for (const t of candidateTriples(kind, item, { isNew })) {
      // A relation to an element the draft does not hold (unconfirmed) is left out.
      const other =
        t.s !== iri(item.id) ? elementId(t.s) : t.o.type === "iri" ? elementId(t.o.value) : null;
      if (other && !exists(other)) {
        dropped.push(`${item.id} ${t.p.replace(ONTO, "")} ${other}`);
        continue;
      }
      if (seen.has(tripleKey(t))) continue;
      const old = !isNew && SINGLE.has(t.p) ? single.get(`${t.s}\0${t.p}`) : null;
      if (old) {
        if (!changes.has(t.p)) {
          kept.push(`${item.id} ${t.p.replace(ONTO, "").replace(RDFS, "rdfs:")}`);
          continue;
        }
        removed.add(old);
      }
      seen.add(tripleKey(t));
      added.push(t);
    }
  }
  // Place each subject's triples in its document; only touched documents are rewritten.
  const place = documentPlacer(doc, current);
  const byDoc = new Map();
  const touched = new Set();
  const put = (t, isAdded) => {
    const home = place(t.s);
    if (!byDoc.has(home)) byDoc.set(home, []);
    byDoc.get(home).push(t);
    if (isAdded) touched.add(home);
  };
  for (const t of current.triples)
    if (removed.has(t)) touched.add(current.home.get(t.s));
    else put(t, false);
  for (const t of added) put(t, true);
  const documents = current.docs.map((d) =>
    touched.has(d.doc)
      ? { doc: d.doc, text: serializeTurtle(byDoc.get(d.doc) ?? []), rewritten: true }
      : { doc: d.doc, text: readFileSync(d.file, "utf8"), rewritten: false },
  );
  for (const [name, ts] of byDoc)
    if (!current.docs.some((d) => d.doc === name))
      documents.push({ doc: name, text: serializeTurtle(ts), rewritten: true, created: true });
  return { documents, kept, dropped };
}

// ── board, index, questions and summary ────────────────────────────────────

const labelOf = (doc, current, id) => {
  const c = allCandidates(doc).find((x) => x.item.id === id);
  if (c?.item.label) return c.item.label;
  const label = current.index.subjects.get(iri(id))?.props.get(RDFS + "label")?.[0]?.o.value;
  return label ?? id;
};

/** The EventStorming board: one stage per candidate step, links from flows and policies. */
export function candidateBoard(doc, current) {
  const ko = (doc.language ?? "ko") === "ko";
  const steps = list(doc.steps);
  const stepIds = new Set(steps.map((s) => s.id));
  const contextOfStep = (s) => {
    if (s.context) return list(s.context)[0];
    const p = list(doc.processes).find((x) => list(x.steps).includes(s.id));
    return (
      p?.context ??
      (p &&
        list(p.steps)
          .map((id) => steps.find((x) => x.id === id)?.context)
          .find(Boolean))
    );
  };
  const policiesFrom = (step) =>
    list(doc.policies).filter((p) => list(p.trigger).some((e) => list(step.emits).includes(e)));
  const stages = steps.map((s) => {
    const ctx = contextOfStep(s);
    const event = list(s.emits)[0];
    const eventItem = list(doc.events).find((e) => e.id === event);
    return {
      id: s.id,
      context: ctx ? labelOf(doc, current, ctx) : ko ? "경계 미확인" : "Boundary unknown",
      contextId: ctx ?? null,
      actor:
        list(s.performers)
          .map((a) => labelOf(doc, current, a))
          .join(", ") || undefined,
      action: s.label ?? labelOf(doc, current, s.id),
      businessStatus: s.planned
        ? "planned"
        : s.verdict === "unconfirmed"
          ? "unconfirmed"
          : "current",
      entities: list(s.entities),
      event: event
        ? { name: labelOf(doc, current, event), description: eventItem?.definition ?? "" }
        : null,
      policies: policiesFrom(s).map((p) => `${p.label}: ${p.condition ?? ""}`.trim()),
      rules: list(doc.rules)
        .filter((r) => list(r.constrains).includes(s.id))
        .map((r) => ({
          name: r.label,
          description: r.definition,
          scope: ko ? "이 단계를 제약" : "constrains this step",
          verdict: r.verdict,
          evidence: list(r.evidence),
        })),
      views: list(s.views),
      verdict: s.verdict,
      evidence: list(s.evidence),
    };
  });
  const links = [];
  for (const s of steps) {
    for (const to of list(s.flowsTo))
      if (stepIds.has(to))
        links.push({
          from: s.id,
          to,
          label: ko ? "다음 단계" : "next step",
          relation: "sequence",
          verdict: s.verdict,
          evidence: list(s.evidence),
        });
    for (const p of policiesFrom(s))
      for (const to of list(p.starts))
        if (stepIds.has(to))
          links.push({
            from: s.id,
            to,
            label: p.label,
            relation: "causal",
            condition: p.condition ?? null,
            verdict: p.verdict,
            evidence: list(p.evidence),
          });
  }
  const board = {
    version: 1,
    origin: "candidate",
    title: doc.title,
    scope: doc.scope,
    ...(doc.domain ? { domain: doc.domain } : {}),
    contexts: list(doc.contexts).map((c) => ({
      id: c.id,
      name: c.label ?? labelOf(doc, current, c.id),
      description: c.definition ?? "",
      verdict: c.verdict,
      evidence: list(c.evidence),
    })),
    subdomains: list(doc.subdomains),
    stages,
    links,
    questions: list(doc.questions)
      .filter((q) => list(q.stages).length)
      .map((q) => ({
        id: q.id,
        text: q.text,
        scope: q.scope ?? list(q.stages)[0],
        scopeType: q.scopeType ?? "step",
        stages: list(q.stages),
        verdict: q.verdict ?? "unconfirmed",
        evidence: list(q.evidence),
      })),
  };
  for (const k of ["contexts", "subdomains", "questions"]) if (!board[k].length) delete board[k];
  return board;
}

/** The ADR index with each candidate `realizes` link added once, in candidate order. */
export function candidateMapping(doc, mapping, { confirmedOnly = false } = {}) {
  const next = structuredClone(mapping ?? { categories: {} });
  const errors = [];
  for (const l of list(doc.links)) {
    if (confirmedOnly && l.confirmed !== true) continue;
    const entry = next.categories?.[l.category];
    if (!entry) {
      errors.push(`links: no index category ${l.category}`);
      continue;
    }
    entry.realizes = Array.isArray(entry.realizes) ? entry.realizes : [];
    if (!entry.realizes.includes(l.step)) entry.realizes.push(l.step);
  }
  return { mapping: next, errors };
}

const mermaidText = (s) =>
  String(s)
    .replace(/["\n\r]/g, " ")
    .replace(/[[\]{}()<>|#;]/g, " ");

/** A Mermaid flow of a question's steps and the links among them, when it has none. */
function questionDiagram(q, board) {
  const ids = new Set(list(q.stages));
  if (!ids.size) return undefined;
  const node = new Map([...ids].map((id, i) => [id, `S${i}`]));
  const lines = ["flowchart LR"];
  for (const s of board.stages.filter((x) => ids.has(x.id)))
    lines.push(`  ${node.get(s.id)}["${mermaidText(s.action)}"]`);
  for (const l of board.links.filter((x) => ids.has(x.from) && ids.has(x.to)))
    lines.push(
      `  ${node.get(l.from)} ${l.relation === "sequence" ? "-.->" : "-->"}|"${mermaidText(l.label)}"| ${node.get(l.to)}`,
    );
  return { source: lines.join("\n") };
}

/** The web session's question file; questions keep their ids across rewrites. */
export function candidateQuestions(doc, board, current) {
  const groupOf = (q) => {
    const stage = board.stages.find((s) => list(q.stages).includes(s.id));
    return q.group ?? stage?.context;
  };
  return {
    version: 1,
    title: doc.questionTitle ?? doc.title,
    ...(doc.questionIntro ? { intro: doc.questionIntro } : {}),
    questions: list(doc.questions).map((q) => {
      const out = { id: q.id, text: q.text };
      for (const k of ["detail", "options", "evidence", "resolved", "allowText", "closed"])
        if (q[k] !== undefined) out[k] = q[k];
      const group = groupOf(q);
      if (group) out.group = group;
      const diagram = q.diagram ?? questionDiagram(q, board);
      if (diagram) out.diagram = diagram;
      return out;
    }),
  };
}

/** Per-context review counts the report can show: verdicts, planned items and basis gaps. */
export function candidateSummary(doc, check) {
  const contexts = new Map();
  const ctxOf = (kind, item) =>
    kind === "contexts" ? item.id : (list(item.context)[0] ?? "(no context)");
  for (const { kind, item } of allCandidates(doc)) {
    const c = ctxOf(kind, item);
    if (!contexts.has(c))
      contexts.set(c, {
        context: c,
        counts: {},
        verdicts: {},
        planned: [],
        basisGaps: [],
        needsConfirmation: [],
      });
    const e = contexts.get(c);
    e.counts[kind] = (e.counts[kind] ?? 0) + 1;
    e.verdicts[item.verdict] = (e.verdicts[item.verdict] ?? 0) + 1;
    if (item.planned) e.planned.push(item.id);
    if ((kind === "policies" || kind === "rules") && !item.basis) e.basisGaps.push(item.id);
    if (item.verdict !== "stated" && item.confirmed !== true) e.needsConfirmation.push(item.id);
  }
  return {
    title: doc.title,
    scope: doc.scope,
    contexts: [...contexts.values()].sort((a, b) => compareCodePoints(a.context, b.context)),
    links: list(doc.links).length,
    questions: list(doc.questions).length,
    notHeld: list(doc.notHeld).length,
    warnings: check.warnings,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────

function usage(message) {
  if (message) console.error(`ontology-candidates: ${message}`);
  console.error(
    readFileSync(new URL(import.meta.url), "utf8")
      .split("\n")
      .filter((l) => l.startsWith("//   bun ") || l.startsWith("//          "))
      .map((l) => l.slice(3))
      .join("\n"),
  );
  process.exit(2);
}

function main(argv) {
  const [command, file, ...rest] = argv;
  if (!["check", "prepare"].includes(command) || !file) usage();
  const flag = (name, fallback = null) => {
    const i = rest.indexOf(name);
    return i >= 0 ? (rest[i + 1] ?? usage(`${name} requires a value`)) : fallback;
  };
  const ontologyDir = path.resolve(flag("--ontology-dir", "docs/ontology"));
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    usage(`cannot read ${file}: ${error.message}`);
  }
  const current = readCurrentModel(ontologyDir);
  if (current.broken.length)
    usage(
      `the current model does not parse (${current.broken.map((d) => d.doc).join(", ")}); run ontology.mjs validate`,
    );
  const check = checkCandidates(doc, current);
  const json = rest.includes("--json");
  const say = (result) => {
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const e of result.errors ?? []) console.log(`✗ ${e}`);
      for (const w of result.warnings ?? []) console.log(`⚠ ${w}`);
      for (const [k, v] of Object.entries(result.wrote ?? {})) console.log(`${k}: ${v}`);
      if (!(result.errors ?? []).length) console.log("✓ candidates usable");
    }
  };
  if (command === "check" || check.errors.length) {
    say(check);
    process.exit(check.errors.length ? 1 : 0);
  }

  const runFlag = flag("--run");
  if (!runFlag) usage("prepare needs --run <run directory>");
  const run = path.resolve(runFlag);
  if (run === ontologyDir || run.startsWith(ontologyDir + path.sep))
    usage("the run directory must not be inside the model directory");
  const confirmedOnly = rest.includes("--confirmed-only");
  const mappingFile = path.resolve(flag("--mapping", "docs/adr/.mapping.json"));
  const mapping = existsSync(mappingFile) ? JSON.parse(readFileSync(mappingFile, "utf8")) : null;
  const wrote = {};
  const write = (name, content) => {
    const target = path.join(run, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    return target;
  };

  const { documents, kept, dropped } = mergeDraft(doc, current, { confirmedOnly });
  const draftDir = confirmedOnly ? "save-draft" : "draft";
  for (const d of documents) write(path.join(draftDir, d.doc), d.text);
  wrote.draft = path.join(run, draftDir);
  const warnings = [
    ...check.warnings,
    ...dropped.map(
      (d) => `${d}: left out, because that element is not in this draft (confirm it too)`,
    ),
    ...kept.map(
      (k) =>
        `${k}: kept the current wording (list it in changes when a document states the change)`,
    ),
  ];

  const errors = [];
  if (mapping) {
    const m = candidateMapping(doc, mapping, { confirmedOnly });
    errors.push(...m.errors);
    wrote.mapping = write(
      confirmedOnly ? "mapping.save.json" : "mapping.draft.json",
      `${JSON.stringify(m.mapping, null, 2)}\n`,
    );
  }
  if (!confirmedOnly) {
    const board = candidateBoard(doc, current);
    const boardErrors = validateEventBoard(board);
    errors.push(...boardErrors.map((e) => `board ${e}`));
    wrote.board = write("board.json", `${JSON.stringify(board, null, 2)}\n`);
    if (list(doc.questions).length) {
      const questions = candidateQuestions(doc, board, current);
      const parsed = parseQuestions(JSON.stringify(questions));
      if (!parsed.ok) errors.push(`questions: ${parsed.error}`);
      else wrote.questions = write("ask/questions.json", `${JSON.stringify(questions, null, 2)}\n`);
    }
    wrote.summary = write(
      "candidates-summary.json",
      `${JSON.stringify(candidateSummary(doc, { warnings }), null, 2)}\n`,
    );
  }
  say({ errors, warnings, wrote });
  process.exit(errors.length ? 1 : 0);
}

if (import.meta.main) main(process.argv.slice(2));
