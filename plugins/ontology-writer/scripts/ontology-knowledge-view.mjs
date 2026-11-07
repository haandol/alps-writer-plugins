// The authored BC layer and the membership index for the offline knowledge UI.
// Internal rows come from the same scoped projection as the command-line query.
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ATTRIBUTES,
  CLASSES,
  RDFS,
  contextCollaborations,
  elementId,
  elementIri,
  processOfStep,
} from "./ontology-lib.mjs";
import { projectNavigation } from "./ontology-navigation.mjs";
import { ontologySearchUnit } from "./ontology-search.mjs";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const words = {
  ko: {
    title: "업무 지식 탐색",
    home: "BC 전체",
    whole: "전체 흐름·구조",
    back: "상위로",
    space: "3D 조망",
    list: "목록 보기",
    spaceHome: "BC 전체 조망",
    spaceBC: "BC 내부 지식",
    spaceDetail: "업무 상세",
    spaceHomeHint: "BC를 선택하면 내부 지식으로 확대합니다.",
    spaceBCHint: "현재 검색 페이지의 업무입니다. 항목을 선택하면 상세로 내려갑니다.",
    spaceHint: "드래그로 이동 · 회전 모드로 시점 변경 · 스크롤로 확대",
    spaceNote: "공간 배치는 업무의 순서·중요도를 뜻하지 않습니다.",
    pan: "이동",
    rotate: "회전",
    zoomIn: "확대",
    zoomOut: "축소",
    resetView: "시점 초기화",
    motionOn: "전환 효과 켜짐",
    motionOff: "전환 효과 꺼짐",
    reducedMotion: "동작 줄이기 적용",
    headline: "업무의 큰 그림",
    intro: "책임과 핵심 업무를 확인하고, 필요한 BC의 내부 지식으로 내려갑니다.",
    findContext: "업무로 BC 찾기",
    contextPlaceholder: "BC 이름, 책임, 업무 키워드",
    responsibility: "책임",
    core: "핵심 업무",
    missing: "핵심 업무가 아직 기록되지 않았습니다.",
    missingDefinition: "책임 정의가 기록되지 않았습니다.",
    open: "내부 업무 보기",
    collaboration: "BC 간 협업",
    collaborationHint: "선은 기록된 협업입니다. 사건의 방향과 순서는 BC 내부에서 확인합니다.",
    noCollaboration: "기록된 BC 협업이 없습니다.",
    incomplete: "지식 보완 필요",
    readonly: "읽기 전용",
    findInside: "이 BC의 업무 검색",
    insidePlaceholder: "이름, 식별자, 업무 문구",
    kind: "항목 종류",
    all: "모든 종류",
    source: "BC 원문 정보",
    previous: "이전",
    next: "다음",
    close: "상세 닫기",
    choose: "업무 항목을 선택하세요",
    chooseHint: "사실·관계·미정 범위와 실현 ADR을 여기에서 확인합니다.",
    internal: "내부 업무",
    neighbors: "연결된 BC",
    shared: "공유 항목",
    external: "다른 BC의 항목",
    unknownOwner: "컨텍스트 소속 미확인",
    noContext: "아직 BC 지식이 없습니다.",
    noMatches: "일치하는 항목이 없습니다. 검색어를 바꾸거나 연결된 BC를 확인하세요.",
    invalidSearch: "검색 문구가 올바르지 않습니다. 비어 있거나 닫히지 않은 따옴표를 확인하세요.",
    matchedFields: "일치한 필드",
    emptyScope: "이 BC의 내부 업무 지식은 아직 기록되지 않았습니다.",
    modelIssues: "모델 검증 오류",
    changed: "변경 확인 필요",
    unknown: "이력 확인 필요",
    diagnostics: "검증·변경 상세",
    draw: "프로세스 그림 열기",
    drawing: "그림을 준비하고 있습니다…",
    noScript: "내부 검색과 탐색에는 JavaScript가 필요합니다.",
    scopeNote:
      "현재 BC의 내부와 연결된 공유 지식입니다. 검색 결과나 구현 표시는 업무 전체의 검증 완료를 뜻하지 않습니다.",
  },
  en: {
    title: "Business knowledge",
    home: "All BCs",
    whole: "Whole flow & structure",
    back: "Up a level",
    space: "3D view",
    list: "List view",
    spaceHome: "All bounded contexts",
    spaceBC: "Inside this BC",
    spaceDetail: "Business detail",
    spaceHomeHint: "Select a BC to zoom into its knowledge.",
    spaceBCHint: "Work on the current search page. Select an element to inspect it.",
    spaceHint: "Drag to move · switch to rotate · scroll to zoom",
    spaceNote: "Spatial placement does not represent business order or importance.",
    pan: "Move",
    rotate: "Rotate",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetView: "Reset view",
    motionOn: "Transitions on",
    motionOff: "Transitions off",
    reducedMotion: "Reduced motion",
    headline: "The business at a glance",
    intro: "Read responsibilities and core logic, then open the bounded context you need.",
    findContext: "Find a BC by its work",
    contextPlaceholder: "BC name, responsibility or business keyword",
    responsibility: "Responsibility",
    core: "Core business logic",
    missing: "Core business logic has not been recorded.",
    missingDefinition: "The responsibility has not been recorded.",
    open: "Explore internal work",
    collaboration: "BC collaborations",
    collaborationHint:
      "Lines are recorded collaborations. Inspect internal work for event direction and sequence.",
    noCollaboration: "No BC collaboration is recorded.",
    incomplete: "Knowledge incomplete",
    readonly: "Read only",
    findInside: "Search this BC",
    insidePlaceholder: "Name, identifier or business wording",
    kind: "Element type",
    all: "All types",
    source: "BC source details",
    previous: "Previous",
    next: "Next",
    close: "Close detail",
    choose: "Select a business element",
    chooseHint: "Inspect facts, relations, open scope and realizing ADRs here.",
    internal: "Internal work",
    neighbors: "Connected BCs",
    shared: "Shared element",
    external: "Element of another BC",
    unknownOwner: "Context membership unconfirmed",
    noContext: "No BC knowledge is recorded yet.",
    noMatches: "No matching element. Try another term or inspect a connected BC.",
    invalidSearch: "Check for empty or unclosed quotation marks in the search text.",
    matchedFields: "Matched fields",
    emptyScope: "No internal business knowledge has been recorded for this BC yet.",
    modelIssues: "Model validation errors",
    changed: "Changes need checking",
    unknown: "History unverified",
    diagnostics: "Validation & changes",
    draw: "Draw the process",
    drawing: "Drawing…",
    noScript: "Internal search and navigation require JavaScript.",
    scopeNote:
      "This BC's internal work and connected shared knowledge. Search results and implementation labels do not establish whole-business verification.",
  },
};

/** Build projections without adding business facts or treating shared work as one BC's property. */
export function knowledgeViewData({
  index,
  mapping,
  findings,
  includeRetired,
  lang,
  elements,
  displayErrors,
  changeSummary,
  flowOrders,
  stateLabels,
}) {
  const t = words[lang] ?? words.en;
  const known = new Set(elements.map((e) => e.k));
  const scopes = Object.create(null);
  const memberships = new Map();
  const contexts = index
    .ofType("BoundedContext")
    .filter((c) => known.has(elementId(c)))
    .map((iri) => {
      const id = elementId(iri);
      const projection = projectNavigation(index, {
        target: { kind: "context", id },
        includeRetired,
      });
      const members = projection.items
        .filter((r) => r.kind === "element" && known.has(r.id))
        .map((r) => r.id);
      for (const key of members) {
        if (!memberships.has(key)) memberships.set(key, []);
        memberships.get(key).push(id);
      }
      scopes[id] = {
        members,
        neighbors: projection.items.filter((r) => r.kind === "neighbor").map((r) => r.id),
        issues: projection.layerFindings ?? [],
      };
      return {
        id,
        name: index.literal(iri, `${RDFS}label`)[0]?.value ?? id,
        definition: index.literal(iri, "definition")[0]?.value ?? null,
        coreLogic: index.literal(iri, "coreLogic")[0]?.value ?? null,
        complete: projection.knowledgeLayerComplete,
      };
    });
  const contextIds = new Set(contexts.map((c) => c.id));
  const sequence = new Map(
    flowOrders.map((flow) => [flow.id, new Map(flow.steps.map((key, i) => [key, i]))]),
  );
  const records = Object.fromEntries(
    elements.map((element) => {
      const iri = element.k.includes(":") ? element.k : elementIri(element.k);
      const explicit = index
        .out(iri, "inContext")
        .map(elementId)
        .filter((id) => contextIds.has(id));
      const owners =
        element.t === "BoundedContext"
          ? [element.k]
          : explicit.length
            ? explicit
            : (memberships.get(element.k) ?? []);
      const search = [
        element.k,
        ...ATTRIBUTES.filter((a) => a.kind === "fact" && a.on.includes(element.t)).flatMap((a) =>
          index.literal(iri, a.iri).map((v) => v.value),
        ),
      ];
      const adrs = [];
      if (element.t === "Step") {
        for (const [category, entry] of Object.entries(mapping?.categories ?? {})) {
          if (!Array.isArray(entry?.realizes) || !entry.realizes.includes(element.k)) continue;
          const untrusted = findings.some(
            (f) =>
              f.level === "error" &&
              (f.category === category ||
                f.code === "ontology-index-unreadable" ||
                f.code === "ontology-link-shape"),
          );
          for (const a of Array.isArray(entry.adrs) ? entry.adrs : []) {
            if (typeof a?.path !== "string") continue;
            adrs.push({
              path: a.path,
              status: a.status ?? null,
              url: untrusted ? null : pathToFileURL(path.resolve(a.path)).href,
            });
          }
        }
      }
      const process = element.t === "Step" ? processOfStep(index, iri) : null;
      const processKey = process ? elementId(process) : null;
      return [
        element.k,
        {
          ...element,
          contexts: owners,
          shared: !explicit.length && owners.length > 1,
          search,
          searchUnit: ontologySearchUnit(index, iri),
          adrs,
          ...(processKey
            ? { process: processKey, order: sequence.get(processKey)?.get(element.k) }
            : {}),
        },
      ];
    }),
  );
  return {
    text: t,
    types: CLASSES.map((c) => [c.key, lang === "ko" ? c.ko : c.key]),
    contexts,
    scopes,
    elements: records,
    collaborations: contextCollaborations(index)
      .map((pair) => pair.map(elementId))
      .filter((pair) => pair.every((id) => contextIds.has(id))),
    errors: displayErrors,
    changeSummary,
    stateLabels,
    searchFieldLabels: {
      ...Object.fromEntries(
        ATTRIBUTES.filter((field) => field.key).map((field) => [
          field.key,
          lang === "ko" ? field.ko : field.key,
        ]),
      ),
      identifier: lang === "ko" ? "식별자" : "Identifier",
      title: lang === "ko" ? "이름" : "Name",
    },
  };
}

function contextMap(data) {
  const { contexts, collaborations, text: t } = data;
  if (!contexts.length || !collaborations.length)
    return `<p class="kw-muted">${esc(t.noCollaboration)}</p>`;
  const columns = Math.min(3, contexts.length),
    width = columns * 256 + 24,
    rows = Math.ceil(contexts.length / columns),
    height = rows * 132 + 24;
  const positions = new Map(
    contexts.map((c, i) => [
      c.id,
      { x: 24 + (i % columns) * 256, y: 24 + Math.floor(i / columns) * 132 },
    ]),
  );
  const lines = collaborations
    .map(([a, b]) => {
      const p = positions.get(a),
        q = positions.get(b);
      return `<line x1="${p.x + 104}" y1="${p.y + 40}" x2="${q.x + 104}" y2="${q.y + 40}" />`;
    })
    .join("");
  const nodes = contexts
    .map((c) => {
      const p = positions.get(c.id);
      return `<foreignObject x="${p.x}" y="${p.y}" width="208" height="82"><div xmlns="http://www.w3.org/1999/xhtml"><button type="button" class="kw-map-node" data-knowledge-context="${esc(c.id)}" aria-label="${esc(c.name)} · ${esc(c.id)}"><strong>${esc(c.name)}</strong><span>${esc(c.id)}</span></button></div></foreignObject>`;
    })
    .join("");
  return `<div class="kw-map-viewport" tabindex="0" role="region" aria-label="${esc(t.collaboration)}"><svg class="kw-map" style="--map-width:${width}px" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(t.collaboration)}"><g class="kw-map-links">${lines}</g>${nodes}</svg></div>`;
}

function spaceShell(t) {
  return `<section id="kw-space" class="ks-space" hidden aria-label="${esc(t.space)}">
<div class="ks-heading"><span class="ks-level" id="ks-level">${esc(t.home)}</span><h2 id="ks-title">${esc(t.spaceHome)}</h2><p id="ks-description">${esc(t.spaceHomeHint)}</p></div>
<div id="ks-viewport" class="ks-viewport" tabindex="0" role="region" aria-label="${esc(t.spaceHint)}"><div id="ks-world" class="ks-world"></div></div>
<div class="ks-navigation" role="group" aria-label="${esc(t.space)}"><button type="button" data-space-action="pan" aria-pressed="true">${esc(t.pan)}</button><button type="button" data-space-action="rotate" aria-pressed="false">${esc(t.rotate)}</button><span></span><button type="button" data-space-action="out" aria-label="${esc(t.zoomOut)}">−</button><button type="button" data-space-action="in" aria-label="${esc(t.zoomIn)}">+</button><button type="button" data-space-action="reset">${esc(t.resetView)}</button><button type="button" id="ks-motion">${esc(t.motionOn)}</button></div>
<div class="ks-caption"><p>${esc(t.spaceHint)}</p><p>${esc(t.spaceNote)}</p></div></section>`;
}

/** The first paint contains authored BC knowledge only; detail panels start empty. */
export function renderKnowledgeShell(data) {
  const t = data.text;
  const byId = new Map(data.contexts.map((c) => [c.id, c]));
  const cards = data.contexts
    .map(
      (c) => `<article class="kw-bc-card" data-knowledge-card="${esc(c.id)}">
<div class="kw-card-heading"><span class="kw-eyebrow">Bounded context</span><code>${esc(c.id)}</code></div>
<h3>${esc(c.name)}</h3><p class="kw-responsibility">${esc(c.definition ?? t.missingDefinition)}</p>
<div class="kw-core"><span>${esc(t.core)}</span><p>${esc(c.coreLogic ?? t.missing)}</p></div>
<div class="kw-card-bottom">${!c.complete ? `<span class="kw-warning">${esc(t.incomplete)}</span>` : ""}<button type="button" class="kw-open" data-knowledge-context="${esc(c.id)}" aria-label="${esc(c.name)} (${esc(c.id)}) · ${esc(t.open)}">${esc(t.open)} <span aria-hidden="true">→</span></button></div></article>`,
    )
    .join("");
  const collaborations = data.collaborations
    .map(
      ([a, b]) =>
        `<li><button type="button" data-knowledge-context="${esc(a)}">${esc(byId.get(a).name)}</button><span class="kw-connection" aria-hidden="true"></span><button type="button" data-knowledge-context="${esc(b)}">${esc(byId.get(b).name)}</button></li>`,
    )
    .join("");
  return `<header class="kw-bar"><div class="kw-brand"><span class="kw-logo" aria-hidden="true">◇</span><h1>${esc(t.title)}</h1><span class="kw-readonly">${esc(t.readonly)}</span></div>
<nav class="kw-breadcrumb" aria-label="${esc(t.title)}"><button type="button" id="kw-home">${esc(t.home)}</button><span id="kw-crumb" aria-live="polite"></span></nav>
<div class="kw-actions"><button type="button" id="kw-up" hidden>${esc(t.back)}</button><button type="button" id="kw-presentation" hidden>${esc(t.list)}</button><button type="button" id="kw-show-whole">${esc(t.whole)}</button></div></header>
<main id="knowledge-workspace" class="kw-main">
${spaceShell(t)}
<section id="kw-home-panel" class="kw-home"><div class="kw-introduction"><div><p class="kw-eyebrow">${esc(t.home)}</p><h2 id="kw-home-title" tabindex="-1">${esc(t.headline)}</h2><p>${esc(t.intro)}</p></div><p class="kw-count">${data.contexts.length} BC</p></div>
<div id="kw-global-notice" class="kw-notice" hidden></div>
<section class="kw-connections"><div><h3>${esc(t.collaboration)}</h3><p>${esc(t.collaborationHint)}</p></div>${contextMap(data)}<ul class="kw-collaborations">${collaborations}</ul></section>
<div class="kw-search"><label for="kw-context-search">${esc(t.findContext)}</label><input id="kw-context-search" type="search" placeholder="${esc(t.contextPlaceholder)}" autocomplete="off" aria-controls="kw-contexts"><p id="kw-context-status" aria-live="polite"></p></div>
<div id="kw-contexts" class="kw-contexts">${cards || `<p class="kw-empty">${esc(t.noContext)}</p>`}</div><noscript>${esc(t.noScript)}</noscript></section>
<section id="kw-bc-panel" class="kw-bc" hidden><div class="kw-bc-heading"><div><div class="kw-source-line"><p class="kw-eyebrow" id="kw-bc-id"></p><button type="button" id="kw-bc-source">${esc(t.source)}</button></div><h2 id="kw-bc-title" tabindex="-1"></h2><p id="kw-bc-definition"></p></div><div class="kw-bc-core"><span>${esc(t.core)}</span><p id="kw-bc-core"></p></div></div>
<div id="kw-bc-notice" class="kw-notice" hidden></div><div class="kw-neighbors"><span>${esc(t.neighbors)}</span><div id="kw-neighbors"></div></div>
<div class="kw-bc-layout"><section class="kw-list-pane"><div class="kw-filters"><div><label for="kw-search">${esc(t.findInside)}</label><input id="kw-search" type="search" placeholder="${esc(t.insidePlaceholder)}" autocomplete="off" aria-controls="kw-results"></div><div><label for="kw-type">${esc(t.kind)}</label><select id="kw-type"><option value="">${esc(t.all)}</option>${data.types
    .filter(([type]) => type !== "BoundedContext")
    .map(([type, label]) => `<option value="${type}">${esc(label)}</option>`)
    .join("")}</select></div></div>
<p class="kw-list-status" id="kw-list-status" aria-live="polite"></p><ul id="kw-results" class="kw-results"></ul><div class="kw-pager"><button type="button" id="kw-prev">${esc(t.previous)}</button><span id="kw-page"></span><button type="button" id="kw-next">${esc(t.next)}</button></div><p class="kw-scope-note">${esc(t.scopeNote)}</p></section>
<section class="kw-detail-pane"><div class="kw-detail-toolbar"><p id="kw-detail-context"></p><button type="button" id="kw-close-detail" hidden>${esc(t.close)}</button></div><div id="kw-detail" class="kw-detail"><div class="kw-empty"><h3>${esc(t.choose)}</h3><p>${esc(t.chooseHint)}</p></div></div></section></div></section></main>`;
}
