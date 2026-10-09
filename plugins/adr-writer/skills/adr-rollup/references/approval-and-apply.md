# Rollup approval and apply

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 10. User confirmation (always, before any destructive change)

Prepare the concrete summary below and combine its required approvals with the
remaining intent/conflict questions under `decision-questions.md`. Reuse explicit
approval already covering these exact contracts and paths; otherwise confirm
before overwriting or deleting any file. Apply only the approved categories and
paths, preserving unanswered decisions and concurrent edits. A general rollup
request alone does not approve unshown destructive paths.

```
## ADR Roll-up results

### <category>

- Consolidated ADR: NNNN-<name>.md (← merged the <same logical decision> chain: 0001, 0002, 0003)
- Core decision: <1-2 sentences, based on the adopted contract and its sources>
- Code alignment: <contracts checked, drift held for resolution, and implementation details removed>
- Removed content: <replaced or retired contracts with evidence, and residual ownership checks>
- Reflected into decision-log: <how many major transitions were harvested, with a summary — e.g. 1 adopted-alternative replacement, 1 architecture change> (omit if nothing was harvested)
- Number cleanup: <renumbered files, old→new — e.g. 0004→0002, 0005→0003> (omit if nothing changed)

### ADRs in the same category left unconsolidated

- 0002-<independent decision A>.md, 0003-<independent decision B>.md, ...
  (independent decisions and their paths remain unchanged unless their exact renames were requested and approved)

### Code re-alignment needed (a gray-zone decision contradicts the code)

- [Code re-alignment needed] <category> — the consolidated ADR's <decision> diverges from the code. Needs a user ruling: "an intended decision change (update the ADR first)" or "a code violation (correct the code)". (Omit this section if there are none)

### Next step (consolidated ADRs left as Proposed)

- Part of the consolidated ADR is not in the code yet or has no verified completion review, so it stays `Proposed` → continue with `/adr-impl <category>` and it will switch to `Accepted` automatically once the tests and final implementation review pass. (Omit this section if every included decision preserves an existing Accepted state)

### No chain (categories left alone)

- billing, notifications, ...
```

Immediately before applying the approved changeset, compare the source contents
and destinations against the preparation baseline. Include every file to be
written, removed, renamed or repointed: survivors, absorbed members, mapping,
logs and external-to-category references. Keep hashes or copies only in the
ignored per-run directory; they are disposable checks, never an approval registry.

If a source changed or a destination became occupied, stop the affected change,
preserve the new contents and refresh that candidate. Reuse only approval that
still covers the unchanged contract and exact changeset; present material scope
or contract changes for a new decision. A shared mapping or log change can affect
several groups: reconcile from the current file rather than overwriting unrelated
entries. No broad reset or rollback of other work is permitted.

Apply only the approved changeset, using the recorded pre-write citation targets.
Persist the validated major history before overwriting or deleting its original
source, including the survivor. Then apply the planned survivor, removals,
renames, mapping and link updates in a safe order. If an apply step fails,
preserve remaining sources, report the exact partial state, and repair only
within the approved scope. Before retrying, inspect what actually applied; do not
blindly replay deletions, renames or log additions. Finish with structure/link
validation and a check for obsolete full filenames; do not use pre-write
number-token matches as proof of stale references after renumbering. A failed locator or validator is
unverified work, never a clean result.
