# Requirement delegation

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
