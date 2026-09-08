# Current-state reconstruction

Read this file completely in deep mode when an ADR body or mapping summary
contains evolution narration, replaced identifiers or values, migration steps,
comparison carriers, embedded changelog/history text, or duplicated descriptions
from different points in time.

Reconstruct the ADR and its `.mapping.json` summary into direct current-state
assertions. A reader must not derive the result from replaced terms or
intermediate steps. Apply `authoring-rules.md` "Final-state wording".

## Evolution phrasing

Convert chronological narration such as "it was X at first, then changed to Y",
"added Z in v2", "changed to B compared with the previous A", "as of 2024-…",
or "the deprecated …" into an assertion that states only what currently holds.

Before deleting an old stage, classify the transition:

- A major transition replaces the adopted alternative, inverts a Decision
  Driver, changes a requirement value, core algorithm, architecture, or
  behavior. Harvest one line into the category's `decision-log.md`, newest
  first. If the log is absent, create it from `decision-log.template.md`. Link
  only the current ADR; put no old ADR number in the prose.
- A minor evolution rephrases the boundary or corrects an implementation fact.
  Delete it without logging; Git preserves the diff.

## Comparison carriers

Rewrite contrastive transition prose as the final result:

- "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만
  사용한다" becomes "이벤트 이름은 `CURRENT_EVENT`다."
- "타임아웃을 10초에서 30초로 변경한다" becomes "타임아웃은 30초다."

Remove "instead of", "rather than", "no longer", "without mixing", "기존 …
대신", and similar carriers when the earlier term adds no current contract.
Alternatives may retain rejected choices, and `decision-log.md` may retain a
major old → new transition.

## Preserve current prohibitions

Do not strip negative wording that still constrains rebuilt code. "PII never
leaves the region" and "a cancelled order never moves to shipping" are current
requirements, not transition narration.

## Consolidation

- Remove Changelog, History, Revision, and Update paragraphs or sub-headings
  embedded in the ADR body. Supersede/replace information stays as one line in
  Status and Related.
- Merge duplicated or contradictory descriptions into one statement based on
  the authoritative reconciliation branch.
- Rearrange the body into the standard order from `README.md`: Status, Context,
  Decision Drivers, Decision, alternatives, Consequences, Related.
- Preserve adoption rationale, alternatives, domain rules, state transitions,
  fallback, and the complete requirement contract. This is compression, not
  information loss.

When a gray-zone decision or requirement contradicts repository evidence, do
not quietly rewrite it during cleanup. Follow
`references/reconciliation-boundary.md` and leave the contradiction unresolved
until the user rules intended decision change versus implementation violation.
