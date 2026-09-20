# Decision Log: reporting/domain-navigation

This document is the **major decision-change history** of the reporting/domain-navigation category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

## 2026-09-20 — 보고서 작성에서 핵심 내용 퀴즈 생성

- **Current ADR**: [domain-first-report-navigation](./0001-domain-first-report-navigation.md)
- **Change type**: requirement rule change
- **What**: 구현 리뷰가 선택적으로 생성하던 이해도 퀴즈 → 공통 보고서 작성이 문서의 핵심 내용에 맞는 중간 난이도 1~5문항을 생성한다.
- **Why**: 보고서 종류와 관계없이 이해도를 높이고 인지부하를 줄이도록 퀴즈 생성 책임을 공통 작성 기능에 둔다.
