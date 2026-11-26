import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { renderHtml } from "../../skills/report-writer/scripts/render-report.mjs";
import { summarize, summarizeRouting, comparePairs } from "./metrics.mjs";
import { sha, confined } from "../regression/workspace.mjs";
import { summarizeReportAxes } from "./report-evaluation.mjs";

const labels = { classification: "분류 응답", routing: "Skill 선택", execution: "실제 수행" };
const statuses = { PASS: "충족", NOT_PROVEN: "미충족·미검증", ERROR: "오류", NOT_RUN: "미실행" };
/** Keep undefined denominators distinct from a measured zero rate. */
const rate = (x) => (x === null ? "미측정" : `${(x * 100).toFixed(1)}%`);

/** Present model/log text as prose while retaining the verbatim audit JSON. */
const prose = (text) => String(text ?? "").replace(/\r?\n/g, " ");

// Presentation-only hierarchy. It does not change prompts, expectations, or scores.
const groups = [
  ["제품 계약", "수용과 개선", "결과와 지표", ["alps-evaluates-outcomes-", "alps-metrics-"]],
  ["제품 계약", "수용과 개선", "근거 검토", "안내", "완료 안내", ["alps-research-offers-once-"]],
  [
    "제품 계약",
    "수용과 개선",
    "근거 검토",
    "안내",
    "재질문과 재사용",
    [
      "alps-research-offers-reuse-",
      "alps-research-offers-not-again-",
      "alps-research-offers-after-",
    ],
  ],
  ["제품 계약", "수용과 개선", "근거 검토", "조사와 판정", ["alps-research-reports-"]],
  ["제품 계약", "수용과 개선", "근거 검토", "반영", ["alps-research-applies-"]],
  ["제품 계약", "수용과 개선", "근거 검토", "작성 중 제안", ["alps-research-inflight-"]],
  ["제품 계약", "Full ALPS", "계약과 승인", ["alps-approval-", "alps-batch-", "alps-reference-"]],
  ["제품 계약", "Full ALPS", "기능 구성", ["alps-groups-", "alps-high-", "alps-feature-"]],
  ["제품 계약", "Full ALPS", "Lite 파생", ["alps-full-"]],
  ["제품 계약", "Lite ALPS", "문제 정의", ["lite-alps-asks-"]],
  [
    "제품 계약",
    "Lite ALPS",
    "요구사항 제안과 데모",
    "요구사항 제안",
    ["lite-alps-proposes-", "lite-alps-groups-"],
  ],
  ["제품 계약", "Lite ALPS", "요구사항 제안과 데모", "미확인 근거", ["lite-alps-flags-"]],
  [
    "제품 계약",
    "Lite ALPS",
    "요구사항 제안과 데모",
    "데모와 재개",
    ["lite-alps-generates-", "lite-alps-resume-"],
  ],
  ["제품 계약", "Lite ALPS", "성공 기준", ["lite-alps-success-"]],
  ["제품 계약", "Lite ALPS", "범위", ["lite-alps-records-", "lite-alps-skips-"]],
  [
    "제품 계약",
    "계약 이전",
    "완전성과 반복 인계",
    [
      "feature-handoff-enriches-",
      "feature-handoff-idempotent-",
      "feature-handoff-ownership-",
      "feature-handoff-drops-",
    ],
  ],
  [
    "제품 계약",
    "계약 이전",
    "업무 경계와 승인",
    ["feature-handoff-preserves-", "feature-handoff-delegation-", "feature-handoff-routes-model-"],
  ],
  [
    "결정 관리",
    "작성",
    "요구사항",
    ["author-keeps-", "author-rejects-", "author-self-", "author-verifies-"],
  ],
  [
    "결정 관리",
    "작성",
    "소유권과 승인",
    ["author-delegation-", "author-routes-", "author-review-", "author-defers-model-"],
  ],
  ["결정 관리", "작성", "업무 경계", "경계 발견", ["author-groups-", "author-discovers-"]],
  ...[
    [
      "업무 맥락 확인",
      "작성 경로",
      [
        "author-checks-business-context",
        "author-checks-business-recorded-",
        "author-checks-business-scenarios",
      ],
    ],
    [
      "업무 맥락 확인",
      "준수 계약과 제안",
      [
        "author-checks-business-compliance-",
        "author-checks-business-proposed-",
        "author-checks-business-rejected-",
        "author-checks-business-confirm-",
      ],
    ],
    [
      "업무 맥락 확인",
      "동기화·가져오기·통합",
      [
        "author-checks-business-sync-body",
        "author-checks-business-sync-revert",
        "author-checks-business-import",
        "author-checks-business-rollup",
      ],
    ],
    [
      "업무 맥락 확인",
      "범주와 생명주기",
      [
        "author-checks-business-split-",
        "author-checks-business-supersede",
        "author-checks-business-deprecate-",
        "author-checks-business-no-model",
      ],
    ],
    // Without Ontology Writer the query cannot start; those cases sit beside its start.
    [
      "조회 착수와 기준 상태",
      "조회 착수와 조회 불가",
      ["author-sync-starts-", "author-checks-business-without-"],
    ],
    ["조회 착수와 기준 상태", "확인된 빈 기록", ["author-records-confirmed-"]],
    [
      "조회 착수와 기준 상태",
      "조회 후 변경안 작성",
      ["author-checks-business-rule-proposal", "author-checks-business-value-proposal"],
    ],
    [
      "조회 착수와 기준 상태",
      "확정되지 않은 맥락",
      [
        "author-checks-business-unsettled-",
        "author-checks-business-history-",
        "author-checks-business-open-",
      ],
    ],
  ].map((group) => ["결정 관리", "작성", "업무 경계", ...group]),
  [
    "결정 관리",
    "작성",
    "업무 경계",
    "컨텍스트 자기 완결",
    ["author-records-relied-on-", "author-places-terms-"],
  ],
  ["결정 관리", "작성", "기존 프로젝트", ["import-"]],
  ["결정 관리", "문서 검토", "요구사항 보존", ["review-catches-", "review-requirement-"]],
  [
    "결정 관리",
    "문서 검토",
    "완결성과 검토 범위",
    ["review-real-", "review-provability", "review-flags-unexplained-"],
  ],
  ["결정 관리", "문서 검토", "규칙 문서 갱신", ["review-refreshes-"]],
  [
    "결정 관리",
    "동기화와 통합",
    "의도와 계약",
    ["sync-batches-", "sync-resumes-", "sync-prefers-"],
  ],
  ["결정 관리", "동기화와 통합", "표현과 검증", ["sync-rewrites-"]],
  ["결정 관리", "동기화와 통합", "통합 범위", ["rollup-"]],
  ["결정 관리", "동기화와 통합", "세션 분류", "ADR 작성 대상", ["hook-admission-"]],
  ["결정 관리", "동기화와 통합", "세션 분류", "업무 규칙 변경", ["hook-business-"]],
  ["결정 관리", "동기화와 통합", "세션 분류", "요구값 변경", ["hook-value-"]],
  ...[
    [
      "구축 진입과 ADR 검토",
      "첫 구축 진입",
      ["ontology-build-offers-", "ontology-build-reuses-review-", "ontology-build-one-time-"],
    ],
    [
      "구축 진입과 ADR 검토",
      "리뷰 방식 기록",
      ["ontology-build-unanswered-review-", "ontology-build-remembers-review-"],
    ],
    [
      "구축 진입과 ADR 검토",
      "ADR 검토 경로와 검증 재사용",
      [
        "ontology-build-reviews-then-",
        "ontology-build-without-adrs-",
        "ontology-build-reuses-verified-",
      ],
    ],
    // Each probes- case asks several independent build questions in one run.
    [
      "자료와 범위",
      "범위·용어·부분 결과와 문서 속 지시",
      ["ontology-build-probes-scope-", "ontology-build-ignores-"],
    ],
    [
      "후보 보고와 질문",
      "입력 표시·필수 항목과 기존 모델",
      ["ontology-build-probes-marks-", "ontology-build-diffs-current-"],
    ],
    ["후보 보고와 질문", "질문 해소·사건 지도와 근거 보존", ["ontology-build-probes-questions-"]],
    [
      "후보 보고와 질문",
      "질문 세션의 답 반영과 질의응답",
      [
        "ontology-build-discussion-",
        "ontology-build-posts-follow-",
        "ontology-build-reads-conversation-",
      ],
    ],
    ["저장 승인", "상태 근거와 승인 요약", ["ontology-build-probes-status-"]],
  ].map((group) => ["결정 관리", "업무 온톨로지", "모델 구축", ...group]),
  ["결정 관리", "업무 온톨로지", "변경 승인", ["ontology-edit-"]],
  ["결정 관리", "업무 온톨로지", "준비 상태와 실행 정렬", ["ontology-sync-", "ontology-align-"]],
  ["결정 관리", "업무 온톨로지", "세션 안내와 맥락 조회", ["ontology-session-", "ontology-query-"]],
  ["구현 보장", "의존성과 계획", "선행 상태와 계획", ["impl-blocks-", "impl-plans-", "impl-edit-"]],
  ["구현 보장", "의존성과 계획", "의도와 기본값 판단", ["impl-resolves-", "impl-uses-intent-"]],
  [
    "구현 보장",
    "완료와 검증",
    "사전 검증과 완료",
    ["impl-completes-", "impl-requires-", "impl-provability"],
  ],
  ["구현 보장", "완료와 검증", "평가와 증거", ["impl-distinguishes-"]],
  [
    "구현 보장",
    "완료와 검증",
    "업무 맥락과 검증 연결",
    [
      "impl-reports-business-context-",
      "impl-reports-business-scenarios-",
      "impl-reports-business-alignment-",
      "impl-reports-business-unsettled-",
    ],
  ],
  [
    "구현 보장",
    "완료와 검증",
    "업무 맥락과 상태 전이",
    ["impl-reports-business-auto-", "impl-reports-business-pending-"],
  ],
  ["구현 보장", "규모와 전달", ["impl-high-", "impl-lands-"]],
  ["구현 보장", "실행 수단", ["refactor-", "bedrock-"]],
  [
    "리뷰와 설명",
    "판정 근거",
    "계약 충족의 증거",
    ["impl-review-evidence-", "impl-review-provability", "impl-review-stays-local-"],
  ],
  [
    "리뷰와 설명",
    "판정 근거",
    "계약과 구현 사실의 구분",
    ["impl-review-enum-", "impl-review-surfaces-"],
  ],
  ["리뷰와 설명", "역할과 완료", ["impl-review-selects-risk-"]],
  ["리뷰와 설명", "이해도 확인", ["impl-review-comprehension-", "impl-review-selects-useful-"]],
  ["리뷰와 설명", "보고서 품질", "인지부하", ["comprehension-"]],
  [
    "리뷰와 설명",
    "보고서 품질",
    "단계별 이해",
    "독자 맥락",
    ["report-drilldown-familiar-", "report-drilldown-experienced-", "report-drilldown-no-reader-"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "단계별 이해",
    "깊이와 의미 검토",
    ["report-drilldown-distinguishes-", "report-drilldown-rejects-", "report-drilldown-path-"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "단계별 이해",
    "시각 표현과 인쇄",
    "전체 그림",
    "작성 기본값",
    ["report-drilldown-overview-explicit", "report-drilldown-overview-default"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "단계별 이해",
    "시각 표현과 인쇄",
    "전체 그림",
    "제약과 검토",
    ["report-drilldown-overview-"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "단계별 이해",
    "시각 표현과 인쇄",
    "세부 그림",
    ["report-drilldown-visual-", "report-diagram-"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "단계별 이해",
    "시각 표현과 인쇄",
    "인쇄",
    ["report-drilldown-print-"],
  ],
  ["리뷰와 설명", "보고서 품질", "단계별 이해", "목적과 인과", ["report-drilldown-"]],
  [
    "리뷰와 설명",
    "보고서 품질",
    "생성 범위",
    "생성 여부 판단",
    ["report-scope-chat-by-", "report-scope-complex-", "report-scope-ambiguous"],
  ],
  ["리뷰와 설명", "보고서 품질", "생성 범위", "텍스트 전달과 퀴즈", ["report-scope-text-"]],
  [
    "리뷰와 설명",
    "보고서 품질",
    "생성 범위",
    "명시적 전달 계약",
    ["report-scope-chat-as-", "report-scope-requested-"],
  ],
  ["리뷰와 설명", "보고서 품질", "생성 범위", "학습 지원과 전달 검증", ["report-scope-finish-"]],
  [
    "리뷰와 설명",
    "보고서 품질",
    "근거 보존",
    "조건과 허용 행동",
    ["report-regression-shared-", "report-regression-notification-"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "근거 보존",
    "문서와 출처",
    ["report-artifact-", "report-regression-artifact-"],
  ],
  [
    "리뷰와 설명",
    "보고서 품질",
    "근거 보존",
    "문장과 용어",
    "용어와 개념",
    ["report-terminology-"],
  ],
  ["리뷰와 설명", "보고서 품질", "근거 보존", "문장과 용어", "문장 명료성", ["report-slop-"]],
  ["리뷰와 설명", "보고서 품질", "근거 보존", "수치와 검증 범위", ["report-"]],
];

/** Preserve the complete case records while grouping the human view by the responsibility being evaluated. */
function casePath(item) {
  if (item.type === "execution") {
    if (item.skill === "adr-sync") return ["동기화"];
    if (item.skill === "adr-import")
      return [
        "기존 프로젝트 도입",
        item.id.startsWith("import-prerequisites-") ? "선행 보장과 분류" : "의도 확인과 채택",
      ];
    if (item.id.startsWith("rollup-encbird-current-")) return ["통합", "현재 EncBird 계약"];
    if (item.reportGroup) return ["통합", "파괴적 변경 안전", item.reportGroup];
    return ["통합", /discover|reject/.test(item.id) ? "계획 발견" : "승인과 계약 보존"];
  }
  if (item.type === "routing") {
    if (!item.required.length) return ["불필요한 호출"];
    if (
      item.required.some((skill) =>
        ["alps-init", "lite-alps-init", "feature-to-adr"].includes(skill),
      )
    )
      return ["필요한 호출", "제품 문서"];
    return [
      "필요한 호출",
      "ADR 작업",
      item.required.some((skill) => ["adr-import", "adr-new", "adr-impl"].includes(skill))
        ? "작성과 구현"
        : "문서 관리",
    ];
  }
  const entry = groups.find((g) => g.at(-1).some((prefix) => item.id.startsWith(prefix)));
  if (!entry) throw new Error(`Add a report responsibility for new scenario ${item.id}`);
  return entry.slice(0, -1);
}

/** Build stable navigation identifiers without embedding paths or model text into HTML attributes. */
function node(title, key) {
  return {
    id: `n-${sha(key).slice(0, 16)}`,
    title,
    domain: title,
    scope: "선택한 평가 범위의 결과와 원본 근거",
    /** The evaluation catalog keeps every group open at every depth for side-by-side scanning. */
    expanded: true,
    children: [],
  };
}

/** Insert a case beneath its authored responsibility; renderer validation rejects excessive peer counts. */
function insert(parent, parts, leaf) {
  if (leaf.expanded) parent.expanded = true;
  if (!parts.length) {
    parent.children.push(leaf);
    return;
  }
  const [title, ...rest] = parts;
  let child = parent.children.find((n) => n.title === title);
  if (!child) {
    child = node(title, `${parent.id}/${title}`);
    parent.children.push(child);
  }
  insert(child, rest, leaf);
}

/** Describe conditional rates with their denominators and keep skipped/error requests visible. */
function summaryText(runs, { includeResources = true } = {}) {
  const s = summarize(runs);
  const origin =
    s.reused || s.rejudged
      ? ` 그중 새 실행 ${s.executed}회 · 저장 증거 재판정 ${s.rejudged}회 · 지문이 같은 기존 결과 재사용 ${s.reused}회.`
      : "";
  const counts = `요청 ${s.requested}회 · 채점 완료 ${s.scored}회 · 충족 ${s.passed}회 · 미충족·미검증 ${s.notProven}회 · 오류 ${s.errors}회 · 미실행 ${s.notRun}회.${origin} 채점 완료 중 충족률 ${rate(s.successRate)}.`;
  if (!includeResources) return counts;
  return `${counts} 알려진 비용 $${s.knownCostUSD.toFixed(4)}, 금액 미측정 호출 ${s.unpricedCalls}회. 누적 실행 시간 ${(s.elapsedMs / 1000).toFixed(1)}초.`;
}

/** Name reused, rejudged, executed and omitted cases separately, with the clients that produced them. */
function originNames(report) {
  const runs = report.runs;
  const names = (test) => [...new Set(runs.filter(test).map((r) => r.caseId))];
  const reused = names((r) => r.origin === "reused");
  const rejudged = names((r) => r.origin === "rejudged");
  const omitted = report.selection?.omitted ?? [];
  const beyond = Object.entries(report.selection?.beyondImpactMap ?? {});
  const lines = [];
  if (reused.length || rejudged.length) {
    const executed = names(
      (r) => r.verdict !== "NOT_RUN" && !["reused", "rejudged"].includes(r.origin),
    );
    const producers = [
      ...new Set(
        runs
          .filter((r) => r.origin === "reused")
          .map(
            (r) =>
              `${(r.targetModels ?? []).join("+") || "모델 미상"} / ${r.reusedFrom?.clientVersion ?? r.clientVersion ?? "client 미상"}`,
          ),
      ),
    ];
    lines.push(
      `증거 출처: 새로 실행한 사례 ${executed.length}개(${executed.join(", ") || "없음"}), 저장된 대상 응답을 현재 기준으로 재판정한 사례 ${rejudged.length}개(${rejudged.join(", ") || "없음"}), 지문·소비 파일·채점 기준이 같은 기존 결과를 재사용한 사례 ${reused.length}개(${reused.join(", ") || "없음"}). 재사용 결과는 새 실행이 아니며 원래 실행 시점의 판정입니다. 재사용 결과를 만든 모델·client: ${producers.join(", ")}.`,
    );
  }
  if (beyond.length)
    lines.push(
      `영향표 밖에서 선택한 사례: ${beyond.map(([id, reason]) => `${id}(${reason})`).join(", ")}.`,
    );
  if (omitted.length)
    lines.push(
      `변경 선택에서 제외한 사례 ${omitted.length}개: 실린 입력과 저장된 지문이 바뀌지 않았거나 변경과 무관합니다. ${omitted.join(", ")}.`,
    );
  return lines;
}

/** Reject incomplete, duplicate, or malformed saved results rather than displaying a deceptively green report. */
export function validateResults(report) {
  if (
    report.schemaVersion !== 1 ||
    report.framework !== "skill-evals" ||
    !Array.isArray(report.cases) ||
    !report.cases.length ||
    !Array.isArray(report.runs)
  )
    throw new Error("Expected a skill-evals results document");
  const byId = new Map();
  for (const c of report.cases) {
    if (!/^[a-z0-9-]+$/.test(c.id) || byId.has(c.id) || !labels[c.type])
      throw new Error("Invalid or duplicate case");
    byId.set(c.id, c);
  }
  if (!Number.isInteger(report.runsPerCase) || report.runsPerCase < 1)
    throw new Error("Invalid repeat count");
  const seen = new Set();
  for (const r of report.runs) {
    const c = byId.get(r.caseId);
    if (
      !c ||
      c.type !== r.type ||
      !statuses[r.verdict] ||
      !Number.isInteger(r.repeat) ||
      r.repeat < 1 ||
      r.repeat > report.runsPerCase ||
      !report.variants.includes(r.variant)
    )
      throw new Error("Invalid run identity or verdict");
    const key = `${r.caseId}/${r.variant}/${r.repeat}`;
    if (seen.has(key)) throw new Error("Duplicate run");
    seen.add(key);
  }
  // A fixed policy requests every repeat. The automatic policy requests at least
  // one and adds repeats only after a failure, numbered in order up to runsPerCase.
  for (const c of report.cases)
    for (const v of c.type === "execution" ? report.variants : ["candidate"]) {
      const count =
        report.repeatPolicy === "auto"
          ? report.runs.filter((r) => r.caseId === c.id && r.variant === v).length
          : report.runsPerCase;
      for (let i = 1; i <= Math.max(count, 1); i++)
        if (!seen.has(`${c.id}/${v}/${i}`)) throw new Error("Missing requested run");
    }
  return report;
}

// Readers can poll progress or regenerate a report while workers are finishing.
function publish(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, text, { flag: "wx" });
    renameSync(temporary, file);
  } catch (error) {
    if (error.code !== "EEXIST") rmSync(temporary, { force: true });
    throw error;
  }
}

function saveCase(directory, item, runs) {
  publish(
    path.join(directory, "case-results", `${item.id}.json`),
    JSON.stringify({ case: item, runs }, null, 2),
  );
}

/** Keep durable progress per completion. Compose the full HTML initially and at the final join. */
export function startSkillsReport(directory, report, updateIndex) {
  validateResults(report);
  // Group on every save: the automatic repeat policy adds runs after a failure.
  const runs = () => Map.groupBy(report.runs, (r) => r.caseId);
  const live = report.mode !== "PREPARED";
  const saveIndex = () => {
    updateIndex?.(runs());
    publish(path.join(directory, "results.json"), JSON.stringify(report, null, 2));
  };
  saveIndex();
  if (live) saveSkillsReport(directory, report, { inProgress: true });
  return {
    completed(item) {
      if (!live) return;
      saveCase(directory, item, runs().get(item.id));
      saveIndex();
    },
    finish() {
      saveIndex();
      return saveSkillsReport(directory, report, { writeCases: !live });
    },
  };
}

/** Render only captured data; no target, judge, telemetry, or cloud upload is involved. */
export function saveSkillsReport(
  directory,
  report,
  { writeCases = true, inProgress = false } = {},
) {
  validateResults(report);
  mkdirSync(path.join(directory, "case-results"), { recursive: true });
  const runsByCase = Map.groupBy(report.runs, (r) => r.caseId);
  const evidence = [];
  const sections = [];
  for (const type of Object.keys(labels)) {
    const cases = report.cases.filter((c) => c.type === type);
    if (!cases.length) continue;
    const section = node(labels[type], type);
    section.preview =
      type === "classification"
        ? "시나리오에 대한 답변과 해당 사례가 요구한 결과물을 확인한다."
        : type === "routing"
          ? "스킬의 이름과 설명으로 필요한 스킬을 고를 수 있는지 확인한다."
          : "도구 호출과 실제 문서 변경을 승인 조건 및 요구된 결과와 대조한다.";
    section.paragraphs = [
      summaryText(report.runs.filter((r) => r.type === type)),
      type === "classification"
        ? "응답 충족률로 실제 작업 완료율을 판단할 수 없다."
        : type === "routing"
          ? "통제된 선택 과제에서 배포된 스킬 이름과 설명을 사용했다. 실제 클라이언트의 설치·자동 호출은 검증 범위 밖이다."
          : "승인 전에 문서를 변경했다가 되돌렸다면 원상 복구 후에도 그 도구 호출을 평가 근거에 포함한다.",
    ];
    if (type === "classification" && cases.some((c) => c.semanticObligations)) {
      section.paragraphs.push(
        "의미 평가가 설정된 사례는 DeepEval GEval로 응답·결과물·도구 기록을 고정된 행동 기준과 대조합니다. 기존 로컬 검사도 있는 경우 두 판정을 모두 충족해야 합니다. 태그나 완료 선언만으로 실제 행동이 입증되지는 않습니다.",
      );
    }
    if (type === "routing") {
      const s = summarizeRouting(report.runs.filter((r) => r.type === type));
      section.paragraphs.push(
        `선택 정밀도 ${rate(s.precision)}, 재현율 ${rate(s.recall)}. 필수 선택 적중 ${s.tp}, 누락 ${s.fn}, 불필요한 선택 ${s.fp}, 무호출 정답 ${s.tn}. 허용된 선택적 보조 Skill은 필수 선택 비율에서 제외합니다.`,
      );
    }
    if (type === "execution") {
      for (const variant of ["without-skill", "baseline"].filter((v) =>
        report.variants.includes(v),
      )) {
        const c = comparePairs(report.runs, variant);
        section.paragraphs.push(
          `${variant === "without-skill" ? "Skill Lift" : "버전 간 차이"}: ${c.differencePP === null ? "비교 불충분" : `${c.differencePP.toFixed(1)}%p`}. 유효한 쌍 ${c.validPairs}/${c.requestedPairs}, 제외 ${c.excludedPairs}. 같은 사례·반복에서 후보 충족 여부에서 비교 조건의 충족 여부를 빼 평균합니다. 작은 차이는 효과의 확정이나 자동 폐기 근거가 아닙니다.`,
        );
      }
    }
    for (const item of cases) {
      const runs = runsByCase.get(item.id);
      const source = `case-results/${item.id}.json`;
      if (writeCases) saveCase(directory, item, runs);
      const eid = `case-${item.id}`;
      evidence.push(eid);
      const leaf = {
        id: `case-${item.id}`,
        title: item.title,
        domain: labels[type],
        scope: item.id,
        expanded: true,
        paragraphs: [
          summaryText(runs),
          ...summarizeReportAxes(item, runs).map(
            ({ label, counts }) =>
              `${label}: 통과 ${counts.PASS}회, 위반 ${counts.FAIL}회, 미검증 ${counts.UNVERIFIED}회, 평가 오류 ${counts.ERROR}회, 미실행 ${counts.NOT_RUN}회, 세부 판정 기록 없음 ${counts.MISSING}회.`,
          ),
          ...["NOT_PROVEN", "ERROR", "NOT_RUN"].flatMap((verdict) => {
            const selected = runs.filter((run) => run.verdict === verdict);
            if (!selected.length) return [];
            const trials = selected.map((run) => `${run.variant} #${run.repeat}`).join(", ");
            const reasons = [
              ...new Set(
                selected
                  .flatMap((run) => [
                    run.error || run.notRunReason,
                    ...(run.checks ?? [])
                      .filter((check) => !check.pass)
                      .map((check) => `${check.label}: ${check.detail}`),
                    run.testResult?.metricsData?.[0]?.reason,
                  ])
                  .filter(Boolean)
                  .map(prose),
              ),
            ];
            return [
              `${statuses[verdict]} ${selected.length}회 (${trials}). ${reasons.join(" / ")}`,
            ];
          }),
        ],
        evidence: [{ id: eid, label: "사례·반복별 판정과 원본 증거 위치", source }],
      };
      insert(section, casePath(item), leaf);
    }
    sections.push(section);
  }
  const conditions = {
    id: "conditions",
    title: "실행 조건과 해석",
    domain: "평가 운영",
    scope: "원본 결과의 재현과 한계",
    preview: "반복 횟수와 모델·실행 조건을 확인해 비교 가능한 결과를 구분한다.",
    paragraphs: [
      `평가 시각 ${report.generatedAt}. 선택 ${JSON.stringify(report.selection)}. ${report.repeatPolicy === "auto" ? `반복 자동: 기본 1회(새 사례·확정 확인 2회), 실패·오류 시 최대 ${report.autoMaxRuns ?? 3}회까지 새로 실행. 실패가 알려졌거나 채점이 바뀌면 행동 지문이 같은 저장 결과를 모두 표본에 남김` : `반복 ${report.runsPerCase}회`}. ${summaryText(report.runs)}`,
      ...originNames(report),
      ...(report.sourceReport
        ? [
            `재판정: ${report.sourceReport}. 대상 응답은 재사용했으며 새로 생성하지 않았습니다. 이전 검사 정책 ${report.sourceScoringPolicy}, 현재 ${report.scoringPolicy}. 판정 정책 변경에 따른 점수 차이는 Skill 행동 개선율이 아닙니다.`,
          ]
        : []),
      `환경 ${JSON.stringify(report.runtime)}. 평가 집합 ${report.datasetHash}. 준비 결과는 모델 성능 측정이 아닙니다. 미사용 조건에서도 필수 제품·조직 계약과 초기 파일은 유지합니다.`,
      "비교 예시(가상): 동일한 100개 유효 쌍에서 미사용 60회, 사용 85회 충족이면 85% − 60% = +25%p입니다. 오류가 있거나 모델·실행 조건이 다르면 해당 쌍을 제외하며, 유효한 쌍이 없으면 차이를 계산하지 않습니다.",
      "판정·시각 검토는 자동 렌더링과 별개입니다. 실제 클라이언트 자동 호출, 배포 환경과 일반 사용자 전체에 대한 효과는 이 평가에서 입증하지 않습니다.",
    ],
    evidence: [{ id: "raw", label: "전체 원본 결과", source: "results.json" }],
    diagram: {
      source:
        "sequenceDiagram\nparticipant U as 평가 사용자\nparticipant A as 독립 실행\nparticipant V as 고정 기준 판정\nparticipant R as 저장된 결과\nU->>A: 평가 과제와 조건\nA->>V: 결과물과 관찰 행동\nV->>R: 판정과 원본 증거\nR-->>U: 사례별 리포트\nU->>R: 같은 결과 다시 보기\nR-->>U: 모델 호출 없는 리포트",
      explanation:
        "준비 모드는 실행·채점을 생략합니다. 저장된 결과를 다시 보는 경로는 모델을 호출하지 않습니다.",
    },
  };
  const testedBehaviors = sections.map((section) => section.title).join(" · ");
  sections.push(conditions);
  evidence.push("raw");
  const doc = {
    title: "Skill 평가 결과",
    language: "ko",
    purpose: ["선택한 사례에서 어떤 스킬 동작이 확인됐고 무엇을 더 검증해야 하는지 판단한다."],
    background: [
      `평가 대상은 ${report.cases.length}개 사례다. 각 사례의 요청과 실행 기록을 기준으로 결과를 집계했다.`,
    ],
    summary: [
      ...(inProgress
        ? [
            "실행 시작 시점의 보고서입니다. 진행 중에는 results.json에서 완료된 결과를 확인할 수 있습니다. 최종 HTML은 실행이 끝나면 갱신됩니다.",
          ]
        : []),
      summaryText(report.runs, { includeResources: false }),
      "결과는 선택한 사례와 실행 조건에 한정된다. 실제 클라이언트의 설치와 자동 호출은 별도 검증 대상이다.",
    ],
    overview: {
      paragraphs: [
        `이번 평가에서 다룬 동작은 ${testedBehaviors}이다. 각 동작의 집계는 개별 사례를 반복한 결과에서 나온다. 실행 조건은 어떤 결과끼리 비교할 수 있는지 정한다.`,
        ...(report.cases.some((item) => item.reportEvaluation)
          ? [
              "보고서 사례는 최종 저장본의 용어, 출처, 도표, 구성을 평가한다. 종합 통과에는 필수 의미 판정과 로컬 검사가 모두 필요하다. 과거 결과에서 확인할 수 있는 항목만 표시한다.",
            ]
          : []),
      ],
    },
    sections,
    requiredEvidenceIds: evidence,
    review: {
      status: "draft",
      basis: "고정된 결과에서 구조·출처를 검증해 자동 생성. 개별 출력의 사람 검토는 수행하지 않음.",
      limitations:
        "현재 집합과 통제된 실행 조건에 한정. 채점기 라벨의 사람 검수와 통계적 효과 확정은 별도.",
    },
    comprehensionCheck: {
      questions: [
        {
          id: "Q1",
          sectionId: "conditions",
          question:
            "후보와 미사용 조건의 대상 모델이 서로 다르면 성공률 차이를 어떻게 읽어야 할까요?",
          options: [
            {
              id: "A",
              text: "양쪽 모두 성공했으면 같은 조건으로 간주한다.",
              feedback: "성공 여부와 실험 조건의 일치는 별개입니다.",
            },
            {
              id: "B",
              text: "해당 쌍을 비교에서 제외하고 이유를 남긴다.",
              feedback: "모델 차이가 Skill 효과와 섞이므로 비교를 확정할 수 없습니다.",
            },
            {
              id: "C",
              text: "누락된 조건을 0점으로 채운다.",
              feedback: "비교 근거 부족은 행동 실패 점수가 아닙니다.",
            },
            {
              id: "D",
              text: "반복 수만 늘리면 같은 비교가 된다.",
              feedback: "반복만으로 서로 다른 모델 조건이 같아지지는 않습니다.",
            },
          ],
          correctOptionId: "B",
          explanation:
            "Skill Lift는 동일 과제·모델·평가 기준·실행 조건의 유효한 쌍에서만 계산합니다.",
          evidence: "실행 조건과 해석의 비교 조건 및 제외 규칙.",
          revisit: true,
        },
      ],
    },
  };
  const html = renderHtml(doc, { requireOpening: true, requireQuiz: true });
  publish(path.join(directory, "report.json"), JSON.stringify(doc, null, 2));
  publish(path.join(directory, "index.html"), html);
  return path.join(directory, "index.html");
}

/** Regenerate the human view without modifying captured scores, evidence, or evaluation timestamps. */
export function renderSavedSkillsReport(directory) {
  const root = path.resolve(directory);
  const report = JSON.parse(readFileSync(confined(root, "results.json"), "utf8"));
  return saveSkillsReport(root, report);
}
