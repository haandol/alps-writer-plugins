# Implementation review evidence synthesis

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

## 4. Evidence verification and synthesis

For outcome claims, apply `${CLAUDE_PLUGIN_ROOT}/references/outcome-evaluation.md`;
monitoring is not a required gate.

The main session does not merge the two reviews by vote. Verify findings with these rules.

1. Merge the same problem into one, but keep every source in `perspective`.
2. Do not hide mutually contradictory conclusions — record them as a `Contradiction` finding.
3. Confirm a high-impact finding only with a test, a reproduction, or an exact code/ADR comparison.
4. Keep a claim `Unverified risk` when its proof depends on execution or a call
   path that could not be confirmed. Preserve a violation independently
   established by an exact code/ADR comparison even if another required test
   cannot run; report that execution limit separately.
5. Distinguish the fact that a test exists from the fact that a test detects the defect.
   Read the assertions and their execution conditions against the obligation.
   A success label, test name, line/branch coverage or mock assumption cannot
   replace the enforcing path and observed result.
6. A necessity PASS means "no unnecessary change was found"; a sufficiency PASS means "no counterexample was found at present and the decision ledger is accounted for."
7. Normalize coverage independently from findings. `D0` is the Decision; `R1..Rn` follow top-level bullets and table data rows under `### Requirement contract` in source order. Each ID has exactly one `contractId`, `requirement`, `status`, `adrBasis`, `implementation`, `evidence`, and `tests` row. `D0.adrBasis` is `Decision`; preserve each source bullet verbatim, or join a table row's trimmed cells with the literal separator `" | "` (one space on each side of the pipe), excluding its header/separator. Use `PROVEN`, `VIOLATED`, `UNVERIFIED`, or `CONTRADICTED`. `PROVEN` means inspected/executed evidence supports the obligation without a found counterexample, not mathematical proof. Reject omissions, duplicates, and invented IDs.
8. Before normalizing implementation choices, inspect their externally checkable premises. A premise confirmed by code, tests, configuration, or an authoritative external contract may remain part of the choice's evidence. If the premise is unverified and could violate safety or an ADR contract row when false, create an `Unverified risk`, mark the affected coverage `UNVERIFIED`, and block `PASS`. Do not infer private reasoning.
9. Normalize Notable implementation choices independently from findings. Every row has only a concrete selected value or behavior, code evidence, why it fits the ADR intent, and why it matters. Explain fit by naming the preserved contract or boundary, not by guessing why the implementer chose it. A row that changes a requirement contract or durable boundary is removed from the list and raised as `Undecided behavior`.
10. Normalize the wide view into `reviewHike.context` and the Container,
    Component, and Code route into `reviewHike.hills` exactly as
    `${CLAUDE_PLUGIN_ROOT}/skills/adr-impl-review/references/review-hiking.md` and the artifact contract require.
11. Preserve every finding's core evidence and contract links. When serializing
    the result after verdict selection, use [the native schema](artifact-schema.md)
    as the owner of required fields and optional derived action wording. Derive
    presentation fields from the evidence; add precision only when the defaults
    would lose meaning. Optional wording never makes substantive evidence optional.

### Preserve proof coverage within the existing artifact

**Contract compliance:** preserve the verified comparison of every recorded
value, allowed set, transition, permission, mandatory field, ordering rule,
uniqueness rule, and unit against the actual code. Similar logic is not enough
when its value or rule differs. Keep each independent obligation and its
implementation-independent observable evidence in the ledger before normalizing
to source rows; the report must not summarize away a mismatch.

Keep the source-based `D0`/`Rn` IDs and required fields. The `requirement` and
`implementation` text identify every independent clause, condition and derived
obligation. In `evidence`, connect those clauses to actual enforcing paths,
test inputs/preconditions, assertions, observable results, relevant
counterexamples and any excluded edge category's contract/code basis. In
`tests`, list the corresponding commands and actual required execution outcomes
only. Put quoted domain states such as `FAILED`, intentional mutant failures
and explanatory exclusions in `evidence`, not in that execution-result field.
Never omit a failed or unexecuted required check. Use recognizable clause/test
labels to connect the fields; do not invent source contract IDs or a permanent
tracking registry.
Guarantees outside the mechanically extracted rows belong to their existing
parent or `D0`, with their exact source location/quote retained in the evidence.

A parent row is `PROVEN` only if every clause and required verification is
supported. A temporary review reproduction does not repair a required regression
test or assertion gap; keep the affected parent `UNVERIFIED` for completion
while explaining any independently code-supported behavior. Preserve each
clause's violation, missing evidence or contradiction;
no average or majority can override it. Report obligation coverage separately
for inspected code and verified tests, using the full semantic inventory as
the denominator, alongside the existing source-row counts. An inspection count
is not a claim that the inspected code satisfies the obligation. Derive counts
from the clause accounting; never infer completeness from a validator accepting
the artifact's shape. Explain uncovered obligations and evidence limits in the
same Hill, even when there are no confirmed code defects.

Treat missing tests or ineffective assertions as `Test gap`, confirmed behavior
mismatches as `Spec violation`, and unavailable execution/unfixed scope as
`UNVERIFIED`. An undecidable core path makes the verdict `INCONCLUSIVE`; retain
any separately confirmed must-fix findings. Missing product policy or an
unresolvable criterion follows the existing contract-decision route. Never
manufacture a code violation, a new requirement, or evidence of execution to
make the table complete.

The synthesized verdict:

- `PASS`: there is no evidence-backed must-fix, every contract-coverage row is `PROVEN`, and the required targeted tests passed.
- `FIX_REQUIRED`: there is a finding requiring concrete follow-up in the code, the ADR, or the tests.
- `INCONCLUSIVE`: an important path could not be executed or the scope could not be fixed, so PASS/FIX cannot be judged honestly.
- `BLOCK`: a fork in the decision itself, or a structural collapse, requires a human architectural decision before any individual code fix.
