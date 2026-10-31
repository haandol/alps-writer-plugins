# Confirmed terminology

Use this guidance when writing an ADR containing jargon, uncommon terms/acronyms,
or expressions that cannot be written out plainly. When a current reference level
exists (below), also use it for every business term the ADR defines or relies on.
The purpose is to preserve the user's meaning, not to perform DDD or classify
domains.

## Read and clarify

Read `docs/adr/glossary.md` if it exists and relevant definitions are needed.
Reuse meanings already supplied by the user or confirmed in the existing
documents. For an unclear term, ask at first use and wait before finalizing
dependent decisions or contracts. An expanded acronym alone is insufficient when
the meaning remains ambiguous. Do not invent a confirmed definition.

## Save only needed definitions

Create `docs/adr/glossary.md` only when there is a qualifying definition to
preserve. Use a Markdown heading and a two-column table: `Term | Meaning in these
documents`. Escape table separators when needed. Do not pre-seed an empty glossary,
populate a general dictionary, or add domain-taxonomy columns.

Show new definitions and changed meanings in the current ADR's approval digest.
Reuse approval already supplied for the same meaning; do not create another
terminology approval stage. Update only confirmed entries after approval.
An equivalent existing entry is a no-op; preserve unrelated terms and the user's
existing Markdown layout. Read the current file before saving rather than
overwriting it with a glossary reconstructed from one ADR.

When a proposed meaning conflicts with an existing definition, show both meanings
and the affected contracts. Ask the user to resolve the conflict before replacing
anything. A change to a requirement's meaning must go through the owning ADR's
contract-change approval; editing the glossary alone cannot change that contract.

## When a current reference level owns business terms

A business term's meaning has one current owner. A current reference level is an
upper level that stays current after handoff and that ADRs follow, such as the
business process model in `docs/process/` (one or more Turtle documents). A PRD
is planning input, not a current reference level.

When that level defines a business term (a business concept or a bounded
context's term), reuse its definition and do not define the term again in the
glossary. Show a new definition or a changed meaning in the ADR approval summary
as that level's change proposal; it is decided only through that level's own
approval path (for ADR Writer's business process model, `/process-edit`).
Approving the ADR does not approve the proposal. While the proposal is unapproved or rejected, do not finalize ADR content
that depends on the meaning:

- Save the dependent contract row with a visible pending marker in the ADR's
  language (for example `미정` or `Pending`) and the awaited business change,
  written in business language without the upper level's file location or
  element identifiers.
- A pending row is not an approved contract and is not implemented. The
  regeneration check and implementation-review coverage show it as pending
  instead of counting it as an approved contract. Unlike an unresolved acceptance
  criterion or assumption, it may remain in an approved revision.
- An ADR with a pending row stays `Proposed`.

Clean up an existing glossary entry for a term the level now owns only through
that level's approval path; ADR authoring never deletes or overwrites it on its
own. ADR Writer reads every glossary heading, list or paragraph entry,
definition-list term and table term column (the first column, and any column whose
header names a term, a name or a language) as an entry, so a heading named exactly
like a business concept or bounded context of the model counts as that term's entry;
name a heading that only groups other terms differently (for example `Payment
terms`). A name in another table column (a context, a category, a related term) may
be other content: ADR Writer asks whether it defines the term, and it stops no save. Without a current reference level, apply only the glossary rules above and
add no proposal, pending row, cleanup output or question.

## Preserve the ADR boundary

Keep short first-use explanations in the ADR body so the decision is readable
alone. Requirement values, states, permissions, ordering, failure guarantees and
success conditions remain in the owning ADR, never only in the glossary.
The glossary holds no source-document paths, upstream section identifiers,
approval state, decision history, or copied implementation inventories.

The glossary is supporting material at the ADR level. It has no ADR number or
Status and is not registered in `.mapping.json`. Implementation and review read
it selectively when they need a term's meaning; its absence is normal. Preserve
it during sync and rollup and do not treat it as an orphan ADR or a decision chain.
