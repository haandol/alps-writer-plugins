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
        send: "답변 보내기",
        save: "답변 저장",
        submitAll: (n) => `모은 답 ${n}개 보내기`,
        progress: (a, t, p, r) =>
          `답한 질문 ${a}/${t}${p ? ` · 보내기 전 ${p}` : ""}${r ? ` · 내부 해소 ${r}` : ""}`,
        working: "에이전트가 답을 반영하는 중입니다…",
        idle: "답을 기다리는 중입니다.",
        answered: "저장된 답",
        draft: "작성 중인 답 · 아직 저장하지 않았습니다.",
        submitting: "이 답을 저장하는 중입니다…",
        pending: "보내기 전",
        sent: "전달됨",
        chat: "대화에서 답함",
        closedQ: "닫힌 질문",
        textHint: "직접 답하기 — 입력하면 선택지 대신 이 답을 보냅니다",
        endSession: "세션 끝내기",
        ended: "세션이 끝났습니다. 남은 질문은 대화에서 답할 수 있습니다.",
        note: "후보 답변과 모델 질의응답을 구분해 모읍니다. 모델 저장 승인은 주 대화에서 합니다.",
        discussion: "모델에 대해 질문하기",
        askAbout: "이 질문에 관해 물어보기",
        wholeModel: "모델 전체",
        context: "질문할 범위",
        discussionHint: "이 업무 경계를 나눈 이유처럼 궁금한 점을 물어보세요.",
        discussionNote: "여기서 나눈 설명은 후보 답변이나 저장 승인으로 처리되지 않습니다.",
        ask: "질문 보내기",
        retry: "같은 질문 다시 보내기",
        questionSending: "질문 전송을 확인하는 중입니다…",
        questionFailed: "전송을 확인하지 못했습니다. 입력을 유지했습니다.",
        earlierQuestionFailed:
          "이전 질문의 전송을 확인하지 못했습니다. 새로 작성한 내용은 유지했습니다.",
        agentReady: "작성 에이전트가 질문을 기다리고 있습니다.",
        agentAway: "작성 에이전트 연결 대기 중입니다.",
        handoff: "자동으로 이어지지 않으면 주 대화에서 질문을 보냈다고 알려 주세요.",
        waitingReply: "에이전트에게 전달됨 · 답변 대기",
        waitingDelivery: "에이전트 전달 대기",
        you: "내 질문",
        agentReply: "작성 에이전트",
        missingContext: "현재 목록에서 빠진 질문 — 범위를 다시 선택해 주세요",
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
        send: "Send answer",
        save: "Save answer",
        submitAll: (n) => `Send ${n} collected answers`,
        progress: (a, t, p, r) =>
          `Answered ${a}/${t}${p ? ` · ${p} not sent` : ""}${r ? ` · ${r} resolved` : ""}`,
        working: "The agent is applying your answers…",
        idle: "Waiting for your answers.",
        answered: "Saved answer",
        draft: "Editing an answer · not saved yet.",
        submitting: "Saving this answer…",
        pending: "Not sent",
        sent: "Delivered",
        chat: "Answered in chat",
        closedQ: "Closed",
        textHint: "Write an answer — typing replaces the selected option",
        endSession: "End session",
        ended: "The session has ended. Remaining questions can be answered in the conversation.",
        note: "Candidate answers and model discussion stay separate. Model saving is approved in the main conversation.",
        discussion: "Ask about the model",
        askAbout: "Ask about this question",
        wholeModel: "Whole model",
        context: "Question context",
        discussionHint: "Ask what a boundary means or why the model is organized this way.",
        discussionNote: "Discussion does not submit candidate answers or approve model changes.",
        ask: "Send question",
        retry: "Retry this question",
        questionSending: "Confirming question delivery…",
        questionFailed: "Delivery could not be confirmed. Your input is preserved.",
        earlierQuestionFailed:
          "The earlier question's delivery could not be confirmed. Your newer draft is preserved.",
        agentReady: "The authoring agent is waiting for questions.",
        agentAway: "Waiting for the authoring agent to connect.",
        handoff:
          "If the conversation does not continue automatically, tell the agent in the main conversation that you sent a question.",
        waitingReply: "Delivered to the agent · awaiting reply",
        waitingDelivery: "Waiting for agent delivery",
        you: "Your question",
        agentReply: "Authoring agent",
        missingContext: "This question is no longer listed — choose its context again",
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
  const showDiscussion = el("button", "show-discussion", T.discussion);
  showDiscussion.type = "button";
  bar.append(modes, submitAll, showDiscussion, end);
  dock.append(status, progress, nav, bar);
  const warn = el("p", "warn");
  const list = el("section", "questions");
  const resolvedBox = el("details", "resolved-box");
  const resolvedSummary = el("summary");
  const resolvedList = el("section", "questions");
  resolvedBox.append(resolvedSummary, resolvedList);
  const answersWorkspace = el("div", "answers-workspace");
  answersWorkspace.append(dock, warn, list, resolvedBox);
  const layout = el("div", "review-layout");
  const discussion = el("aside", "discussion");
  discussion.id = "model-discussion";
  const discussionTitle = el("h2", null, T.discussion);
  discussionTitle.id = "discussion-title";
  discussion.setAttribute("aria-labelledby", discussionTitle.id);
  const discussionStatus = el("p", "discussion-status");
  discussionStatus.setAttribute("role", "status");
  const discussionHandoff = el("p", "discussion-handoff", T.handoff);
  const discussionLog = el("div", "discussion-log");
  discussionLog.setAttribute("role", "log");
  discussionLog.setAttribute("aria-live", "polite");
  const contextLabel = el("label", "discussion-context-label", T.context);
  const discussionContext = el("select", "discussion-context");
  discussionContext.id = "discussion-context";
  contextLabel.htmlFor = discussionContext.id;
  const discussionInput = el("textarea", "discussion-input");
  discussionInput.id = "discussion-input";
  discussionInput.rows = 4;
  discussionInput.placeholder = T.discussionHint;
  discussionInput.setAttribute("aria-label", T.discussionHint);
  const discussionSend = el("button", "discussion-send", T.ask);
  discussionSend.type = "button";
  const discussionFailure = el("p", "discussion-error");
  discussionFailure.setAttribute("role", "alert");
  discussionFailure.hidden = true;
  discussion.append(
    discussionTitle,
    el("p", "note", T.discussionNote),
    discussionStatus,
    discussionHandoff,
    discussionLog,
    contextLabel,
    discussionContext,
    discussionInput,
    discussionSend,
    discussionFailure,
  );
  layout.append(answersWorkspace, discussion);
  app.append(head, layout);
  const discussionDraft = {
    revision: 0,
    sending: false,
    retry: false,
    fingerprint: null,
    messageId: null,
  };
  const discussionThreads = new Map();
  const focusDiscussion = (questionId) => {
    if (questionId !== undefined && discussionContext.value !== questionId) {
      discussionContext.value = questionId;
      discussionDraft.revision++;
      discussionDraft.retry = false;
      discussionFailure.hidden = true;
      paintDiscussion();
    }
    discussion.scrollIntoView({ block: "nearest" });
    discussionInput.focus();
  };
  showDiscussion.addEventListener("click", () => focusDiscussion());
  for (const input of [discussionInput, discussionContext]) {
    input.addEventListener(input === discussionInput ? "input" : "change", () => {
      discussionDraft.revision++;
      discussionDraft.retry = false;
      discussionFailure.hidden = true;
      paintDiscussion();
    });
  }
  discussionSend.addEventListener("click", () => sendDiscussion());
  discussionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      if (!discussionSend.disabled) sendDiscussion();
    }
  });

  const act = async (fn) => {
    try {
      const next = await fn();
      if (next && next.questions) apply(next);
      else await refresh();
    } catch (error) {
      status.textContent = `${T.failed} ${error.message}`;
    }
  };

  /** Retries reuse the submitted message, while newer typing keeps its own draft. */
  async function sendDiscussion() {
    if (discussionDraft.sending || discussionSend.disabled) return;
    const text = discussionInput.value;
    const questionId = discussionContext.value || null;
    const fingerprint = JSON.stringify([text.trim(), questionId]);
    if (fingerprint !== discussionDraft.fingerprint) {
      discussionDraft.messageId = crypto.randomUUID();
      discussionDraft.fingerprint = fingerprint;
    }
    const messageId = discussionDraft.messageId;
    const revision = discussionDraft.revision;
    discussionDraft.sending = true;
    discussionFailure.hidden = true;
    paintDiscussion();
    try {
      const next = await post("discussion", { messageId, text, questionId });
      if (revision === discussionDraft.revision) discussionInput.value = "";
      discussionDraft.fingerprint = null;
      discussionDraft.messageId = null;
      discussionDraft.retry = false;
      apply(next);
    } catch (error) {
      discussionDraft.retry = revision === discussionDraft.revision;
      discussionFailure.textContent = `${discussionDraft.retry ? T.questionFailed : T.earlierQuestionFailed} ${error.message}`;
      discussionFailure.hidden = false;
    } finally {
      discussionDraft.sending = false;
      paintDiscussion();
    }
  }

  function paintDiscussion() {
    if (!state) return;
    const currentContext = discussionContext.value;
    const contexts = [
      ["", T.wholeModel],
      ...state.questions.map((q) => [q.id, `${q.id} · ${q.text}`]),
    ];
    const missing = currentContext && !contexts.some(([id]) => id === currentContext);
    if (missing) contexts.push([currentContext, T.missingContext]);
    const contextSig = JSON.stringify(contexts);
    if (discussionContext.dataset.options !== contextSig) {
      discussionContext.dataset.options = contextSig;
      discussionContext.replaceChildren(
        ...contexts.map(([value, label]) => {
          const option = el("option", null, label);
          option.value = value;
          return option;
        }),
      );
      discussionContext.value = currentContext;
    }
    const available = Boolean(state.discussion?.available);
    const messages = state.discussion?.messages ?? [];
    const awaitingReply = messages.some((message) => message.delivered && !message.reply);
    discussionStatus.textContent = state.closed
      ? T.ended
      : discussionDraft.sending
        ? T.questionSending
        : available
          ? T.agentReady
          : awaitingReply
            ? T.waitingReply
            : T.agentAway;
    discussionStatus.dataset.agentAvailable = String(available);
    discussionHandoff.hidden = available || state.closed;
    discussionSend.disabled = Boolean(
      state.closed || missing || discussionDraft.sending || !discussionInput.value.trim(),
    );
    discussionSend.textContent = discussionDraft.retry ? T.retry : T.ask;
    discussionInput.disabled = discussionContext.disabled = Boolean(state.closed);
    for (const message of messages) {
      let thread = discussionThreads.get(message.messageId);
      if (!thread) {
        thread = el("article", "discussion-thread");
        thread.dataset.messageId = message.messageId;
        discussionThreads.set(message.messageId, thread);
        discussionLog.append(thread);
      }
      const sig = JSON.stringify(message);
      if (thread.dataset.message === sig) continue;
      thread.dataset.message = sig;
      thread.replaceChildren(el("h3", null, T.you));
      if (message.context)
        thread.append(
          el(
            "p",
            "discussion-context-caption",
            `${message.context.questionId} · ${message.context.text}`,
          ),
        );
      thread.append(el("p", "discussion-question-text", message.text));
      if (message.reply) {
        const reply = el("div", "discussion-reply");
        reply.append(
          el("h3", null, T.agentReply),
          el("p", "discussion-reply-text", message.reply.text),
        );
        thread.append(reply);
      } else
        thread.append(
          el("p", "discussion-wait", message.delivered ? T.waitingReply : T.waitingDelivery),
        );
    }
  }

  // ---- Question cards -------------------------------------------------------------------
  function card(q) {
    const c = {
      root: el("article", "card"),
      sig: "",
      evSig: "",
      editing: false,
      mode: null,
      optionId: null,
      revision: 0,
      sending: null,
      queue: Promise.resolve(),
    };
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
    c.draft = el("p", "answer-draft");
    c.draft.hidden = true;
    c.input.setAttribute("aria-label", T.textHint);
    c.resolution = el("p", "resolution");
    c.controls = el("div", "controls");
    c.controls.append(c.options, c.input, c.send);
    c.override = el("details", "override");
    c.override.append(el("summary", null, T.override));
    // Free text replaces the option; a pending older save cannot own this draft.
    c.send.addEventListener("click", () => {
      if (c.input.value.trim() && c.sending !== c.revision) save(c, q.id, null, c.input.value);
    });
    c.input.addEventListener("input", () => {
      c.revision++;
      c.editing = true;
      c.mode = "text";
      c.optionId = null;
      for (const input of c.options.querySelectorAll("input")) input.checked = false;
      markChosen(c);
      const current = state.questions.find((item) => item.id === q.id);
      if (current) update(c, current);
    });
    c.controls.append(c.draft);
    c.ask = el("button", "ask-about-question", T.askAbout);
    c.ask.type = "button";
    c.ask.addEventListener("click", () => focusDiscussion(q.id));
    c.root.append(
      c.group,
      c.headline,
      c.detail,
      c.resolution,
      c.figure.root,
      c.evidence,
      c.controls,
      c.answer,
      c.ask,
    );
    return c;
  }

  /** Save one answer; the screen's mode decides whether it reaches the agent now. */
  const save = (c, questionId, optionId, text) => {
    const revision = c.revision;
    const deliver = mode === "immediate";
    c.sending = revision;
    update(
      c,
      state.questions.find((item) => item.id === questionId),
    );
    // Serialize this card's writes so a delayed option cannot follow its replacement.
    c.queue = c.queue
      .then(() =>
        act(async () => {
          const next = await post("answer", { questionId, optionId, text, deliver });
          if (c.revision === revision) {
            c.editing = false;
            c.input.value = "";
          }
          return next;
        }),
      )
      .finally(() => {
        if (c.sending === revision) c.sending = null;
        const current = state.questions.find((item) => item.id === questionId);
        if (current) update(c, current);
      });
    return c.queue;
  };

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
    // An option is a complete answer, not an addition to a previous text answer.
    input.addEventListener("change", () => {
      c.revision++;
      c.editing = true;
      c.mode = "option";
      c.optionId = o.id;
      c.input.value = "";
      markChosen(c);
      save(c, q.id, o.id, "");
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
    const selected = c.editing ? (c.mode === "option" ? c.optionId : null) : q.answer?.optionId;
    for (const input of c.options.querySelectorAll("input"))
      input.checked = input.value === selected;
    markChosen(c);
    c.input.hidden = q.allowText === false;
    const closed = Boolean(q.closed) || state.closed;
    c.root.classList.toggle("closed", closed);
    c.root.classList.toggle("is-answered", Boolean(q.answer));
    for (const n of c.root.querySelectorAll("input, textarea, button")) n.disabled = closed;
    c.send.disabled = closed || !c.input.value.trim() || c.sending === c.revision;
    c.draft.hidden = !c.editing;
    c.draft.textContent = c.sending === c.revision ? T.submitting : T.draft;
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
    paintDiscussion();
  }

  function apply(next) {
    if (
      state &&
      (next.sequence < state.sequence ||
        (next.sequence === state.sequence && next.questionRevision < state.questionRevision))
    )
      return;
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
