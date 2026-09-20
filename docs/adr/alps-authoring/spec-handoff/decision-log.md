# Decision log — alps-authoring/spec-handoff

Newest first. Record only major decision changes.

- **2026-09-20 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — 위임 표현으로 요구사항을 튜닝으로 분류하던 규칙을 값의 효과에 따른 분류와 제안·승인 분리로 바꿨다. 명확히 요청한 분석 범위와 선행 순서는 별도 승인 없이 안내하고 진행한다.

- **2026-08-18 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — 불완전한 PRD를 즉시 차단하는 분류 흐름을, ADR 해상도의 계약·결정 gap만 사용자에게 질문하고 확인 후 재분류하는 gap-driven enrichment handoff로 변경했다.
- **2026-08-17 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — PRD와 ADR의 계약을 계속 재조정하는 0..N handoff를, 완료 후 ADR이 구현 계약을 단독 소유하고 명시적 재import만 semantic no-op 또는 ADR 변경 제안으로 처리하는 완전한 소유권 이전으로 변경했다.
