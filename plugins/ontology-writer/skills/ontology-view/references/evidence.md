# Prepare additional viewing evidence

Read only when the requested view needs domain memberships, entity transitions,
input/result views or discovery provenance that the model alone does not hold.
This is read-only preparation: the business hierarchy still comes from the model,
and supplied review evidence never becomes model approval.

When the user asks for entity/aggregate transitions, domain/subdomain boundaries
or input/result views, do not stop at the reconstruction's missing metadata.
Read the relevant business-context query,
the realizing ADRs and supplied business evidence; assemble the sourced working
board using [the board contract](../../../references/eventstorming-board.md). Preserve exact states from
their ADR owner without copying a state machine into the model. Mark unresolved
or contradictory before/after conditions visibly; neither an ADR state name nor
a `uses` edge alone proves a transition. Render and deliver that board. This is
read-only evidence preparation, not approval of a model change.
Preserve sourced domain/context identities, subdomain classifications and explicit
memberships in that disposable board. Do not infer external contexts from actors
or fill missing memberships by matching names. The saved model has no Domain,
Subdomain or View types; do not silently extend its vocabulary for a visualization.

For a request to inspect EventStorming discovery, use `/ontology-build` and
[EventStorming discovery](../../../references/eventstorming.md) to show its event map, evidence and boundary
candidates. Use [the board contract](../../../references/eventstorming-board.md) to render a candidate board even before
a model exists. The `view` command reconstructs the saved model; it does not
recover workshop history or candidate source verdicts. Do not claim the 3D projection
is evidence of the discovery process or that an unavailable view mode exists.

To add source information, use `/ontology-build`; for a natural-language change,
use `/ontology-edit`; after direct Turtle edits, use `/ontology-sync`.
For process completeness/readiness, request `/ontology-sync`'s read-only review;
for actual execution alignment, use `/ontology-align`. State these routes when
relevant to the user's request. A realization badge computed from ADR Status is
not proof of business completeness or current execution success.
