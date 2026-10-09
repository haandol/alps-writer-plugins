# Rollup references and history

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 6. Plan removal of the rest of the chain

List the higher-numbered chain members to remove instead of leaving Deprecated
stubs. Keep them untouched during preparation. Step 9 derives the log candidate
from their original passages; the approved apply phase writes that validated log
before deleting any source member. Keep any resulting number gaps unless step 7 was explicitly requested.

**Never delete an ADR that addresses a different logical decision**, even within the same category. Deletion is always per group.

### 7. Optional number cleanup (only on user request)

Preserve numbers and gaps by default; warnings do not request renumbering.
Do not ask again when the user already chose to keep them.
**Default when the user does not respond or the answer is unclear: leave the gap.**
Only for an explicit
number-cleanup request, read
`${CLAUDE_PLUGIN_ROOT}/skills/adr-rollup/references/renumbering.md` before preparing
moves. Include every old → new path, external-link impact and affected independent
ADR in the same approval; generic rollup approval or silence does not authorize
renumbering. Check source/destination freshness before any approved move.

### 8. Prepare mapping and cross-reference updates

Align every reference in one pass against the **final numbers** after step 7. The ADR index lives in exactly one place, `.mapping.json` (the README carries no ADR list):

- In `docs/adr/.mapping.json`, remove the deleted ADR records from that category's `adrs` array, update the `path` of records changed by the renumber to the new paths, and update the consolidated (survivor) ADR record's `summary` and `status` to match the current decision.
- Change Related links in other ADRs that reference a deleted or renumbered ADR to the final numbers.
- Identify affected citations in the original repository before repointing.
  Keep absorption and renumbering separate: a removed chain member points to
  its survivor; a renamed independent decision points to its own new path.
  The bundled locator is one available implementation:

  ```bash
  ${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh --rollup-only \
    --removed "<cat>/<deleted-NNNN> ..." \
    --renumbered "<cat>/<old-NNNN>:<cat>/<new-NNNN> ..."
  ```

  When using it, preserve the pre-write target results and refresh them if the
  relevant originals change. Its number-token matches are not final validation:
  after renumbering, old numbers may identify valid new occupants. Do not treat
  such matches as stale references. Final evidence must establish zero broken
  Related or decision-log links and no remaining deleted/old full-filename
  citations. `adr-structure-lint` supplies the link checks; suitable searches or
  equivalent local checks can verify stale full filenames. Tool choice does not
  change these required outcomes.

### 9. Prepare and verify the major history → decision-log.md

Prepare the category's `decision-log.md` candidate from the original chain
passages retained in step 3. The step 8 stale-citation locator scans the original
repository before any approved write, so a temporary log candidate cannot create
false positives in that scan. Verify the candidate against original sources now.
During the approved apply phase, persist the validated log before deleting chain
members; verify its links again once all final paths are in place.

**Ground history in original evidence.** Support each `What`, `Why`, and `What is now void` claim with the original chain ADRs, an existing decision log, or verified Git history. Compare the original before/after contracts: an unchanged rule is preserved, not newly adopted or invalidated. A rejected or hypothetical alternative — including one described during consolidation — does not establish a previously adopted policy. Paraphrase recorded reasons without adding unstated causes, pressures, or past assumptions. If evidence is missing, keep the supported transition and report the gap; omit an unsupported optional field instead of inventing a past state or motive. Before finishing, check the final log against those original sources, not against the newly rewritten ADR.

What to record (`authoring-rules.md` "What to log — minor vs major" — major only):

- Replacing the adopted alternative, inverting a Decision Driver, changing the core algorithm or architecture, a core bug fix that changes behavior, the old decision direction a `Superseded` member replaced, and a decision deprecated without a replacement.
- One log entry per transition in the chain. For the date, use when the transition actually happened if you can tell (the old ADR's `Date:`, its Status transition date, the git log); otherwise use today.
- **Do not harvest minor items** — refining boundary wording, rephrasing, and correcting implementation facts do not go in the log (Git preserves them). Do not fill the log with noise. But **a transition where a requirement value changed** (max 20 turns → 30) is not minor and is a harvest target — because the contract the result must honor changed.

The recording criteria are `authoring-rules.md` "What to log — minor vs major", and the format follows the `decision-log.template.md` seed exactly. What rollup must be especially careful about:

- **Never embed an old ADR number in the prose.** Each entry points at the **consolidated (survivor) ADR's final path** (its number after the step 7 renumber) through the single `current ADR` link and nothing else. Writing old numbers (0002, 0003, …) into the body text would make a later rollup's `scan_citation` flag the log as a stale citation.
- If no log exists, start by copying `docs/adr/decision-log.template.md` (or `${CLAUDE_PLUGIN_ROOT}/templates/adr/decision-log.template.md` if absent) to the category folder as `decision-log.md`; if one exists, add the entry at the top (newest first).
- **The gray-zone rationale of the `Superseded` and chain members you delete is preserved by the harvest** — the consolidated ADR (current state) plus the log (transition history) together hold the old decisions, so deletion loses none of them.

The harvest never touches `.mapping.json` (the log is a convention file and is not indexed — `structure.md`).
