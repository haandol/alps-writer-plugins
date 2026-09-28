# Current-state reconstruction

Read this file completely in deep mode when an ADR body or mapping summary
contains evolution narration, replaced identifiers or values, migration steps,
comparison carriers, embedded changelog/history text, or duplicated descriptions
from different points in time.

Reconstruct the ADR and its `.mapping.json` summary into direct current-state
assertions. A reader must not derive the result from replaced terms or
intermediate steps. Apply `authoring-rules.md` "Final-state wording".

Keep the current Purpose and all currently applicable Decision Drivers beside
the choice and its adoption rationale. Before harvesting a historical reason,
check whether it still explains the current choice. If so, preserve that reason
in the body as a current statement and record its role in the transition in the
log. Reasons established before the latest revision remain in the body while
valid; do not require the reader to reconstruct them from `decision-log.md`.

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
- Rearrange the body into the standard order from `README.md`: Status, Purpose,
  Decision Drivers, Decision, alternatives, Consequences, Related.
- Preserve adoption rationale, alternatives, domain rules, state transitions,
  fallback, and the complete requirement contract. This is compression, not
  information loss.

Read the reconstructed body without the log: does Purpose explain the present
problem, do the Drivers explain what discriminates the choice, and does Decision
state what was chosen and why? Restore any supported current rationale that
cleanup left only in the log. Do not invent a missing driver or infer a historical
reason from the implementation; report the missing evidence when sources do not
establish it.

When a gray-zone decision or requirement contradicts repository evidence, do
not quietly rewrite it during cleanup. Follow
`references/reconciliation-boundary.md` and leave the contradiction unresolved
until the user rules intended decision change versus implementation violation.
