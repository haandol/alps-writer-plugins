// Read-only EventStorming presentation. Candidate evidence is disposable; a model's
// uses relation is not evidence that an entity changed its business state.
import { readFileSync } from "node:fs";
import { elementId, elementIri, isRetired, openScopeOf, isSystemStep } from "./ontology-lib.mjs";
import { queryContext, implementationState, realizersByStep } from "./ontology-query.mjs";
import { renderEventTimeline } from "./eventstorming-timeline.mjs";

export const BOARD_CSS =
  readFileSync(new URL("./eventstorming-board.css", import.meta.url), "utf8") +
  readFileSync(new URL("./eventstorming-timeline.css", import.meta.url), "utf8");
export const BOARD_CLIENT =
  readFileSync(new URL("./eventstorming-board-client.js", import.meta.url), "utf8") +
  readFileSync(new URL("./eventstorming-timeline.js", import.meta.url), "utf8");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const anchor = (id) =>
  `event-stage-${String(id).replace(/[^\p{L}\p{N}-]/gu, (c) => `_${c.codePointAt(0).toString(16)}_`)}`;
const verdicts = ["stated", "inferred", "conflicting", "unconfirmed"];
const terms = {
  ko: {
    title: "이벤트 스토밍 · 업무 변화",
    model:
      "현재 모델에서 재구성한 업무 관계입니다. 개념의 사용은 상태 변화의 증거가 아니며, 원래 워크숍의 후보·출처를 복원한 결과가 아닙니다.",
    candidate: "검토 중인 이벤트 스토밍 결과입니다. 출처 판정은 사용자 승인을 대신하지 않습니다.",
    action: "행위자와 업무 명령",
    entity: "업무 대상과 확인된 변화",
    concept: "관련 업무 개념 · 변화 여부 미확인",
    event: "도메인 이벤트",
    policy: "반응 정책",
    next: "후속 행동",
    before: "변화 전",
    after: "변화 후",
    unknown: "미확인",
    none: "자료에 기록 없음",
    evidence: "근거와 판정",
    noEvidence: "근거 위치 없음 · 미확인",
    stated: "자료 명시",
    inferred: "추론",
    conflicting: "충돌",
    unconfirmed: "미확인",
    context: "책임 경계 미확인",
    scope: "업무 범위",
    noStages: "이 범위에 표시할 업무 행동이 없습니다.",
    warning: "확인할 내용",
    relation: "인과 연결",
    retired: "은퇴",
    current: "현행 업무",
    planned: "목표 업무",
    entityKind: "엔티티",
    aggregateKind: "애그리거트",
    noEntity: "변화하는 업무 대상 미확인",
    noEvent: "발생 이벤트 미확인",
    subdomains: "서브도메인 후보",
    noSubdomains: "서브도메인 분류는 이 모델만으로 확인하지 않았습니다.",
    declared: "자료에 적힌 값",
    missing: "출처가 없어 확정하지 않은 값",
  },
  en: {
    title: "EventStorming · business changes",
    model:
      "Business relationships reconstructed from the current model. Using a concept does not prove a state change. This does not recover workshop candidates or source history.",
    candidate:
      "Candidate EventStorming results for review. Source verdicts do not replace user approval.",
    action: "Actor and business command",
    entity: "Business object and evidenced change",
    concept: "Related business concept · change unconfirmed",
    event: "Domain event",
    policy: "Reacting policy",
    next: "Next action",
    before: "Before",
    after: "After",
    unknown: "Unconfirmed",
    none: "Not recorded in the supplied data",
    evidence: "Evidence and verdict",
    noEvidence: "No source location · unconfirmed",
    stated: "Stated",
    inferred: "Inferred",
    conflicting: "Conflicting",
    unconfirmed: "Unconfirmed",
    context: "Responsibility boundary unconfirmed",
    scope: "Business scope",
    noStages: "No business action is available in this scope.",
    warning: "Needs review",
    relation: "Causal connection",
    retired: "Retired",
    current: "Current business",
    planned: "Planned business",
    entityKind: "Entity",
    aggregateKind: "Aggregate",
    noEntity: "Changing business object unconfirmed",
    noEvent: "Emitted event unconfirmed",
    subdomains: "Subdomain candidates",
    noSubdomains: "Subdomain classification has not been established from this model.",
    declared: "Value in the supplied material",
    missing: "Value without supporting provenance; not confirmed",
  },
};

/** Validate the disposable board input without interpreting source text as instructions. */
export function validateEventBoard(board) {
  const errors = [];
  const fail = (p, m) => errors.push(`${p}: ${m}`);
  const text = (v, p) => {
    if (typeof v !== "string" || !v.trim()) fail(p, "expected nonempty text");
  };
  const evidence = (v, p) => {
    if (!Array.isArray(v)) return fail(p, "expected evidence array (empty means unconfirmed)");
    v.forEach((e, i) => {
      if (!e || typeof e !== "object") return fail(`${p}[${i}]`, "expected source");
      text(e.source, `${p}[${i}].source`);
      if (e.detail !== undefined) text(e.detail, `${p}[${i}].detail`);
    });
  };
  const claim = (v, p) => {
    if (!verdicts.includes(v?.verdict)) fail(p, "invalid source verdict");
    evidence(v?.evidence, p + ".evidence");
  };
  if (!board || typeof board !== "object") return ["board: expected object"];
  if (board.version !== 1) fail("version", "expected 1");
  text(board.title, "title");
  text(board.scope, "scope");
  if (!["candidate", "model"].includes(board.origin)) fail("origin", "expected candidate or model");
  const ids = new Set();
  const contextNames = new Map();
  if (!Array.isArray(board.stages)) fail("stages", "expected array");
  else
    board.stages.forEach((s, i) => {
      const p = `stages[${i}]`;
      if (!s || typeof s !== "object") return fail(p, "expected stage");
      text(s.id, p + ".id");
      if (ids.has(s.id)) fail(p, "duplicate stage id");
      ids.add(s.id);
      text(s.action, p + ".action");
      if (s.contextDescription !== undefined && s.contextDescription !== null)
        text(s.contextDescription, p + ".contextDescription");
      text(s.context, p + ".context");
      if (s.contextId !== undefined && s.contextId !== null) {
        text(s.contextId, p + ".contextId");
        if (contextNames.has(s.contextId) && contextNames.get(s.contextId) !== s.context)
          fail(p + ".contextId", "one context identity must have one label");
        contextNames.set(s.contextId, s.context);
      }
      claim(s, p);
      if (
        s.businessStatus !== undefined &&
        !["current", "planned", "unconfirmed"].includes(s.businessStatus)
      )
        fail(p + ".businessStatus", "invalid business status");
      if (s.retired !== undefined && typeof s.retired !== "boolean")
        fail(p + ".retired", "expected boolean");
      if (s.actor !== undefined && s.actor !== null) text(s.actor, p + ".actor");
      if (!Array.isArray(s.entities)) fail(p + ".entities", "expected array");
      else
        s.entities.forEach((e, j) => {
          const q = p + `.entities[${j}]`;
          if (!e || typeof e !== "object") return fail(q, "expected entity");
          text(e.name, q + ".name");
          if (!["entity", "aggregate", "concept"].includes(e.kind)) fail(q, "invalid kind");
          claim(e, q);
          for (const k of ["before", "after"]) if (e[k] !== null) text(e[k], q + "." + k);
          if (e.kind === "concept" && (e.before !== null || e.after !== null))
            fail(q, "a related concept does not establish a state change");
        });
      if (s.event !== null) {
        if (!s.event || typeof s.event !== "object") fail(p + ".event", "expected event or null");
        else {
          text(s.event.name, p + ".event.name");
          if (s.event.description !== undefined)
            text(s.event.description, p + ".event.description");
        }
      }
      if (!Array.isArray(s.policies)) fail(p + ".policies", "expected array");
      else s.policies.forEach((v, j) => text(v, p + `.policies[${j}]`));
      if (s.rules !== undefined) {
        if (!Array.isArray(s.rules)) fail(p + ".rules", "expected array");
        else
          s.rules.forEach((r, j) => {
            const q = p + `.rules[${j}]`;
            if (!r || typeof r !== "object") return fail(q, "expected rule");
            text(r.name, q + ".name");
            text(r.scope, q + ".scope");
            if (r.description !== undefined && r.description !== null)
              text(r.description, q + ".description");
            claim(r, q);
          });
      }
    });
  if (!Array.isArray(board.links)) fail("links", "expected array");
  else
    board.links.forEach((l, i) => {
      const p = `links[${i}]`;
      if (!l || typeof l !== "object") return fail(p, "expected link");
      for (const k of ["from", "to"]) if (!ids.has(l[k])) fail(p + "." + k, "unknown stage");
      if (l.relation !== undefined && !["causal", "sequence"].includes(l.relation))
        fail(p + ".relation", "expected causal or sequence");
      text(l.label, p + ".label");
      if (l.condition !== undefined && l.condition !== null) text(l.condition, p + ".condition");
      claim(l, p);
    });
  if (board.subdomains !== undefined) {
    if (!Array.isArray(board.subdomains)) fail("subdomains", "expected array");
    else
      board.subdomains.forEach((s, i) => {
        text(s.name, `subdomains[${i}].name`);
        text(s.responsibility, `subdomains[${i}].responsibility`);
        claim(s, `subdomains[${i}]`);
      });
  }
  if (board.questions !== undefined) {
    if (!Array.isArray(board.questions)) fail("questions", "expected array");
    else {
      const seen = new Set();
      board.questions.forEach((q, i) => {
        const p = `questions[${i}]`;
        if (!q || typeof q !== "object") return fail(p, "expected question");
        for (const key of ["id", "text", "scope"]) text(q[key], p + "." + key);
        if (seen.has(q.id)) fail(p, "duplicate question id");
        seen.add(q.id);
        if (!["process", "step"].includes(q.scopeType))
          fail(p + ".scopeType", "expected process or step");
        if (!Array.isArray(q.stages) || q.stages.some((id) => !ids.has(id)))
          fail(p + ".stages", "expected existing stage ids");
        claim(q, p);
      });
    }
  }
  return errors;
}

/** Derive only recorded actions and causal relations. Entity mutations stay unknown. */
export function modelEventBoard({
  index,
  mapping,
  findings = [],
  includeRetired = false,
  lang = "en",
}) {
  const t = terms[lang] ?? terms.en;
  const literal = (iri, key) => index.literal(iri, key)[0]?.value;
  const name = (iri) =>
    literal(iri, "http://www.w3.org/2000/01/rdf-schema#label") ?? elementId(iri) ?? iri;
  const stages = [],
    pending = [],
    pendingOrder = [],
    pendingQuestions = [],
    byStep = new Map();
  const source = (id) => [{ source: "Model", detail: id }];
  for (const p of index.ofType("Process").filter((p) => includeRetired || !isRetired(index, p))) {
    const q = queryContext({
      index,
      mapping,
      findings,
      target: { kind: "process", id: elementId(p) },
      includeRetired,
    });
    if (!q.found) continue;
    for (const [i, item] of q.openScope.entries())
      if (item.kind === "open-path")
        pendingQuestions.push({
          id: `${elementId(p)}/question/${i}`,
          text: item.text,
          scope: q.process.label ?? elementId(p),
          scopeType: "process",
          process: elementId(p),
          verdict: "stated",
          evidence: source(elementId(p)),
        });
    for (const s of q.steps) {
      if (s.step.id === null) continue;
      for (const [i, item] of s.openScope.step.entries())
        if (item.kind === "open-path")
          pendingQuestions.push({
            id: `${elementId(p)}/${s.step.id}/question/${i}`,
            text: item.text,
            scope: `${q.process.label ?? elementId(p)} · ${s.step.label ?? s.step.id}`,
            scopeType: "step",
            process: elementId(p),
            step: s.step.id,
            verdict: "stated",
            evidence: source(s.step.id),
          });
      const entities = index
        .out(elementIri(s.step.id), "uses")
        .filter((x) => index.typeOf(x) === "BusinessConcept")
        .map((x) => ({
          name: name(x),
          kind: "concept",
          before: null,
          after: null,
          verdict: "unconfirmed",
          evidence: source(s.step.id),
        }));
      for (const next of s.next.filter((n) => n.process?.id === elementId(p)))
        pendingOrder.push({ from: s.step.id, to: next.id, process: elementId(p) });
      for (const e of s.emits.length ? s.emits : [null]) {
        const id = `${elementId(p)}/${s.step.id}/${e?.id ?? "no-event"}`;
        const policies = (e?.reactions ?? []).map(
          (r) =>
            `${r.policy.label ?? r.policy.id}${literal(elementIri(r.policy.id), "reactionCondition") ? " · " + literal(elementIri(r.policy.id), "reactionCondition") : ""}`,
        );
        stages.push({
          id,
          action: s.step.label ?? s.step.id,
          modelId: s.step.id,
          process: elementId(p),
          context: s.context?.label ?? t.context,
          contextId: s.context?.id ?? null,
          contextDescription: s.context?.id
            ? literal(elementIri(s.context.id), "definition") || null
            : null,
          businessStatus: q.process.retired
            ? "unconfirmed"
            : q.process.status?.startsWith("Accepted")
              ? "current"
              : "planned",
          retired: Boolean(q.process.retired),
          actor: s.performers.map((a) => a.label ?? a.id).join(", ") || null,
          entities,
          rules: s.rules.map((r) => ({
            name: r.label ?? r.id,
            description: r.definition,
            scope: r.via
              .map((via) => {
                if (via.startsWith("concept "))
                  return `${lang === "ko" ? "관련 업무 개념" : "Related concept"}: ${name(elementIri(via.slice(8)))}`;
                if (via.startsWith("policy "))
                  return `${lang === "ko" ? "관련 정책" : "Related policy"}: ${name(elementIri(via.slice(7)))}`;
                return `${lang === "ko" ? "적용 범위" : "Applies to"}: ${via === "step" ? (s.step.label ?? s.step.id) : (q.process.label ?? elementId(p))}`;
              })
              .join(" · "),
            verdict: "stated",
            evidence: [...source(r.id), ...(r.basis ? [{ source: r.basis }] : [])],
          })),
          event: e
            ? {
                name: e.label ?? e.id ?? t.noEvent,
                description: literal(elementIri(e.id), "definition") ?? t.none,
              }
            : null,
          policies,
          verdict: "stated",
          evidence: source(s.step.id),
        });
        byStep.set(s.step.id, [...(byStep.get(s.step.id) ?? []), id]);
        for (const r of e?.reactions ?? [])
          for (const n of r.starts)
            pending.push({
              from: id,
              step: n.id,
              label: r.policy.label ?? r.policy.id,
              condition: literal(elementIri(r.policy.id), "reactionCondition") || null,
              verdict: "stated",
              evidence: source(r.policy.id),
            });
      }
    }
  }
  const links = pending.flatMap(({ step, ...l }) =>
    (byStep.get(step) ?? []).map((to) => ({ ...l, to })),
  );
  for (const order of pendingOrder) {
    for (const from of (byStep.get(order.from) ?? []).filter((id) =>
      id.startsWith(order.process + "/"),
    )) {
      for (const to of (byStep.get(order.to) ?? []).filter((id) =>
        id.startsWith(order.process + "/"),
      ))
        links.push({
          from,
          to,
          relation: "sequence",
          label: lang === "ko" ? "진행 순서 (인과 아님)" : "Sequence (not causation)",
          verdict: "stated",
          evidence: source(order.from),
        });
    }
  }
  return {
    version: 1,
    origin: "model",
    title: t.title,
    scope:
      lang === "ko"
        ? "현재 모델에 기록된 업무 범위"
        : "Business scope recorded in the current model",
    stages,
    links,
    questions: pendingQuestions.map(({ process, step, ...q }) => ({
      ...q,
      stages: stages
        .filter((s) => s.process === process && (!step || s.modelId === step))
        .map((s) => s.id),
    })),
    subdomains: [],
  };
}

/** Render the board as cards and native SVG connectors, without Mermaid or external resources. */
export function renderEventBoard(board, { lang = "en", modelLink = null } = {}) {
  const errors = validateEventBoard(board);
  if (errors.length) throw new Error(errors.join("\n"));
  const t = terms[lang] ?? terms.en;
  const effective = (c) => (c.evidence.length ? c.verdict : "unconfirmed");
  const evidence = (c) =>
    `<details class="event-evidence"><summary>${esc(t.evidence)} · ${esc(t[effective(c)])}</summary>${c.evidence.length ? `<ul>${c.evidence.map((e) => `<li>${esc(e.source)}${e.detail ? " · " + esc(e.detail) : ""}</li>`).join("")}</ul>` : `<p>${esc(t.noEvidence)}</p>`}</details>`;
  // Arrange known causal predecessors first; a cycle keeps the supplied order.
  // Position alone never asserts an unrecorded relation.
  const ordered = [];
  const remaining = new Set(board.stages.map((s) => s.id));
  while (remaining.size) {
    const next = board.stages.find(
      (s) =>
        remaining.has(s.id) && !board.links.some((l) => l.to === s.id && remaining.has(l.from)),
    );
    if (!next) {
      ordered.push(...board.stages.filter((s) => remaining.has(s.id)));
      break;
    }
    ordered.push(next);
    remaining.delete(next.id);
  }
  const starts = (s) => {
    const incoming = board.links.filter((l) => l.to === s.id && l.relation !== "sequence");
    return `<div class="event-starts"><h4>${lang === "ko" ? "시작 계기" : "What starts this action"}</h4>${
      incoming.length
        ? incoming
            .map((l) => {
              const from = board.stages.find((x) => x.id === l.from);
              return `<div class="event-start" data-from="${esc(l.from)}"><p><span>${lang === "ko" ? "받는 사건" : "Incoming event"}</span> <b class="start-event">${esc(from.event?.name ?? t.unknown)}</b> · <span class="start-context">${esc(from.context)}</span></p><p><span>${lang === "ko" ? "반응 정책" : "Reaction policy"}</span> <span class="start-policy">${esc(l.label)}</span></p><p><span>${lang === "ko" ? "조건" : "Condition"}</span> <span class="start-condition">${esc(l.condition ?? (lang === "ko" ? "별도 기록 없음" : "Not recorded separately"))}</span></p>${evidence(l)}</div>`;
            })
            .join("")
        : `<p class="start-unrecorded">${lang === "ko" ? "이 모델에는 별도의 시작 사건이 기록되지 않았습니다." : "No separate starting event is recorded in this model."}</p>`
    }</div>`;
  };
  const stage = (s) =>
    `<article class="event-stage" id="${esc(anchor(s.id))}" data-stage="${esc(s.id)}" data-actor="${esc(s.actor ?? t.unknown)}" data-context-description="${esc(s.contextDescription ?? "")}" data-context-id="${esc(s.contextId === null ? "" : (s.contextId ?? s.context))}" data-context-name="${esc(s.context)}" data-context-known="${s.contextId === null ? "false" : "true"}" data-event-known="${s.event === null ? "false" : "true"}" tabindex="-1"><div class="event-card command"><h4>${esc(t.action)}</h4><p class="event-actor">${lang === "ko" ? "수행 주체:" : "Performed by:"} ${esc(s.actor ?? t.unknown)} · ${esc(t[s.businessStatus ?? "unconfirmed"])}${s.retired ? " · " + esc(t.retired) : ""}</p><p><strong>${modelLink && s.modelId ? modelLink(s.modelId, s.action) : esc(s.action)}</strong></p>${s.contextDescription ? `<p class="event-context-purpose">${esc(s.context)} · ${esc(s.contextDescription)}</p>` : ""}<p class="event-targets">${lang === "ko" ? "업무 대상:" : "Works with:"} ${esc(s.entities.map((e) => e.name).join(", ") || t.unknown)}</p>${starts(s)}${evidence(s)}</div><div class="event-card entity"><h4>${esc(t.entity)}</h4>${
      s.entities.length
        ? s.entities
            .map((e) => {
              const known = e.kind !== "concept" && effective(e) === "stated";
              return `<div class="entity-change" data-change-known="${known && e.before !== null && e.after !== null ? "true" : "false"}"><p><strong>${esc(e.name)}</strong> · ${esc(e.kind === "concept" ? t.concept : e.kind === "aggregate" ? t.aggregateKind : t.entityKind)}</p><dl><dt>${esc(t.before)}</dt><dd>${esc(e.before ?? t.unknown)}</dd><dt>${esc(t.after)}</dt><dd>${esc(e.after ?? t.unknown)}</dd></dl>${!known ? `<p class="event-unknown">${esc(t[effective(e)])}${e.before || e.after ? " · " + esc(t.declared) : ""}</p>` : ""}${evidence(e)}</div>`;
            })
            .join("")
        : `<p>${esc(t.noEntity)}</p>`
    }</div><div class="event-card domain-event"><h4>${esc(t.event)}</h4><p><strong>${esc(s.event?.name ?? t.noEvent)}</strong></p>${s.event?.description && s.event.description !== s.event.name ? `<p>${esc(s.event.description)}</p>` : ""}</div><div class="event-card policy"><h4>${esc(t.policy)}</h4>${s.policies.length ? `<ul data-event-policies>${s.policies.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p>${esc(t.none)}</p>`}<h4>${esc(t.next)}</h4><ul>${
      board.links
        .filter((l) => l.from === s.id)
        .map(
          (l) =>
            `<li><a class="event-next" data-from="${esc(l.from)}" data-to="${esc(l.to)}" data-relation="${esc(l.relation ?? "causal")}" data-condition="${esc(l.condition ?? "")}" href="#${esc(anchor(l.to))}">${esc(l.label)} → ${esc(board.stages.find((x) => x.id === l.to).action)}</a> · ${esc(t[effective(l)])}${evidence(l)}</li>`,
        )
        .join("") || `<li>${esc(t.none)}</li>`
    }</ul></div>${s.rules?.length ? `<div class="event-card event-rules"><h4>${lang === "ko" ? "관련 업무 규칙" : "Related business rules"}</h4>${s.rules.map((r) => `<p><strong>${esc(r.name)}</strong></p><p>${esc(r.description)}</p><p>${esc(r.scope)}</p>${evidence(r)}`).join("")}</div>` : ""}</article>`;
  return `<section class="event-workbench" id="eventstorming"><div class="event-header"><div><p class="event-eyebrow">${lang === "ko" ? "업무 흐름 탐색" : "Business flow explorer"}</p><h2>${esc(board.title)}</h2></div><button type="button" class="event-expand" aria-pressed="false" data-expand="${lang === "ko" ? "보드 넓게 보기" : "Expand board"}" data-close="${lang === "ko" ? "보드 닫기" : "Close board"}">${lang === "ko" ? "보드 넓게 보기" : "Expand board"}</button></div><div class="event-meta"><span class="event-origin">${board.origin === "model" ? (lang === "ko" ? "모델에서 재구성" : "From the current model") : lang === "ko" ? "검토 중인 후보" : "Candidate for review"}</span><p>${esc(board.scope)}</p><a class="event-readiness-link" href="#workflow-readiness">${lang === "ko" ? "준비 상태 검토 ↗" : "Review readiness ↗"}</a></div><details class="event-source-info"><summary>${lang === "ko" ? "자료와 해석 범위" : "Source and interpretation"}</summary><p>${esc(t[board.origin])}</p></details>${renderEventTimeline(board, { lang, esc, evidence, tabbed: Boolean(modelLink) })}<h3 id="event-flat-cards">${lang === "ko" ? "업무 카드와 근거" : "Business cards and evidence"}</h3><div class="event-board" tabindex="0" role="region" aria-label="${esc(t.title)}"><svg class="event-connections" aria-hidden="true"></svg>${ordered.length ? `<div class="event-stages">${ordered.map((s) => `<section class="event-lane"><h3>${esc(s.context)}</h3>${stage(s)}</section>`).join("")}</div>` : `<p>${esc(t.noStages)}</p>`}</div><details class="event-subdomains"><summary>${esc(t.subdomains)}</summary>${board.subdomains?.length ? board.subdomains.map((s) => `<p><strong>${esc(s.name)}</strong> — ${esc(s.responsibility)}</p>${evidence(s)}`).join("") : `<p>${esc(t.noSubdomains)}</p>`}</details></section>`;
}

export function eventBoardPage(board, { lang = "en" } = {}) {
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(board.title)}</title><style>${BOARD_CSS}</style></head><body class="event-standalone" data-model-view="events"><main>${renderEventBoard(board, { lang })}<section id="workflow-readiness"><h2>${lang === "ko" ? "다음 검토" : "Next review"}</h2><p>${lang === "ko" ? "이 보드는 업무 후보를 검토하는 자료입니다. 모델의 충분성, ADR 계약과 실행 결과는 각각 검토해야 하며 아직 미확인입니다." : "This board presents business candidates. Model sufficiency, ADR contracts and execution results need separate reviews and remain unverified."}</p></section></main><script>${BOARD_CLIENT}</script></body></html>`;
}

/** Show available structural evidence separately from semantic and execution reviews. */
export function renderWorkflowReadiness({
  index,
  mapping,
  findings = [],
  includeRetired = false,
  lang = "en",
  modelLink,
}) {
  const ko = lang === "ko",
    realization = realizersByStep(mapping);
  const link = (id, label) => (modelLink ? modelLink(id, label) : esc(label));
  const request = (title, prompt) =>
    `<details class="workflow-action"><summary>${esc(title)}</summary><pre tabindex="0">${esc(prompt)}</pre></details>`;
  const records = index
    .ofType("Process")
    .filter((p) => includeRetired || !isRetired(index, p))
    .map((p) => {
      const id = elementId(p),
        q = queryContext({
          index,
          mapping,
          findings,
          target: { kind: "process", id },
          includeRetired,
        });
      if (!q.found) return "";
      const scope = [
        ...q.openScope,
        ...q.steps.flatMap((s) => openScopeOf(index, elementIri(s.step.id)).items),
      ].filter((s) => s.kind !== "none");
      const steps = q.steps.filter((s) => isSystemStep(index, elementIri(s.step.id)));
      const missing = steps.filter((s) => !realization.get(s.step.id)?.length);
      const unimplemented = steps.filter((s) =>
        (realization.get(s.step.id) ?? []).some((f) => !implementationState(f.adrs).implemented),
      );
      const li = scope.map((s) => `<li>${esc(s.kind)}: ${esc(s.text)}</li>`).join("");
      return `<article class="workflow-process" id="workflow-${esc(anchor(id))}"><h3>${link(id, q.process.label ?? id)}</h3><p>${esc(q.startCondition ?? "")} → ${esc(q.businessOutcome ?? "")}</p><div class="workflow-axis"><h4>${ko ? "업무 모델의 충분성 · 미확인" : "Business-model sufficiency · unverified"}</h4><p>${ko ? "정상 흐름, 수행자·규칙, 예외·반려·인계와 근거 충돌은 의미 검토가 필요합니다." : "Normal flow, performers/rules, exceptions/rejections/hand-offs and conflicting evidence need semantic review."}</p>${li ? `<ul>${li}</ul>` : `<p>${ko ? "모델은 미정 범위 없음을 선언합니다. 완전성 검토 결과는 아닙니다." : "The model declares no open scope. This is not a completeness-review result."}</p>`}${!q.complete ? `<p class="event-unknown">${ko ? "이 범위에 검증 오류가 있습니다." : "Validation errors affect this scope."}</p>` : ""}</div><div class="workflow-axis"><h4>${ko ? "ADR 계약의 준비 · 의미 검토 미확인" : "ADR contract readiness · semantic review unverified"}</h4><p>${ko ? `시스템 단계 ${steps.length}개 · 기능 연결 없음 ${missing.length}개 · 실현 ADR 구현 미완료 ${unimplemented.length}개` : `${steps.length} system steps · ${missing.length} without feature links · ${unimplemented.length} with unfinished realizing ADRs`}</p><p>${ko ? "연결과 ADR Status는 참고 근거입니다. 인계 양쪽의 준수 계약, 미정 의무와 관찰 기준의 연결은 별도로 읽어 확인해야 합니다." : "Links and ADR Status are evidence to inspect. Review compliance contracts on both sides of hand-offs, pending obligations and their observation criteria separately."}</p></div><div class="workflow-axis"><h4>${ko ? "실제 실행 검증 · 미확인" : "Execution verification · unverified"}</h4><p>${ko ? `관찰 기준 ${q.criteria.length}개. 이 화면을 생성하면서 기능을 실행하거나 이전 실행 증거를 검증하지 않았습니다.` : `${q.criteria.length} observation criteria. Generating this view neither executes the features nor verifies prior execution evidence.`}</p><ul>${q.criteria.map((c) => `<li>${link(c.id, c.label ?? c.id)} — ${esc(c.observedResult ?? "")}</li>`).join("")}</ul></div>${request(ko ? "이 프로세스의 완전성·준비 상태 검토" : "Review this process for completeness/readiness", `/ontology-sync ${id} ${ko ? "완전성과 준비 상태를 읽기 전용으로 검토해줘. 업무 모델·ADR 계약·실제 실행 증거를 구별하고 파일과 Status는 바꾸지 마." : "Review completeness/readiness read-only. Distinguish the business model, ADR contracts and execution evidence; change no files or Status."}`)}${request(ko ? "추가 자료로 업무 흐름 보완" : "Extend this workflow from more evidence", `/ontology-build <${ko ? "추가 자료" : "additional sources"}> ${ko ? "범위" : "scope"}: ${id}`)}${request(ko ? "업무 변경 요청" : "Request a business change", `/ontology-edit ${id}: <${ko ? "바꿀 업무 행동·판단·예외" : "business action, rule or exception to change"}>`)}${request(ko ? "직접 편집한 모델 동기화" : "Reconcile direct model edits", `/ontology-sync ${id}`)}${request(ko ? "실제 기능을 실행하는 정렬 검토" : "Run alignment through real feature entry points", `/ontology-align ${id}`)}</article>`;
    });
  return `<section class="workflow-readiness" id="workflow-readiness"><h2>${ko ? "업무 준비 상태와 다음 작업" : "Workflow readiness and next actions"}</h2><p>${ko ? "업무를 구현·검증하는 데 필요한 맥락을 점검합니다. “구현됨”은 ADR Status에서 계산한 실현 현황이며, 업무 완전성이나 실제 실행 성공을 뜻하지 않습니다. 아래 요청문을 선택해 에이전트에게 전달할 수 있으며, 화면에서 명령을 실행하거나 모델을 저장하지 않습니다." : "Review the context needed to implement and verify the workflow. “Implemented” is derived from ADR Status; it does not establish business completeness or successful execution. Select a request below to send to your agent. This view executes no commands and saves no model."}</p>${request(ko ? "이벤트 스토밍으로 전체 업무 다시 확인" : "Discover the whole workflow through EventStorming", `/ontology-build <${ko ? "업무 자료" : "business evidence"}> ${ko ? "전체 이벤트 맵과 엔티티 변화, 바운디드 컨텍스트·서브도메인을 근거와 함께 보드로 보여줘." : "Show the whole event map, entity changes, bounded contexts and subdomains on an evidence-backed board."}`)}${records.join("")}</section>`;
}
