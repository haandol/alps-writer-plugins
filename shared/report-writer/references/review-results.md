# Presenting review results

Use after the [delivery decision](../SKILL.md#choose-the-delivery) selects a
report. The owning review workflow controls inspection, findings, severity,
verdict, edit permissions and native artifacts. Read its sources before presenting
findings; a review-only request does not authorize edits, deployment or publication.

Follow [explanation design](explanation-design.md) for the opening, domain hierarchy
and diagrams, and [final delivery](format-and-layout.md#final-delivery) for checks
and delivery. These references own the common presentation rules.

## Make the review actionable

Order domains and findings by material impact. For each material finding, state
its source location, expected rule or behavior, observed mismatch, concrete impact
and next action. Include a reproduction or test result when available and identify
its actual scope. Separate confirmed defects, plausible but untested failures,
unresolved questions and optional suggestions. Preserve native identifiers and
schemas; never invent an issue quota or soften a verdict to improve prose.

A clean review means no actionable findings within the checked scope. Name any
limitation that changes that judgment. When repairs were authorized, explain the
verified resulting behavior and remaining findings.

## Explain the mechanism

For code reviews, explain the trigger and affected behavior before code locations;
use [code evidence](code-evidence.md) for actual diffs or excerpts. ADR reviews
identify the decision, exact contract, rationale or boundary in question. Document
reviews identify the passage and its effect on the reader.

Diagram multi-participant or timing-dependent paths when the evidence supports
them; a wording issue or one-step correction can stay in prose. Do not turn a
hypothetical failure into an observed event. Quiz generation follows the common
skill's strong recommendation, not an additional review requirement.
