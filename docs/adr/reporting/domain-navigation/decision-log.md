# Decision Log: reporting/domain-navigation

This document is the **major decision-change history** of the reporting/domain-navigation category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

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
