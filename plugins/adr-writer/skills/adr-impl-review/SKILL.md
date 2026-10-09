---
name: adr-impl-review
description: Review the complete code implementation of an ADR using a risk-selected standard or full path, then generate a domain-scoped standalone HTML Evidence Package that teaches verified behavior and exposes contract gaps, test gaps, and excess scope. Report-only; never edits code or ADRs.
argument-hint: "[adr-path-or-category] [--base <ref>] [--mode standard|full]"
---

# adr-impl-review

> **Review results**: Apply [report-writer](../report-writer/SKILL.md).

Read `docs/adr/glossary.md` only when the selected ADRs need a term definition.
Its absence is normal; preserve it as supporting material, not an indexed ADR.
When this workflow permits ADR writing and a definition needs creation or change,
apply `${CLAUDE_PLUGIN_ROOT}/references/glossary.md` under the existing approval
boundary. Review-only work reports unclear or conflicting meanings without editing.

Quiz generation is strongly recommended, not mandatory. When included, follow
report-writer's [comprehension workflow](../report-writer/references/comprehension.md);
preserve verdicts, native audit fields and PR-specific readiness.

The review establishes the following evidence dependencies; orchestration remains model-selected.

```mermaid
flowchart TD
    ADR["Target ADR"] --> SCOPE["Find complete implementation scope"]
    SCOPE --> CONTEXT["Write Context: intent, contracts, scope"]
    CONTEXT --> HIKE["Review Container/Hill → Component → Code"]
    CHANGE["Implementation change context"] --> RISK{"Protected surface?"}
    HIKE --> RISK
    RISK -->|No| STANDARD["Standard: ledger + sufficiency + targeted tests"]
    RISK -->|Yes or unclear| FULL["Full: necessity + sufficiency + evidence artifacts"]
    STANDARD --> RULING["Validated HTML Evidence Package"]
    FULL --> RULING
```

In full mode, the necessity and sufficiency perspectives are grounded separately and do not see each other's conclusions before synthesis (section 3). They may run in parallel or sequentially. Standard mode runs only the sufficiency perspective defined below. The user's intent and the ADR's regeneration checklist are settled before implementation; this command consumes that baseline and does not reopen it as a routine post-implementation gate.

This is not a mathematical proof of necessity and sufficiency. It is **a disproof-based review that hunts for unnecessary changes and missing behavior from two different perspectives.** A passing test is only evidence that no counterexample was found among the cases actually executed — not a proof of completeness.

> **Language**: this skill and every other harness prompt are written in English. Write the human-facing review report in the language the user explicitly requests or currently uses. If the conversation does not establish a language, use the target ADR's dominant language. Keep stable artifact anchors and technical terms when translation would reduce precision. Any user-facing phrasing below is a guide, not a literal string.

Apply `${CLAUDE_PLUGIN_ROOT}/references/non-invasive-harness.md`: review mode,
required perspectives, evidence, and verdicts are contractual. Subagent count,
named/generic/main-session execution, parallelism, and model selection are chosen
by the current model.

Distinct outputs:

- **Implementation verdict** — whether the code and tests honor the ADR.
- **PR comprehension readiness** — whether the reader can explain the important
  behavior and causal path.

`PASS` never implies comprehension readiness. Quiz passing blocks publishing
only under an explicit user/team gate; authorization and repository checks
remain required. Interactive quizzes require explicit request. The report-stage
artifact contract governs gate application and self-check.

## The abstraction ladder — which level owns each disagreement

Most findings in this review are a disagreement between the ADR and the code, and **every routing call below is really the question "which level owns this fact?"** So hold the principle (`authoring-rules.md` / `concepts.md` "The abstraction ladder") while reading the findings.

PRD, ADR, and code are the same system at three resolutions, and each level exists to be **read alone**. The ADR's question is "why this decision, and what must the result honor?"; the code's is "how is it done?" That split decides every category:

| Disagreement                                          | Level that owns it          | Category                   | Route                                    |
| ----------------------------------------------------- | --------------------------- | -------------------------- | ---------------------------------------- |
| The ADR's contract is not honored in code             | ADR (the contract)          | `Spec violation`           | fix the code                             |
| Names, signatures, wire form, field names differ      | Code (implementation facts) | `Impl-fact mismatch`       | remove ADR detail via sync               |
| The code adds an ADR-worthy behavior no level decided | neither yet                 | `Undecided behavior`       | escalate only if contract choice remains |
| The code implemented a different coherent decision    | contested                   | `Decision changed in code` | escalate, then log it                    |

So the recurring judgment is **not "is the code good?" but "at which resolution does this belong?"** Two guards follow, and they are the same guards `/adr-new` writes under, seen from the other side:

- **Never absorb a contract violation as an implementation fact.** An allowed value set or transition rule differing is `Spec violation` (the ADR owns it); only the identifier name or representation is `Impl-fact mismatch`. Routing a set difference to `/adr-sync` silently rewrites the contract to match whatever the code did.
- **Never treat code that enforces a contract as removable.** Cap checks, transition guards, permission checks, and required-field validation are the code level's job of honoring the ADR level's contract, so "it passes without this" is not evidence.
- **Never promote implementation discretion into `Undecided behavior`.** Before raising extra code to the ADR, apply the ADR admission gate. Replaceable libraries, SDKs, frameworks, middleware, module layouts, credential provider chains, signers, authentication adapters, and tuning choices are expected code-level decisions when contracts and architecture/security boundaries stay unchanged. They are not findings merely because the ADR does not name them.
- **Do not hide material implementation discretion either.** The sufficiency pass records Notable implementation choices once from code outward. Keep only choices that affect runtime behavior, failure handling, operations, cost, or future maintenance, with the selected value or behavior, code evidence, why it fits the ADR intent, and why it matters. Explain intent fit only through the contract and boundaries the choice preserves; never invent historical rationale. Separately inspect externally checkable premises the choice relies on, such as provider guarantees, input provenance, ordering, uniqueness, trust boundaries, or platform behavior. Missing historical rationale or alternatives is not a risk by itself, but an unverified premise whose falsehood could violate safety or the ADR contract is an `Unverified risk`, not an ordinary implementation choice.

A note on scope: `/adr-impl-review` judges the **code** level against the ADR level. Whether the ADR itself is written at the right resolution is `/adr-review`'s question, and the implementation cycle confirms the decision and regeneration checklist before code begins. Never rewrite an ADR from inside this command to make a finding go away.

## Invariant principles

- **Report-only**: never auto-modify code, ADRs, or the mapping. Write only the Markdown/JSON/HTML review artifacts.
- **Independently grounded conclusions**: in full mode, necessity and sufficiency derive conclusions from the original ADR, complete implementation scope, separate change scope, code, tests, and approved baseline without reading each other's results before synthesis. In standard mode, preserve the same grounding for sufficiency. A fixed number or type of agent is not required.
- **The approved ADR is the behavioral spec**: right after implementation, the ADR's admitted decision and requirement contract are authoritative because the implementation cycle confirmed their intent and regeneration checklist before code began. Implementation facts such as API names and actual field names should not be in that spec; when they appear, separate them as `Impl-fact mismatch` and route them for removal. If review finds concrete evidence that the ADR baseline itself is incomplete or contradictory, return it as a blocking contract issue; do not perform a routine confirmation or silently fix the ADR inside impl-review.
- **Evidence over assertion**: every finding includes the applicable basis among an ADR quote, the actual diff or code location, and a reproduction procedure or execution result. Report a conjecture you could not reproduce only as `Unverified risk`. For an assumption risk, state the externally checkable premise, the contract or safety consequence if it is false, and the missing verification; never request or fabricate private chain-of-thought.
- **Escalation is exceptional**: ask for human judgment only when the approved contract must change, premises contradict, a material risk cannot be verified, or the repair would exceed the approved scope. Evidence-backed implementation and test defects are remediation work, not approval questions.

Before planning execution, read `${CLAUDE_PLUGIN_ROOT}/references/subagent-dispatch.md` completely. Choose the smallest available strategy that preserves the selected perspectives and evidence. Record only material isolation limits.

## 1. Fix the target, implementation scope, and change scope

ADR identification follows the same rules as `/adr-impl`.

- If it is a file path, use that ADR.
- If it is a category key, look it up in `docs/adr/.mapping.json`.
- With no argument, show the list of `Accepted` ADRs and take a selection.
- If it is a `Proposed` ADR invoked by `/adr-impl` after implementation, refactoring, and tests, treat it as the selected pre-promotion completion review and do not ask whether it is partial. For any other `Proposed` target, confirm once whether this is a partial-implementation review.

Determine the **change scope** by this priority:

1. A PR / commit range the user supplied, or `--base`.
2. The current staged + unstaged changes.
3. For a clean worktree, the merge-base diff between the current branch and the default branch.

The change scope explains before/after behavior and is the primary input to a
change-focused necessity pass. It is never the ceiling of the implementation review.

Independently build the **complete implementation scope** for the selected ADR:

1. Enumerate `D0` and every `R1..Rn` contract row from the ADR.
2. Extract domain terms, behaviors, states, boundaries, providers, and failure
   results from each row.
3. Search the repository from those terms, open the actual code, and trace
   direct and indirect callers and callees. Check differently named symbols,
   configuration, generated code, and surviving older paths where relevant.
4. Find every related ideal and edge-case test. Cross-check each contract row
   from decision to implementation and from implementation back to its entry
   points.
5. Record the confirmed production files, tests, and call paths as the
   implementation scope. A caller-provided file list is a starting floor, never
   a search limit.

Do not infer scope from the ADR category name or the current diff. If any
contract row or core call path cannot be fully narrowed, record the search
limit, mark the affected coverage `UNVERIFIED`, and return `INCONCLUSIVE` rather
than `PASS`.

If the change scope mixes several implementations and cannot be mapped onto the
ADR, do not guess about the necessity pass — get the base/range confirmed. The
complete implementation scope still comes from the ADR itself. After fixing
both scopes, prepare the following original material.

- The full ADR text and its entry in `.mapping.json`
- The complete implementation file/test inventory and confirmed direct and indirect call paths
- The raw diff and changed-file list as separate change context
- **The seeded rule docs the repo actually holds** — `docs/adr/concepts.md` (the abstraction ladder, the requirement gate, the source-of-truth split) and `docs/adr/authoring-rules.md`, falling back to `${CLAUDE_PLUGIN_ROOT}/templates/adr/`. These decide **which level owns a disagreement**, so a reviewer working from remembered defaults can route a contract violation as an implementation fact. A project may have hand-edited or pinned its copy, and if the stamp lags the installed plugin (`rules-doc-stale`) or `concepts.md` is missing because the repo predates the split (`rules-doc-layout-legacy`, in which case that material sits inside `README.md`), **say so in the final report's review limits** — the reviewers judged against those docs, so the reader needs to know which version.
- Whichever project conventions exist among `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md` — note these are the **project's own** conventions file, a different thing from `docs/adr/concepts.md` above
- An executable project test command

Create one review artifact directory using
[review artifact storage](../report-writer/references/review-artifacts.md):
`.adr-review/<timestamp>-adr-impl-review-<adr-slug>-<unique>/` under the reviewed
project, with Git exclusion verified before writing artifacts. Pass its absolute
path to every agent that follows. Record the review start time when this directory
is created. The final artifact records the selected mode and rationale,
elapsed time, per-perspective finding counts, unverified-risk count, and executed test-command count.

### 1.1 Build the Review Hiking route

Read `references/review-hiking.md` completely. Then read
`references/visualization.md` completely. They own Context,
Container/Hill, Component, Code evidence, contract assignment, test selection,
ephemeral state, and perspective isolation. Produce `reviewHike.context` and
`reviewHike.hills` before mode selection. If
`/adr-impl` supplies Implementation Hill boundaries, reuse them when they match
shipping user flows, capabilities, or bounded contexts; adjust only when final
evidence shows a different vertical boundary.

### 1.2 Select the review mode

Use `full` when any of these surfaces changes: requirement values or rules, public API or wire form, schema or persistence, state or transitions, permissions or visibility, security boundaries, external fallback, concurrency, transactions, resource lifetime, or error semantics. Also use `full` when the complete implementation scope spans bounded contexts or broad modules, when the user requests a full review, or whenever classification is unclear.

Use `standard` only for localized implementation or reinforcement of an existing decision that changes none of those protected surfaces. An explicit `--mode standard` never overrides the criteria; upgrade it to `full` and explain why. An explicit `--mode full` is always honored.

Record `reviewMode` and the classification evidence in the artifacts.

### 1.3 Prepare optional explanation input

For broad or high-load reviews, optionally apply the `adr-impl-explainer` role
to the ADR, complete and change scopes, and related tests. Save optional
`explanation.md`; skip it when the report can explain the Hills directly.

The explanation starts with `Context`, then follows each Container/Hill through
Component and Code evidence in
reader-priority order. Apply
`references/review-hiking.md`; do not default to file order.

Later headings name the actual vertical behavior, capability, or bounded
context. Their content remains subject-specific.
Do not stop to show it or ask the user to reconfirm. Never pass it to either
review perspective.

At report composition, use the common report-writer comprehension workflow to
prepare questions from this explanation. Preserve this review's native fields
and readiness rules through `references/artifact-contract.md`; question
selection and staged self-check belong to the common report skill.

## Standard mode

For `standard`, execute this section and then continue at **Report and artifact stage**. The full-mode baseline and perspective sections below do not apply.

1. Build a decision ledger containing every ADR decision and each independently reviewable requirement-contract row, including its implementation-independent observable evidence. The sufficiency pass also extracts Notable implementation choices once from the complete implementation scope.
2. Apply the `adr-impl-sufficiency-reviewer` role to the original material, Hills, and ledger with the smallest suitable execution strategy.
3. Review Hills in reader-priority order; record contract status, implementation evidence, and targeted test results. An unexecuted core path yields `INCONCLUSIVE`.
4. Verify and synthesize findings using section 4's evidence rules. Standard mode has no necessity pass, mandatory separate reporting role, fixed Mermaid quota, or post-implementation spec-fitness gate. The validated HTML report remains required.
5. Continue at **Report and artifact stage** below. In standard mode,
   `reviewMode` is `standard`, `necessityFindingCount` is zero, and `PASS`
   requires every contract-coverage row to be `PROVEN`, all required targeted
   tests passing, no evidence-backed must-fix finding, and no unverified core
   risk.

## Full mode

Sections 2 and 3 apply only to `full`. Section 4's evidence rules serve both modes.

For full mode, read [full review](references/full-review.md) before building the
baseline or deriving either perspective. It owns sections 2–3: the approved
contract baseline, independent necessity and sufficiency, exact numeric and
non-numeric comparison, premise verification and targeted tests. Keep the
perspectives separately grounded; neither sees the explanation or the other's
conclusions before synthesis. Return here for section 4.

## 4. Evidence verification and synthesis

Both modes read [evidence synthesis](references/evidence-synthesis.md) after
collecting their evidence. It owns deduplication, contradictions, exact coverage
and implementation-choice fields, action cards, and verdict selection. Missing
core evidence is `INCONCLUSIVE`, never `PASS`; unverified contract/safety premises
remain risks. Normalize every contract row and preserve original evidence.

## Report and artifact stage

Only after evidence synthesis and verdict selection, read
`references/artifact-contract.md` completely and follow it exactly. It owns the
common standard/full `implementation-review.md`, `findings.json`,
materialization, validation, HTML rendering/opening, completion response, and
optional interactive comprehension behavior. Do not load it during scope
discovery or the independent review perspectives.

At this stage, build the optional related-ADR comparison under that contract;
perform any additional source reads needed to ground it before reporting.

## Finding routing

This command itself remains report-only. Only when findings exist or
`/adr-impl` needs the pre-promotion routing result, read
`references/remediation-routing.md` completely. It owns the
**Auto-remediate in the caller** and escalation routes. Do not load it for a
finding-free standalone review.

## Prohibited

- The explainer must not omit failure paths, state, or concurrency to "look simple."
- Never pass a reviewer the explanation document or the other reviewer's result.
- Never use ASCII or box-drawing diagrams instead of Mermaid in the junior-facing report.
- Never invent components or call relationships in Mermaid that were not confirmed in the actual code.
- Never expose raw Markdown list markers or a supported Mermaid fence as the primary human-facing rendering.
- Never sort the human report by technical category. Group findings as fix, decision, verification, and suggestion tasks, then preserve the report writer's importance order inside each group.
- Never show ruling controls for ordinary evidence-backed remediation or read-only context.
- Never put implementation chronology ahead of Context and the most
  important verified user or operational behavior.
- Never call technical layers, files, modules, reviewer roles, or review
  lifecycle phases Hills.
- Never synthesize the final verdict while a Hill has an unaccounted contract
  row or unexecuted core vertical path.
- Never use generic `Background`, `Intuition`, and `Code walkthrough` headings
  as a mandatory report template.
- Never invent a user reaction, measurement, project outcome, or causal
  relationship that the ADR, code, tests, configuration, or user did not establish.
- Never generate more than five primary comprehension questions or add filler to
  reach five.
- Never generate a free-response comprehension question.
- Never reveal a question's correct option, option feedback, explanation, or
  evidence before the reader selects one option.
- Never add scores, grades, celebration, praise, ability judgments, or
  gamification to self-check feedback.
- Never include a comprehension question, grading criterion, evidence, or answer
  request in the ordinary main-session completion response.
- Never start the interactive comprehension check unless the user explicitly
  requests it.
- Never call the PR comprehension-ready while a prepared question is failed,
  skipped, or unanswered.
- Never state that sufficiency is proven merely because the tests passed.
- Never report an unreproduced conjecture as though it were a confirmed finding.
- Never treat the current diff or a caller-provided file list as the ceiling of the ADR implementation scope.
- Never report either review mode complete without a validated, non-empty `adr-impl-review-report.html`.
- Never finish either review mode without running `adr-impl-review-open.mjs` once and reporting its `OPENED` or `NOT_OPENED` result.
- Never modify product code, ADRs, the mapping, or existing tests during the review.
