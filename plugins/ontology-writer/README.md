# ontology-writer

Keep a model of how your business flows — processes, steps, the events they emit,
the policies that react, and the rules that span features — so an agent changing
one feature does not break another. The model lives in Turtle files under
`docs/ontology/`, is checked mechanically, and links each step to the ADRs that
realize it. ADRs stay the only implementation authority.

![Bounded contexts at a glance](../../docs/images/ontology-bc-overview.webp)

## What you can do

| Goal                                                    | Command                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Build a model from documents, through EventStorming     | `/ontology-build [documents]`                                          |
| Change the business flow and cascade it to ADRs         | `/ontology-edit [change]`                                              |
| Check completeness, or reconcile direct Turtle edits    | `/ontology-sync [process]`                                             |
| Mark a process current once its features run end to end | `/ontology-align [process]`                                            |
| Browse the model                                        | `/ontology-view`                                                       |
| Ask before changing a feature                           | `bun scripts/ontology.mjs query --step <id>` (the agent does this too) |

Before an ADR decision or the code of a linked feature changes, the session
directive asks the agent to query the business context first.

## The saved view

`/ontology-view` writes one read-only HTML file and opens it. Start from the
bounded contexts (BCs), search inside one, and open any element with its facts,
relations and realizing ADRs:

![Search inside a BC](../../docs/images/ontology-bc-search.webp)

![Step detail](../../docs/images/ontology-step-detail.webp)

"Whole flow & structure" shows every domain event across contexts, and the
business structure as a 3D city with each process's implementation status:

![Event flow](../../docs/images/ontology-event-flow.webp)

![Business structure](../../docs/images/ontology-business-structure.webp)

Screenshots come from the [template model](./templates/ontology/example.ttl);
`bun run docs:screenshots` regenerates them.

## How it fits

Business ontology level above ADRs for Codex and Claude Code. A repository keeps one or more Turtle documents in `docs/ontology/` that describe how the business flows across features: processes and their steps, the events steps emit and the policies that react to them, actors, business rules that span steps, business concepts and terms, and observation criteria. The vocabulary is a closed RDFS-lite ontology, so a model built by an agent is checked mechanically and the same question gets the same answer. The model owns flows and relations; ADRs stay the only implementation authority and keep values, state machines and detailed conditions. Model-dependent checks stay inactive without model documents; an explicit build request can create the first model.

The aim is to capture real business workflows accurately and richly, so domain
logic reaches ADR contracts, code and tests. Ontology formalism and inference
are means, not completion goals. Build starts with evidence-based EventStorming:
a whole-scope event map, bounded contexts and subdomains grounded in that map,
then confirmed model facts. Additional sources use the same comparison and
approval path. These agent workflows are distinct from the deterministic CLI.

## Knowledge layers and retrieval

Construct ontology knowledge in layers. The upper layer contains BCs only:
their responsibilities, authored core business logic and declared collaborations.
The heavier layer holds each BC's internal workflows, connected by context
membership. Exact implementation contracts remain in ADRs.

```bash
bun scripts/ontology.mjs query --overview
bun scripts/ontology.mjs query --context ordering --search payment
bun scripts/ontology.mjs query --context ordering --limit 20 --offset 20
bun scripts/ontology.mjs query --step ordering.confirm-order
```

`--overview` reads the whole small BC layer by default. It never expands internal
events, steps, rules or ADRs; an optional `--limit` pages this layer too. Whole-model
Text search runs over the graph each query has just read from the current Turtle
files; it keeps no index or cache. Words match in any
order, quoted phrases require adjacency, and short Korean/substrings remain
searchable. Matches are ranked by identifiers, names and text relevance; inside
a BC they carry the matched fields and original source locations. The saved
HTML uses the same query and ranking rules in memory, without a database or
network request in the browser.

The source Turtle files and ADR index remain authoritative, and an edit shows in
the next query because nothing derived is stored. Validation, change flags and
mandatory detail relationships are still checked independently of ranking.
Use Bun 1.4.2 or later.

`--overview --search` returns BC candidates, then `--context --search` shows the
internal matches. Context responses page elements, relationships and diagnostics
together, with the exact continuation in `next`. Keep the model unchanged across
pages, and retain a custom `--adr-dir` in follow-up commands.

Record `coreLogic` and `collaboratesWith` in the model rather than generating an
upper summary on each query. Use `validate --require-layers` for construction,
or add `--layer-context <id>` for each BC in a scoped extension. The same flags
work with `impact` and `apply`; new BCs require the upper knowledge on save.
Legacy gaps stay readable and explicitly incomplete. Structural layer checks
do not prove business completeness. See [knowledge layers](./references/knowledge-layers.md).

This follows C4's knowledge resolutions and HNSW's idea of narrowing a search.
Queries remain local and deterministic; no HNSW index or embedding service is
required. Local graph parsing still reads the model, while the LLM receives
only the selected knowledge.

## Guides and examples

| Guide                                                            | What it explains                                                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [How the ontology is created and used](./docs/workflow.md)       | Evidence, EventStorming, model approval, ADR/code use and readiness checks (Korean)                                     |
| [Order and payment walkthrough](./docs/order-payment-example.md) | A fictional source document, a runnable candidate board and Turtle model, and the contracts/tests still needed (Korean) |

The [example files](./examples/order-payment/) ship with this plugin. They are
learning material, separate from a project's actual ontology and ADR index.

## Install

**Codex**

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add ontology-writer@alps-writer
```

**Claude Code**

```text
/plugin marketplace add haandol/alps-writer-plugins
/plugin install ontology-writer@alps-writer
```

Install [`adr-writer`](../adr-writer) as well when the repository has ADRs. A model change that affects ADRs, an alignment review and the business-context checks of ADR work need both plugins.

## Slash commands

| Command                       | Role                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/ontology-edit [change]`     | Change the business ontology (`docs/ontology/*.ttl`) from a request: one approval summary with the semantic diff, affected features, link changes, processes that become `Proposed` and each affected ADR's semantic diff, then cascade to ADRs, adr-writer's `/adr-impl` and an alignment review |
| `/ontology-sync [process]`    | Review completeness/readiness without mutation when requested, or reconcile direct Turtle edits and propose downstream changes                                                                                                                                                                    |
| `/ontology-align [process]`   | Make a process current only when its realizing features are implemented, compliance contracts are in place, nothing contradicts the model and every observation criterion passed by executing the features' real entry points                                                                     |
| `/ontology-build [documents]` | Capture workflows through an evidence-based event map, identify contexts/subdomains, then propose model facts with sources; save only confirmed scope                                                                                                                                             |
| `/ontology-view`              | Start with authored BC knowledge, search its internal work and inspect details/ADRs; open the whole event flow and 3D structure explicitly                                                                                                                                                        |

## Completeness and the next workflow

Ask `/ontology-sync` to review completeness/readiness when you want a read-only
assessment of the actual business workflow. It reports business-model
sufficiency, ADR contract readiness and actual execution evidence separately,
including unknown scope. Use `/ontology-build` for additional information,
`/ontology-edit` for a requested change, the reconciliation path of
`/ontology-sync` for direct edits, and `/ontology-align` for execution evidence.
The read-only review is an agent workflow using existing commands, not a new
CLI flag. The viewer opens on a 3D map of authored BC knowledge. Selecting a BC
moves the camera into its expanding area and unfolds the current internal search
page. Selecting an element zooms to its facts, process flow and realizing ADRs;
returning restores the prior camera, search and page. Boundary links lead to their
actual BCs, and shared work remains identified as shared. Move, rotate, zoom and
reset the spatial view, or switch to the equivalent list view. Transitions can be
disabled and honor reduced motion. Internal scenes and diagrams are built on demand.

The explicit whole-workflow entry opens the EventStorming canvas: domain events
lead the story across contexts, with their producing actions, incoming policies
and conditions. Related business rules and recorded open paths appear beside the
flow, preserving their scope and evidence. Branches and returning links remain
visible; position does not establish time or an unrecorded causal relation.

The whole-workflow view has two tabs: Event flow and Business structure. Inside
Event flow, switch between individual events and Business areas: sourced domain,
subdomain and context groupings with cross-context hand-offs. Shared contexts
appear once with explicit memberships; unknown membership stays separate.
Business structure shows context districts, process towers, steps and hand-offs in 3D.
The event inspector can open the same step
in Business structure. Both views keep their navigation in the open page;
reopening resets it. Read actual context ownership from the model details,
not a process tower's physical placement.

The event flow places emitted events on a continuous trace with solid arrows;
action-only stages remain labeled intermediate actions. Connection labels open
the original policy, action, condition and evidence, while event selection
highlights upstream/downstream paths. Reaction paths and recorded action order
remain distinct, and no link is inferred from visual adjacency.

The event flow uses a readable front-facing canvas with restrained depth and
subtle directional strokes with a visible trail and playback/pause reasons.
Each set reads from performer/action through an evidenced object change to its
event, with sourced input/result views. Automated or external activity need not
have a human or UI. Motion can be paused, respects reduced motion and
stops while hidden or out of view. It illustrates recorded event reactions, not
live traffic or sequence-only relations. Candidate boards can show source-backed
changes, business areas and views before a model exists, alongside complete source
cards; see `references/eventstorming-board.md`. The saved vocabulary has no Domain,
Subdomain or View types, so a model-only reconstruction leaves them unconfirmed.
Unknown changes and unperformed
reviews remain explicit.

## Business ontology

Model documents use the closed vocabulary in `templates/ontology/vocabulary.ttl`; `templates/ontology/example.ttl` shows a small model. The model owns business flows, event hand-offs, policies, cross-step rules and business terms. The rules are in `references/ontology.md`; the deterministic commands are `bun scripts/ontology.mjs <command>` with `validate`, `format`, `diff`, `query`, `impact`, `apply`, `transition`, `align`, `lifecycle`, `changes` and `view`, documented at the top of the script. `validate` also checks the ADR index's `realizes` links against the model.

## Working with adr-writer

- The ADR index, `docs/adr/.mapping.json`, belongs to adr-writer. A category's `realizes` list is the only link between a feature and the steps it realizes: this plugin writes those links in the same change unit as the model and validates them, and adr-writer checks only their shape and moves them when categories split or merge.
- A model change that affects ADRs needs adr-writer: the ADR revisions in its approval summary follow `/adr-new`'s draft rules, and `/adr-impl` implements them. Without adr-writer such a change stops before the approval summary; a change that affects no ADR is saved by this plugin alone.
- With a model present, adr-writer's session directive adds one line saying that business context is checked through this plugin. Without this plugin, ADR work states that the business context was not checked.
- This plugin carries copies of the adr-writer scripts it runs — reading the ADR index and ADR Status, recording a Status transition, opening a report — and of the shared report-writer skill. Edit the originals; `bun run shared-scripts:sync` and `bun run report-skill:sync` refresh the copies, and CI fails on a stale one.

## Hook

| Hook           | When it fires                          | Role                                                                                                                                                                 |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart` | Startup, resume, clear, and compaction | With an ADR index and a business ontology, ask for the business-context query before an ADR decision or contract changes and before code of a linked feature changes |

The directive names the query command and renders neither the model nor the index. Claude Code discovers `hooks/hooks.json` automatically; Codex registers the same file through its manifest.

## Report writing

The skills' human-facing reports follow the bundled `report-writer` skill, the same one adr-writer ships.

## License

[MIT](../../LICENSE)
