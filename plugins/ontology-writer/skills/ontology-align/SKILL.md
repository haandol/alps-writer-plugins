---
name: ontology-align
description: Run the alignment review that makes a business process current — check that every system step is realized by implemented features, that compliance contracts sit in the required ADRs, that ADR contracts do not contradict the model, and that each observation criterion is confirmed by executing the realizing features' real entry points — then promote the process to Accepted automatically, or report what remains. Runs after the last affected ADR is Accepted, after an approved change with no affected ADR, when a Proposed process's realizing ADRs are all Accepted, or on request. Keywords - "/ontology-align", "정렬 검토", "프로세스 현행 판정", "process alignment review".
argument-hint: "[process-id]"
---

# ontology-align

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

Read `${CLAUDE_PLUGIN_ROOT}/references/ontology.md` completely. The
alignment review sees what per-feature implementation reviews cannot: whether the
features realizing a process work together. `Proposed` is the approved target
business; only a passing review makes a process `Accepted`, and it does so
without another confirmation.

## When it runs

- Right after the last ADR affected by an ontology change becomes `Accepted`, or
  right after an approved change with no affected ADR is applied.
- Right after the last realizing ADR of a `Proposed` process becomes `Accepted`
  (`/adr-impl` hands over to this skill then).
- When the user asks.

For a completeness/readiness-only request, use `/ontology-sync`'s read-only
review path and `${CLAUDE_PLUGIN_ROOT}/references/workflow-readiness.md`;
do not promote a process or execute scenarios under that request. This skill's
alignment review establishes execution evidence, not whole-system completeness.

## 1. Mechanical gates and the plan

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs align --process <id> --json \
  [--together <other-proposed-process>,...]
```

The plan blocks on: any model validation error or unresolvable index link; a
system step without a realizing feature; a realizing feature without an
`Accepted` ADR, with a `Proposed` one, or with an ADR record whose Status is
invalid or differs from the ADR body's Status, an indexed ADR file that cannot be
read, an ADR file of the feature the index does not list, or an ADR record that
names no ADR file of the feature's own folder (retired ADRs do not count); a
hand-off between processes with no
observation criterion passing through its event; a criterion whose execution
scope contains no system step (`executesNoSystemStep: true`), because its
evidence could only be unverified. Use `--together` only for another `Proposed`
process this same review verifies; otherwise its steps stay deferred.

## 2. Compliance contracts and contradictions

For each entry of the plan's `compliance` list, read the named features' ADRs:

- a **hand-off** needs a compliance contract in the ADRs of both the emitting
  step and the reacting step;
- a **policy** needs one in the ADR of each step it starts;
- a **business rule** needs one in the ADR of each system step it reaches.

A compliance contract states, at feature resolution, the inputs the feature
accepts and the events it emits for that relation, rejection and failure
behavior, values and conditions. Then check that no realizing ADR contract —
including context-level ADRs the features follow — contradicts the model's flow,
hand-offs, policies, rules or actor responsibilities: a different event promised
on either side, a contract breaking a rule, a permission that stops the model's
performer from performing its step. Report each gap or contradiction with the
ADR and the model element. Any of them fails the review.

## 3. Execution evidence

Create a run directory under `.adr-review/` following
[review artifact storage](../report-writer/references/review-artifacts.md).
For every criterion, **write the execution scope into the evidence before
running**: the system steps from its start condition to its business result,
the steps of other processes that emit or react to the events it passes through
(only when that process is `Accepted` or verified together), and each step's real
entry point. Before running anything, read `${CLAUDE_PLUGIN_ROOT}/references/execution-boundary.md`
completely: real entry points run in the repository's local or test environment,
and a criterion only a live environment could show stays unverified.

- Create the start condition, run every in-scope system step through its
  realizing feature's real entry point, and observe the business result.
- Use a double only for an outside organization or system you declare in the
  evidence. A realizing feature replaced by a double, an undeclared double, a
  skipped in-scope step or its result fabricated as data leaves the criterion
  unverified, and so does evidence that executes no realizing feature at all.
- An outside-system step may be replaced by giving its result as input; record
  the input.
- For each hand-off with a current counterpart, execute one criterion passing
  through it with both sides. A hand-off whose counterpart is still `Proposed` is
  deferred; it runs in the review that makes that counterpart current.

## 4. Verdict

- **Pass** — every gate, compliance contract, contradiction check and criterion
  holds: run `transition --process <id> --to Accepted` for a `Proposed` process and
  report the evidence path. Do not ask for another approval. When it answers that
  the process is still `Accepted` at HEAD on the same or a later day, ask the user to
  commit the approved change, then run the promotion again. An `Accepted` process
  that passes stays as it is; its date changes only through a renewal ontology sync
  or an approved save performs.
- **Fail on a `Proposed` process** — it stays `Proposed`. Report the completed and
  the remaining features, gaps and unverified criteria separately; a partial
  result is never `Accepted` or a full success.
- **Fail on an `Accepted` process** — if its business composition changed since
  it last became `Accepted` (`ontology.mjs changes --json` lists it in
  `unsyncedAccepted` with `compositionChanged: true`, or `impact --base HEAD`
  lists it in `processesToPropose` for an uncommitted edit), it was edited
  directly: hand over to `/ontology-sync`. When `changes` reports its committed
  edits as unknown (`unsyncedUnknown`), the committed-edit flags as unavailable
  (`committedUnavailable`) or no flags at all (`available: false`), report the
  failure as unchecked and hand over to `/ontology-sync`, never as a lower-level
  issue. Otherwise —
  `compositionChanged: false` included, which means only open scope changed — keep
  its Status and report the failure as a lower-level alignment issue naming the
  drifted ADRs or results.

Evidence and verdicts are disposable reports, never records or approval state.
