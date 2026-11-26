# Decision log — adr-cycle/behavior-evaluation

Newest first. Record only major decision changes.

- **2026-11-26 — current ADR: [평가 비용 절감](./0001-evaluate-critical-prompt-decisions.md)** — 고정물의 규칙 문서 사본은 읽은 실행에만 입력으로 보고, 판정 입력에서 배포 지침 본문을 빼며, 평소 회귀는 낮은 비용 모델로 실행하고 같은 지침을 싣는 독립 응답형 사례를 묶는다. 규칙 문서 수정마다 백여 개 사례가 다시 실행되고 판정 입력이 지침 본문을 반복해 유지 비용이 감당하기 어려웠기 때문이다.

- **2026-11-26 — current ADR: [실제 평가 입력 지문으로 선택·재사용](./0001-evaluate-critical-prompt-decisions.md)** — 지침·참고 문서 경로로 관련 평가를 선택하던 방식 → 각 시나리오가 실제로 싣는 행동 입력(prompt 전문·고정물·도구 권한·도구로 읽거나 실행한 플러그인 파일)과 채점 입력(의무·채점 규칙)의 지문으로 선택한다. 대상 모델과 실행 환경은 재사용 기준이 아니라 기록 항목이다. 두 지문이 같은 실행은 재사용하고, 채점 입력만 바뀌면 저장된 증거를 재판정하며, 회귀 확인은 한 번 실행해 실패·오류일 때만 추가 실행한다. 입력이 같은 시나리오와 통과한 회귀를 반복 실행하는 비용이 평가 비용의 대부분이었기 때문이다.

- **2026-11-17 — current ADR: [tension 후보의 항상 제안](./0001-evaluate-critical-prompt-decisions.md)** — 주 지표가 있는데 tension 후보를 제안하지 않고 진행하는 응답을 더는 허용하지 않는다. 거절된 후보가 진행을 막지 않는지도 함께 평가한다.

- **2026-10-16 — current ADR: [Skill 평가의 실행 증거와 비교](./0001-evaluate-critical-prompt-decisions.md)** — 표현 일치 점수를 의미 판정에서 제거하고 최초 판정·재판정의 기본 경로를 Bedrock GPT-6.1 Sol 및 default 프로필로 통일한다.

- **2026-10-05 — current ADR: [의도를 보존하는 평가](./0001-evaluate-critical-prompt-decisions.md)** — 초기 수용과 개선 신호를 구분하고 의미 있는 tension metric을 적극 권장하되 선택 사항으로 유지하며, 관찰용 신호와 필수로 확정한 보호 조건의 판단을 구분한다.

- **2026-09-25 — current ADR: [evaluate critical prompt decisions](./0001-evaluate-critical-prompt-decisions.md)** — 안전 분류의 비차단 회귀를 공통 증거·비교·보고 계약으로 확장하고, Skill 선택·실제 수행의 구분과 동일 계약에서의 사용·미사용 비교, 모델 재호출 없는 보고서 재생성을 제안했다.

- **2026-08-18 — current ADR: [evaluate critical prompt decisions](./0001-evaluate-critical-prompt-decisions.md)** — 숨은 계약·안전 전제 누락, domain default 대 product decision gap 분류, 변경 없는 승인 ADR의 routine plan approval 제거와 `Accepted` Status 유지를 shipping prompt 기반 양방향 behavior eval로 추가했다.
- **2026-08-17 — current ADR: [evaluate critical prompt decisions](./0001-evaluate-critical-prompt-decisions.md)** — feature당 0..N 결정과 지속적 PRD reconciliation 평가를, 완전한 계약 소유권 이전·semantic no-op·삭제 계약 보호 평가로 교체했다.
