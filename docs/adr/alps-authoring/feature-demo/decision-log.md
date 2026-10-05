# Decision log — alps-authoring/feature-demo

Newest first. Record only major decision changes.

- **2026-10-05 — current ADR: [사례와 자동 평가 지표](./0001-require-feature-level-demo.md)** — 평가 영역을 Evaluation Rubric으로 부르고 Ideal Cases·Edge Cases·Automated Evaluation Metrics로 구성한다. 지표를 관련 사례와 계산·판정에 연결하고, 선택적 tension 후보와 데모 결과의 의미 및 기존 문서 호환성을 보존한다.

- **2026-10-05 — current ADR: [실행 가능한 수용 기준](./0001-require-feature-level-demo.md)** — 결과 체크리스트를 독립 수용 의무별 상황·증거·검증 수단·판정 규칙으로 구체화하고, LLM 의미 판단과 고정 결과의 집계 및 실제 사용자 동작 증거를 구분한다.

- **2026-10-05 — current ADR: [의도를 보존하는 평가](./0001-require-feature-level-demo.md)** — 초기 수용과 개선 신호를 구분하고 의미 있는 tension metric을 적극 권장하되 선택 사항으로 유지하며, 관찰용 신호와 필수로 확정한 보호 조건의 판단을 구분한다.

- **2026-09-28 — current ADR: [feature intent and acceptance](./0001-require-feature-level-demo.md)** — 데모 연결 중심 계약을 의도별 수용 조건과 증거 종류의 사전 확정으로 보강해 구현 전에 완료 판단의 기준을 검토하도록 제안했다.
- **2026-08-17 — current ADR: [feature demo connection](./0001-require-feature-level-demo.md)** — 완전한 `7.x.7 Feature Demo`를 필수화하던 계약을 Acceptance Criteria의 한 줄 Demo checkpoint로 축소하고 상세 데모는 기존 Feature 명세에서 요청 시 파생하도록 변경했다.
