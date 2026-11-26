# Decision Log: alps-authoring/evidence-research

This document is the **major decision-change history** of the alps-authoring/evidence-research category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

The current Purpose, all still-valid Decision Drivers, adopted choice, rationale,
and requirement contract remain together in the ADR body. Reading this log is
optional for understanding the current decision.

## 2026-11-26 — 작성 중 미확인 외부 사실은 해당 승인 digest에서 근거 검토를 제안

- **Current ADR**: [research-evidence-and-review-alps-items](./0001-research-evidence-and-review-alps-items.md)
- **Change type**: requirement rule change
- **What**: 근거 검토는 Full·Lite 완료 뒤에만 안내 → 작성 중 승인 단위가 문서·제공 자료로 확인되지 않은 외부 사실에 기대면 그 단위의 approval digest 미해결 질문에 미확인 근거로 표시하고 그 항목만의 검토를 제안하며, 제안을 받아들이지 않아도 승인 흐름과 완료 뒤 안내는 그대로다.
- **Why**: 미확인 외부 사실 위에서 승인한 뒤 Section을 완료 뒤 검토에서야 고치면 수정 범위가 커진다.

<!-- adr-writer:rules-version 0.17.1 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
