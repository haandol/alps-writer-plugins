import { renderEventLandscape } from "./eventstorming-landscape.mjs";

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
  const views = (s, role) => {
    const items = (s.views ?? []).filter((v) => v.role === role);
    const heading = text(
      role === "input" ? "행동에 참고하는 뷰" : "결과를 확인하는 뷰",
      role === "input" ? "View informing the action" : "View showing the result",
    );
    return `<div class="story-views" data-story-view-role="${role}">${items.length ? items.map((v) => `<details class="story-view"><summary><span class="story-kind">${heading}</span><strong>${esc(v.name)}</strong><span class="story-view-verdict">${labels[verdict(v)]}</span></summary>${v.description ? `<p>${esc(v.description)}</p>` : ""}${evidence(v)}</details>`).join("") : `<span class="story-view-missing">${text(role === "input" ? "입력 뷰 미기록" : "결과 뷰 미기록", role === "input" ? "Input view unrecorded" : "Result view unrecorded")}</span>`}</div>`;
  };
  const nodes = stages
    .map(({ stage: s, column, row }) => {
      const incoming = board.links.filter((l) => l.to === s.id);
      const causes = incoming
        .map((l) => {
          const from = byId.get(l.from);
          const sequence = l.relation === "sequence";
          return `<div class="story-link ${sequence ? "story-sequence" : "story-policy"}" data-story-from="${esc(l.from)}" data-story-to="${esc(l.to)}" data-story-source-index="${board.links.indexOf(l)}" data-story-relation="${sequence ? "sequence" : "causal"}">
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
      return `<article class="story-node" data-story-node="${esc(s.id)}" data-story-column="${column}" data-story-row="${row}" style="grid-column:${column + 1};grid-row:${row * 9 + 1} / span 9">
      <div class="story-context">${esc(s.context)}${s.retired ? ` · ${text("은퇴", "Retired")}` : ""}</div>
      ${views(s, "input")}
      ${select(s, "story-action", `<span class="story-performer"><span>${text("주체", "Performer")}</span><b>${esc(s.actor ?? text("수행 주체 미확인", "Performer unconfirmed"))}</b></span><span class="story-kind">${text(s.event ? "사건을 만드는 행동" : "기록된 업무 행동", s.event ? "Action producing this event" : "Recorded business action")}</span><strong>${esc(s.action)}</strong>`)}
      <div class="story-objects"><span class="story-kind">${text("업무 대상과 변화", "Business object and change")}</span>${changes || `<p class="story-object">${text("변화하는 대상 미확인", "Changing object unconfirmed")}</p>`}</div>
      ${select(s, `story-fact${s.event ? "" : " story-fact-missing"}`, `<span class="story-kind">${text(s.event ? "도메인 이벤트" : "중간 행동", s.event ? "Domain event" : "Intermediate action")}</span><strong>${esc(s.event?.name ?? s.action)}</strong>${s.event?.description && s.event.description !== s.event.name ? `<span class="story-fact-description">${esc(s.event.description)}</span>` : ""}${!s.event ? `<span class="story-fact-description">${text("발생 사건이 기록되지 않았습니다", "No emitted event is recorded")}</span>` : ""}<span class="story-verdict">${esc(labels[verdict(s)])}</span>`)}
      <div class="story-trace-space" aria-hidden="true"></div>
      ${views(s, "result")}
      <div class="story-incoming"><span class="story-kind">${text("시작 계기와 조건", "Incoming triggers and conditions")}</span>${causes || `<p class="story-entry">${text("시작 사건 별도 기록 없음", "No separate starting event recorded")}</p>`}</div>
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
    <div class="story-heading"><div><h3>${text("도메인 이벤트의 흐름", "Follow the domain events")}</h3><p>${text("업무 검토용 지도입니다. 세로로는 주체·행동 → 업무 변화 → 사건을 읽고, 가로 화살표로 다음 사건을 따라갑니다. 사건이나 선을 선택하면 관련 경로와 근거가 열립니다. 뷰는 행동에 참고하거나 결과를 확인하는 화면·조회 모델이며, 자동·외부 활동에는 없을 수 있습니다.", "A map for reviewing the business. Read each set downwards: performer/action → business change → event. Follow arrows across to the next event. Select events or links for related paths and evidence. Views inform an action or show its result; automated or external activity may have none.")}</p></div><div class="event-perspectives" role="group" aria-label="${text("사건 흐름의 표현", "Event flow perspective")}"><button type="button" data-event-perspective="story" aria-pressed="true">${text("개별 사건 흐름", "Event trace")}</button><button type="button" data-event-perspective="landscape" aria-pressed="false">${text("전체 업무 영역", "Business areas")}</button></div></div>
    <div class="story-projection"><div class="story-toolbar"><div class="story-legend"><span class="action">${text("주체·행동", "Performer / action")}</span><span class="fact">${text("일어난 사건", "Event")}</span><span class="view">${text("뷰", "View")}</span><span class="policy">${text("정책·조건", "Policy / condition")}</span><span class="question">${text("미정 질문", "Open question")}</span></div><div class="story-camera"><button type="button" class="story-trace-clear" disabled>${text("전체 경로", "All paths")}</button><button type="button" class="event-flow-toggle" aria-pressed="false">${text("흐름 효과 켜기", "Play flow")}</button><button type="button" data-story-camera="out" aria-label="${text("사건 흐름 축소", "Zoom out of event flow")}">−</button><output class="story-scale">100%</output><button type="button" data-story-camera="in" aria-label="${text("사건 흐름 확대", "Zoom into event flow")}">+</button><button type="button" data-story-camera="fit">${text("전체 흐름", "Fit flow")}</button></div></div>
    <div class="story-surface"><div class="story-viewport" tabindex="0" role="region" aria-label="${text("사건 흐름 캔버스. 드래그로 이동, 스크롤로 확대. 화살표로 이동하고 더하기·빼기로 확대합니다.", "Event-flow canvas. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom.")}"><div class="story-world" style="--story-columns:${columns}"><svg class="story-connections" aria-hidden="true"></svg><div class="story-trace-labels"></div><div class="story-nodes">${nodes || `<p>${text("표시할 업무 사건이 없습니다.", "No business events are available.")}</p>`}</div></div></div><aside class="story-inspector" hidden><div class="story-inspector-header"><h3>${text("업무 상세와 근거", "Business detail and evidence")}</h3><button type="button" class="story-close">${text("닫기", "Close")}</button></div><div class="story-inspector-body"></div></aside></div>
    <p class="event-flow-status" role="status" aria-live="polite"></p><p class="event-flow-note">${text("은은한 신호는 기록된 사건의 연결 방향입니다. 실제 실행이나 통신 상태를 나타내지 않습니다.", "Subtle signals show recorded event directions, not live execution or network traffic.")}</p><p class="story-order-note">${text("반응 경로는 정책과 행동을 거쳐 다음 사건으로 이어집니다. 옅은 순서 선은 행동의 진행 순서입니다. 배치는 발생 시각을 뜻하지 않으며, 연결 없는 항목 사이의 순서는 미확인입니다.", "Reaction paths run through a policy and action to the next event. Lighter sequence lines show action order. Position is not a timestamp; order between unconnected items is unconfirmed.")}${cyclic ? ` ${text("되돌아오는 연결도 표시합니다.", "Returning links are preserved.")}` : ""}</p></div>
    ${renderEventLandscape(board, { lang, esc, evidence })}
    ${questions ? `<aside class="story-questions" aria-label="${text("흐름에서 확인할 질문", "Questions about this flow")}">${questions}</aside>` : ""}
  </section>`;
}
