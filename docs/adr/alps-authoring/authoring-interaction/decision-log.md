# Decision Log: alps-authoring/authoring-interaction

This document is the **major decision-change history** of the
alps-authoring/authoring-interaction category. Each ADR body describes only the current
state, while the timeline of "what changed and why" accumulates here, newest first. Git
preserves the individual diffs.

## 2026-09-21 — 대상 용어의 의미 확인과 선택적 마지막 부록 추가

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: 첫 등장 설명 중심 → 미정 용어의 사용자 확인과 Full/Lite 마지막 용어 부록 보존.
- **Why**: 일반 문서의 작성 부담 없이 사용자의 내부 용어가 잘못 해석되는 것을 막기 위해서다.

## 2026-08-26 — Feature 설명에 선택적 Mermaid와 신규 개발자 관점을 추가

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: Section 7 Feature 설명은 신규 주니어 개발자가 이해할 수 있는 용어와 맥락을
  제공하고, 여러 참여자·계층의 흐름은 Mermaid로 시각화하도록 권장하되 다이어그램을 승인·
  저장·완료 조건으로 강제하지 않는다.
- **Why**: 기능을 처음 보는 구현자가 데이터 흐름을 빠르게 이해하면서 단순한 Feature에는
  불필요한 형식 비용과 중복을 만들지 않기 위해서다.

## 2026-08-23 — Full 대화형 작성을 복원하고 Lite가 이를 따르도록 변경

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: Full과 Lite에 질문 없는 완성 초안을 우선하는 inference-first 규칙 적용 → Lite
  도입 직전 Full의 1–2개 집중 질문 기반 작성은 변경하지 않고 Lite가 같은 대화 방식을
  사용하도록 변경.
- **Why**: Lite는 간소화된 템플릿이어야 하며, 공통화를 이유로 기존 Full 작성 경험이나 LLM
  출력 형식을 재설계해서는 안 된다.

## 2026-08-23 — 승인과 저장 문서에서 AI-inferred 레이블 제거

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: AI가 제안한 제품 상수를 `AI-inferred`로 구분하는 방식 → 제안값을 일반 계약
  내용으로 표시하는 방식.
- **Why**: 사용자는 작성 주체가 아니라 값과 규칙 자체를 검토하며, 승인용 메타데이터가 최종
  문서에 남지 않아야 한다.

## 2026-08-22 — 질문 우선 작성에서 inference-first 작성으로 전환

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: 모든 누락 입력을 사용자에게 질문하는 방식 → 사용자 입력, 기존 Section, 논리적
  귀결과 일반적인 도메인 기본값으로 제품 상수를 먼저 추론하고 중요한 불확실성만 질문하는
  방식.
- **Why**: 사용자는 AI가 회수할 수 있는 정보를 반복해서 답하기보다 제품 계약과 관찰 결과를
  실제로 바꾸는 결정에 집중해야 한다.

## 2026-08-18 — 승인 화면을 계약 중심 plain-text digest로 전환

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: 전체 section 원문을 Markdown으로 표시하는 승인 방식 → 계약 정보를 빠짐없이 담은 간결한 plain-text digest를 승인 단위별로 표시하는 방식. Section 7은 각 Feature `7.x`를 독립 승인하고 개별 저장한다.
- **Why**: 렌더링을 보장할 수 없는 대화 환경에서 전체 원문은 읽기 비용이 높고 중요한 요구사항 계약을 찾기 어렵다.

<!-- adr-writer:rules-version 0.7.1 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
