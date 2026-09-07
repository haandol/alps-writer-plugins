# Decision Log: adr-authoring/decision-presentation

This document is the **major decision-change history** of the adr-authoring/decision-presentation
category. Each ADR body describes only the current state, while the timeline of "what
changed and why" accumulates here, newest first. Git preserves the individual diffs.

## 2026-09-07 — 문체 품질 규칙을 구체적인 패턴 이름으로 설명

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: terminology and review contract
- **What**: 포괄적인 문체 품질 라벨을 제거하고 반복 대조문, 장식용 명칭, 강제 번호 구조, filler bridge와 중복 시각 요소를 직접 이름으로 기록했다.
- **Why**: 작성자와 리뷰어가 추상적인 품질 라벨을 해석하지 않고 수정할 문장 패턴을 바로 식별해야 한다.

## 2026-09-07 — ADR 작성 판단을 정량 quota보다 근거 품질과 모델 재량에 맞춤

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: requirement rule change
- **What**: Drivers 3~5개와 Alternatives 2개를 validity quota가 아닌 권장값으로 바꾸고, 긴·새로운·불확실한 ADR에서는 독립 reviewer를 선택할 수 있게 했다.
- **Why**: filler driver와 strawman alternative를 줄이고, fresh authoring context의 self-check와 필요한 independent read를 위험에 따라 선택해야 한다.

## 2026-09-03 — ADR과 사람용 보고서를 의도·중요도·인과 흐름 중심으로 작성

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: requirement rule change
- **What**: ADR과 Decision Digest가 결정 의도를 먼저 설명하고 중요한 순서와 근거 있는 causal flow를 사용하며 반복 대조문·장식용 명칭·강제 번호 구조·filler bridge·중복 시각 요소를 제거하도록 변경했다. 사람용 리뷰 리포트는 사용자 언어를 우선하고, 언어 신호가 없으면 대상 ADR 또는 리뷰 범위의 주 언어를 사용한다.
- **Why**: 형식적으로 정돈된 나열보다 독자가 현재 결정과 이유를 빠르게 이해하고, 확인되지 않은 story나 과도한 확신을 사실처럼 받아들이지 않아야 한다.

## 2026-08-28 — 문서 리뷰와 동기화 리포트를 주니어 중심으로 시각화

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: requirement rule change
- **What**: 사람용 리포트가 결론·영향·조치·위험을 먼저 보여주고, 복수 참여자·상태·의존·충돌·실패 흐름에는 근거 있는 Mermaid를 포함하도록 변경했다.
- **Why**: 해당 ADR을 처음 보는 주니어 개발자가 상세 규칙과 경로를 재구성하기 전에 검토 결과를 이해하면서도 계약값과 증거를 그대로 추적할 수 있어야 한다.

## 2026-08-17 — ADR 계약을 요구사항별 구현 리뷰 기준선으로 사용

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: architecture
- **What**: Requirement contract를 독립적으로 검토 가능한 행과 구현 독립적인 관찰 기준으로 구성하고, 구현 리뷰가 같은 행을 요구사항별 달성 화면으로 파생하도록 변경했다.
- **Why**: 코드 재생성마다 구현 디테일이 달라도 같은 요구사항을 준수하는지 사람이 낮은 인지부하로 판정할 수 있어야 한다.

## 2026-08-17 — 결정 가정을 기존 ADR 구조에 흡수

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: architecture
- **What**: 별도 Decision premises section과 신뢰도 taxonomy를 제거하고, 대안 선택을 바꾸는 가정만 Context 또는 Decision Driver에 한 줄로 기록한다.
- **Why**: 중요한 가정은 드러내면서 Context와 Drivers를 반복하는 추가 구조와 검토 비용을 없앤다.

## 2026-08-17 — 결정 전제와 구현 재량을 분리해 노출

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: architecture
- **What**: Decision Digest에 근거와 실패 영향을 가진 Decision premises를 추가하고, 코드 수준 구현 재량은 ADR이 아니라 구현 리뷰의 일시적 선택 원장에 남긴다.
- **Why**: AI가 사용자가 명시하지 않은 전제와 기본값을 선택할 때 결론만 보여주면 사용자가 결정의 타당성과 재검토 조건을 판단하기 어렵다.

<!-- adr-writer:rules-version 0.6.7 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
