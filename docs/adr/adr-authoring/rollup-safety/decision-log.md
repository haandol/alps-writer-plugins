# Decision Log: adr-authoring/rollup-safety

현재 본문은 유효한 계약을 설명하며, 이 문서는 주요 변경만 최신순으로 기록한다.

## 2026-10-02 — 도구 선택보다 근거와 결과를 기준으로 검증

- **Current ADR**: [destructive rollup safety](./0001-require-explicit-approval-for-destructive-rollup.md)
- **Change type**: requirement rule change
- **What**: 일부 단계의 특정 탐색 명령·호출 지시 → 도구와 작업 방식은 에이전트가 선택하고 원문 근거·현재성·검증 결과와 필수 승인·보존 순서로 판정한다.
- **Why**: 환경에 맞는 도구 선택을 허용하면서 필요한 근거를 건너뛰거나 오래된 근거를 재사용하는 문제는 계속 검출하기 위해서다.

## 2026-10-02 — 대상 중심 탐색과 필요한 부분 시각화

- **Current ADR**: [destructive rollup safety](./0001-require-explicit-approval-for-destructive-rollup.md)
- **Change type**: requirement rule change
- **What**: 탐색·그림 범위가 명시되지 않은 통합 절차 → 대상 ADR과 관련 계약에서 시작하고 필요한 근거만 확장하며, 단순한 사슬은 표와 요약으로 설명한다.
- **Why**: 기존 결정 정리가 전체 시스템 탐색으로 커지지 않게 하면서 계약 보존과 파괴적 변경 검증을 유지하기 위해서다.

## 2026-09-30 — 통합 계약의 권위와 적용 경계를 명확히 함

- **Current ADR**: [destructive rollup safety](./0001-require-explicit-approval-for-destructive-rollup.md)
- **Change type**: requirement rule change
- **What**: 번호 공백 정리를 기본 계획에 포함하던 절차를 번호 유지와 명시적 번호 정리 요청으로 바꿨다. 최신 내용 선택만으로 남아 있던 모호함을 확정된 대체 관계·적용 범위 대조, 부분 대체 보존과 영향받는 결정별 보류로 구체화했다.
- **Why**: 계약 통합에 불필요한 경로 변경과 반복 질문을 줄이고, 미확정 제안이나 동시 파일 변경이 현재 계약을 덮어쓰지 않게 하기 위해서다.
