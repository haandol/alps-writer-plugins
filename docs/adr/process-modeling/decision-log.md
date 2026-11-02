# Decision Log: process-modeling

This document is the **major decision-change history** of the process-modeling category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

The current Purpose, all still-valid Decision Drivers, adopted choice, rationale,
and requirement contract remain together in the ADR body. Reading this log is
optional for understanding the current decision.

## 2026-11-02 — 업무 프로세스 모델 레벨을 별도 플러그인 Ontology Writer로 나눔

- **Current ADR**: [introduce-business-process-model-level](./0001-introduce-business-process-model-level.md), [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md), [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md), [build-process-model-from-documents](./0004-build-process-model-from-documents.md), [render-read-only-process-views](./0005-render-read-only-process-views.md)
- **Change type**: architecture
- **What**: ADR Writer가 업무 프로세스 모델 레벨까지 맡던 결정 → 별도 플러그인 Ontology Writer가 어휘, 모델의 작성·검증·저장, 업무 맥락 조회와 그 세션 지침, 변경 승인과 하위 전파, 문서에서 모델 구축과 화면을 맡고, ADR Writer는 ADR과 ADR 색인(실현 기능 기록의 형식 포함)을 맡는다. 모델 변경과 색인 연결은 Ontology Writer가 같은 변경 단위로 쓰고, 영향 ADR이 있는 변경에는 두 플러그인이 함께 있어야 한다. 모델 문서가 있으면 ADR Writer의 세션 지침은 업무 맥락을 Ontology Writer로 확인하고 확인하지 못했으면 그 사실을 밝히라는 한 줄을 더하며, ADR 작업을 막지 않는다.
- **Why**: 모델을 쓰지 않는 사용자도 세션마다 프로세스 모델 스킬 다섯 개의 설명을 싣고 있었고, 그 분량은 나머지 ADR 스킬 설명을 모두 합친 것과 비슷했다. 사용자가 PRD, 업무 모델과 ADR 계층마다 플러그인을 나누기로 정했다(사용자 결정, 2026-11-02).
- **What is now void**: ADR Writer만으로 모델을 작성하고 검증한다는 기준, 소유 플러그인으로 ADR Writer를 채택한 판단.

## 2026-11-01 — 프로세스 화면에 요소 찾기, 관계 이동과 3차원 전경을 더함

- **Current ADR**: [render-read-only-process-views](./0005-render-read-only-process-views.md)
- **Change type**: requirement rule change
- **What**: 전경에서 흐름과 상세로 내려가기만 하던 화면 → 보이는 모든 요소를 이름이나 식별자로 찾고, 바운디드 컨텍스트별로 묶은 목록에서 프로세스의 단계를 흐름 순서로 보며, 요소 상세의 관계를 관계 이름·방향과 함께 따라간다. 전체 업무 전경은 회전·확대할 수 있는 3차원 공간으로도 보이고, 그 공간에는 그림·목록·상세에 없는 정보가 없다.
- **Why**: 실제 프로젝트 문서로 만든 모델(요소 1,194개, 프로세스 78개)에서 프로세스를 따라 내려가는 화면만으로는 원하는 요소에 닿기 어려웠다. 사용자가 요소 탐색을 화면에 넣고 전경을 3차원 공간으로 보여 달라고 정했다(사용자 결정, 2026-11-01).
- **What is now void**: 없음.

## 2026-10-31 — 읽을 수 없는 커밋이 이어진 구간에서 Status가 바뀌었을 수 있는 `Accepted` 프로세스는 미확인으로 보고하고 사용자 확인으로 정리

- **Current ADR**: [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 이 경우를 정하지 않던 규칙 → `Accepted` 프로세스가 마지막으로 `Accepted`가 된 곳까지의 이력에 모델을 읽을 수 없는 커밋이 두 개 이상 이어지고 그 안에서 그 프로세스의 Status가 바뀌었다가 돌아왔을 수 있으면, 프로세스 동기화는 그 프로세스를 미확인으로 보고하고 사용자에게 그 구간에서 업무 구성이 바뀌었는지 묻는다. 바뀌지 않았다고 확인하면 `Accepted` 날짜를 다시 기록하고, 확인하지 않으면 `Proposed`로 표시해 정렬 검토를 받게 한다. 허용 전이와 생명주기 전이 목록, 실패한 정렬 검토의 보고도 이 확인과 표시를 따른다.
- **Why**: 그 구간 안에서 Status가 바뀌었다가 돌아왔을 수 있지만 그때의 업무 구성은 이력으로 볼 수 없다. 그런 프로세스를 모두 업무 구성 변경으로 다뤄 정렬 검토로 보내는 대신, 사용자의 확인으로 정하기로 했다(사용자 결정, 2026-10-31).
- **What is now void**: 없음.

## 2026-10-31 — 용어집 표에서 다른 내용일 수 있는 칸의 이름은 묻고 저장을 막지 않음

- **Current ADR**: [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 용어집 표의 칸마다 헤더로 정의 항목인지 정해 같은 이름이 있으면 정리 전까지 저장을 막던 규칙 → 헤더가 용어·이름·언어를 뜻하는 열(그런 열이 없으면 첫 열)의 이름만 정의 항목으로 보고 정리 전까지 저장을 막는다. 다른 열(정의·설명 열 제외)의 같은 이름은 그 칸이 정의인지 사용자에게 묻고 저장을 막지 않는다.
- **Why**: 헤더만으로는 열이 그 용어의 이름을 담는지 문맥·분류·관계 같은 다른 내용을 담는지 확정할 수 없어, 놓침과 과잉 판정이 번갈아 생겼다. 사용자가 분명한 칸만 막고 나머지는 묻기로 정했다(사용자 결정, 2026-10-31).
- **What is now void**: 모든 표 칸을 헤더 판정만으로 정의 항목인지 정하던 규칙.

## 2026-10-31 — 커밋되지 않은 `Proposed` 위의 같은 날이나 이른 날의 승격은 알리고 커밋 뒤로 미룸

- **Current ADR**: [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md)
- **Change type**: requirement rule change
- **What**: 정렬 검토를 통과하면 언제나 바로 `Accepted (날짜)`가 되던 규칙 → 마지막으로 커밋된 모델이 그 프로세스를 검토 날짜와 같거나 그보다 늦은 날짜의 `Accepted`로 가진 채 그 프로세스를 `Proposed`로 만든 변경이 커밋되지 않았으면, ADR Writer는 승격하지 않았다는 것과 그 이유를 알리고 그 변경이 커밋된 뒤 승격한다.
- **Why**: 승인 기록을 두지 않고 Status를 날짜 단위로 기록하므로, 그대로 승격하면 커밋 뒤 이력이 검토를 거친 승격을 같은 값(동기화 전 직접 편집)이나 이른 날짜로의 손 재기록으로 읽기 때문이다. 같은 날 확인의 한계(2026-10-30)와 같은 근거다(사용자 결정, 2026-10-31).
- **What is now void**: 이 경우에도 통과 직후 Status가 `Accepted (날짜)`가 된다는 기준.

## 2026-10-30 — 현재 `Accepted` 날짜와 같은 날의 확인은 다시 기록하지 않고 알림

- **Current ADR**: [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md), [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 업무 구성을 바꾸지 않는 편집을 확인하면 언제나 그 확인이 다음 비교의 기준이 된다고 하던 규칙 → 확인한 날짜가 그 프로세스의 현재 `Accepted` 날짜와 같으면 Status를 다시 기록하지 않고, ADR Writer가 그 사실과 이유를 알리며, 그 편집은 날짜가 바뀐 뒤의 확인 전까지 동기화 전 직접 편집으로 표시된다. 다시 기록한 `Accepted`는 커밋된 뒤에 비교 기준이 된다.
- **Why**: Status가 날짜 단위이고 별도 승인 기록을 두지 않아, 같은 날의 확인은 저장소 이력에 새 기준을 남길 수 없기 때문이다(사용자 결정, 2026-10-30: 날짜 단위를 유지하고 한계를 명시).
- **What is now void**: 같은 날의 확인도 곧바로 다음 조회와 동기화의 표시를 없앤다는 관찰 기준.

## 2026-10-30 — 업무 구성을 바꾸지 않는 편집의 확인이 `Accepted` 날짜를 다시 기록

- **Current ADR**: [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md), [retrieve-business-context-for-agents](./0002-retrieve-business-context-for-agents.md)
- **Change type**: requirement rule change
- **What**: 미정 범위만의 변경이나 같은 뜻으로 확인한 문구 수정이 `Accepted` 프로세스의 Status를 전혀 바꾸지 않던 규칙 → 승인 저장이나 프로세스 동기화가 그런 편집을 확인하면, 기계 게이트가 유지될 때 확인한 날짜의 `Accepted`로 다시 기록한다(`Accepted`→`Accepted` 날짜 갱신). 조회는 그 이전의 편집을 표시하지 않고, 변경 표시를 판정할 수 없는 범위는 이유와 함께 보이며 ADR 작성과 구현은 그 범위를 동기화 전 직접 편집이 있을 수 있는 것으로 다룬다.
- **Why**: 승인 기록을 두지 않는 상태에서 확인한 비의미 편집이 다음 비교에서 다시 직접 편집으로 표시되고 같은 확인을 매번 다시 묻게 되었기 때문이다(사용자 결정, 2026-10-30).
- **What is now void**: 미정 범위만의 변경과 같은 뜻의 문구 수정이 Status를 바꾸지 않는다는 규칙의 날짜 부분, 이런 편집이 다음 `Accepted`까지 계속 표시되던 동작.

## 2026-10-29 — 준수 계약 배치와 Status 연쇄를 규칙이 닿는 단계와 업무 구성 기준으로 변경

- **Current ADR**: [govern-process-model-lifecycle-and-cascade](./0003-govern-process-model-lifecycle-and-cascade.md)
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

- **Current ADR**: [introduce-business-process-model-level](./0001-introduce-business-process-model-level.md)
- **Change type**: requirement rule change
- **What**: 요소 열 가지·관계 열여섯 가지(업무 상태, 상태 변경, 상태 소속, 허용 전이 포함) → 요소 아홉 가지·관계 열네 가지(업무 상태 관련 요소와 관계 제거, 관찰 기준의 경유 관계 추가). 기능 사이의 상태 의존은 사건, 정책과 둘 이상의 단계에 닿는 업무 규칙으로 표현하고, 업무 규칙과 반응 조건은 관계와 의미만 적는다. 상태 기계·정확한 값·세부 조건은 실현 ADR이 소유한다.
- **Why**: 문서 리뷰가 프로세스 사이 인계마다 관찰 기준을 두는 게이트를 어휘로 판정할 수 없다고 지적했고, 사용자가 상위 레벨은 전체 업무의 흐름과 관계를 설명하고 추론하는 데 집중하고 세부 상태 전이 조건은 다루지 않도록 해상도를 정했다.
- **What is now void**: 모델이 업무 상태와 허용 전이를 소유하던 규칙.

<!-- adr-writer:rules-version 0.10.15 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
