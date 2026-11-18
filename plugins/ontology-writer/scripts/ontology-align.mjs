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
  compareCodePoints as byId,
  sortedUnique as sorted,
} from "./ontology-lib.mjs";
import { currentAdrPaths, implementationState, realizersByStep } from "./ontology-query.mjs";
import { classifyStatus } from "./adr-lint-lib.mjs";

// Follow only the selected feature's declared prerequisites. The implementation
// workflow still checks the index against the ADR bodies before starting work.
function firstPendingDecision(categories, category, visited = new Set(), visiting = new Set()) {
  if (visited.has(category)) return null;
  const entry = Object.hasOwn(categories, category) ? categories[category] : null;
  if (
    visiting.has(category) ||
    !Array.isArray(entry?.adrs) ||
    (entry.dependsOn !== undefined && !Array.isArray(entry.dependsOn))
  )
    return { category };
  visiting.add(category);
  for (const dependency of entry.dependsOn ?? []) {
    const next = firstPendingDecision(categories, dependency, visited, visiting);
    if (next) return next;
  }
  visiting.delete(category);
  visited.add(category);
  const state = implementationState(entry.adrs);
  if (state.implemented) return null;
  const record = entry.adrs.find((adr) => classifyStatus(adr?.status).value === "Proposed");
  return { category, path: state.invalid ? undefined : record?.path };
}

/** A suggestion for a conversation, derived from a read-only plan. Never a lifecycle gate. */
export function nextProcessAction({ plan, index, mapping, errors = [], changes, lang }) {
  const { id, status } = plan.process;
  const message = (ko, en) => (lang === "ko" ? ko : en);
  const sync = `/ontology-sync ${id}`;
  if (errors.length) {
    const { code, where } = errors[0];
    return {
      command: sync,
      reason: message(
        `${where}의 ${code} 오류를 먼저 확인하세요.`,
        `Inspect ${code} at ${where} before continuing.`,
      ),
    };
  }
  if (
    changes?.lifecycleEdits?.length ||
    changes?.unsyncedAccepted?.length ||
    changes?.unsyncedUnknown?.length ||
    changes?.uncommitted?.length ||
    changes?.uncommittedDocuments?.length
  ) {
    return {
      command: sync,
      reason: message(
        "범위 안의 모델 변경과 그 영향을 먼저 확인하세요.",
        "Check the in-scope model edits and their impact first.",
      ),
    };
  }
  if (
    status?.startsWith("Accepted") &&
    changes &&
    (!changes.available || changes.committedUnavailable || changes.unsyncedUnknownElsewhere?.length)
  ) {
    return {
      command: sync,
      reason: message(
        "채택 이후의 변경 이력을 확인할 수 없어 업무의 현재 상태를 먼저 검토해야 합니다.",
        "Check the process history to establish whether the accepted flow is still current.",
      ),
    };
  }
  const process = elementIri(id);
  if (isRetired(index, process)) {
    const replacement = index.out(process, "replacedBy")[0];
    if (replacement)
      return {
        command: `/ontology-view ${elementId(replacement)}`,
        reason: message(
          "이 업무를 대체한 프로세스를 확인할 수 있습니다.",
          "Inspect the recorded replacement process.",
        ),
      };
    return {
      command: "/ontology-view --include-retired",
      reason: message(
        "종료된 프로세스입니다. 필요하면 보존된 업무 흐름을 확인하세요.",
        "This process is retired. Its recorded flow is available for inspection.",
      ),
    };
  }
  const step = plan.realization.unrealizedSystemSteps[0];
  if (step)
    return {
      command: `/ontology-edit ${id}`,
      reason: message(
        `시스템 단계 ${step}을 담당하는 기능을 확인하고 연결을 제안하세요.`,
        `Identify the feature responsible for system step ${step} and propose its realization link.`,
      ),
    };
  const feature = plan.realization.categories.find((item) => !item.ok);
  if (feature) {
    const next = firstPendingDecision(mapping?.categories ?? {}, feature.category);
    if (next?.path) {
      const reason =
        next.category === feature.category
          ? message(
              `${feature.category}의 ADR이 Proposed입니다. 이 계약의 구현과 검토를 마치세요.`,
              `The ADR for ${feature.category} is Proposed. Complete its implementation and review.`,
            )
          : message(
              `${feature.category}에 필요한 ${next.category} ADR이 Proposed입니다. 이 선행 결정부터 구현하고 검토하세요.`,
              `${feature.category} depends on the Proposed ADR in ${next.category}. Implement and review that prerequisite first.`,
            );
      return { command: `/adr-impl ${next.path}`, reason };
    }
    const target = next?.category ?? feature.category;
    return {
      command: sync,
      reason: message(
        `${target}의 현행 ADR과 선행 관계가 색인에서 유효한지 확인하세요.`,
        `Check the current ADRs and prerequisite links for ${target} in the index.`,
      ),
    };
  }
  const missingCoverage = plan.handoffs.find((handoff) => !handoff.criteria.length);
  if (missingCoverage)
    return {
      command: `/ontology-edit ${id}`,
      reason: message(
        `${missingCoverage.event} 인계를 관찰할 기준을 제안하세요.`,
        `Propose an observation criterion covering the ${missingCoverage.event} hand-off.`,
      ),
    };
  const unverified = plan.criteria.find((criterion) => criterion.executesNoSystemStep);
  if (unverified)
    return {
      command: sync,
      reason: message(
        `${unverified.criterion}의 결과를 실제로 관찰할 수 있는 시스템 단계와 진입점을 확인하세요.`,
        `Identify a real system step and entry point for observing ${unverified.criterion}.`,
      ),
    };
  if (plan.blocking.length)
    return {
      command: sync,
      reason: message(
        `다음 검증 조건을 먼저 검토하세요. ${plan.blocking[0]}`,
        `Review the outstanding condition: ${plan.blocking[0]}`,
      ),
    };
  if (status === "Proposed")
    return {
      command: `/ontology-align ${id}`,
      reason: message(
        `기계적 조건을 충족했습니다. 준수 계약과 관찰 기준 ${plan.criteria.length}개의 실제 실행 결과를 검증하세요.`,
        `Mechanical gates are clear. Verify the compliance contracts and execute the ${plan.criteria.length} observation criteria.`,
      ),
    };
  return {
    command: `/ontology-view ${id}`,
    reason: message(
      "이미 Accepted인 업무입니다. 필요하면 업무 단계와 실현 ADR을 살펴보세요.",
      "This process is already Accepted. Inspect its steps and realizing ADRs if useful.",
    ),
  };
}

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
  if (type === "BoundedContext") {
    const contexts = [
      iri,
      ...index.out(iri, "collaboratesWith"),
      ...index.into(iri, "collaboratesWith"),
    ];
    for (const context of contexts) steps.push(...index.into(context, "inContext"));
  }
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
  const own = steps.filter((s) => isSystemStep(index, s));
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
