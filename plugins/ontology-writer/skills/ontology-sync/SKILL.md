---
name: ontology-sync
description: Review business-model sufficiency and ADR/execution readiness without mutation, or reconcile authorized direct Turtle edits through validation, history and the shared approval/cascade path. Use for ontology completeness reviews or model drift; ADR-to-code drift belongs to adr-sync.
argument-hint: "[process-id?] [completeness/readiness review request?]"
---

# ontology-sync

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

A direct edit is a change the user wrote in the Turtle documents; confirm it the
same way `/ontology-edit` confirms a requested change, without overwriting it.
Without `docs/ontology/*.ttl` there is nothing to sync; say so and stop.

Choose the requested path before loading mutation or history-recovery details.
An alignment difference without a model change belongs to the ADRs or code and
does not by itself change a process Status.

## Read-only completeness or readiness

When the user asks to review completeness/readiness without reconciling changes,
read [workflow readiness](../../references/workflow-readiness.md). Report model
sufficiency, ADR contract readiness and existing execution evidence for the
requested scope, including unchanged processes. Use its existing read-only
commands; there is no new CLI flag.

Do not enter transitions, renewal, save, cascade, history fetching or scenario
execution under this request. Additional information may support the review;
saving it requires an authorized `/ontology-build` or `/ontology-edit` request.

## Reconcile a direct edit

Read [direct-edit reconciliation](references/reconcile.md) completely before
reviewing the change. Follow its validation, history comparisons, meaning
classification and lifecycle handling, then prepare the shared change unit.
Unknown history stays unchecked. Confirmation does not authorize overwriting
newer edits, and a rejected summary leaves the direct edit in place with no ADR
changes. Store no sync or approval record.
