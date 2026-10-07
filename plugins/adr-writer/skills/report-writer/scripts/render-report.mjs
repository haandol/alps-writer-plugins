#!/usr/bin/env node
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseMermaid, renderMermaid } from "./mermaid.mjs";
import { parseCodeDiff, renderCodeDiff, diffCss } from "./code-diff.mjs";
import {
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

/** Validate observable hierarchy and coverage, never claim to grade prose quality. */
export function validateReport(doc) {
  if (!doc || !nonempty(doc.title) || !["en", "ko"].includes(doc.language))
    throw new Error("A report needs title and language en|ko");
  keys(
    doc,
    [
      "title",
      "language",
      "background",
      "summary",
      "summaryTitle",
      "sections",
      "requiredEvidenceIds",
      "review",
      "comprehensionCheck",
    ],
    "report",
  );
  strings(doc.summary, "summary", { min: 1 });
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
      if (node.paragraphs !== undefined) {
        strings(node.paragraphs, `${node.id}.paragraphs`);
        if (node.paragraphs.some((p) => /^#{1,6}\s|^\s*(?:[-*+]|\d+[.)])\s/m.test(p)))
          throw new Error(`${node.id}: encode headings and peer lists as child nodes`);
      }
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
      if (node.diagram !== undefined && node.diagram !== null) {
        if (typeof node.diagram !== "object" || Array.isArray(node.diagram))
          throw new Error(`${node.id}: diagram must be an object`);
        keys(node.diagram, ["source", "explanation", "required"], `${node.id}.diagram`);
        if (node.diagram.required !== undefined && typeof node.diagram.required !== "boolean")
          throw new Error(`${node.id}: required must be boolean`);
        if (![node.diagram.source, node.diagram.explanation].every(nonempty))
          throw new Error(`${node.id}: a diagram needs source and an explanation`);
        const parsed = parseMermaid(node.diagram.source);
        if (parsed.error) {
          if (node.diagram.required !== false)
            throw new Error(`${node.id}: required diagram: ${parsed.error}`);
          warnings.push(`${node.id}: ${parsed.error}`);
        }
      }
      if (node.children !== undefined) visit(node.children, node.id, 0);
      if (
        !(node.paragraphs?.length || node.children?.length || node.evidence?.length || node.diagram)
      )
        throw new Error(`${node.id}: empty explanation node`);
    }
  }
  visit(doc.sections, "report");
  if (doc.comprehensionCheck !== undefined) {
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
      if (!ids.has(question.sectionId))
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
    backgroundGoals: "Background and goals",
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
    backgroundGoals: "배경과 목표",
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
const paragraphs = (items) =>
  (items ?? [])
    .map((text) =>
      text
        .split(/\n\s*\n/)
        .map((p) => `<p>${esc(p)}</p>`)
        .join(""),
    )
    .join("");

/** Render one standalone HTML page; data and evidence text cannot execute markup. */
export function renderHtml(doc) {
  return renderValidatedHtml(doc, validateReport(doc));
}

function renderValidatedHtml(doc, result) {
  const ui = labels[doc.language],
    quizUi = quizLabels[doc.language],
    questions = doc.comprehensionCheck?.questions ?? [];
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
        return `<${tag} class="report-node" data-domain="${esc(node.domain)}" data-depth="${depth}" id="${esc(node.id)}"${depth > 0 && node.expanded !== false ? " open" : ""}>
${depth === 0 ? `<h2>${esc(node.title)}</h2>${node.preview ? `<p class="branch-preview">${esc(node.preview)}</p>` : ""}` : `<summary>${esc(node.title)}<span class="branch-preview">${esc(node.preview ?? node.scope)}</span></summary>`}
${depth === 0 || node.preview ? `<p class="scope">${esc(node.scope)}</p>` : ""}${paragraphs(node.paragraphs)}
${node.diagram ? `<p class="diagram-scroll">${esc(ui.diagramScroll)}</p>${renderMermaid(node.diagram.source, { diagramSource: ui.source, diagramFallback: ui.fallback, idPrefix: node.id })}<p>${esc(node.diagram.explanation)}</p>` : ""}
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
</style></head><body><main><header><h1>${esc(doc.title)}</h1>${doc.background ? `<section class="report-background"><h2>${ui.backgroundGoals}</h2>${paragraphs(doc.background)}</section>` : ""}</header>
<section class="report-answer">${doc.summaryTitle ? `<h2>${esc(doc.summaryTitle)}</h2>` : ""}${paragraphs(doc.summary)}${doc.review.status === "draft" ? `<p class="draft">${ui.draft}</p>` : ""}</section>
<nav aria-label="Domains">${doc.sections.map((n) => `<a href="#${esc(n.id)}">${esc(n.title)}</a>`).join("")}</nav>
${nodes(doc.sections)}<footer><p class="review">${ui.review}: ${esc(doc.review.basis)}</p>${doc.review.limitations ? `<p class="review">${ui.limitations}: ${esc(doc.review.limitations)}</p>` : ""}${result.warnings.map((w) => `<p class="draft">${esc(w)}</p>`).join("")}</footer>
</main><script>document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{let n=document.getElementById(a.hash.slice(1));while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}}));
let printClosed=null;window.addEventListener('beforeprint',()=>{if(printClosed===null)printClosed=[...document.querySelectorAll('details.report-node:not([open]),details[data-print-expanded="true"]:not([open])')];printClosed.forEach(n=>n.open=true);});window.addEventListener('afterprint',()=>{(printClosed??[]).forEach(n=>n.open=false);printClosed=null;});
document.querySelectorAll('.diagram__viewport').forEach(n=>{n.tabIndex=0;n.setAttribute('role','region');n.setAttribute('aria-label',${JSON.stringify(ui.diagramScroll)});});
${quizScript(quizUi)}
</script></body></html>`;
}

function md(text) {
  return String(text).replace(/[\\`*_[\]<>#]/g, "\\$&");
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
  const quizUi = quizLabels[doc.language];
  const lines = [`# ${md(doc.title)}`, ""];
  if (doc.background)
    lines.push(
      `## ${ui.backgroundGoals}`,
      "",
      ...doc.background.flatMap((p) => [md(p), ""]),
      "---",
      "",
    );
  if (doc.summaryTitle) lines.push(`## ${md(doc.summaryTitle)}`, "");
  lines.push(...doc.summary.flatMap((p) => [md(p), ""]));
  if (doc.review.status === "draft") lines.push(`> ${ui.draft}`, "");
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
      for (const paragraph of node.paragraphs ?? []) lines.push(md(paragraph), "");
      if (node.diagram) {
        const diagram = parseMermaid(node.diagram.source);
        if (diagram.error) lines.push(`> ${ui.fallback} ${md(diagram.error)}`, "");
        lines.push(...fenced(node.diagram.source, "mermaid"), md(node.diagram.explanation), "");
      }
      if (node.children) visit(node.children, depth + 1);
      const questions =
        doc.comprehensionCheck?.questions.filter((q) => q.sectionId === node.id) ?? [];
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
  const result = validateReport(doc);
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
