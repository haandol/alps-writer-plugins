---
name: feature-to-adr
description: Helper — transfer an ALPS feature's complete implementation contract into one or several ADRs, leaving the PRD as a legacy planning document after handoff. Explicit re-import compares a changed PRD with the authoritative ADRs and applies only semantic contract changes. Requires an existing ALPS PRD and the adr-writer plugin.
argument-hint: "[category-or-feature-id?]"
---

# feature-to-adr

> **Reports**: Before human-facing reports, apply [report-write](../report-write/SKILL.md).

Transfer ALPS feature specifications at the PRD → ADR ownership boundary. This
skill owns ALPS-side discovery, complete requirement transfer, and explicit
re-import comparison. ADR authoring remains delegated to `/adr-new` in the
separate `adr-writer` plugin.

**After a successful handoff, ADRs are the only implementation authority.** The
PRD remains on disk as a legacy planning document, but normal implementation,
review, and sync do not read it.

**Cardinality:** every transferable, implementable Feature produces one or
several ADRs. At least one ADR owns the Feature's reproducible requirement
contract; additional independent durable decisions remain separate ADRs. A
source item that contains only a replaceable implementation swap and no product
contract is implementation discretion, not a transferable Feature and not a
placeholder ADR.

> **Language**: talk to the user and write ADR content in the language the user
> writes in. User-facing wording below is guidance, not a literal string.

> **Non-invasive harness**: durable context must finish in the owning PRD or ADR
> level. Transfer inventories, comparison notes, tool ordering, and model
> orchestration are disposable and must not become a hidden handoff registry or
> a prerequisite for using the artifacts after plugin removal.

## 1. Load and validate the ALPS input

Confirm that `/adr-new` is available. If adr-writer is not installed, stop and
give the client-specific installation command.

Load:

- the current ALPS document
- every section needed to understand the selected Feature's motivation and
  observable behavior
- the feature-level specification
- the requirements summary, measurable NFRs, non-goals, and feature dependency
  graph
- the high-level architecture constraints and external boundaries
- `docs/adr/.mapping.json` when it exists
- the optional trailing Glossary Appendix and any supplied term explanations needed
  by the selected Features; read `docs/adr/glossary.md` if it exists

Parse the dependency graph before processing features:

- A self-edge is invalid input. Stop and ask the user to correct the graph;
  never ignore it.
- A cycle is invalid input. Show the cycle and stop before writing ADRs or
  mapping edges.
- A missing Feature referenced by an edge is invalid input. Stop before
  writing.

The graph is source material. Transfer only prerequisites that the implementation
must preserve; do not treat code reuse or convenient work order as a durable
dependency.

## 2. Select the Feature queue

- With no argument, inspect every Feature in dependency topological order.
- With an argument, inspect that Feature and its transitive prerequisites in
  topological order.
- If the user explicitly asks to inspect only one Feature, still show its
  prerequisites as handoff context.

Derive each category key canonically from the Feature name. Use a two-segment
`<context>/<feature>` key only when the PRD already supplies the grouping or the
user explicitly requests it. Never invent a bounded context, and never use a
technical layer name as either segment.

## 3. Enrich gaps and preflight a complete ownership transfer

Carry qualifying jargon, uncommon terms/acronyms, and expressions that cannot be
written out plainly into `docs/adr/glossary.md` when the selected transfer needs
their meanings. Reuse already confirmed definitions; ask about an unclear meaning
before finalizing dependent contracts. Include new or changed meanings in the
existing ADR approval and pass them to `/adr-new` so it does not repeat questions.
Create the Markdown glossary only when needed, with term and meaning columns.
Preserve unrelated entries and existing layout; equivalent meanings are no-ops.
Resolve conflicting definitions with the user before overwriting them or completing
the affected handoff. Do not introduce DDD or domain classification.

Transfer definitions without PRD paths, Section IDs, or source links. Keep short
explanations and all requirement values, states, permissions and success conditions
in their owning ADR bodies. The glossary is ADR-level supporting material, not an
ADR or a mapping entry. After handoff it is maintained with the ADRs, without
reading the PRD during ordinary implementation. Explicit re-import also compares
term meanings: equivalent input leaves the glossary unchanged; a changed or
removed definition requires checking affected contracts rather than automatic
replacement or deletion.

A PRD is expected to be less specific than an ADR. Do not treat every missing
ADR-resolution fact as an immediate blocker, and do not copy the PRD into an ADR
unchanged. Before final classification, run a **gap-driven enrichment** pass.

Start with the regeneration test: if the PRD disappeared after handoff, identify
which missing fact could let rebuilt code violate the Feature contract or leave
the adopted architectural decision unknowable. Probe these areas only when the
loaded source does not already establish them:

- requirement values and their basis
- allowed values and transitions, mandatory inputs, permissions, visibility,
  ordering, uniqueness, and units
- success invariants, rejection behavior, and failure guarantees
- system, data, security, and external-provider boundaries
- fallback and degradation policy
- discriminating Decision Drivers, realistic alternatives, and
  decision-changing assumptions
- implementation-independent observable evidence for each obligation

Do not ask for facts whose change would preserve the contract and durable
boundaries. Replaceable libraries, SDKs, frameworks, adapters, module layout,
credential wiring, identifiers, schemas, and tuning values remain
implementation discretion.

Classify each discovered gap before asking:

1. **Already established** — another loaded PRD section or an existing owning
   ADR answers it. Carry it forward without asking again.
2. **Enrichment question** — the missing answer could change compliant user
   behavior, a requirement contract, a durable boundary, or the adopted
   decision. Ask only for that gap.
3. **Implementation discretion** — a developer may choose it while preserving
   the contract and boundaries. Exclude it without asking.
4. **Contradiction** — loaded sources assert incompatible obligations. Show the
   conflict and ask which one is intended.

Before interpreting delegated choices, read
`${CLAUDE_PLUGIN_ROOT}/references/requirement-delegation.md` completely.
Ask only for unresolved protected choices, or present a grounded proposal with
its basis and trade-offs for the existing ADR approval. Reuse supplied answers.
For architectural choices, offer up to three realistic alternatives when useful.
Keep proposals unapproved until confirmed; delegation does not turn a requirement
into implementation tuning. Never invent an approved value, boundary or rationale.

Treat confirmed answers as ephemeral handoff input. Do not persist a separate
enrichment report or registry, and do not silently rewrite the PRD. Update the
PRD only when the user explicitly requests it or accepts a Feature split that
changes the Section 6 and Section 7 boundaries. Repeat the enrichment pass until
there are no open questions, or until the user defers an answer that the
complete transfer requires.

After enrichment, classify every relevant source item and confirmed answer into
exactly one final route:

1. **ADR-owned** — motivation, a discriminating Driver, requirement contract,
   domain invariant, state/permission rule, system/data/security boundary,
   external provider or fallback, adopted algorithm, consistency model, durable
   trade-off, or implementation-independent observable evidence.
2. **Implementation discretion** — replaceable libraries, SDKs, frameworks,
   middleware, module structure, credential/auth wiring, signers, adapters,
   tuning values, names, signatures, schemas, and other code-level choices that
   preserve the same contract and boundaries.
3. **Legacy planning context** — narrative, workshop history, duplicate
   explanation, and other material whose loss cannot change a compliant
   implementation.
4. **Unresolved** — a required enrichment answer the user deferred, a
   contradiction the user did not resolve, or unowned material that could
   change user behavior, a requirement contract, a boundary, or the adopted
   decision.

Apply the ADR admission gate independently to each durable decision. Apply the
requirement gate before excluding any requirement value or rule. The Feature's
reproducible requirement contract itself passes admission and must have an ADR
owner even when every library or adapter choice remains implementation
discretion.

The transfer inventory is ephemeral. Do not store it in the PRD, ADR,
`.mapping.json`, or a handoff registry.

Preflight succeeds only when:

- no enrichment question remains open
- every implementation-relevant item has one route
- `Unresolved` is empty
- every requirement value and non-numeric rule has an ADR owner
- every transferable Feature has at least one real contract-owning ADR
- independent decisions are split rather than combined
- the proposed ADR set passes the regeneration test without reading the PRD

Show a compact result before drafting:

```text
Feature: <name>
Comprehension load: <N>/10

ADR-owned:
- <contract or decision> — owner: <existing ADR | new candidate>

Implementation discretion:
- <replaceable choice>

Legacy planning context:
- <non-implementation context>

Enrichment needed:
- none | <targeted question and why the ADR needs the answer>

Unresolved:
- none | <blocking item>

Transfer coverage: <covered>/<implementation-relevant items>
Result: ASK | BLOCKED | 1 | N ADRs
```

When enrichment questions remain, report `Result: ASK`, ask them, and resume
this preflight after the answer. Do not label an answerable PRD gap as final
`BLOCKED`. If anything remains unresolved or unowned after enrichment, stop
before writing ADRs and report `Result: BLOCKED`. Do not report the Feature as
transferred.

Before scoring the Feature or ADR candidates, read
`${CLAUDE_PLUGIN_ROOT}/references/comprehension-load.md`
completely and apply its advisory score to each item.

When the Feature scores 8/10 or higher, offer up to three Feature split
candidates before transfer and explicitly offer keeping the original Feature.
The proposal is advisory and never blocks drafting, approval, or transfer. Split
a Feature only at independently observable user-behavior boundaries. If the user
chooses a split, update the corresponding Section 6 and Section 7 Feature
boundaries together before transfer.

Only when the user asks to split ADR work, offer up to three ADR candidates.
Split ADR work only when it contains independent decisions; keep one inherently
difficult decision in one ADR and offer implementation steps instead. Never
split by frontend/backend/data layers, and never make splitting a prerequisite.

## 4. Transfer a new Feature

Run the adr-writer decision identity check across the full mapping before
allocating a new ADR. Match by the architectural question and owned requirement
or system/data/security/external boundary, not by the current provider, product
name, adopted alternative, or direction of change.

For each new admitted owner, invoke `/adr-new <category>` separately. Never
combine independent decisions just because they came from one Feature.

Pass:

- the category key
- the candidate decision and its business motivation
- discriminating NFRs and architecture constraints
- requirement values and non-numeric rules verbatim with their basis
- user-observable behavior, failure guarantees, related non-goals, and
  implementation-independent observable evidence
- confirmed enrichment answers, realistic alternatives already considered, and
  decision-changing assumptions
- feature-scope hints for locating the vertical slice, without storing code
  paths

Tell `/adr-new` which elicitation items are already established so it does not
ask the same questions again. It may ask only for a newly discovered gap. A
Feature handoff must remain complete: do not accept "leave it blank and fill it
during implementation" for a missing contract, durable boundary, or adopted
decision; return to the enrichment pass instead.

Do not copy user stories or acceptance criteria as prose into the ADR. Absorb
their motivation and independently reviewable obligations at ADR resolution.

The `/adr-new` path owns drafting, verification, mapping registration, user
approval, and the initial `Proposed` Status.

A Feature's ownership transfer commits only after all of its ADR owners are
approved and saved, every contract item has an owner, and mapping validation
passes. Until then, the PRD remains authoritative for that Feature and
implementation must not start from a partial ADR set. After commit, the PRD
scope is legacy planning context and ADRs alone drive implementation.

## 5. Explicitly re-import a changed PRD

Do not continuously reconcile PRD and ADR content. Enter this path only when
the user explicitly asks to re-import a changed PRD.

The current ADR set is the target-state authority during comparison. Read all
plausible owning ADRs and compare semantic obligations, not wording:

- requirement values and their basis
- allowed value sets and transitions
- mandatory fields
- permissions and visibility
- ordering, uniqueness, units, and failure guarantees
- NFRs and architecture constraints that discriminate between alternatives
- system/data/security/external boundaries and fallback policy

Classify each difference:

- **Semantic no-op** — wording, order, examples, or explanation changed while
  the obligations and decision remain the same. Do not edit ADR files,
  `.mapping.json`, Status, or decision logs.
- **Existing decision changed / contract changed** — propose an edit-in-place to the ADR that
  already owns the decision identity. The current ADR remains authoritative
  until the user approves the changed contract; then route implementation
  through `/adr-impl <owning-category>`.
- **New durable contract or decision** — run the decision identity check. Update
  an existing owner when one exists; invoke `/adr-new` only for a genuinely new
  decision identity.
- **Source contract removed** — never delete or weaken the ADR automatically.
  Ask whether the removal is an intended contract change.
- **Implementation-only change** — leave it to code and do not mutate an ADR.
- **Unresolved conflict** — block the re-import without changing the current ADR
  authority.

Re-import is idempotent:

> Importing the same PRD against the same ADR state repeatedly must produce no
> ADR, mapping, Status, or decision-log changes.

Do not rewrite an ADR merely to mirror new PRD phrasing. Do not store PRD paths,
section numbers, Feature IDs, semantic fingerprints, approval state, or import
reports in ADR bodies or `.mapping.json`.

This comparison belongs to alps-writer. adr-writer remains standalone and never
reads the PRD itself.

## 6. Record implementation prerequisites

After every ADR owner exists, derive category-level `dependsOn` edges from
implementation prerequisites.

Record an edge only when:

- the target category already exists in `.mapping.json`
- the current Feature cannot satisfy its contract meaningfully before the
  target Feature contract is implemented
- the edge remains acyclic

Do not create edges for shared SDKs, helper reuse, preferred work order, or
technical-layer sequencing. Never create an empty placeholder ADR. Every
dependency target from a completed handoff is a real contract-owning category.

## 7. Approval and completion

Show the requested scope and dependency order as a non-blocking progress update.
Do not request another approval merely because two or more Features are queued.
Ask only when the target, added cost, or a protected decision remains unresolved.
Each new or changed ADR still uses the adr-writer path's own baseline approval.

At completion report:

- Features whose ownership transfer committed
- transfer coverage for each committed Feature
- existing ADRs changed by category
- ADRs created by category
- explicit re-import semantic no-ops
- removals or conflicts left unresolved
- implementation discretion and legacy context excluded from ADRs
- actual ADR `dependsOn` edges written
- that committed PRD scopes are now legacy planning documents and normal
  implementation reads only ADRs

Do not persist this report as another source of truth.

If the user says "implement without an ADR", apply the admission gate:

- A source item containing only implementation discretion → comply without an
  ADR.
- A transferable Feature contract or another admitted decision exists → explain
  that handoff must complete first. If the user still declines, comply but
  report the specific unrecorded contract; do not tell `/adr-sync` to
  manufacture an ADR later from code.
