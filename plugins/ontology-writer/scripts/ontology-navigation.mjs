// Read-only, progressively disclosed views of the same business graph.
// Collections are rows, including relationships and diagnostics, so a highly
// connected context cannot hide an unbounded list inside one navigation card.
import {
  ONTO,
  RDFS,
  contextCollaborations,
  elementId,
  elementIri,
  isRetired,
  isVisible,
  knowledgeLayerFindings,
  processOfStep,
  processStatus,
  ruleReach,
  compareCodePoints as compare,
  sortedUnique as sorted,
} from "./ontology-lib.mjs";
import { ontologySearch } from "./ontology-search.mjs";
import { bestSearchHit, compareSearchHits, parseSearchQuery } from "./search/search-text.mjs";

const DETAIL_KINDS = {
  BoundedContext: "context",
  Process: "process",
  Step: "step",
  BusinessConcept: "concept",
  BusinessEvent: "event",
};
const NAVIGATION_NOTE =
  "Navigation only: summaries, search matches and pages are not complete business-contract evidence. Follow the next page and relevant boundary/detail queries; no match is not evidence that no business rule applies. Read realizing ADRs for implementation obligations.";

/** Bounded collection defaults are replaceable presentation choices, not model facts. */
export function navigationOptions({ limit = null, offset = 0, search = "" } = {}) {
  if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100))
    throw new Error("navigation --limit must be an integer from 1 to 100");
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("navigation --offset must be a non-negative safe integer");
  if (typeof search !== "string") throw new Error("navigation --search must be text");
  parseSearchQuery(search);
  return { limit, offset, search: search.trim() };
}

/**
 * Project BC responsibilities, internal work and explicit boundary relations.
 * A process participates in each of its steps' contexts; it never acquires a
 * new owner. Boundary rows preserve the source relation, including noncausal
 * sequence and shared rules. Only selected-context elements receive detail.
 * The returned scope is independent of search/page, so hidden errors and edits
 * still prevent treating a navigation result as a settled reference.
 */
export function projectNavigation(index, { target, includeRetired = false, search = "" }) {
  const scope = new Set();
  const rows = new Map();
  const layerFindings = layerFindingsOf(index);
  const incompleteContexts = new Set(layerFindings.map((f) => f.element));
  search = search.trim();
  const hits = search ? ontologySearch(index, search, { includeRetired }) : new Map();
  const text = (iri, attr) => index.literal(iri, attr)[0]?.value ?? null;
  const visible = (iri) => isVisible(index, iri, includeRetired);
  const ref = (iri) => ({ id: elementId(iri) ?? iri, label: text(iri, `${RDFS}label`) });
  const query = (iri) => {
    const kind = DETAIL_KINDS[index.typeOf(iri)];
    return kind ? { kind, id: elementId(iri) } : null;
  };
  const ruleSteps = new Map();
  const stepsOfRule = (iri) => {
    if (!ruleSteps.has(iri)) ruleSteps.set(iri, ruleReach(index, iri));
    return ruleSteps.get(iri);
  };
  const memberships = new Map();
  // Only explicit membership and the named participation relations determine
  // context. Neither id prefixes nor ADR category names establish a BC.
  const contextsOf = (iri) => {
    if (memberships.has(iri)) return memberships.get(iri);
    memberships.set(iri, []);
    let contexts = index.out(iri, "inContext");
    const type = index.typeOf(iri);
    if (type === "BoundedContext") contexts = [iri];
    else if (type === "Process")
      contexts = index
        .out(iri, "hasStep")
        .filter((s) => index.typeOf(s) === "Step" && visible(s))
        .flatMap(contextsOf);
    else if (type === "Actor")
      contexts = index
        .out(iri, "performs")
        .filter((s) => index.typeOf(s) === "Step" && visible(s))
        .flatMap(contextsOf);
    else if (type === "BusinessRule")
      contexts = stepsOfRule(iri).filter(visible).flatMap(contextsOf);
    else if (type === "ObservationCriterion")
      contexts = index
        .out(iri, "criterionOf")
        .filter((p) => index.typeOf(p) === "Process" && visible(p))
        .flatMap(contextsOf);
    const value = sorted(contexts.filter((c) => index.typeOf(c) === "BoundedContext"));
    memberships.set(iri, value);
    return value;
  };
  const add = (key, row, sources) => {
    for (const iri of sources) scope.add(iri);
    const best = bestSearchHit(sources.map((iri) => hits.get(iri)));
    if (search && !best) return;
    rows.set(key, { key, ...row, ...(best ? { searchMatch: best } : {}) });
  };
  const contextCard = (iri) => ({
    ...ref(iri),
    definition: text(iri, "definition"),
    coreLogic: text(iri, "coreLogic"),
    knowledgeComplete: !incompleteContexts.has(elementId(iri)),
    query: query(iri),
  });
  const relationRow = (t) => ({
    relation: t.p.slice(ONTO.length),
    from: ref(t.s),
    to: ref(t.o.value),
    fromQuery: query(t.s),
    toQuery: query(t.o.value),
  });

  if (target.kind === "overview") {
    const contexts = index.ofType("BoundedContext");
    // Global scope also includes malformed and unassigned elements, even when
    // they cannot be projected to a valid BC card.
    for (const iri of index.subjects.keys()) scope.add(iri);
    // Hits already hold exactly the visible matches; the count and the best hit
    // (a total order) do not depend on the order they are visited in.
    const matches = new Map();
    for (const [iri, hit] of hits)
      for (const context of contextsOf(iri)) {
        const seen = matches.get(context);
        matches.set(context, {
          count: (seen?.count ?? 0) + 1,
          best: bestSearchHit([seen?.best, hit]),
        });
      }
    for (const c of contexts) {
      const matched = matches.get(c);
      if (search && !matched) continue;
      const key = `0-context:${c}`;
      rows.set(key, {
        key,
        kind: "context",
        ...contextCard(c),
        ...(search
          ? {
              matchingElements: matched.count,
              query: { ...query(c), search },
              searchMatch: {
                id: elementId(c),
                tier: matched.best.tier,
                score: matched.best.score,
                kind: matched.best.id === c ? matched.best.kind : "internal",
              },
            }
          : {}),
      });
    }
    // Read declared upper knowledge only. Lower-level event and rule edges
    // belong in the selected BC, regardless of how many there are.
    for (const [from, to] of contextCollaborations(index)) {
      if (search && !matches.has(from) && !matches.has(to)) continue;
      const key = `1-collaboration:${JSON.stringify([from, to])}`;
      rows.set(key, {
        key,
        kind: "collaboration",
        from: ref(from),
        to: ref(to),
        fromQuery: query(from),
        toQuery: query(to),
      });
    }
    return {
      found: true,
      scope,
      items: [...rows.values()],
      contextCount: contexts.length,
      knowledgeLayerComplete: layerFindings.length === 0 && contexts.length > 0,
      layerFindings,
    };
  }

  const context = elementIri(target.id);
  scope.add(context);
  if (index.typeOf(context) !== "BoundedContext")
    return {
      found: false,
      scope,
      items: [],
      note: `no BoundedContext "${target.id}" in the model`,
    };
  const core = new Set(index.into(context, "inContext").filter(visible));
  const processes = new Set();
  const criteria = new Set();
  const rules = new Set();
  const members = new Set(core);
  for (const iri of core) {
    if (index.typeOf(iri) !== "Step") continue;
    for (const p of index.into(iri, "hasStep").filter(visible)) processes.add(p);
    for (const a of index.into(iri, "performs")) members.add(a);
  }
  for (const p of processes) {
    members.add(p);
    for (const c of index.into(p, "criterionOf")) criteria.add(c);
  }
  for (const r of index.ofType("BusinessRule")) {
    const reached = stepsOfRule(r);
    if (reached.some((s) => core.has(s)) || index.out(r, "constrains").some((s) => core.has(s)))
      rules.add(r);
  }
  for (const x of [...criteria, ...rules]) members.add(x);
  for (const iri of sorted(members)) {
    const type = index.typeOf(iri);
    const row = {
      kind: "element",
      ...ref(iri),
      type,
      definition: text(iri, "definition"),
      query: query(iri),
    };
    if (type === "Step") {
      const p = processOfStep(index, iri);
      row.process = p ? { ...ref(p), status: processStatus(index, p) } : null;
      row.stepKind = text(iri, "stepKind");
    }
    if (type === "Process") {
      row.status = processStatus(index, iri);
      row.retired = isRetired(index, iri);
      row.participation = "contains steps of the selected BC; this is not exclusive ownership";
      row.startCondition = text(iri, "startCondition");
      row.businessOutcome = text(iri, "businessOutcome");
    }
    if (type === "Policy" || type === "BusinessRule") {
      row.basisKind = text(iri, "basisKind");
      row.basis = text(iri, "basis");
      if (type === "Policy") row.reactionCondition = text(iri, "reactionCondition");
    }
    if (type === "ObservationCriterion") {
      row.startCondition = text(iri, "startCondition");
      row.observedResult = text(iri, "observedResult");
    }
    add(`0-element:${iri}`, row, [iri]);
    for (const o of index.literal(iri, "openScope"))
      add(
        `1-open-scope:${JSON.stringify([iri, o.value, o.datatype])}`,
        {
          kind: "open-scope",
          element: ref(iri),
          value: o.value,
          scopeKind: o.datatype?.replace(ONTO, ""),
        },
        [iri],
      );
  }
  for (const t of index.triples) {
    if (!t.p.startsWith(ONTO) || t.p === `${ONTO}inContext` || t.o.type !== "iri") continue;
    const relevant =
      core.has(t.s) ||
      core.has(t.o.value) ||
      (rules.has(t.s) && t.p === `${ONTO}constrains`) ||
      criteria.has(t.s) ||
      (processes.has(t.s) && t.p === `${ONTO}hasStep`);
    if (!relevant || !visible(t.s) || !visible(t.o.value)) continue;
    add(
      `2-relation:${JSON.stringify([t.s, t.p, t.o.value])}`,
      {
        kind: "relation",
        ...relationRow(t),
        external: !members.has(t.s) || !members.has(t.o.value),
      },
      [t.s, t.o.value],
    );
    // Boundary destinations are individual rows, not an unbounded nested list.
    for (const c of [...contextsOf(t.s), ...contextsOf(t.o.value)])
      if (c !== context)
        add(`3-neighbor:${c}`, { kind: "neighbor", ...contextCard(c) }, [c, t.s, t.o.value]);
  }
  for (const pair of contextCollaborations(index)) {
    if (!pair.includes(context)) continue;
    const neighbor = pair.find((c) => c !== context);
    add(`3-neighbor:${neighbor}`, { kind: "neighbor", ...contextCard(neighbor) }, [
      context,
      neighbor,
    ]);
  }
  return {
    found: true,
    scope,
    context: contextCard(context),
    items: [...rows.values()],
    layerFindings: layerFindings.filter((f) => f.element === target.id),
    knowledgeLayerComplete: !incompleteContexts.has(target.id),
  };
}

/** Preserve diagnostic order so page offsets address the same entries. */
function detailDiagnostics(errors, layerFindings, changes) {
  const diagnostics = [];
  const add = (flag, value) => diagnostics.push({ kind: "diagnostic", flag, ...value });
  for (const error of errors) add("validation-error", { error });
  for (const finding of layerFindings) add("knowledge-layer-incomplete", { finding });
  if (changes) {
    if (!changes.available) add("changes-unavailable", { reason: changes.reason });
    else {
      if (changes.committedUnavailable)
        add("committed-changes-unavailable", { reason: changes.committedUnavailable });
      for (const doc of changes.uncommittedDocuments ?? [])
        add("uncommitted-document", { document: doc });
      for (const change of changes.uncommittedChanges) add("uncommitted", change);
      for (const u of changes.unsyncedAccepted) {
        const flags = {
          process: u.process,
          compositionChanged: u.compositionChanged,
          ...(u.lastAcceptedUncertain ? { lastAcceptedUncertain: u.lastAcceptedUncertain } : {}),
        };
        for (const change of u.changes.length ? u.changes : [{}])
          add("unsynced-accepted", { ...flags, ...change });
      }
      for (const u of changes.unsyncedUnknown ?? []) add("accepted-history-unknown", u);
      for (const u of changes.lifecycleEdits)
        for (const reason of u.findings) add("lifecycle-edit", { process: u.process, reason });
      if (changes.uncommittedElsewhere) add("uncommitted-elsewhere", {});
      if (changes.unsyncedAcceptedElsewhere) add("unsynced-accepted-elsewhere", {});
      for (const reason of changes.unsyncedUnknownElsewhere ?? [])
        add("accepted-history-unknown-elsewhere", { reason });
    }
  }
  return diagnostics;
}

/** The BC overview summarizes internal diagnostics without expanding them. */
function overviewDiagnostics(errors, changes) {
  return {
    validationSample: errors.slice(0, 3),
    diagnosticDetails: "Run validate for all positions, or query a selected BC for scoped details.",
    changeSummary: changes
      ? {
          available: changes.available,
          uncommittedElements: changes.uncommitted?.length ?? null,
          unsyncedProcesses: changes.unsyncedAccepted?.length ?? null,
          uncertainProcesses: changes.unsyncedUnknown?.length ?? null,
          lifecycleEdits: changes.lifecycleEdits?.length ?? null,
          ...(!changes.available ? { reason: changes.reason } : {}),
          ...(changes.committedUnavailable
            ? { committedUnavailable: changes.committedUnavailable }
            : {}),
        }
      : null,
  };
}

/**
 * Include diagnostics in the same bounded row stream as navigation. Validation
 * completeness covers the whole selected scope, never just the visible page.
 * Change details remain individually accessible even when there are more edits
 * or errors than fit in the first response.
 */
export function pageNavigation(result, options) {
  const { limit: requestedLimit, offset, search } = navigationOptions(options);
  const { items = [], errors = [], changes, layerFindings = [], ...base } = result;
  const overview = result.kind === "overview";
  const limit = requestedLimit ?? (overview ? Math.max(items.length, 1) : 20);
  const diagnostics = overview ? [] : detailDiagnostics(errors, layerFindings, changes);
  const all = [
    ...diagnostics.map((d, i) => ({ key: `diagnostic:${i}`, ...d })),
    ...items.sort(
      (a, b) => compareSearchHits(a.searchMatch, b.searchMatch) || compare(a.key, b.key),
    ),
  ];
  const selected = all.slice(offset, offset + limit);
  const nextOffset = offset + selected.length < all.length ? offset + selected.length : null;
  return {
    ...base,
    resolution: result.kind === "overview" ? "bounded-contexts" : "inside-bounded-context",
    search: search || null,
    navigationOnly: true,
    errorCount: errors.length,
    diagnosticCount: diagnostics.length,
    layerIssueCount: layerFindings.length,
    ...(overview ? overviewDiagnostics(errors, changes) : {}),
    itemCount: items.length,
    page: { offset, limit, returned: selected.length, total: all.length, nextOffset },
    next:
      nextOffset === null
        ? null
        : {
            target: { kind: result.kind, id: result.id },
            ...options,
            search,
            limit,
            offset: nextOffset,
          },
    items: selected,
    note: [result.note, NAVIGATION_NOTE].filter(Boolean).join(" "),
  };
}

/** Plain text exposes every field of the bounded page, including exact follow-up inputs. */
export function renderNavigation(result) {
  const lines = [
    `Business navigation — ${result.kind}${result.id ? ` "${result.id}"` : ""}`,
    result.note,
    `Validation: ${result.complete ? "no errors in the selected scope" : "INCOMPLETE — do not treat this scope as a settled reference"}; errors: ${result.errorCount}; diagnostics: ${result.diagnosticCount}.`,
    `Page: offset ${result.page.offset}, returned ${result.page.returned} of ${result.page.total}; limit ${result.page.limit}.`,
  ];
  if (result.found === false) lines.push("NOT FOUND");
  if (result.context) lines.push(`Context: ${JSON.stringify(result.context)}`);
  lines.push(
    `Knowledge-layer structure: ${result.knowledgeLayerComplete ? "complete in the selected scope" : "incomplete or unverified"}; issues: ${result.layerIssueCount}. This does not establish business completeness.`,
  );
  if (result.validationSample?.length)
    lines.push(
      `Validation sample: ${JSON.stringify(result.validationSample)}; ${result.diagnosticDetails}`,
    );
  if (result.changeSummary)
    lines.push(
      `Change summary: ${JSON.stringify(result.changeSummary)}; query the selected BC before relying on its knowledge.`,
    );
  for (const item of result.items) lines.push(JSON.stringify(item));
  if (result.next) lines.push(`Next query: ${JSON.stringify(result.next)}`);
  return lines.join("\n") + "\n";
}

// The knowledge-layer check of a model, run once per indexed graph: a view asks for every
// context's navigation over the same graph, which is never mutated.
const LAYER_FINDINGS = new WeakMap();
function layerFindingsOf(index) {
  if (!LAYER_FINDINGS.has(index)) LAYER_FINDINGS.set(index, knowledgeLayerFindings(index));
  return LAYER_FINDINGS.get(index);
}
