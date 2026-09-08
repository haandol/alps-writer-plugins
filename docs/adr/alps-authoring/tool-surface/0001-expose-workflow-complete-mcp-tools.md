# ADR 0001: 작성 흐름이 완결된 최소 MCP 툴 표면을 제공

Date: 2026-09-08

## Status

Accepted (2026-09-08)

## Context

ALPS Writer의 공개 MCP 표면은 Full과 Lite 템플릿 조회를 대칭적으로 추가하면서 17개 툴로
늘어났다. 작성자는 실제 흐름에서 사용하지 않는 섹션 목록과 전체 템플릿 조회까지 선택지로
받는다. 전체 템플릿 조회는 현재 작성 단위와 무관한 Section을 한 번에 읽게 하므로 선택적
읽기와 점진적 공개 원칙을 약화한다.

Section 작성은 대화 가이드와 템플릿 골격을 모두 필요로 한다. 두 조회를 독립 툴로 노출하면
호출자가 한쪽을 생략해 작성 계약을 불완전하게 적용할 수 있고, 정상 흐름에서도 같은 Section
번호로 두 번 호출해야 한다.

Full과 Lite 문서 생성은 파일 형식, 프로필, Section 집합이 다른 명시적 사용자 선택이다.
반면 문서를 선택한 뒤의 로드, 저장, 읽기, 상태 조회와 내보내기는 활성 문서의 프로필을
자동으로 따른다.

## Decision Drivers

- 공개 툴 하나는 호출자가 구분할 수 있는 하나의 사용자 의도를 나타내야 한다.
- Section 작성에 필요한 가이드와 템플릿 골격은 함께 제공돼야 한다.
- 작성자는 현재 단위에 필요한 내용만 읽고 전체 템플릿을 선행 로드하지 않아야 한다.
- Full과 Lite 문서 생성은 잘못된 프로필 선택을 줄이도록 별도 진입점으로 유지해야 한다.
- 공개 툴 이름을 바꾸는 릴리스는 번들 스킬, 서버 지침, 문서와 검증을 같은 변경 단위로
  갱신해야 한다.

## Decision

ALPS Writer는 다음 11개 공개 MCP 툴을 제공한다.

### 템플릿 작성 문맥

- `get_alps_overview`
- `get_lite_alps_overview`
- `get_alps_section_context`
- `get_lite_alps_section_context`

각 Section context 툴은 해당 프로필의 대화 가이드를 먼저 반환하고 템플릿 골격을 이어서
반환한다. 가이드가 선행 Section 읽기를 요구하면 그 지시가 응답의 첫 부분에 나타난다. 호출자는
같은 요청에서 예시 포함 여부를 선택할 수 있다.

### 문서 관리

- `init_alps_document`
- `init_lite_alps_document`
- `load_alps_document`
- `save_alps_section`
- `read_alps_section`
- `get_alps_document_status`
- `export_alps_markdown`

Full과 Lite 초기화는 별도 공개 툴을 유지한다. 나머지 문서 관리 툴은 활성 문서의 프로필을
감지해 같은 이름으로 동작한다.

`load_alps_document`는 문서 상태와 프로필에 맞는 재개 지침을 함께 반환한다. 번들 작성 스킬은
로드 직후 같은 상태를 다시 조회하지 않는다. `get_alps_document_status`는 저장 이후나 사용자가
진행 상황을 다시 확인할 때 사용할 수 있도록 유지한다.

```mermaid
flowchart LR
    Start["새 문서 생성 또는 기존 문서 로드"] --> Overview["프로필별 overview"]
    Overview --> Context["프로필별 Section context<br/>guide 다음 template"]
    Context --> Approval["사용자 승인"]
    Approval --> Save["공통 문서 저장"]
    Save --> Context
    Save --> Export["공통 Markdown 내보내기"]
```

### Requirement contract

#### Required guarantees

- MCP `tools/list`는 위 11개 툴을 각각 한 번만 공개한다.
- Full Section context는 Full 프로필의 유효한 Section 번호만 허용한다.
- Lite Section context는 Lite 프로필의 유효한 Section 번호만 허용한다.
- Section context 응답은 대화 가이드를 템플릿 골격보다 먼저 제공한다.
- Section context는 호출자가 요청한 경우에만 템플릿 예시를 포함한다.
- Full과 Lite 초기화는 별도 툴로 유지하며 각각 자신의 문서 형식과 프로필을 생성한다.
- 로드, 저장, 읽기, 상태 조회와 내보내기는 활성 문서의 프로필을 자동으로 따른다.
- 로드 응답은 현재 문서 상태와 프로필별 재개 지침을 포함한다.
- 번들 작성 스킬과 서버 지침은 공개된 툴 이름만 사용한다.
- 외부 사용자를 위한 MCP 문서는 공개된 툴 집합과 작성 순서를 설명한다.

#### Prohibitions

- 공개 툴 표면은 Section 목록 파일명을 반환하는 별도 목록 툴을 제공하지 않는다.
- 공개 툴 표면은 모든 Section을 한 번에 반환하는 전체 템플릿 툴을 제공하지 않는다.
- Section context 툴은 가이드가 요구하는 선행 Section 검토를 생략하거나 템플릿 뒤에 숨기지
  않는다.
- Full과 Lite 초기화를 프로필 인자 하나를 받는 단일 공개 툴로 합치지 않는다.
- 작성 스킬은 로드 응답에서 상태를 받은 직후 동일한 상태 조회를 필수 호출로 요구하지 않는다.

#### Failure guarantees

- 유효 범위를 벗어난 Section context 요청은 문서를 변경하지 않고 거부한다.
- 제거된 툴 이름은 다른 동작으로 재사용하지 않는다.
- 템플릿 조회 실패는 활성 문서 내용과 선택 상태를 변경하지 않는다.
- 툴 표면 변경은 기존 문서의 로드, 저장, 읽기, 상태 조회와 내보내기 계약을 변경하지 않는다.

#### Observable evidence

| Obligation            | Observable evidence                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- |
| 11개 공개 툴          | MCP 클라이언트가 조회한 툴 이름이 계약의 11개와 정확히 일치한다.                       |
| 목록·전체 템플릿 제거 | 조회한 툴 이름에 목록 또는 전체 템플릿 전용 툴이 없다.                                 |
| Section 문맥 통합     | 한 번의 Section context 호출 결과에서 guide가 먼저, template이 뒤에 나타난다.          |
| 프로필별 Section 검증 | Full 범위 밖 또는 Lite 범위 밖 번호가 각 context 툴에서 거부된다.                      |
| 예시 선택             | 같은 Section 호출에서 예시 옵션에 따라 example 내용의 포함 여부가 달라진다.            |
| 명시적 문서 유형 선택 | Full 초기화와 Lite 초기화가 서로 다른 공개 툴로 보인다.                                |
| 공통 문서 관리        | 활성 Full 또는 Lite 문서에 같은 관리 툴 이름을 사용해 정상 작업할 수 있다.             |
| 재개 상태 중복 제거   | load 응답만으로 현재 상태를 확인하며 번들 스킬이 즉시 status 재호출을 요구하지 않는다. |
| 배포 계약 일치        | 번들 런타임, 스킬, 서버 지침과 MCP 문서가 같은 툴 이름과 호출 순서를 사용한다.         |
| 기존 문서 동작 보존   | Full과 Lite 문서의 기존 저장 검증, 상태 판정과 Markdown 내보내기 결과가 유지된다.      |

### Alternatives

1. **17개 툴을 유지한다**
   - 장점: 기존 외부 호출 이름과 완전히 호환된다.
   - 단점: 사용하지 않는 조회가 계속 노출되고 Section 작성에 두 번의 필수 호출이 남는다.

2. **프로필과 동작을 인자로 받는 범용 툴 하나로 합친다**
   - 장점: 공개 툴 수가 가장 작아진다.
   - 단점: 호출 의도가 `action`과 `profile` 조합에 숨고, 잘못된 조합 검증과 설명이 복잡해진다.

3. **사용하지 않는 조회를 제거하고 Section guide와 template만 프로필별로 통합한다**
   - 장점: 사용자 의도와 프로필 경계를 유지하면서 툴 수와 정상 호출 횟수를 함께 줄인다.
   - 단점: 기존 툴 이름을 직접 호출하는 외부 프롬프트는 새 이름으로 갱신해야 한다.

## Consequences

### Positive

- 작성자가 선택해야 할 공개 툴이 17개에서 11개로 줄어든다.
- 한 번의 Section context 호출이 작성 가이드와 템플릿 골격을 함께 제공한다.
- 전체 템플릿을 불필요하게 읽는 경로가 사라진다.
- Full과 Lite의 명시적 생성 경계와 공통 문서 관리 구조가 유지된다.
- load 직후 중복 상태 조회가 사라진다.

### Negative

- 제거되거나 이름이 바뀐 툴을 직접 호출하는 외부 프롬프트는 수정해야 한다.
- Section template만 독립적으로 조회하던 비표준 사용자는 guide까지 함께 받는다.
- 툴 표면 변경 릴리스는 스킬, 지침, 문서, 테스트와 번들을 동시에 갱신해야 한다.

### Risks

- 스킬이나 문서에 이전 툴 이름이 남으면 런타임에서 존재하지 않는 툴을 호출할 수 있다.
- 통합 응답에서 template이 guide보다 먼저 나오면 선행 Section 검토 지시가 약해질 수 있다.
- 공개 툴 목록만 줄이고 전체 템플릿 내용을 다른 응답에 합치면 선택적 읽기 이점이 사라질 수
  있다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
- [Lite ALPS 작성 프로필](../lite-format/0001-lite-alps-authoring-profile.md)
