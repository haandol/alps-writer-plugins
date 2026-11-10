# Business context before ADR and code changes

Read this module when the repository has a business ontology — one or more
Turtle documents in `docs/ontology/` — and the current workflow creates or
changes an ADR decision or contract, or implements or reviews a feature linked to a process step. Without model documents, skip it entirely: add no output,
question, link judgment or index change. The model, its vocabulary, its
validation and the query belong to the separate ontology-writer plugin; this
plugin never reads the model.

## When to check

Check the upper level before the lower one, the same way code waits for its ADR.
These paths query the target feature's business context before finalizing ADR
content: a new ADR, an edit-in-place change, an `/adr-sync` body change, an
`/adr-import` adoption, a PRD handoff, and a user-approved deprecation or
supersede. A deprecation or supersede also shows, in its approval summary, the
steps that lose their realizing feature.

A category split or merge that keeps every meaning, and a rollup, do not query.
They only move `realizes` links in `docs/adr/.mapping.json`:

- A merge unites the links. A split moves each step's link to the category whose
  ADR holds that step's compliance contract; when no ADR or several ADRs hold it,
  show the assignment in the approval summary.
- A category created by a split or merge starts without an empty record; merged
  into a linked category, only the links remain. A rollup keeps the category, its
  links and its empty record.

Automatic lifecycle transitions — `/adr-impl` promoting to `Accepted`,
`/adr-sync` returning an ADR to `Proposed` — never wait for a query.

Run ontology-writer's query, the command its session directive names:

Choose the needed scope below before running it. This example requests the
whole feature's context:

```bash
bun <ontology-writer>/scripts/ontology.mjs query --category <key>
```

When ontology-writer is not available, state in the approval summary or report
that the business context was not checked, and continue; the missing query never
blocks the work.

The query also takes `--process`, `--concept` or `--event`, and
`--include-retired`. It returns only connected elements: the feature's steps and
their neighbours, the events and policies that start them and the steps emitting
those events, the policies and steps — in any process — reacting to the events
the steps emit, the steps sharing their business concepts, the applicable rules
with their basis, and the open scope. Every step carries its process Status and
its realizing features with their ADR Status. Never persist a result; it is not
a record or a second authority.

## Retrieve only the context needed for the change

Choose the entry point from what is already known, rather than walking every
layer on every implementation task:

- **Unlocated work:** use `query --overview` to read the lightweight BC layer,
  then `query --context <id> --search <business wording>` in relevant BCs.
- **Known process or element:** query it directly with `--process`, `--step`,
  `--concept` or `--event`. A single-step change need not start with every
  process realized by the feature.
- **Known feature:** use its confirmed `realizes` links to locate affected
  steps; use `--category` for feature-wide changes, uncertain scope or link
  diagnosis. Preserve the unlinked-feature handling below. Category names and
  code folders do not establish the business boundary.
- **Further evidence:** follow only relevant hand-offs, shared concepts, rules,
  neighboring BCs or missing observation criteria. `--search`, `--limit` and
  `--offset` page overview/context queries only. Follow returned `next` when
  more evidence is needed; keep the same search and custom `--adr-dir`.

Search and page summaries locate candidates; they do not establish the full
contract. Read the selected detail and the owning ADRs' full contracts,
retaining relevant cross-boundary conditions and diagnostics. Do not trim away
warnings or connections to make a broad result look complete. Stop expanding
when the change's business question and relevant dependencies are understood,
then find and implement the code from its ADRs. This does not replace the ADR
admission gate's required mapping/ADR reads, prerequisites or review coverage.

Within the same active change, reuse checked context while its sources remain
current. Refresh affected queries when their basis changes: relevant model facts,
realization links, ADR contracts or Status, or the requested business scope.
Do not repeat a query before each file edit or create a persistent context cache.
Retrieval itself never starts a model build, sync,
save or alignment review. Missing or disputed knowledge keeps its existing
uncertainty and approval handling.

## Unlinked features

When the target feature realizes no step, judge one of three outcomes and show
it with its reason in the approval summary or report: it realizes an existing
step (name the candidate), the model needs a new step (an ontology change
proposal), or it is unrelated to the business flow. Skip the judgment for a
deprecation without a replacement. When the user confirms the feature stays
unlinked, record `"realizes": []` for its category; never store a link candidate
or an empty record before approval. A category with an empty record is not asked
again.

## Using the context

The purpose is to carry actual business logic into ADR contracts, code and tests.
The model is useful when it captures the workflow accurately and richly; formal
ontology completeness and inference capability are not implementation goals.

The ontology supplies the business-workflow structure; functional ADRs explain
its realization. Preserve confirmed business responsibilities and dependencies
in the owning contracts so they guide code organization as well as behavior.
Use this supplied context through ontology-writer, without reading or reshaping
the model here or deriving business boundaries from existing ADR categories.

- **Connect workflow to verification.** In authoring, identify the starting
  condition, performer, event hand-offs, outcome and relevant observation
  criteria; propose feature-level contracts for relevant normal, exception,
  rejection and hand-off paths. In implementation, map approved contracts to
  business scenarios and tests. In review, check those scenarios against the
  contracts and actual evidence. If the category query omits criteria, query
  the connected process through ontology-writer; never read the model here.
  A model-only obligation missing from an ADR is an alignment issue, while
  missing behavior or tests for an approved ADR row follows the existing
  implementation-finding categories. Report business alignment separately from
  the ADR implementation verdict; PASS is not whole-process execution proof.
  Newly discovered business facts go through the owning approval path before
  becoming model facts, ADR requirements or new test pass/fail conditions.
- **Choose within the model.** Pick details the ADR leaves open so they do not
  contradict the model's flow, events, policies, cross-feature rules or terms.
- **Propose, do not absorb.** When no such choice exists, or the change needs a
  different flow, event, policy, cross-feature rule, or a business concept or
  term the model defines, raise an ontology change proposal through
  ontology-writer's `/ontology-edit`. Until it is approved, or while it is rejected, do not finalize
  ADR content that depends on it: save that contract row with a visible pending
  marker and the awaited business change in business language, without the
  model's file location or element ids. A pending row is not implemented, keeps
  the ADR `Proposed`, and is reported as pending by implementation review and
  ontology sync. After a rejection, rewrite the row with the model's current
  meaning or keep it pending until the user decides. A PRD handoff leaves that
  Feature unresolved.
- **Compliance contracts.** When an approval-bound authoring path — new ADR,
  edit-in-place, import, PRD handoff — finds that the context's event hand-off,
  policy or business rule has no compliance contract in the realizing ADR,
  propose one in the draft at feature resolution: the inputs the feature accepts
  and the events it emits for that relation, rejection and failure behavior,
  exact values and conditions, and guarantees such as duplicate delivery. Report
  other realizing ADRs missing the same contract as alignment issues. In the
  context of a `Proposed` process, first check model meaning no realizing ADR
  reflects yet, and fold the compliance contracts it needs into that process's
  change approval summary so they are asked once. `/adr-sync` never adds a
  compliance contract itself; it reports the gap as an alignment issue for
  `/ontology-sync`.
- **Report contradictions.** An ADR or code change that learns of a
  contradiction with the context reports it in its completion report — as an
  alignment issue (the model and the realizing ADR contract differ) or as an
  ontology change proposal. Completion is still judged by ADR contract rows only.
- **Not settled.** When the context shows validation errors, uncommitted model
  edits, unsynced direct edits or a lifecycle edit of an `Accepted` process,
  report that and do not treat that part as a settled reference. Propose
  compliance contracts for it only after presenting `/ontology-sync` and its
  approval. When the change flags are unavailable or unknown for part of the
  scope, say so and treat the `Accepted` processes there as possibly edited
  directly until the history is available and `/ontology-sync` has checked them
  with it.
- **State what you checked.** Name the business context you checked in the ADR
  approval summary and in the implementation plan. Keep model locations and
  element ids out of ADR bodies.

## Limits

- Absence from the model is not absence from the business. An open path stays
  something to confirm; a flow, policy or rule the model lacks is never evidence
  that no rule applies.
- A not-applicable item is evidence only that the business-level path does not
  exist; do not turn it back into a question. Never use it to drop a failure
  guarantee inside a step.
- The business context is never an implementation obligation or completion
  condition by itself; only ADR contract rows are.
