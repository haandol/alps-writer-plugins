// Navigate authored knowledge in the current document. State is page-local;
// neither browsing nor opening the whole-model tools writes to the repository.
(() => {
  "use strict";
  const source = document.getElementById("knowledge-data");
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const T = data.text;
  const contexts = new Map(data.contexts.map((c) => [c.id, c]));
  const contextPositions = new Map(data.contexts.map((c, i) => [c.id, i]));
  const elements = new Map(Object.entries(data.elements));
  const scopes = new Map(Object.entries(data.scopes));
  const types = new Map(data.types);
  const byTarget = new Map();
  for (const [key, e] of elements) {
    byTarget.set(e.h, key);
    if (e.t === "Process") byTarget.set(e.h.replace(/^process-/, ""), key);
  }
  const $ = (id) => document.getElementById(id);
  const whole = $("whole-workspace");
  const workspace = $("knowledge-workspace");
  const home = $("kw-home-panel");
  const bcPanel = $("kw-bc-panel");
  const search = $("kw-search");
  const type = $("kw-type");
  const results = $("kw-results");
  const detail = $("kw-detail");
  const scrollHost = () =>
    document.body.dataset.knowledgePresentation === "space" ? bcPanel : workspace;
  const detailScrollHost = () =>
    document.body.dataset.knowledgePresentation === "space" ? bcPanel : detail;
  const PAGE = 20;
  const searchable = [...elements].map(([key, e]) => ({
    key,
    unit: prepareSearchUnit(
      e.searchUnit ?? {
        id: key,
        identifier: key,
        title: e.n,
        fields: e.search.map((value) => ({ name: "text", value })),
      },
    ),
  }));
  const keyByUnit = new Map(searchable.map(({ key, unit }) => [unit.id, key]));
  function findMatches(query) {
    try {
      const terms = parseSearchQuery(query);
      const hits = rankSearchUnits(
        searchable.map(({ unit }) => unit),
        terms,
      );
      return { hits: new Map(hits.map((hit) => [keyByUnit.get(hit.id), hit])), error: null };
    } catch (error) {
      if (!(error instanceof SearchInputError)) throw error;
      return {
        hits: new Map(),
        error: T.invalidSearch ?? "Check the search text and its quotation marks.",
      };
    }
  }
  const states = new Map();
  const rootMatches = new Map();
  const order = [
    "Process",
    "Step",
    "BusinessEvent",
    "Policy",
    "BusinessConcept",
    "BusinessRule",
    "Actor",
    "ObservationCriterion",
  ];
  let active = null,
    selected = null,
    level = data.initialView === "events" ? "all" : "contexts";
  let lastKnowledge = "#contexts",
    lastWhole = "#all",
    diagramSerial = 0;
  const state = (id) => {
    if (!states.has(id))
      states.set(id, {
        search: "",
        type: "",
        page: 0,
        scroll: 0,
        mainScroll: 0,
        detailScroll: 0,
        element: null,
      });
    return states.get(id);
  };
  const node = (tag, text, className) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (className) e.className = className;
    return e;
  };
  function routeFor(id, key = null) {
    const params = new URLSearchParams({ bc: id });
    if (key) params.set("element", key);
    return `#${params}`;
  }
  function navigate(hash) {
    if (location.hash === hash) renderRoute(true);
    else location.hash = hash;
  }
  function openContext(id) {
    if (!contexts.has(id)) return;
    if (level === "contexts" && rootMatches.get(id) === "internal") {
      state(id).search = $("kw-context-search").value.trim();
      state(id).page = 0;
    }
    navigate(routeFor(id));
  }
  const space = window.createOntologyKnowledgeSpace?.({
    data,
    contexts,
    elements,
    openContext,
    openElement,
  });
  function contextButton(id) {
    const button = node("button", contexts.get(id)?.name ?? id);
    button.type = "button";
    button.dataset.knowledgeContext = id;
    button.title = id;
    return button;
  }
  function showLevel(next) {
    level = next;
    document.body.dataset.knowledgeLevel = next;
    whole.hidden = next !== "all";
    whole.setAttribute("role", next === "all" ? "main" : "region");
    workspace.hidden = next === "all";
    home.hidden = next !== "contexts";
    bcPanel.hidden = next !== "bc";
    $("kw-up").hidden = next === "contexts";
    $("kw-show-whole").hidden = next === "all";
    space?.setVisible(next !== "all");
    document.dispatchEvent(new Event("ontology-view-change"));
  }
  function showWhole(target = "") {
    showLevel("all");
    $("kw-crumb").textContent = T.whole;
    window.ontologyInitializeLegacy?.();
    if (target && target !== "all" && target !== "start") {
      if (/^(?:el-|process-)/.test(target) || ["landscape", "elements"].includes(target))
        $("view-structure-tab")?.click();
      const element = $(target);
      if (element && whole.contains(element)) {
        element.scrollIntoView({ block: "start" });
        element.focus?.({ preventScroll: true });
      }
    }
    document.dispatchEvent(new Event("ontology-view-change"));
  }
  function openElement(key) {
    const e = elements.get(key);
    if (!e) return;
    if (e.t === "BoundedContext") return openContext(key);
    const owners = e.contexts.filter((id) => contexts.has(id));
    const next = owners.includes(active) ? active : owners.length === 1 ? owners[0] : active;
    if (next) navigate(routeFor(next, key));
    else navigate(`#${e.h}`);
  }
  function rootSearch() {
    const term = $("kw-context-search").value.trim();
    const { hits, error } = findMatches(term);
    rootMatches.clear();
    for (const c of data.contexts) {
      const own = hits.has(c.id);
      const internal = !own && scopes.get(c.id).members.some((key) => hits.has(key));
      if (!error && (!term || own || internal))
        rootMatches.set(c.id, internal ? "internal" : "context");
    }
    const scores = new Map();
    const scoreOf = (id) => {
      if (!scores.has(id))
        scores.set(
          id,
          [id, ...scopes.get(id).members]
            .map((key) => hits.get(key))
            .filter(Boolean)
            .sort(compareSearchHits)[0],
        );
      return scores.get(id);
    };
    const cards = [...home.querySelectorAll("[data-knowledge-card]")];
    cards.sort(
      (a, b) =>
        (term && !error
          ? compareSearchHits(scoreOf(a.dataset.knowledgeCard), scoreOf(b.dataset.knowledgeCard))
          : 0) ||
        contextPositions.get(a.dataset.knowledgeCard) -
          contextPositions.get(b.dataset.knowledgeCard),
    );
    for (const card of cards) {
      card.hidden = !rootMatches.has(card.dataset.knowledgeCard);
      $("kw-contexts").append(card);
    }
    $("kw-context-status").textContent =
      error ?? (term ? `${rootMatches.size} / ${contexts.size} BC` : "");
    space?.show({ level: "contexts", matches: [...rootMatches.keys()] });
  }
  function renderList() {
    const s = state(active),
      term = s.search.trim();
    const { hits, error } = findMatches(term);
    const ids = scopes
      .get(active)
      .members.filter((key) => {
        const e = elements.get(key);
        return e && (!s.type || e.t === s.type) && !error && (!term || hits.has(key));
      })
      .sort((a, b) => {
        if (term) {
          const relevance = compareSearchHits(hits.get(a), hits.get(b));
          if (relevance) return relevance;
        }
        const x = elements.get(a),
          y = elements.get(b);
        const typeOrder = order.indexOf(x.t) - order.indexOf(y.t);
        if (typeOrder) return typeOrder;
        if (x.t === "Step" && x.process && y.process) {
          const processOrder =
            (elements.get(x.process)?.n ?? x.process).localeCompare(
              elements.get(y.process)?.n ?? y.process,
            ) || x.process.localeCompare(y.process);
          if (processOrder) return processOrder;
          if (Number.isFinite(x.order) && Number.isFinite(y.order) && x.order !== y.order)
            return x.order - y.order;
        }
        return x.n.localeCompare(y.n) || a.localeCompare(b);
      });
    const pages = Math.ceil(ids.length / PAGE);
    s.page = Math.max(0, Math.min(s.page, pages - 1));
    const start = s.page * PAGE;
    results.replaceChildren();
    for (const key of ids.slice(start, start + PAGE)) {
      const e = elements.get(key),
        item = node("li"),
        button = node("button");
      button.type = "button";
      button.dataset.knowledgeElement = key;
      button.className = "kw-result";
      if (key === selected) button.setAttribute("aria-current", "true");
      const line = node("span", undefined, "kw-result-top");
      line.append(node("span", types.get(e.t) ?? e.t, "kw-type"), node("strong", e.n));
      button.append(line, node("code", key));
      if (term && hits.has(key)) {
        const fields = [
          ...new Set(
            hits
              .get(key)
              .matches.map((match) => data.searchFieldLabels?.[match.field] ?? match.field),
          ),
        ];
        button.append(
          node(
            "span",
            (T.matchedFields ?? "Matched fields") + ": " + fields.join(", "),
            "kw-result-marks",
          ),
        );
      }
      const marks = node("span", undefined, "kw-result-marks");
      if (e.m & 4) marks.append(node("span", T.modelIssues, "kw-warning"));
      if (e.m & 2) marks.append(node("span", T.changed, "kw-warning"));
      if (e.m & 16) marks.append(node("span", T.unknown, "kw-warning"));
      if (e.contexts.length > 1)
        marks.append(
          node("span", e.shared ? T.shared : T.unknownOwner, e.shared ? "kw-shared" : "kw-warning"),
        );
      if (e.st) marks.append(node("span", e.st, "kw-state"));
      if (e.s) marks.append(node("span", data.stateLabels[e.s] ?? e.s, `kw-state kw-state-${e.s}`));
      if (e.process)
        marks.append(node("span", elements.get(e.process)?.n ?? e.process, "kw-state"));
      if (marks.childNodes.length) button.append(marks);
      item.append(button);
      results.append(item);
    }
    if (!ids.length)
      results.append(
        node(
          "li",
          error ?? (!scopes.get(active).members.length ? T.emptyScope : T.noMatches),
          "kw-empty",
        ),
      );
    $("kw-list-status").textContent =
      error ??
      `${ids.length} ${T.internal} · ${ids.length ? start + 1 : 0}–${Math.min(start + PAGE, ids.length)}`;
    $("kw-page").textContent = `${pages ? s.page + 1 : 0} / ${pages}`;
    $("kw-prev").disabled = s.page === 0;
    $("kw-next").disabled = s.page + 1 >= pages;
    space?.show({
      level: "bc",
      id: active,
      keys: ids.slice(start, start + PAGE),
      selected,
    });
  }
  function emptyDetail() {
    detail.replaceChildren();
    const blank = node("div", undefined, "kw-empty");
    blank.append(node("h3", T.choose), node("p", T.chooseHint));
    detail.append(blank);
    $("kw-close-detail").hidden = true;
    $("kw-detail-context").replaceChildren();
    bcPanel.dataset.detail = "false";
  }
  function renderDetail(key, focus) {
    const e = elements.get(key);
    if (!e) return emptyDetail();
    const original = $(e.t === "Process" ? e.h.replace(/^process-/, "") : e.h);
    if (!original || !whole.contains(original)) return emptyDetail();
    detail.replaceChildren();
    const article = original.cloneNode(true);
    for (const child of [article, ...article.querySelectorAll("[id]")]) child.removeAttribute("id");
    for (const a of e.adrs) {
      if (!a.url) continue;
      for (const code of article.querySelectorAll("code")) {
        if (code.textContent !== a.path) continue;
        const link = node("a");
        link.href = a.url;
        link.target = "_blank";
        link.rel = "noopener";
        code.replaceWith(link);
        link.append(code);
      }
    }
    detail.append(article);
    const owner = $("kw-detail-context");
    owner.replaceChildren();
    if (!e.contexts.length) owner.append(node("span", T.unknownOwner));
    else {
      if (e.contexts.length > 1) owner.append(node("span", e.shared ? T.shared : T.unknownOwner));
      else if (!e.contexts.includes(active)) owner.append(node("span", T.external));
      for (const id of e.contexts) if (contexts.has(id)) owner.append(contextButton(id));
    }
    if (e.t === "Process") {
      const flow = $(e.h)?.cloneNode(true);
      if (flow) {
        flow.removeAttribute("id");
        for (const old of flow.querySelectorAll(".diagram-zoom")) old.remove();
        for (const figure of flow.querySelectorAll("figure[data-mermaid]")) {
          figure.classList.remove("zoomable", "expanded");
          figure.dataset.mermaid = `knowledge-${++diagramSerial}`;
          figure.dataset.renderState = "pending";
          figure.dataset.rendered = "false";
          figure.querySelector(".diagram__viewport").replaceChildren();
          figure.querySelector(".diagram-status").hidden = false;
          const targets = JSON.parse(figure.dataset.targets ?? "{}");
          const draw = () => window.reportDiagramRender?.(figure);
          if (Object.keys(targets).length > 60) {
            const button = node("button", T.draw, "kw-draw");
            button.type = "button";
            button.addEventListener("click", () => {
              button.disabled = true;
              button.textContent = T.drawing;
              draw()?.then(() => button.remove());
            });
            figure.prepend(button);
          } else requestAnimationFrame(draw);
        }
        detail.append(flow);
      }
    }
    $("kw-close-detail").hidden = false;
    bcPanel.dataset.detail = "true";
    if (focus) {
      const heading = detail.querySelector("h3");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
      detail.scrollTop = 0;
    }
  }
  function renderBC(id, key, focus) {
    active = id;
    selected = elements.has(key) ? key : null;
    const c = contexts.get(id),
      s = state(id);
    showLevel("bc");
    $("kw-crumb").textContent = c.name;
    $("kw-bc-id").textContent = id;
    $("kw-bc-title").textContent = c.name;
    $("kw-bc-definition").textContent = c.definition ?? T.missingDefinition;
    $("kw-bc-core").textContent = c.coreLogic ?? T.missing;
    search.value = s.search;
    type.value = s.type;
    const notice = $("kw-bc-notice");
    const flags = [
      !c.complete ? T.incomplete : "",
      data.errors.length ? `${T.modelIssues}: ${data.errors.length}` : "",
      data.changeSummary?.changed ? T.changed : "",
      data.changeSummary?.unverified ? T.unknown : "",
    ].filter(Boolean);
    notice.hidden = !flags.length;
    notice.textContent = flags.join(" · ");
    const neighbors = $("kw-neighbors");
    neighbors.replaceChildren();
    for (const neighbor of scopes.get(id).neighbors)
      if (contexts.has(neighbor)) neighbors.append(contextButton(neighbor));
    if (!neighbors.childNodes.length) neighbors.append(node("span", T.noCollaboration, "kw-muted"));
    renderList();
    results.scrollTop = s.scroll;
    if (s.element !== selected) s.detailScroll = 0;
    s.element = selected;
    if (selected) renderDetail(selected, focus);
    else {
      emptyDetail();
      if (focus) $("kw-bc-title").focus({ preventScroll: true });
    }
    scrollHost().scrollTop =
      selected && matchMedia("(max-width: 700px)").matches ? 0 : s.mainScroll;
    if (selected) detailScrollHost().scrollTop = s.detailScroll;
    lastKnowledge = routeFor(id, selected);
  }
  function renderRoute(focus = false) {
    if (level === "bc" && active) {
      const previous = state(active);
      if (results.getClientRects().length) {
        previous.scroll = results.scrollTop;
        previous.mainScroll = scrollHost().scrollTop;
      }
      if (detail.getClientRects().length) previous.detailScroll = detailScrollHost().scrollTop;
    }
    const fragment = location.hash.slice(1),
      params = new URLSearchParams(fragment);
    if (params.has("bc") && contexts.has(params.get("bc")))
      return renderBC(params.get("bc"), params.get("element"), focus);
    if (
      fragment === "all" ||
      byTarget.has(fragment) ||
      (fragment && whole.contains($(fragment))) ||
      (level === "all" && fragment !== "contexts" && !params.has("bc")) ||
      (!fragment && data.initialView === "events")
    ) {
      lastWhole = fragment && fragment !== "start" ? `#${fragment}` : lastWhole;
      return showWhole(fragment);
    }
    active = null;
    selected = null;
    showLevel("contexts");
    $("kw-crumb").textContent = "";
    rootSearch();
    if (focus) $("kw-home-title").focus({ preventScroll: true });
    lastKnowledge = "#contexts";
  }
  $("kw-home").addEventListener("click", () => navigate("#contexts"));
  $("kw-up").addEventListener("click", () =>
    navigate(level === "all" ? lastKnowledge : selected ? routeFor(active) : "#contexts"),
  );
  $("kw-show-whole").addEventListener("click", () => navigate(lastWhole));
  $("kw-close-detail").addEventListener("click", () => navigate(routeFor(active)));
  $("kw-bc-source").addEventListener("click", () => navigate(routeFor(active, active)));
  workspace.addEventListener("click", (event) => {
    const context = event.target.closest("[data-knowledge-context]");
    if (context) return openContext(context.dataset.knowledgeContext);
    const element = event.target.closest("[data-knowledge-element]");
    if (element) return openElement(element.dataset.knowledgeElement);
    const link = event.target.closest('#kw-detail a[href^="#"]');
    if (link) {
      event.preventDefault();
      const target = link.getAttribute("href").slice(1),
        key = byTarget.get(target);
      if (key) openElement(key);
      else if (whole.contains($(target))) navigate(`#${target}`);
    }
  });
  function changedFilter() {
    const s = state(active);
    s.search = search.value;
    s.type = type.value;
    s.page = 0;
    renderList();
  }
  search.addEventListener("input", changedFilter);
  type.addEventListener("change", changedFilter);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") results.querySelector("button")?.click();
    if (event.key === "Escape" && search.value) {
      search.value = "";
      changedFilter();
    }
  });
  $("kw-context-search").addEventListener("input", rootSearch);
  $("kw-context-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const id = rootMatches.keys().next().value;
      if (id) openContext(id);
    }
  });
  for (const [id, delta] of [
    ["kw-prev", -1],
    ["kw-next", 1],
  ])
    $(id).addEventListener("click", () => {
      state(active).page += delta;
      state(active).scroll = 0;
      renderList();
      results.scrollTop = 0;
    });
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        level === "all" ||
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target.closest?.("input,textarea,select,[contenteditable]")
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      (level === "contexts" ? $("kw-context-search") : search).focus();
    },
    true,
  );
  document.addEventListener("report-diagram-rendered", (event) => {
    const figure = event.target;
    if (!detail.contains(figure)) return;
    const targets = JSON.parse(figure.dataset.targets ?? "{}");
    for (const g of figure.querySelectorAll("g.node")) {
      const id = /flowchart-(n\d+)-/.exec(g.id)?.[1];
      const key = byTarget.get(targets[id]);
      if (!key) continue;
      g.setAttribute("role", "link");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", elements.get(key).n);
      g.style.cursor = "pointer";
      g.addEventListener("click", () => openElement(key));
      g.addEventListener("keydown", (e) => {
        if (["Enter", " "].includes(e.key)) {
          e.preventDefault();
          openElement(key);
        }
      });
    }
  });
  const notice = $("kw-global-notice");
  const messages = [
    data.errors.length ? `${T.modelIssues}: ${data.errors.length}` : "",
    data.changeSummary?.changed ? T.changed : "",
    data.changeSummary?.unverified ? T.unknown : "",
  ].filter(Boolean);
  if (messages.length) {
    notice.hidden = false;
    notice.append(node("span", messages.join(" · ")));
    const button = node("button", T.diagnostics);
    button.type = "button";
    button.addEventListener("click", () => {
      const target = ["errors", "changes", "changes-unavailable"].find((id) =>
        whole.contains($(id)),
      );
      navigate(target ? `#${target}` : "#all");
    });
    notice.append(button);
  }
  addEventListener("hashchange", () => renderRoute(true));
  renderRoute();
})();
