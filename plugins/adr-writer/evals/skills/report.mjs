import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { renderHtml, validateReport } from "../../skills/report-write/scripts/render-report.mjs";
import { summarize, summarizeRouting, comparePairs } from "./metrics.mjs";
import { sha, confined } from "../regression/workspace.mjs";

const labels = { classification: "분류 응답", routing: "Skill 선택", execution: "실제 수행" };
const statuses = { PASS: "충족", NOT_PROVEN: "미충족·미검증", ERROR: "오류", NOT_RUN: "미실행" };
/** Keep undefined denominators distinct from a measured zero rate. */
const rate = (x) => (x === null ? "미측정" : `${(x * 100).toFixed(1)}%`);

/** Present model/log text as prose while retaining the verbatim audit JSON. */
const prose = (text) => String(text ?? "").replace(/\r?\n/g, " ");

// Presentation-only hierarchy. It does not change prompts, expectations, or scores.
const groups = [
  ["제품 계약", "Full ALPS", ["alps-"]],
  ["제품 계약", "Lite ALPS", "문제 정의", ["lite-alps-asks-", "lite-alps-follows-"]],
  [
    "제품 계약",
    "Lite ALPS",
    "해결 전략과 데모",
    ["lite-alps-generates-", "lite-alps-proposes-", "lite-alps-resume-"],
  ],
  ["제품 계약", "Lite ALPS", "범위", ["lite-alps-records-", "lite-alps-skips-"]],
  ["제품 계약", "계약 이전", ["feature-handoff-"]],
  ["결정 관리", "작성", "요구사항", ["author-keeps-", "author-rejects-", "author-self-"]],
  ["결정 관리", "작성", "소유권과 승인", ["author-delegation-", "author-routes-"]],
  ["결정 관리", "문서 검토", ["review-"]],
  ["결정 관리", "동기화와 통합", ["sync-", "rollup-", "hook-"]],
  ["구현 보장", "의존성과 계획", ["impl-blocks-", "impl-plans-", "impl-resolves-"]],
  ["구현 보장", "완료와 검증", ["impl-completes-", "impl-requires-"]],
  ["구현 보장", "규모와 전달", ["impl-high-", "impl-offers-"]],
  ["구현 보장", "실행 수단", ["refactor-", "bedrock-"]],
  [
    "리뷰와 설명",
    "판정 근거",
    ["impl-review-evidence-", "impl-review-enum-", "impl-review-surfaces-"],
  ],
  [
    "리뷰와 설명",
    "역할과 완료",
    ["impl-review-pre-", "impl-review-role-", "impl-review-selects-risk-"],
  ],
  [
    "리뷰와 설명",
    "이해도 확인",
    ["impl-review-comprehension-", "impl-review-completion-", "impl-review-selects-useful-"],
  ],
  ["리뷰와 설명", "인지부하", ["comprehension-"]],
];

/** Preserve the complete case records while grouping the human view by the responsibility being evaluated. */
function casePath(item) {
  if (item.type === "execution") {
    if (item.skill === "adr-sync") return ["동기화"];
    return ["통합", /discover|reject/.test(item.id) ? "계획 발견" : "승인과 계약 보존"];
  }
  if (item.type === "routing") {
    if (!item.required.length) return ["불필요한 호출"];
    return ["필요한 호출", /lite|full/.test(item.id) ? "제품 문서" : "ADR 작업"];
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
function summaryText(runs) {
  const s = summarize(runs);
  return `요청 ${s.requested}회 · 채점 완료 ${s.scored}회 · 충족 ${s.passed}회 · 미충족·미검증 ${s.notProven}회 · 오류 ${s.errors}회 · 미실행 ${s.notRun}회. 채점 완료 중 충족률 ${rate(s.successRate)}. 알려진 비용 $${s.knownCostUSD.toFixed(4)}, 금액 미측정 호출 ${s.unpricedCalls}회. 누적 실행 시간 ${(s.elapsedMs / 1000).toFixed(1)}초.`;
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
  const ids = new Set();
  for (const c of report.cases) {
    if (!/^[a-z0-9-]+$/.test(c.id) || ids.has(c.id) || !labels[c.type])
      throw new Error("Invalid or duplicate case");
    ids.add(c.id);
  }
  if (!Number.isInteger(report.runsPerCase) || report.runsPerCase < 1)
    throw new Error("Invalid repeat count");
  const seen = new Set();
  for (const r of report.runs) {
    const c = report.cases.find((v) => v.id === r.caseId);
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
  for (const c of report.cases)
    for (let i = 1; i <= report.runsPerCase; i++)
      for (const v of c.type === "execution" ? report.variants : ["candidate"])
        if (!seen.has(`${c.id}/${v}/${i}`)) throw new Error("Missing requested run");
  return report;
}

/** Render only captured data; no target, judge, telemetry, or cloud upload is involved. */
export function saveSkillsReport(directory, report) {
  validateResults(report);
  mkdirSync(path.join(directory, "case-results"), { recursive: true });
  const evidence = [];
  const sections = [];
  for (const type of Object.keys(labels)) {
    const cases = report.cases.filter((c) => c.type === type);
    if (!cases.length) continue;
    const section = node(labels[type], type);
    section.paragraphs = [
      summaryText(report.runs.filter((r) => r.type === type)),
      type === "classification"
        ? "기존 시나리오의 분류 응답 검사입니다. 일부 결과물 검사도 포함하지만 이 비율을 실제 작업 완료율로 표시하지 않습니다."
        : type === "routing"
          ? "배포된 이름·설명에서 필요한 Skill을 고르는 통제된 평가입니다. 실제 클라이언트의 설치·자동 호출 검증은 포함하지 않습니다."
          : "실제 문서 변경과 도구 사건을 고정된 의무에 대조합니다. 승인 전 변경 후 되돌리기 같은 중간 행동도 증거에 보존됩니다.",
    ];
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
      const runs = report.runs.filter((r) => r.caseId === item.id);
      const source = `case-results/${item.id}.json`;
      writeFileSync(path.join(directory, source), JSON.stringify({ case: item, runs }, null, 2));
      const eid = `case-${item.id}`;
      evidence.push(eid);
      const leaf = {
        id: `case-${item.id}`,
        title: item.title,
        domain: labels[type],
        scope: item.id,
        expanded: runs.some((r) => ["ERROR", "NOT_PROVEN"].includes(r.verdict)),
        paragraphs: [
          summaryText(runs),
          runs
            .map(
              (r) =>
                `${r.variant} #${r.repeat}: ${statuses[r.verdict]}${r.error || r.notRunReason ? ` — ${prose(r.error ?? r.notRunReason)}` : ""}${
                  r.checks?.some((c) => !c.pass)
                    ? ` — ${r.checks
                        .filter((c) => !c.pass)
                        .map((c) => `${prose(c.label)}: ${prose(c.detail)}`)
                        .join("; ")}`
                    : ""
                }${r.testResult?.metricsData?.[0]?.reason ? ` — ${prose(r.testResult.metricsData[0].reason)}` : ""}`,
            )
            .join("\n\n"),
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
    paragraphs: [
      `평가 시각 ${report.generatedAt}. 선택 ${JSON.stringify(report.selection)}. 반복 ${report.runsPerCase}회. ${summaryText(report.runs)}`,
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
  sections.push(conditions);
  evidence.push("raw");
  const doc = {
    title: "Skill 평가 결과",
    language: "ko",
    summary: [
      summaryText(report.runs),
      "분류 응답, Skill 선택, 실제 수행을 구분해 읽으세요. 사례를 펼치면 반복별 판정과 원본 증거에 접근할 수 있습니다.",
    ],
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
  validateReport(doc);
  writeFileSync(path.join(directory, "report.json"), JSON.stringify(doc, null, 2));
  writeFileSync(path.join(directory, "index.html"), renderHtml(doc));
  return path.join(directory, "index.html");
}

/** Regenerate the human view without modifying captured scores, evidence, or evaluation timestamps. */
export function renderSavedSkillsReport(directory) {
  const root = path.resolve(directory);
  const report = JSON.parse(readFileSync(confined(root, "results.json"), "utf8"));
  return saveSkillsReport(root, report);
}
