// One business hierarchy for the event-board and spatial projections.
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { elementId, elementIri, ruleReach } from "./ontology-lib.mjs";
import { bodyStatus } from "./adr-lint-lib.mjs";

const MAX_ADR_BYTES = 1024 * 1024;
const unique = (items) => [...new Set(items)];
const asList = (value) => (Array.isArray(value) ? value : []);
const iriOf = (key) => (key.includes(":") ? key : elementIri(key));
const textField = (element, name) =>
  element?.searchUnit?.fields?.find((f) => f.name === name)?.value ?? "";
const string = (value) => (typeof value === "string" ? value : "");

/** Read only indexed Markdown within the chosen ADR root, including its real symlink target. */
export function readAdrDocument(record, { cwd = process.cwd(), adrRoot } = {}) {
  const result = { body: null, documentStatus: null, title: null, error: null };
  if (!adrRoot) return { ...result, error: "ADR document root was not supplied." };
  try {
    const root = realpathSync(path.resolve(cwd, adrRoot));
    if (typeof record?.path !== "string" || path.extname(record.path).toLowerCase() !== ".md")
      return { ...result, error: "Only indexed Markdown ADR documents can be read." };
    const lexical = path.relative(path.resolve(cwd, adrRoot), path.resolve(cwd, record.path));
    if (
      !lexical ||
      lexical === ".." ||
      lexical.startsWith(`..${path.sep}`) ||
      path.isAbsolute(lexical)
    )
      return { ...result, error: "The document is outside the allowed ADR document scope." };
    const file = realpathSync(path.resolve(cwd, record.path));
    const relative = path.relative(root, file);
    if (
      !relative ||
      relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative) ||
      path.extname(file).toLowerCase() !== ".md"
    )
      return { ...result, error: "The document is outside the allowed ADR document scope." };
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > MAX_ADR_BYTES)
      return {
        ...result,
        error: "The ADR is not a readable document within the view's resource limit.",
      };
    const body = readFileSync(file, "utf8");
    return {
      ...result,
      body,
      title: /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? null,
      documentStatus: bodyStatus(body).value,
    };
  } catch (error) {
    return {
      ...result,
      error: `The ADR document could not be read (${error.code ?? "read error"}).`,
    };
  }
}

/** Project processes into business containers; functional ADR categories never define those units. */
export function buildLayeredData({
  prepared,
  index,
  mapping,
  metadata = null,
  cwd,
  adrRoot,
  sourceKind = "model",
}) {
  const knowledge = prepared.app.knowledge;
  const elements = knowledge.elements;
  const contexts = knowledge.contexts.map((context) => ({
    ...context,
    domains: [],
    containers: [],
  }));
  const contextById = new Map(contexts.map((context) => [context.id, context]));
  const containers = Object.values(elements)
    .filter((e) => e.t === "Process")
    .map((process) => {
      const steps = index
        .out(iriOf(process.k), "hasStep")
        .map(elementId)
        .filter((id) => elements[id]?.t === "Step")
        .sort((a, b) => (elements[a].order ?? 0) - (elements[b].order ?? 0) || a.localeCompare(b));
      const owners = unique(steps.flatMap((id) => elements[id].contexts)).filter((id) =>
        contextById.has(id),
      );
      const container = {
        id: process.k,
        name: process.n,
        status: process.st,
        definition: textField(process, "definition"),
        start: textField(process, "startCondition"),
        outcome: textField(process, "businessOutcome"),
        openScope: textField(process, "openScope"),
        contexts: owners,
        steps,
        adrs: [],
        elements: [],
        marks: process.m ?? 0,
        source: process.searchUnit?.source ?? null,
      };
      for (const id of owners) contextById.get(id).containers.push(container.id);
      return container;
    });
  const containerById = new Map(containers.map((container) => [container.id, container]));
  const containersOfStep = new Map();
  for (const container of containers)
    for (const step of container.steps) {
      if (!containersOfStep.has(step)) containersOfStep.set(step, []);
      containersOfStep.get(step).push(container.id);
    }
  const elementContainers = Object.create(null);
  const addMembership = (key, owners) => {
    elementContainers[key] = unique([...(elementContainers[key] ?? []), ...owners]);
  };
  for (const container of containers) {
    addMembership(container.id, [container.id]);
    for (const step of container.steps) addMembership(step, [container.id]);
  }
  // Contextual facts follow actual model relations into the processes that use them.
  for (const [key, element] of Object.entries(elements)) {
    const iri = iriOf(key);
    if (element.t === "Actor")
      addMembership(
        key,
        index.out(iri, "performs").flatMap((s) => containersOfStep.get(elementId(s)) ?? []),
      );
    if (element.t === "ObservationCriterion")
      addMembership(
        key,
        index
          .out(iri, "criterionOf")
          .map(elementId)
          .filter((id) => containerById.has(id)),
      );
    if (["BusinessEvent", "Policy", "BusinessConcept"].includes(element.t)) {
      const steps =
        element.t === "BusinessEvent"
          ? [
              ...index.into(iri, "emits"),
              ...index.out(iri, "triggers").flatMap((p) => index.out(p, "starts")),
            ]
          : element.t === "Policy"
            ? index.out(iri, "starts")
            : index.into(iri, "uses").filter((x) => index.typeOf(x) === "Step");
      addMembership(
        key,
        steps.flatMap((s) => containersOfStep.get(elementId(s)) ?? []),
      );
      if (element.t === "Policy")
        for (const event of index.into(iri, "triggers"))
          addMembership(
            key,
            index.into(event, "emits").flatMap((s) => containersOfStep.get(elementId(s)) ?? []),
          );
    }
  }
  for (const [key, element] of Object.entries(elements)) {
    if (element.t !== "BusinessRule") continue;
    addMembership(
      key,
      ruleReach(index, iriOf(key))
        .map(elementId)
        .flatMap((id) => containersOfStep.get(id) ?? []),
    );
  }
  for (const [key, owners] of Object.entries(elementContainers))
    for (const owner of owners) containerById.get(owner)?.elements.push(key);

  const adrs = Object.create(null);
  for (const [category, entry] of Object.entries(mapping?.categories ?? {})) {
    const steps = asList(entry?.realizes).filter((id) => elements[id]?.t === "Step");
    const owners = unique(steps.flatMap((id) => containersOfStep.get(id) ?? []));
    if (!owners.length) continue;
    for (const record of asList(entry?.adrs)) {
      if (typeof record?.path !== "string" || !record.path) continue;
      const id = record.path;
      if (!adrs[id]) {
        const document = readAdrDocument(record, { cwd, adrRoot });
        adrs[id] = {
          id,
          name: document.title ?? path.basename(id, ".md"),
          summary: string(record.summary),
          status: string(record.status).trim() || null,
          ...document,
          categories: [],
          containers: [],
          bindings: [],
          issues: [],
        };
        if (document.error) adrs[id].issues.push(document.error);
        if (!document.error && document.documentStatus !== adrs[id].status)
          adrs[id].issues.push(
            "The document Status and the ADR index do not agree; realization is unverified.",
          );
      }
      const adr = adrs[id];
      if (adr.status !== (string(record.status).trim() || null))
        adr.issues.push("Duplicate ADR records have conflicting Status values.");
      for (const error of knowledge.errors.filter(
        (error) =>
          error.category === category ||
          ["ontology-index-unreadable", "ontology-link-shape"].includes(error.code),
      ))
        adr.issues.push(`${error.code}: ${error.msg}`);
      adr.issues = unique(adr.issues);
      adr.categories.push({ key: category, name: string(entry.feature) || category });
      for (const owner of owners) {
        const container = containerById.get(owner);
        const supportingSteps = container.steps.filter((step) => steps.includes(step));
        const binding = {
          container: owner,
          category,
          precision: "category",
          steps: supportingSteps,
          contexts: unique(supportingSteps.flatMap((step) => elements[step].contexts)),
        };
        adr.bindings.push(binding);
        if (!adr.containers.includes(owner)) adr.containers.push(owner);
        if (!container.adrs.includes(id)) container.adrs.push(id);
      }
    }
  }
  const domains = [];
  for (const [i, item] of asList(metadata?.subdomains).entries()) {
    if (typeof item?.name !== "string" || !item.name.trim()) continue;
    const id = typeof item.id === "string" && item.id ? item.id : `provided-domain-${i}`;
    if (domains.some((domain) => domain.id === id)) continue;
    const members = unique(asList(item.contextIds).filter((key) => contextById.has(key)));
    const evidence = asList(item.evidence).filter((e) => typeof e?.source === "string");
    const domain = {
      id,
      name: item.name,
      definition: string(item.responsibility),
      classification: string(item.classification) || "unconfirmed",
      verdict: evidence.length ? string(item.verdict) || "unconfirmed" : "unconfirmed",
      evidence,
      contexts: members,
      unmappedContexts: asList(item.contextIds).filter((key) => !contextById.has(key)),
    };
    domains.push(domain);
    for (const key of members) contextById.get(key).domains.push(id);
  }
  const reactions = [];
  for (const event of index.ofType("BusinessEvent")) {
    const eventId = elementId(event);
    if (!elements[eventId]) continue;
    for (const policy of index.out(event, "triggers")) {
      const policyId = elementId(policy);
      if (!elements[policyId] || index.typeOf(policy) !== "Policy") continue;
      const from = index
        .into(event, "emits")
        .map(elementId)
        .filter((id) => elements[id]?.t === "Step");
      const to = index
        .out(policy, "starts")
        .map(elementId)
        .filter((id) => elements[id]?.t === "Step");
      for (const a of from)
        for (const b of to) {
          for (const origin of containersOfStep.get(a) ?? [])
            for (const destination of containersOfStep.get(b) ?? [])
              reactions.push({
                from: origin,
                to: destination,
                sourceStep: a,
                targetStep: b,
                event: eventId,
                policy: policyId,
                condition: textField(elements[policyId], "reactionCondition"),
              });
        }
    }
  }
  const suppliedStages = Object.fromEntries(
    asList(metadata?.stages)
      .filter((stage) => elements[stage?.id]?.t === "Step")
      .map((stage) => [stage.id, stage]),
  );
  const businessSteps = Object.fromEntries(
    Object.values(elements)
      .filter((element) => element.t === "Step")
      .map((step) => {
        const iri = iriOf(step.k);
        const refs = (values) => values.map(elementId).filter((id) => elements[id]);
        const incoming = reactions.filter((edge) => edge.targetStep === step.k);
        return [
          step.k,
          {
            id: step.k,
            name: step.n,
            definition: textField(step, "definition"),
            kind: textField(step, "stepKind"),
            state: step.s,
            contexts: step.contexts,
            performers: refs(index.into(iri, "performs")),
            uses: refs(index.out(iri, "uses")),
            events: refs(index.out(iri, "emits")),
            next: refs(index.out(iri, "flowsTo")),
            incoming,
            supplied: suppliedStages[step.k] ?? null,
          },
        ];
      }),
  );
  return {
    version: 1,
    sourceKind,
    language: prepared.lang,
    contexts,
    domains,
    containers,
    adrs,
    elements,
    elementContainers,
    businessSteps,
    collaborations: knowledge.collaborations,
    reactions,
    errors: knowledge.errors,
    changeSummary: knowledge.changeSummary,
    stateLabels: knowledge.stateLabels,
    domain:
      typeof metadata?.domain?.name === "string"
        ? {
            ...metadata.domain,
            verdict: asList(metadata.domain.evidence).length
              ? string(metadata.domain.verdict) || "unconfirmed"
              : "unconfirmed",
            evidence: asList(metadata.domain.evidence),
          }
        : null,
    types: knowledge.types,
    unassigned: {
      containers: containers
        .filter((container) => !container.contexts.length)
        .map((container) => container.id),
      elements: Object.values(elements)
        .filter((element) => !element.contexts.length)
        .map((element) => element.k),
    },
  };
}
