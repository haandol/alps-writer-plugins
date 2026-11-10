---
name: ontology-view
description: Open an offline, read-only business ontology explorer with the same three layers in EventStorming and 3D — domains/bounded contexts, actual business processes, and realizing functional ADRs. Preserve authored facts, shared responsibilities, source verdicts, realization precision and missing evidence; stop at the ADR contract. Use for ontology viewing, browsing, visualization and 3D navigation.
argument-hint: "[--include-retired]"
---

# ontology-view

This view is a navigation screen, not a review, evaluation or analysis report:
the report-writing contract does not apply, only its delivery rules. The view
never edits the model, the ADR index or ADRs, and it has no saving behavior.

The ontology guides actual business structure through functional ADR contracts
into code organization. The viewer follows that direction: **domain/BC → business
process → realizing functional ADR**. A process is the business container; existing
ADR categories and source folders must not define or replace business units.
Shared processes and ADRs keep one identity across their participating BCs.

**EventStorming** and **3D business structure** are two projections of this same
hierarchy. They share scope, search, page, selection and return path at every
layer. Selecting a BC expands its area and reveals its actual processes;
selecting a process reveals its realizing ADRs. Read business detail and ADR
contracts on a flat surface. Navigation stops at the ADR, before source code.
Pan, rotation, zoom and reset stay page-local; transitions honor reduced motion,
can be disabled and stop while hidden. Spatial height, area and placement never
add business order, importance or ownership facts.

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs view [--include-retired] [--lang en|ko] \
  [--no-open | --browser <name>] [--draft DIR] [--mapping FILE] [--board FILE]
```

- Use `--lang ko` when the user writes Korean; other languages use English labels.
- Include `Deprecated` and `Superseded` processes only when the user asks for
  them (`--include-retired`); they are marked retired.
- By default the file is written to a fresh, Git-ignored `.adr-review/` run
  directory and opened once in the default browser. Honor a request not to open
  it (`--no-open`) or to use a specific browser (`--browser <name>`).
- Report the absolute path the command prints and whether it opened. When
  opening fails, report the actual reason with the path.
- Without model documents the command creates no view; say that the repository
  has no business ontology. An explicit `--draft DIR` previews an unadopted model
  without saving it. Use `--mapping FILE` for its proposed realization links.
- `--board FILE` supplies validated disposable business evidence, including domain
  memberships and entity/view candidates. Preserve its source verdicts; it does
  not approve or save model facts. Never infer domains by matching ADR folders.
- For a draft, distinguish its current contents from committed-model history.
  Existing `#all`, BC and element addresses enter the common hierarchy.

The view shows validation errors at their positions and marks the parts they
affect as incomplete; it marks uncommitted model edits and unsynced direct edits
of `Accepted` processes. A step is shown as implemented only when every realizing
feature has an `Accepted` ADR and no `Proposed` ADR; outside-system steps are not
realized by features, and a system step without a realizing feature is marked
unrealized. Realization is computed when the view is generated and is never
stored.

Search the current layer by name, identifier or business wording, or select
**Business knowledge** to find internal facts with their process and BC scope.
Every layer has finite pages. Unknown membership stays apart; shared work and
other BCs' participation stay explicit. Return to the previous search, page and
camera after inspection, including with keyboard and narrow-screen navigation.

ADR associations follow existing `realizes` links. A category-level association
does not establish that every ADR in that category directly implements each
step. Show the actual precision, shared associations, missing documents and
Status inconsistencies. Only indexed Markdown inside the real ADR root is read;
symlink escapes and other file types are rejected. Render text inertly and do
not offer a source-code explorer or execute document contents.

The view must explain the business without requiring a memorized icon legend:
show the performer and used object on each activity, its incoming event and
recorded reaction condition (including events from other contexts), and its
emitted fact. Selection is an inspection affordance, never a business state.
Do not infer state transitions from a used concept or infer a human actor from
a generic Actor type. Missing conditions or transitions stay unrecorded or
unverified. The context inspector should read as a business outline, with routes
to upstream/downstream work and evidence.

The initial screen contains the authored **BC knowledge layer** and supplied
domain evidence: names, responsibilities, core business logic and collaborations.
Only create the selected layer and requested details. Missing upper knowledge
stays missing; never generate it from a lower layer merely to fill the UI.

Within a selected process, open the scoped EventStorming canvas to inspect its
activities and direct external hand-offs. Candidate boards without a model keep
their event-first entry. Its primary trace reaches the next emitted event, with explicit
intermediate-action checkpoints where no event is recorded. Project only the
supplied stage relationships through their producing actions; do not add links
to make a story appear continuous. Connection labels retain reaction versus
action-order meaning and open the original policy, condition, action and
evidence. Selecting an event highlights its actual predecessors and successors,
with sibling branches kept separate. The All paths control clears that focus.
Events are the principal trace units. Read each set from its performer/action
through an evidenced business-object change to its emitted event. Show sourced
input and result views in their corresponding roles, with evidence; absent views
stay unrecorded. Automated, timer and external activities need not involve a human
or UI. View association does not establish direct causation or update timing.
Retain incoming policies and exact conditions. Read the whole business
story across contexts before opening the boundaries. Keep branches, merges,
returning links and independent items; layout is not a timestamp or proof of an
unrecorded causal relation. A command-only step must not acquire an invented event.

Show applicable business rules near their related work and preserve the rule's
actual scope. A rule on a used concept is not proof that the current action
enforces it or that the concept is an aggregate. Put recorded open paths beside
the flow, distinguishing process-wide questions from step-level questions. A
process-wide unknown is not a confirmed failure branch at one event. Keep its
source and verdict visible through disclosure.

Both representations expose the same model elements and relations. Domain
memberships require provided identities and evidence, may be multiple, and stay
unconfirmed when absent. Same-name BCs remain distinct. Read actual step ownership
from model facts, not physical placement. A scoped event-board inspector opens
its source step in the common business-detail panel.

The event flow keeps a readable, untilted order while using restrained depth and
surface styling. Its subtle moving strokes follow recorded event reactions only,
never sequence-only relations or steps with no recorded emitted event. They do
not represent live traffic or execution. Provide pause/resume, honor reduced
motion, and stop while hidden or outside the viewport. Use a readable moving
trail and show the actual playback/pause reason, including reduced motion and
no eligible reactions. Pause/play applies across both event perspectives.

Both model views keep their camera, position and selection in the page; reopening
starts fresh, without browser persistence. Candidate boards provide the event
trace, sourced business areas and complete source cards. They do not invent a
model's process hierarchy or realization status. Preserve supplied context descriptions in the source
cards even when no saved model exists.

Per-process readiness and next-action requests distinguish model sufficiency,
ADR contract review and actual execution evidence. Entity changes without source
evidence stay unknown; a `uses` relation is not a confirmed mutation. The view
runs no commands and records no review result. Existing diagrams remain additional
ways to inspect the same saved model.

When the user asks for entity/aggregate transitions, domain/subdomain boundaries
or input/result views, do not stop at the reconstruction's missing metadata.
Read the relevant business-context query,
the realizing ADRs and supplied business evidence; assemble the sourced working
board using `references/eventstorming-board.md`. Preserve exact states from
their ADR owner without copying a state machine into the model. Mark unresolved
or contradictory before/after conditions visibly; neither an ADR state name nor
a `uses` edge alone proves a transition. Render and deliver that board. This is
read-only evidence preparation, not approval of a model change.
Preserve sourced domain/context identities, subdomain classifications and explicit
memberships in that disposable board. Do not infer external contexts from actors
or fill missing memberships by matching names. The saved model has no Domain,
Subdomain or View types; do not silently extend its vocabulary for a visualization.

For a request to inspect EventStorming discovery, use `/ontology-build` and
`references/eventstorming.md` to show its event map, evidence and boundary
candidates. Use `references/eventstorming-board.md` to render a candidate board even before
a model exists. The `view` command reconstructs the saved model; it does not
recover workshop history or candidate source verdicts. Do not claim the 3D projection
is evidence of the discovery process or that an unavailable view mode exists.

To add source information, use `/ontology-build`; for a natural-language change,
use `/ontology-edit`; after direct Turtle edits, use `/ontology-sync`.
For process completeness/readiness, request `/ontology-sync`'s read-only review;
for actual execution alignment, use `/ontology-align`. State these routes when
relevant to the user's request. A realization badge computed from ADR Status is
not proof of business completeness or current execution success.
