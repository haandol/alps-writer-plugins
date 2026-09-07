# Decision log — delivery/development-flow

Newest first. Record only major decision changes.

- **2026-09-07 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — Implementation Hiking의 모호한 완료 표현을 구현 완료, targeted test 명령과 관찰 결과 확인으로 구체화했다.
- **2026-09-07 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — ADR 구현을 사용자 흐름·논리 기능·bounded context별 Implementation Hiking으로 진행하고, 각 수직 Hill에서 컨텍스트, 핵심 설계·계약, 필요한 계층의 구현과 targeted test 결과를 확인한 뒤 다음 Hill로 이동하도록 변경했다.
- **2026-09-07 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 별도 refactor pass를 고정 단계가 아니라 중복·효율·복잡도·다중 call site 신호가 있을 때 실행하는 위험 비례 gate로 변경했다.
- **2026-09-03 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — ADR 구현 함수에 언어 표준 문서 주석으로 존재 이유와 동작을 남기고, 각 구현 동작의 ideal case와 관련 edge case를 자동 테스트로 검증하도록 완료 계약을 강화했다. 코드와 모든 주석은 ADR 파일이나 번호를 직접 참조하지 않는다.
- **2026-08-28 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 사용자-visible 복잡도 평가와 안전 게이트는 유지하면서 플러그인을 제거해도 PRD·ADR·코드·테스트가 독립적으로 문맥을 보존하도록 하네스를 비침습적 관리 계층으로 정의하고, 서브에이전트 수·종류·실행 순서와 모델 선택을 현재 모델의 일시적 orchestration 판단으로 내렸다.
- **2026-08-25 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — Section 7 Feature의 자동 분할 제안 임계값을 8점 이상으로 높이고, `/adr-impl`은 8점 이상에서 분할 검토 여부만 먼저 확인한 뒤 사용자가 선택한 경우에만 구체적인 ADR 분할 후보를 생성하도록 변경했다.
- **2026-08-18 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 승인된 ADR revision의 구현 계획을 비차단 진행 상황으로 바꾸고, derived obligation과 project/domain default는 자동 해소하며 여러 제품 결과가 남는 gap만 추천안 중심 Decision request로 묶었다. 계약이 바뀌지 않은 기존 `Accepted` ADR은 보강 구현과 검토 동안 Status를 유지한다.
- **2026-08-18 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 인지비용 1~10 각 점수의 내부 보정 가이드와 4~6점 권장 범위를 정의하되 점수를 품질·승인·저장 게이트로 사용하지 않도록 명시했다.
- **2026-08-18 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — Section 7 Feature의 인지비용이 7점 이상이면 최대 세 개의 사용자 행동 기반 분할 후보를 자동 제안하되 원래 Feature 승인과 저장은 계속 허용하도록 변경했다.
- **2026-08-17 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 완료된 PRD handoff가 이전된 Feature마다 실제 계약 소유 ADR을 두도록 바뀜에 따라, 구현에 필요한 Feature prerequisite를 category `dependsOn`으로 보존하고 코드 재사용 순서만 제외하도록 변경했다.
- **2026-08-17 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 의미상 Feature나 ADR을 더 나눌 수 없는 큰 구현은 사용자 요청 시 하나의 계약을 구현하는 dependency-ordered Stacked PR 후보로 전달할 수 있게 했다.
- **2026-08-17 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 인지부하 관리를 강제 checkpoint나 새 상태가 아닌 1~10 휴리스틱과 선택적 분할 제안으로 제한하고, ALPS·ADR 플러그인을 모델 개선에 따라 단순화할 수 있는 워크플로우로 명시했다.
- **2026-08-16 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — ADR admission 지시 주입을 매 사용자 메시지 실행에서 세션 시작·재개·초기화와 context compaction 복구 시점 실행으로 변경해 반복 훅 비용을 제거했다.
- **2026-08-15 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — ADR 의도 확인을 구현 전 기준선 게이트로 이동하고, 구현 후에는 증거 기반 발견을 자동 수정·재검증한 뒤 추가 승인 없이 완료하도록 변경했다.
- **2026-08-15 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 개발 흐름의 복합 결정을 선행 상태와 위험 비례 완료 게이트로 좁히고 저장소 보호, prompt 행동 평가와 ALPS 작성 정책을 독립 결정으로 분리했다.
