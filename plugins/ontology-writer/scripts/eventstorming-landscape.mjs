/**
 * Project supplied business-area claims without equating subdomains and contexts.
 * A shared context appears once; explicit membership chips retain every association.
 * Legacy stage labels can still group a board, but cannot establish subdomain membership.
 */
export function eventLandscape(board) {
  const keyOf = (s) =>
    s.contextId === null
      ? "unknown:"
      : s.contextId === undefined
        ? `label:${s.context}`
        : `id:${s.contextId}`;
  const contexts = new Map(
    (board.contexts ?? []).map((c) => [`id:${c.id}`, { ...c, key: `id:${c.id}`, stages: [] }]),
  );
  for (const stage of board.stages) {
    const key = keyOf(stage);
    if (!contexts.has(key))
      contexts.set(key, {
        key,
        id: stage.contextId ?? null,
        name: stage.context,
        description: stage.contextDescription,
        verdict: stage.contextId === null ? "unconfirmed" : stage.verdict,
        evidence: stage.contextId === null ? [] : stage.evidence,
        stages: [],
      });
    contexts.get(key).stages.push(stage);
  }
  const groups = (board.subdomains ?? []).map((s, i) => ({
    ...s,
    key: `subdomain:${i}`,
    contexts: [],
  }));
  const shared = { key: "shared:", kind: "shared", contexts: [] };
  const unassigned = { key: "unassigned:", kind: "unassigned", contexts: [] };
  for (const context of contexts.values()) {
    const membershipGroups = groups.filter(
      (g) => context.id !== null && g.contextIds?.includes(context.id),
    );
    context.memberships = membershipGroups.map(({ contexts: _contexts, ...claim }) => claim);
    if (membershipGroups.length === 1) membershipGroups[0].contexts.push(context);
    else (context.memberships.length ? shared : unassigned).contexts.push(context);
  }
  if (shared.contexts.length) groups.push(shared);
  if (unassigned.contexts.length) groups.push(unassigned);
  const byStage = new Map(board.stages.map((s) => [s.id, s]));
  const links = new Map();
  for (const [index, link] of board.links.entries()) {
    const fromStage = byStage.get(link.from),
      toStage = byStage.get(link.to);
    const from = keyOf(fromStage),
      to = keyOf(toStage),
      relation = link.relation ?? "causal";
    // Internal relationships stay in the context's activity detail and event trace.
    if (from === to) continue;
    const key = JSON.stringify([from, to, relation]);
    if (!links.has(key)) links.set(key, { from, to, relation, links: [], animated: false });
    const group = links.get(key);
    group.links.push({
      ...link,
      index,
      event: fromStage.event?.name,
      sourceAction: fromStage.action,
      action: toStage.action,
    });
    group.animated ||= relation === "causal" && Boolean(fromStage.event);
  }
  return { contexts: [...contexts.values()], groups, links: [...links.values()] };
}

/** Offline, read-only overview; source evidence remains accessible without a canvas. */
export function renderEventLandscape(board, { lang, esc, evidence }) {
  const ko = lang === "ko",
    text = (kr, en) => (ko ? kr : en);
  const { contexts, groups, links } = eventLandscape(board);
  const verdict = (c) => (c.evidence?.length ? c.verdict : "unconfirmed");
  const labels = {
    stated: text("자료 명시", "Stated"),
    inferred: text("추론", "Inferred"),
    conflicting: text("충돌", "Conflicting"),
    unconfirmed: text("미확인", "Unconfirmed"),
  };
  const classification = (s) =>
    !s.evidence?.length ? "unconfirmed" : (s.classification ?? "unconfirmed");
  const types = {
    core: text("핵심 업무", "Core domain"),
    supporting: text("지원 업무", "Supporting"),
    generic: text("일반 업무", "Generic"),
    unconfirmed: text("분류 미확인", "Classification unconfirmed"),
  };
  const badge = (c) =>
    `<span class="land-verdict" data-verdict="${verdict(c)}">${labels[verdict(c)]}</span>`;
  const membership = (c) =>
    c.memberships.length
      ? c.memberships
          .map(
            (g) =>
              `<span class="land-membership" data-land-membership="${esc(g.key)}">${esc(g.name)} · ${labels[verdict(g)]}</span>`,
          )
          .join("")
      : `<span class="land-membership">${text("서브도메인 소속 미확인", "Subdomain membership unconfirmed")}</span>`;
  const stage = (s) =>
    `<button type="button" class="land-stage" data-land-stage="${esc(s.id)}"><span>${esc(s.actor ?? text("주체 미확인", "Performer unconfirmed"))} · ${esc(s.action)}</span><strong class="${s.event ? "" : "land-no-event"}">${esc(s.event?.name ?? text("발생 사건 미기록", "Emitted event unrecorded"))}</strong></button>`;
  const context = (
    c,
  ) => `<article class="land-context ${c.external === true ? "land-external" : ""}" data-land-context="${esc(c.key)}" data-context-id="${esc(c.id ?? "")}">
    <button type="button" class="land-context-title" data-land-inspect="${esc(c.key)}"><span>${text("바운디드 컨텍스트", "Bounded context")}${c.external === true ? ` · ${text("외부", "External")} · ${labels[verdict(c)]}` : ""}</span><strong>${esc(c.name)}</strong><small>${esc(c.id ?? text("식별자 미기록", "Identity unrecorded"))}</small></button>
    <div class="land-context-preview">${c.stages.slice(0, 3).map(stage).join("") || `<p>${text("이 컨텍스트의 활동은 아직 기록되지 않았습니다.", "No activity recorded for this context.")}</p>`}</div>
    <button type="button" class="land-context-more" data-land-inspect="${esc(c.key)}">${text(`활동 ${c.stages.length}개와 소속·근거`, `${c.stages.length} activities, membership and evidence`)} ↗</button>
    <template class="land-context-detail"><h3>${esc(c.name)}</h3><p>${esc(c.description ?? text("책임 설명 미기록", "Responsibility unrecorded"))}</p><p class="land-identity">${esc(c.id ?? text("컨텍스트 식별자 미기록", "Context identity unrecorded"))}</p>${c.external === true ? `<p>${text("외부 컨텍스트", "External context")} · ${labels[verdict(c)]}</p>` : ""}${evidence(c)}<h4>${text("서브도메인 소속", "Subdomain membership")}</h4><div class="land-memberships">${membership(c)}</div>${c.memberships.map(evidence).join("")}<h4>${text("이 컨텍스트의 원인과 결과", "Causes and outcomes in this context")}</h4>${c.stages.map(stage).join("") || `<p>${text("활동 미기록", "Activities unrecorded")}</p>`}</template>
  </article>`;
  const group = (g) => {
    const title =
      g.kind === "shared"
        ? text("여러 업무 영역에 걸친 컨텍스트", "Contexts spanning business areas")
        : g.kind === "unassigned"
          ? text("서브도메인 소속 미확인", "Subdomain membership unconfirmed")
          : g.name;
    return `<section class="land-region ${g.kind ? `land-${g.kind}` : `land-${classification(g)}`}" data-land-region="${esc(g.key)}"><header><div><span class="land-region-kind">${g.kind ? text("소속 구분", "Membership") : types[classification(g)]}</span><h4>${esc(title)}</h4></div>${g.kind ? "" : badge(g)}</header>${g.kind === "shared" ? `<p>${text("컨텍스트는 한 번만 표시합니다. 아래 소속 표시는 같은 컨텍스트가 관련된 업무 영역입니다.", "Each context appears once. Membership labels identify every associated business area.")}</p>` : g.kind === "unassigned" ? `<p>${text("이름이나 배치만으로 서브도메인을 정하지 않았습니다.", "Names and position do not establish a subdomain.")}</p>` : `<details class="land-region-evidence"><summary>${text("업무 책임과 근거", "Responsibility and evidence")}</summary><p>${esc(g.responsibility)}</p>${evidence(g)}</details>`}<div class="land-contexts">${g.contexts.map((c) => `<div class="land-context-slot">${g.kind === "shared" ? `<div class="land-memberships">${membership(c)}</div>` : ""}${context(c)}</div>`).join("") || `<p class="land-empty">${g.contextIds?.length ? text("복수 소속 컨텍스트는 아래에 함께 표시합니다.", "Shared contexts appear together below.") : text("컨텍스트 소속 미기록", "No context membership recorded")}</p>`}</div></section>`;
  };
  return `<section class="event-landscape" id="event-landscape" hidden aria-label="${text("전체 업무 영역", "Business areas")}">
    <p class="land-intro">${text("도메인은 다루는 업무 전체, 서브도메인은 그 안의 업무 문제 영역, 바운디드 컨텍스트는 같은 언어와 규칙을 소유하는 경계입니다. 컨텍스트를 열면 활동과 근거를, 사건을 선택하면 전체 흐름을 따라갈 수 있습니다.", "A domain is the business scope; subdomains are its problem areas; bounded contexts own consistent language and rules. Open a context for its activities and evidence, or select an event to follow the complete flow.")}</p>
    <div class="land-toolbar"><span class="land-key">${text("영역 안의 카드 = 컨텍스트 · 화살표 = 기록된 인계", "Cards = contexts · arrows = recorded hand-offs")}</span><div class="land-camera"><button type="button" class="land-flow-toggle event-flow-toggle"></button><button type="button" data-land-camera="out" aria-label="${text("업무 영역 축소", "Zoom out business areas")}">−</button><output class="land-scale">100%</output><button type="button" data-land-camera="in" aria-label="${text("업무 영역 확대", "Zoom in business areas")}">+</button><button type="button" data-land-camera="fit">${text("전체 영역", "Fit areas")}</button></div></div>
    <div class="land-surface"><div class="land-viewport" tabindex="0" role="region" aria-label="${text("업무 영역 캔버스 · 드래그로 이동, 휠로 확대", "Business areas canvas · drag to pan, wheel to zoom")}"><div class="land-world"><div class="land-domain" style="--land-columns:${Math.max(1, Math.min(3, groups.filter((g) => !g.kind).length || contexts.length))}"><header class="land-domain-header"><div><span>${text("도메인 · 전체 업무 범위", "Domain · business scope")}</span><h3>${esc(board.domain?.name ?? text("도메인 이름 미확인", "Domain name unconfirmed"))}</h3></div>${board.domain ? `<details class="land-domain-source"><summary>${text("범위와 근거", "Scope and evidence")} · ${labels[verdict(board.domain)]}</summary><p>${esc(board.domain.description ?? board.scope)}</p>${evidence(board.domain)}</details>` : `<span>${text("도메인·서브도메인은 저장 모델에서 복원하지 않습니다.", "Domain and subdomains are not recovered from this model.")}</span>`}</header><div class="land-regions">${groups.map(group).join("") || `<p>${text("컨텍스트 미기록", "No contexts recorded")}</p>`}</div></div><svg class="land-connections" aria-hidden="true"></svg><div class="land-link-labels">${links.map((l, i) => `<button type="button" class="land-link-label ${l.relation === "sequence" ? "sequence" : ""}" data-land-route="${i}" data-land-from="${esc(l.from)}" data-land-to="${esc(l.to)}" data-land-relation="${l.relation}" data-land-animated="${l.animated}" aria-label="${esc(`${contexts.find((c) => c.key === l.from).name} → ${contexts.find((c) => c.key === l.to).name}`)} · ${text(l.relation === "sequence" ? "진행 순서" : "사건 반응", l.relation === "sequence" ? "Sequence" : "Event reaction")}">${text(l.relation === "sequence" ? "순서" : "사건 반응", l.relation === "sequence" ? "Sequence" : "Reaction")} ${l.links.length}<template><h3>${text("컨텍스트 사이의 기록된 인계", "Recorded cross-context hand-offs")}</h3><p>${l.relation === "sequence" ? text("진행 순서이며 사건 인과나 통신을 뜻하지 않습니다.", "Action order, not event causation or communication.") : text("기록된 정책이 후속 행동을 시작하는 관계입니다. 실제 처리 상태는 아닙니다.", "Recorded policies starting subsequent actions, not live processing status.")}</p>${l.links.map((r) => `<div class="land-relation-detail"><p>${esc(l.relation === "sequence" ? r.sourceAction : (r.event ?? text("시작 사건 미기록", "Starting event unrecorded")))} → ${esc(r.action)}</p><strong>${esc(r.label)}</strong>${r.condition ? `<p>${esc(r.condition)}</p>` : ""}${evidence(r)}<button type="button" data-land-link-index="${r.index}">${text("사건 흐름에서 이 연결 보기", "Follow this relation in the event flow")} ↗</button></div>`).join("")}</template></button>`).join("")}</div></div></div><aside class="land-inspector" hidden aria-label="${text("업무 영역 상세", "Business area detail")}"><div class="land-inspector-header"><h3>${text("소속과 업무 흐름", "Membership and workflow")}</h3><button type="button" class="land-close">${text("닫기", "Close")}</button></div><div class="land-inspector-body"></div></aside></div>
    <p class="event-flow-status" role="status" aria-live="polite"></p><p class="land-note">${text("복수 소속은 소속 이름으로 명시합니다. 배치와 크기는 업무 중요도·실행 시간·서비스 구조를 뜻하지 않습니다. 움직이는 신호는 기록된 방향을 설명합니다.", "Shared membership is explicit in the labels. Placement and size do not express business importance, execution time or service structure. Moving signals explain recorded directions.")}</p>
  </section>`;
}
