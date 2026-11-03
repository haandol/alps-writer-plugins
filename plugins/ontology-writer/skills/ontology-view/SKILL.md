---
name: ontology-view
description: Open a read-only standalone HTML view of the business ontology — an EventStorming board with entity changes and evidence, workflow-readiness guidance, a 3D business city of the landscape, an explorer that finds every element and lists it by bounded context, the business landscape (bounded contexts, processes and the events and policies between them), each process flow, and element details with realization status computed from the ADR index — so the user can find what to change and then ask for it in natural language or edit the Turtle directly. Use when the user asks to see, browse or visualize docs/ontology. Keywords - "/ontology-view", "온톨로지 보기", "업무 흐름 시각화", "온톨로지 탐색", "3D", "ontology view".
argument-hint: "[--include-retired]"
---

# ontology-view

This view is a navigation screen, not a review, evaluation or analysis report:
the report-writing contract does not apply, only its delivery rules. The view
never edits the model, the ADR index or ADRs, and it has no saving behavior.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs view [--include-retired] [--lang en|ko] \
  [--no-open | --browser <name>]
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
  has no business ontology.

The view shows validation errors at their positions and marks the parts they
affect as incomplete; it marks uncommitted model edits and unsynced direct edits
of `Accepted` processes. A step is shown as implemented only when every realizing
feature has an `Accepted` ADR and no `Proposed` ADR; outside-system steps are not
realized by features, and a system step without a realizing feature is marked
unrealized. Realization is computed when the view is generated and is never
stored.

Beside the document, an explorer finds any element by name or identifier and
lists every element under the bounded context it names, each process with its
steps in flow order; elements that name no context are listed apart. A 3D
business city shows each bounded context as a district and each process as a
tower with one floor per step, from the bottom in flow order, lit by the step's
realization; events and policies float beside the floors that emit them or that
they start, with an arc for each trigger. A roof opens the process flow and a
floor, orb or diamond opens the details. Everything the city shows is also in
the lists, diagrams and details. Diagrams are drawn as they come near view; a
large landscape diagram is drawn when the reader asks for it, while the city
and the lists show the same facts. Its motion pauses on request and never starts
when the reader prefers reduced motion.

The view must explain the business without requiring a memorized icon legend:
show the performer and used object on each activity, its incoming event and
recorded reaction condition (including events from other contexts), and its
emitted fact. Selection is an inspection affordance, never a business state.
Do not infer state transitions from a used concept or infer a human actor from
a generic Actor type. Missing conditions or transitions stay unrecorded or
unverified. The context inspector should read as a business outline, with routes
to upstream/downstream work and evidence.

The first selected tab is **Event flow**, a flat, draggable EventStorming
canvas. Events are the principal reading units, with their producing actions
and performers, incoming policies and exact conditions. Read the whole business
story across contexts before opening the boundaries. Keep branches, merges,
returning links and independent items; layout is not a timestamp or proof of an
unrecorded causal relation. A command-only step must not acquire an invented event.

Show applicable business rules near their related work and preserve the rule's
actual scope. A rule on a used concept is not proof that the current action
enforces it or that the concept is an aggregate. Put recorded open paths beside
the flow, distinguishing process-wide questions from step-level questions. A
process-wide unknown is not a confirmed failure branch at one event. Keep its
source and verdict visible through disclosure.

The model has only two projections: **Event flow** and **Business structure**.
The existing 3D business structure owns the context districts, process towers,
step floors and event/policy hand-offs. Do not provide a duplicate context-map
view. Selecting a source step from the event inspector leads to the same model
step and its details in Business structure. Context identities remain distinct
even when their labels match; actual step ownership is read from model facts,
not inferred from a process tower's physical placement.

The event flow keeps a readable, untilted order while using restrained depth and
surface styling. Its subtle moving strokes follow recorded event reactions only,
never sequence-only relations or steps with no recorded emitted event. They do
not represent live traffic or execution. Provide pause/resume, honor reduced
motion, and stop while hidden or outside the viewport.

Both model views keep their camera, position and selection in the page; reopening
starts fresh, without browser persistence. Candidate boards provide the event
flow and complete source cards only. They do not invent a business structure
or add a duplicate map. Preserve supplied context descriptions in the source
cards even when no saved model exists.

Per-process readiness and next-action requests distinguish model sufficiency,
ADR contract review and actual execution evidence. Entity changes without source
evidence stay unknown; a `uses` relation is not a confirmed mutation. The view
runs no commands and records no review result. Existing diagrams remain additional
ways to inspect the same saved model.

When the user specifically asks for entity/aggregate transitions, do not stop at
the reconstruction's unknown changes. Read the relevant business-context query,
the realizing ADRs and supplied business evidence; assemble the sourced working
board using `references/eventstorming-board.md`. Preserve exact states from
their ADR owner without copying a state machine into the model. Mark unresolved
or contradictory before/after conditions visibly; neither an ADR state name nor
a `uses` edge alone proves a transition. Render and deliver that board. This is
read-only evidence preparation, not approval of a model change.

For a request to inspect EventStorming discovery, use `/ontology-build` and
`references/eventstorming.md` to show its event map, evidence and boundary
candidates. Use `references/eventstorming-board.md` to render a candidate board even before
a model exists. The `view` command reconstructs the saved model; it does not
recover workshop history or candidate source verdicts. Do not claim the 3D city
is evidence of the discovery process or that an unavailable view mode exists.

To add source information, use `/ontology-build`; for a natural-language change,
use `/ontology-edit`; after direct Turtle edits, use `/ontology-sync`.
For process completeness/readiness, request `/ontology-sync`'s read-only review;
for actual execution alignment, use `/ontology-align`. State these routes when
relevant to the user's request. A realization badge computed from ADR Status is
not proof of business completeness or current execution success.
