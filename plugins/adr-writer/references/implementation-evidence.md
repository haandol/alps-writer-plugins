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

If the repository has no automated path, add the smallest local,
dependency-free path. A new dependency, broad harness, or destructive expansion
requires a scope decision. Never substitute a manual check and claim completion.

## Review classification

- Missing or inadequate documentation at a required boundary or under project
  conventions, or a direct ADR reference in code, is `Best practice` weighted
  `now` and prevents `PASS`. Name the missing contract or rationale; do not flag
  an ordinary internal function solely because it lacks a doc comment.
- A missing ideal case, relevant edge case, or execution result is `Test gap` and
  prevents `PASS`.
- A fully tested long inline behavior comment is a decision-neutral `Refactor`
  candidate; shorten it to the why.
- A test name that does not state its behavior, or one test covering unrelated
  behaviors, is a decision-neutral `Refactor` candidate.
- When property, mutation, static, or security tooling already exists, run it
  only against the target invariants. Do not install new tools during review.
