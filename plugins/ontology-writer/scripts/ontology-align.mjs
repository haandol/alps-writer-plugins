// ontology-align.mjs — deterministic halves of the process lifecycle
// workflows: the change-impact summary an ontology
// change approval shows, and the alignment-review plan whose mechanical checks
// gate a process becoming Accepted. Pure functions over indexed models and the
// ADR index; judging compliance-contract meaning and running the business flow
// stay with the workflow that calls them.

import {
  businessComposition,
  diffGraphs,
  elementId,
  elementIri,
  glossaryOverlap,
  isAccepted,
  isRetired,
  isSystemStep,
  majorChangeCandidates,
  openScopeKeys,
  processOfStep,
  processStatus,
  processesToPropose,
  ruleReach,
  sameMeaningKey,
} from "./ontology-lib.mjs";
import { currentAdrPaths, implementationState, realizersByStep } from "./ontology-query.mjs";

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (list) => [...new Set(list)].sort(byId);

/** Steps connected to one changed element: the features realizing them are directly affected. */
function stepsTouchedBy(index, iri) {
  const type = index.typeOf(iri);
  const steps = [];
  if (type === "Step") steps.push(iri);
  if (type === "Process") steps.push(...index.out(iri, "hasStep"));
  if (type === "BusinessEvent") {
    steps.push(...index.into(iri, "emits"));
    for (const p of index.out(iri, "triggers")) steps.push(...index.out(p, "starts"));
  }
  if (type === "Policy") steps.push(...index.out(iri, "starts"));
  if (type === "BusinessConcept") {
    for (const u of index.into(iri, "uses"))
      steps.push(...(index.typeOf(u) === "Policy" ? index.out(u, "starts") : [u]));
  }
  if (type === "BusinessRule") steps.push(...ruleReach(index, iri));
  if (type === "Actor") steps.push(...index.out(iri, "performs"));
  if (type === "ObservationCriterion")
    for (const p of index.out(iri, "criterionOf")) steps.push(...index.out(p, "hasStep"));
  return steps.filter((s) => index.typeOf(s) === "Step");
}

/**
 * What an ontology change approval summary must show for a
 * draft model compared with the current one.
 * Only meaning changes — added or removed elements, and type, relation or fact
 * changes not confirmed as same-meaning — touch features; description and
 * lifecycle edits do not, while the links a retirement leaves are link changes.
 *
 * @param {object} input
 * @param {object} input.before Indexed current model (an empty index when none exists).
 * @param {object} input.after Indexed draft model.
 * @param {object|null} input.mapping Current ADR index.
 * @param {string|null} input.glossary Current glossary text.
 * @param {Set<string>} [input.sameMeaning] Keys from `sameMeaningKeys`.
 * @param {string|null} [input.scope] Limit the summary to one process's composition and open scope.
 */
export function impactSummary({
  before,
  after,
  mapping,
  glossary,
  sameMeaning = new Set(),
  scope = null,
}) {
  const realizers = realizersByStep(mapping);
  const scopeIri = scope ? elementIri(scope) : null;
  const inScope = scopeIri ? scopeElements(before, after, scopeIri) : null;
  const diff = diffGraphs(before.triples, after.triples);
  const elements = diff.elements
    .filter((e) => !inScope || inScope.has(e.id))
    .map((e) => ({
      ...e,
      properties: e.properties.map((p) =>
        sameMeaning.has(sameMeaningKey(e.id, p.property)) ? { ...p, sameMeaning: true } : p,
      ),
    }));
  const meaningChange = (e) =>
    e.change !== "changed" ||
    e.properties.some((p) => ["type", "relation", "fact"].includes(p.family) && !p.sameMeaning);
  const touched = new Set();
  for (const e of elements.filter(meaningChange)) {
    const iri = elementIri(e.id);
    for (const s of [...stepsTouchedBy(before, iri), ...stepsTouchedBy(after, iri)])
      touched.add(elementId(s));
  }
  const propose = processesToPropose(before, after, { sameMeaning }).filter(
    (p) => !scope || p === scope,
  );
  const stepsOfProposed = sorted(
    propose.flatMap((p) => after.out(elementIri(p), "hasStep").map(elementId)),
  );
  const categoriesOf = (stepIds) =>
    sorted(stepIds.flatMap((id) => (realizers.get(id) ?? []).map((r) => r.category)));
  const linkChanges = [];
  for (const [id, list] of realizers) {
    if (inScope && !inScope.has(id)) continue;
    const iri = elementIri(id);
    const owner = after.typeOf(iri) === "Step" ? processOfStep(after, iri) : null;
    const reason =
      after.typeOf(iri) !== "Step"
        ? "removed"
        : owner && isRetired(after, owner)
          ? "retired"
          : null;
    if (reason) for (const r of list) linkChanges.push({ category: r.category, step: id, reason });
  }
  // The system steps the summary shows: those of processes that become Proposed, and
  // those the change touches itself or through their process. A retired process's
  // steps need no realization.
  const shownProcesses = new Set(propose);
  const shownSteps = new Set(stepsOfProposed);
  for (const e of elements) {
    const iri = elementIri(e.id);
    if (after.typeOf(iri) === "Process") shownProcesses.add(e.id);
    else if (after.typeOf(iri) === "Step") {
      shownSteps.add(e.id);
      const owner = processOfStep(after, iri);
      if (owner) shownProcesses.add(elementId(owner));
    }
  }
  for (const p of shownProcesses)
    for (const s of after.out(elementIri(p), "hasStep")) shownSteps.add(elementId(s));
  const unrealizedSystemSteps = sorted(
    [...shownSteps].filter((id) => {
      const iri = elementIri(id);
      const owner = processOfStep(after, iri);
      return (
        isSystemStep(after, iri) &&
        !(owner && isRetired(after, owner)) &&
        !(realizers.get(id) ?? []).length
      );
    }),
  );
  const directlyAffectedCategories = sorted([
    ...categoriesOf([...touched]),
    ...linkChanges.map((l) => l.category),
  ]);
  const categoriesOfProposedProcesses = categoriesOf(stepsOfProposed);
  const affectedAdrs = sorted(
    [...directlyAffectedCategories, ...categoriesOfProposedProcesses].flatMap((c) =>
      currentAdrPaths(mapping?.categories?.[c]),
    ),
  );
  return {
    same: elements.length === 0,
    diff: elements,
    scope,
    processesToPropose: propose,
    directlyAffectedCategories,
    categoriesOfProposedProcesses,
    affectedAdrs,
    linkChanges: linkChanges.sort((a, b) => byId(a.category + a.step, b.category + b.step)),
    unrealizedSystemSteps,
    glossaryCleanup: glossaryOverlap(glossary, after).filter((g) => !inScope || inScope.has(g.id)),
    majorChangeCandidates: majorChangeCandidates(before.triples, after.triples, {
      sameMeaning,
    }).filter((c) => !inScope || inScope.has(c.id)),
  };
}

/** Element ids of one process's business composition and open scope in either model. */
function scopeElements(before, after, processIri) {
  const ids = new Set([elementId(processIri)]);
  for (const index of [before, after]) {
    if (index.typeOf(processIri) !== "Process") continue;
    for (const k of [
      ...businessComposition(index, processIri),
      ...openScopeKeys(index, processIri),
    ])
      for (const part of k.split("\u0000").slice(0, 3))
        if (elementId(part)) ids.add(elementId(part));
    for (const s of index.out(processIri, "hasStep")) ids.add(elementId(s));
  }
  return ids;
}

/**
 * The alignment-review plan for one process: the
 * mechanical gates, where compliance contracts must be found, and what each
 * observation criterion must execute. A process in `together` is verified in
 * the same review, so its steps run instead of being deferred. Gate inputs that
 * fail validation (`errors`), an ADR record with an invalid Status and a
 * criterion that executes no system step block the review. With `modelOnly`
 * (an index that cannot be read), only the gates the model decides block:
 * `errors`, a hand-off without a criterion through its event and a criterion
 * that executes no system step.
 *
 * @returns {{process: object, blocking: string[], realization: object, compliance: object[], criteria: object[], handoffs: object[]}}
 */
export function alignmentPlan({
  index,
  mapping,
  processId,
  together = [],
  errors = [],
  modelOnly = false,
}) {
  const p = elementIri(processId);
  if (index.typeOf(p) !== "Process") return { error: `no process "${processId}" in the model` };
  const realizers = realizersByStep(mapping);
  const categoriesOf = (s) => (realizers.get(elementId(s)) ?? []).map((r) => r.category).sort(byId);
  const statusOf = (proc) => processStatus(index, proc);
  const joint = new Set([p, ...together.map(elementIri)]);
  const runnable = (proc) => joint.has(proc) || isAccepted(index, proc);
  const steps = sorted(index.out(p, "hasStep")).filter((s) => index.typeOf(s) === "Step");
  const stepRef = (s) => {
    const owner = processOfStep(index, s);
    return {
      step: elementId(s),
      system: isSystemStep(index, s),
      process: owner ? elementId(owner) : null,
      processStatus: owner ? statusOf(owner) : null,
      categories: categoriesOf(s),
    };
  };
  const blocking = [];
  if (errors.length)
    blocking.push(
      `the model or its index links have ${errors.length} validation error(s) (${sorted(
        errors.map((e) => `${e.code} ${e.where}`),
      )
        .slice(0, 3)
        .join("; ")}); a gate cannot hold on an invalid model`,
    );

  // Every system step is realized and each realizing feature is implemented: gates
  // the index decides.
  const unrealized = steps
    .filter((s) => isSystemStep(index, s) && !categoriesOf(s).length)
    .map(elementId);
  const categories = sorted(steps.flatMap(categoriesOf)).map((category) => {
    const { accepted, proposed, invalid, implemented } = implementationState(
      mapping?.categories?.[category]?.adrs,
    );
    return { category, accepted, proposed, invalid, ok: implemented };
  });
  if (!modelOnly) {
    for (const id of unrealized) blocking.push(`system step "${id}" has no realizing feature`);
    for (const { category, accepted, proposed, invalid, ok } of categories)
      if (invalid)
        blocking.push(
          `feature "${category}" has ${invalid} ADR record(s) whose Status is invalid; fix the index first`,
        );
      else if (!ok)
        blocking.push(
          `feature "${category}" needs at least one Accepted ADR and no Proposed ADR (Accepted ${accepted}, Proposed ${proposed})`,
        );
  }

  // Where compliance contracts must exist; their meaning is judged by the reviewer.
  const compliance = [];
  const handoffs = [];
  const seenHandoff = new Set();
  for (const s of steps) {
    for (const e of index.out(s, "emits"))
      for (const policy of index.out(e, "triggers"))
        for (const s2 of index.out(policy, "starts")) recordHandoff(s, e, policy, s2);
    for (const policy of index.into(s, "starts")) {
      compliance.push({
        kind: "policy",
        policy: elementId(policy),
        steps: [stepRef(s)],
        categories: categoriesOf(s),
      });
      for (const e of index.into(policy, "triggers"))
        for (const s1 of index.into(e, "emits")) recordHandoff(s1, e, policy, s);
    }
  }
  function recordHandoff(s1, e, policy, s2) {
    const key = [s1, e, policy, s2].join(" ");
    if (seenHandoff.has(key)) return;
    seenHandoff.add(key);
    const from = processOfStep(index, s1);
    const to = processOfStep(index, s2);
    compliance.push({
      kind: "hand-off",
      event: elementId(e),
      policy: elementId(policy),
      from: stepRef(s1),
      to: stepRef(s2),
      categories: sorted([...categoriesOf(s1), ...categoriesOf(s2)]),
    });
    if (from && to && from !== to) {
      const counterpart = from === p ? to : from;
      const covering = sorted(
        [from, to].flatMap((proc) =>
          index
            .into(proc, "criterionOf")
            .filter((c) => index.out(c, "passesThrough").includes(e))
            .map(elementId),
        ),
      );
      if (!covering.length)
        blocking.push(
          `hand-off of "${elementId(e)}" between "${elementId(from)}" and "${elementId(to)}" has no observation criterion passing through the event`,
        );
      if (isRetired(index, counterpart)) return;
      handoffs.push({
        event: elementId(e),
        from: elementId(from),
        to: elementId(to),
        counterpart: elementId(counterpart),
        counterpartStatus: statusOf(counterpart),
        criteria: covering,
        execute: runnable(counterpart),
      });
    }
  }
  for (const rule of sorted(index.ofType("BusinessRule"))) {
    const reach = ruleReach(index, rule);
    if (!reach.some((s) => steps.includes(s))) continue;
    const system = reach.filter((s) => isSystemStep(index, s));
    compliance.push({
      kind: "rule",
      rule: elementId(rule),
      steps: system.map(stepRef),
      categories: sorted(system.flatMap(categoriesOf)),
    });
  }

  // What each criterion executes, written into the evidence before running.
  const criteria = sorted(index.into(p, "criterionOf"))
    .filter((c) => index.typeOf(c) === "ObservationCriterion")
    .map((c) => {
      const events = sorted(index.out(c, "passesThrough"));
      const eventSteps = sorted(
        events.flatMap((e) => [
          ...index.into(e, "emits"),
          ...index.out(e, "triggers").flatMap((x) => index.out(x, "starts")),
        ]),
      ).filter((s) => index.typeOf(s) === "Step");
      const own = steps.filter((s) => isSystemStep(index, s));
      const crossProcess = eventSteps.filter(
        (s) => processOfStep(index, s) !== p && !isRetired(index, processOfStep(index, s) ?? s),
      );
      const run = crossProcess
        .filter((s) => isSystemStep(index, s) && runnable(processOfStep(index, s)))
        .map(stepRef);
      if (!own.length && !run.length)
        blocking.push(
          `criterion "${elementId(c)}" executes no system step of a realizing feature, so its evidence could only be unverified`,
        );
      return {
        criterion: elementId(c),
        startCondition: index.literal(c, "startCondition")[0]?.value ?? null,
        observedResult: index.literal(c, "observedResult")[0]?.value ?? null,
        events: events.map(elementId),
        processSystemSteps: own.map(stepRef),
        eventPathSteps: eventSteps.filter((s) => processOfStep(index, s) === p).map(stepRef),
        run,
        executesNoSystemStep: !own.length && !run.length,
        deferred: crossProcess.filter((s) => !runnable(processOfStep(index, s))).map(stepRef),
        outsideSystem: eventSteps.filter((s) => !isSystemStep(index, s)).map(stepRef),
      };
    });

  return {
    process: { id: processId, status: statusOf(p), together: sorted(together) },
    blocking,
    realization: { unrealizedSystemSteps: unrealized, categories },
    compliance,
    criteria,
    handoffs: handoffs.sort((a, b) => byId(a.event + a.counterpart, b.event + b.counterpart)),
  };
}
