# Evidence-based EventStorming

Use when building a first model or extending it from additional information.
EventStorming captures the actual business workflow accurately and richly before
choosing its model boundaries. The goal is business logic expressed through ADRs
in code and tests, not a perfect ontology or inference capability. Capture the
evidenced decisions and their reasons, exceptions, waits, cancellations,
compensation and manual/external hand-offs that matter to that workflow. Its reviewable outputs are an event map, boundary candidates and a
model proposal; it does not prescribe private reasoning or a workshop topology.

## From evidence to an event map

Use the requested business/system scope. Read the supplied documents, user
explanations and accessible local evidence such as code, tests and sample
records. Code and records show observed behavior, not automatically intended
policy. Do not access live systems merely to fill a map. State unavailable
sources and distinguish the covered scope from the whole requested system.

Build a big-picture map of business events, named as things that happened.
Connect each evidenced path from its starting condition to its business result:
actors and actions, emitted events, reacting policies and subsequent steps,
business information used, and relevant exceptions, rejections and hand-offs.
Show temporal order separately from causation; do not invent a cause from
adjacency. Mark current vs. planned behavior, source locations and the existing
stated/inferred/conflicting/unconfirmed verdicts on candidates and relations.
Keep unanswered questions and disputed connections visible on the working map.

## From the map to business boundaries

Derive bounded contexts from consistent language and rule ownership. Identify
subdomains as business problem areas and explain their relationship to those
contexts; neither a service nor a repository folder proves either boundary.
Core/supporting/generic classification needs business evidence and may remain
unconfirmed. Do not force a one-to-one subdomain/context relationship or move
existing ADR categories without authorization. Preserve confirmed boundaries;
additional evidence proposes only the material changes it supports.

Present the whole event map before opening its context-level details. Explain
each proposed boundary with the events, concepts and responsibility it owns,
and show cross-boundary hand-offs. A context list without this map does not
establish that the system's business process was discovered.

## From the working map to a saved model

Apply `ontology.md`'s closed vocabulary and resolution. The working map may
contain candidate actions, information needs and questions; confirmed business
actions map to steps and actors, information to business concepts and `uses`,
and unconfirmed paths to the approved open scope. This does not add Command,
Hotspot or Subdomain types to the stored vocabulary. Preserve confirmed business
responsibilities and terms in the model's existing definitions. Keep boundary
analysis, source locations and classification candidates in the disposable
report; do not invent new mapping fields or a discovery registry.

State machines, exact values and detailed conditions retain their ADR owner.
Use the build workflow's transfer and approval rules for those items. A saved
model view can reconstruct its current event relationships; it cannot recover
discarded workshop history, candidate verdicts or source evidence.

For additional sources, start from all current model documents and compare the
proposal with that baseline. Absence from new material is not deletion or proof
that a path does not exist. Use the existing semantic diff, conflict questions,
sufficiency review and one approval path. Reusing equivalent evidence is a no-op.

## Review the entity changes on a board

Present EventStorming results as a board, not a Mermaid substitute. Use distinct
actor/action, entity or aggregate change, domain event, policy and next-action
cards with connections. Capture an entity's before/after business condition only
when evidence supports it, with its source and verdict. A `uses` relation alone
does not prove a mutation; show unknown changes explicitly. Keep these candidate
observations in the disposable board, not new ontology properties or a second
state-machine authority. See `eventstorming-board.md` for the renderer input.
