#!/usr/bin/env bun
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseMermaid, parseMermaidAll, renderMermaid, mermaidRuntime } from "./mermaid.mjs";
import { parseCodeDiff, renderCodeDiff, diffCss } from "./code-diff.mjs";
import {
  MAX_QUESTIONS,
  validateQuestions,
  renderQuestion,
  quizLabels,
  quizCss,
  quizScript,
} from "./comprehension.mjs";

const reportCss = readFileSync(new URL("./report.css", import.meta.url), "utf8");

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
function strings(values, name, { min = 0 } = {}) {
  if (!Array.isArray(values) || values.length < min || !values.every(nonempty))
    throw new Error(`${name} requires at least ${min} nonempty strings`);
}
function keys(object, allowed, name) {
  const unknown = Object.keys(object).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new Error(`${name}: unrecognized fields would be lost: ${unknown.join(",")}`);
}
function sourceUrl(source) {
  if (
    !nonempty(source) ||
    /[\u0000-\u001f]/.test(source) ||
    /^\s*(?:javascript|data|vbscript):/i.test(source)
  )
    throw new Error("Evidence source must be a safe nonempty path or URL");
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^https?:/i.test(source))
    throw new Error("Only HTTP(S), fragments and local paths are supported evidence sources");
  return source;
}

/** Reserved anchor of the fixed Overview region; section identifiers cannot reuse it. */
export const OVERVIEW_ID = "overview";

/**
 * Child explanations at this depth or deeper start collapsed unless `expanded: true`.
 * Depth 0 is a top-level section, depth 1 its first-level child.
 */
export const COLLAPSED_FROM_DEPTH = 2;

const PLACEHOLDER = /\{\{[^{}]*\}\}/;
/** The skeleton marks author-supplied prose as {{...}}; refuse to publish any left unfilled. */
function rejectPlaceholders(doc) {
  const found = [];
  const check = (value, at) => {
    if (typeof value === "string" && PLACEHOLDER.test(value)) found.push(at);
    else if (Array.isArray(value)) value.forEach((item, i) => check(item, `${at}[${i}]`));
    else if (value && typeof value === "object" && !value.code)
      for (const [key, inner] of Object.entries(value)) check(inner, `${at}.${key}`);
  };
  for (const field of ["title", "language", "purpose", "background", "summary", "summaryTitle"])
    check(doc[field], field);
  check(doc.overview?.paragraphs, "overview.paragraphs");
  check(doc.overview?.diagram?.explanation, "overview.diagram.explanation");
  check(doc.review?.basis, "review.basis");
  check(doc.review?.limitations, "review.limitations");
  check(doc.comprehensionCheck, "comprehensionCheck");
  (function visit(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      for (const field of ["title", "domain", "scope", "preview", "paragraphs"])
        check(node[field], `${node.id}.${field}`);
      check(node.diagram?.explanation, `${node.id}.diagram.explanation`);
      visit(node.children);
    }
  })(doc.sections);
  if (found.length) throw new Error(`Unfilled template placeholders remain: ${found.join(", ")}`);
}

const STRUCTURE_IN_TEXT = /^#{1,6}\s|^\s*(?:[-*+]|\d+[.)])\s/m;
/**
 * Body content is prose strings plus optional table, list and code blocks. The author chooses
 * which form explains each passage; the four-branch limit counts child nodes, not rows or items.
 */
function validateBody(items, at, { min = 0 } = {}) {
  if (!Array.isArray(items) || items.length < min)
    throw new Error(`${at} requires at least ${min} nonempty strings or blocks`);
  items.forEach((item, i) => {
    const where = `${at}[${i}]`;
    if (typeof item === "string") {
      if (!nonempty(item)) throw new Error(`${where}: text paragraphs must be nonempty strings`);
      if (STRUCTURE_IN_TEXT.test(item))
        throw new Error(
          `${where}: use a list block for list items and child nodes for headings, not plain text`,
        );
      return;
    }
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error(`${where}: expected nonempty strings or a table, list or code block`);
    const kinds = ["table", "list", "code"].filter((kind) => item[kind] !== undefined);
    if (kinds.length !== 1 || Object.keys(item).length !== 1)
      throw new Error(`${where}: a block has exactly one of table, list or code`);
    const block = item[kinds[0]];
    if (!block || typeof block !== "object" || Array.isArray(block))
      throw new Error(`${where}.${kinds[0]} must be an object`);
    if (kinds[0] === "table") {
      keys(block, ["caption", "headers", "rows"], `${where}.table`);
      if (block.caption !== undefined && !nonempty(block.caption))
        throw new Error(`${where}.table: caption must be nonempty when supplied`);
      strings(block.headers, `${where}.table.headers`, { min: 1 });
      if (
        !Array.isArray(block.rows) ||
        !block.rows.length ||
        !block.rows.every(
          (row) =>
            Array.isArray(row) &&
            row.length === block.headers.length &&
            row.every((cell) => typeof cell === "string"),
        )
      )
        throw new Error(`${where}.table: every row needs one text cell per header`);
    } else if (kinds[0] === "list") {
      keys(block, ["ordered", "items"], `${where}.list`);
      if (block.ordered !== undefined && typeof block.ordered !== "boolean")
        throw new Error(`${where}.list: ordered must be boolean`);
      strings(block.items, `${where}.list.items`, { min: 1 });
    } else {
      keys(block, ["text", "language"], `${where}.code`);
      if (typeof block.text !== "string" || !block.text.length)
        throw new Error(`${where}.code: text must be a nonempty literal string`);
      if (block.language !== undefined && !/^[A-Za-z0-9+#._-]+$/.test(block.language))
        throw new Error(`${where}.code: language must be a short identifier`);
    }
  });
}

/** Every figure source in the document, so one parser process can check them together. */
function diagramSources(doc) {
  const sources = [];
  const add = (diagram) => {
    if (typeof diagram?.source === "string") sources.push(diagram.source);
  };
  add(doc.overview?.diagram);
  (function visit(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      add(node?.diagram);
      visit(node?.children);
    }
  })(doc.sections);
  return sources;
}

/**
 * Validate observable hierarchy and coverage, never claim to grade prose quality.
 * `requireQuiz` enforces the report contract's mandatory quiz; the CLI always sets it.
 */
export function validateReport(doc, { requireQuiz = false } = {}) {
  if (doc && typeof doc === "object" && !Array.isArray(doc)) rejectPlaceholders(doc);
  if (!doc || !nonempty(doc.title) || !["en", "ko"].includes(doc.language))
    throw new Error("A report needs title and language en|ko");
  // Warm the parser cache in one process; a failed batch leaves each figure to its own parse.
  parseMermaidAll(diagramSources(doc));
  keys(
    doc,
    [
      "title",
      "language",
      "purpose",
      "background",
      "summary",
      "summaryTitle",
      "overview",
      "sections",
      "requiredEvidenceIds",
      "review",
      "comprehensionCheck",
    ],
    "report",
  );
  strings(doc.summary, "summary", { min: 1 });
  if (doc.purpose !== undefined) strings(doc.purpose, "purpose", { min: 1 });
  if (doc.background !== undefined) strings(doc.background, "background", { min: 1 });
  if (doc.summaryTitle !== undefined && !nonempty(doc.summaryTitle))
    throw new Error("summaryTitle must be a nonempty string when supplied");
  if (
    !doc.review ||
    !["reviewed", "draft"].includes(doc.review.status) ||
    !nonempty(doc.review.basis) ||
    typeof doc.review.limitations !== "string"
  )
    throw new Error("Report review metadata must state status, actual basis and limitations");
  keys(doc.review, ["status", "basis", "limitations"], "review");
  if (
    !Array.isArray(doc.requiredEvidenceIds) ||
    !doc.requiredEvidenceIds.every(nonempty) ||
    new Set(doc.requiredEvidenceIds).size !== doc.requiredEvidenceIds.length
  )
    throw new Error("requiredEvidenceIds must contain unique source identifiers");
  const ids = new Set(),
    evidenceIds = new Set(),
    fragments = [],
    warnings = [];
  /** Optional figures warn instead of failing; required figures must parse. */
  function checkDiagram(diagram, owner) {
    if (typeof diagram !== "object" || Array.isArray(diagram))
      throw new Error(`${owner}: diagram must be an object`);
    keys(diagram, ["source", "explanation", "required"], `${owner}.diagram`);
    if (diagram.required !== undefined && typeof diagram.required !== "boolean")
      throw new Error(`${owner}: required must be boolean`);
    if (![diagram.source, diagram.explanation].every(nonempty))
      throw new Error(`${owner}: a diagram needs source and an explanation`);
    const parsed = parseMermaid(diagram.source);
    if (parsed.error) {
      if (diagram.required !== false)
        throw new Error(`${owner}: required diagram: ${parsed.error}`);
      warnings.push(`${owner}: ${parsed.error}`);
    }
  }
  if (doc.overview !== undefined) {
    const overview = doc.overview;
    if (!overview || typeof overview !== "object" || Array.isArray(overview))
      throw new Error("overview must be an object");
    keys(overview, ["paragraphs", "diagram"], "overview");
    validateBody(overview.paragraphs, "overview.paragraphs", { min: 1 });
    if (overview.diagram !== undefined && overview.diagram !== null)
      checkDiagram(overview.diagram, "overview");
    ids.add(OVERVIEW_ID);
  }
  /** Limit explanation branches; sources and quizzes support their owning branch. */
  function visit(nodes, at, minimum = 1) {
    if (!Array.isArray(nodes) || nodes.length < minimum || nodes.length > 4)
      throw new Error(`${at}: provide one to four children grouped by domain responsibility`);
    for (const node of nodes) {
      if (!node || !/^[a-z][a-z0-9-]*$/.test(node.id) || ids.has(node.id))
        throw new Error(`${at}: unique safe node identifiers are required`);
      ids.add(node.id);
      keys(
        node,
        [
          "id",
          "title",
          "domain",
          "scope",
          "preview",
          "paragraphs",
          "children",
          "diagram",
          "evidence",
          "expanded",
        ],
        node.id,
      );
      if (![node.title, node.domain, node.scope].every(nonempty))
        throw new Error(`${node.id}: title, domain and scope are required`);
      if (node.expanded !== undefined && typeof node.expanded !== "boolean")
        throw new Error(`${node.id}: expanded must be boolean`);
      if (node.preview !== undefined && !nonempty(node.preview))
        throw new Error(`${node.id}: preview must be a nonempty string when supplied`);
      if (node.paragraphs !== undefined) validateBody(node.paragraphs, `${node.id}.paragraphs`);
      if (node.evidence !== undefined) {
        if (!Array.isArray(node.evidence)) throw new Error(`${node.id}: evidence must be an array`);
        for (const item of node.evidence) {
          if (!item || !nonempty(item.id) || evidenceIds.has(item.id) || !nonempty(item.label))
            throw new Error(`${node.id}: evidence identifiers must be unique and labeled`);
          evidenceIds.add(item.id);
          sourceUrl(item.source);
          if (item.source.startsWith("#")) fragments.push(item.source.slice(1));
          keys(item, ["id", "label", "source", "excerpt", "expanded", "kind"], item.id);
          if (item.kind !== undefined && !["excerpt", "diff"].includes(item.kind))
            throw new Error(`${item.id}: evidence kind must be excerpt or diff`);
          if (item.kind === "diff") parseCodeDiff(item.excerpt);
          if (item.expanded !== undefined && typeof item.expanded !== "boolean")
            throw new Error(`${item.id}: expanded must be boolean`);
          if (item.excerpt !== undefined && typeof item.excerpt !== "string")
            throw new Error(`${node.id}: excerpts must be literal strings`);
        }
      }
      if (node.diagram !== undefined && node.diagram !== null) checkDiagram(node.diagram, node.id);
      if (node.children !== undefined) visit(node.children, node.id, 0);
      if (
        !(node.paragraphs?.length || node.children?.length || node.evidence?.length || node.diagram)
      )
        throw new Error(`${node.id}: empty explanation node`);
    }
  }
  visit(doc.sections, "report");
  if (requireQuiz && doc.comprehensionCheck === undefined)
    throw new Error(
      `A report needs comprehensionCheck with 1 to ${MAX_QUESTIONS} questions, or { "excluded": "<the user's request>" } when the user excluded the quiz`,
    );
  if (doc.comprehensionCheck !== undefined && doc.comprehensionCheck?.excluded !== undefined) {
    keys(doc.comprehensionCheck, ["excluded"], "comprehensionCheck");
    if (!nonempty(doc.comprehensionCheck.excluded))
      throw new Error("comprehensionCheck.excluded must state the user's exclusion request");
  } else if (doc.comprehensionCheck !== undefined) {
    const check = doc.comprehensionCheck;
    if (!check || typeof check !== "object" || Array.isArray(check))
      throw new Error("comprehensionCheck must be an object");
    keys(check, ["questions"], "comprehensionCheck");
    validateQuestions(check.questions);
    for (const question of check.questions) {
      keys(
        question,
        [
          "id",
          "sectionId",
          "question",
          "options",
          "revisit",
          "correctOptionId",
          "explanation",
          "evidence",
        ],
        question.id,
      );
      for (const option of question.options)
        keys(option, ["id", "text", "feedback"], `${question.id}.${option.id}`);
      if (!ids.has(question.sectionId) || question.sectionId === OVERVIEW_ID)
        throw new Error(`${question.id}: unknown question sectionId`);
    }
  }
  for (const fragment of fragments)
    if (!ids.has(fragment)) throw new Error(`Unknown report fragment: #${fragment}`);
  const missing = doc.requiredEvidenceIds.filter((id) => !evidenceIds.has(id));
  const extra = [...evidenceIds].filter((id) => !doc.requiredEvidenceIds.includes(id));
  if (missing.length || extra.length)
    throw new Error(
      `Evidence coverage mismatch; missing=${missing.join(",")}; unlisted=${extra.join(",")}`,
    );
  return {
    nodes: ids.size,
    evidence: evidenceIds.size,
    warnings,
    semanticReview: doc.review.status,
  };
}

const labels = {
  en: {
    purpose: "Purpose",
    context: "Context",
    overview: "Overview",
    revisitExplanation: "Revisit the explanation",
    scope: "Scope",
    evidence: "Evidence",
    source: "Mermaid source",
    fallback: "Diagram not rendered: unsupported syntax; inspect the source.",
    review: "Editorial review",
    draft: "Draft — editorial review is not complete",
    limitations: "Limits",
    diagramScroll: "Scroll horizontally to read the full diagram.",
  },
  ko: {
    purpose: "목표",
    context: "배경",
    overview: "전체 그림",
    revisitExplanation: "관련 설명 다시 보기",
    scope: "설명 범위",
    evidence: "근거",
    source: "Mermaid 원문",
    fallback: "다이어그램 미렌더링: 지원하지 않는 구문입니다. 원문을 확인하세요.",
    review: "내용 검토",
    draft: "초안 — 내용 검토 미완료",
    limitations: "확인 한계",
    diagramScroll: "다이어그램이 화면보다 넓으면 가로로 스크롤해 전체를 확인하세요.",
  },
};
/** Render prose and the author's chosen blocks; every value is escaped text. */
const paragraphs = (items) =>
  (items ?? [])
    .map((item) => {
      if (typeof item === "string")
        return item
          .split(/\n\s*\n/)
          .map((p) => `<p>${esc(p)}</p>`)
          .join("");
      if (item.table) {
        const { caption, headers, rows } = item.table;
        return `<div class="table-wrap" role="region" tabindex="0"${caption ? ` aria-label="${esc(caption)}"` : ""}><table>${caption ? `<caption>${esc(caption)}</caption>` : ""}<thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      }
      if (item.list) {
        const tag = item.list.ordered ? "ol" : "ul";
        return `<${tag} class="body-list">${item.list.items.map((text) => `<li>${esc(text)}</li>`).join("")}</${tag}>`;
      }
      return `<pre class="body-code"><code${item.code.language ? ` data-language="${esc(item.code.language)}"` : ""}>${esc(item.code.text)}</code></pre>`;
    })
    .join("");

/** First-level children start open; deeper explanations open only when the author marks them. */
const startsOpen = (node, depth) =>
  depth < COLLAPSED_FROM_DEPTH ? node.expanded !== false : node.expanded === true;

/** Render one standalone HTML page; data and evidence text cannot execute markup. */
export function renderHtml(doc) {
  return renderValidatedHtml(doc, validateReport(doc));
}

function renderValidatedHtml(doc, result) {
  const ui = labels[doc.language],
    quizUi = quizLabels[doc.language],
    questions = doc.comprehensionCheck?.questions ?? [];
  function figure(diagram, idPrefix) {
    return `<p class="diagram-scroll">${esc(ui.diagramScroll)}</p>${renderMermaid(diagram.source, { diagramSource: ui.source, diagramFallback: ui.fallback, diagramPending: doc.language === "ko" ? "다이어그램 생성 대기 중입니다. 아래 원문을 확인할 수 있습니다." : undefined, idPrefix })}<p>${esc(diagram.explanation)}</p>`;
  }
  /** The fixed Overview region: the whole as parts, then a map of the sections that open them. */
  function overview() {
    if (!doc.overview)
      return `<nav aria-label="Domains">${doc.sections.map((n) => `<a href="#${esc(n.id)}">${esc(n.title)}</a>`).join("")}</nav>`;
    const map = doc.sections
      .map(
        (n) =>
          `<li><a href="#${esc(n.id)}">${esc(n.title)}</a><span class="branch-preview">${esc(n.preview ?? n.scope)}</span></li>`,
      )
      .join("");
    return `<section class="report-overview" id="${OVERVIEW_ID}"><h2>${esc(ui.overview)}</h2>${paragraphs(doc.overview.paragraphs)}${doc.overview.diagram ? figure(doc.overview.diagram, OVERVIEW_ID) : ""}<nav aria-label="${esc(ui.overview)}"><ol class="reading-map">${map}</ol></nav></section>`;
  }
  function evidenceGroup(items, nodeId) {
    if (!items?.length) return "";
    const evidence = items
      .map((item, index) => {
        const content =
          item.kind === "diff"
            ? `<div class="code-diff" tabindex="0" role="region" aria-label="${esc(item.label)}">${renderCodeDiff(item.excerpt, `${nodeId}-diff-${index}`)}</div>`
            : item.excerpt !== undefined
              ? `<pre><code>${esc(item.excerpt)}</code></pre>`
              : "";
        return `<details class="evidence"${item.expanded ? ' open data-print-expanded="true"' : ""}><summary>${esc(item.label)}</summary><p><a href="${esc(sourceUrl(item.source))}">${esc(item.source)}</a></p>${content}</details>`;
      })
      .join("");
    return `<details class="evidence-group"${items.some((item) => item.expanded) ? ' open data-print-expanded="true"' : ""}><summary>${esc(ui.evidence)} · ${items.length}</summary>${evidence}</details>`;
  }
  /** Keep each question after its explanation and before that domain's source evidence. */
  function nodes(items, depth = 0) {
    return items
      .map((node) => {
        const tag = depth === 0 ? "section" : "details";
        const nodeQuestions = questions.filter((q) => q.sectionId === node.id);
        return `<${tag} class="report-node" data-domain="${esc(node.domain)}" data-depth="${depth}" id="${esc(node.id)}"${depth > 0 && startsOpen(node, depth) ? " open" : ""}>
${depth === 0 ? `<h2>${esc(node.title)}</h2>${node.preview ? `<p class="branch-preview">${esc(node.preview)}</p>` : ""}` : `<summary>${esc(node.title)}<span class="branch-preview">${esc(node.preview ?? node.scope)}</span></summary>`}
${depth === 0 || node.preview ? `<p class="scope">${esc(node.scope)}</p>` : ""}${paragraphs(node.paragraphs)}
${node.diagram ? figure(node.diagram, node.id) : ""}
${node.children ? `<div class="report-children">${nodes(node.children, depth + 1)}</div>` : ""}
${
  nodeQuestions.length
    ? `<div class="comprehension"><h3>${esc(quizUi.comprehension)}</h3>${node.children?.length ? `<p class="revisit-explanation">${esc(ui.revisitExplanation)}: ${node.children.map((child) => `<a href="#${esc(child.id)}">${esc(child.title)}</a>`).join(" · ")}</p>` : ""}${nodeQuestions
        .map((q) => renderQuestion(q, questions.indexOf(q), quizUi))
        .join("")}</div>`
    : ""
}
${evidenceGroup(node.evidence, node.id)}
</${tag}>`;
      })
      .join("");
  }
  return `<!doctype html><html lang="${doc.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="report-writer-policy" content="domain-hierarchy-v1"><link rel="icon" href="data:,"><title>${esc(doc.title)}</title><style>
${questions.length ? quizCss : ""}
${
  doc.sections.some(function hasDiff(node) {
    return node.evidence?.some((item) => item.kind === "diff") || node.children?.some(hasDiff);
  })
    ? diffCss
    : ""
}
${reportCss}
</style></head><body><main><header><h1>${esc(doc.title)}</h1>${doc.purpose ? `<section class="report-purpose"><h2>${ui.purpose}</h2>${paragraphs(doc.purpose)}</section>` : ""}${doc.background ? `<section class="report-background"><h2>${ui.context}</h2>${paragraphs(doc.background)}</section>` : ""}</header>
<section class="report-answer">${doc.summaryTitle ? `<h2>${esc(doc.summaryTitle)}</h2>` : ""}${paragraphs(doc.summary)}${doc.review.status === "draft" ? `<p class="draft">${ui.draft}</p>` : ""}</section>
${overview()}
${nodes(doc.sections)}<footer><p class="review">${ui.review}: ${esc(doc.review.basis)}</p>${doc.review.limitations ? `<p class="review">${ui.limitations}: ${esc(doc.review.limitations)}</p>` : ""}${result.warnings.map((w) => `<p class="draft">${esc(w)}</p>`).join("")}</footer>
</main><script>document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{let n=document.getElementById(a.hash.slice(1));while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}}));
let printClosed=null;window.addEventListener('beforeprint',()=>{if(printClosed===null)printClosed=[...document.querySelectorAll('details.report-node:not([open]),details[data-print-expanded="true"]:not([open])')];printClosed.forEach(n=>n.open=true);});window.addEventListener('afterprint',()=>{(printClosed??[]).forEach(n=>n.open=false);printClosed=null;});
document.querySelectorAll('.diagram__viewport').forEach(n=>{n.tabIndex=0;n.setAttribute('role','region');n.setAttribute('aria-label',${JSON.stringify(ui.diagramScroll)});});
${quizScript(quizUi)}
</script>${
    doc.overview?.diagram ||
    doc.sections.some(function hasDiagram(n) {
      return n.diagram || n.children?.some(hasDiagram);
    })
      ? mermaidRuntime({ diagramFallback: ui.fallback })
      : ""
  }</body></html>`;
}

function md(text) {
  return String(text).replace(/[\\`*_[\]<>#]/g, "\\$&");
}
const cell = (text) => md(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
/** Markdown mirrors the same blocks: GFM tables, lists and fenced code. */
function bodyLines(items) {
  return (items ?? []).flatMap((item) => {
    if (typeof item === "string") return [md(item), ""];
    if (item.table) {
      const { caption, headers, rows } = item.table;
      return [
        ...(caption ? [`**${md(caption)}**`, ""] : []),
        `| ${headers.map(cell).join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
        "",
      ];
    }
    if (item.list)
      return [
        ...item.list.items.map((text, i) => `${item.list.ordered ? `${i + 1}.` : "-"} ${md(text)}`),
        "",
      ];
    return fenced(item.code.text, item.code.language ?? "text");
  });
}
function fenced(text, language) {
  const fence = "`".repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((s) => s.length + 1)));
  return [fence + language, text, fence, ""];
}
/** Markdown keeps the same domain tree and complete sources as the HTML view. */
export function renderMarkdown(doc) {
  validateReport(doc);
  return renderValidatedMarkdown(doc);
}

function renderValidatedMarkdown(doc) {
  const ui = labels[doc.language];
  /** One figure in Markdown: a fallback note when it does not parse, its source, then its reading. */
  const diagramLines = (diagram) => {
    const parsed = parseMermaid(diagram.source);
    return [
      ...(parsed.error ? [`> ${ui.fallback} ${md(parsed.error)}`, ""] : []),
      ...fenced(diagram.source, "mermaid"),
      md(diagram.explanation),
      "",
    ];
  };
  const quizUi = quizLabels[doc.language];
  const lines = [`# ${md(doc.title)}`, ""];
  if (doc.purpose) lines.push(`## ${ui.purpose}`, "", ...doc.purpose.flatMap((p) => [md(p), ""]));
  if (doc.background)
    lines.push(`## ${ui.context}`, "", ...doc.background.flatMap((p) => [md(p), ""]));
  if (doc.purpose || doc.background) lines.push("---", "");
  if (doc.summaryTitle) lines.push(`## ${md(doc.summaryTitle)}`, "");
  lines.push(...doc.summary.flatMap((p) => [md(p), ""]));
  if (doc.review.status === "draft") lines.push(`> ${ui.draft}`, "");
  if (doc.overview) {
    lines.push(`<a id="${OVERVIEW_ID}"></a>`, "", `## ${ui.overview}`, "");
    lines.push(...bodyLines(doc.overview.paragraphs));
    if (doc.overview.diagram) {
      lines.push(...diagramLines(doc.overview.diagram));
    }
    doc.sections.forEach((n, i) =>
      lines.push(`${i + 1}. [${md(n.title)}](#${n.id}) — ${md(n.preview ?? n.scope)}`),
    );
    lines.push("");
  }
  /** Preserve domain ownership while separating printable choices from answer explanations. */
  function visit(items, depth = 2) {
    if (depth > 6)
      throw new Error(
        "Markdown heading depth exceeds six; regroup domain scope without losing evidence",
      );
    for (const node of items) {
      lines.push(
        `<a id="${node.id}"></a>`,
        "",
        `${"#".repeat(depth)} ${md(node.title)}`,
        "",
        ...(node.preview ? [md(node.preview), ""] : []),
        md(node.scope),
        "",
      );
      lines.push(...bodyLines(node.paragraphs));
      if (node.diagram) {
        lines.push(...diagramLines(node.diagram));
      }
      if (node.children) visit(node.children, depth + 1);
      const questions =
        doc.comprehensionCheck?.questions?.filter((q) => q.sectionId === node.id) ?? [];
      if (questions.length) {
        lines.push(`**${md(node.title)} · ${quizUi.comprehension}**`, "");
        for (const q of questions) {
          lines.push(`**${q.id}. ${md(q.question)}**`, "", quizUi.recallCue, "");
          for (const option of q.options) lines.push(`${option.id}. ${md(option.text)}`, "");
          lines.push(quizUi.teachBackCue, "");
          if (q.revisit) lines.push(quizUi.revisitGuidance, "");
        }
        lines.push("---", "", `**${quizUi.answers}**`, "");
        for (const q of questions) {
          lines.push(
            `**${q.id}: ${q.correctOptionId}** — ${md(q.explanation)}`,
            "",
            `${quizUi.gradingEvidence}: ${md(q.evidence)}`,
            "",
          );
          for (const option of q.options) lines.push(`${option.id}. ${md(option.feedback)}`, "");
        }
        lines.push(quizUi.selfCheckLimit, "", "---", "");
      }
      if (node.evidence?.length) lines.push(`**${md(node.title)} · ${ui.evidence}**`, "");
      for (const evidence of node.evidence ?? []) {
        lines.push(`[${md(evidence.label)}](<${encodeURI(sourceUrl(evidence.source))}>)`, "");
        if (evidence.excerpt !== undefined) {
          lines.push(...fenced(evidence.excerpt, evidence.kind === "diff" ? "diff" : "text"));
        }
      }
    }
  }
  visit(doc.sections);
  lines.push(`${ui.review}: ${md(doc.review.basis)}`, "");
  if (doc.review.limitations) lines.push(`${ui.limitations}: ${md(doc.review.limitations)}`, "");
  return lines.join("\n");
}

function main(args) {
  const input = args.shift();
  let out,
    format = "html";
  while (args.length) {
    const flag = args.shift();
    if (flag === "--out") out = args.shift();
    else if (flag === "--format") format = args.shift();
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!input || !out || !["html", "markdown"].includes(format))
    throw new Error(
      "Usage: render-report.mjs report.json --out report.html [--format html|markdown]",
    );
  const doc = JSON.parse(readFileSync(input, "utf8"));
  const result = validateReport(doc, { requireQuiz: true });
  const output =
    format === "html" ? renderValidatedHtml(doc, result) : renderValidatedMarkdown(doc);
  writeFileSync(out, output);
  console.log(JSON.stringify({ output: path.resolve(out), ...result }));
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(path.resolve(process.argv[1]))).href
)
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
