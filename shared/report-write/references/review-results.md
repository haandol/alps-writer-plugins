# Presenting review results

Apply this guidance to code, pull request, ADR, architecture, document, and other
review outputs. It governs the explanation, not the inspection method. Read the
relevant sources through the owning review workflow before presenting findings.

## Lead with the result and scope

Show material findings and required actions before background. State what was
reviewed and any limitation that changes how the result should be read. A clean
review reports no actionable findings within the checked scope, not universal
correctness. Keep confirmed defects, unresolved questions, and optional
suggestions distinguishable; do not invent an issue quota or severity.

## Keep each finding with its domain

Group findings by the affected business responsibility or evidenced domain.
Order domains and their findings by material impact so grouping does not bury
an urgent problem. Keep at most four peer explanation units and use meaningful
subscopes when more are needed. A short review can fit in one domain.

For each material finding, identify the source location, the expected rule or
behavior, the observed mismatch, its concrete impact, and the next action.
Include a reproduction or test result when available, with its actual scope.
Distinguish a proven problem from a plausible but untested failure. Preserve
caller-required finding identifiers, severity, evidence, and output schemas.

## Explain the mechanism at the needed depth

For code reviews, connect the trigger and affected behavior before discussing
functions or lines. For ADR reviews, show which decision, exact requirement,
rationale, boundary, or cross-document relationship is missing or inconsistent.
Document reviews identify the passage and its reader impact.

Use a Mermaid sequence diagram for a multi-participant failure or timing path
when supported by the evidence. Keep a local wording issue or one-step fix in
plain text. Do not turn a hypothetical failure into an observed event.

## Comprehension support

Use [the common comprehension workflow](comprehension.md) to generate the quiz
from the report's core explanation. Review-specific knowledge such as important
before/after behavior, failure conditions, contracts, and trade-offs supplies
the subject matter. Keep the review's native evidence and readiness rules intact;
the common skill owns question generation and self-check presentation.

## Preserve the review boundary

Writing quality and system severity are separate: editing prose must not erase,
downgrade, or soften a material finding. A request only to review does not
authorize edits to the subject, a changed ADR contract, deployment, or publishing.
If the caller already authorizes repairs, retain that scope and explain the
verified result. Keep complete source evidence and state which checks actually
ran. Review the final wording and layout using the shared editorial guidance.
