---
name: adr-rollup
description: Roll up ADRs so each logical decision lives in exactly one current-state ADR, preserving adopted contracts and checking repository alignment. Default scope is **every category** when no argument is given; an argument narrows to one category or an explicit ADR bundle. Within each category, merge the evolution chain of the same logical decision (refine / supersede / replace) into its lowest-numbered ADR, harvest the chain's major transitions into the category's decision-log.md, and delete the rest — distinct decisions and separate categories stay untouched. Keywords - "adr rollup", "ADR 정리", "ADR 개수 줄이기", "같은 결정 합치기", "evolution chain merge", "Superseded chain 정리".
argument-hint: "[category-or-adr-bundle?]"
disable-model-invocation: true
---

# adr-rollup

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

Read `docs/adr/glossary.md` only when the selected ADRs need a term definition.
Preserve this optional supporting file. For permitted definition edits, apply
`${CLAUDE_PLUGIN_ROOT}/references/glossary.md` under existing approval.
Review-only work reports unclear or conflicting meanings without editing.

The goal is **one logical decision = one current-state ADR.** Consolidate an
evolution chain only when its ADRs record successive answers to the same
architectural question. Preserve the current decision and complete requirement
contract in the survivor, and the evidence-backed major transitions in the
category's `decision-log.md`; Git keeps the individual diffs.

**Reducing the ADR count is not the goal.** Distinct decisions stay separate.
When no evolution chain exists, leave the ADRs unchanged. The rules below own
chain detection, survivor selection, history preservation, and destructive
approval.

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

A merge requires the same architectural question, owned contract boundary, and
applicable scope, plus an established succession of adopted decisions. Explicit
replacement links, shared subjects, and dates help locate candidates; none alone
establishes that every contract in a source was replaced.

**Superseded is a locator, not deletion authority.** A legacy full replacement
can form a chain. A partial replacement or true fork may leave the old and new
decisions independently current. Follow the common decision identity check;
retain separate owners where one current-state ADR cannot hold the result.

Before selecting content, reconcile each original contract as retained,
replaced, retired, or unresolved, with its scope and source evidence. Verify the
owner of every residual contract. Do not delete a source with unresolved
residual ownership. Rules for different populations, operations, or time windows
can coexist; compare conflicts only under the same conditions. Broken replacement
links, cycles, and competing successors hold the affected decision while
independent candidate preparation continues.

**What not to merge** (normal; leave it alone):

- Several decisions in one category (e.g. `auth/` holding 0001 signup, 0002 SSO, 0003 password reset) — these are distinct decisions. The count is not the signal. **The existence of a chain is the signal.**
- ADRs addressing the same feature from different aspects (e.g. "payment flow" + "refund policy") — when the decision topics differ, keep them separate.
- A single ADR whose Status merely went `Proposed` → `Accepted` — no history was scattered.

When the judgment is ambiguous, do not merge. Staying separate is safer — a wrong consolidation loses decisions.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Workflow

Steps 1–9 prepare and verify a candidate changeset without modifying repository
files. Keep original source passages and draft outputs in a disposable artifact
directory following [review artifact storage](../report-writer/references/review-artifacts.md).
Step 10 obtains approval for the concrete paths and then applies the
changeset. Source deletion is allowed only after its validated history has been
written to the final decision log. Preparation order is not file-write order.

### 1. Load the index and mapping

Use the repository's rule documents when present; otherwise use the matching
`${CLAUDE_PLUGIN_ROOT}/templates/adr/` files. Reuse unchanged material already
loaded in this context, including chain bodies needed in later steps.

- Read `concepts.md` (the abstraction ladder plus the gray-zone model), `docs/adr/authoring-rules.md` (the include/exclude rules), and `docs/adr/structure.md` (category policy).
- Read `docs/adr/.mapping.json` — the single ADR index (categories → adrs[] with path, status, summary) plus `dependsOn`. Since the mapping holds neither code paths nor a PRD reference, find the code needed for alignment verification by reading the ADR's Decision and using `Glob`/`Grep` (`structure.md` "Finding the related code"). If the mapping is absent, infer categories from the `docs/adr/<category>/` directory names on disk and proceed.
- Decide the target categories: with no argument, every `docs/adr/<category>/` on disk.

### 2. Identify chains per category

In each category, read all the ADR bodies, the adrs[] records in `.mapping.json` (summary and status), the `Related` links, and the `Superseded by` links, and group them by "the same logical decision" (the README carries no per-ADR one-line summary — the index lives in the mapping). A category may hold several groups, or none. Skip categories with no group.

On a full-scope run, repeat this for every category, but keep consolidation inside each category.

### 3. Establish the adopted contract and inspect repository evidence

For each group:

1. Read **every ADR body** in the chain — so no important decision, alternative, or diagram is missed.
2. Establish which changes were adopted and what they replaced from the chain,
   existing decision log, verified history, and available user decisions. Never
   select a contract merely because its date or number is highest, its value is
   stricter, or the code already implements it. A difference is a transition to
   harvest only when adoption and replacement scope are established.
3. `Glob`/`Grep` the related code using Decision keywords to check the selected
   contracts and implementation state. Code reveals enforcement and drift; it
   does not decide which requirement or rationale is authoritative. Keep this
   verification repository-local, including source, tests, IaC and local config;
   report live state as unverified rather than querying deployed systems.

`Proposed` does not establish approval: it can contain an adopted but unfinished
target or an unadopted proposal. Include an unfinished target only when its
adoption is established; keep the survivor `Proposed` while any included current
target lacks implementation or completion review. Do not automatically import
unapproved or uncertain proposals into the current contract. Hold that decision
and present the exact choice under step 5; continue preparing independent ones.

Revive gray-zone decisions and requirements from original evidence. Apply the
requirement gate before the code-readthrough test; do not carry ordinary
implementation facts upward merely because code can verify them.

### 4. Prepare the consolidated ADR (current state only)

Take the chain's **lowest-numbered ADR as the survivor** and draft its consolidated
content outside the repository. Record the intended overwrite path in the plan;
apply it only after step 10 approval. Never touch other groups or categories.

**The survivor is the chain's lowest-numbered ADR.** Its path is a storage
choice, not a rule for selecting the authoritative contract. For an established
full replacement from `0001` to `0003`, preserve the adopted current contract in
`0001` and plan removal of `0003` only after residual ownership and history checks.
Keep existing numbers and gaps unless the user requests renumbering (step 7).

```markdown
# ADR NNNN: decision name

Date: <today>

## Status

{preserve verified completion — see rule 0 in step 4}

## Purpose

{why this decision is needed: the affected actor or system, current problem, intended outcome, and supplied scope or priorities that bound future autonomous choices; preserve decision-relevant background and assumptions. Follow authoring-rules.md "Reading order — intent before detail". No evolution narration such as "originally it did X, then changed to Y"}

## Decision Drivers

- {the actual pressures and constraints that discriminate between options; no count quota}

## Decision

{the current architectural choice and the driver explaining why it addresses Purpose's problem; then the behavior and complete requirement contract. No chronological listing}

### Alternatives

{realistic alternatives and rejection reasons. One credible rejected alternative, or evidence that constraints leave no other valid path, is sufficient. Never invent an option for its count}

## Consequences

### Positive

### Negative

### Risks

## Related

{only links to currently valid ADRs and documents — keep links to other logical-decision ADRs in the same category}
```

**Rules**:

0. **Status preserves verified completion rather than re-inferring it**: keep the consolidation target `Accepted` only when every decision included in it came from already-`Accepted` ADRs and still exists in the current code and tests (a historical Superseded marker alone does not erase verified completion). If any included decision was `Proposed`, lacks implementation, or needs a new completion judgment, leave the consolidated ADR as `Proposed` and let `/adr-impl` run the tests and final implementation review before promotion — do not ask the user to hand-set Status.
1. **Seamless merge**: describe the current decision directly without rollup labels. Never mark `(Roll-up)` in a filename, title, or README link. **Never create an Evolution History section in the ADR body** — the body describes only the current state. The rationale behind the major transitions the chain carried is not discarded: it is harvested into `decision-log.md` in step 9, and Git preserves the individual diffs.
2. **Describe the final state directly**: "consists of ~" rather than "added ~", and "이벤트 이름은 `CURRENT_EVENT`다" rather than "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다." Remove replaced identifiers, previous values, and migration steps from the body and mapping summary when they add no current contract. Keep rejected choices in Alternatives, harvest major old → new transitions into `decision-log.md`, and preserve current prohibitions that passed the requirement gate.
3. **Preserve actual Drivers and realistic alternatives**: the consolidated ADR follows the ordinary authoring rules (`authoring-rules.md`) exactly. Keep the current Purpose, all still-valid drivers, and the current adoption rationale together in the survivor, including reasons established before the latest revision. Harvesting history must never leave the current choice explained only in `decision-log.md`. Revive the real alternatives that lived somewhere in the chain. One credible rejected alternative, or the evidenced constraint leaving no other valid path, suffices; missing rationale is a finding, not permission to invent another option.
4. **Keep the important decisions**: state transitions, behavioral rules, entity relationships, integration mechanisms, business logic.
   4-a. **Carry the requirement contract over without loss**: every **requirement value** (limits, quotas, cycles, retention, caps, targets), **non-numeric requirement** (allowed value sets, transition rules, mandatory fields, ordering, uniqueness, units — `authoring-rules.md` "Non-numeric requirements"), permission rule, and required validation condition that lived in any ADR of the chain moves into the consolidated ADR **without a single omission.** If a value was replaced by an adopted change, write the currently adopted value for that scope and harvest the supported transition. Retire only demonstrably replaced contracts; unresolved conflicts stay out of destructive changesets. Consolidation is compression, not requirement loss — after writing the consolidated ADR, verify it once with the [regeneration test](../../templates/adr/authoring-rules.md) ("with the code deleted, can requirement-honoring code be rebuilt from this ADR alone?").
5. **Preserve Mermaid diagrams**: consolidate or amend the currently valid ones and keep them.
6. **Exclude implementation detail**: apply the "What to exclude from an ADR" table in `authoring-rules.md` (plus its "exception when it is a requirement" column) and the "code-readthrough test" in `concepts.md` — if items that are obvious from the code and **also not requirements** (function responsibilities, field types, env var names, pseudocode, implementation tuning values, and so on) were mixed into the old ADRs, remove them from the consolidated ADR. **Items that passed the requirement gate are not removal targets** (see 4-a above).
   - Apply the ADR admission gate to the consolidated core subject too. If the chain only records a replaceable library, SDK, framework, credential/auth adapter, or module structure, do not preserve it as a polished ADR; report it as a retirement candidate.
7. **Keep the error-handling strategy**: architecture-level handling such as graceful degradation and fallback stays.

Before overwriting or deleting chain members, retain the original source passages needed for the step 9 harvest. The rewritten survivor is not evidence of what the earlier policy was.

### 5. Code alignment verification (performed by this skill directly)

Compare the consolidated ADR against the code and align it one last time — finish here, with no separate `adr-sync` call. For the grep strategy details see `adr-sync` Pass 2.

1. Extract the verifiable claims from the consolidated ADR — Status, entity names, fields, state values, API method+path, error codes, enum/type values, cross-system integration mechanisms, the error-handling strategy, and features explicitly used or unused.
2. Verify each claim by grepping the related code found via the ADR Decision's keywords.
3. **On a mismatch, preserve ownership**:
   - **Known adopted target awaiting implementation** — preserve that target as
     `Proposed`, report the remaining implementation/review work, and do not ask
     the user to decide the same contract again.
   - **Unresolved requirement or gray-zone conflict** — numeric limits, allowed
     sets, transitions, permissions, required fields, ordering, units, public
     compatibility, key design, fallback and adoption rationale remain the ADR's
     authority. Never correct them toward code. Record `[Code re-alignment needed]`
     and request a ruling: intended change (ADR first) or implementation violation.
   - **Non-requirement implementation fact** — remove stale internal identifiers,
     libraries, SDKs, auth wiring and module layouts instead of synchronizing them.
     Status preserves verified completion under step 4 rule 0; code presence alone
     does not promote an unfinished or unreviewed target.
4. **Verification scope**: architecture-level decisions plus the requirement
   contract, including **non-numeric requirements**. Tuning values and file paths
   that fail the requirement gate stay at code level. For authority details use
   `adr-sync`'s `references/reconciliation-boundary.md`.

**One decision request per unresolved choice.** Include both original claims and
sources, applicable conditions, the recommended resolution and why, the exact
contract change, and its history impact. Hold only the affected decision and
continue independent preparation. Generic approval of file consolidation does
not silently settle a contract conflict. Equivalent wording and non-requirement
identifier cleanup need no new contract decision.

### 6. Plan removal of the rest of the chain

List the higher-numbered chain members to remove instead of leaving Deprecated
stubs. Keep them untouched during preparation. Step 9 derives the log candidate
from their original passages; the approved apply phase writes that validated log
before deleting any source member. Keep any resulting number gaps unless step 7 was explicitly requested.

**Never delete an ADR that addresses a different logical decision**, even within the same category. Deletion is always per group.

### 7. Optional number cleanup (only on user request)

**Preserve existing numbers and gaps by default.** A `numbering-gap` warning is
advisory, not a reason to propose or perform renumbering. If the user already
chose to keep gaps, do not ask again for the same gaps.

Only when the user requests number cleanup, prepare all old → new paths and
explain external-link breakage. Keep relative order within the approved leaf
category and include independent ADRs affected by a rename in the explicit
scope. Renumber only categories participating in this rollup; other categories
remain untouched. Use `git mv` where applicable and update each title number,
index entry, Related link, and decision-log current-ADR link together. Detect
occupied destinations and source changes before applying; do not overwrite a
file merely to obtain consecutive numbers. Plan moves without destination
collisions, using temporary names within the approved scope when necessary.

**Default when the user does not respond or the answer is unclear: leave the gap.**
Include every old → new path in step 10. Generic rollup approval that omits these
paths does not authorize renumbering. No reply is not approval to apply any other
unapproved destructive action either.

### 8. Prepare mapping and cross-reference updates

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

### 10. User confirmation (always, before any destructive change)

**Always get the user's approval before overwriting or deleting any file — no exceptions.** A superseded-chain merge in particular entails (a) overwriting the survivor file, (b) deleting the remaining chain members, and (c) any separately requested renames, so present the summary below and perform the writes and deletions of steps 4, 6, 7, 8, and 9 only after explicit approval. Before approval, show the plan and candidate content; do not modify repository files. On a full-scope run, report grouped by category, and if the user approves only some categories, apply it to those alone.

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
validation and a check for obsolete full filenames; do not rerun the pre-write
number-token locator against renumbered files. A failed locator or validator is
unverified work, never a clean result.

## Notes

- Roll-up is **information compression, not information loss.** Never omit an important decision — the consolidated ADR (current state) plus `decision-log.md` (the major-transition history) together preserve the chain's decisions.
- When in doubt, do not merge. Staying separate is safe.
- The code is authoritative for Status and code-level facts, but code-level facts usually leave the ADR instead of being mirrored there. Apply the ADR admission gate before carrying anything from code into the consolidated document. **Gray-zone decisions and requirements remain the ADR's authority.** When code contradicts such a decision, branch into "decision change vs violation" as in step 5 item 3.

### External impact of a renumber (be aware of this when applying step 7)

The step 7 renumber corrects every reference inside the repo in step 8, but effects remain outside the repo and in history tools. These are trade-offs rather than losses, so proceed with them in mind:

- **External links break**: URLs in PRs, issues, wikis, and bookmarks that pointed at the old path (`docs/adr/<cat>/0004-...md`) return 404 after the renumber (GitHub gives no redirect for a file rename). If you renumber a frequently cited ADR, leave an "old path → new path" table in the step 10 report so the user can update external references.
- **Reading git blame**: line history follows because the move used `git mv`, but immediately after the renumber commit, `git blame` may attribute every line to that commit's rename. To see the real decision-change history, use `git log --follow` (which skips renames) or `git show` on the rollup commit.
- Keeping gaps avoids these path changes and is the default. Only prepare the
  number-cleanup option when the user requests it.
