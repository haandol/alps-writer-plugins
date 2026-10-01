---
name: adr-import
description: Adopt ADRs in an existing codebase through evidence-based event mapping, context boundaries, decision candidates and prerequisite analysis, then collect intent and contract confirmation in one report. Use adr-sync to reconcile an already documented decision.
argument-hint: "[project-path-or-feature-scope]"
---

# adr-import

Bring an existing project into the ADR workflow without requiring a product
planning document. Discover features from repository evidence, ask for the
intent code cannot establish, and record confirmed contracts through the
plugin's existing authoring path. Import documents the application; it does not
implement, refactor, deploy, or operate it.

Talk to the user and write documents in their language. Keep source evidence,
inferred candidates and confirmed requirements distinguishable throughout.

## Discover the project and scope

With no argument, inspect the current repository as a whole. A project path
selects that local project; a feature scope narrows document candidates while
allowing inspection of neighboring behavior needed to understand its contract.
Ask for a target only when it cannot be determined from the request and current
workspace. Do not narrow an entire-repository request to the first package found.

Read `${CLAUDE_PLUGIN_ROOT}/references/feature-boundaries.md` before grouping.
Identify repository organization (monorepo/multirepo) separately from execution
and deployment shape (monolith/microservices/hybrid), with evidence and unknown
scope. Inspect available project instructions, README, manifests, entry points,
deployment/configuration files, relevant source and tests. Prefer authored source
over generated bundles when both exist. Follow actual behavior across layers
instead of treating directories or imports as the feature list.

Report inaccessible related repositories and unclear deployment claims;
do not clone repositories, contact live systems, or discover credentials.
Local checks are allowed only when known not to contact external services.

Read the full `docs/adr/.mapping.json` when present and relevant ADR bodies
before allocating names or numbers. Also inspect existing numbered documents
when the index is absent or incomplete. Use repository authoring rules when
present, otherwise the plugin templates. Read an existing glossary only when
needed. A corrupt index is a reported repair question, not permission to replace
it; independent source discovery may continue.

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
`${CLAUDE_PLUGIN_ROOT}/references/decision-reconciliation.md`. Prefer the later
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

## Ask once through the report

Read `${CLAUDE_PLUGIN_ROOT}/references/decision-questions.md` and apply the local
`../report-writer/SKILL.md`. Finish independent investigation and reviewable
drafts before asking. For each candidate, show the observed flow, business
boundary, complete proposed contract, rationale already known, and the missing
intent or conflict question. Give each question a visible report-local ID.
Known answers need no repeated question; collect the remaining candidates in
one domain/feature report so the user can answer together.
For cycle questions, group by domain and bounded context and handle a
cross-context cycle once with all affected owners. Do not ask after each ADR,
cycle or context; collect all remaining questions in the same report. Keep exact
contract changes and any document moves/removals in that approval scope.

Make the workflow map, context map, decision candidates and prerequisite graph
reachable in that same report, grouped by business scope. Use Mermaid sequences
for meaningful request/result timing and flowcharts for boundaries or dependency
relationships, retaining source and rendered views in HTML. Connect each
candidate to the observed workflow, boundary basis and required guarantees.
Keep confirmed facts, inferred candidates and unknowns visible in each view;
the maps alone are not contract approval. Reuse known answers and ask only about
material gaps, not for four separate stage approvals.

Draft in an ignored per-run directory. Use `/adr-new`'s authoring rules and
R18a/R19 checks to make each candidate independently readable. The proposed ADR
must explain the current decision and rationale, retain exact required values
and rules, and include implementation-independent observable evidence. Keep code
paths, signatures, module layouts and recovered implementation detail in working
evidence. Never use guessed history to fill required sections for a lint pass.
Use the canonical `### Requirement contract` heading under Decision and keep
every obligation and its observable evidence beneath it, using `####` groups as
needed. Otherwise downstream coverage cannot enumerate the contract reliably.

Prepare a complete candidate tree for validation, including the proposed index
and necessary related records. Run the structure checker with that tree as the
working directory so repo-relative index paths resolve inside the candidate.
Unresolved contracts remain drafts, with their validation/intent gaps visible;
do not save them as finalized decisions just to complete the batch.

Combine exact new/changed contract confirmation with the intent questions.
Reuse explicit approval already covering the same content and scope. A reply
that supplies a reason but defers contract approval is not permission to save.
Do not pause after every feature or ask the user to approve a list before the
concrete drafts exist. Open a single report with the default OS opener, not an
automation browser; browser automation verification is opt-in.

## Apply confirmed answers and finish

Associate the reply with its exact decisions and scope. Follow the shared
question workflow for partial answers, changed contracts, and concurrent edits.
Keep missing, ambiguous or conflicting answers pending while completing
independent authorized work. Ask again only for newly material changes or
remaining unresolved questions.

For a new owner, use the plugin-local `../adr-new/SKILL.md` with the confirmed
intent, exact contract, alternatives, observable evidence and approval scope.
Do not restart its interview. For an existing owner, reuse its path and number;
apply only the confirmed semantic difference under the existing authoring/sync
rules. If meaning is unchanged, leave its body, Date, Status, summary and index
unchanged. A repeated equivalent import is a no-op, including its glossary and
decision log.
Before saving a confirmed candidate, remove obsolete approval-pending wording
from its purpose, choice, rationale and consequences. Preserve genuine unknown
history as unknown; Proposed describes the completion lifecycle, not a missing
contract approval. Keep the confirmed current reason readable on its own.

Every **new ADR starts Proposed**, even when the code and tests already exist.
For changed existing decisions, use the exact-path Status transition helper when
the lifecycle requires Proposed; keep unchanged Accepted decisions unchanged.
Import never auto-promotes to Accepted or invokes implementation to obtain that
status. The existing completion cycle owns implementation, tests and final review.

Keep the index's existing schema: category, human-readable feature name, ADR
path/status/summary and real prerequisite categories. Use at most two category
segments under the bounded-context model. `dependsOn` expresses a needed behavior
or contract prerequisite, not an import statement or convenient processing order.
Check that references exist and the graph has no cycle or self-edge before saving.
Do not add code paths, scan inventories, approval records or upstream document
references. Preserve unrelated entries and already established glossary meanings.
Persist confirmed meanings, boundaries and exact contracts in their owning ADRs.
State each confirmed prerequisite guarantee and its owner in the dependent ADR
at decision resolution, including within-category relationships; a Related link
alone does not explain the guarantee. The documents must remain readable and
their prerequisite relationships recoverable without the disposable maps.

Recheck source and destination changes before each approved apply. Preserve other
work and refresh affected candidates rather than overwriting them with old report
results. Update each ADR and matching index entry consistently, and record only
verified major semantic transitions in the decision log. Initial discovery is not
a fabricated history of why the application was built.

Run the structure/link/index checks on the resulting authorized scope, then reread
the decisions against the confirmed contract. Report created, updated, unchanged
and deferred features together with real checks and uninspected scope. On partial
failure, name the actual applied state and preserve remaining source material;
repair only within approval. Do not claim the full import complete while a
required contract, question or validation remains unresolved. Continue directly
after answers rather than asking another routine permission to proceed.
