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
//     "diagramRequirements": [{
//       "id": "V1",
//       "question": "Who calls whom, and in what order?",
//       "diagramType": "sequenceDiagram",
//       "section": "Cancellation stops the upstream request",
//       "reason": "The flow crosses a system boundary.",
//       "evidence": "handler and upstream client call path"
//     }],
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
//         "diagramIds": ["V1"],
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
//           "question": "Which result preserves pending state after provider failure?",
//           "options": [
//             { "id": "A", "text": "mark completed", "feedback": "provider success is missing" },
//             { "id": "B", "text": "keep pending", "feedback": "this preserves the contract" },
//             { "id": "C", "text": "delete payment", "feedback": "deletion is not the failure result" },
//             { "id": "D", "text": "retry forever", "feedback": "retry is bounded" }
//           ],
//           "revisit": true,
//           "correctOptionId": "B",
//           "explanation": "kept out of the visible HTML",
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
import {
  renderQuestion as comprehensionQuestionCard,
  quizLabels,
  quizScript,
} from "../skills/report-write/scripts/comprehension.mjs";
import { CATEGORIES, AUTHORITY } from "./adr-impl-review-categories.mjs";
import { relatedAdrComparisonProse, hillNarrativeParagraphs } from "./adr-impl-review-prose.mjs";
import {
  renderMermaid,
  mermaidBlocks,
  parseMermaid,
  proseLines,
} from "./adr-impl-review-diagrams.mjs";

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
    overview: "Abstract",
    analysis: "Core implementation and algorithms",
    validation: "Self-validation methods and results",
    discussion: "Results, limitations, and future work",
    conclusion: "Conclusion",
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
    findings: "Findings and discussion",
    noCounterexample: "No additional work was identified.",
    diagnosticLabels: {
      contractCompleteness: "Missing contracts",
      testSufficiency: "Test gaps",
      necessity: "Excess scope",
    },
    incomplete: "No work item was confirmed, but the review did not complete.",
    evidence: "Evidence appendix",
    hill: "Review flow · Container",
    reviewQuestion: "Question this flow answers",
    reviewContext: "Related ADRs and change context",
    verticalSlice: "Flow under review",
    sliceTypeLabels: {
      "user-flow": "user flow",
      "logical-capability": "logical capability",
      "bounded-context": "bounded context",
    },
    contextIntent: "Purpose",
    contextPreconditions: "Starting point",
    contextContracts: "What must remain true",
    contextScopeAndRisk: "Review boundary and risk",
    containerResponsibility: "What this flow must achieve",
    containerInteractions: "How the flow proceeds",
    containerOutcome: "What the reader should observe",
    claim: "Claim",
    workedExample: "Worked example",
    counterexample: "Boundary or counterexample",
    assessment: "Assessment",
    components: "How the result is produced",
    componentResponsibility: "Role in the flow",
    componentImplementation: "How it works",
    componentVerification: "How it was verified",
    flowEvidence: "Implementation and evidence",
    componentsCount: "components",
    contractsCount: "contracts",
    codeEvidence: "Code evidence",
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
    recallCue: "Recall your answer before viewing the choices.",
    showChoices: "Show choices",
    printQuizGuidance:
      "Choose one answer for each question and explain your choice in one sentence.",
    printEvidenceNote:
      "Detailed code and verification evidence remain available in the HTML report.",
    diagramSource: "Mermaid source",
    diagramFlows: "Flows explained by this diagram",
    stateStart: "Start",
    stateEnd: "End",
    teachBackCue:
      "Before checking, explain your choice to a teammate in one sentence. Nothing is recorded or graded.",
    revisitBadge: "revisit later",
    revisitGuidance:
      "Reopen this report and retry this core question later. No schedule or progress is stored.",
    selfCheck: "Check selection",
    answerRequired: "Select one choice first.",
    correct: "Correct",
    needsReview: "Review this concept",
    selectedFeedback: "Selection feedback",
    answerCriteria: "Why the correct choice fits",
    gradingEvidence: "Evidence",
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
    overview: "초록",
    analysis: "핵심 구현 방법과 알고리즘",
    validation: "자체 검증 방법과 결과",
    discussion: "결과 해석, 한계와 향후 보완",
    conclusion: "결론",
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
    findings: "발견 사항과 논의",
    noCounterexample: "추가로 처리할 작업이 없습니다.",
    diagnosticLabels: {
      contractCompleteness: "계약 누락",
      testSufficiency: "테스트 공백",
      necessity: "과다 변경",
    },
    incomplete: "확정된 작업은 없지만 리뷰가 완료되지 않았습니다.",
    evidence: "근거 부록",
    hill: "리뷰 흐름 · Container",
    reviewQuestion: "이 흐름이 답해야 할 질문",
    reviewContext: "관련 ADR과 변경 맥락",
    verticalSlice: "검토할 흐름",
    sliceTypeLabels: {
      "user-flow": "사용자 흐름",
      "logical-capability": "논리 기능",
      "bounded-context": "바운디드 컨텍스트(하나의 업무 경계)",
    },
    contextIntent: "목적",
    contextPreconditions: "시작 조건",
    contextContracts: "반드시 유지할 계약",
    contextScopeAndRisk: "검토 경계와 위험",
    containerResponsibility: "이 흐름이 달성할 일",
    containerInteractions: "흐름이 진행되는 방식",
    containerOutcome: "독자가 확인할 결과",
    claim: "주장",
    workedExample: "대표 정상 사례",
    counterexample: "반례·경계 조건",
    assessment: "평가",
    components: "결과를 만드는 구현",
    componentResponsibility: "흐름에서 맡은 역할",
    componentImplementation: "동작 방식",
    componentVerification: "검증 방법과 결과",
    flowEvidence: "구현과 검증 근거",
    componentsCount: "구성 요소",
    contractsCount: "계약",
    codeEvidence: "코드 근거",
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
    recallCue: "선택지를 보기 전에 답을 먼저 떠올려 보세요.",
    showChoices: "선택지 보기",
    printQuizGuidance: "각 질문에서 답 하나를 고르고, 선택한 이유를 한 문장으로 설명해 보세요.",
    printEvidenceNote: "상세 코드와 검증 근거는 HTML 보고서의 근거 부록에서 확인할 수 있습니다.",
    diagramSource: "Mermaid 원문",
    diagramFlows: "이 그림과 연결된 흐름",
    stateStart: "시작",
    stateEnd: "종료",
    teachBackCue:
      "확인하기 전에 선택 이유를 동료에게 한 문장으로 설명해 보세요. 입력하거나 채점하지 않습니다.",
    revisitBadge: "후속 재점검",
    revisitGuidance:
      "나중에 이 보고서를 다시 열어 이 핵심 질문을 풀어보세요. 시간과 진행 상태는 저장하지 않습니다.",
    selfCheck: "선택 확인",
    answerRequired: "먼저 선택지 하나를 고르세요.",
    correct: "정답",
    needsReview: "다시 확인 필요",
    selectedFeedback: "선택한 답의 설명",
    answerCriteria: "정답이 맞는 이유",
    gradingEvidence: "근거",
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
    data.title,
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

/**
 * Prefer a human headline, otherwise derive the title from the reviewed document.
 * A missing source keeps legacy rendering usable without making a path the headline.
 */
function resolveReportTitle(data, inputPath) {
  if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
  if (typeof data.adr === "string") {
    const directory = inputPath === "-" ? process.cwd() : path.dirname(path.resolve(inputPath));
    const candidates = new Set([path.resolve(data.adr), path.resolve(directory, data.adr)]);
    for (const candidate of candidates) {
      try {
        const heading = proseLines(readFileSync(candidate, "utf8")).find((line) =>
          /^#\s+\S/.test(line.value),
        );
        if (heading) return heading.value.replace(/^#\s+(?:ADR\s+\d+\s*[:：]\s*)?/, "").trim();
      } catch {
        // The artifact may be rendered on another machine; its source path is optional here.
      }
    }
  }
  return UI[detectLanguage(data)].title;
}

function slug(value, fallback = "section") {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function renderInlineMarkdown(value) {
  let rendered = esc(value);
  rendered = rendered.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return rendered;
}

/** Render authored prose and complete fences without reinterpreting code as headings. */
function renderMarkdown(source, ui) {
  const lines = String(source ?? "").split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let fence = null;
  let fenceMarker = "";
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
    if (fence) {
      if (new RegExp(`^${fenceMarker[0]}{${fenceMarker.length},}\\s*$`).test(line)) {
        const body = fenceLines.join("\n");
        out.push(
          fence === "mermaid"
            ? renderMermaid(body, ui)
            : `<pre><code class="language-${esc(fence)}">${esc(body)}</code></pre>`,
        );
        fence = null;
        fenceLines = [];
      } else fenceLines.push(line);
      continue;
    }
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/);
    if (fenceMatch) {
      flushParagraph();
      flushList();
      fenceMarker = fenceMatch[1];
      fence = fenceMatch[2].toLowerCase() || "text";
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
  let fence = null;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (new RegExp(`^${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null;
      if (current) current.body.push(line);
      continue;
    }
    if (marker) fence = marker[1];
    const heading = marker ? null : line.match(/^##\s+(.+?)\s*$/);
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

/**
 * Normalize self-check questions so rendering can enforce recall-before-recognition
 * and identify the small subset intended for a later, non-persistent re-check.
 */
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
      options: (Array.isArray(question.options) ? question.options : []).map((option) => ({
        id: option?.id || "",
        text: option?.text || "",
        feedback: option?.feedback || "",
      })),
      revisit: question.revisit === true,
      correctOptionId: question.correctOptionId || "",
      explanation: question.explanation || "",
      evidence: question.evidence || "",
    })),
  };
}

function normalizeReviewDiagnostics(data) {
  const value =
    data.reviewDiagnostics &&
    typeof data.reviewDiagnostics === "object" &&
    !Array.isArray(data.reviewDiagnostics)
      ? data.reviewDiagnostics
      : {};
  const normalize = (field) => ({
    status: value[field]?.status || "UNVERIFIED",
    assessment: value[field]?.assessment || "",
    evidence: value[field]?.evidence || "",
  });
  return {
    contractCompleteness: normalize("contractCompleteness"),
    testSufficiency: normalize("testSufficiency"),
    necessity: normalize("necessity"),
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

/** Keep the structured reading route and visual references available to HTML navigation. */
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
      diagramIds: Array.isArray(hill?.diagramIds) ? hill.diagramIds : [],
      claim: hill?.claim || "",
      workedExample: hill?.workedExample || "",
      counterexample: hill?.counterexample || "",
      assessment: hill?.assessment || "",
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

/**
 * Normalize evidence-grounded ADR analogies so the report can connect new
 * behavior to a familiar contract without exposing a dashboard-style schema.
 */
function normalizeRelatedAdrComparisons(data) {
  const comparisons = Array.isArray(data.relatedAdrComparisons) ? data.relatedAdrComparisons : [];
  return comparisons.map((comparison) => ({
    adr: comparison?.adr || "",
    title: comparison?.title || "",
    similarity: comparison?.similarity || "",
    difference: comparison?.difference || "",
    reviewImpact: comparison?.reviewImpact || "",
    evidence: comparison?.evidence || "",
  }));
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

function narrativeParagraph(label, value, className = "") {
  return `<p${className ? ` class="${className}"` : ""}><strong>${esc(label)}.</strong> ${esc(
    value,
  )}</p>`;
}

/**
 * Render related ADR comparisons as continuous context prose, preserving the
 * paper reading flow while keeping similarities and differences explicit.
 */
function reviewContextCard(context, comparisons, ui, language, body = "", linkedHills = []) {
  const comparisonProse = comparisons
    .map(
      (comparison) =>
        `<p class="adr-comparison">${language === "ko" ? "" : "Compared with "}<strong>${esc(comparison.title)}</strong>${language === "ko" ? "와 비교하면 " : ", "}${esc(
          relatedAdrComparisonProse(comparison, language),
        )}</p>
        <details class="technical-evidence">
          <summary>${esc(ui.evidence)} · ${esc(comparison.title)}</summary>
          <p><code>${esc(comparison.adr)}</code></p>
          <p>${esc(comparison.evidence)}</p>
        </details>`,
    )
    .join("");
  return `
  <section class="paper-section" id="review-context">
    <h2 class="explanation__title">${esc(ui.reviewContext)}</h2>
    <div class="context-narrative" aria-label="${esc(ui.reviewContext)}">
      <p class="narrative-lead">${esc(context.intent)}</p>
      <p>${esc(context.preconditions)}</p>
      <p>${esc(context.contracts)}</p>
      <p>${esc(context.scopeAndRisk)}</p>
      ${comparisonProse}
    </div>
    ${body ? `<div class="explanation__body">${renderMarkdown(body, ui)}</div>` : ""}
    ${linkedHills.length ? `<p>${esc(ui.diagramFlows)}: ${linkedHills.map((hill) => `<a href="#hill-${esc(hill.id.toLowerCase())}">${esc(hill.title)}</a>`).join(" · ")}</p>` : ""}
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
      <div class="component__narrative">
        ${narrativeParagraph(ui.componentResponsibility, component.responsibility)}
        ${narrativeParagraph(ui.componentImplementation, component.implementation)}
        ${narrativeParagraph(ui.componentVerification, component.verification, "verification-note")}
      </div>
      <div class="component__code">${codeCards}</div>
    </article>`;
}

function hillResult(rows, ui) {
  const priority = ["CONTRADICTED", "VIOLATED", "UNVERIFIED", "PROVEN"];
  const status = priority.find((candidate) =>
    rows.some((row) => String(row.status || "").toUpperCase() === candidate),
  );
  const normalizedStatus = status || "UNVERIFIED";
  const label =
    {
      PROVEN: ui.statusProven,
      VIOLATED: ui.statusViolated,
      UNVERIFIED: ui.statusUnverified,
      CONTRADICTED: ui.statusContradicted,
    }[normalizedStatus] || ui.statusUnverified;
  return {
    statusClass: normalizedStatus.toLowerCase(),
    label,
    open: normalizedStatus !== "PROVEN",
  };
}

/** Show each explanation field once while retaining all structured contract and code evidence. */
function reviewHillCard(hill, body, rows, ui) {
  const hillId = hill.id.toLowerCase();
  const result = hillResult(rows, ui);
  const components = hill.components
    .map((component) => componentCard(component, ui, hillId))
    .join("\n");
  const coverageCards = rows
    .map((row, rowIndex) => contractCoverageCard(row, rowIndex, rows.length, ui))
    .join("\n");

  return `
  <section class="paper-subsection" id="hill-${esc(hill.id.toLowerCase())}">
    <h3 class="explanation__title">${esc(hill.title)}</h3>
    ${
      body
        ? `<div class="explanation__body hill__authored-narrative">${renderMarkdown(
            stripGeneratedHillContent(body),
            ui,
          )}</div>`
        : ""
    }
    <div class="hill__narrative" aria-label="${esc(hill.title)}">
      ${hillNarrativeParagraphs(hill)
        .map(
          (paragraph, index) =>
            `<p${index === 0 ? ' class="narrative-lead"' : ""}>${esc(paragraph)}</p>`,
        )
        .join("\n")}
    </div>
    <details class="hill__details"${result.open ? " open" : ""}>
      <summary>
        <span>${esc(ui.flowEvidence)}</span>
      </summary>
      <div class="hill__details-body">
        <h3 class="component-section-title">${esc(ui.components)}</h3>
        <div class="components">${components}</div>
        <div class="hill__evidence">${coverageCards}</div>
      </div>
    </details>
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

/**
 * Keep diagnostic headings in the selected report language without inferring
 * locale from another translated label that can change independently.
 */
function reviewDiagnosticsCard(diagnostics, ui) {
  return ["contractCompleteness", "testSufficiency", "necessity"]
    .map((field) => {
      const item = diagnostics[field];
      return `<section class="paper-subsection">
        <h3>${esc(ui.diagnosticLabels[field])}</h3>
        <p>${esc(item.assessment)}</p>
        <p>${esc(item.evidence)}</p>
      </section>`;
    })
    .join("");
}

function findingDiscussion(findings, ui) {
  if (findings.length === 0) return `<p>${esc(ui.noCounterexample)}</p>`;
  return findings
    .map(
      (finding) =>
        `<p>${esc(finding.summary)} ${esc(finding.whyItMatters)} ${esc(
          finding.requestedChange,
        )} ${esc(finding.completionCriteria)}</p>`,
    )
    .join("");
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

/** Build the standalone reading page, keeping shared diagrams visible and audit detail folded. */
function buildHtml(data) {
  const language = detectLanguage(data);
  const ui = { ...quizLabels[language], ...UI[language] };
  const adr = esc(data.adr || "(no path)");
  const title = esc(data.title || ui.title);
  const styles = readFileSync(new URL("./adr-impl-review-report.css", import.meta.url), "utf8");
  const reviewMode = esc(data.reviewMode || "");
  const status = esc(data.status || "");
  const verdictKey = (data.verdict || "").toUpperCase();
  const scope = Array.isArray(data.scope) ? data.scope : [];
  const changeScope = Array.isArray(data.changeScope) ? data.changeScope : [];
  const metrics = data.metrics && typeof data.metrics === "object" ? data.metrics : null;
  const findings = normalizeFindings(data);
  const atAGlance = normalizeAtAGlance(data);
  const narrativeSections = normalizeNarrativeSections(data);
  const reviewHike = normalizeReviewHike(data);
  const relatedAdrComparisons = normalizeRelatedAdrComparisons(data);
  const reviewDiagnostics = normalizeReviewDiagnostics(data);
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
  const diagnosticCards = reviewDiagnosticsCard(reviewDiagnostics, ui);
  const discussionProse = findingDiscussion(findings, ui);
  const narrativeCards = supportingNarrative
    .map((section) => explanationCard(section.displayTitle, section.body, section.id, ui))
    .join("\n");
  const hillCards = hillsWithRows
    .map((hill) => reviewHillCard(hill, hill.body, hill.rows, ui))
    .join("\n");
  const contextBody = (narrativeByTitle.get("Context")?.body || "")
    .replace(
      /<!-- generated review context start -->[\s\S]*?<!-- generated review context end -->/g,
      "",
    )
    .replace(/<!-- generated review context from findings\.json -->/g, "")
    .trim();
  const contextDiagramIds = new Set(
    (data.diagramRequirements || [])
      .filter((item) => item.section === "Context")
      .map((item) => item.id),
  );
  const linkedHills = reviewHike.hills.filter((hill) =>
    hill.diagramIds.some((id) => contextDiagramIds.has(id)),
  );
  const contextCard = reviewContextCard(
    reviewHike.context,
    relatedAdrComparisons,
    ui,
    language,
    contextBody,
    linkedHills,
  );
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
  const hasOverview = atAGlance.impact || atAGlance.action || atAGlance.risk;
  const tocItems = [
    hasOverview ? { id: "overview", label: ui.overview, level: 0 } : null,
    { id: "review-context", label: ui.reviewContext, level: 0 },
    ...supportingNarrative.map((section) => ({
      id: section.id,
      label: section.displayTitle,
      level: 0,
    })),
    { id: "analysis", label: ui.analysis, level: 0 },
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
    { id: "validation", label: ui.validation, level: 0 },
    { id: "findings", label: ui.discussion, level: 0 },
    { id: "conclusion", label: ui.conclusion, level: 0 },
    comprehensionCheck.questions.length
      ? { id: "comprehension", label: ui.comprehension, level: 0 }
      : null,
    coverageCount || choiceCount ? { id: "evidence", label: ui.evidence, level: 0 } : null,
  ].filter(Boolean);

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
<title>${title} — ${esc(ui.title)}</title>
<style>
${styles}
</style>
</head>
<body class="${decisionCount ? "has-bar" : ""}">
<div class="page">

<main class="wrap">
  <header class="doc">
    <div class="doc__id">
      <p class="eyebrow">${esc(ui.title)}</p>
      <h1 class="doc__title">${title}</h1>
      <details class="review-meta">
      <summary>${esc(ui.reviewDetails)}</summary>
      <div class="doc__meta">
        <p class="doc__path">${adr}</p>
        ${status ? `<div class="doc__status">${status}</div>` : ""}
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
  </header>

  ${
    hasOverview
      ? `<section class="overview" id="overview">
           <h2 class="overview__title">${esc(ui.overview)}</h2>
           <p class="overview__value"><strong>${esc(verdictKey || "—")}.</strong> ${esc(atAGlance.impact)}</p>
           <p class="overview__value">${esc(atAGlance.action)}</p>
           <p class="overview__value overview__risk">${esc(atAGlance.risk)}</p>
         </section>`
      : ""
  }

  <nav class="toc" aria-label="${esc(ui.toc)}">
  <details class="toc__contents">
    <summary>${esc(ui.toc)}</summary>
    <ol>
      ${tocItems.map((item) => `<li data-level="${item.level || 0}"><a href="#${esc(item.id)}">${esc(item.label)}</a></li>`).join("")}
    </ol>
  </details>
</nav>

  ${contextCard}
  ${narrativeCards}
  <section id="analysis">
    <h2 class="section-title">${esc(ui.analysis)}</h2>
    ${hillCards}
  </section>

  <section class="paper-section" id="validation">
    <h2 class="section-title">${esc(ui.validation)}</h2>
    <p>${esc(reviewDiagnostics.testSufficiency.assessment)}</p>
    <p>${esc(reviewDiagnostics.testSufficiency.evidence)}</p>
  </section>

  <section id="findings">
    <h2 class="section-title">${esc(ui.discussion)}</h2>
    <div class="discussion-prose">${diagnosticCards}</div>
    ${discussionProse}
    ${data.notes ? `<p>${esc(data.notes)}</p>` : ""}
  </section>

  <section id="conclusion">
    <h2 class="section-title">${esc(ui.conclusion)}</h2>
    <p>${esc(verdictKey || "—")}. ${esc(atAGlance.action)} ${esc(atAGlance.risk)}</p>
  </section>

  ${
    comprehensionCheck.questions.length
      ? `<section class="paper-section" id="comprehension">
          <h2 class="section-title">${esc(ui.comprehension)}</h2>
          <div class="comprehension__body">
            <div class="comprehension__screen-guidance">
              <p>${esc(comprehensionCheck.prGuidance)}</p>
            </div>
            <p class="print-only">${esc(ui.printQuizGuidance)}</p>
            ${comprehensionCards}
          </div>
        </section>`
      : ""
  }

  <p class="print-only print-evidence-note">${esc(ui.printEvidenceNote)}</p>

  ${
    coverageCount || choiceCount || count
      ? `<details class="section-disclosure" id="evidence">
          <summary>${esc(ui.evidence)}</summary>
          <div class="section-disclosure__body">
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
          ${count ? `<h3>${esc(ui.findings)}</h3>${cards}` : ""}
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
  ${quizScript(ui)}
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
  data.title = resolveReportTitle(data, opts.in);
  if (!opts.stdout && data.narrativeSections.length === 0) {
    die("validated report narrative is required before writing HTML");
  }

  if (Array.isArray(data.diagramRequirements) && data.diagramRequirements.length) {
    const blocks = data.narrativeSections.flatMap((section) =>
      mermaidBlocks(`## ${section.title}\n${section.body}`),
    );
    for (const requirement of data.diagramRequirements) {
      const matches = blocks.filter((block) => block.requirementId === requirement.id);
      if (matches.length !== 1 || !matches[0].closed || parseMermaid(matches[0].source).error) {
        die(
          `required diagram ${requirement.id} cannot render; repair its source before writing HTML`,
        );
      }
    }
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
