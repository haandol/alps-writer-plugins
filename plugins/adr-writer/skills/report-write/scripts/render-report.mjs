#!/usr/bin/env node
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseMermaid, renderMermaid } from "./mermaid.mjs";
import {
  validateQuestions,
  renderQuestion,
  quizLabels,
  quizCss,
  quizScript,
} from "./comprehension.mjs";

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
function strings(values, name, { min = 0, max = 4 } = {}) {
  if (
    !Array.isArray(values) ||
    values.length < min ||
    values.length > max ||
    !values.every(nonempty) ||
    values.flatMap((v) => v.split(/\n\s*\n/).filter((p) => p.trim())).length > max
  )
    throw new Error(`${name} requires ${min}..${max} nonempty strings`);
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
      "summary",
      "sections",
      "requiredEvidenceIds",
      "review",
      "comprehensionCheck",
    ],
    "report",
  );
  strings(doc.summary, "summary", { min: 1 });
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
    peerCounts = new Map(),
    evidenceIds = new Set(),
    fragments = [],
    warnings = [];
  /** Count domain children and source disclosures before assigning quiz questions. */
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
      if (node.paragraphs !== undefined) {
        strings(node.paragraphs, `${node.id}.paragraphs`);
        if (node.paragraphs.some((p) => /^#{1,6}\s|^\s*(?:[-*+]|\d+[.)])\s/m.test(p)))
          throw new Error(`${node.id}: encode headings and peer lists as child nodes`);
      }
      if (node.evidence !== undefined) {
        if (!Array.isArray(node.evidence) || node.evidence.length > 4)
          throw new Error(`${node.id}: split evidence into meaningful groups of at most four`);
        for (const item of node.evidence) {
          if (!item || !nonempty(item.id) || evidenceIds.has(item.id) || !nonempty(item.label))
            throw new Error(`${node.id}: evidence identifiers must be unique and labeled`);
          evidenceIds.add(item.id);
          sourceUrl(item.source);
          if (item.source.startsWith("#")) fragments.push(item.source.slice(1));
          keys(item, ["id", "label", "source", "excerpt"], item.id);
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
      if ((node.children?.length ?? 0) + (node.evidence?.length ?? 0) > 4)
        throw new Error(
          `${node.id}: child explanations and evidence together exceed four peer units; regroup by responsibility`,
        );
      peerCounts.set(node.id, (node.children?.length ?? 0) + (node.evidence?.length ?? 0));
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
      const count = peerCounts.get(question.sectionId) + 1;
      if (count > 4)
        throw new Error(
          `${question.sectionId}: questions, children and evidence together exceed four peer units`,
        );
      peerCounts.set(question.sectionId, count);
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
  const result = validateReport(doc),
    ui = labels[doc.language],
    quizUi = quizLabels[doc.language],
    questions = doc.comprehensionCheck?.questions ?? [];
  /** Keep each question after its explanation and before that domain's source evidence. */
  function nodes(items, depth = 0) {
    return items
      .map((node) => {
        const tag = depth === 0 ? "section" : "details";
        return `<${tag} class="report-node" data-domain="${esc(node.domain)}" data-depth="${depth}" id="${esc(node.id)}"${depth > 0 && node.expanded ? " open" : ""}>
${depth === 0 ? `<h2>${esc(node.title)}</h2>` : `<summary>${esc(node.title)}</summary>`}
<p class="scope">${esc(node.scope)}</p>${paragraphs(node.paragraphs)}
${node.diagram ? `<p class="diagram-scroll">${esc(ui.diagramScroll)}</p>${renderMermaid(node.diagram.source, { diagramSource: ui.source, diagramFallback: ui.fallback, idPrefix: node.id })}<p>${esc(node.diagram.explanation)}</p>` : ""}
${node.children ? `<div class="report-children">${nodes(node.children, depth + 1)}</div>` : ""}
${
  questions.some((q) => q.sectionId === node.id)
    ? `<div class="comprehension"><h3>${esc(quizUi.comprehension)}</h3>${questions
        .filter((q) => q.sectionId === node.id)
        .map((q) => renderQuestion(q, questions.indexOf(q), quizUi))
        .join("")}</div>`
    : ""
}
${node.evidence?.length ? `<div class="evidence-group">${node.evidence.map((e) => `<details class="evidence"><summary>${esc(e.label)}</summary><p><a href="${esc(sourceUrl(e.source))}">${esc(e.source)}</a></p>${e.excerpt !== undefined ? `<pre><code>${esc(e.excerpt)}</code></pre>` : ""}</details>`).join("")}</div>` : ""}
</${tag}>`;
      })
      .join("");
  }
  return `<!doctype html><html lang="${doc.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="report-write-policy" content="domain-hierarchy-v1"><link rel="icon" href="data:,"><title>${esc(doc.title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#19384c;font:16px/1.85 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}main{max-width:1140px;margin:auto;padding:28px 28px 60px}header{border-bottom:2px solid #69899e;padding-bottom:22px}h1{font-size:32px;line-height:1.45;word-break:keep-all}h2{font-size:24px;line-height:1.55;word-break:keep-all}p{max-inline-size:48rem;margin:1em 0;word-break:keep-all;overflow-wrap:break-word}summary{cursor:pointer;color:#265987;word-break:keep-all;overflow-wrap:anywhere}a{color:#265987;overflow-wrap:anywhere}.scope,.review{font-size:13px;color:#5b7285}.report-node{margin-top:24px;padding-top:18px;border-top:1px solid #d6e1e9}.report-children>.report-node{border:1px solid #d6e1e9;border-radius:7px;padding:13px 17px;margin-top:14px}.report-children>.report-node>summary{font-size:18px;font-weight:600}.evidence{border-left:3px solid #bdd0dd;padding:8px 14px;margin:12px 0}.evidence-group{margin-top:18px}nav{display:flex;flex-wrap:wrap;gap:18px;margin:22px 0}.draft{padding:15px;background:#fff2d8}.diagram{margin:20px 0}.diagram__viewport{overflow:auto}.diagram svg{display:block;color:#355b70}.diagram svg text{font:14px sans-serif;fill:#19384c}.diagram-node rect,.diagram-node path,.sequence__participant rect{fill:#f3f7fa;stroke:#69899e}.diagram-boundary rect,.sequence__frame{fill:none;stroke:#98afbe}.sequence__note rect{fill:#fff7dd;stroke:#baa566}.sequence__lifeline{stroke:#a7bac6;stroke-dasharray:5 5}.diagram-source{margin-top:12px}pre{max-height:620px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#173145;color:#eff6fb;padding:17px;border-radius:7px;font:12px/1.8 ui-monospace,monospace}footer{margin-top:28px;border-top:1px solid #d6e1e9;padding-top:16px}@media(max-width:700px){main{padding:17px}h1{font-size:26px}.report-children>.report-node{padding:12px}.diagram svg{min-width:600px}}@media print{main{padding:0}.diagram__viewport{overflow:visible}.diagram svg{width:100%!important;min-width:0;max-width:100%!important}.diagram-source{display:none}pre{max-height:none}h2,summary{break-after:avoid}}
.diagram-scroll{display:none}@media(max-width:700px){.diagram-scroll{display:block;font-size:13px;color:#5b7285}}@media print{.diagram-scroll{display:none}.evidence{break-inside:avoid}}
${quizCss}
</style></head><body><main><header><h1>${esc(doc.title)}</h1>${paragraphs(doc.summary)}${doc.review.status === "draft" ? `<p class="draft">${ui.draft}</p>` : ""}</header>
<nav aria-label="Domains">${doc.sections.map((n) => `<a href="#${esc(n.id)}">${esc(n.title)}</a>`).join("")}</nav>
${nodes(doc.sections)}<footer><p class="review">${ui.review}: ${esc(doc.review.basis)}</p>${doc.review.limitations ? `<p class="review">${ui.limitations}: ${esc(doc.review.limitations)}</p>` : ""}${result.warnings.map((w) => `<p class="draft">${esc(w)}</p>`).join("")}</footer>
</main><script>document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{let n=document.getElementById(a.hash.slice(1));while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}}));
let printClosed=[];window.addEventListener('beforeprint',()=>{printClosed=[...document.querySelectorAll('details:not([open]):not(.diagram-source)')];printClosed.forEach(n=>n.open=true);});window.addEventListener('afterprint',()=>{printClosed.forEach(n=>n.open=false);printClosed=[];});
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
  const ui = labels[doc.language];
  const quizUi = quizLabels[doc.language];
  const lines = [`# ${md(doc.title)}`, "", ...doc.summary.flatMap((p) => [md(p), ""])];
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
        md(node.scope),
        "",
      );
      for (const paragraph of node.paragraphs ?? []) lines.push(md(paragraph), "");
      if (node.diagram) {
        const diagram = parseMermaid(node.diagram.source);
        if (diagram.error) lines.push(`> ${ui.fallback} ${md(diagram.error)}`, "");
        lines.push(...fenced(node.diagram.source, "mermaid"), md(node.diagram.explanation), "");
      }
      const questions =
        doc.comprehensionCheck?.questions.filter((q) => q.sectionId === node.id) ?? [];
      if (questions.length) {
        lines.push(`**${quizUi.comprehension}**`, "");
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
      for (const evidence of node.evidence ?? []) {
        lines.push(`[${md(evidence.label)}](<${encodeURI(sourceUrl(evidence.source))}>)`, "");
        if (evidence.excerpt !== undefined) {
          lines.push(...fenced(evidence.excerpt, "text"));
        }
      }
      if (node.children) visit(node.children, depth + 1);
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
  writeFileSync(out, format === "html" ? renderHtml(doc) : renderMarkdown(doc));
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
