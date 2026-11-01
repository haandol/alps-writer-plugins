// process-model-query.mjs — deterministic business-context queries over the
// process model and the ADR index. Pure functions:
// callers pass the indexed model, the mapping, validation findings and change
// flags, and get back only the elements connected to the target.

import { classifyStatus } from "./adr-lint-lib.mjs";
import {
  PM,
  RDFS,
  elementId,
  elementIri,
  inRetiredOnly,
  isSystemStep,
  isValidElementId,
  isRetired,
  openScopeOf,
  processOfStep,
  processStatus,
} from "./process-model-lib.mjs";

const LABEL = `${RDFS}label`;
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (list) => [...new Set(list)].sort(byId);

/** Categories realizing each step id, with their ADR paths and Status. */
export function realizersByStep(mapping) {
  const out = new Map();
  for (const [category, entry] of Object.entries(mapping?.categories ?? {})) {
    if (!Array.isArray(entry?.realizes)) continue;
    const adrs = (Array.isArray(entry.adrs) ? entry.adrs : [])
      .filter((r) => r && typeof r.path === "string")
      .map((r) => ({ path: r.path, status: typeof r.status === "string" ? r.status : null }));
    for (const id of entry.realizes) {
      if (typeof id !== "string") continue;
      if (!out.has(id)) out.set(id, []);
      out.get(id).push({ category, adrs });
    }
  }
  for (const list of out.values()) list.sort((a, b) => byId(a.category, b.category));
  return out;
}

/** Findings that make a feature's ADR records untrustworthy for the gates and for realization. */
const ADR_RECORD_FINDINGS = new Set([
  "process-adr-status-mismatch",
  "process-adr-missing",
  "process-adr-unindexed",
  "process-adr-record-invalid",
]);

/**
 * Realization inputs the reading reports as untrustworthy: the whole ADR index
 * when it cannot be read or holds a link record that is not a list of step ids
 * (any step may be one it links), and the features whose ADR records the files
 * contradict — a body Status that differs, a listed file that cannot be read, a
 * file of the feature the index does not list, or a record that names no ADR file
 * of the feature's own folder.
 *
 * @returns {{unreadable: boolean, all: boolean, categories: Set<string>}} `unreadable`
 *   when no link can be read at all.
 */
export function untrustedRealization(findings) {
  const errors = findings.filter((f) => f.level === "error");
  const unreadable = errors.some((f) => f.code === "process-index-unreadable");
  return {
    unreadable,
    all: unreadable || errors.some((f) => f.code === "process-link-shape"),
    categories: new Set(
      errors.filter((f) => ADR_RECORD_FINDINGS.has(f.code)).map((f) => f.category),
    ),
  };
}

/** Whether a step's realization can be told from the index, given its realizing features. */
export const realizationKnown = (untrusted, realizers) =>
  !untrusted.all && !realizers.some((r) => untrusted.categories.has(r.category));

/**
 * Whether a realizing feature is implemented: at least one Accepted ADR, no
 * Proposed ADR and no ADR record whose Status is invalid. Retired ADRs do not
 * count either way.
 *
 * @param {{status?: unknown}[]} adrs The feature's ADR records.
 */
export function implementationState(adrs) {
  let accepted = 0;
  let proposed = 0;
  let invalid = 0;
  for (const rec of Array.isArray(adrs) ? adrs : []) {
    const st = classifyStatus(rec?.status);
    if (!st.ok) {
      invalid++;
      continue;
    }
    // The classified value: a Status written with stray spaces still counts as itself.
    if (/^Accepted/.test(st.value)) accepted++;
    else if (st.value === "Proposed") proposed++;
  }
  return { accepted, proposed, invalid, implemented: accepted > 0 && proposed === 0 && !invalid };
}

/**
 * Build the business context of one target.
 *
 * @param {object} input
 * @param {object|null} input.index Indexed model, or null when a document failed to parse.
 * @param {object|null} input.mapping Parsed .mapping.json.
 * @param {object[]} input.findings Validation findings of the same model reading.
 * @param {object|null} input.changes Change flags from the repository history.
 * @param {{kind: "category"|"process"|"concept"|"event", id: string}} input.target
 * @param {boolean} [input.includeRetired] Include Deprecated and Superseded processes.
 * @param {Set<string>} [input.scopeOut] Filled with the IRIs of the result's scope.
 */
export function queryContext({
  index,
  mapping,
  findings = [],
  changes = null,
  target,
  includeRetired = false,
  scopeOut = null,
}) {
  const base = { kind: target.kind, id: target.id };
  if (!index) {
    return {
      ...base,
      found: null,
      complete: false,
      errors: findings.filter((f) => f.level === "error"),
      note: "the model could not be parsed, so the scope cannot be determined; fix the reported position first",
    };
  }

  const scope = new Set();
  const realizers = realizersByStep(mapping);
  const typeOf = (iri) => index.typeOf(iri);
  const text = (iri, attr) => index.literal(iri, attr)[0]?.value ?? null;
  const label = (iri) => text(iri, LABEL);
  const visible = (stepIri) => includeRetired || !inRetiredOnly(index, stepIri);
  const ref = (iri, extra = {}) => {
    scope.add(iri);
    return { id: elementId(iri), label: label(iri), ...extra };
  };
  const processRef = (p) =>
    p
      ? ref(p, {
          status: processStatus(index, p),
          ...(isRetired(index, p) ? { retired: true } : {}),
        })
      : null;
  // A realization the index cannot be trusted for is unknown, never stated: the
  // readable links stay, and a feature whose ADR record cannot be trusted is marked.
  const untrusted = untrustedRealization(findings);
  const stepRef = (s) => {
    const by = untrusted.unreadable ? [] : (realizers.get(elementId(s)) ?? []);
    // An outside-system step is never a realization target, so its realization is never unknown.
    const system = isSystemStep(index, s);
    const known = !system || realizationKnown(untrusted, by);
    return ref(s, {
      process: processRef(processOfStep(index, s)),
      realizedBy: by.map((r) =>
        untrusted.categories.has(r.category) ? { ...r, untrusted: true } : r,
      ),
      ...(known ? {} : { realizationUnknown: true }),
    });
  };
  const contextRef = (iri) => {
    const ctx = index.out(iri, "inContext")[0];
    return ctx ? ref(ctx) : null;
  };
  const policyRef = (p) => ref(p, { reactionCondition: text(p, "reactionCondition") });
  const eventRef = (e) => ref(e, { context: contextRef(e) });
  const conceptRef = (c) => ref(c, { definition: text(c, "definition"), context: contextRef(c) });
  const ruleRef = (r, via) =>
    ref(r, {
      definition: text(r, "definition"),
      basisKind: text(r, "basisKind"),
      basis: text(r, "basis"),
      via,
    });
  const steps = (list) =>
    sorted(list)
      .filter((s) => elementId(s) && typeOf(s) === "Step" && visible(s))
      .map(stepRef);
  // A policy that only starts steps of retired processes belongs to them.
  const reachesVisible = (p) => includeRetired || !inRetiredOnly(index, p);
  const policiesStarting = (list) =>
    sorted(list)
      .filter((p) => elementId(p) && typeOf(p) === "Policy" && reachesVisible(p))
      .map((p) => ({ policy: policyRef(p), starts: steps(index.out(p, "starts")) }));

  /** Rules on the step, its process, the policies starting it and the concepts it uses. */
  const applicableRules = (s) => {
    const p = processOfStep(index, s);
    const targets = [
      [s, "step"],
      ...(p ? [[p, "process"]] : []),
      ...sorted(index.into(s, "starts")).map((x) => [x, `policy ${elementId(x)}`]),
      ...sorted(index.out(s, "uses")).map((x) => [x, `concept ${elementId(x)}`]),
    ];
    const via = new Map();
    for (const [t, how] of targets)
      for (const r of index.into(t, "constrains"))
        if (typeOf(r) === "BusinessRule") via.set(r, [...(via.get(r) ?? []), how]);
    return [...via.keys()].sort(byId).map((r) => ruleRef(r, via.get(r)));
  };

  /** One step's context: neighbours, upstream and downstream hand-offs, shared concepts, rules, open scope. */
  const stepContext = (s) => {
    const p = processOfStep(index, s);
    return {
      step: stepRef(s),
      previous: steps(index.into(s, "flowsTo")),
      next: steps(index.out(s, "flowsTo")),
      startedBy: sorted(index.into(s, "starts"))
        .filter((x) => elementId(x) && typeOf(x) === "Policy")
        .map((policy) => ({
          policy: policyRef(policy),
          events: sorted(index.into(policy, "triggers")).map((e) => ({
            ...eventRef(e),
            emittedBy: steps(index.into(e, "emits")),
          })),
        })),
      emits: sorted(index.out(s, "emits")).map((e) => ({
        ...eventRef(e),
        reactions: policiesStarting(index.out(e, "triggers")),
      })),
      concepts: sorted(index.out(s, "uses")).map((c) => ({
        ...conceptRef(c),
        usedBySteps: steps(index.into(c, "uses").filter((x) => x !== s)),
        usedByPolicies: policiesStarting(index.into(c, "uses")),
      })),
      rules: applicableRules(s),
      openScope: {
        process: p ? openScopeOf(index, p).items : [],
        step: openScopeOf(index, s).items,
      },
    };
  };

  const notFound = (why) => ({ ...base, found: false, note: why });
  let result;
  if (target.kind === "category") {
    const entry = mapping?.categories?.[target.id];
    if (!entry && findings.some((f) => f.code === "process-index-unreadable"))
      return finish(
        {
          ...base,
          found: null,
          note: "the ADR index could not be read, so this category's links are unknown; fix the reported position first",
        },
        scope,
      );
    if (!entry) return finish(notFound(`no category "${target.id}" in the ADR index`), scope);
    // A record that is not a list of step ids is unreadable, never the confirmed empty record.
    const realizes = Array.isArray(entry.realizes)
      ? entry.realizes.filter((x) => typeof x === "string")
      : null;
    const malformed =
      entry.realizes !== undefined &&
      (realizes === null || realizes.length !== entry.realizes.length);
    const linked = [];
    const retiredLinks = [];
    const brokenLinks = [];
    for (const id of sorted(realizes ?? [])) {
      const iri = elementIri(id);
      if (typeOf(iri) !== "Step") {
        brokenLinks.push(id);
        if (isValidElementId(id)) scope.add(iri); // its own model errors belong to this result
      } else if (!visible(iri)) retiredLinks.push(id);
      else linked.push(iri);
    }
    result = {
      ...base,
      found: true,
      link: malformed
        ? "invalid"
        : realizes === null
          ? "none"
          : realizes.length === 0
            ? "confirmed-none"
            : "linked",
      adrs: (Array.isArray(entry.adrs) ? entry.adrs : [])
        .filter((r) => r && typeof r.path === "string")
        .map((r) => ({ path: r.path, status: r.status ?? null })),
      steps: linked.map(stepContext),
      ...(retiredLinks.length ? { retiredLinks } : {}),
      ...(brokenLinks.length ? { brokenLinks } : {}),
    };
    if (result.link === "none")
      result.note =
        "not linked to any step: this is not evidence that no business rule applies. Judge whether the feature realizes an existing step, needs a new step in the model, or is unrelated to the business flow";
    else if (result.link === "confirmed-none")
      result.note =
        "confirmed to realize no step (empty realizes record); do not ask the three-way judgment again. This is not evidence that no business rule applies; check the rules the feature may rely on";
  } else if (target.kind === "process") {
    const iri = elementIri(target.id);
    if (typeOf(iri) !== "Process") return finish(absent(target.id, "Process"), scope);
    if (isRetired(index, iri) && !includeRetired)
      return finish(
        notFound(
          `process "${target.id}" is retired (${processStatus(index, iri)}); request retired processes to include it`,
        ),
        scope,
      );
    result = {
      ...base,
      found: true,
      process: processRef(iri),
      definition: text(iri, "definition"),
      startCondition: text(iri, "startCondition"),
      businessOutcome: text(iri, "businessOutcome"),
      criteria: sorted(index.into(iri, "criterionOf"))
        .filter((c) => typeOf(c) === "ObservationCriterion")
        .map((c) =>
          ref(c, {
            startCondition: text(c, "startCondition"),
            observedResult: text(c, "observedResult"),
            passesThrough: sorted(index.out(c, "passesThrough")).map(eventRef),
          }),
        ),
      openScope: openScopeOf(index, iri).items,
      steps: sorted(index.out(iri, "hasStep"))
        .filter((s) => typeOf(s) === "Step")
        .map((s) => ({
          ...stepContext(s),
          performers: sorted(index.into(s, "performs"))
            .filter((a) => typeOf(a) === "Actor")
            .map((a) => ref(a)),
          context: contextRef(s),
        })),
    };
  } else if (target.kind === "concept") {
    const iri = elementIri(target.id);
    if (typeOf(iri) !== "BusinessConcept")
      return finish(absent(target.id, "BusinessConcept"), scope);
    const concepts = (list) =>
      sorted(list)
        .filter((c) => typeOf(c) === "BusinessConcept")
        .map(conceptRef);
    result = {
      ...base,
      found: true,
      concept: conceptRef(iri),
      related: {
        hasPart: concepts(index.out(iri, "hasPart")),
        partOf: concepts(index.into(iri, "hasPart")),
        refersTo: concepts(index.out(iri, "refersTo")),
        referredBy: concepts(index.into(iri, "refersTo")),
        correspondsTo: concepts([
          ...index.out(iri, "correspondsTo"),
          ...index.into(iri, "correspondsTo"),
        ]),
      },
      usedBySteps: steps(index.into(iri, "uses")),
      usedByPolicies: policiesStarting(index.into(iri, "uses")),
      rules: sorted(index.into(iri, "constrains"))
        .filter((r) => typeOf(r) === "BusinessRule")
        .map((r) => ruleRef(r, ["concept"])),
    };
  } else if (target.kind === "event") {
    const iri = elementIri(target.id);
    if (typeOf(iri) !== "BusinessEvent") return finish(absent(target.id, "BusinessEvent"), scope);
    result = {
      ...base,
      found: true,
      event: eventRef(iri),
      definition: text(iri, "definition"),
      emittedBy: steps(index.into(iri, "emits")),
      reactions: policiesStarting(index.out(iri, "triggers")),
      criteria: sorted(index.into(iri, "passesThrough"))
        .filter((c) => typeOf(c) === "ObservationCriterion")
        .filter((c) => {
          const p = index.out(c, "criterionOf")[0];
          return includeRetired || !p || !isRetired(index, p);
        })
        .map((c) => ref(c, { process: processRef(index.out(c, "criterionOf")[0] ?? null) })),
    };
  } else throw new Error(`unknown query kind: ${target.kind}`);

  return finish(result, scope);

  /** A target of another type is not found, unless validation reports an error on it. */
  function absent(id, expected) {
    const iri = elementIri(id);
    if (findings.some((f) => f.level === "error" && (f.element === id || f.element === iri))) {
      scope.add(iri);
      return {
        ...base,
        found: null,
        note: `"${id}" has validation errors, so its ${expected} context cannot be determined; fix the reported positions first`,
      };
    }
    return notFound(wrongType(id, expected));
  }

  function wrongType(id, expected) {
    const actual = typeOf(elementIri(id));
    return actual
      ? `"${id}" is a ${actual}, not a ${expected}`
      : `no ${expected} "${id}" in the model`;
  }

  /**
   * Attach in-scope validation errors and change flags. An error is in scope when
   * its element is a scope element or the other end of a triple touching the
   * scope — so a connection the type filter dropped, a non-model IRI or a
   * dangling end still makes the result incomplete — when the ADR index could
   * not be read or holds a link record that is not a list of step ids, when the
   * ADR records of a feature realizing a step in scope (or of the target category)
   * are contradicted by its files, or, for a category, when it is a link finding of
   * that category.
   * Change flags count an element in scope in the committed or the working model.
   */
  function finish(out, inScope) {
    if (scopeOut) for (const x of inScope) scopeOut.add(x);
    const ids = new Set([...inScope].map(elementId).filter(Boolean));
    const touching = new Set(inScope);
    for (const s of inScope) {
      for (const t of index.incoming.get(s) ?? []) if (t.p !== `${PM}inContext`) touching.add(t.s);
      for (const list of index.subjects.get(s)?.props.values() ?? [])
        for (const t of list) if (t.o.type === "iri") touching.add(t.o.value);
    }
    const names = new Set([...touching].flatMap((iri) => [iri, elementId(iri)]).filter(Boolean));
    const realizing = new Set(
      [...inScope].flatMap((iri) => (realizers.get(elementId(iri)) ?? []).map((r) => r.category)),
    );
    const ofTarget = (f) => target.kind === "category" && f.category === target.id;
    const errors = findings.filter(
      (f) =>
        f.level === "error" &&
        (f.code === "process-index-unreadable" ||
          f.code === "process-link-shape" ||
          (ADR_RECORD_FINDINGS.has(f.code)
            ? ofTarget(f) || realizing.has(f.category)
            : f.code.startsWith("process-link-")
              ? ofTarget(f)
              : f.element && names.has(f.element))),
    );
    out.complete = errors.length === 0;
    out.errors = errors;
    if (changes) {
      const committed = new Set();
      if (changes.available && changes.head)
        queryContext({
          index: changes.head,
          mapping,
          target,
          includeRetired,
          scopeOut: committed,
        });
      for (const iri of committed) if (elementId(iri)) ids.add(elementId(iri));
      // Where a process may have last become Accepted, the target's scope may hold what
      // was deleted since.
      const accepted = new Map();
      for (const [processId, graph] of changes.available ? changes.baseline : []) {
        const then = new Set();
        for (const g of [graph, ...(changes.alsoBaselines?.get(processId) ?? [])])
          queryContext({ index: g, mapping, target, includeRetired, scopeOut: then });
        accepted.set(processId, new Set([...then].map(elementId).filter(Boolean)));
      }
      out.changes = scopeChanges(changes, ids, accepted);
    }
    return out;
  }
}

/** Split repository change flags into the query scope and the fact that changes exist elsewhere. */
function scopeChanges(changes, ids, accepted = new Map()) {
  if (!changes.available) return { available: false, reason: changes.reason };
  const uncommitted = sorted([...changes.uncommitted].filter((id) => ids.has(id)));
  const kind = (map, id) => ({ id, change: map.get(id) });
  const unsynced = [];
  let unsyncedElsewhere = false;
  for (const [processId, changed] of [...changes.unsynced.entries()].sort(([a], [b]) =>
    byId(a, b),
  )) {
    const then = accepted.get(processId) ?? new Set();
    const touched = sorted([...changed].filter((id) => ids.has(id) || then.has(id)));
    if (ids.has(processId) || then.has(processId) || touched.length)
      unsynced.push({
        process: processId,
        elements: touched,
        changes: touched.map((id) => kind(changes.unsyncedKinds.get(processId), id)),
        compositionChanged: changes.compositionChanged.has(processId),
        // Where it last became Accepted is one of several commits history leaves open.
        ...(changes.sinceUncertain?.has(processId)
          ? { lastAcceptedUncertain: changes.sinceUncertain.get(processId) }
          : {}),
      });
    else unsyncedElsewhere = true;
  }
  const lifecycleEdits = [...changes.lifecycleEdits]
    .filter(([processId]) => ids.has(processId))
    .sort(([a], [b]) => byId(a, b))
    .map(([processId, list]) => ({ process: processId, findings: list.map((f) => f.msg) }));
  const uncertain = [...changes.uncertain]
    .filter(([processId]) => ids.has(processId))
    .map(([processId, reason]) => ({ process: processId, reason }));
  // Where an Accepted process became Accepted is unknown, so is whether its edits reach this scope.
  const unknownElsewhere = [...changes.uncertain]
    .filter(([processId]) => !ids.has(processId))
    .map(([, reason]) => reason);
  return {
    available: true,
    ...(!changes.history.available ? { committedUnavailable: changes.history.reason } : {}),
    ...(changes.uncommittedDocuments ? { uncommittedDocuments: changes.uncommittedDocuments } : {}),
    ...(uncertain.length ? { unsyncedUnknown: uncertain } : {}),
    ...(unknownElsewhere.length
      ? { unsyncedUnknownElsewhere: [...new Set(unknownElsewhere)] }
      : {}),
    lifecycleEdits,
    uncommitted,
    uncommittedChanges: uncommitted.map((id) => kind(changes.uncommittedKinds, id)),
    uncommittedElsewhere: [...changes.uncommitted].some((id) => !ids.has(id)),
    unsyncedAccepted: unsynced,
    unsyncedAcceptedElsewhere: unsyncedElsewhere,
  };
}

// ── text rendering for agents ────────────────────────────────────────────

const q = (s) => (s == null ? "" : ` "${s}"`);
const adrList = (adrs) => adrs.map((a) => `${a.path} [${a.status ?? "?"}]`).join(", ") || "none";
/** One step; its realizing features by name only, since their ADRs are listed once per result. */
const stepLine = (s) => {
  const proc = s.process
    ? ` — ${s.process.id}${q(s.process.label)} [${s.process.status ?? "no Status"}${s.process.retired ? ", retired" : ""}]`
    : " — (no single process)";
  const by = s.realizedBy.length
    ? s.realizedBy.map((r) => r.category).join(", ")
    : s.realizationUnknown
      ? "unknown"
      : "not realized by any feature";
  const unknown = s.realizationUnknown
    ? "; realization unknown until the reported ADR index error is fixed"
    : "";
  return `${s.id}${q(s.label)}${proc}; realized by: ${by}${unknown}`;
};
const scopeItems = (items) =>
  items.map((i) => (i.kind === "none" ? "no open scope" : `${i.kind}: ${i.text}`)).join(" | ");

/** Render a query result as compact text: target, errors and change flags first, then connections. */
export function renderContext(r) {
  const lines = [];
  const say = (depth, s) => lines.push(`${"  ".repeat(depth)}${s}`);
  // Every feature a step line names, so that its ADRs are listed once at the end.
  const features = new Map();
  const stepText = (s) => {
    for (const f of s.realizedBy) features.set(f.category, f);
    return stepLine(s);
  };
  say(0, `Business context — ${r.kind} "${r.id}"`);
  if (r.found === false) {
    say(0, `NOT FOUND: ${r.note}`);
    return lines.join("\n") + "\n";
  }
  if (!r.complete) {
    say(
      0,
      `INCOMPLETE — validation errors affect this scope; do not treat it as a settled reference:`,
    );
    for (const e of r.errors) say(1, `[${e.code}] ${e.where} ${e.msg}`);
  }
  if (r.found === null) {
    say(0, r.note);
    return lines.join("\n") + "\n";
  }
  if (r.changes) {
    const c = r.changes;
    if (!c.available) say(0, `Change flags unavailable: ${c.reason}`);
    else {
      if (c.committedUnavailable)
        say(
          0,
          `Committed-edit flags unavailable: ${c.committedUnavailable} — treat Accepted processes in this scope as possibly edited directly; confirm with process sync before relying on them`,
        );
      if (c.uncommittedDocuments?.length)
        say(
          0,
          `UNCOMMITTED model documents differ from HEAD (not a settled reference): ${c.uncommittedDocuments.join(", ")}`,
        );
      for (const u of c.unsyncedUnknown ?? [])
        say(
          0,
          `Edits of Accepted process ${u.process} since it became Accepted are unknown: ${u.reason}`,
        );
      for (const l of c.lifecycleEdits)
        say(
          0,
          `LIFECYCLE EDIT of process ${l.process} that ADR Writer's transitions do not explain — its Status is not a settled reference; run process sync: ${l.findings.join(" | ")}`,
        );
      if (c.uncommitted.length)
        say(
          0,
          `UNCOMMITTED model edits in scope (not a settled reference): ${c.uncommittedChanges.map((x) => `${x.id} (${x.change})`).join(", ")}`,
        );
      if (c.uncommittedElsewhere) say(0, "Uncommitted model edits also exist outside this scope.");
      for (const u of c.unsyncedAccepted)
        say(
          0,
          `UNSYNCED direct edit of Accepted process ${u.process} since ${u.lastAcceptedUncertain ? "a commit where it may have last become Accepted" : "it was last Accepted"}${u.elements.length ? `: ${u.changes.map((x) => `${x.id} (${x.change})`).join(", ")}` : ""}${u.compositionChanged === false ? " (open scope only)" : ""} — run process sync before relying on it`,
        );
      if (c.unsyncedAcceptedElsewhere)
        say(0, "Accepted processes outside this scope also have unsynced direct edits.");
      if (c.unsyncedUnknownElsewhere)
        say(
          0,
          `Edits of Accepted processes outside this scope since they became Accepted are unknown (${c.unsyncedUnknownElsewhere.join("; ")}), so whether they reach this scope cannot be determined — treat it as possibly edited directly until process sync has checked it with that history`,
        );
    }
  }
  if (r.note) say(0, `Note: ${r.note}`);
  const stepBlock = (ctx, depth) => {
    say(depth, `Step ${stepText(ctx.step)}`);
    if (ctx.performers)
      say(
        depth + 1,
        `performed by: ${ctx.performers.map((a) => `${a.id}${q(a.label)}`).join(", ") || "—"}; context: ${ctx.context?.id ?? "—"}`,
      );
    say(depth + 1, `previous: ${ctx.previous.map(stepText).join(" ; ") || "—"}`);
    say(depth + 1, `next: ${ctx.next.map(stepText).join(" ; ") || "—"}`);
    for (const u of ctx.startedBy) {
      say(
        depth + 1,
        `started by policy ${u.policy.id}${q(u.policy.label)} when: ${u.policy.reactionCondition ?? "—"}`,
      );
      for (const e of u.events)
        say(
          depth + 2,
          `on event ${e.id}${q(e.label)} emitted by: ${e.emittedBy.map(stepText).join(" ; ") || "—"}`,
        );
    }
    for (const e of ctx.emits) {
      say(
        depth + 1,
        `emits ${e.id}${q(e.label)}${e.reactions.length ? "" : " — no reacting policy"}`,
      );
      for (const p of e.reactions)
        say(
          depth + 2,
          `→ policy ${p.policy.id}${q(p.policy.label)} when: ${p.policy.reactionCondition ?? "—"} starts: ${p.starts.map(stepText).join(" ; ") || "—"}`,
        );
    }
    for (const c of ctx.concepts) {
      say(depth + 1, `uses concept ${c.id}${q(c.label)} (${c.context?.id ?? "no context"})`);
      if (c.usedBySteps.length)
        say(depth + 2, `also used by steps: ${c.usedBySteps.map(stepText).join(" ; ")}`);
      for (const p of c.usedByPolicies)
        say(
          depth + 2,
          `used by policy ${p.policy.id}${q(p.policy.label)} which starts: ${p.starts.map(stepText).join(" ; ") || "—"}`,
        );
    }
    for (const rule of ctx.rules)
      say(
        depth + 1,
        `rule ${rule.id}${q(rule.label)}: ${rule.definition} (basis ${rule.basisKind}: ${rule.basis}; via ${rule.via.join(", ")})`,
      );
    if (ctx.openScope.process.length || ctx.openScope.step.length)
      say(
        depth + 1,
        `open scope — process: ${scopeItems(ctx.openScope.process) || "—"}; step: ${scopeItems(ctx.openScope.step) || "—"}`,
      );
  };
  if (r.kind === "category") {
    say(0, `ADRs: ${adrList(r.adrs)}`);
    say(0, `Link: ${r.link}`);
    if (r.retiredLinks)
      say(0, `Links to retired processes (excluded): ${r.retiredLinks.join(", ")}`);
    if (r.brokenLinks) say(0, `Links to missing steps: ${r.brokenLinks.join(", ")}`);
    for (const s of r.steps) stepBlock(s, 0);
  } else if (r.kind === "process") {
    say(
      0,
      `Process ${r.process.id}${q(r.process.label)} [${r.process.status ?? "no Status"}]: ${r.definition}`,
    );
    say(1, `start: ${r.startCondition}; outcome: ${r.businessOutcome}`);
    say(1, `open scope: ${scopeItems(r.openScope) || "—"}`);
    for (const c of r.criteria)
      say(
        1,
        `criterion ${c.id}${q(c.label)}: ${c.startCondition} → ${c.observedResult} (passes through ${c.passesThrough.map((e) => e.id).join(", ") || "—"})`,
      );
    for (const s of r.steps) stepBlock(s, 0);
  } else if (r.kind === "concept") {
    say(
      0,
      `Concept ${r.concept.id}${q(r.concept.label)} (${r.concept.context?.id ?? "no context"}): ${r.concept.definition}`,
    );
    for (const [rel, list] of Object.entries(r.related))
      if (list.length)
        say(1, `${rel}: ${list.map((c) => `${c.id} (${c.context?.id ?? "—"})`).join(", ")}`);
    say(1, `used by steps: ${r.usedBySteps.map(stepText).join(" ; ") || "—"}`);
    for (const p of r.usedByPolicies)
      say(
        1,
        `used by policy ${p.policy.id}${q(p.policy.label)} which starts: ${p.starts.map(stepText).join(" ; ") || "—"}`,
      );
    for (const rule of r.rules)
      say(
        1,
        `rule ${rule.id}${q(rule.label)}: ${rule.definition} (basis ${rule.basisKind}: ${rule.basis})`,
      );
  } else if (r.kind === "event") {
    say(
      0,
      `Event ${r.event.id}${q(r.event.label)} (${r.event.context?.id ?? "no context"}): ${r.definition}`,
    );
    say(1, `emitted by: ${r.emittedBy.map(stepText).join(" ; ") || "—"}`);
    for (const p of r.reactions)
      say(
        1,
        `→ policy ${p.policy.id}${q(p.policy.label)} when: ${p.policy.reactionCondition ?? "—"} starts: ${p.starts.map(stepText).join(" ; ") || "—"}`,
      );
    for (const c of r.criteria)
      say(
        1,
        `criterion ${c.id}${q(c.label)} of ${c.process?.id ?? "—"}${c.process?.retired ? " (retired)" : ""}`,
      );
  }
  if (features.size) {
    say(0, "ADRs of the realizing features named above:");
    for (const f of [...features.values()].sort((a, b) => byId(a.category, b.category)))
      say(
        1,
        `${f.category}: ${adrList(f.adrs)}${f.untrusted ? " — its index records do not match its ADR files" : ""}`,
      );
  }
  say(
    0,
    "Exact values, state machines and detailed conditions are not in the model; read the realizing ADRs. Use this context to check for contradictions, never as new implementation obligations.",
  );
  return lines.join("\n") + "\n";
}
