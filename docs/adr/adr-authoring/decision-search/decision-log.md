# Decision Log: adr-authoring/decision-search

This document is the **major decision-change history** of the adr-authoring/decision-search
category. Each ADR body describes only the current state, while the timeline of "what
changed and why" accumulates here, newest first. Git preserves the individual diffs.

## 2026-11-07 — 검색 색인 제거, 검색마다 현재 원본에서 계산

- **Current ADR**: [discover-adrs-with-local-search](./0001-discover-adrs-with-local-search.md)
- **Change type**: adopted alternative replacement
- **What**: 다중어·짧은 한글·본문 절 검색과 원문 근거는 유지하고, 그 계산을 SQLite 파생 색인 대신 검색마다 현재 원본 문서에서 한다.
- **Why**: 사용자는 색인의 현재성 확인과 재생성 부담을 피하려고 꼭 필요하지 않으면 색인을 두지 않는다. 검색은 상태와 진단 확인을 위해 등록 문서를 모두 읽으므로 색인이 줄일 비용이 작고, 같은 검색어에서 색인과 직접 계산의 결과가 같았다.
- **What is now void**: 파생 색인을 원본에서 재생성하고, 캐시 생성·읽기·동시 접근 실패를 같은 검색으로 복구하던 보장.
