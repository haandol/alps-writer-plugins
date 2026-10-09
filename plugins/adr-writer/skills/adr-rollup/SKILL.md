---
name: adr-rollup
description: Consolidate adopted evolution chains of the same decision within each category, preserving contracts, verified history and approval boundaries. Inspect target ADRs and necessary related evidence; default scope is all categories.
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
Step 2 distinguishes no chain, an unresolved candidate, and an adopted chain;
only a candidate needs the consolidation work that follows.

Original ADRs, history and user decisions establish adoption; local code and
tests verify candidate contracts and implementation state. Leave replaceable
implementation details in code.

## Scope

- **No argument → every ADR**: iterate over every category under `docs/adr/`, find the evolution chains within each, and consolidate. This is the default behavior.
- **The argument is a category** (`adr-rollup auth`): that category only.
- **The argument is an ADR bundle** (the user says "merge auth/0001, 0002, 0003"): that bundle only.

**Consolidation always happens within a single category (the leaf — a feature sub-folder or a single-feature context).** Category classification is per vertical slice (feature) and is the trust foundation `.mapping.json` and the hook depend on, so never merge across a category boundary even when the decisions look like the same logical decision — in particular, **never merge ADRs from different feature sub-folders (`identity/login` and `identity/signup`) merely because they share a bounded context.** A cross-cutting ADR directly under a context (`identity/0001-...`) also merges its chain only in place. If you suspect the category itself is split incorrectly, do not consolidate — report it under `Suggestions` (re-classification follows the `adr-sync` / `structure.md` procedure).

Before choosing current content, read
`${CLAUDE_PLUGIN_ROOT}/references/decision-reconciliation.md`. Prefer the later
recorded or committed semantic change to the same obligation and scope, while
respecting current user intent and established adoption. Raw dates or newer code
alone do not establish a contract or grant destructive permission.

## Evidence selection and reuse

Choose available local tools, batching and exploration order to obtain the
required evidence. Tool names and call counts do not establish correctness.
Use existing validators when suitable; command examples below are available
implementations, not a requirement to use one tool. Equivalent methods must
establish the same checks. Approval before mutation, freshness immediately before
apply, and history before any source overwrite or deletion remain mandatory
ordering boundaries.

Start with the requested ADR scope and index, all original candidate-chain
content and directly related contracts. Follow farther evidence only for an
actual ownership, conflict or reference question. Do not build a whole-system
workflow/context/event map or import the four-view `adr-import` workflow by
default. Global mechanical checks do not authorize unrelated deep exploration.

Reuse complete evidence and verified results while the relevant source,
contract and supporting context remain unchanged. An absent or failed check is
not reusable success. Reinspect changed or uncovered obligations and affected
owners/references; do not repeat unrelated discovery or tests. Preserve valid
evidence for independent candidates. Keep this working context disposable.

Evidence reuse never replaces the step 10 comparison of every affected source
and destination immediately before apply. Necessary freshness reads or content
comparisons are allowed even when semantic evidence is reused. If anything
material changed, refresh that candidate and reconcile its approval scope before
writing; do not overwrite the change using stale evidence.

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

## Questions and continuation

When intent, conflicts or concrete change approval remain unresolved, read
`${CLAUDE_PLUGIN_ROOT}/references/decision-questions.md`. Prepare independent
work first and collect questions by feature in one report. All instructions below
to ask or confirm use that batch, not an interruption per ADR. Reuse confirmed
answers and exact existing approval; after answers, apply the authorized scope
and continue validation automatically. Keep each unresolved choice identifiable.

For clear chains, a contract comparison table and concise change summary are
sufficient. Add a small candidate-local before/after Mermaid only when it helps
judge a cycle, partial replacement, ownership conflict or complex reference
change. ADR count, routine deletion or link repointing alone does not require a
diagram. Do not regenerate a complete dependency map for the report. Group all
remaining questions by domain/bounded context in one report before asking; do
not interrupt after each ADR or category. This presentation rule does not relax
contract coverage, exact destructive scope or any verification below.

## Workflow

Steps 1–9 leave official repository files unchanged. Steps 1–2 determine whether
consolidation has a candidate; steps 3–9 prepare and verify candidate changesets.
Keep original source passages and draft outputs in a disposable artifact
directory following [review artifact storage](../report-writer/references/review-artifacts.md).
Step 10 obtains approval for the concrete paths and then applies the
changeset after a freshness check. Write validated history to the final decision
log before overwriting or deleting its original sources, including the survivor.
Preparation order is not file-write order.

### 1. Load the index and mapping

Use the repository's rule documents when present; otherwise use the matching
`${CLAUDE_PLUGIN_ROOT}/templates/adr/` files. Reuse unchanged material already
loaded in this context, including chain bodies needed in later steps.

- Read `concepts.md` (the abstraction ladder plus the gray-zone model), `docs/adr/authoring-rules.md` (the include/exclude rules), and `docs/adr/structure.md` (category policy).
- Read `docs/adr/.mapping.json` — the single ADR index (categories → adrs[] with path, status, summary) plus `dependsOn`. Since it holds no code paths or PRD reference, use the Decision's meaning to locate relevant implementation evidence with suitable tools (`structure.md` "Finding the related code"). If the index is absent, infer categories from the `docs/adr/<category>/` directory names and proceed.
- Decide the target categories: with no argument, every `docs/adr/<category>/` on disk.

Reading or validating the whole index is not a request to deeply inspect every
feature's implementation. Keep global structure, link and dependency-cycle
checks with the deterministic tools; a full human-facing map is unnecessary.

### 2. Identify chains per category

In each category, read all the ADR bodies, the adrs[] records in `.mapping.json` (summary and status), the `Related` links, and the `Superseded by` links, and group them by "the same logical decision" (the README carries no per-ADR one-line summary — the index lives in the mapping). A category may hold several groups, or none.

On a full-scope run, repeat this for every category, but keep consolidation inside each category.

Choose the continuation from the ownership and succession evidence:

| Outcome                                                                                 | Continuation                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No chain** — the ADRs own independent current decisions                               | Explain their distinct questions and relevant relationships; leave official files unchanged. Code alignment, policy tests and destructive approval are not needed for this document-level conclusion. Retain global mechanical checks and report only checks actually performed. If no candidates remain, finish here. |
| **Unresolved candidate** — adoption, replacement scope or residual ownership is unclear | Follow the evidence needed to resolve that question in step 3. Hold the affected decision out of destructive changesets while unresolved; present the concrete choice and continue independent candidates.                                                                                                             |
| **Adopted chain** — successive answers to the same owned question are established       | Prepare the current contract and implementation evidence in steps 3–9, then apply only the changes approved in step 10.                                                                                                                                                                                                |

Apply Evidence selection and reuse to candidate groups and their incoming/outgoing
contract references. Follow a delegated owner or residual obligation until
resolved or explicitly held; direct references are a starting point, not a fixed
one-hop cap.

### 3–5. Prepare and verify a candidate contract

For an adopted or unresolved candidate, read [candidate contract](references/candidate-contract.md).
It owns adoption evidence, the lowest-numbered survivor, current-state drafting,
Status, and local code alignment. Preserve every still-applicable contract,
including non-numeric requirements and old values that still govern a different
scope. Apply the requirement gate before removing implementation details.
Unresolved adoption or residual ownership blocks only the affected changeset.

### 6–9. Prepare removals, references and history

Only for a candidate that can be consolidated, read
[references and history](references/references-and-history.md). Plan exact
removals, mapping and citation updates, and source-grounded major transitions.
Keep numbers and gaps unless renumbering was explicitly requested. Validate the
history against original sources, not the rewritten survivor.

### 10. Confirm the changeset and apply

When a concrete changeset is ready, read [approval and apply](references/approval-and-apply.md)
before presenting it or writing official files. Reuse approval for the exact
contracts and paths. Immediately before apply, compare every affected source and
destination with the preparation baseline; preserve concurrent changes. Persist
validated history before overwriting or deleting any original source, including
the survivor. Finish link and structure checks; report and repair partial failure
only within the approved scope.

## Notes

- Roll-up is **information compression, not information loss.** Never omit an important decision — the consolidated ADR (current state) plus `decision-log.md` (the major-transition history) together preserve the chain's decisions.
- When in doubt, do not merge. Staying separate is safe.
- Code establishes implementation facts; it does not establish adoption or completion review. Preserve Status under the Status rule in candidate-contract.md. Apply the ADR admission gate before carrying anything from code into the consolidated document. **Gray-zone decisions and requirements remain the ADR's authority.** When code contradicts such a decision, branch into "decision change vs violation" as in step 5 item 3.
