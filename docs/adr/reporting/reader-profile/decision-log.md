# Decision Log: reporting/reader-profile

This document is the **major decision-change history** of the reporting/reader-profile category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

## 2026-11-18 — 리포트에 필요한 전반 선호와 갱신 근거를 기록

- **What** 정기 갱신 제안을 없애고, 주된 직무 추정·관심 범위·설명 순서를 전반 항목에 추가한다.
- **Why** 리포트에 반영할 선호는 수동 수정이나 지속적인 선호가 드러난 리포트 수정 요청을 근거로 갱신한다.

## 2026-11-18 — 프로필 없이 작성하는 리포트의 기본 수준

프로필 생성·갱신을 거절하거나 응답하지 않으면 배경과 용어 풀이를 포함한 입문 수준으로 작성한다.

## 2026-11-12 — 온톨로지가 없으면 먼저 구축할지 묻고 BC를 추측하지 않음

- **Current ADR**: [calibrate-reports-with-a-reader-profile](./0001-calibrate-reports-with-a-reader-profile.md)
- **Change type**: requirement rule change
- **What**: 비즈니스 온톨로지가 없고 온톨로지 작성 기능을 쓸 수 있으면, 프로필 생성 전에 온톨로지를 먼저 구축해 BC 기준으로 만들지 기능 영역 기준으로 만들지 한 번 묻는다. 나중에 온톨로지가 생기면 BC 기준으로 갱신할지 묻는다.
- **Why**: BC 단위 이해도는 BC 구성이 있어야 기록할 수 있고, ADR 카테고리는 기능 단위라 업무 경계를 대신하지 못한다는 사용자 판단에 따른다.
