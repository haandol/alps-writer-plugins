# Implementation review mode

Select the mode from changed protected surfaces, actual impact and unresolved
risk. Use the same criteria in implementation completion and standalone review.

Use `full` for changes to requirement values or rules, public API or wire form,
schema or persistence, states or transitions, permissions or visibility,
security boundaries, external fallback, concurrency, transactions, resource
lifetime or error semantics. Also use it for changes spanning bounded contexts
or broad modules, an explicit full-review request, or unclear classification.

Use `standard` for localized implementation or reinforcement of an existing
decision that changes none of those protected surfaces. The size of the existing
complete implementation alone does not force full mode. An explicit standard
request cannot override protected changes or unresolved classification.

Both modes discover and verify the complete ADR implementation and every contract
obligation; the diff remains separate change context. Neither mode can pass
missing evidence, a core test gap or an unverified contract/safety premise.
Record the selected mode and its change/impact evidence once. Choose explanation
depth after this selection, without treating presentation size as review risk.
