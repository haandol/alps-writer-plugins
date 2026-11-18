## Build four discovery views

Present a reviewable path from workflow evidence to boundaries, decisions and
prerequisites. Use EventStorming as a way to reconstruct business events and
rules from local evidence, not as a claim that domain experts have confirmed
their meaning. Start with a thin overview of actors, important business outcomes
and scope; deepen representative flows and revise hypotheses as evidence arrives.
Do not require a complete detailed system map before preparing independent
candidates. These four stages organize observable results, not private reasoning,
agent topology or a fixed source-reading order. Keep maps and precise code
evidence in the ignored run report; they are not permanent registries.

### 1. Reconstruct business workflows

Build an evidence-backed event/rule map: actor or trigger → requested action →
applicable rule → business event or observable result. A business event describes
something that happened; it need not be a broker message. Cover relevant rejection,
cancellation, retry and partial-failure paths as well as success. Include queries,
operator actions and batch jobs through their results and access rules even when
they emit no event. Mark paths not inspected instead of inventing outcomes.

For each discovered feature, identify its user/operational result, rule owner,
trigger, allowed/rejected behavior, failure guarantees and external boundaries.
Read enough of the connected source and tests to distinguish implemented behavior
from declarations. Event mapping does not authorize conversion to event-driven
architecture or event sourcing.

### 2. Review business boundaries

Build a context map from changes in term meaning, rule ownership, data-change
authority, external contracts and conditions that must hold together. Event
adjacency, shared storage, service or repository boundaries alone do not establish
a bounded context. Distinguish observed coupling from a proposed boundary and
preserve already confirmed grouping. Collect material ownership ambiguity with
the other intent questions.

Within each context, group by vertical slice or user story from actor/event to
result. Do not split features into frontend/backend/API/database ADRs or invent
a screen for a headless job. A consistency boundary is evidence for grouping,
not an automatic one-to-one context boundary.

### 3. Extract decisions and contract candidates

Apply the **ADR admission gate**. A replaceable library, helper, folder layout,
adapter or tuning choice does not become an ADR merely because it exists.
Preserve reproducible feature contracts and independent durable decisions;
one feature may need several ADRs, and a shared contract has one actual owner.
Use the **decision identity check** to reuse an existing owner even when names
or alternatives differ. Never create a duplicate decision or a placeholder to
fill an index or dependency edge.

Apply the **requirement gate → code-readthrough test → litmus test** in order.
Keep exact observed limits and units, required inputs, permissions, visibility,
allowed states and transitions, ordering, uniqueness and failure behavior as
contract candidates. Do not treat every observed constant or passing test as
proof of a requirement. Distinguish:

- established intent/requirements already supplied by the user or an adopted ADR;
- observed implementation behavior with its source evidence;
- proposed contracts and current reasons for retaining that behavior;
- unknown or conflicting intent that requires a user decision.

Do not invent original motivations, business pressures, historical alternatives,
or adoption dates. A user can establish a current reason to retain a behavior
without claiming it was the original reason. Preserve that distinction in Purpose,
Drivers and Alternatives. Do not discard an exact rule merely because its
historical reason is unknown; show the candidate and ask whether it must remain.

When accounts conflict, read
[decision reconciliation](../../../references/decision-reconciliation.md). Prefer the later
recorded or committed semantic change to the same obligation; current user intent
overrides that default. Newer code alone does not approve a contract change.

Account for every discovered feature in the report: covered by an existing owner,
new/changed ADR candidate, implementation-only item, or deferred for missing
evidence/intent. State the inspected and uninspected scope; do not claim complete
project coverage when some input was inaccessible. This inventory is disposable,
not another persistent architecture or code-to-ADR registry.

### 4. Establish contract prerequisites

Draw the decision-level prerequisite graph, identifying existing ADR owners or
report-local candidate IDs and the guarantee required on each edge. Ask of each
edge: which guarantee from B is necessary to satisfy A's contract? Distinguish
business interaction, context relationships and contract prerequisites. Calls,
event chronology, request/result round trips, imports and convenient work order
alone do not establish a prerequisite. Label arrow direction explicitly. If no
prerequisites are established, show isolated decisions or state that result;
do not manufacture edges to fill a diagram.

Check how the decision-level relationships project into the existing category
`dependsOn` graph. Individual ADR records are indexed, but `dependsOn` targets
category keys. Do not silently change that schema or claim it encodes exact
ADR-to-ADR edges. Explain relationships within a category in the working report
without creating self-edges. If grouping introduces a cycle or distorts the
required guarantees, keep the affected document apply pending and collect the
ownership/prerequisite question while continuing independent candidates.

For a cycle or a distorted category projection, read
`${CLAUDE_PLUGIN_ROOT}/references/import-cycle-resolution.md`. Preserve the
observed relationship and compare three contract-level options: extract an
independent shared concept, merge one inseparable decision, or orient the base
contract around an existing owner. Show inapplicable reasons and a supported
recommendation with contract ownership and before/after graphs. An interface,
new label or renamed link does not resolve a decision prerequisite. Prepare all
independent cycle groups before the single domain-grouped question report.
