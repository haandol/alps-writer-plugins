(() => {
  const byId = (id) => document.getElementById(id);
  const t = (ko, en) => (document.documentElement.lang === "ko" ? ko : en);
  const base = document.body.dataset.base;
  let closed = false,
    timer;
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  async function api(route, value) {
    const res = await fetch(
      base + route,
      value === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          },
    );
    if (!res.ok)
      throw new Error(
        (await res.json().catch(() => ({}))).error || `${res.status} ${res.statusText}`,
      );
    return res.json();
  }
  const drafts = new Map(),
    submitting = new Set(),
    answerErrors = new Map();
  function drawTurn(card, m, turn) {
    const form = el("div", null, "align-turn");
    form.append(
      el(
        "strong",
        turn.kind === "proposal"
          ? t("변경안", "Change proposal")
          : t("에이전트 질문", "Agent question"),
      ),
      el("p", turn.question),
    );
    for (const c of turn.changes ?? []) {
      const group = el("div", null, "change");
      group.append(
        el("strong", c.layer + " · " + c.target),
        el("p", t("현재 · ", "Current · ") + c.before),
        el("p", t("제안 · ", "Proposed · ") + c.after),
      );
      form.append(group);
    }
    if (turn.verification)
      form.append(el("p", t("검증 방법 · ", "Verification · ") + turn.verification));
    if (turn.baseline) {
      const basis = el("details", null, "proposal-baseline");
      basis.append(
        el("summary", t("비교 기준 · ", "Compared inputs · ") + turn.baseline.files.length),
        el("code", turn.baseline.fingerprint),
      );
      const files = el("ul");
      for (const path of turn.baseline.files) files.append(el("li", path));
      basis.append(files);
      form.append(basis);
    }
    card.append(form);
    const key = m.messageId + "/" + turn.promptId;
    if (turn.response) {
      const names = {
        approve: t("변경 승인", "Approved"),
        decline: t("변경 거절", "Declined"),
        answer: t("내 답변", "Your answer"),
        clarify: t("내 질문", "Your question"),
        stale: t("근거 변경 · 새 변경안 대기", "Inputs changed · awaiting revised proposal"),
      };
      form.append(
        el(
          "p",
          names[turn.response.decision] + (turn.response.text ? " · " + turn.response.text : ""),
        ),
      );
      return;
    }
    if (!turn.current || m.reply || closed) return;
    const input = el("textarea");
    input.value = drafts.get(key) ?? "";
    input.setAttribute("aria-label", t("에이전트에게 보낼 내용", "Message for agent"));
    input.oninput = () => drafts.set(key, input.value);
    form.append(input);
    const feedback = el("p", answerErrors.get(key) ?? "");
    feedback.setAttribute("role", "status");
    const button = (title, decision) => {
      const b = el("button", title);
      b.type = "button";
      b.disabled = submitting.has(key);
      b.onclick = async () => {
        if (submitting.has(key)) return;
        const text = input.value.trim();
        if ((decision === "answer" || decision === "clarify") && !text) {
          input.focus();
          return;
        }
        if ((decision === "approve" || decision === "decline") && text) {
          feedback.textContent = t(
            "작성한 질문을 먼저 보내거나 지운 뒤 선택하세요.",
            "Send or clear your message before deciding.",
          );
          return;
        }
        submitting.add(key);
        for (const other of form.querySelectorAll("button")) other.disabled = true;
        try {
          const state = await api("/api/respond", {
            requestId: m.messageId,
            promptId: turn.promptId,
            decision,
            text,
          });
          drafts.delete(key);
          answerErrors.delete(key);
          render(state);
        } catch (e) {
          answerErrors.set(key, e.message);
          feedback.textContent = e.message;
          for (const other of form.querySelectorAll("button")) other.disabled = false;
        } finally {
          submitting.delete(key);
        }
      };
      form.append(b);
    };
    if (turn.kind === "question") button(t("답변 보내기", "Send answer"), "answer");
    else {
      button(t("변경안에 질문", "Ask about proposal"), "clarify");
      button(t("이 변경안 승인", "Approve these changes"), "approve");
      button(t("거절", "Decline"), "decline");
    }
    form.append(feedback);
  }
  function resultCard(m) {
    const labels = {
      passed: t("통과", "Passed"),
      failed: t("실패", "Failed"),
      blocked: t("차단", "Blocked"),
      unverified: t("미검증", "Unverified"),
    };
    const card = el("div", null, "result"),
      r = m.reply?.result;
    card.append(el("h3", m.scope.process));
    const turn = m.dialogue?.at(-1);
    let progress = m.delivered
      ? t("에이전트에 전달됨", "Delivered to agent")
      : t("전달 대기", "Queued");
    const waiting = m.dialogue?.find((item) => item.current && !item.response);
    if (waiting) {
      progress =
        waiting.kind === "proposal"
          ? t("변경안 확인 대기", "Awaiting decision")
          : t("답변 대기", "Awaiting your answer");
    } else if (turn?.response) {
      progress =
        turn.response.decision === "approve"
          ? t(
              "변경 승인됨 · 적용 및 재검증 대기",
              "Approved · awaiting application and verification",
            )
          : t("응답 접수 · 에이전트 처리 대기", "Response received · awaiting agent");
    }
    card.append(
      el(
        "strong",
        m.scope.criteria.length ? m.scope.criteria.join(", ") : t("프로세스 전체", "Whole process"),
      ),
      el("p", r ? labels[r.outcome] : progress),
    );
    for (const turn of m.dialogue ?? []) drawTurn(card, m, turn);
    if (r)
      card.append(el("p", r.evidence), el("p", t("다음 행동 · ", "Next action · ") + r.nextAction));
    return card;
  }
  const cards = new Map();
  function results(s) {
    const box = byId("requests");
    const messages = (s.discussion?.messages ?? [])
      .filter((m) => m.scope && m.dialogue?.length)
      .filter(
        (m) =>
          byId("history").checked ||
          (!m.reply && m.dialogue.some((turn) => turn.current && !turn.response)),
      )
      .reverse();
    const visible = new Set(messages.map((m) => m.messageId));
    for (const [id, item] of cards) {
      if (!visible.has(id)) {
        item.node.remove();
        cards.delete(id);
      }
    }
    if (!messages.length) {
      if (!box.querySelector("p"))
        box.replaceChildren(
          el(
            "p",
            t(
              "답할 질문이나 승인할 변경안이 없습니다.",
              "No questions or proposals awaiting your decision.",
            ),
          ),
        );
      return;
    }
    box.querySelector(":scope > p")?.remove();
    // Keep unchanged editors attached, including in-progress IME composition.
    // Inserting a new sibling or receiving its reply must not steal focus.
    let next = null;
    for (const m of messages.slice().reverse()) {
      // Once the agent has spoken, its delivery receipt is no longer displayed.
      // A concurrent listener claiming that receipt must not replace the live editor.
      const version = JSON.stringify([closed, m.dialogue?.length ? { ...m, delivered: true } : m]);
      let item = cards.get(m.messageId);
      if (!item || item.version !== version) {
        const node = resultCard(m);
        if (item) item.node.replaceWith(node);
        else box.insertBefore(node, next);
        item = { version, node };
        cards.set(m.messageId, item);
      }
      next = item.node;
    }
  }
  let latest;
  function render(s) {
    if (latest && s.sequence < latest.sequence) return;
    latest = s;
    byId("connection").textContent = s.discussion?.available
      ? t("에이전트 연결됨", "Agent listening")
      : t("에이전트 연결 대기", "Waiting for agent");
    byId("warning").textContent = s.warning ?? "";
    results(s);
  }
  async function poll() {
    try {
      const s = await api("/api/state");
      if (!closed) render(s);
    } catch {
      if (!closed)
        byId("connection").textContent = t("연결을 확인하세요", "Connection unavailable");
    }
    if (!closed) timer = setTimeout(poll, 1200);
  }
  byId("history").onchange = () => {
    if (latest) results(latest);
  };
  byId("end").onclick = async () => {
    try {
      await api("/api/close", {});
      closed = true;
      clearTimeout(timer);
      if (latest) results(latest);
      byId("end").disabled = true;
      byId("connection").textContent = t("세션 종료", "Session ended");
    } catch (e) {
      byId("warning").textContent = e.message;
    }
  };
  poll();
})();
