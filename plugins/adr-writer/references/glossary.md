# Confirmed terminology

Use this guidance when writing an ADR containing jargon, uncommon terms/acronyms,
or expressions that cannot be written out plainly. The purpose is to preserve
the user's meaning, not to perform DDD or classify domains.

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
