# Decision Log: adr-authoring/current-state

This document is the **major decision-change history** of the adr-authoring/current-state
category. Each ADR body describes only the current state, while the timeline of "what
changed and why" accumulates here, newest first. Git preserves the individual diffs.

## 2026-09-30 — 충돌 시 최신 의미 변경 우선과 의도 확인을 제안

- **Current ADR**: [record-only-the-final-decision-state](./0001-record-only-the-final-decision-state.md)
- **Change type**: requirement rule change
- **What**: 현재 상태 기록과 결정 소유자 재사용 → 기록·커밋의 최신 의미 변경을 기본 우선안으로 선택하고, 선후 관계와 의도가 불명확한 경우만 묶어 확인하는 정책을 제안했다.
- **Why**: 사용자가 충돌은 이후 기록·커밋을 기본으로 우선하고 불명확한 의도와 충돌만 모아 질문하도록 요청했다.

## 2026-08-15 — 기존 결정 소유자 확인을 새 ADR 생성보다 우선

- **Current ADR**: [record only the final decision state](./0001-record-only-the-final-decision-state.md)
- **Change type**: architecture
- **What**: 최종 상태 서술 규칙에 decision-identity 재사용 게이트를 추가했다. 같은 결정의 대안 교체와 원복은 기존 ADR을 갱신하고, 독립된 현재 상태가 공존하는 분기만 새 ADR을 만든다.
- **Why**: 제공자 같은 채택 대안이 바뀔 때마다 새 ADR이 생겨 결정 수보다 변경 횟수가 문서 수를 지배했다.

<!-- adr-writer:rules-version 0.6.3 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
