# ADR 0001: Feature 의도를 수용 조건과 전체 데모에 연결

Date: 2026-08-17

## Status

Proposed

## Purpose

Feature 작성자는 사용자가 어떤 문제를 해결하려는지와 어떤 결과를 얻어야 하는지를 구현 전에 확인해야 한다. 기능 목록이나 화면 동작만으로 완료를 정의하면 그 동작이 원래 의도를 달성하는지 판단하기 어렵다. 각 Feature는 의도에서 수용 조건을 도출하고, 그 결과를 전체 데모에 연결한다.

Section 3은 MVP의 전체 데모 여정을 설명하고 Section 7은 각 Feature를 수직 슬라이스로 상세화한다. 사용자는 각 Feature가 전체 데모에서 어떤 역할을 하는지 확인할 수 있어야 한다.

별도 Feature Demo에 사전 조건, 사용자 행동, 관찰 결과, 실패 시나리오와 성공 판정을 다시 기록하면 Section 7의 User Flow, 오류 처리와 Acceptance Criteria를 중복한다. 같은 제품 행동을 두 곳에 유지하면 작성 비용과 드리프트 위험이 함께 증가한다.

## Decision Drivers

- Builder는 각 Feature가 전체 MVP 데모에 기여하는 지점을 빠르게 확인할 수 있어야 한다.
- 수용 조건은 구현 전에 의도한 결과와 위반을 구분할 수 있어야 한다.
- Section 7은 같은 사용자 행동을 여러 subsection에 반복하지 않아야 한다.
- 데모 연결은 제품 행동 수준을 유지하고 구현 계획이나 테스트 절차로 내려가지 않아야 한다.
- 상세한 데모 설명은 기존 User Flow, 오류 처리와 Acceptance Criteria에서 복구할 수 있어야 한다.

## Decision

Section 7의 각 Feature는 User Story의 의도와 Acceptance Criteria의 수용 조건을 연결하고, Acceptance Criteria 끝에 **Demo checkpoint** 한 줄을 기록한다.

User Story는 대상 사용자, 해결할 문제와 얻어야 할 결과를 설명한다. Acceptance Criteria는 각 사용자 결과와 필수 제약을 판정할 조건을 담는다. 작성자는 이 연결을 Feature 승인 전에 제시하며, 이미 확인한 의도와 요구사항은 재질문하지 않는다. 시작 조건과 행동은 기존 User Flow와 오류 처리에서 재사용하고, 각 기준의 적용 상황이 불명확할 때만 필요한 맥락을 보충한다.

정답과 규칙을 명확히 비교할 수 있는 동작에는 test, 여러 사례에서 응답의 품질이나 판단을 평가해야 하는 동작에는 eval, 사용자 여정을 직접 관찰하는 데에는 demo를 사용한다. 이 구분은 필요한 증거의 종류이며 특정 도구나 실행 절차를 정하지 않는다. 하나의 Feature에 여러 종류가 필요할 수 있지만 모든 Feature에 eval을 요구하지 않는다.

Demo checkpoint는 Section 3 전체 여정에서 해당 Feature가 담당하는 역할과 사용자가 관찰할 완료 결과를 한 문장으로 연결한다. 데모의 순서, 오류와 성공 조건은 기존 User Flow, edge case·error handling과 Acceptance Criteria를 사용한다. 별도 `7.x.7 Feature Demo` subsection은 만들지 않는다.

사용자가 상세 데모 절차를 요청하면 모델은 Section 3과 해당 Feature의 기존 subsection에서 일시적으로 조합해 보여준다. 파생된 절차는 ALPS 문서의 별도 권위로 저장하지 않는다.

### Requirement contract

#### 필수 보장

- Section 7 작성자는 Section 3과 Section 6을 먼저 읽는다.
- 모든 `7.x` Feature의 Acceptance Criteria는 전체 데모에서의 역할과 관찰 가능한 완료 결과를 연결하는 `Demo checkpoint` 한 줄을 포함한다.
- Demo checkpoint는 같은 Feature의 User Flow, 오류 처리와 Acceptance Criteria에 모순되지 않아야 한다.
- Atomic과 batch 작성 모두 기존 Feature 단위의 승인과 저장 경계를 유지한다.

#### 의도와 사전 수용 조건

| 의무                                                                              | 관찰 가능한 검증 기준                                                                                 |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| User Story는 대상 사용자의 문제와 얻어야 할 결과를 설명한다.                      | 해당 Feature만 읽어도 누구의 어떤 문제가 왜 해결되어야 하는지 알 수 있다.                             |
| 각 사용자 결과에는 판정 가능한 수용 조건이 있다.                                  | 결과가 누락된 초안은 완료로 제시되지 않고, 해당 결과를 확인할 조건이 보완된다.                        |
| 각 필수 제약에는 판정 가능한 수용 조건이 있다.                                    | 값, 단위, 권한, 금지 동작과 실패 보장을 각각 준수하거나 위반한 결과를 구분할 수 있다.                 |
| 각 수용 조건은 적용 상황과 기대 결과를 특정한다.                                  | 같은 상황의 정상 결과와 관련 반례를 서로 다르게 판정할 수 있고, 불필요한 예외를 발명하지 않는다.      |
| 필요한 증거의 종류와 통과·실패 기준은 Feature 승인 전에 제시한다.                 | 작성 완료 화면에서 어떤 결과를 test, eval 또는 demo로 확인할지 설명할 수 있다.                        |
| 품질 eval을 수용 조건으로 사용할 때는 대표 상황의 범위와 품질 판단 규칙을 정한다. | 출력이 있다는 사실만으로 통과하지 않고, 의도에 맞는 결과와 부족한 결과를 구분한다.                    |
| 수용 여부를 바꾸는 임계값과 집계 규칙은 근거와 함께 승인받는다.                   | 사용자가 정하지 않은 합격률을 확정 사실로 기록하지 않으며, 미정 기준에 의존하는 완료 판정을 보류한다. |
| Demo checkpoint는 수용 조건을 대체하지 않는다.                                    | 전체 데모의 정상 경로가 보여도 필수 제약을 위반한 Feature는 수용되지 않는다.                          |

초안 작성은 미정 항목을 표시하고 계속할 수 있다. 최종 Feature 승인에는 의도와 수용 조건을 함께 제시하고, 수용 여부를 바꾸는 미정 제품 결정은 기존 승인 경계에서 해결한다. 별도 의도 subsection, 평가 계획 문서나 추가 승인 단계를 만들지 않는다. 실제 사례 데이터, 테스트 코드와 실행 결과는 구현·검증 단계에서 관리한다.

#### 금지

- Section 7에 별도 `7.x.7 Feature Demo` subsection을 만들지 않는다.
- Demo checkpoint에 사전 조건, 전체 사용자 행동, 실패 시나리오와 성공 조건을 반복하지 않는다.
- Demo checkpoint에 구현 라이브러리, 코드 구조, 테스트 파일, 배포 절차, PR 또는 커밋 계획을 기록하지 않는다.

#### 실패 시 보장

- Demo checkpoint만으로 상세 절차가 부족하면 문서 구조를 늘리지 않고 기존 Section 3, User Flow, 오류 처리와 Acceptance Criteria를 사용해 요청 시 설명한다.

### Alternatives

1. **Section 3 전체 데모만 유지**
   - 장점: Section 7에 새 필드가 없다.
   - 단점: 개별 Feature가 전체 여정에 기여하는 지점을 빠르게 찾기 어렵다.

2. **각 Feature에 완전한 Feature Demo subsection 추가**
   - 장점: Feature 하나만 읽어도 완전한 데모 절차를 얻는다.
   - 단점: User Flow, 오류 처리와 Acceptance Criteria를 반복해 작성하고 함께 유지해야 한다.

3. **Acceptance Criteria에 Demo checkpoint 한 줄 추가**
   - 장점: 전체 데모와의 연결을 보존하면서 기존 Feature 명세를 반복하지 않는다.
   - 단점: 상세 데모 절차는 기존 subsection을 함께 읽거나 요청 시 파생해야 한다.

## Consequences

### Positive

- Feature를 구현하기 전에 사용자의 의도와 완료 판단의 근거를 함께 검토할 수 있다.
- Builder는 각 Feature가 전체 데모에서 담당하는 역할을 한 줄로 확인할 수 있다.
- User Flow, 오류 처리와 Acceptance Criteria가 상세 제품 행동의 단일 소스로 유지된다.
- Section 7 작성과 검토 비용이 줄고 같은 행동의 문서 간 드리프트가 사라진다.

### Negative

- 품질 판단이 필요한 Feature는 대표 상황과 수용 기준을 먼저 구체화해야 한다.
- Feature만 단독으로 읽을 때 완전한 데모 실행 절차는 보이지 않는다.
- 상세 데모가 필요하면 Section 3과 기존 Feature subsection을 함께 읽어야 한다.

### Risks

- 구현이 끝난 뒤 유리한 기준을 선택하면 원래 의도를 놓칠 수 있다. 승인된 수용 조건을 기준으로 판정하며 변경은 제품 계약 변경으로 확인한다.
- Demo checkpoint가 모호한 슬로건으로 퇴화할 수 있다. 역할과 관찰 가능한 완료 결과를 모두 한 문장에 포함한다.
- 상세 데모 요청이 새 영속 문서를 만들 수 있다. 설명은 기존 권위 문서에서 파생한 일시적 출력으로 유지한다.

## Related

- 없음
