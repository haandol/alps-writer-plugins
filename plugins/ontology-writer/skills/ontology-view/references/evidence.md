# Prepare additional viewing evidence

For domain memberships, entity transitions or input/result views, read the
relevant business-context query, realizing ADRs and supplied business evidence.
Assemble and deliver a disposable board using [the board contract](../../../references/eventstorming-board.md).

- For domains and subdomains, keep the supplied identities, classifications,
  membership verdicts and sources. Leave membership unknown when only names,
  actors or ADR paths suggest it.
- For entity or aggregate transitions, preserve the owning ADR's exact states.
  An ADR state name or a `uses` edge alone cannot establish a transition. Mark
  missing or contradictory before/after conditions where the reader sees the flow.
- For input/result views, identify the supplied role and source of each view.
  Keep this evidence on the board. The saved model has no Domain, Subdomain or
  View types, and previewing evidence grants no approval to change its vocabulary.

For a request to inspect EventStorming discovery, use `/ontology-build` and
[EventStorming discovery](../../../references/eventstorming.md) to show its event map, evidence and boundary
candidates. Use [the board contract](../../../references/eventstorming-board.md) to render a candidate board even before
a model exists. The `view` command reconstructs the saved model; it does not
recover workshop history or candidate source verdicts. Do not claim the 3D projection
is evidence of the discovery process or that an unavailable view mode exists.
