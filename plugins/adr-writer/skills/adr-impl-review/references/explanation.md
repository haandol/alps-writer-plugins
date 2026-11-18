### 1.2 Choose the explanation depth

For a local standard review, a short Context and each vertical capability's
claim, contract rows and direct code evidence suffice. Container/Component
zooms and repeated example/assessment fields are optional. Read
[Review Hiking](review-hiking.md) when preparing detailed zooms;
read [visualization](visualization.md) when diagrams help the reader.
Reuse Implementation Hill boundaries when they still match shipping behavior.
For full mode, apply both modules and their detailed evidence structure.

### 1.3 Prepare optional explanation input

For broad or high-load reviews, optionally apply the `adr-impl-explainer` role
to the ADR, complete and change scopes, and related tests. Save optional
`explanation.md`; skip it when the report can explain the Hills directly.

The explanation starts with `Context`, then follows each Container/Hill through
Component and Code evidence in
reader-priority order. Apply
`references/review-hiking.md`; do not default to file order.

Later headings name the actual vertical behavior, capability, or bounded
context. Their content remains subject-specific.
Do not stop to show it or ask the user to reconfirm. Never pass it to either
review perspective.

At report composition, use the common report-writer comprehension workflow to
prepare questions from this explanation. Preserve this review's native fields
and readiness rules through `references/artifact-contract.md`; question
selection and staged self-check belong to the common report skill.
