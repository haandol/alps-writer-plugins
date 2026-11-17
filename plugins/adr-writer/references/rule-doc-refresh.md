# Refresh the seeded rule documents

Read this module when the deterministic harness reports that the repository's
seeded rule documents (`README.md`, `concepts.md`, `authoring-rules.md`,
`structure.md` under `docs/adr/`) lag the installed plugin. `/adr-review` runs it
before a sweep, and `/adr-new` before writing a new ADR. It refreshes only those
documents: never an ADR body, `.mapping.json`, a `decision-log.md`, a glossary or
code.

## Why it is a question, not a silent copy

The seeded documents are copied once, when the repository's first ADR is written,
and every reviewer reads the repository's copy as the source of truth. Seeding once
and never again is how a repository keeps the rule set it got on day one while
every rule added upstream stops existing for it — and that axis does not fail
loudly, it goes unjudged. A project may also have **hand-edited** its rules on
purpose (translated them, tightened a rule, added a house convention), and an
overwrite loses that silently.

## Procedure

- **Reconcile the doc layout — `README.md` is the index, `concepts.md` is the working model.** 0.5.0 split them: the abstraction ladder, the gray zone, the dependency model, and Status transitions moved out of `README.md` into `concepts.md`, leaving `README.md` with what an ADR is, the ADR template, and where the index lives. To check existing docs without writes, run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs" --adr-dir docs/adr --documents-only` from the repository root if that check is not already current. This checks the existing baseline, not the future draft. Act on whichever layout warning it reports:
  - **`rules-doc-layout-legacy`** (a `README.md` with no `concepts.md`) — the repo predates the split. Offer to seed `concepts.md` from `${CLAUDE_PLUGIN_ROOT}/templates/adr/` and cut the moved sections out of `README.md`. **Diff before overwriting**: those sections may carry hand-edits (a translation, a tightened rule, a house convention), so carry them into the new `concepts.md` rather than dropping them. If the user declines, continue — every skill and agent falls back to reading those sections out of `README.md`, so the old layout still works.
  - **`rules-doc-layout-duplicated`** (both files exist, but `README.md` still holds sections `concepts.md` now owns) — worse than the un-migrated case, because two copies of one rule can drift apart and no reader can tell which went stale. Confirm `concepts.md` carries any edits made in the `README.md` copy, then offer to delete those sections from `README.md`.
  - Both are warnings, not errors: a lagging layout does not make an ADR wrong. Ask once, and never rewrite the docs without approval.
- **Version lag — offer to refresh.** Each seeded doc carries an `<!-- adr-writer:rules-version X.Y.Z -->` stamp; the harness reports a lag as `rules-doc-stale` (or `rules-doc-unstamped` for a copy predating the stamp). Say which docs lag, from which version to which, and which rules the lag costs, then **ask once** before overwriting. Diff each lagging copy against `${CLAUDE_PLUGIN_ROOT}/templates/adr/`, name what a refresh would drop, and carry intentional hand edits into the new copy. Keep the template's stamp line. If the user declines, continue with the existing docs and say that the lagging rules stay unjudged.

After an approved refresh, run the deterministic harness again so later steps read
the refreshed rules. A refresh changes no ADR: an existing ADR that the new rules
now flag is a finding for review, fixed only through an approved ADR change.
