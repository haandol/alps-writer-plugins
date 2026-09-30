# Decision Log: adr-authoring/rollup-safety

현재 본문은 유효한 계약을 설명하며, 이 문서는 주요 변경만 최신순으로 기록한다.

## 2026-09-30 — 통합 계약의 권위와 적용 경계를 명확히 함

- **Current ADR**: [destructive rollup safety](./0001-require-explicit-approval-for-destructive-rollup.md)
- **Change type**: requirement rule change
- **What**: 번호 공백 정리를 기본 계획에 포함하던 절차를 번호 유지와 명시적 번호 정리 요청으로 바꿨다. 최신 내용 선택만으로 남아 있던 모호함을 확정된 대체 관계·적용 범위 대조, 부분 대체 보존과 영향받는 결정별 보류로 구체화했다.
- **Why**: 계약 통합에 불필요한 경로 변경과 반복 질문을 줄이고, 미확정 제안이나 동시 파일 변경이 현재 계약을 덮어쓰지 않게 하기 위해서다.
