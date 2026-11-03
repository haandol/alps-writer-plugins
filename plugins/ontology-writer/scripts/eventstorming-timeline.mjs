/**
 * Lay out a partial business order, not a clock or an execution trace. Independent
 * branches share a column without asserting simultaneity. Cycles keep all their
 * links and use a stable reading order for the remaining nodes.
 */
export function layoutEventStages(board) {
  const pending = new Set(board.stages.map((s) => s.id));
  const ranks = new Map();
  let cyclic = false;
  while (pending.size) {
    const ready = board.stages.filter(
      (s) => pending.has(s.id) && !board.links.some((l) => l.to === s.id && pending.has(l.from)),
    );
    if (!ready.length) {
      cyclic = true;
      let rank = Math.max(-1, ...ranks.values()) + 1;
      for (const s of board.stages) if (pending.has(s.id)) ranks.set(s.id, rank++);
      break;
    }
    for (const s of ready) {
      const predecessors = board.links.filter((l) => l.to === s.id).map((l) => ranks.get(l.from));
      ranks.set(s.id, Math.max(-1, ...predecessors) + 1);
      pending.delete(s.id);
    }
  }
  const rows = new Map();
  const stages = board.stages.map((stage) => {
    const column = ranks.get(stage.id);
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return { stage, column, row };
  });
  return { stages, columns: Math.max(0, ...ranks.values()) + 1, cyclic };
}

/** Render the validated event story while retaining access to complete source cards. */
export function renderEventTimeline(board, { lang, esc, evidence, tabbed = false }) {
  const ko = lang === "ko";
  const { stages, columns, cyclic } = layoutEventStages(board);
  const text = (kr, en) => (ko ? kr : en);
  const byId = new Map(board.stages.map((s) => [s.id, s]));
  const verdict = (claim) => (claim.evidence.length ? claim.verdict : "unconfirmed");
  const labels = {
    stated: text("자료 명시", "Stated"),
    inferred: text("추론", "Inferred"),
    conflicting: text("충돌", "Conflicting"),
    unconfirmed: text("미확인", "Unconfirmed"),
  };
  const select = (s, className, content) =>
    `<button type="button" class="${className}" data-story-select="${esc(s.id)}" aria-pressed="false">${content}</button>`;
  const nodes = stages
    .map(({ stage: s, column, row }) => {
      const incoming = board.links.filter((l) => l.to === s.id);
      const causes = incoming
        .map((l) => {
          const from = byId.get(l.from);
          const sequence = l.relation === "sequence";
          return `<div class="story-link ${sequence ? "story-sequence" : "story-policy"}" data-story-from="${esc(l.from)}" data-story-to="${esc(l.to)}" data-story-relation="${sequence ? "sequence" : "causal"}">
        <span class="story-kind">${text(sequence ? "진행 순서" : "반응 정책", sequence ? "Sequence" : "Reaction policy")}</span>
        <p class="story-source">${esc(sequence ? from.action : (from.event?.name ?? text("시작 사건 미기록", "Starting event unrecorded")))}</p>
        ${sequence ? "" : `<strong>${esc(l.label)}</strong><p class="story-condition">${esc(l.condition ?? text("조건 별도 기록 없음", "Condition not recorded separately"))}</p>`}
        <span class="story-policy-target">→ ${esc(s.action)}</span>
        ${verdict(l) !== "stated" ? `<span class="story-verdict">${esc(labels[verdict(l)])}</span>` : ""}
        ${evidence(l)}
      </div>`;
        })
        .join("");
      const changes = s.entities
        .map((e) => {
          const known =
            e.kind !== "concept" &&
            verdict(e) === "stated" &&
            e.before !== null &&
            e.after !== null;
          return `<p class="story-object" data-story-change-known="${known}"><b>${esc(e.name)}</b><span>${known ? `${esc(e.before)} → ${esc(e.after)}` : text("변화 여부 미확인", "Change unconfirmed")}</span></p>`;
        })
        .join("");
      const rules = (s.rules ?? [])
        .map(
          (r) =>
            `<details class="story-rule"><summary>${esc(r.name)}</summary><p>${esc(r.description ?? "")}</p><p class="story-rule-scope">${esc(r.scope)}</p>${evidence(r)}</details>`,
        )
        .join("");
      return `<article class="story-node" data-story-node="${esc(s.id)}" style="grid-column:${column + 1};grid-row:${row * 6 + 1} / span 6">
      <div class="story-context">${esc(s.context)}${s.retired ? ` · ${text("은퇴", "Retired")}` : ""}</div>
      <div class="story-incoming">${causes || `<p class="story-entry">${text("시작 사건 별도 기록 없음", "No separate starting event recorded")}</p>`}</div>
      ${select(s, `story-fact${s.event ? "" : " story-fact-missing"}`, `<span class="story-kind">${text(s.event ? "도메인 이벤트" : "사건 미기록", s.event ? "Domain event" : "Event unrecorded")}</span><strong>${esc(s.event?.name ?? text("발생 사건이 기록되지 않았습니다", "No emitted event is recorded"))}</strong>${s.event?.description && s.event.description !== s.event.name ? `<span class="story-fact-description">${esc(s.event.description)}</span>` : ""}<span class="story-verdict">${esc(labels[verdict(s)])}</span>`)}
      ${select(s, "story-action", `<span class="story-kind">${text(s.event ? "이 사건을 만든 행동" : "기록된 업무 행동", s.event ? "Action producing this event" : "Recorded business action")}</span><strong>${esc(s.action)}</strong><span>${esc(s.actor ?? text("수행 주체 미확인", "Performer unconfirmed"))}</span>`)}
      <div class="story-objects">${changes ? `<span class="story-kind">${text("업무 대상", "Business objects")}</span>${changes}` : ""}</div>
      <div class="story-rules">${rules ? `<span class="story-kind">${text("관련 업무 규칙", "Related business rules")}</span>${rules}` : ""}</div>
    </article>`;
    })
    .join("");
  const questions = (board.questions ?? [])
    .map(
      (q) =>
        `<details class="story-question" data-story-question="${esc(q.id)}" data-question-scope="${esc(q.scopeType)}"><summary><span class="story-kind">${text("미정 경로 · 확인할 질문", "Open path · question to resolve")}</span><strong>${esc(q.text)}</strong></summary><p>${esc(q.scope)}</p><p>${q.scopeType === "process" ? text("프로세스 전체의 미정 범위입니다. 특정 사건의 실패 분기로 확정하지 않았습니다.", "An open scope for this process, not an established failure branch of one event.") : text("이 단계에 기록된 미정 범위입니다.", "An open scope recorded for this step.")}</p><div class="story-question-actions">${q.stages.map((id) => `<button type="button" data-story-reveal="${esc(id)}">${esc(byId.get(id).action)}</button>`).join("")}</div>${evidence(q)}</details>`,
    )
    .join("");
  return `<section class="event-timeline" id="event-story" ${tabbed ? 'role="tabpanel" aria-labelledby="view-events-tab"' : `aria-label="${text("사건 흐름", "Event flow")}"`}>
    <div class="story-heading"><div><h3>${text("무슨 일이 일어나고, 다음 업무는 왜 시작될까요?", "What happens, and why does the next action start?")}</h3><p>${text("업무 검토용 지도입니다. 사건을 따라 읽고, 정책과 조건을 확인하세요. 사건을 선택하면 업무 대상·변화·근거를 자세히 볼 수 있습니다.", "A map for reviewing the business. Follow the events and their reaction conditions. Select an event to inspect its business objects, changes and evidence.")}</p></div></div>
    <div class="story-toolbar"><div class="story-legend"><span class="fact">${text("일어난 사건", "Event")}</span><span class="action">${text("업무 행동", "Action")}</span><span class="policy">${text("정책·조건", "Policy / condition")}</span><span class="question">${text("미정 질문", "Open question")}</span></div><div class="story-camera"><button type="button" class="event-flow-toggle" aria-pressed="false">${text("흐름 효과 켜기", "Play flow")}</button><button type="button" data-story-camera="out" aria-label="${text("사건 흐름 축소", "Zoom out of event flow")}">−</button><output class="story-scale">100%</output><button type="button" data-story-camera="in" aria-label="${text("사건 흐름 확대", "Zoom into event flow")}">+</button><button type="button" data-story-camera="fit">${text("전체 흐름", "Fit flow")}</button></div></div>
    <div class="story-surface"><div class="story-viewport" tabindex="0" role="region" aria-label="${text("사건 흐름 캔버스. 드래그로 이동, 스크롤로 확대. 화살표로 이동하고 더하기·빼기로 확대합니다.", "Event-flow canvas. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom.")}"><div class="story-world" style="--story-columns:${columns}"><svg class="story-connections" aria-hidden="true"></svg><div class="story-nodes">${nodes || `<p>${text("표시할 업무 사건이 없습니다.", "No business events are available.")}</p>`}</div></div></div><aside class="story-inspector" hidden><div class="story-inspector-header"><h3>${text("업무 상세와 근거", "Business detail and evidence")}</h3><button type="button" class="story-close">${text("닫기", "Close")}</button></div><div class="story-inspector-body"></div></aside></div>
    <p class="event-flow-note">${text("은은한 신호는 기록된 사건의 연결 방향입니다. 실제 실행이나 통신 상태를 나타내지 않습니다.", "Subtle signals show recorded event directions, not live execution or network traffic.")}</p><p class="story-order-note">${text("실선은 사건에 대한 반응, 점선은 진행 순서입니다. 배치는 발생 시각을 뜻하지 않으며, 연결 없는 항목 사이의 순서는 미확인입니다.", "Solid lines show event reactions; dashed lines show sequence. Position is not a timestamp; order between unconnected items is unconfirmed.")}${cyclic ? ` ${text("되돌아오는 연결도 표시합니다.", "Returning links are preserved.")}` : ""}</p>
    ${questions ? `<aside class="story-questions" aria-label="${text("흐름에서 확인할 질문", "Questions about this flow")}">${questions}</aside>` : ""}
  </section>`;
}
