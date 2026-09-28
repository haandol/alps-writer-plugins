# ADR 0001: 필수 NFR을 focus set 제한 밖에서도 보존

Date: 2026-08-15

## Status

Accepted (2026-08-15)

## Purpose

MVP는 소수의 release-gating NFR에 집중해야 하지만 보안, 규제, 계약 또는 사용자가 명시한 필수 조건은 개수 제한 때문에 삭제할 수 없다. 모든 NFR을 동일한 우선순위로 나열하면 집중력이 떨어지고, 전체 수를 세 개로 제한하면 필수 계약이 손실될 수 있다.

## Decision Drivers

- MVP가 실제로 검증할 핵심 NFR은 소수로 강조돼야 한다.
- 보안·규제·계약상 필수 요구사항은 개수와 무관하게 남아야 한다.
- 모든 NFR은 측정 또는 명확한 pass/fail 방법을 가져야 한다.
- 선택하지 않은 optional NFR은 명시적으로 defer돼야 한다.

## Decision

NFR 목록은 **focus set**과 **mandatory constraints**를 구분한다.

Focus set은 MVP release를 대표하는 상위 세 개 NFR을 강조한다. Mandatory constraints는 보안, 규제, 계약과 사용자가 Must-Have로 확정한 요구사항이며 세 개를 초과해도 모두 유지한다. 그 외 optional NFR은 우선순위와 defer 위치를 기록한다.

### Requirement contract

- Focus set은 최대 세 개의 release-gating NFR을 강조한다.
- 보안, 규제, 계약 또는 사용자가 Must-Have로 확정한 NFR은 focus set 수와 무관하게 모두 기록한다.
- Mandatory constraint를 focus set 제한에 맞추기 위해 합치거나 삭제하지 않는다.
- 각 NFR은 측정 가능한 threshold 또는 명확한 pass/fail 조건과 검증 방법을 가진다.
- Optional NFR을 제외하면 이유와 후속 검토 위치를 기록한다.
- 관련 성공 기준 또는 release test는 같은 threshold와 단위를 사용한다.

### Alternatives

1. **전체 NFR을 최대 세 개로 제한**
   - 장점: 문서가 짧고 우선순위가 명확하다.
   - 단점: 필수 보안·규제 요구사항이 탈락할 수 있다.

2. **NFR 수에 제한을 두지 않음**
   - 장점: 모든 요구사항을 보존한다.
   - 단점: MVP release를 실제로 좌우하는 조건이 흐려진다.

3. **상위 세 개 focus set과 필수 constraint 분리**
   - 장점: 집중도와 계약 보존을 함께 달성한다.
   - 단점: 두 목록의 역할을 사용자에게 설명해야 한다.

## Consequences

### Positive

- MVP의 핵심 품질 목표가 선명하다.
- 보안·규제·계약 요구사항이 개수 제한으로 손실되지 않는다.

### Negative

- 최종 NFR 수가 세 개를 넘을 수 있다.

### Risks

- 모든 항목을 mandatory로 분류할 수 있다. 사용자가 바꿀 수 없는 외부 의무나 명시적 Must-Have만 mandatory로 인정한다.

## Related

- 없음
