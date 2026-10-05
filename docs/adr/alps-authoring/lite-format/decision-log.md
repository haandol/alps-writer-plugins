# Decision Log: alps-authoring/lite-format

This document is the **major decision-change history** of the alps-authoring/lite-format category.
Each ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

## 2026-10-05 — 경험 평가와 선택적 tension 신호

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: 네 Section을 유지하며 비즈니스 성과 신호, 경험별 판단 기준과 데모 관찰에 선택적 tension metric을 연결한다. 관찰용 신호와 필수로 확정한 수용 조건을 구분한다.
- **Why**: 초기 PoC의 작성 부담을 늘리지 않으면서 점수만 높이는 개선이 원래 사용자 목적을 훼손하지 않게 하기 위해서다.

## 2026-09-28 — 경험별 데모 수용 조건을 사전에 제시

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: 경험별 관찰 결과 → 적용 상황과 통과·실패 기준을 함께 제시하는 데모 계약을 제안했다.
- **Why**: 화면이나 응답의 존재만으로 핵심 사용자 경험의 의도를 달성했다고 판정하지 않기 위해서다.

## 2026-08-27 — Lite Solution Strategy에 Product Context를 포함

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: 기술·아키텍처 시각화 없음 → Solution Strategy에 제품 역할 수준의 Mermaid
  `C4Context`를 정확히 하나 포함하고 Container 이하 C4 수준은 제외.
- **Why**: Lite의 구현 준비 범위를 늘리지 않으면서 대상 사용자, PoC 시스템과 외부 시스템의
  경계를 한눈에 검토할 수 있어야 한다.

## 2026-08-24 — 인수 테스트 용어를 핵심 사용자 경험으로 통일

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: `Solution and Acceptance Tests`와 `Required Acceptance Tests` → `Solution and Essential
User Experiences`와 `Essential User Experiences`; 데모 단계도 테스트 통과가 아니라 각 핵심
  사용자 경험을 보여주는 관계로 표현.
- **Why**: 사용자와 작성자가 개발·검증 용어인 인수 테스트를 구체 행동이나 기술 테스트로
  오해하지 않고, Section 2가 소유하는 결과 중심 경험과 Section 4가 소유하는 실행 방법을
  같은 용어 체계로 읽어야 한다.

## 2026-08-24 — 비즈니스 임팩트에서 구체적인 데모를 역설계

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: 사용자가 실행 가능한 인수 테스트의 시작 조건과 행동을 먼저 작성하는 흐름 → 대상
  사용자·문제와 Desired Business Impact를 먼저 승인하고, AI가 최소 솔루션과 관찰 가능한
  인수 결과를 제안한 뒤 구체적인 Demo Scenario를 역설계하는 흐름.
- **Why**: 사용자는 최종 비즈니스 결과와 보호된 제품 정책을 결정하고, 첫 PoC의 구체적인
  실행 방법은 AI 제안으로 검토할 수 있어야 한다.

## 2026-08-23 — 필수 인수 테스트에서 Demo Scenario를 자동 생성

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: 일반 Core User Flow와 별도 Demo Scenario → 이름·시작 조건·행동·관찰 가능한 통과
  조건을 가진 Required Acceptance Tests를 먼저 승인하고, 모든 테스트를 커버하는 Demo
  Scenario 전체와 커버리지를 자동 생성해 승인 전에 제시.
- **Why**: 사용자가 비슷한 흐름을 두 번 작성하지 않으면서 PoC가 반드시 통과해야 할 조건과
  데모의 검증 범위를 명확히 연결해야 한다.

## 2026-08-23 — 일반 사용자 흐름과 구체적인 인수 데모를 분리

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Core User Flow와 Demo Scenario가 같은 실행 정보를 반복하고 빈 선택 Section을
  내보내는 구조 → 일반적인 제품 여정과 구체적인 인수 실행을 분리하고, `Key Assumption`의
  검증 범위를 과장하지 않으며, 작성하지 않은 선택 Section을 질문과 Markdown에서 생략.
- **Why**: Lite의 각 입력이 서로 다른 질문에 답하고 최종 문서가 최소 PoC 범위만 보여야
  한다.

## 2026-08-23 — Lite를 기존 Full 작성 방식의 간소화 템플릿으로 재정렬

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Lite 전용 inference-first, 페르소나 선택 절차와 세밀한 출력 제약 → Lite 도입
  직전 Full의 1–2개 집중 질문, 답변 통합과 승인 흐름을 그대로 사용하고 네 Section의 제품
  입력만 유지.
- **Why**: Lite는 별도 작성 방법론이 아니라 기존 Full ALPS의 작성 경험을 보존한 간소화
  템플릿이어야 한다.

## 2026-08-22 — Start persona framing from one hypothetical problem case

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Persona-first selection → one concrete hypothetical case that identifies who is trying
  to do what in which situation and what problem they are assumed to face; persona selection occurs
  only when the user explicitly presents multiple candidates.
- **Why**: Lite authoring should capture the PoC's problem context without requiring persona
  taxonomy work or pretending the user has a recent real-world incident to report.

## 2026-08-22 — Align Lite names and Demo Scenario structure with Full ALPS

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Why/How/What Not to Do and separate Acceptance Scenario/Learning Check → Overview,
  Solution and User Flow, optional Out of Scope, and one `Demo Scenario` subsection.
- **Why**: Lite and Full ALPS should share recognizable product-document terminology, while Lite
  keeps its minimal executable PoC flow without a separate learning-plan field.

## 2026-08-22 — Compress method concepts into a minimal PoC learning loop

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Separate customer promise, business impact, hypotheses, acceptance fields, and learning
  fields → two integrated inputs each for Why, How, and Demo, plus one optional exclusion list.
- **Why**: Lite authoring should preserve problem framing, acceptance, and validated learning without
  delaying the first PoC with method-specific paperwork.

## 2026-08-22 — Start from why and finish with an acceptance-test demo

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Build-first PoC sections and legacy-format compatibility → Why, How, optional explicit
  exclusions, and a required Demo Scenario that doubles as an acceptance test.
- **Why**: The concrete problem and team or organizational business impact must constrain the
  solution, while explicit non-goals must constrain what the final demo claims to validate.

## 2026-08-22 — Reduce Lite ALPS to four PoC-focused sections

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Eight implementation-preparation-oriented sections → three required sections for build,
  behavior, and demo plus one optional explicit-exclusion section; legacy eight-section documents
  remain editable without automatic conversion.
- **Why**: Lite ALPS should minimize authoring before a PoC and remain completely separate from the
  goal, authoring process, and management lifecycle of Full ALPS.

## 2026-08-22 — Anchor Lite authoring in one persona's core ideal use cases

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: One representative ideal path → one confirmed Primary Persona with one or more core
  ideal use cases, each carrying an explicit intent, sequential user actions, and an observable
  completion result.
- **Why**: Lite PRD conversations need one stable user perspective while still covering the few
  ideal use cases that reveal the product's core intent.

## 2026-08-20 — Make edge-oriented Lite ALPS inputs optional

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Mandatory exclusion, interruption, exception, screen-state, and recovery inputs →
  optional inputs included only when they affect the mockup or PoC.
- **Why**: Lite ALPS should prioritize the representative ideal path and leave nonessential edge
  cases for later product and implementation work.

<!-- adr-writer:rules-version 0.8.0 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
