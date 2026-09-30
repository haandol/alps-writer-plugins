# ADR sync repository hygiene

Read this file completely in deep mode. In quick mode, read it only when `.mapping.json` paths reveal stale `fN` naming, then perform detection and proposal only; never move files in quick mode.

## Category slice integrity

Check whether the category keys in `.mapping.json` follow the DDD domain (bounded context) × feature (vertical slice) principle. Use `structure.md` "Common contexts and subdomains" for the anti-pattern category list, subdomain classification, and cross-cutting conditions.

- **Category key check (both segments)** — if an anti-pattern from `structure.md` "Anti-pattern categories" (technical layer or structural units: `frontend`, `api`, `db`, and so on) appears in either the context folder segment or the feature sub-folder segment (`identity/api`), mark it as drift. Propose realigning to domain and feature units.
- **Slice extractability check** — check whether each ADR's Decision covers one feature's leaf slice, UI → API → Data. If one feature's decisions are scattered across categories, such as `auth-ui` and `auth-api`, propose merging them into one category.
- **Context coherence check (advisory)** — if a feature sub-folder sits under a context that does not own its language, record `[Context mismatch] <category> — the feature diverges from its context's domain language. Consider moving it to the right context` in `Suggestions`. Domain-boundary judgment belongs to the user, so never move folders automatically.
- **subdomainType display (advisory)** — if a context entry has `subdomainType`, show it as a grouping or annotation. Never flag its absence as drift.
- Record anti-pattern keys and slice-dispersion violations under `Fixed` or `Contradictions Resolved`, not `Suggestions`. Context mismatch and a missing subdomainType remain advisory.
- When renaming or merging a category key, repoint every `dependsOn` reference to the new key in the same change unit. Remove an edge if the merge absorbed it into the side it depended on, then confirm no dangling reference remains during mapping hygiene.

## Category bloat

Check whether the ADR count in each feature sub-folder, or directly under a context, has reached the threshold of 15 from `structure.md` "When a context grows — splitting into feature sub-folders". If it has, apply that section's inspect-and-propose procedure. If a context is already divided into feature sub-folders and each holds fewer than 15, do not split even when the total is large.

- Never perform the split automatically. Folder moves affect cross-references, hook lookup keys, and `.mapping.json` paths.
- Record `[Sub-folder split recommended] <category> holds <n> ADRs — candidate sub-features: ...` in `Suggestions`.
- If evolution-chain signals also appear, state that rollup comes first.

Sync does not track PRD changes. Once `/feature-to-adr` completes ownership transfer, the PRD is legacy planning context, decisions are managed at the ADR level, and sync checks only ADR ↔ code consistency. A changed PRD enters the cycle only through an explicit alps-writer re-import.

## Canonical stale Feature-ID naming

Old `/feature-to-adr` output may contain `fN` in a folder or filename, such as `docs/adr/f1/0001-f1-email-signup.md`. The current rule puts the Feature ID nowhere: not in filenames, folders, or the mapping. Detect stale naming and propose the canonical path, but move it only after user confirmation.

Handle these cases separately:

1. **Filename prefix** (`NNNN-fN-title.md` → `NNNN-title.md`) — leave the category key and folder unchanged and remove only the `fN-` fragment. This is not renumbering because `NNNN` is unchanged. Update that ADR's mapping path and Related links. Propose all filename-only cleanups in one batch.
2. **Folder or category key** (`docs/adr/f1/...`) — gather category ADR titles, one-line Decisions, and the mapping's human-readable `feature`. Offer a kebab-case feature key such as `login` or `identity/login`, and have the user confirm whether to use two-segment domain grouping. Sync never invents a domain boundary.

Before moving a folder:

- Check whether the destination directory or mapping key already exists. Do not let `git mv` create three-segment nesting; ask whether this is a merge or needs another name.
- For a two-segment destination whose parent context does not exist, create only that parent before moving.
- Prefer `git mv` for tracked files. If files are untracked or uncommitted and `git mv` fails, ask whether to use a plain move.
- Remove filename `fN-` prefixes in the same approved change.
- Re-key `.mapping.json`, update every `dependsOn` that points to the old key, update ADR paths, and re-run the integrity check.

Before moving, show one table containing old path → new path, the key change, and every `dependsOn` update, then get approval once. If declined, leave all files unchanged and record `[Feature-ID naming] <category> — old fN naming. Canonicalization deferred`.

Record completed cleanup as `[Naming] docs/adr/f1/0001-f1-x.md → docs/adr/identity/login/0001-x.md (key f1→identity/login)`.

## Cross-ADR contradictions

Follow Related links of each corrected ADR and check:

- Conflicting thresholds, error codes, or flow rules.
- An `Accepted` dependent whose authoritative `.mapping.json` prerequisite is still `Proposed`.
- A Related link or Decision that implies a missing `dependsOn`. Do not add an ambiguous edge automatically; record `[dependsOn missing] <category> — Related implies prerequisite <X> but it is absent from dependsOn`.
- A superseding ADR that fails to cover all decisions from the superseded ADR.
- Stale cross-references after category migration.

Apply the shared decision reconciliation reference to resolve known later semantic changes. Record resolved cases under `Contradictions Resolved`; collect unresolved intent, chronology and dependencies in the single question report. After answers, continue the confirmed work automatically.

## Companion documents and invariants

Inspect non-ADR documents on which an ADR depends:

- Verify equivalent schema documents such as `docs/tables/**` and their bidirectional Related links when entity relationships changed.
- Verify companion documents such as `*-data-flow.md` against the code.
- For `decision-log.md`, trust the harness's `decision-log-link-broken` result, then check that current-ADR links resolve, prose embeds no old ADR number, there are no PRD citations, and the log does not duplicate current state or implementation constants.
- Remove code → ADR back-references rather than correcting them.
- Remove ADR → PRD back-references rather than correcting them.

Run the bundled invariant checker instead of recreating its greps:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh
```

It checks:

- **Code → ADR** references across authored tracked and unignored files, excluding generated output and ADR bodies. Hand-written documentation outside `docs/adr/` remains in scope.
- **ADR → PRD** references in numbered ADR bodies, including `*.alps.xml`, `ALPS Section`, numbered section citations, and feature IDs.

Record exact `file:line` locations under `Fixed`. Removing a code → ADR reference edits source outside `docs/adr/`, so summarize the target list and get user approval once before editing. In quick mode or without approval, leave source unchanged and record `[Code→ADR ref] <file:line> — ADR back-reference in code. Removal target (approval required)`. ADR body corrections and deterministic Status transitions do not use this source-edit gate.

## Mapping and index hygiene

`.mapping.json` is the only ADR index. Check:

- Every numbered ADR file on disk appears in `adrs[]` exactly once.
- Every `adrs[]` path resolves.
- Each entry's `status` matches the ADR body.
- Each entry has a `summary`.
- Every `dependsOn` key exists.
- The `dependsOn` graph is acyclic and has no self-edge.

Automatically reflect key renames or merges already performed in this sync. Put ambiguous dependencies or cycles under `Contradictions Resolved` or `Suggestions` and ask for a ruling.
