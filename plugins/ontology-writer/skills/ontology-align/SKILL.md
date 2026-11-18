---
name: ontology-align
description: Verify that a business process is realized by implemented features, matching ADR compliance contracts and execution of its observation criteria. Promote Proposed to Accepted only after alignment passes. Use on request or at the approved implementation handoff; readiness-only reviews use ontology-sync.
argument-hint: "[process-id]"
---

# ontology-align

Use [next-action guidance](../../references/next-action.md) in each user-facing reply.

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

The alignment review checks whether the
features realizing a process work together. `Proposed` is the approved target
business; only a passing review makes a process `Accepted`, and it does so
without another confirmation.

## When it runs

If the project has no saved ontology, offer [first-model setup](../../references/first-model.md).
A missing process in a saved model needs the correct process or a scoped extension.

- Right after the last ADR affected by an ontology change becomes `Accepted`, or
  right after an approved change with no affected ADR is applied.
- Right after the last realizing ADR of a `Proposed` process becomes `Accepted`
  (`/adr-impl` hands over to this skill then).
- When the user asks.

Start `/ontology-align <process>` in the terminal conversation. Run the
mechanical plan and actual verification below. When the user must make a
decision, open or reuse the [decision session](references/session.md) and
collect the outstanding questions or changes there. Continue the original
terminal task after the user responds. Report the results in the terminal
and return any result tied to a decision to the same screen.

Use the plan for the selected process. Load the relevant parts of
[the model reference](../../references/ontology.md) when interpreting its
relations or diagnosing a gap. Use the named ADRs and criteria to scope the
evidence.

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

## 2–3. Verify contracts and execution

For a runnable plan, follow [contract and execution verification](references/verification.md).
Match the realizing ADRs to the model and run the observation criteria through
their real entry points within the local execution boundary.

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
