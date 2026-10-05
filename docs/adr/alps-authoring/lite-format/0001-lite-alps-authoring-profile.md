# ADR 0001: 비즈니스 임팩트에서 데모를 역설계하는 Lite ALPS 템플릿 제공

Date: 2026-08-20

## Status

Proposed

## Purpose

기획자와 PM은 구현 준비 수준의 전체 PRD보다 적은 입력으로 목업이나 PoC를 시작하려 한다.
Lite ALPS는 사용자가 원하는 최종 결과를 먼저 확인하고, AI가 그 결과를 보여줄 최소 제품과
데모를 역설계해야 한다.

사용자에게 솔루션, 시작 상태, 행동 순서와 화면 결과를 먼저 요구하면 사용자가 데모 설계까지
직접 작성하게 된다. 이 방식은 Section 4에서 만들 구체적인 데모 정보를 Section 2에서 다시
요구하고, 비즈니스 임팩트보다 제품 흐름을 먼저 확정한다.

Lite 작성은 대상 사용자와 문제, 원하는 비즈니스 임팩트를 사용자 입력으로 삼는다. AI는 이
입력에서 최소 솔루션과 빠져서는 안 되는 핵심 사용자 경험을 제안하고, 승인된 경험을 보여주는
구체적인 Demo Scenario를 생성한다. AI 제안은 사용자가 승인하기 전까지 제품 계약이 아니다.

최소 솔루션의 텍스트 설명만으로는 대상 사용자, PoC 시스템과 외부 시스템의 경계를 한눈에
검토하기 어렵다. C4 Context는 실행·배포 단위로 내려가지 않고 이 제품 경계를 보여줄 수 있다.
Container 이하 C4 수준은 Lite가 생략하는 구현 준비 정보를 요구한다.

데모 통과는 승인된 제품 동작을 확인할 뿐 실제 비즈니스 임팩트나 시장 타당성을 증명하지
않는다. 작성하지 않은 선택 Section도 최종 Markdown을 미완성 문서처럼 보여서는 안 된다.

핵심 사용자 경험에 결과가 적혀 있어도 데모의 합격 기준이 단순히 화면 표시나 응답 생성이면
그 경험의 의도를 확인하기 어렵다. Lite는 짧은 형식을 유지하면서 Demo Scenario 안에서
경험별 통과·실패 기준을 구현 전에 제안한다.

## Decision Drivers

- 사용자는 첫 PoC를 시작하기 전에 솔루션과 데모 흐름을 직접 설계하지 않아야 한다.
- 대상 사용자와 핵심 문제, 원하는 비즈니스 임팩트가 모든 후속 제안을 제한해야 한다.
- AI는 최소 솔루션, 제품 경계, 핵심 사용자 경험과 구체적인 데모 방법을 연결된 하나의 추론
  흐름으로 제안하고, 사용자는 구현 준비 정보 없이 대상 사용자, PoC 시스템과 관련 외부
  시스템의 경계를 시각적으로 검토할 수 있어야 한다.
- 사용자는 AI 제안이 제품 계약이 되기 전에 각 Section의 전체 내용을 검토하고 승인해야 한다.
- Full ALPS의 스킬, 가이드, 질문 순서와 예시는 Lite 전용 흐름의 영향을 받지 않아야 한다.

## Decision

ALPS Writer는 **4-Section Lite ALPS 템플릿 프로필**을 제공한다. Lite는 Full ALPS와 같은
Section별 대화, approval digest, 명시적 승인과 저장 방식을 사용한다. Lite의 제품 정보
수집은 비즈니스 임팩트에서 구체적인 데모로 진행하는 working-backwards 흐름을 사용한다.

Lite ALPS의 Section은 다음 네 개다.

1. **Overview**
   - `Target User and Core Problem`
   - `Desired Business Impact`
2. **Solution and Essential User Experiences**
   - `Solution Strategy`
   - `Essential User Experiences`
3. **Out of Scope**
   - 선택 사항인 `Explicit Exclusions`
4. **Demo Scenario**
   - 필수인 `4.1 Demo Scenario`

작성 순서는 `1 → 2 → 3 → 4`다. Section 3은 사용자가 제외 범위를 밝힌 경우에만 작성한다.
명시적 제외가 없고 승인된 범위가 모호하지 않으면 별도 질문 없이 Section 3을 건너뛴다.

Section 1 작성자는 대상 사용자와 핵심 문제를 확인한 뒤, 그 사용자가 얻어야 할 최종
비즈니스 임팩트와 그것이 중요한 이유를 묻는다. 사용자가 이미 측정 신호를 가진 경우 함께
기록하지만 측정값을 Lite 완료 조건으로 강제하지 않는다. Section 1은 솔루션, 화면, 시작
상태, 사용자 행동 순서 또는 데모 절차를 요구하지 않는다.

Section 2 작성자는 승인된 Section 1을 바탕으로 가장 작은 제품 수준의 Solution Strategy와
Essential User Experiences 초안을 먼저 제안한다. 각 경험은 구분 가능한 이름, 사용자가
확인할 수 있는 결과와 Desired Business Impact에 기여하는 이유를 포함한다. 경험은 시작
조건이나 순차 사용자 행동을 요구하지 않는다. 이 실행 방법은 Section 4가 소유한다.

`Solution Strategy`는 텍스트 설명 뒤에 `Product Context Diagram`을 포함한다. 이 다이어그램은
Mermaid `C4Context`로 대상 사용자, PoC 대상 시스템, 관련 외부 시스템과 관계를 제품 역할
수준에서 표현한다. AI는 승인된 Section 1과 Section 2 초안에서 다이어그램을 생성한다.
다이어그램은 Solution Strategy를 보충하며 텍스트 계약을 대신하지 않는다.

Section 2 작성자는 제품 계약을 안전하게 추론할 수 없는 경우에만 집중 질문을 한다. 금전,
권한, 법률·규제, 개인정보·안전, 되돌리기 어려운 데이터 의미, 외부 약속과 인수 범위를 바꾸는
선택은 사용자가 확정한다. 그 밖의 제품 수준 후보는 AI가 제안하고 사용자가 승인, 수정 또는
거절한다.

Section 4 작성자는 승인된 Overview, Solution Strategy와 Essential User Experiences에서
가장 짧은 실행 가능한 Demo Scenario를 역설계한다. AI는 구체적인 시작 상태, 데모 입력,
순차 사용자 행동과 화면에서 확인할 수 있는 결과를 제안한다. 각 단계는 자신이 커버하는
Essential User Experience를 표시하며, 전체 데모는 모든 핵심 사용자 경험이 관찰될 때만
통과한다.

하나의 자연스러운 흐름으로 연결할 수 있으면 공통 단계를 재사용한다. 연결하려면 승인되지
않은 제품 계약이 필요한 경험은 같은 Demo Scenario 안의 별도 실행 블록으로 둔다. 보호된
제품 결정을 추가해야 하면 AI는 그 결정을 질문으로 보완하고, 일반적인 데모 입력과 실행
방법은 승인 후보로 직접 제안한다.

작성자는 생성된 Demo Scenario 전체, 핵심 사용자 경험 커버리지와 Desired Business Impact
연결을 승인 전에 보여준다. 데모 통과는 제품 동작 확인 결과이며 실제 비즈니스 임팩트
달성이나 시장 타당성 검증 결과로 표시하지 않는다.

Lite Markdown 내보내기는 작성되지 않은 선택 Section을 생략한다. 문서 상태와 원본 Lite
문서는 선택 Section을 포함한 4-Section 구조를 유지한다.

Lite와 Full은 같은 approval digest, atomic/batch 승인과 저장 방식을 사용한다. Lite는 제품
경계를 보여주는 C4 Context만 포함한다. Section 7 동적 Feature 승인, 아키텍처 wizard,
Container 수준 구조, NFR wizard 또는 ADR handoff 준비를 추가하지 않는다.

Lite ALPS는 별도 파일 suffix와 프로필을 사용한다. Lite 작성, 재개, 상태 조회와 내보내기는
Full 문서나 Full 작성 상태를 읽거나 갱신하지 않는다. Full 작성도 Lite 문서 상태를 참조하지
않는다.

### Requirement contract

#### 성과 신호와 경험별 평가

Lite는 핵심 사용자 경험을 평가 단위로 사용한다. 적은 입력으로 PoC를 시작하려는 의도를 유지하면서, 주 지표만 높여 사용자 결과를 훼손할 수 있는 경우 의미 있는 tension metric을 적극 제안한다. Tension metric은 같은 목적을 보호하되 주 지표의 과도한 최적화로 나빠질 수 있는 결과의 지표다. 개수나 존재를 필수로 요구하지 않는다.

| 의무                                                                                                | 관찰 가능한 검증 기준                                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Desired Business Impact에는 확인된 성과 신호와 제품 전체의 관련 tension 후보를 선택적으로 연결한다. | 지표가 없어도 Section 1을 완료할 수 있으며 별도 지표 인터뷰를 시작하지 않는다.                                  |
| Essential User Experiences에는 각 경험의 기대 결과와 그 결과를 판정할 기준을 설명한다.              | 결과가 있다는 사실만으로 완료하지 않고 의도에 맞는 결과와 부족한 결과를 구분한다.                               |
| 경험별 개선 신호와 tension 후보는 의미 있는 경우 기존 경험 설명 안에 제안한다.                      | 모든 경험에 새 열이나 지표 하나씩을 강제하지 않으며 정량화가 부적절하면 관련 실패·반례로 설명한다.              |
| Demo Scenario는 경험별 초기 동작의 통과·실패를 입력·행동·관찰 결과로 확인한다.                      | 선택한 보호 조건에 관련된 반례도 필요한 경우 같은 데모 안에서 확인하며 실제 운영 개선을 입증했다고 하지 않는다. |
| 관찰용 신호와 필수로 확정한 수용 조건을 구분한다.                                                   | 선택적 지표 부재나 관찰용 변화만으로 진행을 막지 않고 필수 제품·안전·권한 조건은 그대로 지킨다.                 |
| 지표를 위해 새 Section, Feature ID, 평가 wizard, 통계 표본 설계나 평가기 구현을 요구하지 않는다.    | 기존 1.2·2.2·4.1과 네 Section, 승인 단위가 유지되고 Lite 완료를 운영 자동화 준비 완료로 표시하지 않는다.        |

#### 경험별 사전 판정

각 Essential User Experience의 의도는 Desired Business Impact에 기여하는 이유로 설명하고,
Demo Scenario는 그 경험의 제품 동작을 판정할 결과를 제시한다. AI는 확인된 의도와 범위에서
기준을 제안하고 해당 Section의 기존 승인에서 함께 확인한다. 별도 평가 Section이나 Full
수준의 테스트 설계를 추가하지 않는다.

| 의무                                                                   | 관찰 가능한 검증 기준                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 데모의 각 경험에는 시작 상태·입력·행동과 연결된 통과·실패 기준이 있다. | 사용자는 구현 전에 어떤 관찰이면 해당 경험이 충족되거나 부족한지 판단할 수 있다.        |
| 품질 판단이 필요한 경험은 대표 상황과 판단 규칙을 포함한다.            | 결과의 존재만으로 통과하지 않고, 의도에 맞는 결과와 부족한 결과를 구분한다.             |
| 수용 여부를 바꾸는 미정 수치나 제품 정책은 승인 전에 해결한다.         | 임의의 합격률이나 새로운 실패 정책을 확정하지 않으며 필요한 선택만 사용자에게 확인한다. |
| 데모 실행 결과와 실제 비즈니스 성과의 증거를 구분한다.                 | 제품 동작을 보여준 데모가 실제 임팩트 달성으로 표시되지 않는다.                         |

이 기준은 모든 경험에 통계 평가나 자동 테스트를 요구하지 않는다. 실제 테스트 코드와
평가 실행 수단은 구현 단계에서 선택하며, 기존 4-Section 구조와 Section 2·4의 역할을 유지한다.

#### Required guarantees

- `lite-alps-init`은 현재 4-Section Lite ALPS 작성과 재개를 지원한다.
- Lite ALPS 파일명은 `lite`, `alps`, `xml` 세 suffix segment를 점으로 연결한다.
- Lite ALPS 문서는 정확히 `Overview`, `Solution and Essential User Experiences`, `Out of Scope`,
  `Demo Scenario` 네 Section을 이 순서로 가진다.
- Lite 작성 흐름은 Section 목적 설명, 필요한 집중 질문, 답변 통합, approval digest, 명시적
  승인과 저장 순서를 사용한다.
- Lite를 지원하기 위해 Full ALPS의 스킬, 9개 Section 가이드, overview와 Full Section
  템플릿 작성 규칙을 변경하지 않는다.
- Section 1은 `Target User and Core Problem`, `Desired Business Impact` 두 subsection만
  포함한다.
- Section 1 질문은 대상 사용자, 핵심 문제, 원하는 최종 비즈니스 임팩트와 그 중요성을
  확인한다.
- Section 1은 솔루션, 화면, 시작 상태, 사용자 행동 순서와 데모 절차를 사용자에게 요구하지
  않는다.
- 사용자가 비즈니스 임팩트의 측정 신호를 이미 제공하면 보존하며, 측정값이 없다는 이유로
  Section 1 완료를 막지 않는다.
- Section 2는 `Solution Strategy`, `Essential User Experiences` 두 subsection만 포함한다.
- Section 2 작성자는 승인된 Section 1에서 최소 Solution Strategy와 Essential User
  Experiences 초안을 먼저 제안한다.
- `Solution Strategy`는 텍스트 설명 뒤에 `Product Context Diagram`을 포함한다.
- `Product Context Diagram`은 Mermaid `C4Context` 다이어그램을 정확히 하나 포함한다.
- `Product Context Diagram`은 대상 사용자, PoC 대상 시스템, 관련 외부 시스템과 관계를 제품
  역할 수준에서 표현한다.
- AI는 승인된 Section 1과 Section 2 초안을 바탕으로 `Product Context Diagram`을 생성한다.
- `Product Context Diagram`은 텍스트 Solution Strategy를 보충하며 텍스트에 필요한 제품
  의도, 범위, 값과 규칙을 대신하지 않는다.
- Section 2는 사용자가 최소 솔루션이나 데모 흐름을 처음부터 작성하도록 요구하지 않는다.
- 각 Essential User Experience는 구분 가능한 이름, 사용자가 확인할 수 있는 결과와 Desired
  Business Impact에 기여하는 이유를 포함한다.
- Essential User Experiences는 시작 조건이나 순차 사용자 행동을 필수 필드로 요구하지
  않는다.
- Essential User Experiences는 구현 계층, 내부 상태 또는 주관적인 인상으로 완료를 정의하지
  않는다.
- 금전, 권한, 법률·규제, 개인정보·안전, 되돌리기 어려운 데이터 의미, 외부 약속 또는 인수
  범위를 바꾸는 선택은 사용자 답변으로 확정한다.
- AI가 제안한 Solution Strategy, Essential User Experiences와 Demo Scenario는 해당 Section의
  approval digest가 승인된 뒤에만 저장한다.
- Section 3은 선택 Section이며 사용자가 확인한 비범위만 하나의 `Explicit Exclusions`
  목록으로 포함한다.
- 명시적 제외가 없고 승인된 범위가 모호하지 않으면 Section 3을 위한 별도 질문과 저장을
  생략한다.
- Section 4는 필수이며 `4.1 Demo Scenario` 한 subsection만 포함한다.
- Section 4 작성자는 승인된 Overview, Solution Strategy와 모든 Essential User Experience에서
  Demo Scenario를 역설계한다.
- Demo Scenario는 구체적인 시작 상태, 데모 입력, 순차 사용자 행동과 화면에서 확인할 수 있는
  결과를 포함한다.
- 각 Demo Scenario 단계나 실행 블록은 자신이 보여주는 Essential User Experience를 표시한다.
- 모든 핵심 사용자 경험을 하나의 흐름으로 연결하려면 승인되지 않은 제품 계약이 필요한
  경우, 같은 Demo Scenario 안에 별도 실행 블록을 사용한다.
- 일반적인 데모 입력과 실행 방법은 AI가 승인 후보로 제안하며, 보호된 제품 결정을 추가해야
  하는 경우에만 집중 질문으로 보완한다.
- Section 4 작성자는 생성한 Demo Scenario 전체, 핵심 사용자 경험 커버리지와 Desired
  Business Impact 연결을 승인 전에 보여준다.
- 전체 Demo Scenario는 모든 Essential User Experience가 관찰될 때만 통과한다.
- Demo Scenario의 통과 결과는 제품 동작 확인 결과이며 실제 비즈니스 임팩트나 시장 타당성
  검증 결과로 표시하지 않는다.
- 사용자가 작성 모드를 지정하지 않으면 Section별 atomic 승인을 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 여러 Section을 포함한 완전한 구조화 입력을
  제공한 경우에만 batch 승인을 사용할 수 있다.
- 모든 저장은 현재 작성 단위의 제품 의도, 범위, 필수 정보, 적용되는 값과 규칙, 완료 결과를
  포함한 plain-text approval digest의 명시적 승인 뒤에 수행한다.
- 4-Section 문서를 재개하면 `1 → 2 → 3 → 4` 순서상 첫 미완료 필수 Section에서 계속한다.
  Section 3에 명시적 제외 범위가 없으면 건너뛴다.
- Lite ALPS는 현재 상태를 Markdown으로 내보낼 수 있다.
- Lite Markdown 내보내기는 작성되지 않은 선택 Section을 생략하고 작성된 선택 Section은
  원래 순서에 포함한다.
- 작성 내용과 사용자 대화는 사용자가 사용한 언어를 따른다.
- Lite 작성, 재개, 상태 조회와 내보내기는 Full ALPS 문서나 작성 상태를 읽거나 갱신하지
  않는다.
- Full ALPS 작성과 관리도 Lite ALPS 문서나 작성 상태를 읽거나 갱신하지 않는다.
- Lite 행동 평가는 비즈니스 임팩트 우선 질문, 핵심 사용자 경험 제안, 데모 역설계, 승인과
  범위 준수를 검사하고 특정 사용자 노출 문구나 정확한 질문 표현을 통과 조건으로 요구하지
  않는다.

#### Prohibitions

- Lite ALPS의 C4 다이어그램은 `C4Context`만 사용한다. `C4Container`, `C4Component`,
  `C4Dynamic`, `C4Deployment`와 Code 수준 다이어그램을 생성하지 않는다.
- `Product Context Diagram`에 API, 데이터베이스, 실행·배포 단위, 라이브러리, 코드 구조 또는
  구현 계층을 넣지 않는다.
- Lite ALPS 템플릿과 가이드는 기술 스택, 인터페이스, 저장소, 배포 또는 구현 계층 입력을
  요구하지 않는다.
- 작성자는 `Product Context Diagram`을 만들기 위한 아키텍처 wizard나 별도 기술 질문을
  추가하지 않는다.
- Section 1과 Section 2는 사용자가 시작 상태, 데모 입력, 순차 행동과 화면 결과를 직접
  설계하도록 요구하지 않는다.
- AI는 사용자 확인 없이 금전, 권한, 법률·규제, 개인정보·안전, 되돌리기 어려운 데이터 의미,
  외부 약속과 인수 범위를 확정하지 않는다.
- 명시적 입력이 없는 제외 범위, 실패 상태, edge case 또는 “PoC가 증명하지 않는 것”을
  Section 3을 채우기 위해 발명하지 않는다.
- 명시적 제외가 없고 승인된 범위가 모호하지 않은데 Section 3을 채우기 위한 질문을 추가하지
  않는다.
- Demo Scenario에서 승인된 Essential User Experience를 누락하지 않는다.
- Demo Scenario를 핵심 사용자 경험 연결이 없는 기능 목록, 화면 투어 또는 결과 없는 행동
  목록으로 작성하지 않는다.
- Demo Scenario의 통과를 실제 비즈니스 임팩트나 시장 타당성 검증으로 표시하지 않는다.
- Demo Scenario와 별도의 Learning Check subsection이나 학습 판단 절차를 요구하지 않는다.
- Lite ALPS 완료를 Full ALPS 완료, 구현 준비 또는 ADR handoff 완료로 표시하지 않는다.
- Full ALPS 작성을 Lite의 다음 단계나 자동 변환 대상으로 안내하지 않는다.
- Lite 문서와 Full ALPS 사이에 Section, Feature, 승인 상태 또는 완료 상태를 동기화하지
  않는다.

#### Failure guarantees

- Lite 문서 초기화, 로드, 저장 또는 내보내기 실패는 기존 문서를 덮어쓰거나 현재 선택된
  문서를 다른 유형으로 변경하지 않는다.
- 잘못된 Section, subsection 식별자 또는 제목은 문서 내용을 변경하지 않고 거부한다.
- 현재 문서를 다른 프로필의 템플릿으로 저장하려는 요청은 문서 내용을 변경하지 않고
  거부한다.
- 현재 4-Section 형식과 다른 Lite 문서는 원본을 변경하지 않고 거부한다.
- `Solution Strategy`에 `C4Context`가 없거나 하나보다 많으면 내용을 변경하지 않고 저장을
  거부한다.
- `Solution Strategy`에 `C4Context` 이외의 C4 수준이 있으면 내용을 변경하지 않고 저장을
  거부한다.

#### Observable evidence

| Obligation                            | Observable evidence                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 비즈니스 임팩트를 먼저 확인한다.      | Section 1 질문은 대상 사용자·문제와 Desired Business Impact만 요구하고 솔루션이나 데모 흐름을 요구하지 않는다. |
| AI가 최소 솔루션을 제안한다.          | Section 1 승인 뒤 사용자가 솔루션을 먼저 작성하지 않아도 Solution Strategy 후보가 제시된다.                    |
| AI가 제품 경계를 시각화한다.          | Solution Strategy에 대상 사용자, PoC 시스템, 관련 외부 시스템과 관계를 보여주는 `C4Context`가 하나 있다.       |
| Context를 제품 수준으로 제한한다.     | Product Context Diagram에 Container, API, 데이터베이스, 배포 단위 또는 코드 구조가 나타나지 않는다.            |
| Context가 텍스트를 보충한다.          | 다이어그램을 제외해도 텍스트 Solution Strategy에서 제품 의도, 범위, 값과 규칙을 검토할 수 있다.                |
| AI가 핵심 사용자 경험을 제안한다.     | Essential User Experiences 초안은 이름, 사용자가 확인할 수 있는 결과와 비즈니스 임팩트 기여를 포함한다.        |
| 실행 방법을 Section 4가 소유한다.     | Section 2는 시작 상태와 순차 행동을 필수 입력으로 요구하지 않고 Section 4가 이를 제안한다.                     |
| 보호된 제품 결정을 사용자에게 남긴다. | 권한·안전·외부 약속 등 여러 유효한 선택이 계약을 바꾸면 AI가 확정 전에 질문한다.                               |
| Demo Scenario를 역설계한다.           | 승인된 핵심 사용자 경험만으로 시작 상태, 입력, 행동과 화면 결과를 포함한 완전한 데모가 제시된다.               |
| 모든 핵심 사용자 경험을 커버한다.     | Demo Scenario의 단계나 실행 블록에서 각 Essential User Experience를 찾을 수 있다.                              |
| 생성된 데모를 승인 전에 보여준다.     | 사용자는 저장 전에 전체 데모 절차, 핵심 사용자 경험 커버리지와 비즈니스 임팩트 연결을 검토할 수 있다.          |
| 데모의 증명 범위를 제한한다.          | 데모 통과는 제품 동작 확인 결과로 표시되고 실제 비즈니스 임팩트 검증으로 표시되지 않는다.                      |
| Section 3은 선택 사항이다.            | 명시적 제외 범위가 없어 Section 3이 비어 있어도 필수 Section 완료 후 내보낼 수 있다.                           |
| Full과 독립적으로 관리한다.           | Lite 작성·재개·상태·완료 결과가 Full 문서나 상태를 읽거나 변경하지 않는다.                                     |
| 실패 시 원본을 보존한다.              | 유효하지 않은 저장이나 프로필 불일치 뒤에도 파일 내용이 요청 전과 같다.                                        |

### Alternatives

1. **사용자가 실행 가능한 인수 테스트를 먼저 작성한다**
   - 장점: Demo Scenario는 테스트를 기계적으로 조합할 수 있다.
   - 단점: 사용자가 솔루션과 데모 흐름을 먼저 설계하며 비즈니스 임팩트보다 실행 방법이 앞선다.

2. **비즈니스 임팩트에서 AI가 솔루션, 핵심 사용자 경험과 데모를 단계적으로 역설계한다**
   - 장점: 사용자는 최종 결과와 제품 정책만 결정하고 AI가 최소 PoC 방법을 제안한다.
   - 단점: AI 제안이 제품 계약이 되기 전에 Section별 검토와 승인이 필요하다.

3. **AI가 질문 없이 전체 Lite 문서를 한 번에 생성한다**
   - 장점: 가장 빠르게 완성된 문서 형태를 볼 수 있다.
   - 단점: 보호된 제품 결정과 잘못 추론한 비즈니스 임팩트가 승인 경계 없이 섞일 수 있다.

#### 제품 경계 표현

1. **텍스트 Solution Strategy만 사용한다**
   - 장점: 작성량과 형식 비용이 가장 작다.
   - 단점: 사용자, 대상 시스템과 외부 시스템의 경계를 한눈에 검토하기 어렵다.

2. **Solution Strategy에 C4 Context만 포함한다**
   - 장점: 구현 준비 수준으로 내려가지 않고 제품 경계와 관계를 시각적으로 검토할 수 있다.
   - 단점: 모든 Lite 문서가 하나의 다이어그램을 작성하고 검토해야 한다.

3. **C4 Context와 Container를 모두 포함한다**
   - 장점: 제품 경계와 주요 실행·배포 단위를 함께 볼 수 있다.
   - 단점: Lite가 생략하는 기술 구조와 구현 준비 결정을 요구한다.

## Consequences

### Positive

- 구현 전에 경험별 통과·실패 기준을 검토하므로 데모의 의도와 결과를 함께 확인할 수 있다.
- 사용자는 솔루션과 데모 흐름보다 원하는 비즈니스 임팩트를 먼저 설명한다.
- AI는 같은 비즈니스 임팩트에서 최소 솔루션, 핵심 사용자 경험과 구체적인 데모를 연결해
  제안한다.
- 사용자는 구현 구조를 읽지 않고도 대상 사용자, PoC 시스템과 외부 시스템의 경계를 검토한다.
- Section 2는 핵심 사용자 경험을 소유하고 Section 4는 실행 방법을 소유한다.
- 사용자는 AI가 제안한 제품 계약과 데모를 Section별로 검토하고 수정할 수 있다.
- Full ALPS 사용자는 기존 작성 경험을 유지한다.
- 최종 Markdown은 작성하지 않은 선택 Section을 노출하지 않는다.
- Lite와 Full의 파일 및 상태 수명주기는 독립적으로 유지된다.

### Negative

- 품질 판단이 필요한 경험은 짧은 데모에서도 판단 규칙을 구체화해야 한다.
- AI가 제안한 최소 솔루션과 핵심 사용자 경험이 사용자의 의도와 다르면 Section 2에서 수정해야
  한다.
- Lite 문서마다 Product Context Diagram을 생성하고 검토하는 비용이 추가된다.
- 보호된 제품 결정은 working-backwards 흐름 중에도 추가 질문이 필요하다.
- 현재 Section과 subsection 제목이 다른 Lite 문서는 자동 변환되지 않는다.

### Risks

- 비즈니스 임팩트가 추상적이면 AI 제안도 넓어질 수 있다. 작성자는 임팩트와 중요성을 먼저
  확인하고 측정 신호가 제공되면 보존한다.
- AI가 보호된 제품 결정을 일반적인 제안으로 확정할 수 있다. 계약을 바꾸는 선택은 사용자
  답변으로 확정한다.
- 핵심 사용자 경험과 데모 방법의 경계가 흐려질 수 있다. Section 2는 사용자가 확인할 결과를
  기록하고, Section 4는 시작 상태와 행동 순서를 기록한다.
- Product Context Diagram이 Container나 구현 호출 구조로 내려갈 수 있다. Lite는 사람,
  대상 시스템, 외부 시스템과 관계만 허용한다.
- 다이어그램이 텍스트 계약을 대신할 수 있다. Solution Strategy는 Mermaid 렌더링 없이도 제품
  의도, 범위, 값과 규칙을 검토할 수 있어야 한다.
- 자동 생성된 데모가 핵심 사용자 경험을 누락할 수 있다. 승인 화면에서 경험별 커버리지를
  보여준다.
- 데모 결과가 실제 비즈니스 임팩트를 증명한 것처럼 보일 수 있다. 문서와 대화는 제품 동작
  인수와 비즈니스 결과 검증을 구분한다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
