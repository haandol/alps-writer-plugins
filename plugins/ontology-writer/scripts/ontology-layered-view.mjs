// Offline navigation through business contexts, their processes and realizing decisions.
import { readFileSync } from "node:fs";
import { escapeHtml as esc } from "./ontology-lib.mjs";
import { prepareView, renderView } from "./ontology-view.mjs";
import { buildLayeredData, readAdrDocument } from "./ontology-layered-data.mjs";
import {
  BOARD_CSS,
  BOARD_CLIENT,
  modelEventBoard,
  renderEventBoard,
  validateEventBoard,
} from "./eventstorming-board.mjs";
import { mermaidRuntime } from "../skills/report-writer/scripts/mermaid.mjs";

const asset = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const CSS = asset("./ontology-layered-view.css");
const CLIENT =
  asset("./search/search-text.mjs").replace(/^export /gm, "") +
  "\n" +
  asset("./ontology-layered-client.js");
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * Render Markdown as inert text, headings, lists and tables. Links stay textual:
 * opening a decision does not grant navigation to its source-code references.
 * The verbatim source remains available beside this readable projection.
 */
export function renderAdrText(source) {
  const inline = (value) =>
    esc(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 <span class="text-reference">($2)</span>');
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let paragraph = [],
    list = [],
    fence = null,
    code = [];
  const flush = () => {
    if (paragraph.length) blocks.push(`<p>${inline(paragraph.join("\n"))}</p>`);
    if (list.length)
      blocks.push(`<ul>${list.map((line) => `<li>${inline(line)}</li>`).join("")}</ul>`);
    paragraph = [];
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        blocks.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
        fence = null;
        code = [];
      } else code.push(line);
    } else if (marker) {
      flush();
      fence = marker[1];
    } else if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      flush();
      const cells = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => inline(cell.trim()));
      const header = cells(line);
      const rows = [];
      i++;
      while (i + 1 < lines.length && /^\s*\|/.test(lines[i + 1])) rows.push(cells(lines[++i]));
      blocks.push(
        `<div class="table-scroll"><table><thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
    } else if (/^#{1,6}\s/.test(line)) {
      flush();
      const [, marks, value] = /^(#{1,6})\s+(.+)$/.exec(line);
      const level = Math.min(marks.length + 1, 6);
      blocks.push(`<h${level}>${inline(value)}</h${level}>`);
    } else if (/^\s*(?:[-*+] |\d+\. )/.test(line)) {
      if (paragraph.length) flush();
      list.push(line.replace(/^\s*(?:[-*+] |\d+\. )/, ""));
    } else if (!line.trim()) flush();
    else if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push("<hr>");
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  if (fence) blocks.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
  return blocks.join("\n");
}

/** Keep each requested process's recorded flow and its immediate external hand-offs. */
export function scopedEventBoard(board, process, { metadata, sourceKind = "model" } = {}) {
  const own = new Set(
    board.stages.filter((stage) => stage.process === process.id).map((stage) => stage.id),
  );
  const included = new Set(own);
  for (const link of board.links)
    if (own.has(link.from) || own.has(link.to)) {
      included.add(link.from);
      included.add(link.to);
    }
  const supplied = new Map((metadata?.stages ?? []).map((stage) => [stage.id, stage]));
  const stages = board.stages
    .filter((stage) => included.has(stage.id))
    .map((stage) => {
      const annotation = sourceKind === "draft" ? supplied.get(stage.modelId) : null;
      return annotation
        ? {
            ...stage,
            entities: [
              ...stage.entities,
              ...annotation.entities.filter((e) => e.kind !== "concept"),
            ],
            views: annotation.views ?? [],
            businessStatus: annotation.businessStatus ?? stage.businessStatus,
          }
        : stage;
    });
  return {
    ...board,
    origin: sourceKind === "draft" ? "candidate" : "model",
    title: process.name,
    scope: process.definition || process.name || process.id,
    stages,
    links: board.links.filter(
      (link) =>
        included.has(link.from) &&
        included.has(link.to) &&
        (own.has(link.from) || own.has(link.to)),
    ),
    questions: board.questions
      .filter((q) => q.stages.some((id) => own.has(id)))
      .map((q) => ({ ...q, stages: q.stages.filter((id) => included.has(id)) })),
    subdomains: [],
    external: stages.filter((stage) => !own.has(stage.id)).map((stage) => stage.id),
  };
}

// Only the requested board is instantiated. Its sandbox owns its animation lifetime;
// it may request a known model detail but cannot read files or navigate the parent.
const FRAME_BRIDGE = `
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-model-target]');
  if (link) { event.preventDefault(); parent.postMessage({type:'ontology-detail', id:link.dataset.modelTarget}, '*'); }
});
window.addEventListener('message', (event) => {
  if (event.source !== parent || event.data?.type !== 'ontology-effects') return;
  for (const host of document.querySelectorAll('.event-timeline')) host.dispatchEvent(new CustomEvent('eventstorming-motion', {detail:{enabled:event.data.enabled,reason:event.data.reason || 'paused'}}));
});
`;

function workflowDocument(board, data) {
  const ko = data.language === "ko";
  const content = renderEventBoard(board, {
    lang: data.language,
    modelLink: (id, name) =>
      `<a href="#business-detail" data-model-target="${esc(id)}">${esc(name)}</a>`,
  });
  const external = json(board.external);
  return `<!doctype html><html lang="${data.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><style>${BOARD_CSS}
body{margin:0;background:#faf9f5;color:#28312e;font-family:system-ui,sans-serif}.event-workbench{margin:0;padding:18px}.event-perspectives,.event-header,.event-readiness-link,.event-subdomains{display:none}.story-viewport{height:580px}.external-stage{border:2px dashed #ad7854!important}.external-label{font:600 12px system-ui;color:#955629}.event-flat-cards{scroll-margin-top:20px}.frame-note{margin:16px 20px;line-height:1.7}</style></head><body data-model-view="events"><p class="frame-note">${ko ? "선택한 업무와 직접 연결된 인계입니다. 점선 테두리는 연결된 다른 프로세스의 활동입니다. 사건·조건을 선택해 경로와 근거를 읽고, 업무 이름을 선택해 모델 원문을 엽니다." : "This process and its direct hand-offs. Dashed borders mark activities in another process. Select events or conditions for paths and evidence; select an action name for its model facts."}</p>${content}<script>${BOARD_CLIENT}\n${FRAME_BRIDGE}\nfor(const element of document.querySelectorAll('[data-stage],[data-story-node]')) if(${external}.includes(element.dataset.stage || element.dataset.storyNode)){element.classList.add('external-stage');const label=document.createElement('p');label.className='external-label';label.textContent=${json(ko ? "연결된 외부 프로세스" : "Connected external process")};element.prepend(label);}</script></body></html>`;
}

/** Generate the normal offline view; the browser has no source-file or write capability. */
export function renderLayeredView(options) {
  const {
    mapping,
    index,
    metadata = null,
    cwd = process.cwd(),
    adrRoot = "docs/adr",
    sourceKind = "model",
  } = options;
  if (metadata) {
    const errors = validateEventBoard(metadata);
    if (errors.length) throw new Error(`Invalid business review material: ${errors.join("; ")}`);
  }
  const findings = [...(options.findings ?? [])];
  for (const [category, entry] of Object.entries(mapping?.categories ?? {})) {
    if (!Array.isArray(entry?.realizes) || !entry.realizes.length) continue;
    for (const record of Array.isArray(entry?.adrs) ? entry.adrs : []) {
      const read = readAdrDocument(record, { cwd, adrRoot });
      const message =
        read.error ??
        (read.documentStatus !== String(record.status ?? "").trim()
          ? "The document Status and the index do not agree."
          : null);
      if (message)
        findings.push({
          level: "error",
          code: read.error ? "ontology-adr-missing" : "ontology-adr-status-mismatch",
          category,
          where: typeof record?.path === "string" ? record.path : category,
          element: null,
          msg: message,
        });
    }
  }
  const prepared = prepareView({ ...options, findings, includeWorkbench: false });
  if (!prepared.app) return renderView({ ...options, findings });
  const data = buildLayeredData({ prepared, index, mapping, metadata, cwd, adrRoot, sourceKind });
  const board = modelEventBoard({ ...options, findings });
  const workflows = data.containers
    .map((process) => {
      const scoped = scopedEventBoard(board, process, { metadata, sourceKind });
      return `<template data-workflow="${esc(process.id)}">${esc(workflowDocument(scoped, data))}</template>`;
    })
    .join("");
  const adrBodies = Object.values(data.adrs)
    .map(
      (adr) =>
        `<template data-adr-document="${esc(adr.id)}">${adr.body === null ? "" : renderAdrText(adr.body)}</template>`,
    )
    .join("");
  const ko = prepared.lang === "ko";
  const word = (kr, en) => (ko ? kr : en);
  const title = word("업무 온톨로지", "Business ontology");
  if (/<\/(?:script|style)/i.test(CSS + CLIENT))
    throw new Error("A view asset closes its own element.");
  return `<!doctype html><html lang="${prepared.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style></head>
<body class="layered-app" data-layer="contexts" data-view="events">
<header class="app-bar"><a class="brand" href="#all"><span class="brand-symbol" aria-hidden="true">◈</span><span>${title}</span></a><span class="readonly">${word("읽기 전용", "Read only")}${sourceKind === "draft" ? " · " + word("작성 중 초안", "Working draft") : ""}</span><div class="view-toggle" role="group" aria-label="${word("표현 방식", "Representation")}"><button type="button" data-view="events" aria-pressed="true">${word("이벤트 스토밍", "EventStorming")}</button><button type="button" data-view="structure" aria-pressed="false">${word("3D 업무 구조", "3D business structure")}</button></div><button type="button" id="help-toggle">${word("사용 안내", "Guide")}</button></header>
<div class="app-shell"><aside class="outline"><p class="eyebrow">${word("업무에서 구현 계약까지", "From business to contracts")}</p><h1>${word("업무의 큰 그림", "The business at a glance")}</h1><nav id="layer-path" aria-label="${word("추상화 레이어", "Abstraction layers")}"></nav><div class="outline-note">${word("업무 경계를 열고, 흐름을 이해하고, 그 일을 실현하는 결정을 확인합니다.", "Open a business boundary, understand its workflows, then read the decisions that realize them.")}</div><div id="source-summary"></div><button type="button" id="diagnostics-toggle">${word("검증·변경 정보", "Validation & changes")}</button></aside>
<main id="workspace"><nav class="breadcrumbs" id="breadcrumbs" aria-label="${word("현재 위치", "Current location")}"></nav><section class="scope-heading"><div><p class="eyebrow" id="layer-label"></p><h2 id="scope-title" tabindex="-1"></h2><p id="scope-description"></p></div><button type="button" id="go-up">↑ ${word("상위로", "Up a level")}</button></section>
<section id="scope-summary"></section><div class="find-bar" role="search"><label class="sr" for="layer-search">${word("현재 범위 검색", "Search the current scope")}</label><input id="layer-search" type="search" placeholder="${word("이름, 식별자, 업무 문구로 검색", "Search names, identifiers or business wording")}" autocomplete="off"><label class="sr" for="search-scope">${word("검색 대상", "Search scope")}</label><select id="search-scope"><option value="layer">${word("현재 레이어", "Current layer")}</option><option value="knowledge">${word("업무 자료", "Business knowledge")}</option></select><label class="sr" for="domain-filter">${word("서브도메인", "Subdomain")}</label><select id="domain-filter"></select></div>
<div class="canvas-toolbar"><span id="results-status" role="status" aria-live="polite"></span><div class="camera-controls"><button type="button" data-camera="pan" aria-pressed="true">${word("이동", "Pan")}</button><button type="button" data-camera="rotate" aria-pressed="false">${word("회전", "Rotate")}</button><button type="button" data-camera="out" aria-label="${word("축소", "Zoom out")}">−</button><output id="camera-scale">100%</output><button type="button" data-camera="in" aria-label="${word("확대", "Zoom in")}">+</button><button type="button" data-camera="reset">${word("시점 초기화", "Reset view")}</button><button type="button" id="motion-toggle" aria-pressed="true">${word("전환 효과", "Transitions")}</button></div></div>
<section id="layer-viewport" tabindex="0" aria-label="${word("업무 탐색 지도. 드래그로 이동하고 더하기·빼기로 확대합니다.", "Business map. Drag to pan; plus and minus zoom.")}"><div id="layer-world"><svg id="layer-connections" aria-hidden="true"></svg><div id="layer-nodes"></div></div><p id="empty-scope" hidden></p></section>
<div class="canvas-footer"><p id="camera-hint"></p><div class="pagination"><button type="button" id="page-previous">← ${word("이전", "Previous")}</button><span id="page-status"></span><button type="button" id="page-next">${word("다음", "Next")} →</button></div></div>
<section id="layer-relations"></section><section id="business-workflow" hidden><div class="panel-title"><h3>${word("업무 흐름과 인계", "Business flow and hand-offs")}</h3><button type="button" id="workflow-close">${word("흐름 닫기", "Close flow")}</button></div><div id="workflow-frame-host"></div></section>
<section id="detail-panel" class="detail-panel" hidden aria-labelledby="detail-title"><div class="panel-title"><h3 id="detail-title" tabindex="-1"></h3><button type="button" id="detail-close">${word("상세 닫기", "Close detail")}</button></div><div class="document" id="detail-body"></div></section>
<section class="guidance-panel" id="help-panel" hidden><h3>${word("지도를 읽는 방법", "How to read this map")}</h3><p>${word("BC는 같은 업무 언어와 규칙을 소유하는 바운디드 컨텍스트입니다. BC를 누르면 실제 업무 프로세스가, 프로세스를 누르면 실현 기능 ADR이 열립니다. 두 표현은 같은 업무·선택·검색 위치를 유지합니다. ADR은 아키텍처 결정을 기록한 문서이며, 여기에서 탐색을 마칩니다.", "A bounded context owns a business language and rules. Select it for actual business processes, then select a process for its realizing architectural decision records (ADRs). Both representations keep the same work, selection and search position. Navigation ends at the ADR.")}</p><p>${word("드래그로 이동하고 +/−로 확대합니다. 3D에서는 회전 모드를 고를 수 있습니다. 키보드 화살표는 이동, Home은 시점 초기화입니다. 위치와 크기는 중요도·발생 시각을 뜻하지 않습니다.", "Drag to pan and use +/− to zoom. In 3D you can switch to rotation. Arrow keys pan and Home resets the view. Position and size do not imply importance or occurrence time.")}</p><p>${word("구현됨 표시는 ADR Status에서 계산한 결과입니다. 업무 완전성 검토와 실제 실행 검증은 별도로 확인해야 합니다.", "Implementation labels are computed from ADR Status. Business completeness and actual execution require separate evidence.")}</p><div id="readiness-guide"></div></section>
<section class="guidance-panel" id="diagnostics-panel" hidden></section><noscript>${word("이 화면의 탐색에는 JavaScript가 필요합니다.", "This view requires JavaScript for navigation.")}</noscript></main></div>
<template id="business-source">${prepared.body}</template>${adrBodies}${workflows}<script type="application/json" id="layered-data">${json(data)}</script><script>${CLIENT}</script>${prepared.diagrams ? mermaidRuntime({ diagramFallback: prepared.t.fallback, lazy: { root: "#detail-body", ahead: "500px" } }) : ""}</body></html>`;
}
