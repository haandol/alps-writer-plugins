---
name: adr-impl-refactor
description: Review an ADR implementation for efficiency and proportionate reuse, immediately apply only high-confidence local behavior-preserving refactors with before/after tests, and leave all other opportunities as evidence-backed proposals. Runs inside /adr-impl before final Status promotion and /adr-impl-review.
argument-hint: "[adr-path-or-category] [--base <ref>]"
---

# adr-impl-refactor

> **Reports**: Before human-facing reports, apply [report-write](../report-write/SKILL.md).

Refactor an ADR implementation conservatively before it is declared complete. One or more model-selected review passes find opportunities; the main session applies only candidates that pass every safety gate. The final `/adr-impl-review` remains report-only and reviews the resulting code.

Apply `${CLAUDE_PLUGIN_ROOT}/references/non-invasive-harness.md`: the refactor
evidence and safety gates are contractual, while subagent use, agent count,
parallelism, and model selection are execution details.

This skill may also be invoked directly for an existing ADR implementation. It never changes an ADR decision or requirement contract. If an opportunity needs either to change, route it to `/adr-impl` or `/adr-sync` instead of treating it as a refactor.

## 1. Fix the target and scope

Identify the ADR and diff with the same target rules as `/adr-impl-review`:

1. Use an explicit ADR path or category when supplied.
2. With no target, show the `Accepted` ADR list and take a selection. Include `Proposed` ADRs only when current changes indicate a partial implementation, and confirm that partial-review intent once.
3. Use the user's PR / commit range or `--base` when supplied.
4. Otherwise use current staged and unstaged changes.
5. For a clean worktree, use the merge-base diff against the default branch.

Read the full ADR, its `.mapping.json` entry, the raw diff, direct call paths, related tests, the repo's seeded `docs/adr/concepts.md` and `docs/adr/authoring-rules.md`, and project conventions. Confirm the code scope by opening the actual code; never infer it from the category name alone.

If the selected diff mixes several implementations and cannot be mapped cleanly to the target ADR, stop and get a narrower base or range. Do not apply a refactor across an uncertain ownership boundary.

Create an artifact directory at `${TMPDIR:-/tmp}/adr-impl-refactor-<adr-slug>-<timestamp>/`.

## 2. Establish the test baseline

Run the narrowest existing tests that cover the changed path before applying any refactor. Record the command and result.

- If the relevant tests fail, stop. Refactoring a failing baseline makes cause and effect ambiguous.
- If no related tests exist, produce proposals only. Do not auto-apply a candidate whose behavior cannot be checked before and after.
- Do not install new tools or create product tests solely to qualify an automatic refactor. A missing test is a proposal and belongs in the result.

## 3. Choose and run the refactor review strategy

Apply the `adr-impl-refactor-reviewer` role to the original ADR, mapping entry,
raw diff, confirmed code scope, related tests, seeded rule docs, and project
conventions.

Before choosing the execution strategy, read `${CLAUDE_PLUGIN_ROOT}/references/subagent-dispatch.md` completely. The model may use a named reviewer, generic read-only subagent, separately grounded main-session pass, or another available read-only path. Choose the smallest strategy that can produce exact code evidence and preserve the safety gates.

Do not give the review pass necessity/sufficiency results, an implementation explanation, or earlier refactor conclusions. Agent topology is not a classification input: a main-session candidate may still become `APPLY_NOW` when the main session rechecks the original evidence, every step-4 gate holds, and before/after tests are available. Record a capability limitation only when it weakens the evidence.

Require only the reviewer file's existing `Refactor Review` output in the response.

Save the result as `refactor-review.md`.

## 4. Verify the auto-apply gate

The reviewer proposes; the main session verifies. An `APPLY_NOW` label is not sufficient by itself.

Auto-apply a candidate only when every condition holds:

- The candidate was rechecked against the original ADR, diff, call path, and tests without relying on an earlier conclusion as evidence.
- It preserves the ADR decision, requirement contract, observable behavior, and public contract.
- It is local to the confirmed implementation scope and has a small, mechanically explainable patch.
- Confidence is `high`, with exact code and call-path evidence.
- Related tests passed before the change and can run after it.
- It does not alter APIs or wire forms, schemas or persistence, dependencies, states or transitions, permissions or visibility, mandatory validation, ordering or uniqueness, concurrency, transactions, retries, timeouts, fallbacks, resource lifetime, or error semantics.
- An efficiency improvement removes work that is directly visible or reproducible; it is not speculative caching, concurrency, batching, or micro-optimization.
- A reuse extraction is backed by current same-semantics duplication and simplifies its call sites. It does not introduce a generic abstraction, extension point, or configuration surface for one caller or a hypothetical future use.
- Project conventions and sibling ownership do not contradict the change.

Critical priority never overrides the gate. A critical item that fails one condition becomes `PROPOSE_ONLY`.

## 5. Apply safe candidates one at a time

For each verified candidate:

1. Make the smallest patch that realizes only that refactor.
2. Run its targeted test immediately.
3. If the test passes, keep the patch and continue.
4. If the test fails or the change expands beyond the verified boundary, undo only that candidate's edits, keep the previously verified work, and move the candidate to `PROPOSE_ONLY` with the observed failure.

Do not use destructive worktree commands. Track the exact patch for each candidate so only work introduced by this skill is undone.

After all candidates, rerun the combined targeted test set **only when at least one candidate was kept**. When zero candidates changed the worktree, reuse the passing baseline as the final targeted result instead of testing identical state twice. When this skill is called by `/adr-impl`, `/adr-impl` must still rerun the project's full test command after an applied refactor.

## 6. Write the result

Save `refactor-results.md` in the artifact directory:

Before writing `refactor-results.md` or the chat summary, read
`${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` completely and apply
it. Keep the candidate evidence exact. Add a Mermaid before the candidate lists
when the shared guide's multi-call-site or multi-stage trigger applies.

Every proposal must state its priority, expected benefit, risk, estimated scope and verification method.

```markdown
# ADR implementation refactor result

## At a glance

- Verdict: <what was safely applied or left as a proposal>
- Impact: <what changed for maintainers or runtime work>
- Action: <the next required action, or "None">
- Risk: <what could not be verified, or "None">

## Visual map

<the smallest grounded Mermaid required by the shared report guide; omit this section when no trigger applies>
Notice: <the before/after relationship the reader should verify>

## Applied

- <candidate> - <files/symbols> - <benefit> - <before/after test result>

## Proposed

- <priority> <candidate> - <expected benefit> - <risk or failed gate> - <estimated scope> - <verification needed>

## Rejected

- <candidate> - <why it was speculative, taste-only, or not worth the abstraction>

## Tests

- `<command>` -> PASS|FAIL|NOT RUN - <result>

## Limits

- <missing tests, unavailable call path, or orchestration limitation that affects confidence>
```

Summarize At a glance, the applied count, proposal count, and tests in chat. Do
not present a proposal as though it was already implemented.

## 7. Continue the cycle

- When called from `/adr-impl`, return control to its test step. The required project tests and final implementation review must pass on the refactored code before `Proposed -> Accepted`.
- Then `/adr-impl-review` reviews the final diff without reading `refactor-review.md` or `refactor-results.md`. Its necessity and sufficiency perspectives derive their conclusions independently from the ADR, final code, diff, tests, and human baseline.

## Prohibited

- Do not change the ADR, mapping, requirement contract, or decision log.
- Do not auto-apply when tests are missing or the baseline is failing.
- Do not auto-apply when the candidate cannot be independently rechecked from original evidence or before/after tests are unavailable.
- Do not let priority or severity bypass the auto-apply gate.
- Do not introduce speculative reuse or a framework for one caller.
- Do not optimize tuning values without concrete evidence of repeated unnecessary work.
- Do not hide failed automatic edits; move them to the proposal list with the test result.
