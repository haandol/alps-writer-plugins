# ADR and repository reconciliation boundary

Read this file completely before semantic reconciliation in deep mode. It
defines which side is authoritative and prevents implementation changes from
silently redefining a requirement or admitted decision.

Before choosing between conflicting accounts, read the plugin-local
`references/decision-reconciliation.md`. Prefer the later recorded or committed
semantic change to the same obligation. Reuse established intent; collect only
unresolved intent or chronology for the consolidated report. This default never
turns a newer code value into an approved contract by itself.

## Status and implementation facts

Status follows whether the repository implementation and tests exist, subject to
the implementation-review lifecycle. Non-requirement implementation facts such
as internal API paths, error-code names, enum identifiers or wire
representation, field names, libraries, SDKs, credential/auth wiring, and
module structure usually leave the ADR instead of being synchronized.

Correct such a fact in place only when it passes the admission and requirement
gates, for example a public compatibility contract or architecture-level key
design.

## Requirement values

The ADR is authoritative for requirement values. If the ADR says "max 20 turns"
and repository code says 30, record:

`[Requirement value drift] <category> — ADR "20 turns" ↔ code "30 turns"`

Use the shared reconciliation guidance to inspect the introducing change.
When intent remains unknown, recommend the newer behavior in the consolidated
question report and ask whether it is an intended contract change or a violation.
Do not overwrite the ADR solely to match code.

For an intended change, preserve ADR-first order: update the ADR requirement
contract, add one major-transition line to `decision-log.md`, then align the
implementation. Code already containing the new value does not make that value
a requirement until the ADR records the decision.

## Non-numeric requirements

The ADR is authoritative for allowed value sets, transition rules, mandatory
fields, permissions, visibility, ordering, uniqueness, and units. Handle a
mismatch exactly like a numeric requirement value.

Enums split across levels:

- constant names, enum identifiers, and wire representation are implementation
  facts;
- the allowed set and transition rules are requirement contracts.

Allowed states being added or removed, or a formerly forbidden transition
becoming allowed, is a contract change. Never synchronize it silently toward
the code.

## Gray-zone decisions

The ADR is authoritative for adoption rationale, alternatives, domain rules,
state transitions, external-dependency fallback, and the intent behind the key
design.

When repository evidence contradicts such a decision, first inspect semantic
history and existing user intent. Restore a known later adopted decision within
the authorized scope. If intent remains unclear, collect a question with the
newer content as the default recommendation and these branches:

- **An intended decision change** — update the existing ADR in place to the
  current decision, log a major transition when required, return an Accepted
  ADR to Proposed while implementation is realigned, and update the mapping
  summary.
- **An unintended violation** — leave the ADR unchanged and correct the
  implementation.

Record the unresolved case as `[Decision changed in code]` or
`[Code violates ADR]` without deciding intent on the user's behalf.

## Missing requirements

Repository behavior can reveal a candidate contract the ADR omits, but code
cannot prove whether that behavior is a requirement or an implementation
coincidence. Record `[Missing requirement] <what and which repository behavior
suggests it>` and ask the user. Add the exact value, rule, and basis only after
confirmation.

## Infrastructure evidence

For infrastructure, deployment, cloud, cluster, or remote-service decisions,
apply `references/local-evidence-boundary.md`. Repository IaC and tests can prove
repository alignment; they cannot prove current deployed state.
