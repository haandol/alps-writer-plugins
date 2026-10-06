# Decision Log: reporting/domain-navigation

This document is the **major decision-change history** of the reporting/domain-navigation category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

## 2026-10-06 — 펼친 문서를 기본으로 제공해 인쇄와 배포를 지원

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 하위 설명을 접어 제공하는 기본값 → 본문은 모든 깊이에서 펼치고 상세 근거는 필요한 것만 펼친다. 인쇄에는 본문·그림·필요한 근거와 독자가 펼친 선택적 근거를 포함하고, 인쇄 후 화면 상태를 복원한다. 원본 근거 접근과 정답·보조 Mermaid 원문의 기존 인쇄 제외 규칙은 유지한다.
- **Why**: 보고서를 처음부터 읽거나 출력물로 배포할 때 펼침 조작 없이도 내용이 이어지고, 접힌 상태 때문에 설명이 빠지는 일을 막기 위해서다.

## 2026-10-06 — 알려진 사용자 배경에서 같은 대상의 내부 동작으로 확대

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 도메인별 상세 설명 → 상위에서 관련 사용자 배경에 맞는 익숙한 비유로 세부사항을 감추고, 하위에서 같은 대상의 책임·규칙·예외를 정확히 설명한다. 비유의 대응과 한계를 밝히며, 펼침 조작·같은 수준의 분기·근거 열기를 추상화 수준의 변화와 구분한다. 가장 깊은 세부 절까지 시각화 필요성을 판단하고, 개수 할당 없이 필요한 관계를 충분히 그림으로 설명한다.
- **Why**: 친숙한 출발점에서 실제 동작을 이해하도록 하고, 화면의 중첩이나 디자인 변경만으로 설명이 깊어졌다고 판단하는 문제를 막기 위해서다.

## 2026-10-03 — 이해에 필요한 복잡도로 보고서 생성 범위를 제한

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 짧은 리뷰도 HTML로 생성하는 기본값 → 명시적 보고서 요청을 우선하고, 일반 설명·리뷰는 복잡하면 자동 생성·단순하면 대화·애매하면 한 번 확인한다. 선택된 전문 워크플로의 필수 산출물과 생성한 보고서의 전달·품질 계약은 유지한다.
- **Why**: 짧은 기술 설명까지 파일을 만들고 브라우저를 여는 부담을 줄이면서, 복잡한 내용에는 단계별 설명과 근거 탐색을 자동으로 제공하기 위해서다.

## 2026-09-30 — HTML 생성과 기본 브라우저 열기를 기본 전달로 채택

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 형식 미지정 시 채팅이나 Markdown으로 끝낼 수 있는 전달 → HTML 보고서를 생성·검증한 뒤 기본 브라우저에서 한 번 열고 경로를 제공한다. 명시적인 형식·파일 생성·열기 제한은 우선한다.
- **Why**: 보고서가 만들어져도 사용자가 결과를 직접 찾아야 하는 누락을 방지하고, 같은 요청에 일관된 읽기 경험을 제공하기 위해서다.

## 2026-09-30 — 설명 가지와 읽기 보조 영역을 구분

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 설명·근거·퀴즈의 합산 상한 → 설명 가지에 최대 4개를 적용하고 근거와 퀴즈는 별도 보조 영역으로 제공한다. 배경과 답의 표시를 분리하고 모든 형식에서 설명 뒤에 문항과 근거를 배치한다.
- **Why**: 고정 목차를 늘리지 않고도 상위 판단에서 이유·동작·조건으로 이해를 깊게 하며, 보조 자료 때문에 불필요한 설명 계층을 만들지 않기 위해서다.

## 2026-09-30 — 요청 맥락을 보고서 첫머리에 제공

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 결론과 배경을 자유롭게 배치하는 개요 → 제목 아래에 요청한 작업·대상·확인된 배경·의도를 짧게 정리하고 곧바로 결론과 중요한 한계를 제공한다.
- **Why**: 여러 작업을 병행하는 사용자가 대화 기록으로 돌아가지 않고 보고서의 작성 계기와 당시 목적을 구분할 수 있어야 한다.

## 2026-09-28 — 보고서 기능을 adr-writer에서만 제공

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 두 플러그인의 공통 보고서 스킬·세션 지침 제공 → adr-writer만 보고서 기능을 제공하고 alps-writer의 보고서 의존을 제거한다.
- **Why**: 두 플러그인을 함께 설치할 때 같은 스킬과 지침이 중복 노출되는 문제를 없애고, 리뷰·평가를 담당하는 플러그인에 보고서 책임을 둔다.

## 2026-09-20 — 보고서 작성에서 핵심 내용 퀴즈 생성

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 구현 리뷰가 선택적으로 생성하던 이해도 퀴즈 → 공통 보고서 작성이 문서의 핵심 내용에 맞는 중간 난이도 1~5문항을 생성한다.
- **Why**: 보고서 종류와 관계없이 이해도를 높이고 인지부하를 줄이도록 퀴즈 생성 책임을 공통 작성 기능에 둔다.
