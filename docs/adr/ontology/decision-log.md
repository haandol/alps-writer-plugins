# Decision Log: ontology

This document is the **major decision-change history** of the ontology category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

The current Purpose, all still-valid Decision Drivers, adopted choice, rationale,
and requirement contract remain together in the ADR body. Reading this log is
optional for understanding the current decision.

## 2026-11-09 — 갱신이 필요한 영향 ADR만 갱신

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 승인 요약은 영향 ADR마다 갱신 여부와 근거를 보이고, 갱신하는 ADR만 semantic diff를 보인 뒤 `Proposed`로 구현한다. 현재 계약이 바뀐 업무 의미를 이미 담고 있는 영향 ADR은 내용과 Status를 유지하고, 그 판단의 기준 revision은 승인 요약에 묶인다(R31·R36).
- **Why**: 문서 기반 첫 구축에서 연결만 새로 생긴 기능 21개의 ADR 128개가 모두 갱신·재구현 대상이 되어, 계약이 바뀌지 않는 기능까지 재구현 범위가 커졌다.
- **What is now void**: 영향 ADR을 모두 edit-in-place로 갱신해 `Proposed`로 만들던 규칙. 승인 뒤 바뀐 영향 ADR을 덮어쓰지 않는 보장(R48)은 유지한다.

## 2026-11-08 — 로컬 웹 질문 세션으로 실시간 답변

- **Current ADR**: [build-ontology-from-documents](./0004-build-ontology-from-documents.md)
- **Change type**: requirement rule change
- **What**: 리포트의 질문에 로컬 웹 질문 세션에서 바로 보내기·모아 보내기로 답하고, 에이전트가 답마다 후속 질문과 갱신된 후보를 같은 화면에 올린다. 질문은 다이어그램과 선택지별 결과 비교로 시각화하고, 저장소의 문서·ADR·하네스가 답하는 질문은 묻지 않고 해소 항목으로 보인다. 최종 승인 요약과 저장 승인은 대화에서 받는다(R33–R39).
- **Why**: 사용자는 질문이 많은 구축에서 답을 텍스트로 모두 쓰지 않고 웹에서 시각 자료를 보며 실시간으로 답하기를 원했고, 저장소에 이미 있는 답을 다시 묻지 않기를 원했다.
- **What is now void**: 질문 답변을 대화의 텍스트로만 받던 방식. 리포트 하나로 질문을 제시하고 질문 식별자로 답하는 보장(R12)은 유지한다.

## 2026-11-07 — 검색 색인 제거, 조회마다 현재 원본에서 계산

- **Current ADR**: [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: adopted alternative replacement
- **What**: 다중어·인용 문구·짧은 한글 검색, 관련도와 원문 근거는 유지하고, 그 계산을 SQLite 파생 색인 대신 조회마다 이미 읽은 현재 원본 그래프에서 한다.
- **Why**: 사용자는 색인의 현재성 확인과 재생성 부담을 피하려고 꼭 필요하지 않으면 색인을 두지 않는다. 조회는 원래 모델 전체를 해석하므로 색인이 줄일 비용이 작고, 같은 검색어에서 색인과 직접 계산의 결과가 같았다.
- **What is now void**: 검색 색인을 원본에서 재생성하는 파생 캐시로 두고, 캐시 손상·사용 불가·동시 접근 실패를 같은 결과로 복구하던 보장.

## 2026-11-07 — 로컬 색인의 다중어·한글 검색과 근거 반환

- **Current ADR**: [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 연속 문구·식별자 순서 중심의 탐색을 다중어·인용 문구·짧은 한글과 관련도 검색으로 확장하고, BC 내부의 일치 필드·원문 위치와 원본 기반 캐시 재생성을 보장한다.
- **Why**: 사용자는 서비스 운영 부담 없이 Bun과 로컬 SQLite를 사용해 ADR·ontology 검색을 개선하도록 요청했다.
- **What is now void**: 검색어 전체의 연속 일치만으로 후보를 한정하고 관련도 없이 식별자 순서로만 보여주던 검색 의미. 필수 관계·진단·BC 해상도와 ADR의 구현 권위는 유지한다.

## 2026-11-05 — BC 지식 공간과 레이어 확대 이동

- **Current ADR**: [render-read-only-ontology-views](./0005-render-read-only-ontology-views.md)
- **Change type**: requirement rule change
- **What**: BC 전체를 3차원 책임 영역으로 보고, 선택한 BC의 내부 지식과 상세로 확대 이동한다. 현재 검색 페이지와 실제 지식 범위만 펼치며 목록 보기, 복귀 상태와 동작 줄이기를 보존한다.
- **Why**: 사용자는 지식 레이어가 BC의 확대·내부 펼침과 연결되는 3차원 탐색과 애니메이션을 요청했다.
- **What is now void**: 없음. 기존 전체 사건 흐름·3차원 업무 구조는 별도의 전체 탐색으로 유지한다.

## 2026-11-05 — 온톨로지 UI에도 지식 레이어 적용

- **Current ADR**: [render-read-only-ontology-views](./0005-render-read-only-ontology-views.md)
- **Change type**: requirement rule change
- **What**: 기본 화면을 BC 책임·핵심 업무·협업으로 두고, 선택 BC의 업무 검색·목록과 상세로 내려간다. 전체 사건 흐름·3D 구조는 명시적으로 여는 전체 업무 탐색으로 유지한다.
- **Why**: 작성된 지식 레이어와 에이전트 조회에 맞춰 사용자 UI에서도 작은 BC 조망을 먼저 읽고 필요한 내부 업무만 펼치려는 의도를 반영한다.
- **What is now void**: 저장 모델의 첫 화면을 전체 사건 흐름으로 고정하던 규칙.

## 2026-11-05 — BC 조망에서 내부 업무와 ADR로 내려가는 검색

- **Current ADR**: [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 온톨로지 지식을 구성할 때부터 BC의 책임·핵심 업무·협업과 BC 내부 업무를 레이어로 나눈다. 최상위 BC 지식 전체를 가볍게 읽고 내부 업무는 검색·페이지 탐색으로 내려가며, 구체적 사건·순서·개념·규칙은 내부 레이어에 보존한다.
- **Why**: 사용자는 C4 model과 HNSW에서 착안해, 큰 비즈니스 로직을 한 번에 LLM에 넣지 않고 전체 조망에서 관련 BC를 골라 업무 상세와 ADR로 내려가기를 원했다. 이 구체적 의도를 조회 계약과 도입·구축의 목적에 보완한다.
- **What is now void**: 기능·프로세스·개념·사건의 식별자를 미리 알아야만 탐색할 수 있던 입력 범위. 기존 직접 조회와 ADR의 구현 권위는 유지한다.

## 2026-11-03 — 사건의 원인·결과 묶음과 업무 영역 탐색

- **Current ADR**: [render-read-only-ontology-views](./0005-render-read-only-ontology-views.md)
- **Change type**: requirement rule change
- **What**: 사건 흐름에 전체 업무 영역 탐색과 주체·행동·변화·사건·뷰 묶음을 제공하고, 신호의 가시성과 정지 이유를 설명한다.
- **Why**: 사건이 스스로 발생하는 것처럼 읽히고, 서브도메인과 컨텍스트 소속을 구별할 수 없으며, 움직임이 눈에 잘 보이지 않는 문제를 해결한다.
- **What is now void**: 후보 보드의 표현을 개별 사건과 원본 카드로만 제한하던 규칙. 최상위 모델 탭은 사건 흐름·업무 구조 두 개로 유지한다.

## 2026-11-03 — 실제 업무의 캡처와 개발·검증 연결

업무 지도를 처음 보는 사람도 수행 주체·대상·시작 계기·결과를 읽을 수 있도록 표시 계약을 보강했다. 사용 대상과
선택을 상태 변화처럼 보이게 하던 모호함을 없애고, 다른 컨텍스트의 시작 조건을 집중 보기에서도 설명하도록 정했다.

기본 시점의 강제 기울임을 없애고 이벤트 인계 방향을 움직이는 신호로 설명하도록 정했다. 카메라와 업무 판정은
효과로 바꾸지 않고, 일시 정지·모션 감소·숨김 처리를 둔다.

3D 이벤트 맵은 컨텍스트 구역과 경계를 넘는 사건을 탐색하는 표현으로 구체화했다. 단순 카드 입체화보다 책임 경계와
인계를 먼저 이해하게 하고, 기본 드래그 이동과 평면 상세를 제공하며 이동 상태는 저장하지 않는다.

이벤트 스토밍의 3D 이벤트 맵을 첫 화면으로 두고 기존 업무 계층 모델은 탭으로 전환하도록 정했다. 실제 업무의
인과 흐름을 먼저 읽고, 필요한 때 책임·프로세스 구조를 살펴보게 하려는 결정이다.

온톨로지 자체의 완벽함이나 추론 능력보다 실제 업무의 흐름·판단 근거·예외를 정확하고 풍부하게 캡처하고 그 로직을
ADR을 거쳐 코드와 테스트로 전달하는 목적을 명시했다. 구축 계약은 근거 기반 이벤트 맵에서 컨텍스트·서브도메인을
식별하도록, 활용 계약은 구현 리뷰까지 업무 시나리오를 연결하도록 바꿨다. 프로세스 완전성·ADR 준비·실행 증거를
구별하는 검토와 엔티티 변화 전후를 근거로 표시하는 이벤트 스토밍 보드·후속 작업 안내를 계약에 추가했으며, 구현·검증을 마치지 않은 네 결정은 Proposed로 둔다.

## 2026-11-02 — 레벨 이름을 업무 온톨로지로 바꾸고 모델 문서를 `docs/ontology/`에 둠

- **Current ADR**: [introduce-business-ontology-level](./0001-introduce-business-ontology-level.md)
- **Change type**: requirement rule change
- **What**: 모델 문서를 사용자 저장소의 `docs/process/`에 두던 규칙 → `docs/ontology/`에 둔다. 레벨 이름도 업무 프로세스 모델에서 업무 온톨로지로 바꿨다. 이 레벨을 담은 릴리스가 아직 없어 옮길 모델은 없다.
- **Why**: 레벨을 맡는 플러그인(Ontology Writer)과 레벨, 모델 디렉터리가 같은 대상을 서로 다른 이름으로 불렀다. 사용자가 이름을 온톨로지로 통일하기로 정했다(사용자 결정, 2026-11-02).
- **What is now void**: 모델 문서를 `docs/process/`에 둔다는 규칙.

## 2026-11-02 — 업무 온톨로지 레벨을 별도 플러그인 Ontology Writer로 나눔

- **Current ADR**: [introduce-business-ontology-level](./0001-introduce-business-ontology-level.md), [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md), [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md), [build-ontology-from-documents](./0004-build-ontology-from-documents.md), [render-read-only-ontology-views](./0005-render-read-only-ontology-views.md)
- **Change type**: architecture
- **What**: ADR Writer가 업무 온톨로지 레벨까지 맡던 결정 → 별도 플러그인 Ontology Writer가 어휘, 모델의 작성·검증·저장, 업무 맥락 조회와 그 세션 지침, 변경 승인과 하위 전파, 문서에서 모델 구축과 화면을 맡고, ADR Writer는 ADR과 ADR 색인(실현 기능 기록의 형식 포함)을 맡는다. 모델 변경과 색인 연결은 Ontology Writer가 같은 변경 단위로 쓰고, 영향 ADR이 있는 변경에는 두 플러그인이 함께 있어야 한다. 모델 문서가 있으면 ADR Writer의 세션 지침은 업무 맥락을 Ontology Writer로 확인하고 확인하지 못했으면 그 사실을 밝히라는 한 줄을 더하며, ADR 작업을 막지 않는다.
- **Why**: 모델을 쓰지 않는 사용자도 세션마다 온톨로지 스킬 다섯 개의 설명을 싣고 있었고, 그 분량은 나머지 ADR 스킬 설명을 모두 합친 것과 비슷했다. 사용자가 PRD, 업무 모델과 ADR 계층마다 플러그인을 나누기로 정했다(사용자 결정, 2026-11-02).
- **What is now void**: ADR Writer만으로 모델을 작성하고 검증한다는 기준, 소유 플러그인으로 ADR Writer를 채택한 판단.

## 2026-11-01 — 온톨로지 화면에 요소 찾기, 관계 이동과 3차원 전경을 더함

- **Current ADR**: [render-read-only-ontology-views](./0005-render-read-only-ontology-views.md)
- **Change type**: requirement rule change
- **What**: 전경에서 흐름과 상세로 내려가기만 하던 화면 → 보이는 모든 요소를 이름이나 식별자로 찾고, 바운디드 컨텍스트별로 묶은 목록에서 프로세스의 단계를 흐름 순서로 보며, 요소 상세의 관계를 관계 이름·방향과 함께 따라간다. 전체 업무 전경은 회전·확대할 수 있는 3차원 공간으로도 보이고, 그 공간에는 그림·목록·상세에 없는 정보가 없다.
- **Why**: 실제 프로젝트 문서로 만든 모델(요소 1,194개, 프로세스 78개)에서 프로세스를 따라 내려가는 화면만으로는 원하는 요소에 닿기 어려웠다. 사용자가 요소 탐색을 화면에 넣고 전경을 3차원 공간으로 보여 달라고 정했다(사용자 결정, 2026-11-01).
- **What is now void**: 없음.

## 2026-10-31 — 읽을 수 없는 커밋이 이어진 구간에서 Status가 바뀌었을 수 있는 `Accepted` 프로세스는 미확인으로 보고하고 사용자 확인으로 정리

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 이 경우를 정하지 않던 규칙 → `Accepted` 프로세스가 마지막으로 `Accepted`가 된 곳까지의 이력에 모델을 읽을 수 없는 커밋이 두 개 이상 이어지고 그 안에서 그 프로세스의 Status가 바뀌었다가 돌아왔을 수 있으면, 온톨로지 동기화는 그 프로세스를 미확인으로 보고하고 사용자에게 그 구간에서 업무 구성이 바뀌었는지 묻는다. 바뀌지 않았다고 확인하면 `Accepted` 날짜를 다시 기록하고, 확인하지 않으면 `Proposed`로 표시해 정렬 검토를 받게 한다. 허용 전이와 생명주기 전이 목록, 실패한 정렬 검토의 보고도 이 확인과 표시를 따른다.
- **Why**: 그 구간 안에서 Status가 바뀌었다가 돌아왔을 수 있지만 그때의 업무 구성은 이력으로 볼 수 없다. 그런 프로세스를 모두 업무 구성 변경으로 다뤄 정렬 검토로 보내는 대신, 사용자의 확인으로 정하기로 했다(사용자 결정, 2026-10-31).
- **What is now void**: 없음.

## 2026-10-31 — 용어집 표에서 다른 내용일 수 있는 칸의 이름은 묻고 저장을 막지 않음

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 용어집 표의 칸마다 헤더로 정의 항목인지 정해 같은 이름이 있으면 정리 전까지 저장을 막던 규칙 → 헤더가 용어·이름·언어를 뜻하는 열(그런 열이 없으면 첫 열)의 이름만 정의 항목으로 보고 정리 전까지 저장을 막는다. 다른 열(정의·설명 열 제외)의 같은 이름은 그 칸이 정의인지 사용자에게 묻고 저장을 막지 않는다.
- **Why**: 헤더만으로는 열이 그 용어의 이름을 담는지 문맥·분류·관계 같은 다른 내용을 담는지 확정할 수 없어, 놓침과 과잉 판정이 번갈아 생겼다. 사용자가 분명한 칸만 막고 나머지는 묻기로 정했다(사용자 결정, 2026-10-31).
- **What is now void**: 모든 표 칸을 헤더 판정만으로 정의 항목인지 정하던 규칙.

## 2026-10-31 — 커밋되지 않은 `Proposed` 위의 같은 날이나 이른 날의 승격은 알리고 커밋 뒤로 미룸

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 정렬 검토를 통과하면 언제나 바로 `Accepted (날짜)`가 되던 규칙 → 마지막으로 커밋된 모델이 그 프로세스를 검토 날짜와 같거나 그보다 늦은 날짜의 `Accepted`로 가진 채 그 프로세스를 `Proposed`로 만든 변경이 커밋되지 않았으면, ADR Writer는 승격하지 않았다는 것과 그 이유를 알리고 그 변경이 커밋된 뒤 승격한다.
- **Why**: 승인 기록을 두지 않고 Status를 날짜 단위로 기록하므로, 그대로 승격하면 커밋 뒤 이력이 검토를 거친 승격을 같은 값(동기화 전 직접 편집)이나 이른 날짜로의 손 재기록으로 읽기 때문이다. 같은 날 확인의 한계(2026-10-30)와 같은 근거다(사용자 결정, 2026-10-31).
- **What is now void**: 이 경우에도 통과 직후 Status가 `Accepted (날짜)`가 된다는 기준.

## 2026-10-30 — 현재 `Accepted` 날짜와 같은 날의 확인은 다시 기록하지 않고 알림

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md), [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 업무 구성을 바꾸지 않는 편집을 확인하면 언제나 그 확인이 다음 비교의 기준이 된다고 하던 규칙 → 확인한 날짜가 그 프로세스의 현재 `Accepted` 날짜와 같으면 Status를 다시 기록하지 않고, ADR Writer가 그 사실과 이유를 알리며, 그 편집은 날짜가 바뀐 뒤의 확인 전까지 동기화 전 직접 편집으로 표시된다. 다시 기록한 `Accepted`는 커밋된 뒤에 비교 기준이 된다.
- **Why**: Status가 날짜 단위이고 별도 승인 기록을 두지 않아, 같은 날의 확인은 저장소 이력에 새 기준을 남길 수 없기 때문이다(사용자 결정, 2026-10-30: 날짜 단위를 유지하고 한계를 명시).
- **What is now void**: 같은 날의 확인도 곧바로 다음 조회와 동기화의 표시를 없앤다는 관찰 기준.

## 2026-10-30 — 업무 구성을 바꾸지 않는 편집의 확인이 `Accepted` 날짜를 다시 기록

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md), [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 미정 범위만의 변경이나 같은 뜻으로 확인한 문구 수정이 `Accepted` 프로세스의 Status를 전혀 바꾸지 않던 규칙 → 승인 저장이나 온톨로지 동기화가 그런 편집을 확인하면, 기계 게이트가 유지될 때 확인한 날짜의 `Accepted`로 다시 기록한다(`Accepted`→`Accepted` 날짜 갱신). 조회는 그 이전의 편집을 표시하지 않고, 변경 표시를 판정할 수 없는 범위는 이유와 함께 보이며 ADR 작성과 구현은 그 범위를 동기화 전 직접 편집이 있을 수 있는 것으로 다룬다.
- **Why**: 승인 기록을 두지 않는 상태에서 확인한 비의미 편집이 다음 비교에서 다시 직접 편집으로 표시되고 같은 확인을 매번 다시 묻게 되었기 때문이다(사용자 결정, 2026-10-30).
- **What is now void**: 미정 범위만의 변경과 같은 뜻의 문구 수정이 Status를 바꾸지 않는다는 규칙의 날짜 부분, 이런 편집이 다음 `Accepted`까지 계속 표시되던 동작.

## 2026-10-29 — 준수 계약 배치와 Status 연쇄를 규칙이 닿는 단계와 업무 구성 기준으로 변경

- **Current ADR**: [govern-ontology-lifecycle-and-cascade](./0003-govern-ontology-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 규칙이 제약하는 상태를 바꾸는 단계에 두던 준수 계약 → 규칙이 닿는 단계에 둔다. 공유 요소를 참조하는 모든 프로세스를 `Proposed`로 만들던 연쇄 → 업무 구성(미정 범위 제외)이 바뀐 프로세스만 `Proposed`가 된다. 관찰 기준의 실행 범위는 기준이 지나는 단계와 경유 사건의 다른 프로세스 단계로 정하고, 다른 프로세스의 단계는 현행이거나 함께 검증할 때만 넣는다. `Accepted` 프로세스의 커밋된 직접 편집은 마지막 `Accepted` 뒤의 저장소 이력으로 찾는다. 목표 프로세스 때문에 미룬 인계는 그 프로세스가 현행이 되는 검토에서 실행하고, 모델이 정의를 갖게 되는 업무 용어의 기존 용어집 항목은 같은 승인 요약에서 한 결정으로 정리한다.
- **Why**: 모델에서 업무 상태를 빼기로 한 해상도 결정을 따르고, 문서 리뷰가 지적한 대로 다른 프로세스의 목표 변경이 운영 중인 현행 프로세스를 목표로 되돌리지 않게 하기 위해서다.
- **What is now void**: 제약받는 상태를 바꾸는 단계의 실현 ADR에 준수 계약을 두던 규칙, 공유 요소를 참조하는 모든 프로세스를 함께 `Proposed`로 만들던 규칙, `Accepted` 프로세스의 커밋된 직접 편집을 실현 ADR과의 정렬 차이로만 찾던 규칙.

## 2026-10-29 — ADR 작성·수정 경로가 업무 모델을 먼저 확인하고 준수 계약을 제안하도록 확장

- **Current ADR**: [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 연결된 기능의 코드를 바꾸기 전 조회하라는 지시 한 줄과, 업무 맥락을 ADR에 없는 새 요구사항의 근거로 쓰지 않는 규칙 → ADR의 결정이나 계약을 바꾸는 모든 경로가 먼저 모델을 확인하는 지시와 규칙, 연결 없는 기능의 세 가지 판단과 빈 실현 기록, 승인받을 초안에 빠진 준수 계약 제안. 구현 판정과 완료 조건에는 여전히 ADR 계약 행만 쓴다.
- **Why**: 사용자가 코드를 바꾸기 전에 ADR을 확인하듯, ADR을 쓰거나 고치기 전에는 상위 업무 모델을 먼저 확인하도록 하네스를 바꾸라고 요청했다.
- **What is now void**: 업무 맥락을 모순 확인에만 쓰고 승인받을 준수 계약 제안의 근거로도 쓰지 않던 규칙.

## 2026-10-29 — 모델의 해상도를 흐름과 관계로 좁히고 관찰 기준의 경유 관계를 추가

- **Current ADR**: [introduce-business-ontology-level](./0001-introduce-business-ontology-level.md)
- **Change type**: requirement rule change
- **What**: 요소 열 가지·관계 열여섯 가지(업무 상태, 상태 변경, 상태 소속, 허용 전이 포함) → 요소 아홉 가지·관계 열네 가지(업무 상태 관련 요소와 관계 제거, 관찰 기준의 경유 관계 추가). 기능 사이의 상태 의존은 사건, 정책과 둘 이상의 단계에 닿는 업무 규칙으로 표현하고, 업무 규칙과 반응 조건은 관계와 의미만 적는다. 상태 기계·정확한 값·세부 조건은 실현 ADR이 소유한다.
- **Why**: 문서 리뷰가 프로세스 사이 인계마다 관찰 기준을 두는 게이트를 어휘로 판정할 수 없다고 지적했고, 사용자가 상위 레벨은 전체 업무의 흐름과 관계를 설명하고 추론하는 데 집중하고 세부 상태 전이 조건은 다루지 않도록 해상도를 정했다.
- **What is now void**: 모델이 업무 상태와 허용 전이를 소유하던 규칙.

<!-- adr-writer:rules-version 0.10.15 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->

- 2026-11-03: 사건 흐름을 기본 보기로 삼고 3D 컨텍스트 지도를 분리한다. 사건·정책·관련 규칙·범위가 명시된 미정 질문을 함께 읽으며, 원문에 없는 인과나 업무 보장을 만들지 않는다.

- 2026-11-03: 사건 흐름과 업무 구조 두 보기로 정리하고 중복 컨텍스트 지도를 제거한다. 사건의 읽기 순서를 유지한 입체감과 은은한 인과 신호를 제공하며 사건 상세는 업무 구조의 동일 단계로 연결한다.

- 2026-11-03: 사건 흐름의 주 연결을 후속 발생 사건까지 이어지는 추적 보기로 표현한다. 정책·행동·조건은 원문 관계로 확인하고, 사건 없는 단계와 단순 순서를 구별하며 상류·하류 경로를 강조한다.

- **2026-11-10 — current ADR: [문서 기반 업무 모델 구축](./0004-build-ontology-from-documents.md)** — 선택지와 직접 답을 함께 전달하던 방식에서 마지막 입력 방식 하나로 답하도록 바꾸고, 모델 설명은 별도 질의응답으로 현재 작성 에이전트와 주고받는다. 사용자가 선택과 직접 입력이 섞이는 혼란을 없애고 같은 화면에서 질문하기를 요청했다.

- **2026-11-10 — current ADR: [읽기 전용 업무 탐색](./0005-render-read-only-ontology-views.md)** — BC 내부 항목과 별도 전체 보기를 도메인·BC → 업무 프로세스 → 기능 ADR의 공통 계층으로 통합한다. 실제 업무 구조와 기능 실현을 구분하고 이벤트 스토밍·3D가 같은 범위를 드릴다운하도록 하려는 사용자 요청에 따른다.
