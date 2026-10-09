# ADR candidate verification

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 6. Verify before saving — the deterministic harness, then your own R1-R20 pass

Verify in two stages just before saving: **the deterministic harness settles the mechanical rules, and the authoring path performs the judgment pass.** Self-check is the default; for a long ADR, new domain, high uncertainty, or an axis the author cannot judge independently, the current model may use an independent reviewer or separately grounded pass.

Reuse the current authoring context for this pass. `/adr-review` remains the
later path for inherited or hand-edited ADRs.

**(a) The deterministic harness — `adr-structure-lint`**:

Set `adr_draft_root` to the absolute draft-root path, `adr_category` to the target
category key, and `CLAUDE_PLUGIN_ROOT` to the absolute plugin path. Run from the
draft root so mapping paths such as `docs/adr/<category>/NNNN-title.md` resolve
against the copied tree:

```bash
(
  cd "$adr_draft_root" || exit 1
  node "${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs" --adr-dir docs/adr --documents-only "$adr_category"
)
```

`--adr-dir` selects the document root; it does not change the working directory
used for mapping paths. Passing only an absolute draft ADR directory from the
live repository root would make the mapping and disk paths disagree.

This candidate run mechanically verifies the following (grounded in `authoring-rules.md`, `concepts.md`, and `structure.md`):

- The Status enum and date format (the first half of R1), presence of the required sections (Status/Purpose/Decision/Consequences), canonical filename (`NNNN-kebab.md`, no stale `fN-` prefix), title number = filename number, path depth ≤ 2 segments
- Anti-pattern category segments (the first half of R5), advisory Driver/alternative count warnings (R13/R14), Related links resolving (R10), whether a value is written in code-constant form (R18's format half — the `value-as-constant` warning)
- The `.mapping.json` schema and `dependsOn` integrity (dangling / self-edge / cycles — R16), mapping↔disk consistency (R8), plus the mapping `adrs` record shape (path/status/summary) and status↔body agreement
- `--documents-only` retains ADR→PRD back-reference checks (R17) and skips the code scan
- Seeded-doc health, reported once for the directory rather than per ADR: version lag (`rules-doc-stale` / `rules-doc-unstamped`) and layout lag (`rules-doc-layout-legacy` / `rules-doc-layout-duplicated`) — all four route back to step 1, which owns the seeding and the refresh question

For the code→ADR check (R15), run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh" --adr-dir docs/adr --code-only` from the live repository root. This is read-only; reuse a current baseline result when the relevant source and scan configuration have not changed. A candidate-only document pass does not prove a repository code scan passed.

Fix candidate errors before step 7 by editing only the draft body, mapping, or related candidates. Distinguish unchanged baseline findings from draft-introduced failures and report unresolved checks; do not silently modify unrelated source or rule documents. Carry warnings (counts, suspected code references, and the like) into (b) and judge their substance. A warning is not an instruction to invent Drivers or Alternatives to fill a quota.

**(b) Your own pass over the judgment rules**: once the harness passes (or leaves only warnings), walk the **ADR review checklist** in `docs/adr/authoring-rules.md` (falling back to `${CLAUDE_PLUGIN_ROOT}/templates/adr/`) over the draft you just wrote. That checklist is the same rule set the reviewer agent applies as R1-R20, so it is the authority here — do not work from memory of it.

Reuse the mechanical checks actually proved for the current candidate and baseline (Status format, required sections, filename, counts, Related links, mapping consistency, and the separately scoped back-reference checks). Resolve advisory warnings semantically and spend the pass on **what the harness structurally cannot see** — it never flags a bare number, judges substance, or reads a sentence:

- **Missing requirement values and non-numeric requirements (R18a)** — is any limit, quota, cycle, retention period, cap, or target implied by Purpose/Drivers/Decision blurred into "appropriately", "is limited", or "a certain period"? Is any allowed value set, mandatory field, permission or visibility rule, ordering or uniqueness constraint, unit, or forbidden transition missing?
- **The regeneration test (R19)** — delete all code, keep only this ADR: could requirement-honoring code be rebuilt, and could each obligation be reviewed through an implementation-independent observable result? Name every contract and review oracle a rebuild would have to honor, and say which are absent.
- **Tuning-value intrusion (R18b)** and **implementation-detail creep (R3)** — a value a developer may change without violating a requirement, a code snippet, a field-type table, an env var name, pseudocode.
- **The level filters (R4)** in gate-then-filters order — the requirement gate first, and only then the code-readthrough and litmus tests. Applying a filter before the gate is how a requirement gets deleted for being "visible in the code", and it is this skill's most expensive mistake.
- **Gray-zone substance (R12)**, **discriminating Drivers (R13's quality half)**, **strawman alternatives (R14's quality half)**, **vertical-slice cohesion (R5's latter half)**, **one ADR = one decision (R11)**.
- **ADR admission gate (R12)** — does the core subject itself change a durable contract, boundary, provider/model/fallback, key design, or cross-implementation trade-off? If it is only a replaceable implementation means, do not save the ADR.
- **Final-state wording (R3)** — do the body and mapping summary state the current result directly, without carrying replaced identifiers, previous values, or transition narration outside Alternatives and `decision-log.md`? Confirm that removing comparison residue did not remove a current prohibition.
- **Decision identity check (R11/R12)** — did the mapping and plausible ADR bodies reveal an existing owner for this architectural question or boundary? If yes, stop and route to edit-in-place; a new provider name, reversed direction, or changed Driver is not by itself a new decision.
- **Prose style (R20)** — advisory. Apply `reader-first-writing.md`, including
  its mechanical writing patterns, and never accept a cut that drops content.

**Two of these you cannot check as well as a fresh reader, so make them explicit rather than assumed.** The values were in this conversation and the alternatives are yours, so a draft missing a requirement still reads as complete to you, and your own alternatives never look like strawmen. So for **R18a and R19, write the check out** — list the contracts a rebuild must honor and mark each present or absent, instead of concluding "the contract is complete". Anything absent goes back to the user as a question in step 7; **never invent a number to resolve the missing requirement.**

Fix what the pass finds before step 7. If the draft needs splitting, or a DB schema change needs `docs/tables/` updated in the same change, return to step 3. **Report the pass in one line at step 7** ("harness passed; R18a/R19 checked; independent read: used|not needed — run `/adr-review <category>` for a later second opinion").
