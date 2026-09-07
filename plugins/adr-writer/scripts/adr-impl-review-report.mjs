#!/usr/bin/env node
// adr-impl-review-report.mjs — render an ADR impl-review punch list as a
// self-contained HTML review page, and collect the user's per-finding
// decisions back as feedback.json.
//
// This is the common "show the report, get feedback as a file" half of
// /adr-impl-review. Standard and full reviews serialize their evidence-backed
// results to JSON and hand them here. We turn that JSON into ONE standalone HTML
// file — no server, no
// browser automation, no python. The page leads with the verdict and verified
// narrative, puts findings before the evidence appendix, and keeps complete
// coverage available through anchored disclosures. Only findings that require a
// human decision expose apply / skip / defer controls. Material code-level
// choices absent from the ADR render as collapsed read-only context. When a
// decision is required, the export action builds feedback.json in-browser.
//
// Why static HTML and not a served page: the rest of this plugin is
// dependency-free Node/bash by design (no external LLM calls, no runtime deps),
// and the report is opened from a local file that may be offline — so the page
// also relies only on system fonts, never a network font load. A single file
// the user opens, marks up, and re-uploads keeps the same zero-dependency
// stance a long-lived HTTP server would break.
//
// Usage:
//   node adr-impl-review-report.mjs <findings.json> [--out PATH] [--stdout]
//
//   <findings.json>   the punch list produced from the subagent's report
//                     (schema below). "-" reads the JSON from stdin.
//   --out PATH        where to write the HTML (default:
//                     <findings-dir>/adr-impl-review-report.html; with stdin
//                     input, defaults to ./adr-impl-review-report.html)
//   --stdout          write the HTML to stdout instead of a file
//
// Exit: 0 = wrote the report, 2 = usage / bad input.
//
// findings.json schema (all string fields optional unless noted):
//   {
//     "language":   "en",                                         // required
//     "adr":        "docs/adr/ordering/checkout/0001-checkout.md",  // required
//     "reviewMode": "standard" | "full",
//     "status":     "Accepted (2026-07-10)",
//     "verdict":    "PASS" | "FIX_REQUIRED" | "INCONCLUSIVE" | "BLOCK", // required
//     "atAGlance": {                                      // required by validator
//       "impact": "observable user or operational effect",
//       "action": "next required action, or None",
//       "risk": "remaining uncertainty, or None"
//     },
//     "visualization": {
//       "required": true,
//       "reason": "why the whole-route map reduces reconstruction work",
//       "diagramType": "flowchart",
//       "readingGuide": "what this map's boxes, arrows, and Hill routes mean"
//     },
//     "reviewHike": {                                     // required by validator
//       "context": {
//         "intent": "the ADR intent and adopted direction",
//         "preconditions": "the system conditions and neighboring boundaries",
//         "contracts": "the core contracts under review",
//         "scopeAndRisk": "the implementation scope and material uncertainty"
//       },
//       "hills": [{
//         "id": "H1",
//         "title": "A duplicate request reuses the completed payment",
//         "sliceType": "user-flow" | "logical-capability" | "bounded-context",
//         "sliceName": "Duplicate payment settlement",
//         "reviewQuestion": "Can the same payment request complete more than once?",
//         "container": {
//           "responsibility": "reuse one durable settlement",
//           "interactions": "request, completion boundary, and stored result",
//           "outcome": "the customer is charged at most once"
//         },
//         "components": [{
//           "id": "C1",
//           "name": "Idempotent completion boundary",
//           "responsibility": "separate new work from retries",
//           "implementation": "return the stored result for a completed key",
//           "verification": "duplicate-settlement test passes",
//           "codeEvidence": [{
//             "kind": "diff",
//             "location": "src/payments/settle.ts:42",
//             "content": "- write(result)\\n+ return existing ?? write(result)",
//             "explanation": "the retry path no longer writes twice",
//             "tests": "pnpm test -- settlement — PASS"
//           }]
//         }],
//         "contractIds": ["D0", "R1"]
//       }]
//     },
//     "explanation":"/tmp/.../explanation.md",
//     "report":     "/tmp/.../implementation-review.md",
//     "scope":      ["src/checkout/handler.ts", "..."],   // complete ADR implementation scope
//     "changeScope":["src/checkout/handler.ts"],          // separate diff/range scope
//     "conventions":"AGENTS.md",                          // or "none"
//     "metrics": {
//       "elapsedSeconds": 342,
//       "necessityFindingCount": 1,
//       "sufficiencyFindingCount": 0,
//       "unverifiedRiskCount": 0,
//       "testCommandCount": 2
//     },
//     "findings": [                                       // required (may be [])
//       {
//         "id":       "f1",                               // stable id (auto if absent)
//         "category": "Spec violation",   // one of the recognized tags below
//         "perspective": "necessity" | "sufficiency" | "both",
//         "summary":  "family revocation on reuse detection is not implemented",
//         "whyItMatters": "a reused token can keep the rest of its family active",
//         "expectedBehavior": "reuse revokes the entire token family",
//         "observedBehavior": "only the reused token is invalidated",
//         "requestedChange": "revoke every token in the detected family",
//         "editTargets": "src/auth/refresh.ts — reuse-detection branch",
//         "completionCriteria": "family revocation test passes and no sibling token remains valid",
//         "adrQuote": "when reuse is detected, revoke the entire token family",  // ADR decision, 1 line
//         "code":     "src/auth/refresh.ts: on reuse it invalidates only that one token",
//         "fix":      "switch to family-level revocation",
//         "route":    "/adr-sync ordering/checkout",      // for Impl-fact mismatch
//         "basis":    "AGENTS.md §error-handling",         // for Best practice — the convention cited
//         "weight":   "now" | "next-cycle",               // TIMING axis (Refactor / Test gap)
//         "impact":   "low-effort/high-payoff",           // VALUE axis (Refactor / Test gap)
//         "confidence": "high" | "medium" | "low",         // evidence strength; low never pre-selects fix
//         "evidence": "why the claim is supported",
//         "test": "targeted command or proposed reproduction",
//         "testResult": "PASS/FAIL/NOT RUN plus the observed result",
//         "contractIds": ["D0", "R1"]
//       }
//     ],
//     "implementationChoices": [                          // required (may be [])
//       {
//         "choice": "retry uses a 250 ms fixed delay",
//         "evidence": "src/client.ts:42 — retryDelayMs: 250",
//         "intentFit": "keeps the ADR's bounded retry and failure guarantees intact",
//         "whyItMatters": "changes recovery latency and upstream request rate"
//       }
//     ],
//     "comprehensionCheck": {                             // required by validator
//       "prGuidance": "Do not open or send the PR until all questions pass.",
//       "questions": [
//         {
//           "id": "Q1",
//           "question": "Why does provider failure leave the payment pending?",
//           "answerCriteria": "kept out of the visible HTML",
//           "evidence": "kept out of the visible HTML"
//         }
//       ]
//     },
//     "contractCoverage": [                               // required, non-empty
//       {
//         "contractId": "D0" | "R1" | "R2" | "...",
//         "requirement": "a payment is completed at most once",
//         "status": "PROVEN" | "VIOLATED" | "UNVERIFIED" | "CONTRADICTED",
//         "adrBasis": "Requirement contract — Required guarantees",
//         "implementation": "the write path rejects an existing idempotency key",
//         "evidence": "src/payments/settle.ts:42 — exact code or execution evidence",
//         "tests": "pnpm test -- settlement — PASS"
//       }
//     ],
//     "notes": "…"                                        // optional free text
//   }
//
// Recognized categories — the vocabulary, its colors, authority direction,
// default follow-up, and remediation order all live in
// scripts/adr-impl-review-categories.mjs, which adr-impl-review-validate.mjs
// validates against so the two cannot drift.
//
// The download (feedback.json) echoes every finding field back. Findings that do
// not require human judgment use decision: "not-required", so the main session
// can route follow-ups from the file alone without asking the reader to rule on
// automatic remediation or read-only evidence.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATEGORIES, AUTHORITY, VERDICTS } from "./adr-impl-review-categories.mjs";

// ── arg parse ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { in: null, out: null, stdout: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--stdout") opts.stdout = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (!opts.in) opts.in = a;
    else die(`unexpected argument: ${a}`);
  }
  return opts;
}

function die(msg) {
  process.stderr.write(`adr-impl-review-report: ${msg}\n`);
  process.exit(2);
}

// ── HTML helpers ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineScriptJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    const escapes = {
      "<": "\\u003c",
      ">": "\\u003e",
      "&": "\\u0026",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029",
    };
    return escapes[char];
  });
}

const USER_DECISION_CATEGORIES = new Set([
  "Decision changed in code",
  "Undecided behavior",
  "Unverified risk",
  "Contradiction",
]);

const UI = {
  en: {
    title: "ADR implementation review",
    toc: "Contents",
    overview: "At a glance",
    impact: "Impact",
    action: "Action",
    risk: "Risk",
    reviewDetails: "Review details",
    reviewMode: "Review mode",
    completeScope: "Complete implementation scope",
    changeScope: "Change scope",
    conventions: "Project conventions",
    explanation: "Plain explanation",
    report: "Review report",
    metrics: "Review metrics",
    findings: "Work to do",
    noCounterexample: "No additional work was identified.",
    incomplete: "No work item was confirmed, but the review did not complete.",
    evidence: "Technical evidence",
    hill: "Container / Hill",
    reviewQuestion: "What this Container verifies",
    reviewContext: "Context · Intent and contracts",
    verticalSlice: "Vertical slice",
    sliceTypeLabels: {
      "user-flow": "user flow",
      "logical-capability": "logical capability",
      "bounded-context": "bounded context",
    },
    contextIntent: "Intent",
    contextPreconditions: "Preconditions and surrounding context",
    contextContracts: "Core contracts",
    contextScopeAndRisk: "Review scope and risk",
    containerResponsibility: "Responsibility",
    containerInteractions: "Interactions",
    containerOutcome: "Observable outcome",
    components: "Components",
    componentResponsibility: "Responsibility",
    componentImplementation: "Detailed implementation",
    componentVerification: "Verification result",
    codeEvidence: "Code",
    codeLocation: "Location",
    codeExplanation: "Why this code matters",
    coverage: "Contract verification",
    coverageSummary: "Contract verification summary",
    taskFix: "Fix required",
    taskDecide: "Decision required",
    taskVerify: "Verification required",
    taskNote: "Suggestions",
    whyItMatters: "Why it matters",
    expectedBehavior: "Expected behavior",
    observedBehavior: "Observed behavior",
    requestedChange: "Requested change",
    editTargets: "Where to change",
    completionCriteria: "Done when",
    technicalEvidence: "Technical evidence",
    category: "Category",
    confidence: "Confidence",
    reviewResult: "Review result",
    statusProven: "Met",
    statusViolated: "Fix required",
    statusUnverified: "Verification required",
    statusContradicted: "Conflicting evidence",
    choices: "Notable implementation choices",
    comprehension: "Comprehension check",
    residualNotes: "Review notes",
    implementation: "How the implementation meets it",
    tests: "Tests",
    adr: "ADR",
    selectedChoice: "implementation choice",
    intentFit: "Why it fits the ADR intent",
    suggestion: "Suggestion",
    basis: "Basis",
    route: "Route",
    weight: "Weight",
    perspective: "Perspective",
    result: "Result",
    currentCode: "Current code",
    adrDecision: "ADR decision",
    ruling: "Decision",
    apply: "apply",
    skip: "skip",
    defer: "defer",
    notePlaceholder: "optional note — decision basis or requested direction",
    exportHint: "Resolve only the findings that require a human decision, then export.",
    export: "Export decisions",
    saved: "Saved · feedback.json",
    selfCheck: "Check my answer",
    answerPlaceholder: "Write your answer before revealing the criteria.",
    answerRequired: "Write an answer first.",
    answerCriteria: "Answer criteria",
    gradingEvidence: "Evidence used for the criteria",
    selfCheckLimit:
      "This self-check reveals criteria for comparison. It does not mark the PR comprehension-ready.",
    diagramFallback:
      "This Mermaid syntax is not supported by the compact renderer. Source follows.",
    proven: "proven",
    none: "none",
  },
  ko: {
    title: "ADR 구현 리뷰",
    toc: "목차",
    overview: "한눈에 보기",
    impact: "영향",
    action: "조치",
    risk: "위험",
    reviewDetails: "리뷰 상세",
    reviewMode: "리뷰 모드",
    completeScope: "전체 구현 범위",
    changeScope: "변경 범위",
    conventions: "프로젝트 규칙",
    explanation: "구현 설명",
    report: "리뷰 보고서",
    metrics: "리뷰 지표",
    findings: "해야 할 작업",
    noCounterexample: "추가로 처리할 작업이 없습니다.",
    incomplete: "확정된 작업은 없지만 리뷰가 완료되지 않았습니다.",
    evidence: "상세 기술 근거",
    hill: "Container / 낮은 언덕",
    reviewQuestion: "이 Container에서 확인할 것",
    reviewContext: "Context · 의도와 계약",
    verticalSlice: "수직 단위",
    sliceTypeLabels: {
      "user-flow": "사용자 흐름",
      "logical-capability": "논리 기능",
      "bounded-context": "바운디드 컨텍스트(하나의 업무 경계)",
    },
    contextIntent: "의도",
    contextPreconditions: "사전 조건·주변 컨텍스트",
    contextContracts: "핵심 계약",
    contextScopeAndRisk: "검토 범위·위험",
    containerResponsibility: "책임",
    containerInteractions: "상호작용",
    containerOutcome: "관찰 결과",
    components: "Components",
    componentResponsibility: "책임",
    componentImplementation: "상세 구현",
    componentVerification: "검증 결과",
    codeEvidence: "Code",
    codeLocation: "위치",
    codeExplanation: "코드 근거 설명",
    coverage: "계약 검증 결과",
    coverageSummary: "계약 검증 요약",
    taskFix: "수정 필요",
    taskDecide: "결정 필요",
    taskVerify: "검증 필요",
    taskNote: "참고",
    whyItMatters: "왜 중요한가",
    expectedBehavior: "기대 동작",
    observedBehavior: "현재 동작",
    requestedChange: "요청하는 변경",
    editTargets: "수정 위치",
    completionCriteria: "완료 조건",
    technicalEvidence: "상세 기술 근거",
    category: "분류",
    confidence: "근거 수준",
    reviewResult: "검토 결과",
    statusProven: "충족됨",
    statusViolated: "수정 필요",
    statusUnverified: "검증 필요",
    statusContradicted: "근거 충돌",
    choices: "주요 구현 선택",
    comprehension: "이해도 확인",
    residualNotes: "리뷰 메모",
    implementation: "구현이 계약을 충족하는 방식",
    tests: "테스트",
    adr: "ADR",
    selectedChoice: "구현 선택",
    intentFit: "ADR 의도와 양립하는 이유",
    suggestion: "제안",
    basis: "근거",
    route: "경로",
    weight: "시점",
    perspective: "관점",
    result: "결과",
    currentCode: "현재 코드",
    adrDecision: "ADR 결정",
    ruling: "사용자 결정",
    apply: "반영",
    skip: "제외",
    defer: "보류",
    notePlaceholder: "선택 근거나 원하는 방향을 적어주세요 (선택)",
    exportHint: "사용자 결정이 필요한 finding만 판단한 뒤 내보내세요.",
    export: "결정 내보내기",
    saved: "저장됨 · feedback.json",
    selfCheck: "내 답과 비교하기",
    answerPlaceholder: "판정 기준을 보기 전에 답을 작성하세요.",
    answerRequired: "먼저 답을 작성하세요.",
    answerCriteria: "판정 기준",
    gradingEvidence: "판정 근거",
    selfCheckLimit:
      "이 self-check는 비교할 기준만 보여줍니다. PR 이해 준비도를 자동 판정하지 않습니다.",
    diagramFallback: "간이 renderer가 지원하지 않는 Mermaid 문법입니다. 원문을 표시합니다.",
    proven: "충족",
    none: "없음",
  },
};

function detectLanguage(data) {
  if (typeof data.language === "string" && data.language.trim()) {
    return data.language.trim().toLowerCase().startsWith("ko") ? "ko" : "en";
  }
  const sample = [
    data.atAGlance?.impact,
    data.atAGlance?.action,
    data.atAGlance?.risk,
    ...(Array.isArray(data.narrativeSections)
      ? data.narrativeSections.flatMap((section) => [section?.title, section?.body])
      : []),
  ]
    .filter(Boolean)
    .join(" ");
  return /[가-힣]/.test(sample) ? "ko" : "en";
}

function slug(value, fallback = "section") {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function base64(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64");
}

function renderInlineMarkdown(value) {
  let rendered = esc(value);
  rendered = rendered.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return rendered;
}

function mermaidLabel(raw, id) {
  const quoted = raw.match(
    /\["([^"]+)"\]|\[([^\]]+)\]|\{"([^"]+)"\}|\{([^}]+)\}|\("([^"]+)"\)|\(([^)]+)\)/,
  );
  return (quoted?.slice(1).find(Boolean) || id).replace(/<br\s*\/?>/gi, " · ");
}

function renderRelationshipDiagram(className, ariaLabel, relations) {
  return `<figure class="diagram ${className}" aria-label="${esc(ariaLabel)}"><div class="flow">${relations
    .map(
      (relation) =>
        `<div class="flow__edge"><span class="flow__node">${esc(relation.from)}</span><span class="flow__arrow">${esc(relation.arrow || "→")}${relation.label ? `<small>${esc(relation.label)}</small>` : ""}</span><span class="flow__node">${esc(relation.to)}</span></div>`,
    )
    .join("")}</div></figure>`;
}

function renderMermaid(source, ui) {
  const lines = String(source ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"));
  const kind = lines[0] || "";
  const body = lines.slice(1);

  if (/^sequenceDiagram\b/i.test(kind)) {
    const participants = new Map();
    const messages = [];
    for (const line of body) {
      const participant = line.match(
        /^(?:participant|actor)\s+([A-Za-z0-9_.-]+)(?:\s+as\s+(.+))?$/i,
      );
      if (participant) {
        participants.set(participant[1], participant[2] || participant[1]);
        continue;
      }
      const message = line.match(
        /^([A-Za-z0-9_.-]+)\s*(-{1,2}>+|-->>|->>)\s*([A-Za-z0-9_.-]+)\s*:\s*(.+)$/,
      );
      if (message) {
        participants.set(message[1], participants.get(message[1]) || message[1]);
        participants.set(message[3], participants.get(message[3]) || message[3]);
        messages.push({ from: message[1], to: message[3], label: message[4] });
      }
    }
    if (messages.length) {
      return `<figure class="diagram diagram--sequence" aria-label="sequence diagram">
        <div class="diagram__participants">${[...participants.entries()]
          .map(
            ([id, label]) =>
              `<span><code>${esc(id)}</code>${label === id ? "" : ` ${esc(label)}`}</span>`,
          )
          .join("")}</div>
        <ol class="sequence">${messages
          .map(
            (message) =>
              `<li><span class="sequence__route"><strong>${esc(participants.get(message.from))}</strong><span aria-hidden="true">→</span><strong>${esc(participants.get(message.to))}</strong></span><span>${renderInlineMarkdown(message.label)}</span></li>`,
          )
          .join("")}</ol>
      </figure>`;
    }
  }

  if (/^(?:flowchart|graph)\b/i.test(kind)) {
    const labels = new Map();
    const edges = [];
    for (const line of body) {
      for (const match of line.matchAll(
        /([A-Za-z0-9_.-]+)(\["[^"]+"\]|\[[^\]]+\]|\{"[^"]+"\}|\{[^}]+\}|\("[^"]+"\)|\([^)]+\))/g,
      )) {
        labels.set(match[1], mermaidLabel(match[2], match[1]));
      }
      const edge = line.match(
        /^([A-Za-z0-9_.-]+)(?:\[[^\]]+\]|\{[^}]+\}|\([^)]+\))?\s*[-.=]+>(?:\|([^|]+)\|)?\s*([A-Za-z0-9_.-]+)/,
      );
      if (edge) edges.push({ from: edge[1], to: edge[3], label: edge[2] || "" });
    }
    if (edges.length) {
      return renderRelationshipDiagram(
        "diagram--flow",
        "flowchart",
        edges.map((edge) => ({
          from: labels.get(edge.from) || edge.from,
          to: labels.get(edge.to) || edge.to,
          label: edge.label,
        })),
      );
    }
  }

  if (/^stateDiagram-v2\b/i.test(kind)) {
    const transitions = body
      .map((line) => line.match(/^([A-Za-z0-9_*.-]+)\s*-->\s*([A-Za-z0-9_*.-]+)(?:\s*:\s*(.+))?$/))
      .filter(Boolean)
      .map((match) => ({ from: match[1], to: match[2], label: match[3] || "" }));
    if (transitions.length) {
      return renderRelationshipDiagram("diagram--state", "state diagram", transitions);
    }
  }

  if (/^erDiagram\b/i.test(kind)) {
    const relations = body
      .map((line) =>
        line.match(/^([A-Za-z0-9_.-]+)\s+([|o}{.-]+)--([|o}{.-]+)\s+([A-Za-z0-9_.-]+)\s*:\s*(.+)$/),
      )
      .filter(Boolean)
      .map((match) => ({
        from: match[1],
        relation: `${match[2]}--${match[3]}`,
        to: match[4],
        label: match[5],
      }));
    if (relations.length) {
      return renderRelationshipDiagram(
        "diagram--er",
        "entity relationship diagram",
        relations.map((relation) => ({
          from: relation.from,
          to: relation.to,
          arrow: relation.relation,
          label: relation.label,
        })),
      );
    }
  }

  return `<figure class="diagram diagram--fallback"><figcaption>${esc(ui.diagramFallback)}</figcaption><pre><code>${esc(source)}</code></pre></figure>`;
}

function renderMarkdown(source, ui) {
  const lines = String(source ?? "").split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let fence = null;
  let fenceLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${paragraph.map((line) => renderInlineMarkdown(line.trim())).join(" ")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType) return;
    out.push(
      `<${listType}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${listType}>`,
    );
    listType = null;
    listItems = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^```\s*([A-Za-z0-9_-]*)\s*$/);
    if (fenceMatch) {
      if (fence) {
        flushParagraph();
        flushList();
        const body = fenceLines.join("\n");
        out.push(
          fence.toLowerCase() === "mermaid"
            ? renderMermaid(body, ui)
            : `<pre><code${fence ? ` class="language-${esc(fence)}"` : ""}>${esc(body)}</code></pre>`,
        );
        fence = null;
        fenceLines = [];
      } else {
        flushParagraph();
        flushList();
        fence = fenceMatch[1] || "text";
      }
      continue;
    }
    if (fence) {
      fenceLines.push(line);
      continue;
    }

    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      out.push(`<h3>${renderInlineMarkdown(heading[1])}</h3>`);
      continue;
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      out.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line);
  }
  if (fence) {
    out.push(`<pre><code>${esc(fenceLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}

function normalizeFindings(data) {
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const known = Object.prototype.hasOwnProperty.bind(CATEGORIES);
  const mapped = findings.map((f, i) => {
    const category = f.category || "Refactor";
    // An unrecognized category (typo, brackets left on, wrong case) must not
    // silently sink into the grey advisory bucket — a mislabeled must-fix would
    // vanish. Flag it so the card renders a visible warning, and warn on stderr.
    const unknownCat = !known(category);
    if (unknownCat) {
      process.stderr.write(
        `adr-impl-review-report: warning — unrecognized category "${category}" (finding ${f.id || i + 1}); rendered as uncategorized.\n`,
      );
    }
    return {
      sourceIndex: i,
      id: f.id || `f${i + 1}`,
      category,
      unknownCat,
      summary: f.summary || "",
      whyItMatters: f.whyItMatters || f.impact || f.evidence || "",
      expectedBehavior: f.expectedBehavior || f.adrQuote || "",
      observedBehavior: f.observedBehavior || f.code || "",
      requestedChange: f.requestedChange || f.fix || f.route || "",
      editTargets: f.editTargets || f.code || "",
      completionCriteria:
        f.completionCriteria ||
        [f.test, f.testResult]
          .filter((value) => typeof value === "string" && value.trim())
          .join(" — "),
      adrQuote: f.adrQuote || "",
      code: f.code || "",
      fix: f.fix || "",
      route: f.route || "",
      basis: f.basis || "",
      weight: f.weight || "",
      impact: f.impact || "",
      confidence: f.confidence || "",
      perspective: f.perspective || "",
      evidence: f.evidence || "",
      test: f.test || "",
      testResult: f.testResult || "",
      contractIds: Array.isArray(f.contractIds)
        ? f.contractIds.filter((value) => typeof value === "string" && value.trim())
        : [],
      actionGroup:
        category === "Best practice" && f.weight === "next-cycle"
          ? "note"
          : CATEGORIES[category]?.actionGroup || "decide",
    };
  });
  return mapped;
}

function normalizeImplementationChoices(data) {
  const choices = Array.isArray(data.implementationChoices) ? data.implementationChoices : [];
  return choices.map((choice) => ({
    choice: choice.choice || "",
    evidence: choice.evidence || "",
    intentFit: choice.intentFit || "",
    whyItMatters: choice.whyItMatters || "",
  }));
}

function normalizeAtAGlance(data) {
  const value =
    data.atAGlance && typeof data.atAGlance === "object" && !Array.isArray(data.atAGlance)
      ? data.atAGlance
      : {};
  return {
    impact: value.impact || "",
    action: value.action || "",
    risk: value.risk || "",
  };
}

/**
 * Extract the reader-facing narrative in its authored priority order.
 * The renderer keeps Context and subject-specific flow headings instead of rebuilding a fixed tutorial template.
 */
function markdownSectionsBetween(source, startHeading, endHeading) {
  const lines = String(source ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${startHeading}`);
  if (start < 0) return [];
  const sections = [];
  let current = null;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (heading[1] === endHeading) break;
      if (current) sections.push({ title: current.title, body: current.body.join("\n").trim() });
      current = { title: heading[1], body: [] };
      continue;
    }
    if (!current) {
      current = { title: startHeading, body: [] };
    }
    current.body.push(line);
  }
  if (current) sections.push({ title: current.title, body: current.body.join("\n").trim() });
  return sections.filter((section) => section.body);
}

/**
 * Load narrative sections from explicit JSON, legacy explanation fields, or the validated Markdown report.
 * This preserves backward rendering while making the current intent-first report the default.
 */
function loadNarrativeSections(data, inputPath) {
  if (Array.isArray(data.narrativeSections)) {
    return data.narrativeSections;
  }
  if (
    data.explanationSections &&
    typeof data.explanationSections === "object" &&
    !Array.isArray(data.explanationSections)
  ) {
    return [
      { title: "Background", body: data.explanationSections.background || "" },
      { title: "Intuition", body: data.explanationSections.intuition || "" },
      { title: "Code walkthrough", body: data.explanationSections.codeWalkthrough || "" },
    ].filter((section) => section.body);
  }
  if (!data.report || typeof data.report !== "string") return [];

  const baseDir = inputPath === "-" ? process.cwd() : path.dirname(path.resolve(inputPath));
  const reportPath = path.isAbsolute(data.report)
    ? data.report
    : path.resolve(baseDir, data.report);
  if (!existsSync(reportPath)) return [];

  const report = readFileSync(reportPath, "utf8");
  const beforeFindings = markdownSectionsBetween(report, "Context", "Findings");
  return beforeFindings.length
    ? beforeFindings
    : markdownSectionsBetween(report, "Context", "ADR contract coverage");
}

/**
 * Normalize narrative cards without inventing headings or prose.
 * Empty sections are dropped so the HTML shows only evidence-backed reader content.
 */
function normalizeNarrativeSections(data) {
  return Array.isArray(data.narrativeSections)
    ? data.narrativeSections
        .map((section) => ({
          title: section?.title || "",
          body: section?.body || "",
        }))
        .filter((section) => section.title && section.body)
    : [];
}

function normalizeComprehensionCheck(data) {
  const value =
    data.comprehensionCheck &&
    typeof data.comprehensionCheck === "object" &&
    !Array.isArray(data.comprehensionCheck)
      ? data.comprehensionCheck
      : {};
  const questions = Array.isArray(value.questions) ? value.questions : [];
  return {
    prGuidance: value.prGuidance || "",
    questions: questions.map((question, index) => ({
      id: question.id || `Q${index + 1}`,
      question: question.question || "",
      answerCriteria: question.answerCriteria || "",
      evidence: question.evidence || "",
    })),
  };
}

function normalizeContractCoverage(data) {
  const rows = Array.isArray(data.contractCoverage) ? data.contractCoverage : [];
  return rows.map((row) => ({
    contractId: row.contractId || "",
    requirement: row.requirement || "",
    status: row.status || "UNVERIFIED",
    adrBasis: row.adrBasis || "",
    implementation: row.implementation || "",
    evidence: row.evidence || "",
    tests: row.tests || "",
  }));
}

function normalizeReviewHike(data) {
  const value =
    data.reviewHike && typeof data.reviewHike === "object" && !Array.isArray(data.reviewHike)
      ? data.reviewHike
      : {};
  const hills = Array.isArray(value.hills) ? value.hills : [];
  return {
    context: {
      intent: value.context?.intent || "",
      preconditions: value.context?.preconditions || "",
      contracts: value.context?.contracts || "",
      scopeAndRisk: value.context?.scopeAndRisk || "",
    },
    hills: hills.map((hill, index) => ({
      id: hill?.id || `H${index + 1}`,
      title: hill?.title || `Hill ${index + 1}`,
      sliceType: hill?.sliceType || "",
      sliceName: hill?.sliceName || "",
      reviewQuestion: hill?.reviewQuestion || "",
      container: {
        responsibility: hill?.container?.responsibility || "",
        interactions: hill?.container?.interactions || "",
        outcome: hill?.container?.outcome || "",
      },
      components: (Array.isArray(hill?.components) ? hill.components : []).map(
        (component, componentIndex) => ({
          id: component?.id || `C${componentIndex + 1}`,
          name: component?.name || "",
          responsibility: component?.responsibility || "",
          implementation: component?.implementation || "",
          verification: component?.verification || "",
          codeEvidence: (Array.isArray(component?.codeEvidence) ? component.codeEvidence : []).map(
            (codeEvidence) => ({
              kind: codeEvidence?.kind || "",
              location: codeEvidence?.location || "",
              content: codeEvidence?.content || "",
              explanation: codeEvidence?.explanation || "",
              tests: codeEvidence?.tests || "",
            }),
          ),
        }),
      ),
      contractIds: Array.isArray(hill?.contractIds) ? hill.contractIds : [],
    })),
  };
}

function stripGeneratedHillContent(body) {
  return String(body ?? "")
    .replace(
      /<!-- generated container zoom start -->[\s\S]*?<!-- generated container zoom end -->/g,
      "",
    )
    .replace(
      /<!-- generated component zoom start -->[\s\S]*?<!-- generated component zoom end -->/g,
      "",
    )
    .replace(
      /<!-- generated hill evidence start -->[\s\S]*?<!-- generated hill evidence end -->/g,
      "",
    )
    .replace(/<!-- generated container zoom from findings\.json -->/g, "")
    .replace(/<!-- generated component zoom from findings\.json -->/g, "")
    .replace(/<!-- generated hill evidence from findings\.json -->/g, "")
    .trim();
}

function contractCoverageCard(row, index, total, ui) {
  const idx = String(index + 1).padStart(2, "0");
  const status = String(row.status || "UNVERIFIED").toUpperCase();
  const statusClass = ["PROVEN", "VIOLATED", "UNVERIFIED", "CONTRADICTED"].includes(status)
    ? status.toLowerCase()
    : "unverified";
  const statusLabel =
    {
      PROVEN: ui.statusProven,
      VIOLATED: ui.statusViolated,
      UNVERIFIED: ui.statusUnverified,
      CONTRADICTED: ui.statusContradicted,
    }[status] || ui.statusUnverified;

  const open = status === "PROVEN" ? "" : " open";
  return `
  <details class="coverage coverage--${statusClass}" id="contract-${esc(row.contractId)}"${open}>
    <summary class="coverage__summary">
      <span class="coverage__status">${esc(statusLabel)} · ${esc(row.contractId)}</span>
      <span class="coverage__requirement">${esc(row.requirement) || "(no requirement)"}</span>
      <span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span>
    </summary>
    <div class="coverage__body">
    <h3 class="finding__title">${esc(row.requirement) || "(no requirement)"}</h3>
    <div class="coverage__implementation">
      <span class="side__label">${esc(ui.reviewResult)}</span>
      <p>${esc(row.implementation)}</p>
    </div>
    <details class="technical-evidence">
      <summary>${esc(ui.technicalEvidence)}</summary>
      <div class="meta">
        <div class="meta__row"><span class="meta__k">${esc(ui.adr)}</span><span class="meta__v">${esc(row.adrBasis)}</span></div>
        <div class="meta__row"><span class="meta__k">${esc(ui.evidence)}</span><span class="meta__v meta__v--mono">${esc(row.evidence)}</span></div>
        <div class="meta__row"><span class="meta__k">${esc(ui.tests)}</span><span class="meta__v meta__v--mono">${esc(row.tests)}</span></div>
      </div>
    </details>
    </div>
  </details>`;
}

function contextItems(context, ui) {
  return [
    [ui.contextIntent, context.intent],
    [ui.contextPreconditions, context.preconditions],
    [ui.contextContracts, context.contracts],
    [ui.contextScopeAndRisk, context.scopeAndRisk],
  ]
    .map(
      ([label, value]) =>
        `<div class="hill-story__step"><span>${esc(label)}</span><p>${esc(value)}</p></div>`,
    )
    .join("");
}

function reviewContextCard(context, ui) {
  return `
  <section class="hill hill--foundation" id="review-context">
    <header class="hill__head">
      <span class="tag hill__tag">${esc(ui.reviewContext)}</span>
    </header>
    <div class="hill-story" aria-label="${esc(ui.reviewContext)}">${contextItems(context, ui)}</div>
  </section>`;
}

function codeEvidenceCard(codeEvidence, index, ui, hillId, componentId) {
  const kind = String(codeEvidence.kind || "excerpt");
  return `
    <details class="code-evidence" id="code-${esc(hillId)}-${esc(componentId)}-${index + 1}">
      <summary>${esc(ui.codeEvidence)} ${index + 1} · ${esc(kind)} · ${esc(
        codeEvidence.location,
      )}</summary>
      <div class="code-evidence__body">
        <div class="meta__row"><span class="meta__k">${esc(ui.codeLocation)}</span><span class="meta__v meta__v--mono">${esc(codeEvidence.location)}</span></div>
        <pre><code>${esc(codeEvidence.content)}</code></pre>
        <div class="meta__row"><span class="meta__k">${esc(ui.codeExplanation)}</span><span class="meta__v">${esc(codeEvidence.explanation)}</span></div>
        <div class="meta__row"><span class="meta__k">${esc(ui.tests)}</span><span class="meta__v meta__v--mono">${esc(codeEvidence.tests)}</span></div>
      </div>
    </details>`;
}

function componentCard(component, ui, hillId) {
  const codeCards = component.codeEvidence
    .map((codeEvidence, index) => codeEvidenceCard(codeEvidence, index, ui, hillId, component.id))
    .join("\n");
  return `
    <article class="component" id="component-${esc(hillId)}-${esc(component.id.toLowerCase())}">
      <header class="component__head">
        <span class="tag component__tag">Component ${esc(component.id)}</span>
        <h3>${esc(component.name)}</h3>
      </header>
      <div class="component__grid">
        <div><span>${esc(ui.componentResponsibility)}</span><p>${esc(component.responsibility)}</p></div>
        <div><span>${esc(ui.componentImplementation)}</span><p>${esc(component.implementation)}</p></div>
        <div><span>${esc(ui.componentVerification)}</span><p>${esc(component.verification)}</p></div>
      </div>
      <div class="component__code">${codeCards}</div>
    </article>`;
}

function reviewHillCard(hill, body, rows, ui) {
  const sliceType = ui.sliceTypeLabels?.[hill.sliceType] || hill.sliceType;
  const hillId = hill.id.toLowerCase();
  const components = hill.components
    .map((component) => componentCard(component, ui, hillId))
    .join("\n");
  const coverageCards = rows
    .map((row, rowIndex) => contractCoverageCard(row, rowIndex, rows.length, ui))
    .join("\n");

  return `
  <section class="hill" id="hill-${esc(hill.id.toLowerCase())}">
    <header class="hill__head">
      <span class="tag hill__tag">${esc(ui.hill)} ${esc(hill.id)}</span>
    </header>
    <h2 class="explanation__title">${esc(hill.title)}</h2>
    <p class="hill__slice"><span class="side__label">${esc(ui.verticalSlice)}</span> ${esc(
      hill.sliceName,
    )} <code>${esc(sliceType)}</code></p>
    <div class="hill__question">
      <span class="side__label">${esc(ui.reviewQuestion)}</span>
      <p>${esc(hill.reviewQuestion)}</p>
    </div>
    <div class="container-zoom" aria-label="${esc(ui.hill)}">
      <div><span>${esc(ui.containerResponsibility)}</span><p>${esc(hill.container.responsibility)}</p></div>
      <div><span>${esc(ui.containerInteractions)}</span><p>${esc(hill.container.interactions)}</p></div>
      <div><span>${esc(ui.containerOutcome)}</span><p>${esc(hill.container.outcome)}</p></div>
    </div>
    <h3 class="component-section-title">${esc(ui.components)}</h3>
    <div class="components">${components}</div>
    ${
      body
        ? `<div class="explanation__body">${renderMarkdown(
            stripGeneratedHillContent(body),
            ui,
          )}</div>`
        : ""
    }
    <div class="hill__evidence">${coverageCards}</div>
  </section>`;
}

function coverageIndex(rows, hillByContract, ui) {
  return `<ul class="coverage-index">${rows
    .map((row) => {
      const hill = hillByContract.get(row.contractId);
      const status =
        {
          PROVEN: ui.statusProven,
          VIOLATED: ui.statusViolated,
          UNVERIFIED: ui.statusUnverified,
          CONTRADICTED: ui.statusContradicted,
        }[row.status] || ui.statusUnverified;
      return `<li><a href="#contract-${esc(row.contractId)}">${esc(row.contractId)}</a><span>${esc(
        status,
      )}</span><a href="#hill-${esc((hill?.id || "").toLowerCase())}">${esc(
        hill?.id || "",
      )}</a><p>${esc(row.requirement)}</p></li>`;
    })
    .join("")}</ul>`;
}

function implementationChoiceCard(choice, index, total, ui) {
  const idx = String(index + 1).padStart(2, "0");

  return `
  <article class="choice">
    <header class="finding__head">
      <span class="tag choice__tag">${esc(ui.selectedChoice)}</span>
      <span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span>
    </header>
    <h3 class="finding__title">${esc(choice.choice) || "(no choice)"}</h3>
    <div class="choice__value">
      <span class="side__label">${esc(ui.intentFit)}</span>
      <p>${esc(choice.intentFit)}</p>
    </div>
    <div class="meta">
      <div class="meta__row"><span class="meta__k">${esc(ui.evidence)}</span><span class="meta__v meta__v--mono">${esc(choice.evidence)}</span></div>
      <div class="meta__row"><span class="meta__k">${esc(ui.impact)}</span><span class="meta__v">${esc(choice.whyItMatters)}</span></div>
    </div>
  </article>`;
}

function comprehensionQuestionCard(question, index, ui) {
  return `
  <article class="quiz">
    <span class="quiz__id">${esc(question.id)}</span>
    <p class="quiz__question">${esc(question.question)}</p>
    <textarea class="quiz__answer" data-question-index="${index}" rows="3" placeholder="${esc(ui.answerPlaceholder)}"></textarea>
    <button class="quiz__check" type="button" data-question-index="${index}" data-answer="${base64(question.answerCriteria)}" data-evidence="${base64(question.evidence)}">${esc(ui.selfCheck)}</button>
    <p class="quiz__required" data-question-index="${index}" hidden>${esc(ui.answerRequired)}</p>
    <div class="quiz__feedback" data-question-index="${index}" hidden>
      <strong>${esc(ui.answerCriteria)}</strong>
      <p class="quiz__criteria"></p>
      <strong>${esc(ui.gradingEvidence)}</strong>
      <p class="quiz__evidence"></p>
      <p class="quiz__limit">${esc(ui.selfCheckLimit)}</p>
    </div>
  </article>`;
}

function explanationCard(title, body, id, ui) {
  if (!body) return "";
  return `
  <section class="explanation" id="${esc(id)}">
    <h2 class="explanation__title">${esc(title)}</h2>
    <div class="explanation__body">${renderMarkdown(body, ui)}</div>
  </section>`;
}

function findingCard(f, dataIndex, displayIndex, total, ui) {
  // Unrecognized category → a loud "uncategorized" card (bright orange, own blurb) so a
  // mislabeled finding demands attention instead of blending into advisory grey.
  const meta = f.unknownCat
    ? {
        hue: "#e8710a",
        blurb: `uncategorized "${f.category}" — possibly a typo in the subagent tag. Confirm the original intent before ruling.`,
        authority: "contested",
        defaultDecision: "defer",
      }
    : CATEGORIES[f.category] || {
        hue: "#566173",
        blurb: "",
        authority: "advisory",
        defaultDecision: "defer",
      };
  const auth = AUTHORITY[meta.authority] || AUTHORITY.advisory;
  const actionLabels = {
    fix: ui.taskFix,
    decide: ui.taskDecide,
    verify: ui.taskVerify,
    note: ui.taskNote,
  };
  const tagText = actionLabels[f.actionGroup] || ui.taskDecide;
  const idx = String(displayIndex + 1).padStart(2, "0");

  // Confrontation: the ADR decision vs the code as built. Render the center
  // direction indicator only when both sides are present; degrade to a single
  // column (or drop the block entirely for advisory findings) otherwise.
  const hasAdr = !!f.adrQuote;
  const hasCode = !!f.code;
  let confront = "";
  if (hasAdr || hasCode) {
    const adrSide = hasAdr
      ? `<div class="side side--adr">
           <span class="side__label">${esc(ui.adrDecision)}</span>
           <p class="side__body side__body--quote">${esc(f.adrQuote)}</p>
         </div>`
      : "";
    const codeSide = hasCode
      ? `<div class="side side--code">
           <span class="side__label">${esc(ui.currentCode)}</span>
           <p class="side__body side__body--mono">${esc(f.code)}</p>
         </div>`
      : "";
    const center =
      hasAdr && hasCode
        ? `<div class="rel" title="${esc(auth.hint)}">
             <span class="rel__glyph">${auth.glyph}</span>
             <span class="rel__label">${esc(auth.label)}</span>
           </div>`
        : "";
    const single = hasAdr && hasCode ? "" : " confront--single";
    confront = `<div class="confront${single}">${adrSide}${center}${codeSide}</div>`;
  }

  // Technical evidence stays available without forcing the reader to start from
  // category, route, confidence, commands, and raw code fragments.
  const meta_rows = [];
  meta_rows.push(
    `<div class="meta__row"><span class="meta__k">${esc(ui.category)}</span><span class="meta__v">${esc(f.category)}</span></div>`,
  );
  if (f.confidence)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.confidence)}</span><span class="meta__v">${esc(f.confidence)}</span></div>`,
    );
  if (f.basis)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.basis)}</span><span class="meta__v">${esc(f.basis)}</span></div>`,
    );
  if (f.route)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.route)}</span><span class="meta__v meta__v--mono">${esc(f.route)}</span></div>`,
    );
  if (f.weight)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.weight)}</span><span class="meta__v">${esc(f.weight)}</span></div>`,
    );
  if (f.perspective)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.perspective)}</span><span class="meta__v">${esc(f.perspective)}</span></div>`,
    );
  if (f.evidence)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.evidence)}</span><span class="meta__v">${esc(f.evidence)}</span></div>`,
    );
  if (f.test)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.tests)}</span><span class="meta__v meta__v--mono">${esc(f.test)}</span></div>`,
    );
  if (f.testResult)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">${esc(ui.result)}</span><span class="meta__v">${esc(f.testResult)}</span></div>`,
    );
  const metaBlock = meta_rows.length
    ? `<details class="technical-evidence">
        <summary>${esc(ui.technicalEvidence)}</summary>
        ${confront}
        <div class="meta">${meta_rows.join("")}</div>
      </details>`
    : "";

  // Low-confidence findings must NOT pre-select "apply" — weak evidence should
  // not nudge the user toward a code change. Fall back to "defer" so the user
  // opts in deliberately.
  const conf = String(f.confidence || "").toLowerCase();
  const dec = conf === "low" && meta.defaultDecision === "fix" ? "defer" : meta.defaultDecision;
  const confChip =
    conf === "low" || conf === "medium" || conf === "high"
      ? `<span class="conf conf--${conf}" title="evidence strength">${conf}</span>`
      : "";
  const opt = (val, label) => {
    const id = `r-${dataIndex}-${val}`;
    return `<input type="radio" class="seg__input" id="${id}" name="dec-${dataIndex}" value="${val}"${
      dec === val ? " checked" : ""
    }><label class="seg__label" for="${id}">${label}</label>`;
  };

  const contractLinks = f.contractIds.length
    ? `<div class="contract-links">${f.contractIds
        .map((contractId) => `<a href="#contract-${esc(contractId)}">${esc(contractId)}</a>`)
        .join("")}</div>`
    : "";
  const needsDecision = USER_DECISION_CATEGORIES.has(f.category);
  const ruling = needsDecision
    ? `<footer class="ruling">
      <span class="ruling__label">${esc(ui.ruling)}</span>
      <div class="seg" role="radiogroup" aria-label="${esc(f.summary)} ruling">
        ${opt("fix", ui.apply)}
        ${opt("skip", ui.skip)}
        ${opt("defer", ui.defer)}
      </div>
      <textarea class="ruling__note" data-finding-index="${dataIndex}" rows="2" placeholder="${esc(ui.notePlaceholder)}"></textarea>
    </footer>`
    : "";

  return `
  <article class="finding" id="finding-${esc(f.id)}" data-needs-decision="${needsDecision}" style="--sev:${meta.hue}">
    <header class="finding__head">
      <span class="tag">${esc(tagText)}</span>
      <span class="finding__head-right">${confChip}<span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span></span>
    </header>
    <h3 class="finding__title">${esc(f.summary) || "(no summary)"}</h3>
    <div class="task-impact">
      <span class="side__label">${esc(ui.whyItMatters)}</span>
      <p>${esc(f.whyItMatters)}</p>
    </div>
    <div class="task-comparison">
      <div class="task-field">
        <span class="side__label">${esc(ui.expectedBehavior)}</span>
        <p>${esc(f.expectedBehavior)}</p>
      </div>
      <div class="task-field">
        <span class="side__label">${esc(ui.observedBehavior)}</span>
        <p>${esc(f.observedBehavior)}</p>
      </div>
    </div>
    <div class="task-next">
      <div class="task-field task-field--primary">
        <span class="side__label">${esc(ui.requestedChange)}</span>
        <p>${esc(f.requestedChange)}</p>
      </div>
      <div class="task-field">
        <span class="side__label">${esc(ui.editTargets)}</span>
        <p class="meta__v--mono">${esc(f.editTargets)}</p>
      </div>
      <div class="task-field">
        <span class="side__label">${esc(ui.completionCriteria)}</span>
        <p>${esc(f.completionCriteria)}</p>
      </div>
    </div>
    ${metaBlock}
    ${contractLinks}
    ${ruling}
  </article>`;
}

function groupedFindingCards(findings, ui) {
  const groups = [
    ["fix", ui.taskFix],
    ["decide", ui.taskDecide],
    ["verify", ui.taskVerify],
    ["note", ui.taskNote],
  ];
  let renderedIndex = 0;
  return groups
    .map(([group, label]) => {
      const items = findings.filter((finding) => finding.actionGroup === group);
      if (items.length === 0) return "";
      const cards = items
        .map((finding) => {
          const card = findingCard(
            finding,
            finding.sourceIndex,
            renderedIndex,
            findings.length,
            ui,
          );
          renderedIndex += 1;
          return card;
        })
        .join("\n");
      return `<section class="task-group task-group--${group}">
        <h3 class="task-group__title">${esc(label)} · ${items.length}</h3>
        ${cards}
      </section>`;
    })
    .join("\n");
}

function buildHtml(data) {
  const language = detectLanguage(data);
  const ui = UI[language];
  const adr = esc(data.adr || "(no path)");
  const reviewMode = esc(data.reviewMode || "");
  const status = esc(data.status || "");
  const verdictKey = (data.verdict || "").toUpperCase();
  const verdictHue = VERDICTS[verdictKey]?.hue || "#566173";
  const scope = Array.isArray(data.scope) ? data.scope : [];
  const changeScope = Array.isArray(data.changeScope) ? data.changeScope : [];
  const metrics = data.metrics && typeof data.metrics === "object" ? data.metrics : null;
  const findings = normalizeFindings(data);
  const atAGlance = normalizeAtAGlance(data);
  const narrativeSections = normalizeNarrativeSections(data);
  const reviewHike = normalizeReviewHike(data);
  const comprehensionCheck = normalizeComprehensionCheck(data);
  const contractCoverage = normalizeContractCoverage(data);
  const implementationChoices = normalizeImplementationChoices(data);
  const narrativeByTitle = new Map(narrativeSections.map((section) => [section.title, section]));
  const hillTitles = new Set(reviewHike.hills.map((hill) => hill.title));
  const narrativeWithIds = narrativeSections
    .filter((section) => section.title !== "Context" && !hillTitles.has(section.title))
    .map((section, index) => ({
      ...section,
      id: `narrative-${slug(section.title, `section-${index + 1}`)}-${index + 1}`,
      displayTitle: section.title,
    }));
  const supportingNarrative = narrativeWithIds;
  const hillByContract = new Map(
    reviewHike.hills.flatMap((hill) => hill.contractIds.map((contractId) => [contractId, hill])),
  );
  const coverageById = new Map(contractCoverage.map((row) => [row.contractId, row]));
  const hillsWithRows = reviewHike.hills.map((hill) => ({
    ...hill,
    body: narrativeByTitle.get(hill.title)?.body || "",
    rows: hill.contractIds.map((contractId) => coverageById.get(contractId)).filter(Boolean),
  }));
  const cards = groupedFindingCards(findings, ui);
  const choiceCards = implementationChoices
    .map((choice, index) =>
      implementationChoiceCard(choice, index, implementationChoices.length, ui),
    )
    .join("\n");
  const comprehensionCards = comprehensionCheck.questions
    .map((question, index) => comprehensionQuestionCard(question, index, ui))
    .join("\n");
  const narrativeCards = supportingNarrative
    .map((section) => explanationCard(section.displayTitle, section.body, section.id, ui))
    .join("\n");
  const hillCards = hillsWithRows
    .map((hill) => reviewHillCard(hill, hill.body, hill.rows, ui))
    .join("\n");
  const contextCard = reviewContextCard(reviewHike.context, ui);
  const fallbackCoverageCards = contractCoverage
    .map((row, index) => contractCoverageCard(row, index, contractCoverage.length, ui))
    .join("\n");
  const count = findings.length;
  const coverageCount = contractCoverage.length;
  const choiceCount = implementationChoices.length;
  const provenCount = contractCoverage.filter((row) => row.status === "PROVEN").length;
  const violatedCount = contractCoverage.filter((row) => row.status === "VIOLATED").length;
  const unverifiedCount = contractCoverage.filter((row) => row.status === "UNVERIFIED").length;
  const contradictedCount = contractCoverage.filter((row) => row.status === "CONTRADICTED").length;
  const decisionCount = findings.filter((finding) =>
    USER_DECISION_CATEGORIES.has(finding.category),
  ).length;
  const taskCounts = Object.fromEntries(
    ["fix", "decide", "verify", "note"].map((group) => [
      group,
      findings.filter((finding) => finding.actionGroup === group).length,
    ]),
  );
  const hasOverview = atAGlance.impact || atAGlance.action || atAGlance.risk;
  const tocItems = [
    hasOverview ? { id: "overview", label: ui.overview, level: 0 } : null,
    { id: "review-context", label: ui.reviewContext, level: 0 },
    ...supportingNarrative.map((section) => ({
      id: section.id,
      label: section.displayTitle,
      level: 0,
    })),
    ...reviewHike.hills.flatMap((hill) => [
      {
        id: `hill-${hill.id.toLowerCase()}`,
        label: `${hill.id} · ${hill.title}`,
        level: 1,
      },
      ...hill.components.flatMap((component) => [
        {
          id: `component-${hill.id.toLowerCase()}-${component.id.toLowerCase()}`,
          label: `${component.id} · ${component.name}`,
          level: 2,
        },
        ...component.codeEvidence.map((codeEvidence, index) => ({
          id: `code-${hill.id.toLowerCase()}-${component.id.toLowerCase()}-${index + 1}`,
          label: `Code ${index + 1} · ${codeEvidence.kind}`,
          level: 3,
        })),
      ]),
    ]),
    { id: "findings", label: ui.findings, level: 0 },
    coverageCount || choiceCount ? { id: "evidence", label: ui.evidence, level: 0 } : null,
    comprehensionCheck.questions.length
      ? { id: "comprehension", label: ui.comprehension, level: 0 }
      : null,
  ].filter(Boolean);

  const empty =
    count === 0 && verdictKey === "PASS"
      ? `<div class="conforms">
           <p class="conforms__lead">${esc(ui.noCounterexample)}</p>
           <p class="conforms__sub">${esc(ui.evidence)} · ${provenCount} / ${coverageCount} ${esc(ui.proven)}</p>
         </div>`
      : count === 0
        ? `<div class="conforms">
             <p class="conforms__lead">${esc(verdictKey || "unruled")} · ${esc(ui.incomplete)}</p>
           </div>`
        : "";

  // Embed the findings so the download echoes the original context back
  // alongside the reviewer's rulings — the main session gets both in one file.
  const embedded = inlineScriptJson(
    decisionCount
      ? {
          adr: data.adr || "",
          reviewMode: data.reviewMode || "",
          verdict: verdictKey,
          atAGlance,
          scope,
          changeScope,
          findings,
          reviewHike,
          contractCoverage,
          implementationChoices,
          comprehensionCheck: {
            prGuidance: comprehensionCheck.prGuidance,
            questions: comprehensionCheck.questions.map(({ id, question }) => ({ id, question })),
          },
        }
      : {},
  );

  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ui.title)} — ${adr}</title>
<style>
  :root {
    color-scheme: light dark;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Code", Menlo, Consolas, monospace;
    --paper: #e6eaee;
    --card: #fcfdfe;
    --ink: #1b2431;
    --ink-2: #586372;
    --line: #d3dae1;
    --adr-wash: #e9eff5;   /* cool — the intended design (blueprint) */
    --code-wash: #f5f0e9;  /* warm — the thing as built (material)   */
    --focus: #1f5fa8;
    --verdict: ${verdictHue};
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #14171b;
      --card: #1e232a;
      --ink: #e4e8ed;
      --ink-2: #9aa4b0;
      --line: #2c333c;
      --adr-wash: #1b2530;
      --code-wash: #2a2620;
      --focus: #5b9bd8;
    }
  }
  * { box-sizing: border-box; }
  :target { scroll-margin-top: 20px; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font: 15px/1.65 var(--sans);
  }
  body.has-bar { padding-bottom: 96px; }
  a { color: var(--focus); }
  code {
    font-family: var(--mono); font-size: .92em;
    background: color-mix(in srgb, var(--ink) 7%, transparent);
    padding: 1px 5px; border-radius: 4px;
  }
  pre {
    margin: 14px 0; padding: 14px 16px; overflow: auto;
    border: 1px solid var(--line); border-radius: 8px;
    background: color-mix(in srgb, var(--ink) 5%, var(--card));
    white-space: pre-wrap;
  }
  pre code { background: transparent; padding: 0; white-space: pre-wrap; }
  blockquote {
    margin: 14px 0; padding: 8px 14px; border-left: 3px solid var(--focus);
    background: color-mix(in srgb, var(--focus) 7%, var(--card));
  }
  .page {
    width: min(1180px, 100%); margin: 0 auto;
    display: grid; grid-template-columns: 220px minmax(0, 860px); gap: 28px;
    align-items: start; padding: 34px 20px 48px;
  }
  .wrap { min-width: 0; }
  .toc {
    position: sticky; top: 20px;
    background: var(--card); border: 1px solid var(--line);
    border-radius: 10px; padding: 14px;
  }
  .toc__title {
    margin: 0 0 10px; font: 700 10px/1 var(--mono);
    letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2);
  }
  .toc ol { margin: 0; padding-left: 20px; }
  .toc li { margin: 6px 0; font-size: 13px; }
  .toc li[data-level="1"] { margin-left: 10px; }
  .toc li[data-level="2"] { margin-left: 22px; font-size: 12.5px; }
  .toc li[data-level="3"] { margin-left: 34px; font-size: 12px; color: var(--ink-2); }
  .toc a { color: var(--ink); text-decoration: none; }
  .toc a:hover { color: var(--focus); text-decoration: underline; }

  /* ── docket header ─────────────────────────────────────────────── */
  .doc {
    display: flex; flex-wrap: wrap; gap: 18px 24px;
    align-items: flex-start; justify-content: space-between;
    padding-bottom: 18px; margin-bottom: 8px;
    border-bottom: 2px solid var(--verdict);
  }
  .doc__id { min-width: 0; flex: 1 1 320px; }
  .eyebrow {
    font: 600 11px/1 var(--mono); letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--ink-2); margin: 0 0 10px;
  }
  .doc__path {
    font: 500 15px/1.45 var(--mono); color: var(--ink);
    word-break: break-all; margin: 0;
  }
  .doc__status { font: 500 12px/1 var(--mono); color: var(--ink-2); margin-top: 8px; }
  .review-meta {
    margin-top: 14px; border: 1px solid var(--line); border-radius: 8px;
    background: var(--card); padding: 0 12px;
  }
  .review-meta summary { cursor: pointer; padding: 9px 0; font-weight: 650; color: var(--ink-2); }
  .doc__meta { padding: 0 0 12px; font-size: 12.5px; color: var(--ink-2); }
  .doc__meta div { margin-top: 3px; }
  .doc__meta code {
    font: 12px/1.5 var(--mono);
    background: color-mix(in srgb, var(--ink) 6%, transparent);
    padding: 1px 5px; border-radius: 4px;
  }

  /* verdict stamp */
  .stamp {
    flex: 0 0 auto; text-align: center;
    border: 2px solid var(--verdict); border-radius: 8px;
    padding: 10px 16px; box-shadow: inset 0 0 0 2px var(--card), inset 0 0 0 3px var(--verdict);
    background: color-mix(in srgb, var(--verdict) 8%, var(--card));
  }
  .stamp__k { font: 600 9px/1 var(--mono); letter-spacing: 0.24em; color: var(--ink-2); }
  .stamp__v { font: 700 20px/1.1 var(--mono); letter-spacing: 0.06em; color: var(--verdict); margin-top: 6px; }
  .vnote { flex: 1 1 100%; font-size: 13px; color: var(--ink-2); margin: 2px 0 0; }

  .overview {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px 18px; margin: 18px 0 8px;
  }
  .overview__title {
    font: 700 11px/1 var(--mono); letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-2); margin: 0 0 12px;
  }
  .overview__grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
  }
  .overview__item {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 8px; padding: 11px 12px;
  }
  .overview__key {
    display: block; font: 700 10px/1 var(--mono); letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-2); margin-bottom: 7px;
  }
  .overview__value { margin: 0; font-size: 13.5px; }
  .explanation {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px 18px; margin: 14px 0;
  }
  .explanation__title {
    font: 680 20px/1.3 var(--sans); letter-spacing: -0.01em;
    color: var(--ink); margin: 0 0 12px;
  }
  .explanation__body {
    font-size: 14px; overflow-wrap: anywhere;
  }
  .explanation__body p { margin: 10px 0; }
  .explanation__body ul, .explanation__body ol { margin: 10px 0; padding-left: 24px; }
  .hill {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 18px; margin: 18px 0;
  }
  .hill__head { display: flex; align-items: center; gap: 12px; }
  .hill__tag { --sev: #426b4f; }
  .hill__question {
    background: color-mix(in srgb, #426b4f 9%, var(--card));
    border: 1px solid var(--line); border-radius: 8px; padding: 11px 13px; margin: 10px 0 12px;
  }
  .hill__question p { margin: 0; font-weight: 650; }
  .hill__slice { margin: 8px 0 0; font-size: 13px; color: var(--ink-2); }
  .hill__slice code { margin-left: 6px; }
  .hill--foundation { border-color: color-mix(in srgb, #426b4f 36%, var(--line)); }
  .zoom-disclaimer { margin: 8px 0 14px; color: var(--ink-2); font-size: 12.5px; }
  .hill-story {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px; margin: 12px 0 16px;
  }
  .hill-story__step {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 8px; padding: 10px 11px;
  }
  .hill-story__step span {
    display: block; font: 700 10px/1 var(--mono); letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--ink-2); margin-bottom: 7px;
  }
  .hill-story__step p { margin: 0; font-size: 13px; }
  .container-zoom {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px; margin: 12px 0 18px;
  }
  .container-zoom > div, .component__grid > div {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 8px; padding: 10px 11px;
  }
  .container-zoom span, .component__grid span {
    display: block; font: 700 10px/1 var(--mono); letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--ink-2); margin-bottom: 7px;
  }
  .container-zoom p, .component__grid p { margin: 0; font-size: 13px; }
  .component-section-title {
    font: 700 11px/1 var(--mono); letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-2); margin: 20px 0 10px;
  }
  .components { display: grid; gap: 12px; }
  .component {
    border: 1px solid var(--line); border-radius: 9px;
    background: color-mix(in srgb, var(--card) 88%, var(--paper)); padding: 14px;
  }
  .component__head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .component__head h3 { margin: 0; font-size: 16px; }
  .component__tag { --sev: #5b5f97; }
  .component__grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;
  }
  .component__code { margin-top: 10px; }
  .code-evidence {
    border: 1px solid var(--line); border-radius: 8px;
    background: var(--paper); margin-top: 8px; padding: 0 11px;
  }
  .code-evidence > summary {
    cursor: pointer; padding: 11px 0; font: 650 12px/1.3 var(--mono);
  }
  .code-evidence__body { padding: 0 0 12px; }
  .code-evidence pre {
    overflow: auto; background: #172029; color: #edf3f7;
    border-radius: 7px; padding: 12px; font: 12px/1.55 var(--mono);
  }
  .hill__evidence { margin-top: 16px; }

  .section-title {
    font: 700 11px/1 var(--mono); letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-2); margin: 28px 0 12px;
  }
  .section-disclosure {
    margin: 22px 0; background: var(--card); border: 1px solid var(--line);
    border-radius: 10px; padding: 0 16px;
  }
  .section-disclosure > summary {
    cursor: pointer; padding: 15px 0; font-weight: 700;
  }
  .section-disclosure__body { padding: 0 0 16px; }
  .coverage-summary {
    display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 16px;
  }
  .coverage-summary span {
    border: 1px solid var(--line); background: var(--card);
    border-radius: 999px; padding: 5px 10px; font: 650 11px/1 var(--mono);
  }
  .coverage-index { list-style: none; padding: 0; margin: 10px 0 18px; }
  .coverage-index li {
    display: grid; grid-template-columns: auto auto auto 1fr; gap: 10px;
    align-items: baseline; border-bottom: 1px solid var(--line); padding: 9px 0;
  }
  .coverage-index li > a, .coverage-index li > span {
    font: 700 11px/1 var(--mono);
  }
  .coverage-index li p { margin: 0; font-size: 13px; }

  /* ── finding ───────────────────────────────────────────────────── */
  .finding {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--sev); border-radius: 10px;
    padding: 16px 18px 14px; margin-bottom: 14px;
  }
  .task-summary {
    display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 18px;
  }
  .task-summary span {
    border: 1px solid var(--line); border-radius: 999px;
    background: var(--card); padding: 6px 10px; font: 650 11px/1 var(--mono);
  }
  .task-group { margin: 18px 0 26px; }
  .task-group__title {
    font: 720 15px/1.3 var(--sans); margin: 0 0 10px; color: var(--ink);
  }
  .task-impact, .task-field {
    border: 1px solid var(--line); border-radius: 8px;
    background: var(--paper); padding: 11px 13px;
  }
  .task-impact { margin: 12px 0; }
  .task-impact p, .task-field p { margin: 0; font-size: 13.5px; }
  .task-comparison {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px; margin-bottom: 10px;
  }
  .task-next { display: grid; gap: 10px; margin-bottom: 12px; }
  .task-field--primary {
    background: color-mix(in srgb, var(--sev) 8%, var(--card));
    border-color: color-mix(in srgb, var(--sev) 32%, var(--line));
  }
  .technical-evidence {
    border: 1px solid var(--line); border-radius: 8px;
    background: var(--card); margin: 12px 0;
  }
  .technical-evidence > summary {
    cursor: pointer; padding: 10px 12px; font-weight: 650; color: var(--ink-2);
  }
  .technical-evidence .confront { margin: 0 12px 12px; }
  .technical-evidence .meta { padding: 0 12px 12px; margin: 0; }
  .coverage {
    --coverage: #566173;
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--coverage); border-radius: 8px;
    margin-bottom: 12px; overflow: hidden;
  }
  .coverage--proven { --coverage: #2e7d4f; }
  .coverage--violated { --coverage: #c0362c; }
  .coverage--unverified { --coverage: #b4690e; }
  .coverage--contradicted { --coverage: #7b3f91; }
  .coverage__status {
    font: 700 10.5px/1 var(--mono); letter-spacing: 0.14em;
    color: var(--coverage);
  }
  .coverage__summary {
    display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center;
    cursor: pointer; padding: 13px 15px;
  }
  .coverage__requirement { font-weight: 650; }
  .coverage__body { padding: 0 16px 14px; border-top: 1px solid var(--line); }
  .coverage__implementation {
    background: color-mix(in srgb, var(--coverage) 8%, var(--card));
    border: 1px solid var(--line); border-radius: 7px;
    padding: 11px 13px; margin: 10px 0 12px;
  }
  .coverage__implementation p { margin: 0; font-size: 13.5px; }
  .choice {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid #217a68; border-radius: 8px;
    padding: 16px 18px 14px; margin-bottom: 14px;
  }
  .choice__tag { --sev: #217a68; }
  .choice__value {
    background: color-mix(in srgb, #217a68 9%, var(--card));
    border: 1px solid var(--line); border-radius: 7px;
    padding: 11px 13px; margin: 10px 0 12px;
  }
  .choice__value p { margin: 0; font: 600 13.5px/1.5 var(--mono); word-break: break-word; }
  .quiz {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid #7457a6; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 12px;
  }
  .quiz__id {
    display: block; font: 700 10.5px/1 var(--mono); letter-spacing: 0.14em;
    color: #7457a6; margin-bottom: 8px;
  }
  .quiz__question { margin: 0; font-size: 14px; }
  .quiz__answer {
    width: 100%; margin-top: 12px; padding: 9px 10px; resize: vertical;
    border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink);
    font: 13.5px/1.5 var(--sans);
  }
  .quiz__check {
    margin-top: 9px; padding: 8px 12px; border: 1px solid var(--ink);
    border-radius: 7px; background: var(--ink); color: var(--card); cursor: pointer;
    font-weight: 650;
  }
  .quiz__required { color: #c0362c; margin: 8px 0 0; }
  .quiz__feedback {
    margin-top: 12px; padding: 12px; border: 1px solid var(--line);
    border-radius: 8px; background: color-mix(in srgb, #7457a6 7%, var(--card));
  }
  .quiz__feedback p { margin: 5px 0 10px; }
  .quiz__limit { color: var(--ink-2); font-size: 12.5px; }
  .finding__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .tag {
    font: 600 10.5px/1 var(--mono); letter-spacing: 0.14em; text-transform: uppercase;
    color: #fff; background: var(--sev); padding: 4px 9px; border-radius: 5px;
  }
  .finding__head-right { display: inline-flex; align-items: center; gap: 10px; }
  .finding__idx { font: 600 12px/1 var(--mono); color: var(--sev); }
  .finding__idx-total { color: var(--ink-2); font-weight: 500; }
  .conf { font: 600 9.5px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase;
          padding: 3px 7px; border-radius: 4px; border: 1px solid var(--line); color: var(--ink-2); }
  .conf--high { color: #2e7d4f; border-color: color-mix(in srgb, #2e7d4f 45%, var(--line)); }
  .conf--medium { color: #b4690e; border-color: color-mix(in srgb, #b4690e 45%, var(--line)); }
  .conf--low { color: #c0362c; border-color: color-mix(in srgb, #c0362c 45%, var(--line)); }
  .finding__title {
    font: 660 17px/1.35 var(--sans); letter-spacing: -0.01em;
    margin: 11px 0 5px;
  }
  .finding__blurb { font-size: 13px; color: var(--ink-2); margin: 0 0 14px; }
  .contract-links { display: flex; flex-wrap: wrap; gap: 6px; margin: 7px 0 10px; }
  .contract-links a {
    font: 650 11px/1 var(--mono); text-decoration: none;
    border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px;
  }

  /* confrontation: ADR decision vs code as built */
  .confront {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch;
    gap: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
    margin-bottom: 12px;
  }
  .confront--single { grid-template-columns: 1fr; }
  .side { padding: 11px 13px; min-width: 0; }
  .side--adr { background: var(--adr-wash); }
  .side--code { background: var(--code-wash); }
  .side__label {
    display: block; font: 600 10px/1 var(--mono); letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-2); margin-bottom: 7px;
  }
  .side__body { margin: 0; font-size: 13.5px; }
  .side__body--quote { font-style: normal; color: var(--ink); }
  .side__body--mono { font: 12.5px/1.5 var(--mono); color: var(--ink); word-break: break-word; }
  .rel {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; padding: 8px 12px; background: var(--card);
    border-left: 1px solid var(--line); border-right: 1px solid var(--line);
  }
  .rel__glyph { font: 600 18px/1 var(--mono); color: var(--sev); }
  .rel__label { font: 600 9px/1.1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase;
                color: var(--ink-2); text-align: center; white-space: nowrap; }

  .meta { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .meta__row { display: flex; gap: 10px; font-size: 13px; }
  .meta__k { flex: 0 0 42px; font: 600 11px/1.5 var(--mono); letter-spacing: 0.08em;
             text-transform: uppercase; color: var(--ink-2); }
  .meta__v { flex: 1; }
  .meta__v--mono { font: 12.5px/1.5 var(--mono); }

  /* ruling — segmented control + note */
  .ruling { border-top: 1px dashed var(--line); padding-top: 12px; }
  .ruling__label { display: block; font: 600 10px/1 var(--mono); letter-spacing: 0.16em;
                   text-transform: uppercase; color: var(--ink-2); margin-bottom: 8px; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px;
         overflow: hidden; margin-bottom: 10px; }
  .seg__input { position: absolute; opacity: 0; pointer-events: none; }
  .seg__label {
    font: 600 13px/1 var(--sans); padding: 8px 18px; cursor: pointer;
    color: var(--ink-2); background: var(--card); border-left: 1px solid var(--line);
    transition: background 0.12s, color 0.12s;
  }
  .seg__label:first-of-type { border-left: none; }
  .seg__input:checked + .seg__label { background: var(--ink); color: var(--card); }
  .seg__input:focus-visible + .seg__label { outline: 2px solid var(--focus); outline-offset: -2px; }
  .seg__label:hover { color: var(--ink); }
  .seg__input:checked + .seg__label:hover { color: var(--card); }
  .ruling__note {
    display: block; width: 100%; font: 13.5px/1.5 var(--sans);
    padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px;
    background: var(--paper); color: var(--ink); resize: vertical;
  }
  .ruling__note:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; border-color: var(--focus); }

  /* review notes reuse the disclosure's horizontal inset */
  .notes__v { font-size: 13.5px; color: var(--ink); margin: 0; }

  /* ── grounded Mermaid render ─────────────────────────────────── */
  .diagram {
    margin: 16px 0; padding: 14px; border: 1px solid var(--line);
    border-radius: 10px; background: var(--paper);
  }
  .diagram__participants { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .diagram__participants span {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 999px; padding: 5px 9px; font-size: 12px;
  }
  .sequence { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .sequence li {
    display: grid; grid-template-columns: minmax(180px, .8fr) 1fr; gap: 12px;
    padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--card);
  }
  .sequence__route { display: flex; align-items: center; gap: 8px; }
  .flow { display: grid; gap: 10px; }
  .flow__edge {
    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center; gap: 10px;
  }
  .flow__node {
    display: block; padding: 9px 10px; text-align: center;
    border: 1px solid var(--line); border-radius: 8px; background: var(--card); font-weight: 650;
  }
  .flow__arrow { color: var(--focus); text-align: center; font: 700 16px/1 var(--mono); }
  .flow__arrow small { display: block; margin-top: 5px; color: var(--ink-2); font: 11px/1.25 var(--sans); }
  .diagram--fallback figcaption { color: #b4690e; margin-bottom: 8px; font-weight: 650; }

  /* compact empty state; the header already carries the verdict stamp */
  .conforms {
    padding: 14px 16px; border: 1px solid var(--line); border-left: 3px solid var(--verdict);
    border-radius: 10px; background: var(--card);
  }
  .conforms__lead { font: 660 15px/1.4 var(--sans); margin: 0; }
  .conforms__sub { font-size: 13.5px; color: var(--ink-2); margin: 0; }

  /* ── action bar ────────────────────────────────────────────────── */
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
    background: color-mix(in srgb, var(--card) 92%, transparent);
    backdrop-filter: saturate(180%) blur(8px);
    border-top: 1px solid var(--line);
    padding: 12px 20px;
  }
  .bar__inner { max-width: 860px; margin: 0 auto; display: flex; align-items: center;
                justify-content: space-between; gap: 16px; }
  .hint { font-size: 12.5px; color: var(--ink-2); }
  button.export {
    font: 600 14px/1 var(--sans); padding: 11px 22px; border: 1px solid var(--ink);
    border-radius: 8px; background: var(--ink); color: var(--card); cursor: pointer;
    transition: opacity 0.12s;
  }
  button.export:hover { opacity: 0.88; }
  button.export:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  button.export.done { background: #2e7d4f; border-color: #2e7d4f; }

  @media (max-width: 620px) {
    .page { display: block; padding: 18px 14px 36px; }
    .toc { position: static; margin-bottom: 18px; }
    .overview__grid { grid-template-columns: 1fr; }
    .hill-story, .container-zoom, .component__grid { grid-template-columns: 1fr; }
    .coverage-index li { grid-template-columns: auto auto auto; }
    .coverage-index li p { grid-column: 1 / -1; }
    .task-comparison { grid-template-columns: 1fr; }
    .coverage__summary { grid-template-columns: 1fr auto; }
    .coverage__status { grid-column: 1 / -1; }
    .confront, .confront--single { grid-template-columns: 1fr; }
    .rel { flex-direction: row; gap: 8px; border-left: none; border-right: none;
           border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .rel__glyph { transform: rotate(90deg); }
    .bar__inner { flex-direction: column; align-items: stretch; }
    .bar .hint { text-align: center; }
    button.export { width: 100%; }
    .sequence li { grid-template-columns: 1fr; }
    .flow__edge { grid-template-columns: 1fr; }
    .flow__arrow { transform: rotate(90deg); padding: 4px; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
</style>
</head>
<body class="${decisionCount ? "has-bar" : ""}">
<div class="page">
<nav class="toc" aria-label="${esc(ui.toc)}">
  <h2 class="toc__title">${esc(ui.toc)}</h2>
  <ol>
    ${tocItems.map((item) => `<li data-level="${item.level || 0}"><a href="#${esc(item.id)}">${esc(item.label)}</a></li>`).join("")}
  </ol>
</nav>
<main class="wrap">
  <header class="doc">
    <div class="doc__id">
      <p class="eyebrow">${esc(ui.title)}</p>
      <p class="doc__path">${adr}</p>
      ${status ? `<div class="doc__status">${status}</div>` : ""}
      <details class="review-meta">
      <summary>${esc(ui.reviewDetails)}</summary>
      <div class="doc__meta">
        ${reviewMode ? `<div>${esc(ui.reviewMode)} · <code>${reviewMode}</code></div>` : ""}
        ${
          scope.length
            ? `<div>${esc(ui.completeScope)} · ${scope.map((s) => `<code>${esc(s)}</code>`).join(" ")}</div>`
            : ""
        }
        <div>${esc(ui.changeScope)} · ${
          changeScope.length
            ? changeScope.map((s) => `<code>${esc(s)}</code>`).join(" ")
            : esc(ui.none)
        }</div>
        ${data.conventions ? `<div>${esc(ui.conventions)} · <code>${esc(data.conventions)}</code></div>` : ""}
        ${data.explanation ? `<div>${esc(ui.explanation)} · <code>${esc(data.explanation)}</code></div>` : ""}
        ${data.report ? `<div>${esc(ui.report)} · <code>${esc(data.report)}</code></div>` : ""}
        ${
          metrics
            ? `<div>${esc(ui.metrics)} · ${esc(metrics.elapsedSeconds)}s · necessity ${esc(metrics.necessityFindingCount)} · sufficiency ${esc(metrics.sufficiencyFindingCount)} · tests ${esc(metrics.testCommandCount)}</div>`
            : ""
        }
      </div>
      </details>
    </div>
    <div class="stamp">
      <div class="stamp__k">VERDICT</div>
      <div class="stamp__v">${esc(verdictKey || "—")}</div>
    </div>
  </header>

  ${
    hasOverview
      ? `<section class="overview" id="overview">
           <h2 class="overview__title">${esc(ui.overview)}</h2>
           <div class="overview__grid">
             <div class="overview__item"><span class="overview__key">${esc(ui.impact)}</span><p class="overview__value">${esc(atAGlance.impact)}</p></div>
             <div class="overview__item"><span class="overview__key">${esc(ui.action)}</span><p class="overview__value">${esc(atAGlance.action)}</p></div>
             <div class="overview__item"><span class="overview__key">${esc(ui.risk)}</span><p class="overview__value">${esc(atAGlance.risk)}</p></div>
           </div>
         </section>`
      : ""
  }

  ${contextCard}
  ${narrativeCards}
  ${hillCards}

  <section id="findings">
    <h2 class="section-title">${esc(ui.findings)} · ${count}</h2>
    ${
      count
        ? `<div class="task-summary">
            <span>${esc(ui.taskFix)} ${taskCounts.fix}</span>
            <span>${esc(ui.taskDecide)} ${taskCounts.decide}</span>
            <span>${esc(ui.taskVerify)} ${taskCounts.verify}</span>
            <span>${esc(ui.taskNote)} ${taskCounts.note}</span>
          </div>`
        : ""
    }
    ${empty}
    ${cards}
  </section>

  ${
    coverageCount || choiceCount
      ? `<section id="evidence">
          <h2 class="section-title">${esc(ui.evidence)}</h2>
          <div class="coverage-summary" aria-label="${esc(ui.coverageSummary)}">
            <span>${esc(ui.statusProven)} ${provenCount}</span>
            <span>${esc(ui.statusViolated)} ${violatedCount}</span>
            <span>${esc(ui.statusUnverified)} ${unverifiedCount}</span>
            <span>${esc(ui.statusContradicted)} ${contradictedCount}</span>
          </div>
          ${
            coverageCount
              ? `<h3>${esc(ui.coverage)}</h3>${
                  reviewHike.hills.length
                    ? coverageIndex(contractCoverage, hillByContract, ui)
                    : fallbackCoverageCards
                }`
              : ""
          }
          ${
            choiceCount
              ? `<details class="section-disclosure">
                  <summary>${esc(ui.choices)} · ${choiceCount}</summary>
                  <div class="section-disclosure__body">${choiceCards}</div>
                </details>`
              : ""
          }
        </section>`
      : ""
  }

  ${
    data.notes
      ? `<details class="section-disclosure"><summary>${esc(ui.residualNotes)}</summary><section class="section-disclosure__body notes"><p class="notes__v">${esc(data.notes)}</p></section></details>`
      : ""
  }

  ${
    comprehensionCheck.questions.length
      ? `<details class="section-disclosure" id="comprehension">
          <summary>${esc(ui.comprehension)} · ${comprehensionCheck.questions.length}</summary>
          <div class="section-disclosure__body">
            <section class="overview">
              <p class="overview__value">${esc(comprehensionCheck.prGuidance)}</p>
            </section>
            ${comprehensionCards}
          </div>
        </details>`
      : ""
  }
</main>
</div>

${
  decisionCount
    ? `<div class="bar">
  <div class="bar__inner">
    <span class="hint">${esc(ui.exportHint)}</span>
    <button class="export" id="export">${esc(ui.export)}</button>
  </div>
</div>`
    : ""
}

<script>
  const EMBED = ${embedded};
  const decode = (encoded) => {
    const bytes = Uint8Array.from(atob(encoded || ""), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };
  document.querySelectorAll(".quiz__check").forEach((button) => {
    button.addEventListener("click", () => {
      const index = button.dataset.questionIndex;
      const answer = document.querySelector('.quiz__answer[data-question-index="' + index + '"]');
      const required = document.querySelector('.quiz__required[data-question-index="' + index + '"]');
      const feedback = document.querySelector('.quiz__feedback[data-question-index="' + index + '"]');
      if (!answer || !answer.value.trim()) {
        if (required) required.hidden = false;
        if (feedback) feedback.hidden = true;
        return;
      }
      if (required) required.hidden = true;
      if (feedback) {
        feedback.querySelector(".quiz__criteria").textContent = decode(button.dataset.answer);
        feedback.querySelector(".quiz__evidence").textContent = decode(button.dataset.evidence);
        feedback.hidden = false;
      }
    });
  });
  const exportButton = document.getElementById("export");
  if (exportButton) exportButton.addEventListener("click", () => {
    const reviews = EMBED.findings.map((f, index) => {
      const picked = document.querySelector('input[name="dec-' + index + '"]:checked');
      const note = document.querySelector('textarea.ruling__note[data-finding-index="' + index + '"]');
      return {
        ...f,
        finding_id: f.id,
        decision: picked ? picked.value : "not-required",
        comment: note ? note.value.trim() : "",
      };
    });
    const out = {
      adr: EMBED.adr,
      reviewMode: EMBED.reviewMode,
      verdict: EMBED.verdict,
      scope: EMBED.scope,
      changeScope: EMBED.changeScope,
      contractCoverage: EMBED.contractCoverage,
      implementationChoices: EMBED.implementationChoices,
      comprehensionCheck: EMBED.comprehensionCheck,
      reviews,
      status: "complete",
    };
    const blob = new Blob([JSON.stringify(out, null, 2) + "\\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedback.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const btn = document.getElementById("export");
    btn.textContent = ${inlineScriptJson(ui.saved)};
    btn.classList.add("done");
  });
</script>
</body>
</html>`;
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.in) {
    process.stdout.write(
      "Usage: node adr-impl-review-report.mjs <findings.json|-> [--out PATH] [--stdout]\n",
    );
    process.exit(opts.help ? 0 : 2);
  }

  let raw;
  try {
    raw = opts.in === "-" ? readFileSync(0, "utf8") : readFileSync(opts.in, "utf8");
  } catch (e) {
    die(`cannot read ${opts.in}: ${e.message}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    die(`findings JSON is not valid JSON: ${e.message}`);
  }
  if (!data || typeof data !== "object") die("findings JSON must be an object");
  if (!data.adr) die("findings JSON missing required field: adr");
  if (!data.verdict) die("findings JSON missing required field: verdict");
  data.narrativeSections = loadNarrativeSections(data, opts.in);
  if (!opts.stdout && data.narrativeSections.length === 0) {
    die("validated report narrative is required before writing HTML");
  }

  const html = buildHtml(data);

  if (opts.stdout) {
    process.stdout.write(html);
    return;
  }

  let outPath = opts.out;
  if (!outPath) {
    const dir = opts.in === "-" ? process.cwd() : path.dirname(path.resolve(opts.in));
    outPath = path.join(dir, "adr-impl-review-report.html");
  }
  try {
    writeFileSync(outPath, html);
  } catch (e) {
    die(`cannot write ${outPath}: ${e.message}`);
  }
  process.stdout.write(`wrote ${outPath}\n`);
}

main();
