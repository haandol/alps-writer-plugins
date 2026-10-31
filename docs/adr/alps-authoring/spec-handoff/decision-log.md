# Decision log — alps-authoring/spec-handoff

Newest first. Record only major decision changes.

- **2026-10-29 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — 이전 범위의 정의를 모두 ADR 루트 용어집으로 옮기던 규칙을 바꿨다. 이제 ADR 위의 현재 기준 레벨(업무 프로세스 모델처럼 인계 뒤에도 ADR이 따르는 레벨)이 정의를 소유한 업무 용어는 용어집으로 옮기지 않는다. 같은 뜻은 재사용하고, 새 정의·의미 변경과 기능 사이 관계는 그 레벨의 변경 제안으로 인계 승인 요약에 함께 보이며, 승인 전이나 거절 시 그 뜻에 의존하는 항목은 미해결로 남는다. 인계 완료와 PRD 권위의 종료는 Feature 단위다. 같은 사실의 기준이 두 레벨에 생기지 않게 하기 위해서다.

- **2026-09-20 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — 위임 표현으로 요구사항을 튜닝으로 분류하던 규칙을 값의 효과에 따른 분류와 제안·승인 분리로 바꿨다. 명확히 요청한 분석 범위와 선행 순서는 별도 승인 없이 안내하고 진행한다.

- **2026-08-18 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — 불완전한 PRD를 즉시 차단하는 분류 흐름을, ADR 해상도의 계약·결정 gap만 사용자에게 질문하고 확인 후 재분류하는 gap-driven enrichment handoff로 변경했다.
- **2026-08-17 — current ADR: [admission-aware feature handoff](./0001-admission-aware-feature-handoff.md)** — PRD와 ADR의 계약을 계속 재조정하는 0..N handoff를, 완료 후 ADR이 구현 계약을 단독 소유하고 명시적 재import만 semantic no-op 또는 ADR 변경 제안으로 처리하는 완전한 소유권 이전으로 변경했다.

## 2026-09-21 — 계약 인계에 필요한 용어 정의 포함

- **Current ADR**: [admission-aware-feature-handoff](./0001-admission-aware-feature-handoff.md)
- **Change type**: requirement rule change
- **What**: 계약 중심 인계 → 필요한 용어 정의도 ADR 루트 용어집에 이전하고 반복 인계의 무변경 보장 확장.
- **Why**: 인계 이후 PRD를 읽지 않아도 계약에 쓰인 용어의 의미를 복구할 수 있어야 하기 때문이다.
