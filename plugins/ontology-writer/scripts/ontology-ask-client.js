// Browser side of the ontology question session. Question text, evidence and
// diagram sources are written as text nodes, so text taken from documents never
// runs as markup. The only markup inserted is the SVG Mermaid produces with its
// strict security level, which sanitizes labels.
(() => {
  const app = document.getElementById("app");
  const ko = app.dataset.lang === "ko";
  const T = ko
    ? {
        immediate: "바로 보내기",
        batch: "모아 보내기",
        send: "의견 보내기",
        save: "의견 저장",
        submitAll: (n) => `모은 답 ${n}개 보내기`,
        progress: (a, t, p, r) =>
          `답한 질문 ${a}/${t}${p ? ` · 보내기 전 ${p}` : ""}${r ? ` · 내부 해소 ${r}` : ""}`,
        working: "에이전트가 답을 반영하는 중입니다…",
        idle: "답을 기다리는 중입니다.",
        answered: "내 답",
        pending: "보내기 전",
        sent: "전달됨",
        chat: "대화에서 답함",
        closedQ: "닫힌 질문",
        textHint: "직접 답하거나 덧붙일 내용 (선택지는 고르면 바로 저장됩니다)",
        endSession: "세션 끝내기",
        ended: "세션이 끝났습니다. 남은 질문은 대화에서 답할 수 있습니다.",
        note: "이 화면은 답만 모읍니다. 저장 승인은 대화에서 합니다.",
        warning: "에이전트가 올린 질문 파일을 읽지 못해 이전 질문을 보여 줍니다:",
        failed: "보내지 못했습니다:",
        confirmEnd: "세션을 끝낼까요?",
        recommended: "추천",
        evidence: "근거",
        source: "다이어그램 원본",
        notRendered: "다이어그램을 그리지 못했습니다",
        all: "전체",
        resolvedBox: (n) => `저장소 근거로 해소한 질문 ${n}개 — 다르면 다시 답해 주세요`,
        resolvedBy: "해소",
        partlyResolvedBy: "저장소 근거로 일부 해소",
        override: "다르게 답하기",
        verdicts: { stated: "명시", inferred: "추론", conflicting: "충돌", unconfirmed: "미확인" },
      }
    : {
        immediate: "Send now",
        batch: "Collect",
        send: "Send note",
        save: "Save note",
        submitAll: (n) => `Send ${n} collected answers`,
        progress: (a, t, p, r) =>
          `Answered ${a}/${t}${p ? ` · ${p} not sent` : ""}${r ? ` · ${r} resolved` : ""}`,
        working: "The agent is applying your answers…",
        idle: "Waiting for your answers.",
        answered: "Your answer",
        pending: "Not sent",
        sent: "Delivered",
        chat: "Answered in chat",
        closedQ: "Closed",
        textHint: "Answer or add a note (choosing an option saves it at once)",
        endSession: "End session",
        ended: "The session has ended. Remaining questions can be answered in the conversation.",
        note: "This page only collects answers. Saving is approved in the conversation.",
        warning: "The agent's question file could not be read; showing the previous questions:",
        failed: "Could not send:",
        confirmEnd: "End this session?",
        recommended: "Recommended",
        evidence: "Evidence",
        source: "Diagram source",
        notRendered: "The diagram could not be drawn",
        all: "All",
        resolvedBox: (n) =>
          `${n} questions resolved from repository sources — answer again if they are wrong`,
        resolvedBy: "Resolved",
        partlyResolvedBy: "Partly resolved from repository sources",
        override: "Answer differently",
        verdicts: {
          stated: "Stated",
          inferred: "Inferred",
          conflicting: "Conflicting",
          unconfirmed: "Unconfirmed",
        },
      };
  const base = location.pathname.replace(/\/$/, "");
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  let mode = localStorage.getItem("ask-mode") === "batch" ? "batch" : "immediate";
  let last = "";
  let state = null;
  const cards = new Map();

  // ---- Mermaid figures: drawn one at a time, cached by source ---------------------------
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  if (window.mermaid)
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
      flowchart: { htmlLabels: false },
      suppressErrorRendering: true,
    });
  const drawn = new Map();
  let queue = Promise.resolve();
  let figureNo = 0;
  const draw = (source) => {
    if (!drawn.has(source)) {
      const job = queue.then(async () => {
        if (!window.mermaid) throw new Error("Mermaid is not available");
        const { svg } = await window.mermaid.render(`ask-diagram-${++figureNo}`, source);
        return svg;
      });
      queue = job.catch(() => {});
      drawn.set(source, job);
    }
    return drawn.get(source);
  };
  function figure(cls) {
    const f = { root: el("figure", `diagram ${cls ?? ""}`), source: null };
    f.view = el("div", "diagram__view");
    f.caption = el("figcaption");
    f.status = el("p", "diagram__status");
    f.code = el("pre");
    f.raw = el("details", "diagram__source");
    f.raw.append(el("summary", null, T.source), f.code);
    f.root.append(f.view, f.caption, f.status, f.raw);
    f.root.hidden = true;
    f.status.hidden = true;
    return f;
  }
  function setFigure(f, diagram) {
    f.root.hidden = !diagram;
    if (!diagram) return;
    f.caption.textContent = diagram.caption ?? "";
    f.caption.hidden = !diagram.caption;
    if (f.source === diagram.source) return;
    f.source = diagram.source;
    f.code.textContent = diagram.source;
    f.root.dataset.rendered = "false";
    f.status.hidden = true;
    draw(diagram.source).then(
      (svg) => {
        if (f.source !== diagram.source) return;
        f.view.innerHTML = svg; // Mermaid output under securityLevel "strict"
        f.root.dataset.rendered = "true";
      },
      (error) => {
        if (f.source !== diagram.source) return;
        f.view.replaceChildren();
        f.status.textContent = `${T.notRendered}: ${error.message || error}`;
        f.status.hidden = false;
        f.raw.open = true;
      },
    );
  }

  const post = async (route, body) => {
    const res = await fetch(`${base}/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? res.status);
    return data;
  };

  // ---- Static frame ---------------------------------------------------------------------
  const head = el("header", "head");
  const title = el("h1");
  const intro = el("p", "intro");
  const note = el("p", "note", T.note);
  const overview = figure("overview");
  head.append(title, intro, note, overview.root);
  const dock = el("div", "dock");
  const status = el("div", "status");
  status.setAttribute("role", "status");
  const progress = el("div", "progress");
  const meter = el("div", "progress__meter");
  const fill = el("span");
  meter.append(fill);
  const progressText = el("span", "progress__text");
  progress.append(meter, progressText);
  const nav = el("nav", "groups");
  const bar = el("div", "bar");
  const modes = el("div", "modes");
  const modeButtons = ["immediate", "batch"].map((m) => {
    const b = el("button", "mode", T[m]);
    b.type = "button";
    b.addEventListener("click", () => {
      mode = m;
      localStorage.setItem("ask-mode", m);
      paint();
    });
    modes.append(b);
    return [m, b];
  });
  const submitAll = el("button", "submit-all");
  submitAll.type = "button";
  submitAll.addEventListener("click", () => act(() => post("deliver")));
  const end = el("button", "end", T.endSession);
  end.type = "button";
  end.addEventListener("click", () => confirm(T.confirmEnd) && act(() => post("close")));
  bar.append(modes, submitAll, end);
  dock.append(status, progress, nav, bar);
  const warn = el("p", "warn");
  const list = el("section", "questions");
  const resolvedBox = el("details", "resolved-box");
  const resolvedSummary = el("summary");
  const resolvedList = el("section", "questions");
  resolvedBox.append(resolvedSummary, resolvedList);
  app.append(head, dock, warn, list, resolvedBox);

  const act = async (fn) => {
    try {
      const next = await fn();
      if (next && next.questions) apply(next);
      else await refresh();
    } catch (error) {
      status.textContent = `${T.failed} ${error.message}`;
    }
  };

  // ---- Question cards -------------------------------------------------------------------
  function card(q) {
    const c = { root: el("article", "card"), sig: "", evSig: "" };
    c.root.id = `q-${q.id}`;
    c.group = el("p", "group");
    c.headline = el("h2");
    c.id = el("span", "qid");
    c.text = el("span", "qtext");
    c.badge = el("span", "badge");
    c.headline.append(c.id, c.text, c.badge);
    c.detail = el("p", "detail");
    c.figure = figure();
    c.evidence = el("details", "evidence");
    c.evidenceSummary = el("summary");
    c.evidenceList = el("ul");
    c.evidence.append(c.evidenceSummary, c.evidenceList);
    c.options = el("div", "options");
    c.input = el("textarea");
    c.input.rows = 2;
    c.input.placeholder = T.textHint;
    c.send = el("button", "send");
    c.send.type = "button";
    c.answer = el("p", "answer");
    c.resolution = el("p", "resolution");
    c.controls = el("div", "controls");
    c.controls.append(c.options, c.input, c.send);
    c.override = el("details", "override");
    c.override.append(el("summary", null, T.override));
    // Free text is saved with its button, together with the chosen option.
    c.send.addEventListener("click", () => {
      const chosen = c.options.querySelector("input:checked");
      save(q.id, chosen ? chosen.value : null, c.input.value, () => (c.input.value = ""));
    });
    c.input.addEventListener("input", () => (c.send.disabled = !c.input.value.trim()));
    c.root.append(
      c.group,
      c.headline,
      c.detail,
      c.resolution,
      c.figure.root,
      c.evidence,
      c.controls,
      c.answer,
    );
    return c;
  }

  /** Save one answer; the screen's mode decides whether it reaches the agent now. */
  const save = (questionId, optionId, text, done) =>
    act(async () => {
      const next = await post("answer", {
        questionId,
        optionId,
        text,
        deliver: mode === "immediate",
      });
      done?.();
      return next;
    });

  const markChosen = (c) => {
    for (const l of c.options.children)
      l.classList.toggle("is-chosen", l.querySelector("input").checked);
  };

  function optionCard(q, o, c) {
    const label = el("label", "option");
    const input = el("input");
    input.type = "radio";
    input.name = `opt-${q.id}`;
    input.value = o.id;
    // Choosing an option saves it at once, keeping the note already saved for the question.
    input.addEventListener("change", () => {
      markChosen(c);
      const saved = state.questions.find((x) => x.id === q.id)?.answer;
      save(q.id, o.id, saved?.text ?? "");
    });
    const top = el("span", "option__head");
    top.append(input, el("strong", null, o.label));
    if (o.recommended) top.append(el("em", "tag", T.recommended));
    label.append(top);
    if (o.description) label.append(el("small", null, o.description));
    const f = figure("option__diagram");
    setFigure(f, o.diagram);
    label.append(f.root);
    return label;
  }

  function update(c, q) {
    c.group.textContent = q.group ?? "";
    c.group.hidden = !q.group;
    c.id.textContent = q.id;
    c.text.textContent = q.text;
    c.detail.textContent = q.detail ?? "";
    c.detail.hidden = !q.detail;
    setFigure(c.figure, q.diagram);
    c.resolution.textContent = q.resolved
      ? `${q.resolved.partial ? T.partlyResolvedBy : T.resolvedBy}: ${q.resolved.summary}`
      : "";
    c.resolution.hidden = !q.resolved;
    c.root.classList.toggle("is-resolved", settled(q));
    if (settled(q) && c.controls.parentNode !== c.override) {
      c.root.insertBefore(c.override, c.answer);
      c.override.append(c.controls);
    } else if (!settled(q) && c.controls.parentNode === c.override) {
      c.root.insertBefore(c.controls, c.answer);
      c.override.remove();
    }
    const evSig = JSON.stringify(q.evidence ?? []);
    if (evSig !== c.evSig) {
      c.evSig = evSig;
      const ev = q.evidence ?? [];
      c.evidence.hidden = !ev.length;
      c.evidenceSummary.textContent = `${T.evidence} ${ev.length}`;
      c.evidenceList.replaceChildren(
        ...ev.map((e) => {
          const li = el("li");
          if (e.verdict)
            li.append(el("span", `verdict verdict--${e.verdict}`, T.verdicts[e.verdict]));
          li.append(el("code", null, e.source));
          if (e.detail) li.append(el("span", "evidence__detail", e.detail));
          return li;
        }),
      );
      c.evidence.open =
        !settled(q) && ev.length <= 4 && ev.some((e) => e.verdict === "conflicting");
    }
    const sig = JSON.stringify(q.options ?? []);
    if (sig !== c.sig) {
      c.sig = sig;
      c.options.replaceChildren(...(q.options ?? []).map((o) => optionCard(q, o, c)));
      c.options.classList.toggle(
        "options--visual",
        (q.options ?? []).some((o) => o.diagram),
      );
    }
    // Show the saved answer's option as chosen unless the user is choosing another one.
    if (q.answer?.optionId && !c.options.querySelector("input:checked")) {
      const saved = c.options.querySelector(`input[value="${CSS.escape(q.answer.optionId)}"]`);
      if (saved) saved.checked = true;
    }
    markChosen(c);
    c.input.hidden = q.allowText === false;
    const closed = Boolean(q.closed) || state.closed;
    c.root.classList.toggle("closed", closed);
    c.root.classList.toggle("is-answered", Boolean(q.answer));
    for (const n of c.root.querySelectorAll("input, textarea, button")) n.disabled = closed;
    c.send.disabled = closed || !c.input.value.trim();
    c.send.textContent = mode === "immediate" ? T.send : T.save;
    c.badge.textContent = q.answer ? (q.pending ? T.pending : "✓") : "";
    c.badge.className = `badge${q.answer ? (q.pending ? " is-pending" : " is-sent") : ""}`;
    if (q.answer) {
      const tag = q.answer.channel === "chat" ? T.chat : q.pending ? T.pending : T.sent;
      const what = [q.answer.optionLabel, q.answer.text].filter(Boolean).join(" — ");
      c.answer.textContent = `${T.answered} (${tag}): ${what}`;
      c.answer.className = `answer ${q.pending ? "is-pending" : "is-sent"}`;
    } else {
      c.answer.textContent = q.closed ? T.closedQ : "";
      c.answer.className = "answer";
    }
  }

  // A partly resolved question stays among the asked ones; only its settled part is shown.
  function settled(q) {
    return Boolean(q.resolved && !q.resolved.partial);
  }

  function paintNav() {
    const groups = new Map();
    for (const q of state.questions.filter((x) => !settled(x))) {
      const name = q.group ?? T.all;
      const g = groups.get(name) ?? { first: q.id, total: 0, done: 0 };
      g.total++;
      if (q.answer || q.closed) g.done++;
      groups.set(name, g);
    }
    nav.replaceChildren(
      ...[...groups].map(([name, g]) => {
        const b = el(
          "button",
          `chip${g.done === g.total ? " is-done" : ""}`,
          `${name} ${g.done}/${g.total}`,
        );
        b.type = "button";
        b.addEventListener("click", () =>
          document
            .getElementById(`q-${g.first}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
        return b;
      }),
    );
  }

  function paint() {
    if (!state) return;
    document.title = state.title || document.title;
    title.textContent = state.title;
    intro.textContent = state.intro;
    intro.hidden = !state.intro;
    setFigure(overview, state.diagram);
    status.textContent = state.closed
      ? T.ended
      : state.working
        ? T.working
        : state.agent?.message || T.idle;
    status.className = `status${state.working ? " is-working" : ""}${state.closed ? " is-closed" : ""}`;
    warn.textContent = state.warning ? `${T.warning} ${state.warning}` : "";
    warn.hidden = !state.warning;
    const open = state.questions.filter((q) => !settled(q));
    const resolved = state.questions.filter(settled);
    const total = open.length;
    const answered = open.filter((q) => q.answer || q.closed).length;
    const pending = state.questions.filter((q) => q.pending).length;
    fill.style.width = `${total ? (100 * answered) / total : 100}%`;
    progressText.textContent = T.progress(answered, total, pending, resolved.length);
    resolvedBox.hidden = !resolved.length;
    resolvedSummary.textContent = T.resolvedBox(resolved.length);
    paintNav();
    for (const [m, b] of modeButtons) b.setAttribute("aria-pressed", String(m === mode));
    submitAll.textContent = T.submitAll(pending);
    submitAll.hidden = mode !== "batch" && pending === 0;
    submitAll.disabled = pending === 0 || state.closed;
    end.disabled = state.closed;
    const ids = new Set(state.questions.map((q) => q.id));
    for (const [id, c] of cards) if (!ids.has(id)) (c.root.remove(), cards.delete(id));
    const place = (items, into) =>
      items.forEach((q, i) => {
        if (!cards.has(q.id)) cards.set(q.id, card(q));
        const c = cards.get(q.id);
        update(c, q);
        if (into.children[i] !== c.root) into.insertBefore(c.root, into.children[i] ?? null);
      });
    place(open, list);
    place(resolved, resolvedList);
  }

  function apply(next) {
    const sig = JSON.stringify(next);
    if (sig === last) return;
    last = sig;
    state = next;
    paint();
  }

  async function refresh() {
    try {
      const res = await fetch(`${base}/api/state`, { cache: "no-store" });
      if (res.ok) apply(await res.json());
    } catch {
      /* the server stopped; keep the last view */
    }
  }
  refresh();
  setInterval(() => !state?.closed && refresh(), 1000);
})();
