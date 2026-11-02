// process-model-view.mjs — read-only standalone HTML view of the business
// process model: the business landscape, each process flow, and element
// details with realization status computed from the ADR index at generation
// time, beside an explorer that finds every element by bounded context and a
// 3D business city of the landscape. Flows and landscape connections are drawn
// from the business-context query, so the picture and `query` read the model
// the same way; the page has no editing or saving behavior.

import { readFileSync } from "node:fs";
import {
  ATTRIBUTES,
  CLASSES,
  RDF,
  RDFS,
  RELATIONS,
  elementId,
  elementIri,
  flowCrossesProcesses,
  inRetiredOnly,
  isRetired,
  isSystemStep,
  isValidElementId,
  openScopeOf,
  processStatus,
  ruleReach,
} from "./process-model-lib.mjs";
import {
  implementationState,
  inFlowOrder,
  queryContext,
  realizationKnown,
  realizersByStep,
  untrustedRealization,
} from "./process-model-query.mjs";
import {
  mermaidRuntime,
  parseMermaidAll,
  renderMermaid,
} from "../skills/report-writer/scripts/mermaid.mjs";

const UI = {
  en: {
    title: "Business process model",
    intro:
      "Read-only view of docs/process and the ADR index. To change the model, ask for the change in natural language or edit the Turtle document shown with each element.",
    landscape: "Business landscape",
    processes: "Processes",
    contexts: "Bounded contexts",
    connections: "Connections between processes",
    noConnections: "No event or policy connects two processes.",
    elements: "Elements",
    flow: "Process flow",
    steps: "Steps",
    facts: "Business facts",
    descriptions: "Descriptions (not used to decide anything)",
    lifecycle: "Lifecycle",
    relations: "Relations",
    rules: "Related business rules",
    realization: "Realization",
    document: "Model document",
    id: "Identifier",
    implemented: "implemented",
    notImplemented: "not implemented",
    unrealized: "no realizing feature",
    unknown: "cannot be determined until the ADR index error is fixed",
    outside: "outside the system — not realized by a feature",
    retired: "retired",
    errors: "Validation errors",
    errorsIntro: "The marked parts are not complete; fix these positions first.",
    unparsed: "The model could not be parsed, so nothing is drawn.",
    incomplete: "Incomplete: validation errors affect this process.",
    landscapeIncomplete:
      "Incomplete: validation errors affect the marked processes, events, policies and connections.",
    lost: "Connections that cannot be placed because a step does not belong to exactly one process",
    noSingleProcess: "does not belong to exactly one process",
    errorMark: "error",
    incompleteMark: "incomplete",
    missing: "not in the model",
    mistyped: "wrong element type",
    badIri: "invalid identifier",
    hiddenRetired: "in a retired process hidden by this view; include retired processes to see it",
    changes: "Unsynced model edits",
    uncommitted: "Uncommitted edits in the working tree",
    unsynced: "Committed direct edits of an Accepted process not yet synced",
    removed: "removed since the last commit",
    removedSinceAccepted: "removed since it may have last become Accepted",
    hiddenChanges: "{n} more in retired processes hidden by this view",
    changesUnavailable: "Change flags unavailable",
    changesUnavailableIntro:
      "Uncommitted model edits and unsynced edits of Accepted processes could not be determined, so none are marked:",
    committedUnavailable: "Committed-edit flags unavailable",
    committedUnavailableIntro:
      "Edits of Accepted processes since they became Accepted could not be determined; treat those processes as possibly edited directly:",
    lifecycleEdit: "Lifecycle edit ADR Writer's transitions do not explain — not a settled Status",
    unknownEdits: "Edits since it became Accepted are unknown",
    unknownMark: "edits unknown",
    changedMark: "changed",
    none: "—",
    to: "to",
    from: "from",
    fallback: "Diagram not rendered",
    pending: "Diagram rendering pending. The source is below.",
    source: "Mermaid source",
    explorer: "Find elements",
    find: "Find an element",
    findHint: "Name or identifier",
    found: "{n} found",
    foundSome: "{n} found; the first {m} are listed",
    noneFound: "No element has that name or identifier.",
    types: "Element types",
    tree: "Elements by bounded context",
    noContext: "Not in a bounded context",
    short: {
      implemented: "implemented",
      notImplemented: "not implemented",
      unrealized: "no realizing feature",
      outside: "outside the system",
      unknown: "undeterminable",
    },
    city: "3D business city",
    cityLabel:
      "Business city: each bounded context is a district and each process a tower with one floor per step, from the bottom in flow order, lit by the step's realization. The same facts are in the lists, the landscape diagram and the details. With focus here, arrow keys turn the city and + and − zoom.",
    cityHint:
      "Drag to turn, scroll to zoom, Shift-drag to move. A roof opens its process flow; a floor, orb or diamond opens its details.",
    pause: "Pause motion",
    play: "Resume motion",
    reset: "Whole city",
    wide: "Fold the document away",
    layers: "Also show",
    legend: "Floor lights",
    handoff: "An event triggers a policy",
    noCanvas:
      "This browser cannot draw the 3D city. The same facts are in the lists and the landscape diagram.",
  },
  ko: {
    title: "업무 프로세스 모델",
    intro:
      "docs/process와 ADR 색인을 읽은 읽기 전용 화면입니다. 모델을 바꾸려면 자연어로 변경을 요청하거나 각 요소에 표시된 Turtle 문서를 직접 고치세요.",
    landscape: "전체 업무 전경",
    processes: "프로세스",
    contexts: "바운디드 컨텍스트",
    connections: "프로세스 사이 연결",
    noConnections: "두 프로세스를 잇는 사건이나 정책이 없습니다.",
    elements: "요소",
    flow: "프로세스 흐름",
    steps: "단계",
    facts: "업무 사실",
    descriptions: "설명 (판정에 쓰지 않음)",
    lifecycle: "생명주기",
    relations: "관계",
    rules: "관련 업무 규칙",
    realization: "실현 현황",
    document: "모델 문서",
    id: "식별자",
    implemented: "구현됨",
    notImplemented: "구현 전",
    unrealized: "실현 기능 없음",
    unknown: "ADR 색인 오류를 고치기 전에는 판정할 수 없음",
    outside: "시스템 밖 단계 — 실현 대상 아님",
    retired: "은퇴",
    errors: "검증 오류",
    errorsIntro: "표시한 부분은 완전하지 않습니다. 이 위치를 먼저 고치세요.",
    unparsed: "모델을 해석할 수 없어 그림을 그리지 않았습니다.",
    incomplete: "불완전: 이 프로세스에 검증 오류가 걸쳐 있습니다.",
    landscapeIncomplete: "불완전: 표시한 프로세스, 사건, 정책과 연결에 검증 오류가 걸쳐 있습니다.",
    lost: "단계가 정확히 한 프로세스에 속하지 않아 자리를 정할 수 없는 연결",
    noSingleProcess: "정확히 한 프로세스에 속하지 않음",
    errorMark: "오류",
    incompleteMark: "불완전",
    missing: "모델에 없음",
    mistyped: "요소 유형이 맞지 않음",
    badIri: "잘못된 식별자",
    hiddenRetired: "이 화면이 숨긴 은퇴 프로세스 안에 있습니다. 은퇴 프로세스를 포함하면 보입니다.",
    changes: "동기화되지 않은 모델 편집",
    uncommitted: "작업 트리의 커밋되지 않은 편집",
    unsynced: "동기화 전인 Accepted 프로세스의 커밋된 직접 편집",
    removed: "마지막 커밋 뒤 삭제됨",
    removedSinceAccepted: "마지막으로 Accepted가 되었을 수 있는 커밋 뒤 삭제됨",
    hiddenChanges: "이 화면이 숨긴 은퇴 프로세스에 {n}개 더 있음",
    changesUnavailable: "변경 표시를 확인할 수 없음",
    changesUnavailableIntro:
      "커밋되지 않은 모델 편집과 Accepted 프로세스의 동기화 전 편집을 확인하지 못해 아무것도 표시하지 않았습니다:",
    committedUnavailable: "커밋된 편집 표시를 확인할 수 없음",
    committedUnavailableIntro:
      "Accepted가 된 뒤의 편집을 확인하지 못했습니다. 그 프로세스는 직접 편집되었을 수 있는 것으로 다루세요:",
    lifecycleEdit: "ADR Writer 전이로 설명되지 않는 생명주기 편집 — 확정된 Status가 아님",
    unknownEdits: "Accepted가 된 뒤의 편집을 알 수 없음",
    unknownMark: "편집 확인 불가",
    changedMark: "변경",
    none: "—",
    to: "도착",
    from: "출발",
    fallback: "그림을 그리지 못함",
    pending: "그림을 그리는 중입니다. 원문은 아래에 있습니다.",
    source: "Mermaid 원문",
    explorer: "요소 찾기",
    find: "요소 찾기",
    findHint: "이름이나 식별자",
    found: "{n}개 찾음",
    foundSome: "{n}개 찾음, 앞의 {m}개를 보여줍니다",
    noneFound: "그 이름이나 식별자를 가진 요소가 없습니다.",
    types: "요소 유형",
    tree: "바운디드 컨텍스트별 요소",
    noContext: "컨텍스트에 속하지 않는 요소",
    short: {
      implemented: "구현됨",
      notImplemented: "구현 전",
      unrealized: "실현 기능 없음",
      outside: "시스템 밖",
      unknown: "판정 불가",
    },
    city: "3차원 업무 도시",
    cityLabel:
      "업무 도시: 바운디드 컨텍스트는 구역이고, 프로세스는 아래부터 흐름 순서로 단계를 한 층씩 쌓은 탑이며, 층의 불빛은 그 단계의 실현 현황입니다. 같은 사실은 목록, 전경 도면, 상세에도 있습니다. 여기에 초점이 있으면 화살표 키로 돌리고 +와 −로 확대합니다.",
    cityHint:
      "드래그로 돌리고 스크롤로 확대하며, Shift를 누른 채 드래그하면 옮깁니다. 지붕은 그 프로세스의 흐름을, 층과 구슬, 마름모는 그 상세를 엽니다.",
    pause: "움직임 멈추기",
    play: "움직임 다시 켜기",
    reset: "도시 전체 보기",
    wide: "문서 접고 도시 넓게 보기",
    layers: "함께 보기",
    legend: "층의 불빛",
    handoff: "사건이 정책을 촉발",
    noCanvas:
      "이 브라우저에서는 3차원 도시를 그릴 수 없습니다. 같은 사실은 목록과 전경 도면에 있습니다.",
  },
};

const RDF_TYPE = `${RDF}type`;
const LABEL = `${RDFS}label`;

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Element key: the identifier of a model IRI, otherwise the IRI. Findings name elements either way. */
const keyOf = (value) => elementId(value) ?? value;
/** Page anchor of an element key. Every character but letters, digits and "-" is escaped, so two keys never share an anchor. */
const anchor = (key) =>
  `el-${String(key).replace(/[^\p{L}\p{N}-]/gu, (c) => `_${c.codePointAt(0).toString(16)}_`)}`;
/** Mermaid labels: one line, quotes as entities, no markup. */
const label = (text) =>
  `"${String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/"/g, "#quot;")
    .replace(/[<>]/g, "")}"`;

/** Node shapes per drawn role, and the element type each role stands for. */
const SHAPES = {
  process: ["[", "]"],
  step: ["[", "]"],
  event: ["([", "])"],
  policy: ["{{", "}}"],
  actor: ["[/", "/]"],
};
const ROLE_TYPES = { step: "Step", event: "BusinessEvent", policy: "Policy", actor: "Actor" };
const CLASSDEFS = [
  "classDef process fill:#eef2ff,stroke:#4338ca,color:#1e1b4b",
  "classDef event fill:#fff7ed,stroke:#c2410c,color:#431407",
  "classDef policy fill:#f5f3ff,stroke:#7c3aed,color:#2e1065",
  "classDef actor fill:#fefce8,stroke:#a16207,color:#422006",
  "classDef implemented fill:#ecfdf5,stroke:#047857,color:#022c22",
  "classDef notImplemented fill:#fffbeb,stroke:#b45309,color:#451a03",
  "classDef unrealized fill:#fef2f2,stroke:#b91c1c,color:#450a0a",
  "classDef unknown fill:#fffbeb,stroke:#b45309,color:#451a03,stroke-dasharray:4 2",
  "classDef outside fill:#f8fafc,stroke:#64748b,color:#0f172a,stroke-dasharray:3 3",
  "classDef foreign fill:#ffffff,stroke:#94a3b8,color:#334155,stroke-dasharray:2 2",
  "classDef retired fill:#f3f4f6,stroke:#9ca3af,color:#6b7280,stroke-dasharray:4 3",
  "classDef invalid fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-dasharray:4 3",
  "classDef changed stroke-width:4px",
  "classDef uncertain stroke-width:4px,stroke-dasharray:6 3",
  "classDef broken stroke:#dc2626,stroke-width:3px",
];
const BROKEN_LINK = "stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 3";

/**
 * Realization of one step: `implemented` only when every
 * realizing feature has an Accepted ADR and no Proposed ADR; retired ADRs do
 * not count. While the index cannot be trusted for a system step — it cannot be
 * read, holds a link record that is not a list of step ids, or a realizing
 * feature's records disagree with its ADR files (a body Status that differs, a
 * listed file that is missing, an ADR file the index does not list, a record that
 * names no ADR file of the feature's folder) — its realization is `unknown`, never
 * stated (`untrustedRealization`).
 */
export function realizationOf(
  index,
  mapping,
  stepIri,
  realizers = realizersByStep(mapping),
  { untrusted = { unreadable: false, all: false, categories: new Set() } } = {},
) {
  const system = isSystemStep(index, stepIri);
  const found = realizers.get(elementId(stepIri)) ?? [];
  if (system && !realizationKnown(untrusted, found))
    return { system, state: "unknown", features: [] };
  const features = found.map((r) => ({
    ...r,
    implemented: implementationState(r.adrs).implemented,
  }));
  const state = !system
    ? "outside"
    : !features.length
      ? "unrealized"
      : features.every((f) => f.implemented)
        ? "implemented"
        : "notImplemented";
  return { system, state, features };
}

/**
 * Render the standalone view.
 *
 * @param {object} input
 * @param {object|null} input.index Indexed model, or null when a document failed to parse.
 * @param {object|null} input.mapping ADR index.
 * @param {object[]} input.findings Validation findings of the same reading.
 * @param {object|null} input.changes Change flags (uncommitted / unsynced Accepted edits).
 * @param {boolean} [input.includeRetired]
 * @param {"en"|"ko"} [input.lang]
 * @returns {string} HTML
 */
export function renderView({
  index,
  mapping,
  findings = [],
  changes = null,
  includeRetired = false,
  lang = "en",
}) {
  const t = UI[lang] ?? UI.en;
  const errors = findings.filter((f) => f.level === "error");
  const banner = (items) =>
    items.length
      ? `<section class="errors" id="errors" role="alert"><h2>${esc(t.errors)}</h2><p>${esc(t.errorsIntro)}</p><ul>${items.join("")}</ul></section>`
      : "";
  const errorText = (e, element = "") =>
    `<li><code>${esc(e.code)}</code> <code>${esc(e.where)}</code>${element} — ${esc(e.msg)}</li>`;
  if (!index) {
    const items = errors.map((e) =>
      errorText(e, e.element == null ? "" : ` <code>${esc(keyOf(e.element))}</code>`),
    );
    return page(t, lang, `${banner(items)}<p class="unparsed">${esc(t.unparsed)}</p>`, false);
  }

  const realizers = realizersByStep(mapping);
  const typeOf = (iri) => index.typeOf(iri);
  const text = (iri, attr) => index.literal(iri, attr)[0]?.value ?? null;
  const name = (iri) => text(iri, LABEL) ?? keyOf(iri);
  /** Model IRI of an element key; identifiers never contain ":", IRIs always do. */
  const iriOf = (key) => (key.includes(":") ? key : elementIri(key));
  const untrusted = untrustedRealization(findings);
  const stateOf = (stepIri) =>
    realizationOf(index, mapping, stepIri, realizers, { untrusted }).state;
  /** A realization label; an undeterminable one leads to the index error. */
  const stateText = (state) =>
    state === "unknown" ? `<a href="#errors">${esc(t.unknown)}</a>` : esc(t[state]);

  // Retired processes, their steps and their criteria are shown only on request.
  const retiredMember = (iri) => {
    const type = typeOf(iri);
    if (type === "Process") return isRetired(index, iri);
    if (type === "ObservationCriterion")
      return index.out(iri, "criterionOf").some((p) => isRetired(index, p));
    // A step of a retired process, or a policy that only starts such steps, as in queries.
    return inRetiredOnly(index, iri);
  };
  const shown = (iri) => Boolean(typeOf(iri)) && (includeRetired || !retiredMember(iri));
  const shownElements = [...index.subjects.keys()]
    .filter(shown)
    .sort(
      (a, b) =>
        CLASSES.findIndex((c) => c.key === typeOf(a)) -
          CLASSES.findIndex((c) => c.key === typeOf(b)) || byId(a, b),
    );
  const detailKeys = new Set(shownElements.map(keyOf));
  const hidden = (key) => Boolean(typeOf(iriOf(key))) && !shown(iriOf(key));
  const processes = index.ofType("Process").filter(shown);

  // Validation errors by the element they name. Index-link findings belong to the
  // category whose link is wrong, as in queries, so they mark no model element.
  const errorsOf = new Map();
  for (const f of errors) {
    if (f.element == null || f.code.startsWith("process-link-")) continue;
    const key = keyOf(f.element);
    errorsOf.set(key, [...(errorsOf.get(key) ?? []), f]);
  }

  const changedIds = new Set(
    changes?.available
      ? [
          ...changes.uncommitted,
          // An Accepted process with unsynced edits is marked with the elements they changed.
          ...changes.unsynced.keys(),
          ...[...changes.unsynced.values()].flatMap((s) => [...s]),
          ...changes.lifecycleEdits.keys(),
        ]
      : [],
  );
  // A process whose committed edits history cannot show is marked so, never as changed.
  const unknownIds = new Set(changes?.available ? changes.uncertain.keys() : []);
  const badge = (kind, word) => ` <span class="badge ${kind}">${esc(word)}</span>`;
  const linkKey = (key, text) =>
    key !== null && detailKeys.has(key)
      ? `<a href="#${anchor(key)}">${esc(text)}</a>`
      : `<code>${esc(text)}</code>`;
  const link = (iri) => linkKey(keyOf(iri), name(iri));
  const errorItem = (e) => {
    const key = e.element == null ? null : keyOf(e.element);
    if (key !== null && hidden(key))
      return `<li><code>${esc(e.code)}</code> <code>${esc(e.where)}</code> — ${esc(t.hiddenRetired)}</li>`;
    return errorText(e, key === null ? "" : ` ${linkKey(key, key)}`);
  };
  const statusBadge = (p) =>
    `${processStatus(index, p) ?? "?"}${isRetired(index, p) ? ` · ${t.retired}` : ""}`;
  /** Classes and label suffix of a drawn element for the marks `[applies, class, word]` that apply. */
  const marked = (base, marks) => {
    const on = marks.filter(([applies]) => applies);
    return {
      classes: [base, ...on.map(([, cls]) => cls)],
      suffix: on.map(([, , word]) => ` · ${word}`).join(""),
    };
  };
  // Processes carry the "edits unknown" mark where they are drawn; other elements never do.
  const decorate = (key, base, retired = false) =>
    marked(base, [
      [retired, "retired", t.retired],
      [changedIds.has(key), "changed", t.changedMark],
      [errorsOf.has(key), "broken", t.errorMark],
    ]);

  // Mermaid node ids are shared by every diagram on the page.
  const ids = new Map();
  const nodeId = (key) => {
    if (!ids.has(key)) ids.set(key, `n${ids.size + 1}`);
    return ids.get(key);
  };
  const unnamed = new Map();
  /**
   * One flowchart. Every node is declared before an edge uses it; the findings
   * on drawn nodes are collected so the figure can say it is incomplete, and
   * links that touch an invalid reference or cannot be placed are styled as
   * broken.
   */
  const diagram = () => {
    const lines = ["flowchart LR"];
    const classLines = [];
    const declared = new Set();
    const invalid = new Set();
    const links = new Map();
    const broken = new Set();
    const targets = {};
    const touched = new Set();
    return {
      lines,
      targets,
      touched,
      invalid,
      broken,
      has: (key) => declared.has(key),
      node(key, shape, text, classes, target, indent = "  ") {
        declared.add(key);
        const id = nodeId(key);
        const [open, close] = SHAPES[shape];
        lines.push(`${indent}${id}${open}${label(text)}${close}`);
        classLines.push(`  class ${id} ${classes.join(",")}`);
        if (target) targets[id] = target;
        if (classes.includes("invalid")) invalid.add(key);
        for (const f of errorsOf.get(key) ?? []) touched.add(f);
      },
      link(a, b, arrow, wrong = false) {
        const key = `${a} ${arrow} ${b}`;
        if (!links.has(key)) {
          links.set(key, links.size);
          lines.push(`  ${nodeId(a)} ${arrow} ${nodeId(b)}`);
        }
        if (wrong || invalid.has(a) || invalid.has(b)) broken.add(links.get(key));
      },
      source: () =>
        [
          ...lines,
          ...CLASSDEFS.map((d) => `  ${d}`),
          ...classLines,
          ...(broken.size
            ? [`  linkStyle ${[...broken].sort((x, y) => x - y).join(",")} ${BROKEN_LINK}`]
            : []),
        ].join("\n"),
    };
  };
  /**
   * Draw one element of a query result in a role, once per diagram. A
   * reference that is missing or of another type is drawn as an invalid
   * reference, never as an element of that role.
   */
  const put = (d, ref, role, { base = role, extra = "", retired = false, indent } = {}) => {
    if (ref.id === null && !unnamed.has(ref)) unnamed.set(ref, `\u0000${unnamed.size}`);
    const key = ref.id ?? unnamed.get(ref);
    if (d.has(key)) return key;
    const iri = ref.id === null ? null : elementIri(ref.id);
    const target = detailKeys.has(key) ? anchor(key) : errors.length ? "errors" : null;
    if (iri !== null && typeOf(iri) === ROLE_TYPES[role]) {
      const { classes, suffix } = decorate(key, base, retired || retiredMember(iri));
      d.node(key, role, `${ref.label ?? key}${extra}${suffix}`, classes, target, indent);
    } else {
      const why = iri === null ? t.badIri : index.subjects.has(iri) ? t.mistyped : t.missing;
      const classes = ["invalid", ...(changedIds.has(key) ? ["changed"] : [])];
      d.node(key, role, `${ref.label ?? ref.id ?? "?"} · ${why}`, classes, target, indent);
    }
    return key;
  };
  const refIri = (ref) => (ref.id === null ? null : elementIri(ref.id));
  /** Contexts that group drawn elements: only typed bounded contexts become subgraphs. */
  const contextKey = (ctxIri) =>
    ctxIri && typeOf(ctxIri) === "BoundedContext" ? keyOf(ctxIri) : "";
  const subgraph = (d, ctx) =>
    d.lines.push(
      `  subgraph ${nodeId(ctx)}_ctx[${label(`${name(iriOf(ctx))}${decorate(ctx, "").suffix}`)}]`,
    );

  // The flow of one process, drawn from the process query: steps by context,
  // flow, performers, emitted events and their reactions, starting policies
  // and their events, with steps of other processes labelled with their process.
  const flowOf = (p) => {
    const id = elementId(p);
    const q =
      id === null
        ? null
        : queryContext({
            index,
            mapping,
            findings,
            target: { kind: "process", id },
            includeRetired,
          });
    if (!q?.found) {
      const own = errorsOf.get(keyOf(p)) ?? [];
      return { source: null, targets: {}, steps: [], errors: own, incomplete: true };
    }
    const d = diagram();
    const members = new Set(q.steps.map((c) => c.step.id).filter((x) => x !== null));
    const step = (ref, indent) => {
      const member = members.has(ref.id);
      const owner = ref.process;
      const state = ref.id === null ? null : stateOf(elementIri(ref.id));
      return put(d, ref, "step", {
        base: member ? state : "foreign",
        extra: member ? ` · ${t[state]}` : owner ? ` · ${owner.label ?? owner.id}` : "",
        retired: Boolean(owner?.retired),
        indent,
      });
    };
    const groups = new Map();
    for (const c of q.steps) {
      const ctx = contextKey(c.context ? refIri(c.context) : null);
      groups.set(ctx, [...(groups.get(ctx) ?? []), c.step]);
    }
    for (const [ctx, list] of [...groups].sort(([a], [b]) => byId(a, b))) {
      if (ctx) subgraph(d, ctx);
      for (const s of list) step(s, ctx ? "    " : "  ");
      if (ctx) d.lines.push("  end");
    }
    // Flow into or out of a step of another process is never a complete hand-off.
    for (const c of q.steps) {
      const s = step(c.step);
      for (const n of c.next) d.link(s, step(n), "-->", !members.has(n.id));
      for (const n of c.previous.filter((x) => !members.has(x.id))) d.link(step(n), s, "-->", true);
      for (const a of c.performers) d.link(put(d, a, "actor"), s, "-.->");
      for (const e of c.emits) {
        const event = put(d, e, "event");
        d.link(s, event, "==>");
        for (const r of e.reactions) {
          const policy = put(d, r.policy, "policy");
          d.link(event, policy, "-->");
          for (const x of r.starts) d.link(policy, step(x), "-->");
        }
      }
      for (const u of c.startedBy) {
        const policy = put(d, u.policy, "policy");
        d.link(policy, s, "-->");
        for (const e of u.events) d.link(put(d, e, "event"), policy, "-->");
      }
    }
    const affecting = new Set([...q.errors, ...d.touched]);
    return {
      source: d.source(),
      targets: d.targets,
      // In flow order, as the query text lists them: the step list, the explorer and the city.
      steps: inFlowOrder(q.steps).map((c) => c.step),
      errors: errors.filter((f) => affecting.has(f)),
      incomplete: !q.complete || affecting.size > 0 || d.invalid.size > 0,
    };
  };
  const flows = new Map(processes.map((p) => [p, flowOf(p)]));

  // Contexts, processes and the events and policies connecting processes,
  // drawn from the event queries. A connection whose step does not belong to
  // exactly one process cannot be placed; its known part is drawn broken.
  const landscape = (() => {
    const d = diagram();
    const placed = new Map();
    const lost = new Map();
    for (const e of index.ofType("BusinessEvent")) {
      const id = elementId(e);
      if (id === null) continue;
      const qe = queryContext({
        index,
        mapping,
        findings,
        target: { kind: "event", id },
        includeRetired,
      });
      if (!qe.found) continue;
      for (const emitter of qe.emittedBy)
        for (const r of qe.reactions)
          for (const started of r.starts) {
            const from = emitter.process?.id ?? null;
            const to = started.process?.id ?? null;
            if (from !== null && from === to) continue;
            const c = { from, event: qe.event, policy: r.policy, to, emitter, started };
            const key = [from, id, r.policy.id, to].join("\u0000");
            if (from !== null && to !== null) placed.set(key, placed.get(key) ?? c);
            else {
              // Named by the steps without a single process, once per connection.
              const unplaced = [from ?? emitter.id, to ?? started.id].join("\u0000");
              lost.set(`${key}\u0000${unplaced}`, c);
            }
          }
    }
    const all = [...placed.values(), ...lost.values()];
    const byContext = new Map();
    for (const c of all)
      for (const [ref, role] of [
        [c.event, "event"],
        [c.policy, "policy"],
      ]) {
        const ctx = contextKey(refIri(ref) && index.out(refIri(ref), "inContext")[0]);
        if (!byContext.has(ctx)) byContext.set(ctx, new Map());
        byContext.get(ctx).set(ref.id ?? ref, [ref, role]);
      }
    for (const [ctx, members] of [...byContext].sort(([a], [b]) => byId(a, b))) {
      if (ctx) subgraph(d, ctx); // every context is still listed below the diagram
      for (const [ref, role] of [...members.values()].sort(([a], [b]) => byId(a.id, b.id)))
        put(d, ref, role, { indent: ctx ? "    " : "  " });
      if (ctx) d.lines.push("  end");
    }
    for (const p of processes) {
      const key = keyOf(p);
      const { classes, suffix } = marked(isRetired(index, p) ? "retired" : "process", [
        [changedIds.has(key), "changed", t.changedMark],
        [unknownIds.has(key), "uncertain", t.unknownMark],
        [flows.get(p).incomplete, "broken", t.incompleteMark],
      ]);
      // A process node leads to its flow; the flow leads to element details.
      d.node(
        key,
        "process",
        `${name(p)} · ${statusBadge(p)}${suffix}`,
        classes,
        `process-${anchor(key)}`,
      );
    }
    const event = (c) => put(d, c.event, "event");
    const policy = (c) => put(d, c.policy, "policy");
    for (const c of placed.values()) {
      d.link(c.from, event(c), "-->");
      d.link(event(c), policy(c), "-->");
      d.link(policy(c), c.to, "-->");
    }
    for (const c of lost.values()) {
      if (c.from !== null) d.link(c.from, event(c), "-->", true);
      d.link(event(c), policy(c), "-->", true);
      if (c.to !== null) d.link(policy(c), c.to, "-->", true);
    }
    const incomplete =
      lost.size > 0 ||
      d.touched.size > 0 ||
      d.broken.size > 0 ||
      d.invalid.size > 0 ||
      processes.some((p) => flows.get(p).incomplete);
    return {
      source: d.source(),
      targets: d.targets,
      placed: [...placed.values()],
      lost: [...lost.values()],
      incomplete,
    };
  })();

  const figure = (f, key) =>
    renderMermaid(f.source, {
      idPrefix: key,
      diagramFallback: t.fallback,
      diagramPending: t.pending,
      diagramSource: t.source,
    }).replace("<figure ", `<figure data-targets="${esc(JSON.stringify(f.targets))}" `);
  const refLink = (ref) => linkKey(ref.id, ref.label ?? ref.id ?? "?");
  /** A linked element of a list with the error mark its diagram node carries. */
  const markedLink = (ref) =>
    `${refLink(ref)}${ref.id !== null && errorsOf.has(ref.id) ? badge("broken", t.errorMark) : ""}`;
  const stepItem = (ref) => {
    if (ref.id === null) return `<li>${refLink(ref)}${badge("broken", t.badIri)}</li>`;
    const state = stateOf(elementIri(ref.id));
    const marks = [
      ref.process?.retired ? badge("retired", t.retired) : "",
      changedIds.has(ref.id) ? badge("changed", t.changedMark) : "",
      errorsOf.has(ref.id) ? badge("broken", t.errorMark) : "",
    ].join("");
    return `<li>${refLink(ref)} <span class="badge state-${state}">${stateText(state)}</span>${marks}</li>`;
  };
  const notice = (message, items) =>
    `<div class="incomplete" role="note"><p>${esc(message)}</p>${items.length ? `<ul>${items.join("")}</ul>` : ""}</div>`;

  // The landscape and every flow figure are checked by one parser process, not one each.
  parseMermaidAll([landscape.source, ...processes.map((p) => flows.get(p).source).filter(Boolean)]);
  const lostItems = landscape.lost.map((c) => {
    const steps = [c.from === null ? c.emitter : null, c.to === null ? c.started : null].filter(
      Boolean,
    );
    return `<li>${refLink(c.event)} → ${refLink(c.policy)}: ${steps.map(refLink).join(", ")} ${esc(t.noSingleProcess)}</li>`;
  });
  const landscapeSection = `<section id="landscape"><h2>${esc(t.landscape)}</h2>${landscape.incomplete ? notice(t.landscapeIncomplete, lostItems.length ? [`<li>${esc(t.lost)}<ul>${lostItems.join("")}</ul></li>`] : []) : ""}${figure(landscape, "landscape")}
<h3>${esc(t.processes)}</h3><ul class="nav-list">${processes.map((p) => `<li><a href="#process-${anchor(keyOf(p))}">${esc(name(p))}</a> <span class="badge">${esc(statusBadge(p))}</span>${flows.get(p).incomplete ? badge("broken", t.incompleteMark) : ""}</li>`).join("")}</ul>
<h3>${esc(t.connections)}</h3>${landscape.placed.length ? `<ul>${landscape.placed.map((c) => `<li>${link(elementIri(c.from))} → ${markedLink(c.event)} → ${markedLink(c.policy)} → ${link(elementIri(c.to))}</li>`).join("")}</ul>` : `<p>${esc(t.noConnections)}</p>`}
<h3>${esc(t.contexts)}</h3><ul>${index
    .ofType("BoundedContext")
    .map((c) => `<li>${link(c)}</li>`)
    .join("")}</ul></section>`;

  const flowSections = processes
    .map((p) => {
      const key = keyOf(p);
      const f = flows.get(p);
      const heading = `${link(p)} <span class="badge">${esc(statusBadge(p))}</span>${changedIds.has(key) ? badge("changed", t.changedMark) : ""}${unknownIds.has(key) ? badge("uncertain", t.unknownMark) : ""}`;
      return `<section class="process" id="process-${anchor(key)}" tabindex="-1"><h2>${esc(t.flow)}: ${heading}</h2>
${f.incomplete ? notice(t.incomplete, f.errors.map(errorItem)) : ""}${f.source ? figure(f, `process-${key}`) : ""}
<h3>${esc(t.steps)}</h3><ul class="nav-list">${f.steps.map(stepItem).join("")}</ul></section>`;
    })
    .join("\n");

  // Every fact attribute, related rules, identifier and model documents.
  const typeName = new Map(CLASSES.map((c) => [c.key, lang === "ko" ? c.ko : c.key]));
  /** Every model document holding the element's statements, at its first line there; the typing document first. */
  const documentsOf = (node) => {
    const first = new Map();
    let typing = null;
    for (const list of node.props.values())
      for (const tr of list) {
        if (!first.has(tr.doc) || tr.line < first.get(tr.doc)) first.set(tr.doc, tr.line);
        if (tr.p === RDF_TYPE) typing ??= tr.doc;
      }
    return [...first]
      .sort(([a], [b]) => (a === typing ? -1 : b === typing ? 1 : byId(a, b)))
      .map(([doc, line]) => `${doc}:${line}`);
  };
  /**
   * One relation of a detail. Ends hidden as retired are left out; a relation
   * whose ends break the relation table, or a flow across processes, is marked.
   */
  const relationItem = (r, direction, x, endTypes, fits, [s, o]) => {
    const head = `${esc(lang === "ko" ? r.ko : r.key)} ${esc(direction)}`;
    const type = typeOf(x);
    if (!type)
      return `<li>${head} <code>${esc(keyOf(x))}</code>${badge("broken", index.subjects.has(x) ? t.mistyped : t.missing)}</li>`;
    if (!shown(x)) return "";
    const wrong =
      !fits ||
      !endTypes.includes(type) ||
      (r.key === "flowsTo" && flowCrossesProcesses(index, s, o));
    return `<li>${head} ${link(x)}${retiredMember(x) ? badge("retired", t.retired) : ""}${wrong ? badge("broken", t.errorMark) : ""}</li>`;
  };
  const details = shownElements
    .map((iri) => {
      const type = typeOf(iri);
      const key = keyOf(iri);
      const id = elementId(iri);
      const own = errorsOf.get(key) ?? [];
      const value = (attr) => {
        const values = index.literal(iri, attr.key ?? attr.iri);
        if (attr.value === "openScope")
          return openScopeOf(index, iri)
            .items.map((i) => `${i.kind}: ${i.text}`)
            .join(" | ");
        if (attr.value === "iri")
          return index
            .out(iri, attr.key)
            .map((x) => keyOf(x))
            .join(", ");
        return values.map((v) => v.value).join(" | ");
      };
      const rows = (kind) =>
        ATTRIBUTES.filter((a) => a.kind === kind && a.on.includes(type))
          .map(
            (a) =>
              `<tr><th scope="row">${esc(lang === "ko" ? a.ko : (a.key ?? a.iri.split("#").pop()))}</th><td>${esc(value(a) || t.none)}</td></tr>`,
          )
          .join("");
      const relations = RELATIONS.flatMap((r) => [
        ...index
          .out(iri, r.key)
          .map((x) => relationItem(r, t.to, x, r.to, r.from.includes(type), [iri, x])),
        ...index
          .into(iri, r.key)
          .map((x) => relationItem(r, t.from, x, r.from, r.to.includes(type), [x, iri])),
      ]).join("");
      const rules =
        type === "Step"
          ? index.ofType("BusinessRule").filter((r) => ruleReach(index, r).includes(iri))
          : index.into(iri, "constrains").filter((r) => typeOf(r) === "BusinessRule");
      let realization = "";
      if (type === "Step") {
        const r = realizationOf(index, mapping, iri, realizers, { untrusted });
        realization = `<h4>${esc(t.realization)}</h4><p class="state-${r.state}">${stateText(r.state)}</p>${r.features.length ? `<ul>${r.features.map((f) => `<li><code>${esc(f.category)}</code> — ${esc(f.implemented ? t.implemented : t.notImplemented)}<ul>${f.adrs.map((a) => `<li><code>${esc(a.path)}</code> ${esc(a.status ?? "?")}</li>`).join("")}</ul></li>`).join("")}</ul>` : ""}`;
      }
      const marks = [
        retiredMember(iri) ? badge("retired", t.retired) : "",
        changedIds.has(key) ? badge("changed", t.changedMark) : "",
        unknownIds.has(key) ? badge("uncertain", t.unknownMark) : "",
        own.length ? badge("broken", t.errors) : "",
      ].join("");
      const identifier = id !== null && isValidElementId(id) ? `m:${id}` : `<${iri}>`;
      return `<article class="element" id="${anchor(key)}" tabindex="-1"><h3>${esc(typeName.get(type))}: ${esc(name(iri))}${marks}</h3>
<p><span>${esc(t.id)}</span> <code>${esc(identifier)}</code> · <span>${esc(t.document)}</span> ${documentsOf(
        index.subjects.get(iri),
      )
        .map((d) => `<code>${esc(d)}</code>`)
        .join(", ")}</p>
${own.length ? `<h4>${esc(t.errors)}</h4><ul>${own.map((e) => errorText(e)).join("")}</ul>` : ""}
<h4>${esc(t.facts)}</h4><table>${rows("fact")}</table>
${rows("description") ? `<h4>${esc(t.descriptions)}</h4><table class="description">${rows("description")}</table>` : ""}
${rows("lifecycle") ? `<h4>${esc(t.lifecycle)}</h4><table>${rows("lifecycle")}</table>` : ""}
${relations ? `<h4>${esc(t.relations)}</h4><ul>${relations}</ul>` : ""}
${
  rules.length
    ? `<h4>${esc(t.rules)}</h4><ul>${rules
        .sort(byId)
        .map((r) => `<li>${link(r)} — ${esc(text(r, "definition") ?? "")}</li>`)
        .join("")}</ul>`
    : ""
}
${realization}</article>`;
    })
    .join("\n");

  // Uncommitted edits and unsynced direct edits of Accepted processes, or why
  // they could not be determined.
  let changeBanner = "";
  // What history could not show is said first; the working-tree comparison still stands.
  const whole = changes && (!changes.available || changes.head === null);
  const unavailable = !changes
    ? null
    : !changes.available
      ? changes.reason
      : !changes.history.available
        ? changes.history.reason
        : null;
  const [heading, intro] = whole
    ? [t.changesUnavailable, t.changesUnavailableIntro]
    : [t.committedUnavailable, t.committedUnavailableIntro];
  const unavailableBanner =
    unavailable === null
      ? ""
      : `<section class="changes" id="changes-unavailable"><h2>${esc(heading)}</h2><p>${esc(intro)} ${esc(unavailable ?? t.none)}</p>${changes?.uncommittedDocuments?.length ? `<p>${esc(t.uncommitted)}: ${changes.uncommittedDocuments.map((d) => `<code>${esc(d)}</code>`).join(", ")}</p>` : ""}</section>`;
  if (changes?.available) {
    // An element the current model lacks was removed since the comparison's base: the
    // last commit for uncommitted edits, a commit where the process may have last
    // become Accepted for committed ones.
    const item = (id, removed = t.removed) =>
      detailKeys.has(id)
        ? `<a href="#${anchor(id)}">${esc(id)}</a>`
        : index.subjects.has(iriOf(id))
          ? `<code>${esc(id)}</code>`
          : `<span class="removed">${esc(id)} (${esc(removed)})</span>`;
    const list = (set, removed) => {
      const all = [...set].sort();
      const visible = all.filter((id) => !hidden(id));
      const more = all.length - visible.length;
      return [
        ...visible.map((id) => item(id, removed)),
        ...(more ? [esc(t.hiddenChanges.replace("{n}", more))] : []),
      ].join(", ");
    };
    const parts = [
      ...(changes.uncommitted.size
        ? [`<p>${esc(t.uncommitted)}: ${list(changes.uncommitted)}</p>`]
        : []),
      ...[...changes.unsynced.entries()]
        .sort(([a], [b]) => byId(a, b))
        .map(
          ([p, changed]) =>
            `<p>${esc(t.unsynced)} — ${item(p)}: ${list(changed, t.removedSinceAccepted)}</p>`,
        ),
      ...[...changes.lifecycleEdits]
        .filter(([p]) => !hidden(p))
        .sort(([a], [b]) => byId(a, b))
        .map(
          ([p, found]) =>
            `<p>${esc(t.lifecycleEdit)} — ${item(p)}: ${found.map((f) => esc(f.msg)).join(" | ")}</p>`,
        ),
      ...[...changes.uncertain]
        .filter(([p]) => !hidden(p))
        .sort(([a], [b]) => byId(a, b))
        .map(([p, reason]) => `<p>${esc(t.unknownEdits)} — ${item(p)}: ${esc(reason)}</p>`),
    ];
    // Only what the page shows: edits of hidden retired processes leave no empty box.
    if (parts.length)
      changeBanner = `<section class="changes" id="changes"><h2>${esc(t.changes)}</h2>${parts.join("")}</section>`;
  }

  const body = `${banner(errors.map(errorItem))}${unavailableBanner}${changeBanner}<nav aria-label="${esc(t.processes)}"><a href="#landscape">${esc(t.landscape)}</a> · <a href="#elements">${esc(t.elements)}</a></nav>
${landscapeSection}
${flowSections}
<section id="elements"><h2>${esc(t.elements)}</h2>${details}</section>`;

  // The explorer, which finds every element and lists it by bounded context, and the 3D
  // business city of the landscape. Both are built from the structures the document above is
  // drawn from, so the city shows no fact the diagrams, lists and details do not.
  const hrefOf = (iri) =>
    typeOf(iri) === "Process" ? `process-${anchor(keyOf(iri))}` : anchor(keyOf(iri));
  /** The shown bounded contexts an element names, in identifier order. */
  const contextsOf = (iri) =>
    [
      ...new Set(
        index
          .out(iri, "inContext")
          .filter((c) => typeOf(c) === "BoundedContext" && shown(c))
          .map(keyOf),
      ),
    ].sort(byId);
  /** A process's steps that have details on the page, in flow order. */
  const floorsOf = (p) =>
    flows
      .get(p)
      .steps.map((s) => s.id)
      .filter((id) => id !== null && detailKeys.has(id));
  const collator = new Intl.Collator(lang);
  const byName = (a, b) => collator.compare(name(a), name(b)) || byId(keyOf(a), keyOf(b));
  const ofType = (type) => shownElements.filter((iri) => typeOf(iri) === type);

  // Each element under the context it names, and a process under every context of its steps
  // with all its steps in flow order. Elements that name no context are grouped apart.
  const contexts = index.ofType("BoundedContext").filter(shown).sort(byName);
  const groups = new Map(
    [...contexts.map(keyOf), null].map((c) => [c, { processes: [], members: new Map() }]),
  );
  const inProcess = new Set();
  for (const p of [...processes].sort(byName)) {
    const where = new Set();
    for (const s of floorsOf(p)) {
      inProcess.add(s);
      const own = contextsOf(iriOf(s));
      for (const c of own.length ? own : [null]) where.add(c);
    }
    for (const c of where.size ? where : [null]) groups.get(c).processes.push(p);
  }
  const MEMBERS = [
    "BusinessEvent",
    "Policy",
    "BusinessConcept",
    "Step",
    "BusinessRule",
    "Actor",
    "ObservationCriterion",
  ];
  const CONTEXTUAL = new Set(["Step", "Policy", "BusinessEvent", "BusinessConcept"]);
  for (const iri of [...shownElements].sort(byName)) {
    const type = typeOf(iri);
    if (!MEMBERS.includes(type) || (type === "Step" && inProcess.has(keyOf(iri)))) continue;
    const own = CONTEXTUAL.has(type) ? contextsOf(iri) : [];
    for (const c of own.length ? own : [null]) {
      const members = groups.get(c).members;
      members.set(type, [...(members.get(type) ?? []), iri]);
    }
  }
  const treeMarks = (iri) =>
    [
      retiredMember(iri) ? badge("retired", t.retired) : "",
      changedIds.has(keyOf(iri)) ? badge("changed", t.changedMark) : "",
      errorsOf.has(keyOf(iri)) ? badge("broken", t.errorMark) : "",
    ].join("");
  const treeItem = (iri) =>
    `<li data-type="${typeOf(iri)}"><a href="#${hrefOf(iri)}">${esc(name(iri))}</a>${treeMarks(iri)}</li>`;
  /** A step of a process listed under `ctx`; a step of another context names its own. */
  const treeStep = (key, ctx) => {
    const iri = iriOf(key);
    const state = stateOf(iri);
    const own = contextsOf(iri);
    const here = ctx === null ? !own.length : own.includes(ctx);
    const where = here
      ? ""
      : ` <span class="where">${esc(own.length ? own.map((c) => name(iriOf(c))).join(", ") : t.noContext)}</span>`;
    return `<li data-type="Step"><a href="#${anchor(key)}"><span class="dot state-${state}" aria-hidden="true"></span>${esc(name(iri))}<span class="sr"> — ${esc(t.short[state])}</span></a>${where}${treeMarks(iri)}</li>`;
  };
  const treeProcess = (p, ctx) =>
    `<li data-type="Process"><details><summary><a href="#${hrefOf(p)}">${esc(name(p))}</a> <span class="badge">${esc(statusBadge(p))}</span>${flows.get(p).incomplete ? badge("broken", t.incompleteMark) : ""}${changedIds.has(keyOf(p)) ? badge("changed", t.changedMark) : ""}</summary><ol>${floorsOf(
      p,
    )
      .map((s) => treeStep(s, ctx))
      .join("")}</ol></details></li>`;
  const treeGroup = ([c, g]) => {
    if (c === null && !g.processes.length && !g.members.size) return "";
    const head =
      c === null
        ? `<span class="group-name">${esc(t.noContext)}</span>`
        : `<a href="#${anchor(c)}">${esc(name(iriOf(c)))}</a>${treeMarks(iriOf(c))}`;
    const kinds = MEMBERS.filter((type) => g.members.has(type))
      .map(
        (type) =>
          `<li class="kind" data-kind="${type}"><details><summary>${esc(typeName.get(type))} <span class="count">${g.members.get(type).length}</span></summary><ul>${g.members
            .get(type)
            .map(treeItem)
            .join("")}</ul></details></li>`,
      )
      .join("");
    const count =
      c === null
        ? ""
        : ` <span class="count" title="${esc(typeName.get("Process"))}">${g.processes.length}</span>`;
    return `<li class="context"><details><summary>${head}${count}</summary><ul>${g.processes.map((p) => treeProcess(p, c)).join("")}${kinds}</ul></details></li>`;
  };

  // The city: a district per bounded context, a tower per process with one floor per step in
  // flow order, events beside the floors that emit them and policies beside the floors they
  // start, and every trigger between them. Indexes point into `elements`.
  const at = new Map(shownElements.map((iri, i) => [keyOf(iri), i]));
  const elements = shownElements.map((iri) => {
    const key = keyOf(iri);
    const type = typeOf(iri);
    const e = { k: key, n: name(iri), t: type, h: hrefOf(iri) };
    if (type === "Step") e.s = stateOf(iri);
    if (type === "Process") e.st = statusBadge(iri);
    const marks =
      (retiredMember(iri) ? 1 : 0) |
      (changedIds.has(key) ? 2 : 0) |
      (errorsOf.has(key) ? 4 : 0) |
      (type === "Process" && flows.get(iri).incomplete ? 8 : 0) |
      (unknownIds.has(key) ? 16 : 0);
    if (marks) e.m = marks;
    return e;
  });
  const districtOf = new Map();
  const districts = [];
  const district = (c) => {
    if (!districtOf.has(c)) {
      districtOf.set(c, districts.length);
      districts.push({
        n: c === null ? t.noContext : name(iriOf(c)),
        e: c === null ? -1 : at.get(c),
      });
    }
    return districtOf.get(c);
  };
  for (const c of contexts) district(keyOf(c));
  const towers = [...processes].sort(byName).map((p) => {
    const steps = floorsOf(p);
    const tally = new Map();
    for (const s of steps)
      for (const c of contextsOf(iriOf(s))) tally.set(c, (tally.get(c) ?? 0) + 1);
    const home = [...tally].sort(([a, x], [b, y]) => y - x || byId(a, b))[0]?.[0] ?? null;
    return { i: at.get(keyOf(p)), d: district(home), f: steps.map((s) => at.get(s)) };
  });
  const floorAt = new Map();
  towers.forEach((tower, ti) =>
    tower.f.forEach((s, level) => floorAt.has(s) || floorAt.set(s, [ti, level])),
  );
  /** The first floor among steps, by tower and then level, or -1. */
  const firstFloor = (steps) =>
    steps
      .filter((s) => floorAt.has(s))
      .sort(
        (a, b) => floorAt.get(a)[0] - floorAt.get(b)[0] || floorAt.get(a)[1] - floorAt.get(b)[1],
      )[0] ?? -1;
  const positions = (iris) =>
    [...new Set(iris.map((x) => at.get(keyOf(x))).filter((i) => i !== undefined))].sort(
      (a, b) => a - b,
    );
  const homeOf = (iri) => district(contextsOf(iri)[0] ?? null);
  const steps = (iris) => iris.filter((s) => typeOf(s) === "Step");
  const events = ofType("BusinessEvent").map((e) => {
    const from = positions(steps(index.into(e, "emits")));
    return { i: at.get(keyOf(e)), at: firstFloor(from), from, d: homeOf(e) };
  });
  const policies = ofType("Policy").map((q) => {
    const to = positions(steps(index.out(q, "starts")));
    return { i: at.get(keyOf(q)), at: firstFloor(to), to, d: homeOf(q) };
  });
  // A trigger is drawn between processes when the landscape connects two processes through it,
  // and broken where the landscape cannot place it or either end has an error.
  const pair = (e, q) => `${e}\u0000${q}`;
  const across = new Set(landscape.placed.map((c) => pair(c.event.id, c.policy.id)));
  const lostPairs = new Set(landscape.lost.map((c) => pair(c.event.id, c.policy.id)));
  const links = [];
  for (const e of ofType("BusinessEvent"))
    for (const q of index.out(e, "triggers")) {
      if (typeOf(q) !== "Policy" || !shown(q)) continue;
      const [ek, qk] = [keyOf(e), keyOf(q)];
      const broken = errorsOf.has(ek) || errorsOf.has(qk) || lostPairs.has(pair(ek, qk));
      links.push([at.get(ek), at.get(qk), broken ? 2 : across.has(pair(ek, qk)) ? 1 : 0]);
    }
  const towerOf = new Map(towers.map((tower, ti) => [tower.i, ti]));
  const related = new Set();
  for (const iri of shownElements)
    for (const r of RELATIONS)
      for (const x of index.out(iri, r.key)) {
        const [a, b] = [at.get(keyOf(iri)), at.get(keyOf(x))];
        if (b !== undefined && a !== b) related.add(`${a},${b}`);
      }
  const data = {
    text: {
      found: t.found,
      foundSome: t.foundSome,
      noneFound: t.noneFound,
      pause: t.pause,
      play: t.play,
      short: t.short,
      retired: t.retired,
      changed: t.changedMark,
      error: t.errorMark,
      incomplete: t.incompleteMark,
    },
    types: CLASSES.map((c) => [c.key, typeName.get(c.key)]),
    elements,
    city: {
      districts,
      towers,
      events,
      policies,
      links,
      concepts: ofType("BusinessConcept").map((c) => ({ i: at.get(keyOf(c)), d: homeOf(c) })),
      rules: ofType("BusinessRule").map((r) => at.get(keyOf(r))),
      actors: ofType("Actor").map((a) => at.get(keyOf(a))),
      criteria: ofType("ObservationCriterion").map((c) => {
        const owner = index.out(c, "criterionOf").find((p) => towerOf.has(at.get(keyOf(p))));
        return { i: at.get(keyOf(c)), p: owner ? towerOf.get(at.get(keyOf(owner))) : -1 };
      }),
    },
    relations: [...related].map((s) => s.split(",").map(Number)),
  };

  const FILTERS = [
    "Process",
    "Step",
    "BusinessEvent",
    "Policy",
    "BusinessConcept",
    "BusinessRule",
    "Actor",
    "ObservationCriterion",
  ];
  const STATES = ["implemented", "notImplemented", "unrealized", "outside", "unknown"];
  const LAYERS = ["BusinessConcept", "BusinessRule", "Actor", "ObservationCriterion"];
  const explorer = `<aside class="explorer" aria-label="${esc(t.explorer)}">
<div class="find" role="search"><label for="find">${esc(t.find)}</label><input type="search" id="find" placeholder="${esc(t.findHint)}" autocomplete="off" spellcheck="false" aria-controls="find-results" aria-describedby="find-status"><p class="find-status" id="find-status" aria-live="polite"></p></div>
<div class="chips" role="group" aria-label="${esc(t.types)}">${FILTERS.map((type) => `<button type="button" data-type="${type}" aria-pressed="true"><span class="glyph t-${type}" aria-hidden="true"></span>${esc(typeName.get(type))} <span class="count">${ofType(type).length}</span></button>`).join("")}</div>
<ol class="results" id="find-results" hidden></ol>
<nav class="tree" id="tree" aria-label="${esc(t.tree)}"><ul>${[...groups].map(treeGroup).join("")}</ul></nav>
</aside>`;
  const city = `<section class="city" id="city" aria-label="${esc(t.city)}">
<canvas id="city-canvas" tabindex="0" role="img" aria-label="${esc(t.cityLabel)}" aria-describedby="city-hint">${esc(t.noCanvas)}</canvas>
<p class="city-hint" id="city-hint">${esc(t.cityHint)}</p>
<div class="city-controls"><button type="button" id="city-motion">${esc(t.pause)}</button><button type="button" id="city-reset">${esc(t.reset)}</button><button type="button" id="city-wide" aria-pressed="false">${esc(t.wide)}</button></div>
<div class="city-legend"><p>${esc(t.legend)}</p><ul>${STATES.map((s) => `<li><span class="swatch state-${s}" aria-hidden="true"></span>${esc(t.short[s])}</li>`).join("")}<li><span class="swatch t-BusinessEvent" aria-hidden="true"></span>${esc(typeName.get("BusinessEvent"))}</li><li><span class="swatch t-Policy" aria-hidden="true"></span>${esc(typeName.get("Policy"))}</li><li><span class="swatch handoff" aria-hidden="true"></span>${esc(t.handoff)}</li></ul>
<p>${esc(t.layers)}</p><div class="layers">${LAYERS.map((type) => `<button type="button" data-layer="${type}" aria-pressed="false"><span class="glyph t-${type}" aria-hidden="true"></span>${esc(typeName.get(type))}</button>`).join("")}</div></div>
<div class="city-tip" id="city-tip" hidden></div>
</section>`;
  return page(t, lang, body, true, { explorer, city, data });
}

// Diagram nodes become links once Mermaid has drawn them. Mermaid gives each
// flowchart node the DOM id `flowchart-<node id>-<counter>`; the browser
// navigation test pins that format.
const NAVIGATION = `<script data-view-navigation>
(window.reportDiagramsReady || Promise.resolve()).then(() => {
  for (const figure of document.querySelectorAll('figure[data-targets]')) {
    const targets = JSON.parse(figure.dataset.targets);
    for (const g of figure.querySelectorAll('g.node')) {
      const match = /flowchart-(n\\d+)-/.exec(g.id || '');
      const target = match && targets[match[1]];
      if (!target) continue;
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'link');
      g.style.cursor = 'pointer';
      const go = () => { location.hash = target; document.getElementById(target)?.focus?.(); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); } });
    }
  }
});
</script>`;

// The page's style and the explorer and city script ship beside this module and are inlined,
// so the view stays one file with no external resources.
const CSS = readFileSync(new URL("./process-model-view.css", import.meta.url), "utf8");
const CLIENT = readFileSync(new URL("./process-model-view-client.js", import.meta.url), "utf8");
if (/<\/(?:script|style)/i.test(CSS + CLIENT))
  throw new Error("the view's style and script must not close their own element");

function page(t, lang, body, diagrams, app = null) {
  const head = `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.title)}</title><style>${CSS}</style></head>`;
  const runtime = diagrams ? mermaidRuntime({ diagramFallback: t.fallback }) + NAVIGATION : "";
  if (!app)
    return `${head}
<body class="plain"><header><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p></header>
<main>${body}</main>
${runtime}
</body></html>
`;
  // "<" is escaped, so no model text can end the data element.
  const data = JSON.stringify(app.data).replace(/</g, "\\u003c");
  return `${head}
<body class="app"><header class="bar"><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p></header>
<div class="shell">${app.explorer}
${app.city}
<main class="document" id="document">${body}</main></div>
<script type="application/json" id="view-data">${data}</script>
${runtime}
<script data-view-explorer>${CLIENT}</script>
</body></html>
`;
}
