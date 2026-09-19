// Explanatory routing, not a second requirement authority. References point
// to existing case obligation IDs; they never enter the GEval prompt.
export const CASE_CODES = {
  "rollup-encbird-turn-chain": "R1",
  "rollup-pixelbank-independent-decisions": "R2",
  "rollup-pixelbank-price-renumber": "R3",
  "rollup-encbird-withheld-approval": "R4",
  "sync-encbird-turn-units": "S1",
  "sync-encbird-forward-only-drift": "S2",
  "sync-pixelbank-compensation-cleanup": "S3",
  "sync-pixelbank-retention-local": "S4",
};

const byCode = Object.fromEntries(Object.entries(CASE_CODES).map(([id, code]) => [code, id]));
const ref = (code, ...obligations) => ({ caseId: byCode[code], obligations });
const stage = (id, code, title, coverage, references, boundary) => ({
  id,
  code,
  title,
  coverage,
  references,
  boundary,
});

export const STAGES = [
  stage(
    "ru_scope",
    "RU1",
    "대상 범위·인덱스·구현 읽기",
    "partial",
    [ref("R1", "identity"), ref("R2", "identity"), ref("R3", "pricing")],
    "지정한 한 카테고리의 정상 입력만 사용한다. 무인자 전체 범위, mapping 부재, 카테고리 간 경계 판단은 별도 사례가 없다.",
  ),
  stage(
    "ru_chain",
    "RU2",
    "같은 결정의 변화 이력인지 판단",
    "direct",
    [ref("R1", "identity"), ref("R2", "identity"), ref("R3", "pricing")],
    "명확한 변화 이력과 명확한 독립 결정을 비교한다. 대체 관계가 모호한 이력은 별도 사례가 없다.",
  ),
  stage(
    "ru_independent",
    "RU3",
    "독립 결정·번호 공백 유지",
    "direct",
    [ref("R1", "identity"), ref("R2", "no-change", "report")],
    "같은 카테고리의 독립 결정과 무통합 시 번호 공백을 보존하는지 평가한다.",
  ),
  stage(
    "ru_alignment",
    "RU4",
    "최신 계약과 구현을 대조",
    "partial",
    [ref("R1", "contract", "index"), ref("R3", "pricing")],
    "최신 계약과 구현이 이미 맞는 입력이다. rollup 중 계약 충돌이나 Proposed 결정 혼입을 처리하는 방향은 미포함이다.",
  ),
  stage(
    "ru_conflict",
    "RU5",
    "계약 충돌·불확실한 완료 상태 보류",
    "gap",
    [],
    "코드에 맞춰 계약을 임의로 바꾸지 않기, Proposed 혼입 시 상태 처리 등은 rollup 전용 eval이 없다. sync의 유사 사례가 이를 대신 증명하지 않는다.",
  ),
  stage(
    "ru_approval",
    "RU6",
    "통합·삭제·경로 변경 계획과 승인",
    "direct",
    [ref("R1", "approval"), ref("R3", "approval"), ref("R4", "no-change", "report")],
    "승인 전 쓰기 금지, 명시적 승인, 보류를 평가한다. 여러 카테고리 중 일부만 승인하는 경우는 미포함이다.",
  ),
  stage(
    "ru_hold",
    "RU7",
    "승인 보류 시 변경 없이 종료",
    "direct",
    [ref("R4", "no-change", "report")],
    "계획 제시와 보류 설명만 허용한다. 잠깐 썼다가 원복한 경우도 쓰기 기록으로 평가할 수 있다.",
  ),
  stage(
    "ru_merge",
    "RU8",
    "최저 번호에 최신 결정·계약 통합",
    "direct",
    [ref("R1", "identity", "contract"), ref("R3", "pricing")],
    "파일 번호는 최저값, 내용은 최신 계약인지 확인한다. 수치·단위·종료 규칙·최초 과금액 보존을 포함한다.",
  ),
  stage(
    "ru_paths",
    "RU9",
    "승인된 삭제·재번호 적용",
    "direct",
    [ref("R1", "identity", "approval"), ref("R3", "approval", "references")],
    "번호 변경 거절과 명시적 old→new 경로 승인을 각각 평가한다. 목적지 충돌·여러 그룹 연쇄 이동은 미포함이다.",
  ),
  stage(
    "ru_links",
    "RU10",
    "주요 이력·mapping·참조 정리",
    "direct",
    [ref("R1", "history", "index"), ref("R3", "history", "references")],
    "현재 본문과 주요 이력의 분리, 흡수와 재번호의 서로 다른 참조 방향을 확인한다.",
  ),
  stage(
    "ru_report",
    "RU11",
    "변경·보류·미해결 결과 보고",
    "partial",
    [ref("R1", "index"), ref("R2", "report"), ref("R4", "report")],
    "완료·무통합·보류 보고를 평가한다. rollup 계약 충돌의 미해결 보고는 별도 사례가 없다.",
  ),
  stage(
    "sy_mode",
    "SY1",
    "범위와 deep·quick 모드 선택",
    "partial",
    [ref("S1", "evidence"), ref("S4", "local-only")],
    "모두 카테고리를 지정한 deep 실행이다. quick 모드, 전체 범위, 오래된 fN 이름 정리는 별도 사례가 없다.",
  ),
  stage(
    "sy_quick",
    "SY1Q",
    "quick 요약 점검·이름 정리 제안",
    "gap",
    [],
    "quick이 본문 수정·파일 이동 없이 요약 점검과 필요한 제안에 머무는지 확인하는 별도 eval이 없다.",
  ),
  stage(
    "sy_evidence",
    "SY2",
    "ADR·로컬 코드·테스트 읽기",
    "direct",
    [ref("S1", "evidence"), ref("S4", "local-only")],
    "실제 로컬 검사를 실행한 기록과 구현을 읽은 근거를 사용한다. 저장소 전체 검색의 완전성까지 측정하지 않는다.",
  ),
  stage(
    "sy_boundary",
    "SY3",
    "구현 상세와 요구사항 계약 구분",
    "direct",
    [ref("S1", "units", "contract"), ref("S3", "cleanup", "compensation")],
    "다른 단위의 5/6, 연결 풀·함수 이름, 실패 보상 계약을 구분한다.",
  ),
  stage(
    "sy_match",
    "SY4",
    "ADR과 구현이 일치하는지 판단",
    "direct",
    [ref("S1", "units", "contract"), ref("S2", "authority"), ref("S4", "retention")],
    "정상 일치, 실제 금지 계약 위반, 입력·영구 자산의 보존 조건을 평가한다.",
  ),
  stage(
    "sy_conflict",
    "SY5",
    "충돌을 드러내고 사용자 의도 확인",
    "direct",
    [ref("S2", "authority", "decision", "report")],
    "구현의 자동 환불을 계약으로 승격하지 않고 변경 의도 또는 위반 판정을 요청하는지 확인한다.",
  ),
  stage(
    "sy_missing",
    "SY6",
    "코드에만 있는 계약 후보 확인",
    "gap",
    [],
    "누락된 계약을 새로 발견하고 사용자 확인 후 추가하는 흐름은 전용 사례가 없다.",
  ),
  stage(
    "sy_cleanup",
    "SY7",
    "현재 상태로 문서 정리·주요 이력 보존",
    "direct",
    [ref("S3", "cleanup", "compensation", "history")],
    "과거 서술·비계약 구현 상세만 정리하고 무료권·유료·중복 보상 및 변경 이유를 보존한다.",
  ),
  stage(
    "sy_status",
    "SY8",
    "근거 있는 Status 수정 또는 유지",
    "partial",
    [ref("S1", "contract"), ref("S2", "decision"), ref("S4", "runtime")],
    "기존 Accepted 유지와 정당한 Proposed 후퇴를 허용하는 기준이다. 정확한 대상 선택은 도구 단위 테스트도 확인하지만, Proposed 자동 승격 금지의 독립 LLM 사례는 없다.",
  ),
  stage(
    "sy_remote",
    "SY9",
    "원격 조회 요청을 하지 않고 미검증 구분",
    "direct",
    [ref("S4", "local-only", "runtime")],
    "원격 도구의 요청 여부를 평가한다. 도구는 요청만 기록하므로 실제 운영 환경 접속을 시험하는 것은 아니다.",
  ),
  stage(
    "sy_index",
    "SY10",
    "인덱스·참조 일관성과 범위 유지",
    "partial",
    [ref("S3", "boundaries")],
    "정리 후 본문·인덱스·참조의 일치와 독립 문서 유지만 평가한다. 고아 ADR, 순환 dependsOn, 경로 변경 승인, 소스 역참조 제거는 미포함이다.",
  ),
  stage(
    "sy_report",
    "SY11",
    "수정·충돌·미검증 결과 보고",
    "direct",
    [ref("S1", "evidence"), ref("S2", "report"), ref("S3", "boundaries"), ref("S4", "runtime")],
    "로컬 테스트 통과를 계약 준수나 운영 배포 확인과 혼동하지 않는지 평가한다.",
  ),
];

export function coverageFor(report) {
  const selected = new Map(report.cases.map((item) => [item.id, item]));
  const invalid = [];
  const stages = STAGES.map((entry) => {
    const invalidBefore = invalid.length;
    const references = entry.references.flatMap((link) => {
      const item = selected.get(link.caseId);
      if (!item) return [];
      const ids = new Set(item.obligations.map((o) => o.id));
      const valid = link.obligations.filter((id) => {
        if (!ids.has(id)) invalid.push(`${entry.code}: ${link.caseId}/${id}`);
        return ids.has(id);
      });
      return valid.length ? [{ ...link, obligations: valid, code: CASE_CODES[item.id] }] : [];
    });
    return {
      ...entry,
      references,
      effective:
        invalid.length > invalidBefore
          ? "mapping-error"
          : references.length
            ? entry.coverage
            : entry.coverage === "gap"
              ? "gap"
              : "not-selected",
    };
  });
  return {
    stages,
    invalid,
    unmapped: report.cases.filter((item) => !CASE_CODES[item.id]).map((item) => item.id),
  };
}

const names = {
  direct: "명시 의무",
  partial: "일부 조건",
  gap: "별도 eval 없음",
  "not-selected": "이번 선택에 없음",
  "mapping-error": "연결 검토 필요",
};
export { names as coverageNames };

function skillDiagram(title, entries, edges) {
  const lines = ["flowchart TD"];
  for (const entry of entries) {
    const refs = [...new Set(entry.references.map((r) => r.code))].join(" · ");
    const label = `${entry.code} ${entry.title}<br/>${names[entry.effective]}${refs ? `: ${refs}` : ""}`;
    lines.push(`  ${entry.id}["${label}"]:::${entry.effective.replace("-", "_")}`);
  }
  lines.push(...edges.map((edge) => `  ${edge}`));
  lines.push(
    "  classDef direct fill:#e7f2ff,stroke:#4a7faa,color:#173c59",
    "  classDef partial fill:#f0eafb,stroke:#9271af,color:#4c3567",
    "  classDef gap fill:#fff2dc,stroke:#b58a38,stroke-dasharray:5 4,color:#705018",
    "  classDef not_selected fill:#f1f3f6,stroke:#a9b2bf,stroke-dasharray:5 4,color:#657183",
    "  classDef mapping_error fill:#ffedf0,stroke:#aa5765,color:#7c2d3c",
  );
  return { title, source: lines.join("\n") };
}

export function coverageDiagrams(report) {
  const { stages } = coverageFor(report);
  const selectedCodes =
    report.cases.map((item) => CASE_CODES[item.id] ?? "미연결").join(" · ") || "선택 없음";
  return [
    {
      id: "eval-overview",
      title: "전체 평가 프로세스",
      source: `flowchart TD
  caseData["P1 고정 fixture와 기대 의무<br/>${selectedCodes}"]
  versions["P2 기준·후보 스냅샷과 날짜 고정<br/>각각 별도 임시 저장소"]
  rollup["P3-R adr-rollup 실행<br/>아래 RU1–RU11"]
  sync["P3-S adr-sync 실행<br/>아래 SY1–SY11"]
  capture["P4 파일 전후·사용자 발화·도구 사건 수집"]
  complete{"실행 증거가 완전한가?"}
  geval["P5 DeepEval GEval<br/>사례 전체의 모든 기대 의무 확인"]
  outcome["1: 모두 충족<br/>0: 미충족 또는 근거 부족"]
  error["실행 증거 부족·평가 오류<br/>PASS로 처리하지 않음"]
  compare["P6 같은 모델·기준일의 전후 결과 비교"]
  report["P7 HTML·JSON 리포트<br/>단계 연결표와 실제 사례 결과"]
  caseData --> versions
  ${report.reusedEvidence ? "caseData -. 기존 실행 증거 재사용 .-> capture" : ""}
  versions --> rollup
  versions --> sync
  rollup --> capture
  sync --> capture
  capture --> complete
  complete -->|예| geval
  caseData -. 기대 의무는 판정기에만 제공 .-> geval
  complete -->|아니오| error
  geval --> outcome
  geval -->|평가 호출 오류| error
  outcome --> compare
  error --> compare
  compare --> report
  classDef infrastructure fill:#edf2f7,stroke:#8098ac,color:#263f55
  class caseData,versions,capture,complete,geval,outcome,error,compare,report infrastructure
  classDef skill fill:#e7f2ff,stroke:#4a7faa,color:#173c59
  class rollup,sync skill`,
    },
    {
      id: "rollup-process",
      ...skillDiagram(
        "adr-rollup 과정과 eval 연결",
        stages.filter((s) => s.id.startsWith("ru_")),
        [
          "ru_scope --> ru_chain",
          "ru_chain -->|독립 결정·이력 없음| ru_independent",
          "ru_chain -->|같은 결정의 변화 이력| ru_alignment",
          "ru_alignment -->|계약 충돌·완료 불확실| ru_conflict",
          "ru_alignment -->|통합 가능한 범위 확인| ru_approval",
          "ru_conflict -. 사용자 판단 후 허용 범위만 .-> ru_approval",
          "ru_approval -->|보류·거절| ru_hold",
          "ru_approval -->|명시 승인| ru_merge",
          "ru_merge --> ru_paths",
          "ru_paths --> ru_links",
          "ru_links --> ru_report",
          "ru_independent -->|변경 없이 보고| ru_report",
          "ru_hold --> ru_report",
          "ru_conflict -->|미해결 상태 보고| ru_report",
        ],
      ),
    },
    {
      id: "sync-process",
      ...skillDiagram(
        "adr-sync 과정과 eval 연결",
        stages.filter((s) => s.id.startsWith("sy_")),
        [
          "sy_mode -->|deep| sy_evidence",
          "sy_mode -->|quick| sy_quick",
          "sy_quick --> sy_report",
          "sy_evidence --> sy_boundary",
          "sy_boundary --> sy_match",
          "sy_match -->|계약 충돌| sy_conflict",
          "sy_match -->|누락 계약 후보| sy_missing",
          "sy_match -->|현재 계약 보존하며 정리| sy_cleanup",
          "sy_conflict --> sy_status",
          "sy_missing --> sy_status",
          "sy_cleanup --> sy_status",
          "sy_evidence -->|인프라·운영 관련 주장| sy_remote",
          "sy_status --> sy_index",
          "sy_index --> sy_report",
          "sy_remote --> sy_report",
        ],
      ),
    },
  ];
}
