# Decision Log: adr-authoring/project-import

This document is the **major decision-change history** of the adr-authoring/project-import category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

The current Purpose, all still-valid Decision Drivers, adopted choice, rationale,
and requirement contract remain together in the ADR body. Reading this log is
optional for understanding the current decision.

<!-- Rules:
  - Reverse order (newest first). Major changes only — replacing the adopted alternative,
    inverting a Driver, a core algorithm/architecture change, a bug fix that changes
    behavior, a requirement value change, a requirement rule change (allowed set added or
    removed, mandatory → optional, a permission change, a forbidden transition allowed),
    a supersede, and retirement with no replacement.
    Minor items (correcting implementation facts, renaming an enum identifier, refining
    boundary wording, rephrasing) are not recorded — Git preserves them. For the criteria
    see authoring-rules.md "What to log — minor vs major".
  - Never duplicate the current state (that is the ADR body's job) — the currently valid
    requirements live in the ADR body, so do not copy them here. No implementation
    constants or field tables. But for a transition where a requirement value or rule
    changed, write it on the "What" line as old → new (that is the content of the transition).
    This log and the ADR's Alternatives section are the only places where a replaced
    identifier or previous value should be named for comparison.
    A reason that explains this transition and still supports the current choice
    also belongs in the ADR's current Purpose, Drivers, or adoption rationale.
    Do not remove it from the body merely because it appears on this log's "Why" line.
  - Never reference the PRD (ALPS).
  - Never embed an ADR number in the prose — point at it only through the single
    "Current ADR" link.
  - This file is a convention file — it is not registered in .mapping.json and
    adr-structure-lint does not check it (it is not enumerated as an ADR because it does
    not start with NNNN-).
  - Replace the example entry below with real content when recording the first major transition. -->

## 2026-10-01 — 순환 정리 세 옵션과 도메인별 일괄 판단

- **Current ADR**: [import-existing-project-decisions](./0001-import-existing-project-decisions.md)
- **Change type**: requirement rule change
- **What**: 순환의 보류·소유권 질문 → 공통 추상 개념 도입, ADR 통합, 한쪽 기준 정리의 구체안을 비교하고 도메인별로 모아 한 번에 확인한다.
- **Why**: 개발자가 계약 소유권의 실제 변경을 비교하고 결정할 수 있어야 하며, 링크 이름 변경이나 반복 질문으로 순환 정리를 대신하지 않도록 하기 위해서다.

## 2026-10-01 — 업무 맵에서 결정과 선행 계약을 검토하는 네 단계 도입

- **Current ADR**: [import-existing-project-decisions](./0001-import-existing-project-decisions.md)
- **Change type**: requirement rule change
- **What**: 기능과 계약 후보 중심의 조사 → 업무 흐름 복원·경계 검토·결정 추출·선행 관계 확인의 검토 결과를 제공한다.
- **Why**: 큰 프로젝트에서 사건과 규칙의 근거로 업무 경계를 찾고, 실행 중 상호작용을 계약 의존성으로 오인하지 않도록 하기 위해서다.

<!-- adr-writer:rules-version 0.9.1 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
