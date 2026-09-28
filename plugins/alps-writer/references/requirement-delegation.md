# Requirement delegation

## Intent bounds autonomous judgment

Explicit requirements cannot enumerate every implementation detail. Preserve
the user's intent so an agent choosing an unspecified detail is less likely to
optimize for a different purpose. Intent supplies the direction and bounds of
judgment: whose problem is being solved, which outcome matters, and the stated
scope, priorities, or non-goals that distinguish a suitable choice from a
plausible but unwanted one. Keep only distinctions supported by the user or the
owning artifact; do not invent a list of exclusions to fill a template.

Use intent together with the explicit contract when resolving gaps:

- Derive obligations logically required by the contract. For replaceable,
  reversible details within that contract and the authorized scope, choose a
  purpose-aligned option and proceed. Several acceptable implementations do not
  by themselves require a user question.
- Treat project conventions and domain defaults as candidate evidence, not as
  reasons to override intent. Prefer the locally appropriate choice that serves
  the recorded purpose; do not optimize a proxy such as fewer clicks, shorter
  output, or higher throughput at the expense of the intended outcome.
- Intent guides judgment but does not grant permission, invent a requirement,
  or weaken explicit rules. Apply the requirement gate and ADR admission gate
  before calling a gap implementation discretion. If materially different
  product outcomes remain, intent conflicts with a contract, or a protected
  policy is unresolved, ask the smallest question that resolves that choice
  while continuing independent work.
- For a material autonomous choice, explain the relevant intent, chosen option,
  and observable consequence in working evidence or the review. Check an
  intent-defeating counterexample when it matters. Keep replaceable decisions
  and run results out of the ADR; preserve the intent and durable constraints
  at their owning level.

For example, a **hypothetical** preview tool exists to help a user inspect and
control proposed edits. Choosing a readable grouping for the preview is local
discretion. Automatically applying the edits to save a click changes the
user-control boundary and is not justified by a general desire for convenience.

This is a boundary for interpretation, not a new DDD bounded context, folder,
schema, or approval registry. A missing detail need not block work; an unclear
purpose warrants a question only when it changes a material choice.

## Classify protected choices

Classify a value by its effect before deciding who chooses it. An answer such
as "whatever seems right" or "whatever is reasonable" delegates a proposal,
not the classification or approval of a concrete value.

- Keep a value or rule as a requirement when changing it changes required user
  behavior, quotas, retention, permissions, allowed states, ordering, uniqueness,
  failure guarantees, or a durable system/data/security/external boundary.
- Ask about an unresolved protected choice, or propose a grounded choice with
  its basis and trade-offs for the existing contract approval. Keep it visibly
  unapproved until the user confirms it. Do not present an illustrative number
  or a common default as an established requirement.
- Leave freely replaceable implementation tuning in code when another value
  preserves the same contract and boundaries. Delegation alone does not prove
  that this condition holds.
- Reuse values, decisions, scope and approvals already supplied for the same
  unchanged contract. Ask only for a new gap, contradiction or scope/cost change.
  A clear request authorizes its read-only analysis; the number of items or their
  dependency order does not create a separate approval. Contract changes and
  destructive actions retain their own approval boundaries.

For example, a private retry delay with no response-time guarantee can be
tuning. A session cap, record-retention period or document-visibility rule
remains a protected decision even when the user asks the agent to propose it.
