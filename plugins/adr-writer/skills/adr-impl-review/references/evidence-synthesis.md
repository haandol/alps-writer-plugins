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
4. Downgrade to `Unverified risk` any claim you could not execute or whose call path you could not fully confirm.
5. Distinguish the fact that a test exists from the fact that a test detects the defect.
6. A necessity PASS means "no unnecessary change was found"; a sufficiency PASS means "no counterexample was found at present and the decision ledger is accounted for."
7. Normalize coverage independently from findings. `D0` is the Decision; `R1..Rn` follow top-level bullets and table data rows under `### Requirement contract` in source order. Each ID has exactly one `contractId`, `requirement`, `status`, `adrBasis`, `implementation`, `evidence`, and `tests` row. `D0.adrBasis` is `Decision`; preserve each source bullet verbatim, or join a table row's trimmed cells with `|`, excluding its header/separator. Use `PROVEN`, `VIOLATED`, `UNVERIFIED`, or `CONTRADICTED`. `PROVEN` means inspected/executed evidence supports the obligation without a found counterexample, not mathematical proof. Reject omissions, duplicates, and invented IDs.
8. Before normalizing implementation choices, inspect their externally checkable premises. A premise confirmed by code, tests, configuration, or an authoritative external contract may remain part of the choice's evidence. If the premise is unverified and could violate safety or an ADR contract row when false, create an `Unverified risk`, mark the affected coverage `UNVERIFIED`, and block `PASS`. Do not infer private reasoning.
9. Normalize Notable implementation choices independently from findings. Every row has only a concrete selected value or behavior, code evidence, why it fits the ADR intent, and why it matters. Explain fit by naming the preserved contract or boundary, not by guessing why the implementer chose it. A row that changes a requirement contract or durable boundary is removed from the list and raised as `Undecided behavior`.
10. Normalize the wide view into `reviewHike.context` and the Container,
    Component, and Code route into `reviewHike.hills` exactly as
    `${CLAUDE_PLUGIN_ROOT}/skills/adr-impl-review/references/review-hiking.md` and the artifact contract require.
11. Normalize every finding into a user-action card as well as technical evidence. Keep non-empty `whyItMatters`, `expectedBehavior`, `observedBehavior`, `requestedChange`, `editTargets`, and `completionCriteria` fields. These fields explain the task in plain language; the exact ADR quote, code fragment, evidence, command, and result remain separate audit fields.

The synthesized verdict:

- `PASS`: there is no evidence-backed must-fix, every contract-coverage row is `PROVEN`, and the required targeted tests passed.
- `FIX_REQUIRED`: there is a finding requiring concrete follow-up in the code, the ADR, or the tests.
- `INCONCLUSIVE`: an important path could not be executed or the scope could not be fixed, so PASS/FIX cannot be judged honestly.
- `BLOCK`: a fork in the decision itself, or a structural collapse, requires a human architectural decision before any individual code fix.
