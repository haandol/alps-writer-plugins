# Process completeness and workflow readiness

Use for a requested completeness/readiness review, before a build or edit is
presented, or when new evidence exposes a gap. This is a semantic review using
existing tools, not a new CLI command, lifecycle state or universal development
gate. Completeness means enough accurate business context to understand,
implement and verify the requested workflow, not a perfect graph or inference
system. Keep results disposable and state the requested scope and evidence limits.

## Three separate conclusions

| Question                                              | Evidence and conclusion                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the business model sufficient for this scope?      | Review start/end and normal flow, performers and rules, exceptions/rejections/hand-offs, and evidence conflicts. For each axis give sufficient, insufficient or unconfirmed, with evidence and the next action. Check event producers/consumers and responsibility boundaries; do not limit review to changed elements. |
| Are the ADR contracts ready for the intended work?    | Trace system steps and observation criteria to realizing ADRs, including both sides of a hand-off and the contexts' shared contracts. Name missing links, missing compliance obligations, contradictions, pending decisions and prerequisite status. A valid link alone does not establish a complete contract.         |
| Has the business behavior been verified by execution? | Report the actual criterion/entry-point evidence from an alignment review. Without it, say unverified. A mechanical alignment plan, an Accepted label or an ADR review PASS is not that evidence.                                                                                                                       |

Structure validation proves only the checks it implements. An `openScope` value
of `none` is a model assertion to review, not proof of semantic completeness.
Respect user-confirmed not-applicable paths and preserve unknown scope. Partial
coverage must not be reported as whole-system completeness. A Proposed ADR may
have a sufficiently specified contract for implementation; it is not implemented
and cannot satisfy the separate execution/alignment gates.

## Read-only review

Use `ontology.mjs validate`, scoped `query`, `changes` and, when useful, `align`
to obtain structural findings, relationships, history limits and the mechanical
execution plan. Read the relevant evidence and realizing ADRs to make the
semantic judgments above. These tools do not make those judgments for you.
Do not call `apply`, `transition` or `format --write`, edit the model/index/ADRs,
or promote Status in a review-only request. Do not fetch missing history or
access live systems under this review; report unavailable evidence.

## Route the next action

- Additional information: `/ontology-build` with the new sources and current
  model; use `eventstorming.md` to update the map and boundary candidates.
- A requested business change or a newly found business gap: `/ontology-edit`
  prepares the semantic diff and affected ADR revisions for the existing approval.
- Direct Turtle edits or model/ADR drift: the mutating `/ontology-sync` path,
  only when reconciliation is requested or authorized.
- Actual end-to-end evidence: `/ontology-align` after its prerequisites hold.

Read-only review reports these routes; it does not execute their mutations or
tests merely because they are the next action. Build/edit paths include relevant
readiness gaps in their existing report and approval, without asking again for
confirmed facts. An unresolved model/ADR alignment issue stays separate from
the implementation verdict against approved ADR rows.
