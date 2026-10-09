# Rollup candidate contract

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 3. Establish the adopted contract and inspect repository evidence

For each group:

1. Account for **every original ADR body** in the chain using current or valid reusable evidence, so no decision, alternative or diagram is missed.
2. Establish which changes were adopted and what they replaced from the chain,
   existing decision log, verified history, and available user decisions. Never
   select a contract merely because its date or number is highest, its value is
   stricter, or the code already implements it. A difference is a transition to
   harvest only when adoption and replacement scope are established.
3. Use Decision keywords to locate the source, tests, IaC or local configuration
   needed to verify the selected contracts and implementation state. Follow
   connected behavior when a contract requires it, without inventorying unrelated
   features or reconstructing the whole application. Code reveals enforcement
   and drift; it does not decide which requirement or rationale is authoritative.
   Keep verification repository-local and report live state as unverified rather
   than querying deployed systems. Apply Evidence selection and reuse across
   this step and step 5.

Keep **adoption** separate from **completion**. `Proposed` can describe an adopted
but unfinished target or an unadopted proposal. Established adoption permits a
target in the candidate; step 4 rule 0 determines its Status. Unapproved or
uncertain proposals stay out of the current contract; hold that decision and
present the exact choice under step 5 while preparing independent ones.

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
2. **Describe the final state directly**: "consists of ~" rather than "added ~", and "이벤트 이름은 `CURRENT_EVENT`다" rather than "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다." Remove replaced identifiers, previous values, and migration steps from the body and mapping summary when they add no current contract. A rule still governing an existing population or operation is current even if a later rule governs new ones; keep both with their conditions in the survivor. Keep rejected choices in Alternatives, harvest major old → new transitions into `decision-log.md`, and preserve current prohibitions that passed the requirement gate.
3. **Preserve actual Drivers and realistic alternatives**: the consolidated ADR follows the ordinary authoring rules (`authoring-rules.md`) exactly. Keep the current Purpose, all still-valid drivers, and the current adoption rationale together in the survivor, including reasons established before the latest revision. Harvesting history must never leave the current choice explained only in `decision-log.md`. Revive the real alternatives that lived somewhere in the chain. One credible rejected alternative, or the evidenced constraint leaving no other valid path, suffices; missing rationale is a finding, not permission to invent another option.
4. **Keep the important decisions**: state transitions, behavioral rules, entity relationships, integration mechanisms, business logic.
   4-a. **Carry the requirement contract over without loss**: preserve every current **requirement value** (limits, quotas, cycles, retention, caps, targets), **non-numeric requirement** (allowed value sets, transition rules, mandatory fields, ordering, uniqueness, units — `authoring-rules.md` "Non-numeric requirements"), permission rule, and required validation condition from the chain. Keep each value with its applicable population, operation, time window and unit; preserve defaults, exceptions and conversion rules needed to determine the observable outcome. For an adopted replacement, change only the obligation and scope it replaces and harvest that transition. Unresolved conflicts or residual ownership stay out of destructive changesets. Verify the draft with the [regeneration test](../../../templates/adr/authoring-rules.md): with the code deleted, can requirement-honoring code be rebuilt for **every still-applicable scope**, including ones the latest change did not replace?
5. **Preserve Mermaid diagrams**: consolidate or amend the currently valid ones
   and keep them. Preserving an existing ADR diagram does not require a new
   global map or a diagram in every rollup report. Apply the candidate-local
   reporting rule under Questions and continuation.
6. **Exclude implementation detail**: apply the "What to exclude from an ADR" table in `authoring-rules.md` (plus its "exception when it is a requirement" column) and the "code-readthrough test" in `concepts.md` — if items that are obvious from the code and **also not requirements** (function responsibilities, field types, env var names, pseudocode, implementation tuning values, and so on) were mixed into the old ADRs, remove them from the consolidated ADR. **Items that passed the requirement gate are not removal targets** (see 4-a above).
   - Apply the ADR admission gate to the consolidated core subject too. If the chain only records a replaceable library, SDK, framework, credential/auth adapter, or module structure, do not preserve it as a polished ADR; report it as a retirement candidate.
7. **Keep the error-handling strategy**: architecture-level handling such as graceful degradation and fallback stays.

Before overwriting or deleting chain members, retain the original source passages needed for the step 9 harvest. The rewritten survivor is not evidence of what the earlier policy was.

### 5. Code alignment verification (performed by this skill directly)

Finish alignment here using Evidence selection and reuse, without a separate
`adr-sync` call or fresh full-repository discovery pass.

1. Extract the verifiable claims from the consolidated ADR — Status, entity names, fields, state values, API method+path, error codes, enum/type values, cross-system integration mechanisms, the error-handling strategy, and features explicitly used or unused.
2. Match each claim to valid implementation evidence and check results. Obtain additional evidence only for changed, uncovered or mismatching claims, using suitable local tools.
3. **On a mismatch, preserve ownership**:
   - **Known adopted target awaiting implementation** — preserve that target as
     `Proposed`, report the remaining implementation/review work, and do not ask
     the user to decide the same contract again.
   - **Unresolved requirement or gray-zone conflict** — numeric limits, allowed
     sets, transitions, permissions, required fields, ordering, units, public
     compatibility, key design, fallback and adoption rationale remain the ADR's
     authority. Never correct them toward code. Record `[Code re-alignment needed]`
     and collect a ruling: intended change (ADR first) or implementation violation.
     When code is newer, recommend its behavior as a candidate while intent stays
     unconfirmed; established adopted decisions need no repeated question.
   - **Non-requirement implementation fact** — remove stale internal identifiers,
     libraries, SDKs, auth wiring and module layouts instead of synchronizing them.
     Status preserves verified completion under step 4 rule 0; code presence alone
     does not promote an unfinished or unreviewed target.
4. **Verification scope**: architecture-level decisions plus the requirement
   contract, including **non-numeric requirements**. Tuning values and file paths
   that fail the requirement gate stay at code level. For authority details use
   `adr-sync`'s `references/reconciliation-boundary.md`.

**One report with one identified request per unresolved choice.** Include both original claims and
sources, applicable conditions, the recommended resolution and why, the exact
contract change, and its history impact. Hold only the affected decision and
continue independent preparation. Generic approval of file consolidation does
not silently settle a contract conflict. Equivalent wording and non-requirement
identifier cleanup need no new contract decision.
