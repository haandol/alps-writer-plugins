// One document-local navigator owns both projections; neither view infers business facts.
(() => {
  const data = JSON.parse(document.getElementById("layered-data").textContent);
  const ko = data.language === "ko";
  const t = (kr, en) => (ko ? kr : en);
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const contexts = new Map(data.contexts.map((c) => [c.id, c]));
  const containers = new Map(data.containers.map((c) => [c.id, c]));
  const elements = data.elements;
  const hasElement = (id) => typeof id === "string" && Object.hasOwn(elements, id);
  const hasAdr = (id) => typeof id === "string" && Object.hasOwn(data.adrs, id);
  const types = new Map(data.types);
  const byAnchor = new Map();
  for (const [id, element] of Object.entries(elements)) {
    byAnchor.set(element.h, id);
    byAnchor.set(element.h.replace(/^process-/, ""), id);
  }
  const source = $("business-source").content;
  const sources = new Map([...source.querySelectorAll("[id]")].map((node) => [node.id, node]));
  const adrTemplates = new Map(
    [...document.querySelectorAll("template[data-adr-document]")].map((node) => [
      node.dataset.adrDocument,
      node,
    ]),
  );
  const workflows = new Map(
    [...document.querySelectorAll("template[data-workflow]")].map((node) => [
      node.dataset.workflow,
      node.content.textContent,
    ]),
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const PAGE = 9;
  history.scrollRestoration = "manual";
  const levels = ["contexts", "containers", "adrs"];
  const titles = [
    t("도메인·BC", "Domains & BCs"),
    t("업무 프로세스", "Business processes"),
    t("실현 기능 ADR", "Realizing ADRs"),
  ];
  const subTitles = [
    t("책임과 업무 언어", "Responsibility & language"),
    t("시작·활동·결과", "Trigger, work & outcome"),
    t("결정과 구현 계약", "Decisions & contracts"),
  ];
  let mode =
      new URLSearchParams(location.hash.slice(1)).get("view") === "structure"
        ? "structure"
        : "events",
    gesture = "pan",
    effects = !reduced.matches;
  const initialCamera = () => ({ x: 20, y: 25, zoom: 1, yaw: -14, pitch: 38, fitted: false });
  const fresh = (patch = {}) => ({
    level: "contexts",
    context: null,
    container: null,
    adr: null,
    detail: null,
    selected: null,
    query: "",
    searchScope: "layer",
    domain: "",
    page: 0,
    camera: initialCamera(),
    scroll: 0,
    workflow: false,
    ...patch,
  });
  const clone = (value) => structuredClone(value);
  const scopeKey = (s) => `${s.level}|${s.context ?? ""}|${s.container ?? ""}`;
  const savedScopes = new Map(),
    historyEntries = new Map();
  let state = fresh(),
    historyId = 0,
    serial = 0,
    transition = null;
  let currentNodes = [],
    relations = [],
    detailKey = null,
    frameKey = null;
  let drag = null,
    suppressClick = false;
  let city = null,
    cityAttempted = false,
    cityLinks = true;
  let cityScope = null;
  let flatSize = { width: 356, height: 331 };

  const nameOf = (id) =>
    contexts.get(id)?.name ?? containers.get(id)?.name ?? elements[id]?.n ?? id;
  const names = (ids) => ids.map(nameOf).join(", ");
  const button = (action, id, label) =>
    `<button type="button" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
  const tag = (text, kind = "") => `<span class="tag ${kind}">${esc(text)}</span>`;
  const stateLabel = (key) => data.stateLabels[key] ?? t("미확인", "Unverified");

  function address(s) {
    const params = new URLSearchParams();
    if (s.context !== null) params.set("bc", s.context);
    if (s.container) params.set("process", s.container);
    if (s.adr) params.set("adr", s.adr);
    if (s.detail) params.set("element", s.detail);
    return params.size ? `#${params}` : "#all";
  }

  function forElement(id, preferred = state) {
    if (!hasElement(id)) return null;
    const element = elements[id];
    if (!element) return null;
    if (element.t === "BoundedContext")
      return fresh({ level: "containers", context: id, detail: id });
    const process =
      containers.get(id) ??
      containers.get(
        (data.elementContainers[id] ?? []).find((key) => key === preferred.container) ??
          data.elementContainers[id]?.[0],
      );
    const owners = process?.contexts ?? element.contexts;
    const context = owners.includes(preferred.context)
      ? preferred.context
      : (owners[0] ?? "unassigned");
    return fresh({
      level: process ? "adrs" : "containers",
      context,
      container: process?.id ?? null,
      detail: id,
      selected: id,
    });
  }

  /** Explicit old/new addresses enter the same hierarchy; malformed targets never gain a new scope. */
  function parseAddress() {
    const fragment = location.hash.slice(1);
    const params = new URLSearchParams(fragment);
    if (byAnchor.has(fragment)) return forElement(byAnchor.get(fragment), fresh());
    const bc = params.get("bc"),
      process = params.get("process"),
      adr = params.get("adr"),
      detail = params.get("element");
    let next = fresh();
    if (bc === "unassigned" || contexts.has(bc)) next = fresh({ level: "containers", context: bc });
    if (containers.has(process)) {
      const entry = containers.get(process);
      next = fresh({
        level: "adrs",
        container: process,
        context: entry.contexts.includes(bc) ? bc : (entry.contexts[0] ?? "unassigned"),
      });
    }
    if (hasAdr(adr)) {
      const owner = data.adrs[adr].containers.includes(process)
        ? process
        : data.adrs[adr].containers[0];
      const entry = containers.get(owner);
      next = fresh({
        level: "adrs",
        container: owner,
        context: entry.contexts.includes(bc) ? bc : (entry.contexts[0] ?? "unassigned"),
        adr,
        selected: adr,
      });
    }
    if (hasElement(detail)) {
      const target = forElement(detail, next);
      next = target
        ? {
            ...target,
            ...(next.container && (data.elementContainers[detail] ?? []).includes(next.container)
              ? { context: next.context, container: next.container }
              : {}),
          }
        : next;
    }
    return next;
  }

  function remember() {
    state.scroll = window.scrollY;
    historyEntries.set(historyId, clone(state));
    savedScopes.set(scopeKey(state), clone(state));
  }

  /** Commit state before any effect starts. Animation completion never changes a target. */
  function navigate(next, { replace = false, animate = true, focus = true } = {}) {
    remember();
    state = clone(next);
    if (!replace) historyId = ++serial;
    historyEntries.set(historyId, clone(state));
    history[replace ? "replaceState" : "pushState"](
      { ontologyLayered: historyId },
      "",
      address(state),
    );
    render({ animate });
    if (focus)
      $(state.detail || state.adr ? "detail-title" : "scope-title").focus({ preventScroll: true });
    window.scrollTo({ top: state.scroll, behavior: "instant" });
  }

  function restoreScope(patch) {
    const base = fresh(patch);
    return clone(savedScopes.get(scopeKey(base)) ?? base);
  }

  function openContext(id) {
    if (!contexts.has(id) && id !== "unassigned") return;
    state.selected = id;
    navigate({ ...restoreScope({ level: "containers", context: id }), detail: null, adr: null });
  }
  function openProcess(id) {
    const process = containers.get(id);
    if (!process) return;
    state.selected = id;
    const context = process.contexts.includes(state.context)
      ? state.context
      : (process.contexts[0] ?? "unassigned");
    navigate({
      ...restoreScope({ level: "adrs", context, container: id }),
      detail: null,
      adr: null,
    });
  }
  function openElement(id) {
    const next = forElement(id);
    if (!next) return;
    const here =
      id === state.context ||
      (data.elementContainers[id] ?? []).includes(state.container) ||
      (state.level === "containers" && elements[id].contexts.includes(state.context));
    navigate(here ? { ...state, adr: null, detail: id, selected: id } : next, { animate: !here });
    $("detail-panel").scrollIntoView({ block: "start", behavior: "instant" });
  }
  function up() {
    if (state.level === "adrs")
      navigate(restoreScope({ level: "containers", context: state.context }));
    else navigate(restoreScope({ level: "contexts" }));
  }

  const rawNode = (id, kind) => {
    if (kind === "ADR") {
      const adr = data.adrs[id];
      return {
        id,
        kind,
        name: adr.name,
        description: adr.summary,
        status: adr.status,
        marks: adr.issues.length ? 4 : 0,
        shared: adr.containers.length > 1,
        searchUnit: {
          id,
          title: adr.name,
          fields: [
            { name: "summary", value: adr.summary },
            { name: "body", value: adr.body ?? "" },
          ],
        },
      };
    }
    if (kind === "BoundedContext") {
      const context = contexts.get(id);
      return {
        id,
        kind,
        name: context.name,
        description: context.definition,
        extra: context.coreLogic,
        domains: context.domains.map((id) => data.domains.find((domain) => domain.id === id)),
        marks: elements[id]?.m ?? 0,
        searchUnit: elements[id]?.searchUnit,
      };
    }
    if (kind === "Process") {
      const process = containers.get(id);
      return {
        id,
        kind,
        name: process.name,
        description: process.start,
        extra: process.outcome,
        status: process.status,
        shared: process.contexts.length > 1,
        marks: process.marks,
        searchUnit: elements[id].searchUnit,
      };
    }
    const element = elements[id];
    return {
      id,
      kind: element.t,
      name: element.n,
      description: element.searchUnit.fields.find((f) => f.name === "definition")?.value,
      extra: names(element.contexts) || t("BC 소속 미기록", "BC membership unrecorded"),
      state: element.s,
      marks: element.m ?? 0,
      searchUnit: element.searchUnit,
    };
  };

  function nodesInScope() {
    if (state.searchScope === "knowledge") {
      let ids = Object.keys(elements);
      if (state.container) ids = containers.get(state.container).elements;
      else if (state.context === "unassigned") ids = data.unassigned.elements;
      else if (state.context)
        ids = ids.filter((id) => elements[id].contexts.includes(state.context));
      else if (state.domain)
        ids = ids.filter((id) =>
          elements[id].contexts.some((c) => contexts.get(c)?.domains.includes(state.domain)),
        );
      return ids.map((id) => rawNode(id, elements[id].t));
    }
    if (state.level === "contexts")
      return data.contexts
        .filter((c) => !state.domain || c.domains.includes(state.domain))
        .map((c) => rawNode(c.id, "BoundedContext"));
    if (state.level === "containers")
      return (
        state.context === "unassigned"
          ? data.unassigned.containers
          : (contexts.get(state.context)?.containers ?? [])
      ).map((id) => rawNode(id, "Process"));
    return containers.get(state.container).adrs.map((id) => rawNode(id, "ADR"));
  }

  /** Spatial inclusion uses authored membership, never event order or ADR folders. */
  function structureScope() {
    const domainGroups = new Map();
    for (const context of data.contexts) {
      const ids = [...context.domains].sort();
      const key = JSON.stringify(ids);
      if (!domainGroups.has(key)) {
        const sources = ids.map((id) => data.domains.find((domain) => domain.id === id));
        domainGroups.set(key, {
          id: `domains:${key}`,
          kind: ids.length > 1 ? "shared-domains" : "domain",
          label:
            sources.map((domain) => domain.name).join(" / ") ||
            t("도메인 소속 미기록", "Domain membership unrecorded"),
          note: sources.map((domain) => domain.verdict).join(" · "),
          domains: ids,
          ids: [],
        });
      }
      domainGroups.get(key).ids.push(context.id);
    }
    const landscape = [...domainGroups.values()];
    const inventory =
      state.level === "contexts" && state.searchScope === "layer"
        ? data.contexts.map((context) => rawNode(context.id, "BoundedContext"))
        : nodesInScope();
    const groups = new Map();
    if (state.level === "contexts" && state.searchScope === "layer") {
      for (const group of landscape) groups.set(group.id, { ...group, ids: [...group.ids] });
    } else {
      for (const item of inventory) {
        const key =
          state.searchScope === "knowledge" ? item.kind : item.shared ? "shared" : "local";
        if (!groups.has(key))
          groups.set(key, {
            id: key,
            kind: key === "shared" ? "shared" : "scope",
            label:
              state.searchScope === "knowledge"
                ? (types.get(item.kind) ?? item.kind)
                : state.level === "containers"
                  ? key === "shared"
                    ? t("다른 BC와 함께 참여", "Shared participation across BCs")
                    : t("현재 BC의 참여 업무", "Work involving this BC")
                  : key === "shared"
                    ? t("여러 업무에 연결된 ADR", "ADRs shared by processes")
                    : t("현재 업무에 연결된 ADR", "ADRs associated with this process"),
            ids: [],
          });
        groups.get(key).ids.push(item.id);
      }
    }
    const context = contexts.get(state.context);
    const process = containers.get(state.container);
    const ancestors = [];
    if (context) {
      const domains = context.domains.map((id) => data.domains.find((domain) => domain.id === id));
      if (domains.length)
        ancestors.push({
          id: `domains:${JSON.stringify([...context.domains].sort())}`,
          kind: "domain",
          label: domains.map((domain) => domain.name).join(" / "),
        });
      ancestors.push({ id: context.id, kind: "BoundedContext", label: context.name });
    }
    if (process) ancestors.push({ id: process.id, kind: "Process", label: process.name });
    return {
      groups: [...groups.values()],
      ancestors,
      landscape,
      context: context?.id ?? null,
      contextName: context?.name ?? "",
      total: inventory.length,
      numbers: Object.fromEntries(
        inventory
          .map((node) => node.id)
          .sort()
          .map((id, i) => [id, i + 1]),
      ),
      language: data.language,
    };
  }

  function filteredNodes() {
    const nodes = nodesInScope();
    try {
      const terms = parseSearchQuery(state.query);
      if (!terms.length) return { nodes, error: null };
      const records = new Map(nodes.map((node) => [node.id, node]));
      const units = nodes.map((node) =>
        prepareSearchUnit({ ...node.searchUnit, id: node.id, identifier: node.id }),
      );
      return {
        nodes: rankSearchUnits(units, terms).map((hit) => ({
          ...records.get(hit.id),
          matches: hit.matches,
        })),
        error: null,
      };
    } catch (error) {
      if (!(error instanceof SearchInputError)) throw error;
      return {
        nodes: [],
        error: t(
          "검색어의 빈 따옴표나 닫히지 않은 따옴표를 확인하세요.",
          "Check for empty or unclosed quotation marks.",
        ),
      };
    }
  }

  function renderNavigation() {
    const level = levels.indexOf(state.level);
    document.body.dataset.layer = state.level;
    document.body.dataset.view = mode;
    $("layer-path").innerHTML = titles
      .map(
        (title, i) =>
          `<button type="button" class="path-step" data-path="${i}" ${i > level ? "disabled" : ""} ${i === level ? 'aria-current="step"' : ""}><span class="step-number">${i + 1}</span><span>${title}<small>${subTitles[i]}</small></span></button>`,
      )
      .join("");
    $("breadcrumbs").innerHTML =
      button("home", "", t("전체 업무", "All business")) +
      (state.context
        ? ` <span>/</span> ${button("context", state.context, state.context === "unassigned" ? t("소속 미확인", "Unassigned") : nameOf(state.context))}`
        : "") +
      (state.container
        ? ` <span>/</span> ${button("process", state.container, nameOf(state.container))}`
        : "") +
      (state.adr ? ` <span>/</span> <span>ADR</span>` : "");
    $("layer-label").textContent = `${String(level + 1).padStart(2, "0")} / 03 · ${titles[level]}`;
    $("scope-title").textContent = state.container
      ? nameOf(state.container)
      : state.context
        ? state.context === "unassigned"
          ? t("소속이 기록되지 않은 업무", "Work without recorded membership")
          : nameOf(state.context)
        : (data.domain?.name ?? t("업무의 큰 그림", "The business at a glance"));
    $("scope-description").textContent =
      state.level === "contexts"
        ? t(
            "책임 경계를 선택해 그 안의 업무로 내려갑니다. 도메인 구분은 제공된 근거만 사용합니다.",
            "Select a responsibility boundary to open its work. Domain groupings use only supplied evidence.",
          )
        : state.level === "containers"
          ? (contexts.get(state.context)?.definition ??
            t(
              "업무의 소속을 확인할 근거가 필요합니다.",
              "Evidence is needed to establish business membership.",
            ))
          : containers.get(state.container).definition;
    $("go-up").hidden = state.level === "contexts";
    $("layer-search").value = state.query;
    $("search-scope").value = state.searchScope;
    $("domain-filter").hidden = state.level !== "contexts";
    $("domain-filter").value = state.domain;
    for (const toggle of document.querySelectorAll("button[data-view]"))
      toggle.setAttribute("aria-pressed", String(toggle.dataset.view === mode));
    document.querySelector('[data-camera="rotate"]').disabled = mode !== "structure";
    $("city-options").hidden = mode !== "structure";
    $("city-hud").hidden = mode !== "structure";
    $("city-layer-title").textContent = `${titles[level]} · ${$("scope-title").textContent}`;
    $("city-layer-hint").textContent = [
      t(
        "도메인 구역 안의 BC와 협업 경계를 살펴봅니다.",
        "Locate BCs within business domains and inspect collaboration boundaries.",
      ),
      t(
        "상위 경계 안에서 참여 업무와 여러 BC의 공유 업무를 구별합니다.",
        "Keep the parent boundary while distinguishing local and shared participation.",
      ),
      t(
        "업무의 실현 범위와 여러 업무에 공유되는 ADR을 살펴봅니다.",
        "Inspect this process's realization and ADRs shared with other work.",
      ),
    ][level];
  }

  function evidence(claim) {
    return `<p>${tag(claim.verdict || "unconfirmed")}${claim.classification ? tag(claim.classification) : ""}</p>${(claim.evidence ?? []).length ? `<ul>${claim.evidence.map((item) => `<li><code>${esc(item.source)}</code>${item.detail ? ` · ${esc(item.detail)}` : ""}</li>`).join("")}</ul>` : `<p>${t("출처 미기록", "No recorded source")}</p>`}${claim.unmappedContexts?.length ? `<p class="warning">${t("모델에서 찾지 못한 소속", "Memberships not found in the model")}: ${esc(claim.unmappedContexts.join(", "))}</p>` : ""}`;
  }

  function renderSummary() {
    let html = "";
    if (state.level === "contexts") {
      const domain = data.domains.find((d) => d.id === state.domain);
      html = domain
        ? `<details class="scope-summary-card"><summary>${esc(domain.name)} · ${t("범위와 근거", "Scope and evidence")} · ${esc(domain.verdict)}</summary><p>${esc(domain.definition)}</p>${evidence(domain)}</details>`
        : `<p class="note">${data.domains.length ? t("하나의 BC가 여러 서브도메인에 참여할 수 있습니다. 미기록 소속은 그대로 남겨 둡니다.", "A BC may participate in multiple subdomains. Unrecorded membership remains unknown.") : t("도메인·서브도메인 자료가 제공되지 않았습니다. BC 책임과 핵심 업무를 먼저 확인하세요.", "Domain/subdomain evidence was not supplied. Read the BC responsibilities and core logic first.")}</p>`;
      if (data.unassigned.containers.length || data.unassigned.elements.length)
        html += `<p>${button("context", "unassigned", `${t("BC 소속 미확인", "BC membership unrecorded")} · ${data.unassigned.containers.length} ${t("업무", "processes")}`)}</p>`;
      if (data.domain)
        html += `<details class="scope-summary-card"><summary>${esc(data.domain.name)} · ${t("도메인 근거", "Domain evidence")}</summary><p>${esc(data.domain.description ?? "")}</p>${evidence(data.domain)}</details>`;
    } else if (state.level === "containers") {
      const context = contexts.get(state.context);
      if (context)
        html = `<div class="scope-summary-card"><dl class="summary-facts"><div><dt>${t("핵심 업무", "Core business logic")}</dt><dd>${esc(context.coreLogic || t("아직 기록되지 않았습니다.", "Not recorded yet."))}</dd></div><div><dt>${t("서브도메인 소속", "Subdomain membership")}</dt><dd>${
          context.domains.length
            ? context.domains
                .map((id) => {
                  const d = data.domains.find((d) => d.id === id);
                  return `${esc(d.name)} · ${esc(d.verdict)}`;
                })
                .join("<br>")
            : t("미기록", "Unrecorded")
        }</dd></div></dl>${!context.complete ? `<p class="warning">${t("상위 업무 지식에 누락이 있습니다. 구조 완비 여부는 업무 완전성이나 실행 검증과 별개입니다.", "Upper-layer knowledge is incomplete. Structural completeness is separate from business sufficiency and execution verification.")}</p>` : ""}<div class="summary-actions">${button("element", context.id, t("BC 원문과 협업", "BC facts and collaboration"))}</div></div>`;
    } else {
      const process = containers.get(state.container);
      html = `<div class="scope-summary-card"><div>${tag(process.status ?? t("Status 미기록", "Status unrecorded"))}${process.contexts.length > 1 ? tag(t("여러 BC의 공유 업무", "Shared across BCs")) : ""}</div><dl class="summary-facts"><div><dt>${t("시작 조건", "Starting condition")}</dt><dd>${esc(process.start || t("미기록", "Unrecorded"))}</dd></div><div><dt>${t("업무 결과", "Business outcome")}</dt><dd>${esc(process.outcome || t("미기록", "Unrecorded"))}</dd></div></dl><p class="note">${t("참여 BC", "Participating BCs")}: ${esc(names(process.contexts) || t("미기록", "Unrecorded"))}</p><div class="summary-actions">${button("workflow", process.id, t("사건 흐름 펼치기", "Open event flow"))}${button("element", process.id, t("프로세스 원문·그림", "Process facts & diagram"))}</div><details><summary>${t("활동과 실현 상태", "Activities and realization")} · ${process.steps.length}</summary><ol class="workflow-steps">${process.steps
        .map((id) => {
          const step = data.businessSteps[id];
          const external = !step.contexts.includes(state.context);
          return `<li class="${external ? "external" : ""}" data-business-step="${esc(id)}">${button("element", id, step.name)}<small>${external ? t("외부 참여", "External participation") + " · " : ""}${esc(names(step.contexts) || t("소속 미기록", "Unrecorded membership"))}</small>${tag(stateLabel(step.state), step.state)}<p>${t("수행", "Performer")}: ${esc(names(step.performers) || t("미확인", "Unconfirmed"))}<br>${t("대상", "Works with")}: ${esc(names(step.uses) || t("미기록", "Unrecorded"))}<br>${t("발생 사건", "Emitted events")}: ${esc(names(step.events) || t("미기록", "Unrecorded"))}</p></li>`;
        })
        .join(
          "",
        )}</ol></details><p class="note">${t("실현 상태는 ADR Status에서 계산합니다. 업무 완전성과 실제 실행 검증은 별도이며, 수행하지 않은 점검은 미확인입니다.", "Realization comes from ADR Status. Business completeness and execution verification are separate; unperformed checks remain unverified.")}</p></div><p class="warning">${t("연결 범위: 기능 범주 수준. 아래 ADR은 색인의 realizes로 연결되며, 범주의 모든 ADR이 각 활동을 직접 구현한다는 뜻은 아닙니다.", "Link precision: functional category. These ADRs are associated through the index's realizes links; this does not establish that every document directly implements each activity.")}</p>`;
    }
    $("scope-summary").innerHTML = html;
  }

  function nodeMarkup(node, position) {
    const domainNames =
      node.kind === "BoundedContext"
        ? contexts.get(node.id).domains.map((id) => data.domains.find((d) => d.id === id).name)
        : [];
    const kind = node.kind === "ADR" ? "ADR" : (types.get(node.kind) ?? node.kind);
    const detail =
      node.kind === "BoundedContext"
        ? node.extra || t("핵심 업무 미기록", "Core logic unrecorded")
        : node.kind === "Process"
          ? `${t("결과", "Outcome")}: ${node.extra || t("미기록", "Unrecorded")}`
          : node.kind === "ADR"
            ? t("기능 범주 연결 · 원문 열기", "Category association · read decision")
            : node.extra;
    const warning = node.marks & 12 ? t(" · 검증 필요", " · needs review") : "";
    const marks = [
      [1, t("은퇴", "Retired")],
      [2, t("변경 확인", "Changed")],
      [12, t("불완전·오류", "Incomplete / error")],
      [16, t("변경 미확인", "Changes unverified")],
    ]
      .filter(([mask]) => node.marks & mask)
      .map(([, label]) => tag(label, "warning"))
      .join("");
    return `<button type="button" class="layer-node" data-layer-node="${esc(node.id)}" data-kind="${node.kind}" aria-pressed="${state.selected === node.id}" style="left:${position.x}px;top:${position.y}px"><span class="city-number" aria-hidden="true">${cityScope.numbers[node.id]}</span><span class="node-type"><span>${esc(kind)}</span><span>${node.shared ? t("공유", "Shared") + " · " : ""}${esc(node.status ?? (node.state ? stateLabel(node.state) : ""))}${warning}</span></span><span class="node-name">${esc(node.name)}</span><span class="node-description">${esc(node.description || t("설명 미기록", "Description unrecorded"))}</span><span class="node-detail">${esc(detail)}</span>${marks ? `<span class="node-flags">${marks}</span>` : ""}<span class="node-foot"><code title="${esc(node.id)}">${esc(domainNames.length ? domainNames.join(" · ") : node.id)}</code><span aria-hidden="true">↗</span></span></button>`;
  }

  function layerRelations() {
    if (state.searchScope === "knowledge") return [];
    if (state.level === "contexts") {
      const edges = data.collaborations.map(([from, to]) => ({
        from,
        to,
        kind: "collaboration",
        label: t("기록된 협업", "Recorded collaboration"),
      }));
      const seen = new Set();
      for (const edge of data.reactions) {
        const source = data.businessSteps[edge.sourceStep]?.contexts ?? [];
        const target = data.businessSteps[edge.targetStep]?.contexts ?? [];
        // A shared/unknown step never supplies an invented primary BC or direction.
        if (source.length !== 1 || target.length !== 1 || source[0] === target[0]) continue;
        const key = JSON.stringify([source[0], target[0], edge.event, edge.policy]);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          ...edge,
          from: source[0],
          to: target[0],
          kind: "reaction",
          label: nameOf(edge.event),
        });
      }
      return edges;
    }
    if (state.level === "containers") {
      const members = new Set(
        (state.context === "unassigned"
          ? data.unassigned.containers
          : contexts.get(state.context)?.containers) ?? [],
      );
      return data.reactions
        .filter((edge) => edge.from !== edge.to && (members.has(edge.from) || members.has(edge.to)))
        .map((edge) => ({ ...edge, kind: "reaction", label: nameOf(edge.event) }));
    }
    return [];
  }

  function renderNodes() {
    city?.setActive(false);
    cityScope = structureScope();
    const result = filteredNodes();
    const pages = Math.max(1, Math.ceil(result.nodes.length / PAGE));
    state.page = Math.min(Math.max(0, state.page), pages - 1);
    currentNodes = result.nodes.slice(state.page * PAGE, (state.page + 1) * PAGE);
    const columns =
      $("layer-viewport").clientWidth < 600
        ? 1
        : Math.min(3, Math.max(2, Math.floor($("layer-viewport").clientWidth / 325)));
    const positions = new Map(
      currentNodes.map((node, i) => [
        node.id,
        { x: 28 + (i % columns) * 352, y: 32 + Math.floor(i / columns) * 286 },
      ]),
    );
    const width = columns * 352 + 4,
      height = Math.max(1, Math.ceil(currentNodes.length / columns)) * 286 + 45;
    flatSize = { width, height };
    $("layer-world").style.width = `${width}px`;
    $("layer-world").style.height = `${height}px`;
    const markup = (node) => nodeMarkup(node, positions.get(node.id));
    $("layer-nodes").innerHTML =
      mode === "structure"
        ? cityScope.groups
            .map((group) => {
              const members = currentNodes.filter((node) => group.ids.includes(node.id));
              return members.length
                ? `<div class="city-group-label"><strong>${esc(group.label)}</strong>${group.note ? `<small>${esc(group.note)}</small>` : ""}</div>${members.map(markup).join("")}`
                : "";
            })
            .join("")
        : currentNodes.map(markup).join("");
    relations = layerRelations();
    const shownRelations = relations.filter(
      (edge) => positions.has(edge.from) && positions.has(edge.to),
    );
    $("layer-connections").setAttribute("width", width);
    $("layer-connections").setAttribute("height", height);
    $("layer-connections").innerHTML =
      `<defs><marker id="layer-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:#a57b51;stroke:none"/></marker></defs>${shownRelations
        .map((edge) => {
          const a = positions.get(edge.from),
            b = positions.get(edge.to),
            x1 = a.x + 148,
            y1 = a.y + 120,
            x2 = b.x + 148,
            y2 = b.y + 120;
          return `<path data-layer-relation="${esc(`${edge.from}|${edge.kind}|${edge.to}|${edge.event ?? ""}|${edge.policy ?? ""}`)}" class="${edge.kind}" d="M${x1} ${y1} C${x1} ${y1 + 100},${x2} ${y2 - 100},${x2} ${y2}" ${edge.kind === "reaction" ? 'marker-end="url(#layer-arrow)"' : ""}/>`;
        })
        .join("")}`;
    $("results-status").textContent =
      result.error ??
      `${result.nodes.length} ${t("항목", "items")} · ${titles[levels.indexOf(state.level)]}${state.searchScope === "knowledge" ? ` · ${t("업무 자료", "Business knowledge")}` : ""}`;
    $("empty-scope").hidden = result.nodes.length > 0;
    $("empty-scope").textContent =
      result.error ??
      (state.level === "adrs" && state.searchScope === "layer" && !state.query
        ? t(
            "기록된 실현 ADR 연결이 없습니다. 활동의 실현 누락을 확인하세요.",
            "No realizing ADR association is recorded. Check the activities without realization.",
          )
        : t("현재 범위에서 일치하는 항목이 없습니다.", "No matching items in this scope."));
    $("page-status").textContent = `${state.page + 1} / ${pages}`;
    $("page-previous").disabled = state.page === 0;
    $("page-next").disabled = state.page + 1 === pages;
    renderRelations();
    if (!state.camera.fitted) fitCamera(width);
    paintCamera();
  }

  function renderRelations() {
    const visible = new Set(currentNodes.map((node) => node.id));
    const connected = relations.filter((edge) => visible.has(edge.from) || visible.has(edge.to));
    $("layer-relations").innerHTML = connected.length
      ? `<h3>${t("기록된 연결", "Recorded connections")}</h3><ul class="relationship-list">${connected.map((edge) => `<li><button type="button" data-relation="${relations.indexOf(edge)}">${esc(nameOf(edge.from))} ${edge.kind === "collaboration" ? "—" : "→"} ${esc(nameOf(edge.to))}<small>${esc(edge.label)}${edge.condition ? " · " + esc(edge.condition) : ""}${!visible.has(edge.from) || !visible.has(edge.to) ? ` · ${t("다른 페이지·업무와 연결", "Connects another page or scope")}` : ""}</small></button></li>`).join("")}</ul>`
      : `<p class="note">${state.level === "adrs" ? t("ADR끼리의 순서나 의존 관계는 실현 링크에서 추정하지 않습니다.", "ADR order or dependencies are not inferred from realization links.") : t("현재 페이지와 연결된 기록이 없습니다.", "No recorded connections touch this page.")}</p>`;
  }

  function fitCamera(width = flatSize.width) {
    const viewport = $("layer-viewport");
    state.camera = {
      ...initialCamera(),
      zoom: Math.max(0.45, Math.min(1, (viewport.clientWidth - 28) / width)),
      fitted: true,
    };
    state.camera.x = (viewport.clientWidth - width * state.camera.zoom) / 2;
  }
  function paintCamera() {
    const c = state.camera;
    if (mode === "structure" && !cityAttempted) {
      cityAttempted = true;
      city = window.createOntologyCity(
        $("layer-city"),
        $("layer-nodes"),
        $("layer-flow"),
        cityMotion,
      );
      $("layer-viewport").dataset.city = city ? "ready" : "unavailable";
    }
    const spatial = mode === "structure" && city;
    $("layer-city").hidden = !spatial;
    $("layer-flow").hidden = !spatial;
    $("city-hud").hidden = !spatial;
    $("city-unavailable").hidden = mode !== "structure" || Boolean(city);
    $("city-options").hidden = !spatial;
    $("city-list-heading").hidden = !spatial;
    document.querySelector('[data-camera="rotate"]').disabled = !spatial;
    if (spatial) {
      $("layer-world").style.width = "100%";
      $("layer-world").style.height = "100%";
      $("layer-world").style.transform = "none";
      city.render({
        layer: state.level,
        nodes: currentNodes,
        relations,
        selected: state.selected,
        camera: c,
        flatWidth: flatSize.width,
        cameraWidth: $("layer-viewport").clientWidth,
        structure: cityScope,
        endpoints: Object.fromEntries(
          relations
            .flatMap((edge) => [edge.from, edge.to])
            .map((id) => [
              id,
              {
                name: nameOf(id),
                inScope: cityScope.groups.some((group) => group.ids.includes(id)),
              },
            ]),
        ),
      });
      $("city-list-title").textContent =
        `${titles[levels.indexOf(state.level)]} · ${currentNodes.length}`;
      cityReadout();
    } else {
      city?.setActive(false);
      $("layer-world").style.width = `${flatSize.width}px`;
      $("layer-world").style.height = `${flatSize.height}px`;
      $("layer-world").style.transform = `translate(${c.x}px,${c.y}px) scale(${c.zoom})`;
    }
    $("camera-scale").textContent = `${Math.round(c.zoom * 100)}%`;
    $("camera-hint").textContent = spatial
      ? t(
          "구역은 기록된 소속·참여 범위 · 번호는 옆 목록과 연결 · 공유 영역은 단독 소유가 아닙니다. 자세한 사건·조건은 업무 흐름에서 확인합니다.",
          "Regions show recorded membership and participation · numbers locate list items · shared areas do not imply exclusive ownership. Read event and condition details in the workflow.",
        )
      : t(
          "드래그로 이동 · +/−로 확대 · 배치는 순서나 중요도를 뜻하지 않습니다.",
          "Drag to pan · +/− to zoom · placement does not imply order or importance.",
        );
  }

  function cityReadout() {
    if (!city || mode !== "structure") return;
    $("city-visibility").textContent =
      `${t("지도 이름", "Map names")} ${city.snapshot().labelIds.length}/${currentNodes.length} · ${t("전체 이름은 옆 목록에서 확인", "Every name is available in the list")}`;
  }

  function cityMotion({ reason, count }) {
    const states = {
      playing: t("흐름 재생 중", "Flow playing"),
      paused: t("흐름 일시 정지", "Flow paused"),
      reduced: t("동작 줄이기 · 화살표로 방향 표시", "Reduced motion · arrows retain direction"),
      hidden: t("화면 숨김 · 흐름 정지", "Hidden · flow stopped"),
      outside: t("지도 화면 밖 · 흐름 정지", "Map outside view · flow stopped"),
      inactive: t("3D 보기 닫힘", "3D view inactive"),
      "links-hidden": t("연결 표시 꺼짐", "Connections hidden"),
      "no-flow": t(
        "현재 범위에 방향이 기록된 연결 없음",
        "No recorded directional connection in this scope",
      ),
      unavailable: t(
        "흐름 효과 표시 불가 · 화살표로 방향 표시",
        "Flow effect unavailable · arrows retain direction",
      ),
    };
    $("city-motion-status").textContent =
      `${states[reason]}${count ? ` · ${count} ${t("경로", "routes")}` : ""}`;
    $("city-motion-status").dataset.motion = reason;
  }

  function cityHint(id) {
    cityReadout();
    const item = currentNodes.find((node) => node.id === id);
    $("city-tooltip").hidden = !item || mode !== "structure";
    if (item && mode === "structure")
      $("city-tooltip").innerHTML =
        `<strong>${esc(item.name)}</strong><p>${esc(item.description ?? "")}</p>${item.domains?.length ? `<p>${item.domains.map((domain) => `${esc(domain.name)} · ${esc(domain.verdict)}`).join("<br>")}</p>` : ""}<span>${esc(item.status ?? (item.state ? stateLabel(item.state) : ""))}</span>${item.shared ? `<span> · ${t("공유 항목", "Shared item")}</span>` : ""}${item.marks & 12 ? `<p class="warning">${t("검증 오류로 이 범위는 불완전합니다. 검증·변경 정보를 확인하세요.", "Validation errors leave this scope incomplete. Inspect Validation & changes.")}</p>` : ""}`;
  }

  /** Clone only requested known fragments; links remain inside this navigator. */
  function safeClone(original) {
    const copy = original.cloneNode(true);
    for (const node of copy.querySelectorAll("script,iframe,object,embed,link,style"))
      node.remove();
    for (const node of [copy, ...copy.querySelectorAll("*")]) {
      for (const attribute of [...(node.attributes ?? [])])
        if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if (node.matches?.("a") && !node.getAttribute("href")?.startsWith("#"))
        node.removeAttribute("href");
    }
    return copy;
  }

  function renderDetail() {
    const key = state.adr ? `adr:${state.adr}` : state.detail ? `element:${state.detail}` : null;
    $("detail-panel").hidden = key === null;
    if (key === detailKey) return;
    detailKey = key;
    $("detail-body").replaceChildren();
    if (!key) return;
    if (state.adr) {
      const adr = data.adrs[state.adr];
      $("detail-title").textContent = adr.name;
      $("detail-body").innerHTML =
        `<p>${tag(adr.status ?? t("색인 Status 미기록", "Index Status unrecorded"))}${adr.containers.length > 1 ? tag(t("여러 업무의 공유 ADR", "ADR shared by several processes")) : ""}</p><p>${esc(adr.summary)}</p><dl><dt>${t("ADR 식별자", "ADR identifier")}</dt><dd><code>${esc(adr.id)}</code></dd><dt>${t("원문 Status", "Document Status")}</dt><dd>${esc(adr.documentStatus ?? t("읽지 못함", "Not readable"))}</dd><dt>${t("연결 정밀도", "Link precision")}</dt><dd>${t("기능 범주 수준의 실현 연결", "Category-level realization association")}</dd></dl>${adr.issues.map((issue) => `<p class="warning">${esc(issue)}</p>`).join("")}<details><summary>${t("이 문서와 연결된 업무·활동", "Associated processes and activities")}</summary><ul>${adr.bindings.map((binding) => `<li>${button("process", binding.container, nameOf(binding.container))} · <code>${esc(binding.category)}</code><p>${binding.steps.map((id) => button("element", id, nameOf(id))).join(" ")}</p></li>`).join("")}</ul></details><p class="note">${t("이 화면의 마지막 추상화 레이어입니다. 아래 내용은 원문이며 링크는 참고 텍스트로 표시합니다.", "This is the final abstraction layer. The document follows; its links are shown as reference text.")}</p>`;
      const article = document.createElement("article");
      article.className = "adr-document";
      article.append(adrTemplates.get(adr.id).content.cloneNode(true));
      $("detail-body").append(article);
      if (adr.body !== null) {
        const raw = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = t("원문 Markdown", "Verbatim Markdown");
        const pre = document.createElement("pre");
        pre.textContent = adr.body;
        raw.append(summary, pre);
        $("detail-body").append(raw);
      }
    } else {
      const element = elements[state.detail];
      $("detail-title").textContent = element.n;
      const owners = element.contexts;
      const scope = document.createElement("p");
      scope.className = "note";
      scope.textContent = `${owners.length > 1 ? t("공유 업무 자료", "Shared business knowledge") : !owners.includes(state.context) ? t("다른 BC의 자료", "Knowledge from another BC") : t("현재 BC의 자료", "Knowledge in this BC")} · ${names(owners) || t("소속 미기록", "Membership unrecorded")}`;
      $("detail-body").append(scope);
      const original = sources.get(element.h);
      if (original) $("detail-body").append(safeClone(original));
      for (const figure of $("detail-body").querySelectorAll("figure[data-mermaid]")) {
        figure.dataset.mermaid = `layer-detail-${++serial}`;
        const draw = document.createElement("button");
        draw.type = "button";
        draw.textContent = t("프로세스 그림 그리기", "Draw process diagram");
        draw.addEventListener("click", async () => {
          draw.disabled = true;
          await window.reportDiagramRender?.(figure);
          draw.remove();
        });
        figure.prepend(draw);
      }
      const supplied = data.businessSteps[state.detail]?.supplied;
      if (supplied) {
        const extra = document.createElement("details");
        extra.innerHTML = `<summary>${t("별도로 제공된 검토 자료", "Separately supplied review material")}</summary><p class="note">${t("모델에 저장된 사실과 구별되는 후보 자료입니다.", "Candidate evidence, separate from the saved model facts.")}</p>${evidence(supplied)}${supplied.entities.map((item) => `<h4>${esc(item.name)}</h4><p>${esc(item.before ?? t("전 상태 미확인", "Before unconfirmed"))} → ${esc(item.after ?? t("후 상태 미확인", "After unconfirmed"))}</p>${evidence(item)}`).join("")}${(supplied.views ?? []).map((view) => `<h4>${esc(view.name)}</h4><p>${esc(view.role)} · ${esc(view.description ?? "")}</p>${evidence(view)}`).join("")}`;
        $("detail-body").append(extra);
      }
    }
  }

  function renderWorkflow() {
    const key = state.workflow ? state.container : null;
    $("business-workflow").hidden = key === null;
    if (key === frameKey) return;
    frameKey = key;
    $("workflow-frame-host").replaceChildren();
    if (!key) return;
    const frame = document.createElement("iframe");
    frame.title = `${t("업무 사건 흐름", "Business event flow")}: ${nameOf(key)}`;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.srcdoc = workflows.get(key);
    frame.addEventListener("load", () => {
      if (!effects)
        frame.contentWindow.postMessage(
          {
            type: "ontology-effects",
            enabled: false,
            reason: reduced.matches ? "reduced" : "paused",
          },
          "*",
        );
    });
    $("workflow-frame-host").append(frame);
  }

  function refreshMotion() {
    if (!effects || reduced.matches || document.hidden) {
      transition?.cancel();
      transition = null;
    }
    $("motion-toggle").setAttribute("aria-pressed", String(effects && !reduced.matches));
    $("motion-toggle").textContent = reduced.matches
      ? t("동작 줄이기", "Reduced motion")
      : effects
        ? t("움직임 켜짐", "Motion on")
        : t("움직임 꺼짐", "Motion off");
    city?.motion({
      enabled: effects && !reduced.matches,
      reason: reduced.matches ? "reduced" : "paused",
    });
  }
  function render({ animate = false } = {}) {
    transition?.cancel();
    transition = null;
    $("city-tooltip").hidden = true;
    renderNavigation();
    renderSummary();
    renderNodes();
    renderDetail();
    renderWorkflow();
    refreshMotion();
    if (animate && effects && !reduced.matches && !document.hidden)
      transition = $(mode === "structure" && city ? "layer-world" : "layer-nodes").animate(
        [
          { opacity: 0.25, transform: "scale(.76) translateY(20px)" },
          { opacity: 1, transform: "scale(1) translateY(0)" },
        ],
        { duration: 280, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (action) {
      const id = action.dataset.id;
      if (action.dataset.action === "home") navigate(restoreScope({ level: "contexts" }));
      if (action.dataset.action === "context") openContext(id);
      if (action.dataset.action === "process") openProcess(id);
      if (action.dataset.action === "element") openElement(id);
      if (action.dataset.action === "workflow") {
        state.workflow = true;
        renderWorkflow();
        remember();
        $("business-workflow").scrollIntoView({ block: "start", behavior: "instant" });
      }
      return;
    }
    const node = event.target.closest("[data-layer-node]");
    if (node) {
      const id = node.dataset.layerNode,
        kind = node.dataset.kind;
      if (kind === "BoundedContext") openContext(id);
      else if (kind === "Process") openProcess(id);
      else if (kind === "ADR") {
        navigate({ ...state, adr: id, detail: null, selected: id }, { animate: false });
        $("detail-panel").scrollIntoView({ block: "start", behavior: "instant" });
      } else openElement(id);
      return;
    }
    const path = event.target.closest("[data-path]");
    if (path && Number(path.dataset.path) < levels.indexOf(state.level)) {
      navigate(
        restoreScope(
          Number(path.dataset.path) === 0
            ? { level: "contexts" }
            : { level: "containers", context: state.context },
        ),
      );
      return;
    }
    const relation = event.target.closest("[data-relation]");
    if (relation) {
      const edge = relations[Number(relation.dataset.relation)];
      openElement(edge.kind === "collaboration" ? edge.from : edge.policy);
      return;
    }
    const link = event.target.closest('a[href^="#"]');
    if (link) {
      const hash = link.getAttribute("href").slice(1),
        id = byAnchor.get(hash);
      if (id) {
        event.preventDefault();
        openElement(id);
      } else if (["errors", "changes"].includes(hash)) {
        event.preventDefault();
        showPanel("diagnostics-panel");
      } else if (hash === "all") {
        event.preventDefault();
        navigate(restoreScope({ level: "contexts" }));
      }
    }
  });

  const showPanel = (id) => {
    $(id).hidden = !$(id).hidden;
    if (!$(id).hidden) $(id).scrollIntoView({ block: "start", behavior: "instant" });
  };
  $("go-up").addEventListener("click", up);
  $("detail-close").addEventListener("click", () =>
    navigate({ ...state, adr: null, detail: null }, { animate: false }),
  );
  $("workflow-close").addEventListener("click", () => {
    state.workflow = false;
    renderWorkflow();
    remember();
  });
  $("help-toggle").addEventListener("click", () => showPanel("help-panel"));
  $("diagnostics-toggle").addEventListener("click", () => showPanel("diagnostics-panel"));
  const changeSearch = () => {
    state.query = $("layer-search").value;
    state.searchScope = $("search-scope").value;
    state.domain = $("domain-filter").value;
    state.page = 0;
    state.camera.fitted = false;
    renderNodes();
    remember();
  };
  $("layer-search").addEventListener("input", changeSearch);
  $("search-scope").addEventListener("change", changeSearch);
  $("domain-filter").addEventListener("change", () => {
    changeSearch();
    renderSummary();
  });
  $("layer-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.querySelector("[data-layer-node]")?.click();
  });
  for (const [id, delta] of [
    ["page-previous", -1],
    ["page-next", 1],
  ])
    $(id).addEventListener("click", () => {
      state.page += delta;
      state.camera.fitted = false;
      renderNodes();
      remember();
    });
  for (const toggle of document.querySelectorAll("button[data-view]"))
    toggle.addEventListener("click", () => {
      mode = toggle.dataset.view;
      if (mode === "events") gesture = "pan";
      transition?.cancel();
      transition = null;
      renderNavigation();
      renderNodes();
      $("city-tooltip").hidden = true;
      refreshMotion();
      document
        .querySelector('[data-camera="pan"]')
        .setAttribute("aria-pressed", String(gesture === "pan"));
      document
        .querySelector('[data-camera="rotate"]')
        .setAttribute("aria-pressed", String(gesture === "rotate"));
    });

  function zoom(factor) {
    state.camera.zoom = Math.min(1.65, Math.max(0.4, state.camera.zoom * factor));
    paintCamera();
    remember();
  }
  for (const control of document.querySelectorAll("[data-camera]"))
    control.addEventListener("click", () => {
      const key = control.dataset.camera;
      if (key === "pan" || key === "rotate") {
        gesture = key;
        for (const item of document.querySelectorAll('[data-camera="pan"],[data-camera="rotate"]'))
          item.setAttribute("aria-pressed", String(item.dataset.camera === gesture));
      } else if (key === "reset") {
        fitCamera();
        paintCamera();
        remember();
      } else zoom(key === "in" ? 1.15 : 1 / 1.15);
    });
  $("motion-toggle").addEventListener("click", () => {
    effects = !effects;
    refreshMotion();
    $("workflow-frame-host")
      .querySelector("iframe")
      ?.contentWindow.postMessage(
        {
          type: "ontology-effects",
          enabled: effects && !reduced.matches,
          reason: reduced.matches ? "reduced" : "paused",
        },
        "*",
      );
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) effects = false;
    refreshMotion();
  });
  document.addEventListener("visibilitychange", () => {
    refreshMotion();
    paintCamera();
  });

  $("city-labels").addEventListener("change", () => {
    city?.visibility({ labels: $("city-labels").value, links: cityLinks });
    paintCamera();
  });
  $("city-links").addEventListener("click", () => {
    cityLinks = !cityLinks;
    $("city-links").setAttribute("aria-pressed", String(cityLinks));
    city?.visibility({ labels: $("city-labels").value, links: cityLinks });
    paintCamera();
  });

  const viewport = $("layer-viewport");
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    suppressClick = false;
    if (mode === "structure" && city && event.target.closest("#layer-nodes")) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: clone(state.camera),
      moved: false,
    };
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag && mode === "structure" && city) {
      const rect = $("layer-city").getBoundingClientRect();
      const id =
        event.target.closest("[data-layer-node]")?.dataset.layerNode ??
        city.pick(
          ((event.clientX - rect.left) * $("layer-city").clientWidth) / rect.width,
          ((event.clientY - rect.top) * $("layer-city").clientHeight) / rect.height,
        );
      city.hover(id);
      cityHint(id);
    }
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.x,
      y = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(x, y) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("dragging");
    }
    if (gesture === "rotate" && mode === "structure") {
      state.camera.yaw = drag.camera.yaw + x * 0.18;
      state.camera.pitch = Math.min(65, Math.max(10, drag.camera.pitch - y * 0.15));
    } else {
      state.camera.x = drag.camera.x + x;
      state.camera.y = drag.camera.y + y;
    }
    paintCamera();
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    drag = null;
    viewport.classList.remove("dragging");
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    remember();
  }
  viewport.addEventListener("pointerup", finishDrag);
  viewport.addEventListener("pointercancel", finishDrag);
  viewport.addEventListener("pointerleave", () => {
    city?.hover(null);
    cityHint(null);
  });
  viewport.addEventListener(
    "click",
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    },
    true,
  );
  $("layer-city").addEventListener("click", (event) => {
    if (!city || mode !== "structure") return;
    const rect = $("layer-city").getBoundingClientRect();
    const id = city.pick(
      ((event.clientX - rect.left) * $("layer-city").clientWidth) / rect.width,
      ((event.clientY - rect.top) * $("layer-city").clientHeight) / rect.height,
    );
    if (id)
      [...$("layer-nodes").querySelectorAll("[data-layer-node]")]
        .find((node) => node.dataset.layerNode === id)
        ?.click();
  });
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (mode === "structure" && city && event.target.closest("#layer-nodes")) return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.06 : 1 / 1.06);
    },
    { passive: false },
  );
  viewport.addEventListener("keydown", (event) => {
    const steps = {
      ArrowLeft: [35, 0],
      ArrowRight: [-35, 0],
      ArrowUp: [0, 35],
      ArrowDown: [0, -35],
    };
    if (steps[event.key]) {
      event.preventDefault();
      if (gesture === "rotate" && mode === "structure") {
        state.camera.yaw -= Math.sign(steps[event.key][0]) * 6;
        state.camera.pitch = Math.min(
          65,
          Math.max(10, state.camera.pitch + Math.sign(steps[event.key][1]) * 5),
        );
      } else {
        state.camera.x += steps[event.key][0];
        state.camera.y += steps[event.key][1];
      }
      paintCamera();
      remember();
    }
    if (["+", "=", "-", "Home"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") {
        fitCamera();
        paintCamera();
        remember();
      } else zoom(event.key === "-" ? 1 / 1.15 : 1.15);
    }
  });
  viewport.addEventListener("focusin", (event) => {
    const node = event.target.closest("[data-layer-node]");
    if (!node) return;
    // Native focus may scroll overflow:hidden content before focusin. Keep
    // movement in the shared camera so labels and canvas geometry stay aligned.
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    if (mode === "structure") {
      city?.focus(node.dataset.layerNode);
      cityHint(node.dataset.layerNode);
      if (city) {
        const item = city.snapshot().drawn.find((item) => item.id === node.dataset.layerNode);
        if (item && !item.onScreen) {
          state.camera.x += $("layer-city").clientWidth / 2 - item.roof[0];
          state.camera.y += $("layer-city").clientHeight / 2 - item.roof[1];
          paintCamera();
          remember();
        }
        return;
      }
    }
    const a = node.getBoundingClientRect(),
      b = viewport.getBoundingClientRect();
    if (a.left < b.left || a.right > b.right || a.top < b.top || a.bottom > b.bottom) {
      state.camera.x += b.left + b.width / 2 - (a.left + a.width / 2);
      state.camera.y += b.top + b.height / 2 - (a.top + a.height / 2);
      paintCamera();
      remember();
    }
  });
  viewport.addEventListener("focusout", (event) => {
    if (!viewport.contains(event.relatedTarget)) {
      city?.focus(null);
      cityHint(null);
    }
  });
  window.addEventListener("resize", () => {
    state.camera.fitted = false;
    renderNodes();
  });
  window.addEventListener("message", (event) => {
    const frame = $("workflow-frame-host").querySelector("iframe");
    if (
      frame &&
      event.source === frame.contentWindow &&
      event.data?.type === "ontology-detail" &&
      hasElement(event.data.id)
    )
      openElement(event.data.id);
  });
  document.addEventListener("report-diagram-rendered", (event) => {
    const figure = event.target;
    if (!$("detail-body").contains(figure)) return;
    const targets = JSON.parse(figure.dataset.targets ?? "{}");
    for (const node of figure.querySelectorAll("g.node")) {
      const key = /flowchart-(n\d+)-/.exec(node.id)?.[1],
        id = byAnchor.get(targets[key]);
      if (!id) continue;
      node.setAttribute("role", "link");
      node.setAttribute("tabindex", "0");
      node.addEventListener("click", () => openElement(id));
      node.addEventListener("keydown", (event) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          openElement(id);
        }
      });
    }
  });

  window.addEventListener("popstate", (event) => {
    remember();
    const remembered = historyEntries.get(event.state?.ontologyLayered);
    historyId = event.state?.ontologyLayered ?? ++serial;
    state = clone(remembered ?? parseAddress());
    render();
    window.scrollTo({ top: state.scroll, behavior: "instant" });
  });
  window.addEventListener("hashchange", () => {
    if (address(state) === location.hash) return;
    state = parseAddress();
    historyId = ++serial;
    history.replaceState({ ontologyLayered: historyId }, "", address(state));
    render();
  });

  $("domain-filter").innerHTML =
    `<option value="">${t("모든 서브도메인", "All subdomains")}</option>${data.domains.map((domain) => `<option value="${esc(domain.id)}">${esc(domain.name)}</option>`).join("")}`;
  $("source-summary").innerHTML =
    `<strong>${data.contexts.length}</strong> ${t("BC", "BCs")} · <strong>${data.containers.length}</strong> ${t("업무 프로세스", "business processes")}<br>${data.errors.length ? `${data.errors.length} ${t("검증 오류 · 확인 필요", "validation issues need checking")}` : t("모델의 업무 근거를 탐색합니다.", "Explore the model's business evidence.")}<br>${data.changeSummary.changed ? t("동기화 전 변경 있음", "Unsynced changes") : data.changeSummary.unverified ? t("변경 이력 미확인", "Change history unverified") : sourceKindLabel()}`;
  function sourceKindLabel() {
    return data.sourceKind === "draft"
      ? t("작성 중 초안 · 저장 승인 전", "Working draft · not adopted")
      : t("생성 시점의 원본", "Sources at generation time");
  }
  const diagnostics = [...source.children].filter((node) => node.matches(".errors,.changes"));
  $("diagnostics-panel").innerHTML =
    `<h3>${t("검증·변경 정보", "Validation and changes")}</h3><p>${sourceKindLabel()}</p>${data.sourceKind === "draft" ? `<p>${t("초안의 변경을 저장 모델의 커밋 이력으로 판정하지 않습니다.", "Draft edits are not judged as the saved model's commit history.")}</p>` : ""}`;
  for (const original of diagnostics) $("diagnostics-panel").append(safeClone(original));
  if (!diagnostics.length)
    $("diagnostics-panel").insertAdjacentHTML(
      "beforeend",
      `<p>${t("표시할 검증 오류·변경 표시가 없습니다. 업무 완전성이나 실행 성공을 뜻하지 않습니다.", "No validation errors or change flags to display. This does not establish business completeness or execution success.")}</p>`,
    );
  if (sources.has("workflow-readiness"))
    $("readiness-guide").append(safeClone(sources.get("workflow-readiness")));
  state = parseAddress();
  historyId = ++serial;
  history.replaceState({ ontologyLayered: historyId }, "", address(state));
  render();
  remember();
  window.addEventListener("load", () => {
    if (state.adr || state.detail)
      $("detail-panel").scrollIntoView({ block: "start", behavior: "instant" });
  });
  // Read-only introspection supports embedding and diagnostics without a second state owner.
  window.ontologyLayered = Object.freeze({
    state: () => ({ ...clone(state), mode, effects, reducedMotion: reduced.matches }),
    visible: () => currentNodes.map((node) => node.id),
    relations: () => clone(relations),
    city: () => city?.snapshot() ?? null,
  });
})();
