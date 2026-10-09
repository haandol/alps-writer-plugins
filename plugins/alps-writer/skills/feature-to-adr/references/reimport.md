# Explicit PRD re-import

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

## 5. Explicitly re-import a changed PRD

Do not continuously reconcile PRD and ADR content. Enter this path only when
the user explicitly asks to re-import a changed PRD.

The current ADR set is the target-state authority during comparison. Read all
plausible owning ADRs and compare semantic obligations, not wording:

- requirement values and their basis
- allowed value sets and transitions
- mandatory fields
- permissions and visibility
- ordering, uniqueness, units, and failure guarantees
- NFRs and architecture constraints that discriminate between alternatives
- system/data/security/external boundaries and fallback policy

Classify each difference:

- **Semantic no-op** — wording, order, examples, or explanation changed while
  the obligations and decision remain the same. Do not edit ADR files,
  `.mapping.json`, Status, or decision logs.
- **Existing decision changed / contract changed** — propose an edit-in-place to the ADR that
  already owns the decision identity. The current ADR remains authoritative
  until the user approves the changed contract; then route implementation
  through `/adr-impl <owning-category>`.
- **New durable contract or decision** — run the decision identity check. Update
  an existing owner when one exists; invoke `/adr-new` only for a genuinely new
  decision identity.
- **Source contract removed** — never delete or weaken the ADR automatically.
  Ask whether the removal is an intended contract change.
- **Implementation-only change** — leave it to code and do not mutate an ADR.
- **Unresolved conflict** — block the re-import without changing the current ADR
  authority.

Re-import is idempotent:

> Importing the same PRD against the same ADR state repeatedly must produce no
> ADR, mapping, Status, or decision-log changes.

Do not rewrite an ADR merely to mirror new PRD phrasing. Do not store PRD paths,
section numbers, Feature IDs, semantic fingerprints, approval state, or import
reports in ADR bodies or `.mapping.json`.

This comparison belongs to alps-writer. adr-writer remains standalone and never
reads the PRD itself.
