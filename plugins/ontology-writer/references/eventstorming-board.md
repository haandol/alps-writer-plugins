# EventStorming board artifact

This is disposable presentation data, not a saved model, approval registry or
state-machine specification. Build it from the requested sources under
`eventstorming.md`. Do not invent entity changes from code names or a `uses`
relation. Every source verdict describes evidence, not user approval.

Write `board.json` in the current ignored review run directory and render it:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/eventstorming-view.mjs <run>/board.json --lang ko
```

The command works before any ontology exists, validates the input, creates one
new ignored HTML file and opens it in the default browser. Use `--no-open` to
honor no-open delivery, `--browser <name>` for a requested browser, and
`--out <new.html>` for an explicit output path; it
refuses to overwrite a file. Include the board in the build report's evidence
and return its path. The board opens with an event trace with restrained depth,
complete source cards and native SVG connections. Within Event flow, switch to
Business areas to inspect sourced domain/subdomain/context groupings and back to
an individual event. Saved-model views pair that workbench with the existing
3D business structure. Candidates do not invent its process hierarchy or realization.
It uses no Mermaid. Camera changes
and selection are transient and never change business facts. Rendering never applies the proposal or promotes a process.

## Input

The root holds `version: 1`, `origin: "candidate"`, `title`, `scope`, `stages`,
`links`, and optional `domain`, `contexts`, `subdomains` and `questions`. Keep the requested system scope and uncovered
parts explicit in `scope`. Each stage is one observed or proposed business
change, not an internal method call:

- `id`, `context` (display name), optional `contextId` (stable identity; null
  means the boundary is unknown), `action`, optional `actor`, optional `contextDescription`, optional `businessStatus`
  (`current`, `planned`, `unconfirmed`; absent means unconfirmed).
- `entities`: objects with `name`, `kind` (`entity`, `aggregate`, `concept`),
  `before`, `after`, `verdict` and `evidence`. `before`/`after` are business text
  or `null` when unknown. A merely related `concept` requires both to be `null`.
- `event`: `{ "name": "…", "description": "…" }`, or `null` when not found;
  `policies`: the evidenced reaction rules as text.
- `verdict` and `evidence` for the stage's actor/action/event/policy claims.
- Optional `rules`: `{ name, description?, scope, verdict, evidence }` objects.
  Preserve the source's actual applicability in `scope`. A related concept's
  rule does not establish enforcement by a step or an aggregate boundary.
- Optional `views`: `{ name, role, description?, verdict, evidence }` objects.
  `role` is `input` (informs the action) or `result` (shows its result). Screens
  and read models are optional; absent/empty means unrecorded. A system, timer or
  external activity need not have a human or screen. Do not infer view updates,
  their timing, or causation merely because a view is associated with an event.

Every link has `from`, `to` (existing stage ids), `label` naming the reaction,
`verdict`, and `evidence`. Optional `condition` preserves the source reaction
condition; null/absent is displayed as not recorded separately. Incoming events
and conditions appear on the receiving activity, including cross-context inputs.
Optional `relation` is `causal` (default) or
`sequence`; label a sequence explicitly as order rather than causation.
The saved-model adapter keeps `flowsTo` as sequence. Stage position is not proof of temporal order or
causation; links carry those claims. A loop may point back to an earlier stage.

A source verdict is `stated`, `inferred`, `conflicting` or `unconfirmed`.
`evidence` is an array of `{ "source": "document or user explanation",
"detail": "location and relevant passage" }`. It may be empty; a claim with no
source is displayed as unconfirmed even if the supplied verdict says stated.
Sources are displayed as inert text. Keep relevant exact requirements in the
ADR transfer portion of the report instead of changing the model's vocabulary.

Optional `questions` contain `id`, `text`, `scope`, `scopeType` (`process` or
`step`), `stages` (the associated stage IDs), `verdict` and `evidence`. They retain
recorded open paths near the flow. Process-wide questions do not create a failure
edge from one particular event. Only supplied links establish relations; a
question's association is review scope, not execution order. IDs are unique and
all associated stage IDs must exist. Omit questions when no such source exists;
an empty list does not prove completeness.

The event-first layout retains partial order, branches and returning links.
Independent nodes acquire no inferred links or timestamps. A stage without an
emitted event stays visibly unrecorded. Events lead to their complete source cards. Saved-model activities can also
lead to the same step in Business structure. Camera and selection remain transient.

Optional `domain` contains `name`, optional `description`, `verdict` and `evidence`.
Optional `contexts` contains `{ id, name, description?, external?, verdict, evidence }`;
it can include a context with no recorded stages. IDs are unique and a stage using
that `contextId` must use the same label. An external actor is not evidence of an
external context; set the boolean `external` only from a sourced boundary claim.

Optional subdomain candidates contain `name`, `responsibility`, `verdict` and
`evidence`, with optional `id`, `classification` (`core`, `supporting`, `generic`,
`unconfirmed`) and `contextIds`. Membership IDs must name a stage's explicit
`contextId` or a `contexts` entry. Never match membership by name. Different
subdomains may reference the same context; it appears once in a shared area with
explicit membership labels. Missing membership stays unassigned, and absent
classification stays unconfirmed. Supplied claims retain their source verdicts.
See `examples/order-payment/board.json` and its business notes for a complete example.

The saved-model viewer reconstructs actions and causal connections from the
model. It labels used concepts as related concepts with unknown changes, and
labels that board as a reconstruction, distinct from the candidate board. It has
no recorded Domain, Subdomain or View types; those facts stay unconfirmed until
additional evidence is supplied to a working board. This optional presentation
metadata does not extend the saved Turtle vocabulary.

The saved-model business structure groups context districts by actual context
identity, so equal labels do not merge distinct contexts. The event flow retains
context labels and descriptions; it never infers a step's ownership from a
process tower's physical placement. Dragging changes only the view and is never
persisted. Subtle signal strokes illustrate recorded event reactions, not live
traffic; sequence-only or unrecorded-event inputs do not acquire signals.
The signal tail stays visible at normal zoom and scales for legibility. A status
message distinguishes playback, user pause, reduced motion, hidden/offscreen
canvas and no eligible connections. Pause/play applies across both event perspectives.

The primary event trace projects each supplied stage link to the destination's
emitted event, or to an explicitly labeled intermediate action when that event
is absent. It retains the original reaction/sequence kind: a solid visual trace
is not a new event relation or proof of event arrival order. Connection labels
open the original policy, condition, action, emitted event and evidence. Event
selection highlights declared upstream/downstream paths without inventing links
between independent or sibling branches. These are transient viewing states.
