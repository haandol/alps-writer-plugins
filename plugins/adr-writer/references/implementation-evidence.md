# Implementation evidence contract

Use this contract when implementing, refactoring, or reviewing code governed by
an ADR. Project conventions and established sibling style remain the primary
basis; this contract supplies the completion floor when they are silent.

## Documentation at meaningful boundaries

Require documentation for the target behavior's public interfaces, material
contract, state, permission, and failure boundaries, and nonobvious rationale.
This includes ordering and fallback rules when they affect the contract.
Follow project conventions, including any stricter documentation requirement.
For function or method contracts, use the repository's language-native form:
GoDoc, Python docstring, JSDoc/TSDoc, Rustdoc, JavaDoc/KDoc, or the local equivalent.
Document a nonobvious constraint or rationale where it is relevant rather than
repeating it on every internal helper.

Required documentation explains why the interface or boundary exists and how
its contract-relevant behavior works. Ordinary internal functions can rely on
clear names, types, and tests when those explain the behavior and project rules
do not require a separate comment. An internal function that owns a material
boundary or nonobvious rationale still needs that explanation.

A name/signature restatement is insufficient. Reuse the ADR's domain and
requirement-contract vocabulary so repository search can find the implementation,
but never cite the ADR itself. Code comments and docstrings contain no ADR number,
path, link, `ADR` source label, or wording such as “the ADR requires.”

Language-standard documentation may exceed three lines when needed to state the
why and how.

## Inline comments and executable explanation

Keep ordinary inline comments to roughly three lines. When a longer block
enumerates behavior, preserve a short explanation of the why and move the what
into tests:

- boundaries and requirement values;
- ordering or state-transition sequences;
- rejected input;
- failure and fallback;
- duplicates, concurrency, partial failure, and restart behavior when relevant.

Do not delete a long comment before its cases are covered. A comment that records
an external constraint, platform quirk, upstream guarantee, or trap that code
cannot express remains valid even when longer.

## Ideal and relevant edge tests

Every implemented ADR behavior has:

- at least one ideal-case automated test;
- every edge case relevant to that contract.

Select edge cases from requirement boundaries, empty or invalid input, forbidden
transitions, failure and fallback, duplicates, reordering, concurrency, partial
failure, and restart behavior. Do not require unrelated categories to fill a
checklist.

Before selecting or executing validation, read and apply
`${CLAUDE_PLUGIN_ROOT}/references/outcome-evaluation.md`. It owns case inputs,
observable evidence, execution readiness, actual user-entry verification,
code/semantic judgments, result aggregation and cause-specific repair. Connect
the tests selected here to those rules; retain the ideal/edge coverage and review
classifications in this document.

Tests read as executable documentation. Name each test as the behavior it proves
and keep unrelated behaviors separate so a failure names the broken rule.

### Account for the obligation, not the test name

Derive verification obligations from the whole ADR: connect the recorded intent
and outcome to each independent rule, including conditions or guarantees stated
outside the requirement list. Reconcile these with the source contract rows;
mechanical row extraction is not a semantic completeness check. Keep the inventory
disposable. Never add code-to-ADR references or an authoritative coverage registry.

For each obligation, connect the applicable input and starting state, observable
result and pass/fail criterion to the enforcing code path and the test's actual
assertions. Read setup, assertions, mocks and skipped branches; a passing test
named after a requirement may not test that requirement. For example, asserting
an error response does not establish a required absence of writes. Inspect the
before/after observable state too. Derive expected results from the contract,
not by copying what the current implementation returns.

Check whether a contract-breaking implementation could still satisfy the
assertions. Confirm a concrete counterexample with existing targeted tools or a
non-destructive reproduction when feasible. New mutation tooling and exhaustive
input enumeration are not required. During review, place reproductions only in
the review artifact directory; never modify product code or existing tests.

Select boundaries and counterexamples from the contract and actual execution
paths, including interactions between obligations, bypass entry points and shared
state when relevant. For considered edge categories, record the applicable cases
or a contract/code-grounded exclusion reason. Unrelated categories do not create
test quotas. A mock establishes only the behavior exercised with that substitute;
it cannot prove the provider guarantee or omitted entry path it assumes.

Keep partial evidence visible. A compound source row must account for every
independent clause and derived obligation before the parent can be `PROVEN`.
Temporary review reproductions can establish current behavior or expose a
defect, but do not repair a missing required repository regression test. While
that test or assertion gap remains, keep the affected parent `UNVERIFIED` for
completion and report code-supported behavior separately; a `Test gap` does
not imply a code violation.
Code inspection and test verification are separate coverage axes: report the
full obligation denominator, which obligations each axis supports, and the gaps.
Count a repeated guarantee once in that semantic denominator while retaining
every source-row link; a Decision restatement must not inflate coverage.
Test counts, line/branch coverage and average scores cannot discharge a missing
required obligation. Finite tests support a bounded completion claim, not a
mathematical proof or a guarantee over every production execution.

If the repository has no automated path, add the smallest local,
dependency-free path. A new dependency, broad harness, or destructive expansion
requires a scope decision. Never substitute a manual check and claim completion.

## Review classification

- Missing or inadequate documentation at a required boundary or under project
  conventions, or a direct ADR reference in code, is `Best practice` weighted
  `now` and prevents `PASS`. Name the missing contract or rationale; do not flag
  an ordinary internal function solely because it lacks a doc comment.
- A missing ideal case, relevant edge case or inadequate assertion is `Test gap`
  and prevents `PASS`. An observed contract violation is `Spec violation`;
  an adequate test unavailable solely because of environment/access, or an unresolved scope,
  leaves the affected obligation `UNVERIFIED` and the review `INCONCLUSIVE`
  when that missing evidence prevents judgment. Do not turn lack of evidence
  into an observed code or test defect. Recover the verification path within
  authorization and rerun it; preserve already confirmed findings.
- A fully tested long inline behavior comment is a decision-neutral `Refactor`
  candidate; shorten it to the why.
- A test name that does not state its behavior, or one test covering unrelated
  behaviors, is a decision-neutral `Refactor` candidate.
- When property, mutation, static, or security tooling already exists, run it
  only against the target invariants. Do not install new tools during review.
