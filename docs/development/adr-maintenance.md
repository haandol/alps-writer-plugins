# ADR onboarding and maintenance

Read this guide when the matching task in `AGENTS.md` applies. Paths and commands
refer to the repository root unless a different base is stated.

## Existing-project onboarding and maintenance questions

`adr-import` reads local project evidence, distinguishes repository organization
from execution/deployment shape, and proposes business-context/vertical-feature
ADR contracts through four reviewable views: business workflows/events, context
boundaries, decision candidates, and contract prerequisites. Source discovery
starts from important business outcomes and deepens incrementally. Each
prerequisite edge identifies a required guarantee; interaction timing is not a
dependency. Decision-level graphs remain disposable report evidence and are
checked against the category-level `dependsOn` representation before saving.
On a cycle, `import-cycle-resolution.md` compares three contract-level options:
independent shared concept, one-decision merge, or orientation around an existing
owner. Concrete drafts and ownership changes are prepared before all pending
questions are collected once by domain/bounded context; a cross-context cycle
is reviewed once. Implementation interfaces and renamed links are not substitutes
for resolving decision contracts.
It uses `feature-boundaries.md`, `decision-reconciliation.md` and
`decision-questions.md` from adr-writer's local references. Missing intent and
conflicts are presented together with visible decision IDs; confirmed answers
resume authorized application and validation. New ADRs stay Proposed until the
completion cycle passes; identical re-imports are no-ops. No application refactor,
live-system access, hidden approval registry or code-path mapping is introduced.
Sync and rollup share that question flow, preserving their own mutation limits.

Rollup uses target-centred discovery: selected ADRs, complete candidate chains
and related contracts first, then only the source/tests or farther references
needed for an actual ownership, conflict or reference question. It reuses
unchanged evidence and does not require whole-system event/context maps. Clear
chains use contract tables and summaries; difficult cases may need small local
diagrams. Global mechanical checks, original contract preservation, exact
approval and pre-apply freshness checks remain required.
Rollup leaves tool choice and equivalent local verification methods to the
agent. Command examples are available implementations; evidence, check results
and mandatory approval/history/freshness boundaries determine correctness.
Requested renumbering details live in its conditional skill-local reference.
