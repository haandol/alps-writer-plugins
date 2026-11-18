---
name: adr-import
description: Adopt ADRs in an existing codebase through evidence-based event mapping, context boundaries, decision candidates and prerequisite analysis, then collect intent and contract confirmation in one report. Use adr-sync to reconcile an already documented decision.
argument-hint: "[project-path-or-feature-scope]"
---

# adr-import

Use existing evidence to identify decisions and their approval scope. For an imported Proposed decision, identify the next implementation prerequisite or verification step; import itself does not establish completion. Follow the [acceptance and next-action guidance](../../references/non-invasive-harness.md#acceptance-and-the-next-action).

Bring an existing project into the ADR workflow without requiring a product
planning document. Discover features from repository evidence, ask for the
intent code cannot establish, and record confirmed contracts through the
plugin's existing authoring path. Import documents the application; it does not
implement, refactor, deploy, or operate it.

Talk to the user and write documents in their language. Keep source evidence,
inferred candidates and confirmed requirements distinguishable throughout.

Distinguish an existing empty index from a missing one when describing the
starting point. Use Ontology Writer's query for model facts.

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
needed; where `docs/ontology/` holds Turtle documents, apply
`${CLAUDE_PLUGIN_ROOT}/references/glossary.md` to the business terms adopted ADRs
rely on. A corrupt index is a reported repair question, not permission to replace
it; independent source discovery may continue.

When `docs/ontology/` holds Turtle documents, read
`${CLAUDE_PLUGIN_ROOT}/references/business-context.md` before confirming each
adopted ADR's contract. Without them, skip it.

## Discovery

For in-scope behavior, use [discovery](references/discovery.md) to establish
workflow evidence, boundaries, decision candidates and prerequisites. Reuse
current evidence and deepen only the paths that affect a candidate.
If sources conflict, use [decision reconciliation](../../references/decision-reconciliation.md).

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
State each confirmed prerequisite guarantee and its owner in the dependent ADR's
Relied-on boundary at decision resolution, including within-category relationships; a Related link
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
