---
name: adr-rollup
description: Roll up ADRs so each logical decision lives in exactly one current-state ADR, aligned to the shipping code. Default scope is **every category** when no argument is given; an argument narrows to one category or an explicit ADR bundle. Within each category, merge the evolution chain of the same logical decision (refine / supersede / replace) into its lowest-numbered ADR, harvest the chain's major transitions into the category's decision-log.md, and delete the rest — distinct decisions and separate categories stay untouched. Keywords - "adr rollup", "ADR 정리", "ADR 개수 줄이기", "같은 결정 합치기", "evolution chain merge", "Superseded chain 정리".
argument-hint: "[category-or-adr-bundle?]"
disable-model-invocation: true
---

# adr-rollup

> **Reports**: Before human-facing reports, apply [report-write](../report-write/SKILL.md).

The goal is **one logical decision = one current-state ADR.** When the same decision is scattered across several ADRs as evolution history (v1 → v2 → v3 — a remnant of the old evolution-chain model), merge that chain into one so only the decision the latest code actually implements remains. There is no reason to hold evolution history spread across several ADRs — reading the single final state should convey the latest code's business and technical decisions. But the **major transitions** the chain carried (replacing the adopted alternative, changing the core algorithm or architecture, inverting a Driver, and the like) are not deleted; they are **harvested** into the category's `decision-log.md` — Git history preserves the individual diffs, but the traceable timeline of "why was this swapped out" stays in the log (`authoring-rules.md` "What to log — minor vs major").

**Reducing the ADR count is not the goal.** The goal is "tidying scattered evolution history into decision units," and a smaller count is merely the consequence. The right number of ADRs is the number of genuinely distinct logical decisions that exist in that category — never cram distinct decisions into one ADR to reduce the count. When there is no chain to merge, merging nothing is the correct outcome.

**The ultimate goal of the ADR structure is "a decision set that reads intuitively and linearly."** The end state rollup aims for is one where (1) each ADR body is **brought up to date with the decision the latest code implements**, (2) the **reference flow between ADRs (`Related`, `dependsOn`, and the direction of absorption into the survivor) is clear**, and (3) even as new ADRs keep accumulating, a reader can **grasp the current state by reading one ADR per decision** without back-tracing evolution history. Leaving a superseded chain in place breaks that goal, because the reader has to follow links to work out "which one is the live decision" — rollup restores that linearity by absorbing the dead members into the survivor.

It does three things at once:

1. **Code alignment without detail promotion**: use code to verify Status and current behavior, but apply the ADR admission gate before carrying any code fact into the consolidated ADR. Replaceable libraries, SDKs, frameworks, credential/auth wiring, internal API names, and module structure are removed rather than synchronized. Gray-zone decisions (adoption rationale, alternatives, domain rules, state transitions, fallback, the intent behind key design) are revived from the chain's ADRs rather than inferred from code. If code contradicts such a decision, follow the branch in step 5 item 3.
2. **Harvesting major history (log)**: move the major transitions the chain carried into the category's `decision-log.md` — the consolidated body describes only the current state, while the timeline of "which transitions brought this decision to where it is" stays in the log, newest first (step 9).
3. **Down to a manageable count (merge)**: merge the chain of one decision into its lowest-numbered ADR and delete the rest, reducing scattered evolution history to a manageable number of ADRs.

## Scope

- **No argument → every ADR**: iterate over every category under `docs/adr/`, find the evolution chains within each, and consolidate. This is the default behavior.
- **The argument is a category** (`adr-rollup auth`): that category only.
- **The argument is an ADR bundle** (the user says "merge auth/0001, 0002, 0003"): that bundle only.

**Consolidation always happens within a single category (the leaf — a feature sub-folder or a single-feature context).** Category classification is per vertical slice (feature) and is the trust foundation `.mapping.json` and the hook depend on, so never merge across a category boundary even when the decisions look like the same logical decision — in particular, **never merge ADRs from different feature sub-folders (`identity/login` and `identity/signup`) merely because they share a bounded context.** A cross-cutting ADR directly under a context (`identity/0001-...`) also merges its chain only in place. If you suspect the category itself is split incorrectly, do not consolidate — report it under `Suggestions` (re-classification follows the `adr-sync` / `structure.md` procedure).

## What to merge and what to leave

The roll-up target is **"the evolution chain of one decision"** — the ADRs accumulated chronologically on the same logical decision. Treat it as a chain only when two or more of these hold:

1. One ADR explicitly supersedes / replaces / extends another (its Status is `Superseded by [...]`, or the body says something like "this replaces the decision in 0002").
2. They address the **same aspect** of the same entity, domain model, or system component (key design, lifecycle, API surface, and so on).
3. Over time, the answer to the same question (WHAT/HOW) changed.

**Superseded is the strongest chain signal.** An ADR whose Status carries `Superseded by [...]` or is marked `Superseded` is effectively an explicit declaration that "this decision moved to another ADR," making it the top merge priority — absorb the dead (superseded) member into the live decision and delete it, so readers do not back-trace to the live decision through a dead ADR. That is, rollup is the step that makes this superseded relation real through **body absorption plus file deletion** (never leaving the file in place with only the Status marking). But **which file remains as the survivor** after absorption follows the step 4 rule (the lowest number) — even when the superseding side has the higher number, the survivor is the lower number, and the latest decision content the superseding ADR carried goes into that lower-numbered file.

**What not to merge** (normal; leave it alone):

- Several decisions in one category (e.g. `auth/` holding 0001 signup, 0002 SSO, 0003 password reset) — these are distinct decisions. The count is not the signal. **The existence of a chain is the signal.**
- ADRs addressing the same feature from different aspects (e.g. "payment flow" + "refund policy") — when the decision topics differ, keep them separate.
- A single ADR whose Status merely went `Proposed` → `Accepted` — no history was scattered.

When the judgment is ambiguous, do not merge. Staying separate is safer — a wrong consolidation loses decisions.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Workflow

### 1. Load the index and mapping

- Read `concepts.md` (the abstraction ladder plus the gray-zone model), `docs/adr/authoring-rules.md` (the include/exclude rules), and `docs/adr/structure.md` (category policy).
- Read `docs/adr/.mapping.json` — the single ADR index (categories → adrs[] with path, status, summary) plus `dependsOn`. Since the mapping holds neither code paths nor a PRD reference, find the code needed for alignment verification by reading the ADR's Decision and using `Glob`/`Grep` (`structure.md` "Finding the related code"). If the mapping is absent, infer categories from the `docs/adr/<category>/` directory names on disk and proceed.
- Decide the target categories: with no argument, every `docs/adr/<category>/` on disk.

### 2. Identify chains per category

In each category, read all the ADR bodies, the adrs[] records in `.mapping.json` (summary and status), the `Related` links, and the `Superseded by` links, and group them by "the same logical decision" (the README carries no per-ADR one-line summary — the index lives in the mapping). A category may hold several groups, or none. Skip categories with no group.

On a full-scope run, repeat this for every category, but keep consolidation inside each category.

### 3. Read the whole chain plus the current code (code-first)

For each group:

1. Read **every ADR body** in the chain — so no important decision, alternative, or diagram is missed.
2. `Glob`/`Grep` the related code using keywords from the ADR Decisions to confirm **what the current code actually does.** Identify behavior the old ADRs described that no longer exists in code, decisions present in the code but in none of the ADRs, and values that changed (requirement values, state values, integration mechanisms). If **requirement values are recorded inconsistently within the chain** (old ADR "10 turns" ↔ new ADR "20 turns"), that difference is itself a transition to harvest, so list it before consolidating.

Write the consolidated ADR's **Status and admitted code-verifiable contracts** from these code facts. Do not carry ordinary implementation facts upward merely because code can verify them. Revive the **gray-zone decisions** (adoption rationale, alternatives, domain rules, state transitions, fallback, the intent behind key design) from the chain's ADRs, and if code contradicts them, branch per step 5 item 3.

### 4. Write the consolidated ADR (current state only)

Take the chain's **lowest-numbered ADR as the survivor** and overwrite that file with the consolidated content. Never touch other groups or other categories.

**The survivor is always the chain's lowest number — not the superseding ADR.** In a superseded chain (e.g. `0001` superseded by `0003`), the "live decision" is the latest, `0003`, but its **content** is absorbed into the lowest-numbered file `0001` and `0003` (plus any intermediate members) is deleted. The reason is rollup's "leave no trace" philosophy — keeping the low number and closing the gaps via the step 7 renumber makes the category's numbers form a straight `0001, 0002, ...` line, so readers never have to work out "which number is live" even as new ADRs accumulate. Fill the survivor file's decision with the latest state the superseding ADR carried (code-first) — that is, **the file number is the lowest, the content the newest.**

```markdown
# ADR NNNN: decision name

Date: <today>

## Status

{per the current code state — see rule 0 in step 4}

## Context

{the problem as defined from the present standpoint. No evolution narration such as "originally it did X, then changed to Y"}

## Decision Drivers

- {3-5 pressures and constraints that discriminate between options. No listing of generic quality attributes}

## Decision

{the system behaves this way today. No chronological listing}

### Alternatives

{≥2 alternatives that matter for understanding the current decision. Describe abandoned approaches as "why they were not adopted"}

## Consequences

### Positive

### Negative

### Risks

## Related

{only links to currently valid ADRs and documents — keep links to other logical-decision ADRs in the same category}
```

**Rules**:

0. **Status preserves verified completion rather than re-inferring it**: keep the consolidation target `Accepted` only when every decision included in it came from already-`Accepted` ADRs and still exists in the current code and tests. If any included decision was `Proposed`, lacks implementation, or needs a new completion judgment, leave the consolidated ADR as `Proposed` and let `/adr-impl` run the tests and final implementation review before promotion — do not ask the user to hand-set Status.
1. **Seamless merge**: leave no trace of the rollup in the result. Never mark `(Roll-up)` in a filename, title, or README link. **Never create an Evolution History section in the ADR body** — the body describes only the current state. The rationale behind the major transitions the chain carried is not discarded: it is harvested into `decision-log.md` in step 9, and Git preserves the individual diffs.
2. **Describe the final state directly**: "consists of ~" rather than "added ~", and "이벤트 이름은 `CURRENT_EVENT`다" rather than "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다." Remove replaced identifiers, previous values, and migration steps from the body and mapping summary when they add no current contract. Keep rejected choices in Alternatives, harvest major old → new transitions into `decision-log.md`, and preserve current prohibitions that passed the requirement gate.
3. **Keep Decision Drivers and alternatives ≥ 2**: the consolidated ADR follows the ordinary authoring rules (`authoring-rules.md`) exactly. Revive the real alternatives that lived somewhere in the chain.
4. **Keep the important decisions**: state transitions, behavioral rules, entity relationships, integration mechanisms, business logic.
   4-a. **Carry the requirement contract over without loss**: every **requirement value** (limits, quotas, cycles, retention, caps, targets), **non-numeric requirement** (allowed value sets, transition rules, mandatory fields, ordering, uniqueness, units — `authoring-rules.md` "Non-numeric requirements"), permission rule, and required validation condition that lived in any ADR of the chain moves into the consolidated ADR **without a single omission.** If a value changed within the chain, write **the latest value** in the body and leave that transition in `decision-log.md` via the step 9 harvest. Consolidation is compression, not requirement loss — after writing the consolidated ADR, verify it once with the [regeneration test](../../templates/adr/authoring-rules.md) ("with the code deleted, can requirement-honoring code be rebuilt from this ADR alone?").
5. **Preserve Mermaid diagrams**: consolidate or amend the currently valid ones and keep them.
6. **Exclude implementation detail**: apply the "What to exclude from an ADR" table in `authoring-rules.md` (plus its "exception when it is a requirement" column) and the "code-readthrough test" in `concepts.md` — if items that are obvious from the code and **also not requirements** (function responsibilities, field types, env var names, pseudocode, implementation tuning values, and so on) were mixed into the old ADRs, remove them from the consolidated ADR. **Items that passed the requirement gate are not removal targets** (see 4-a above).
   - Apply the ADR admission gate to the consolidated core subject too. If the chain only records a replaceable library, SDK, framework, credential/auth adapter, or module structure, do not preserve it as a polished ADR; report it as a retirement candidate.
7. **Keep the error-handling strategy**: architecture-level handling such as graceful degradation and fallback stays.

Before overwriting or deleting chain members, retain the original source passages needed for the step 9 harvest. The rewritten survivor is not evidence of what the earlier policy was.

### 5. Code alignment verification (performed by this skill directly)

Compare the consolidated ADR against the code and align it one last time — finish here, with no separate `adr-sync` call. For the grep strategy details see `adr-sync` Pass 2.

1. Extract the verifiable claims from the consolidated ADR — Status, entity names, fields, state values, API method+path, error codes, enum/type values, cross-system integration mechanisms, the error-handling strategy, and features explicitly used or unused.
2. Verify each claim by grepping the related code found via the ADR Decision's keywords.
3. **On a mismatch — branch exactly as in `adr-sync` "Scope of the source of truth"** (code owns Status and code-level facts, but code-level facts usually leave the ADR instead of being synchronized; overwriting gray-zone decisions to match code would break the one-way direction):
   - **Status and permitted code-verifiable facts (code is authoritative)** — Status follows the implementation. Remove non-requirement internal API paths, error-code names, enum identifiers/wire representation, field names, libraries, SDKs, credential/auth wiring, and module structure instead of synchronizing them. Correct a fact in place only when it passed the admission/requirement gates, such as a public compatibility contract or architecture-level key design. **A differing enum allowed set or transition rule is a contract mismatch**, so handle it per item 4 below.
   - **Gray-zone decisions (the ADR is authoritative)** — when the adoption rationale, alternatives, domain rules, state transitions, external-dependency fallback, or the _intent_ behind the key design **contradict** the code, do **not** quietly change the consolidated ADR to match. This is a signal that someone skipped the ADR-first cycle and changed the decision — record it in the step 10 report's `[Code re-alignment needed] <category>` bucket and ask the user "was this an intended decision change or a violation?" (on a decision change, update the ADR first; on a violation, the code is what needs correcting). Rollup never rules on its own and overwrites the ADR.
4. **Verification scope**: architecture-level decisions plus **the requirement contract.** Implementation tuning values (connection pools, backoff, cache TTL) and file paths are not verification targets. By contrast, requirement values (max turns, usage quotas, retention, and so on) and **non-numeric requirements** (allowed value sets, transition rules, mandatory fields, permissions, ordering, units) are — when the ADR's and the code's values differ, follow `adr-sync`'s "requirement values (the ADR is authoritative)" branch: never quietly change them toward the code, but record them under `[Code re-alignment needed]` and ask the user.

### 6. Delete the rest of the chain

Delete the higher-numbered ADR files in the chain (do not leave them as Deprecated). Before deletion, the major transitions those files carried are preserved in `decision-log.md` by the step 9 harvest, and the individual diffs remain in Git history. Numbering gaps appear at this point — leave them, and close them all at once in step 7 (number cleanup).

**Never delete an ADR that addresses a different logical decision**, even within the same category. Deletion is always per group.

### 7. Number cleanup (closing gaps — rollup only)

Close the gaps created by the deletions so the category's numbers are contiguous again. **This renumber is a step that exists only in rollup** — split (`structure.md`) and `adr-sync` still follow "keep gaps, never renumber" (those disperse rather than consolidate, so leaving a trace is normal). Rollup follows the "leave no trace of the rollup" philosophy (step 4 rule 1), and a gap is itself a trace, so it is closed here.

**Apply this only to the categories (leaves) where this rollup actually deleted an ADR.** Do not touch categories skipped for lack of a chain, or where no merge happened at all (their existing split gaps are preserved as-is).

Procedure (per category, strictly within one category):

1. Sort the ADR files that **survived** the deletion in ascending order of their current numbers — including both the survivor (the consolidated ADR) and independent ADRs that were never part of a chain.
2. Reassign contiguous numbers so they **increase by 1 from the category's lowest number.** Keep the relative order. Example: if only `0001` (the consolidated ADR), `0004`, and `0005` remain → `0001`, `0002`, `0003`. `0001` is already in place, so `0004 → 0002` and `0005 → 0003`.
3. Rename the files whose numbers change with `git mv` (`git mv docs/adr/<cat>/0004-foo.md docs/adr/<cat>/0002-foo.md`) — leaving the kebab title as-is. Moving via Git is what carries the history along.
4. **Fix the number in the file's own `# ADR NNNN: ...` title header too** — changing only the filename and leaving the body title creates a mismatch.

Repoint the ADRs whose paths changed by the renumber together with the deleted ones, in a single pass, during step 8's cross-reference update.

**The lint reports gaps after the fact.** Running `adr-structure-lint` after the rollup finishes (or after skipping the renumber) flags gaps created by deletions as a `numbering-gap` **warning** (not an error — gaps from split and adr-sync are normal). When you see this warning, **ask the user "this category has a gap (e.g. 0002 missing) — shall I close it with a renumber now, or leave it?"** and decide:

- **Close it** → renumber per procedure 1-4 above and then perform the step 8 repoint (rollup's default philosophy: leave no trace).
- **Leave it** → skip the renumber when there are many external permanent links (see "External impact of a renumber" below) or the user wants the gaps kept. The gaps remain, but `numbering-gap` is only a warning and does not block the lint.

**Default when the user does not respond or the answer is unclear: leave the gap.** Renumber changes paths and may break external links, so execute it only when the approval explicitly includes the old → new paths. Never infer destructive approval from silence.

A path rename is a destructive change that breaks external links. Include every old → new path in the step 10 approval scope; a generic rollup approval that omits those paths does not authorize renumbering.

### 8. Update the mapping index and cross-references (reflecting deletions and the renumber together)

Align every reference in one pass against the **final numbers** after step 7. The ADR index lives in exactly one place, `.mapping.json` (the README carries no ADR list):

- In `docs/adr/.mapping.json`, remove the deleted ADR records from that category's `adrs` array, update the `path` of records changed by the renumber to the new paths, and update the consolidated (survivor) ADR record's `summary` and `status` to match the current decision.
- Change Related links in other ADRs that reference a deleted or renumbered ADR to the final numbers.
- Correct stale ADR citations left in code comments and documents. **Deletions and renumbers repoint in different directions, so pass them to the script with different flags** — a single call can carry both:

  ```bash
  ${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh --rollup-only \
    --removed "<cat>/<deleted-NNNN> ..." \
    --renumbered "<cat>/<old-NNNN>:<cat>/<new-NNNN> ..."
  ```

  - `--removed` (check **(c)**) — the ids of ADRs **deleted** from the chain. The output says "repoint to the consolidated ADR" — move those citations to the **consolidated (survivor) ADR** (since the decision was absorbed there).
  - `--renumbered` (check **(d)**) — `old:new` pairs for the same ADR whose number alone changed. The output says "repoint to its new number" — move those citations to **that ADR's new number** (the decision did not move to another ADR; only the number changed).
  - Passing the two flags separately makes the script print `(c)` and `(d)` distinctly, so "to the consolidated ADR" and "to the new number" repoints are never confused. This grep shares its source of truth with the code→ADR and ADR→PRD checks.
  - **This finder is a pre-repoint target locator, not a post-hoc verification gate.** Because a renumber reuses numbers (0003→0002 and so on), re-running it with the same arguments after finishing the repoint **produces false positives on the newly and correctly placed files** — e.g. `--removed payment/0002` would catch the freshly renumbered new `0002-...md`, and `--renumbered payment/0003:...` the new `0003-...md` (the finder ignores the kebab and matches only the `<cat>/NNNN` number token). The **post-hoc oracle for confirming the repoint is complete is `adr-structure-lint`'s `related-broken` and `decision-log-link-broken` (both must be 0) plus a grep for deleted or old kebab filenames (must be 0)** — `decision-log-link-broken` is the check that confirms the `current ADR` pointer written into the log in step 9 points at the post-renumber path, and since the finder cannot match the log's relative links (`./NNNN-title.md`), this lint is the only automatic confirmation. Use this finder exactly once, before starting the repoint.

### 9. Harvest the major history → decision-log.md (last of all)

Move the **major transitions** the chain carried into the category's `docs/adr/<category>/decision-log.md`. Perform this step **last**, after step 8 — step 8's stale-citation finder (`--removed`/`--renumbered`) is a pre-scan locator that walks the existing tree **before the log is written**, so creating the log first would make the finder produce false positives on the log entries you just wrote (hence the harvest comes after the finder and the repoint).

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

### 10. User confirmation (always, before any destructive change)

**Always get the user's approval before overwriting or deleting any file — no exceptions.** A superseded-chain merge in particular entails (a) overwriting the survivor file, (b) deleting the remaining chain members, and (c) renames from the renumber, so present the summary below and perform the writes and deletions of steps 4, 6, 7, 8, and 9 only after explicit approval. Before approval, show the plan only and do not touch the disk. On a full-scope run, report grouped by category, and if the user approves only some categories, apply it to those alone.

```
## ADR Roll-up results

### <category>

- Consolidated ADR: NNNN-<name>.md (← merged the <same logical decision> chain: 0001, 0002, 0003)
- Core decision: <1-2 sentences, based on the current code>
- Code alignment: <the claims verified and what was corrected to match the code>
- Removed content: <risks already resolved, abandoned approaches, and so on>
- Reflected into decision-log: <how many major transitions were harvested, with a summary — e.g. 1 adopted-alternative replacement, 1 architecture change> (omit if nothing was harvested)
- Number cleanup: <renumbered files, old→new — e.g. 0004→0002, 0005→0003> (omit if nothing changed)

### ADRs in the same category left unconsolidated

- 0002-<independent decision A>.md, 0003-<independent decision B>.md, ...
  (left alone as different logical decisions — though their numbers may have been pulled up by the renumber)

### Code re-alignment needed (a gray-zone decision contradicts the code)

- [Code re-alignment needed] <category> — the consolidated ADR's <decision> diverges from the code. Needs a user ruling: "an intended decision change (update the ADR first)" or "a code violation (correct the code)". (Omit this section if there are none)

### Next step (consolidated ADRs left as Proposed)

- Part of the consolidated ADR is not in the code yet or has no verified completion review, so it stays `Proposed` → continue with `/adr-impl <category>` and it will switch to `Accepted` automatically once the tests and final implementation review pass. (Omit this section if every included decision preserves an existing Accepted state)

### No chain (categories left alone)

- billing, notifications, ...
```

## Notes

- Roll-up is **information compression, not information loss.** Never omit an important decision — the consolidated ADR (current state) plus `decision-log.md` (the major-transition history) together preserve the chain's decisions.
- When in doubt, do not merge. Staying separate is safe.
- The code is authoritative for Status and code-level facts, but code-level facts usually leave the ADR instead of being mirrored there. Apply the ADR admission gate before carrying anything from code into the consolidated document. **Gray-zone decisions and requirements remain the ADR's authority.** When code contradicts such a decision, branch into "decision change vs violation" as in step 5 item 3.

### External impact of a renumber (be aware of this when applying step 7)

The step 7 renumber corrects every reference inside the repo in step 8, but effects remain outside the repo and in history tools. These are trade-offs rather than losses, so proceed with them in mind:

- **External links break**: URLs in PRs, issues, wikis, and bookmarks that pointed at the old path (`docs/adr/<cat>/0004-...md`) return 404 after the renumber (GitHub gives no redirect for a file rename). If you renumber a frequently cited ADR, leave an "old path → new path" table in the step 10 report so the user can update external references.
- **Reading git blame**: line history follows because the move used `git mv`, but immediately after the renumber commit, `git blame` may attribute every line to that commit's rename. To see the real decision-change history, use `git log --follow` (which skips renames) or `git show` on the rollup commit.
- For a category where these two costs are burdensome (e.g. one heavily referenced by permanent external links), you may offer the user the option of skipping the renumber and keeping the gaps — but that returns to split and sync's default behavior (keeping gaps) and trades off against rollup's "leave no trace" philosophy.
