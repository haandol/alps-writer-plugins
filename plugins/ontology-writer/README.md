# ontology-writer

Business ontology level above ADRs for Codex and Claude Code. A repository keeps one or more Turtle documents in `docs/ontology/` that describe how the business flows across features: processes and their steps, the events steps emit and the policies that react to them, actors, business rules that span steps, business concepts and terms, and observation criteria. The vocabulary is a closed RDFS-lite ontology, so a model built by an agent is checked mechanically and the same question gets the same answer. The model owns flows and relations; ADRs stay the only implementation authority and keep values, state machines and detailed conditions. Model-dependent checks stay inactive without model documents; an explicit build request can create the first model.

The aim is to capture real business workflows accurately and richly, so domain
logic reaches ADR contracts, code and tests. Ontology formalism and inference
are means, not completion goals. Build starts with evidence-based EventStorming:
a whole-scope event map, bounded contexts and subdomains grounded in that map,
then confirmed model facts. Additional sources use the same comparison and
approval path. These agent workflows are distinct from the deterministic CLI.

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
| `/ontology-view`              | Open an event-first business flow with policies, rules and open questions; switch to its 3D business structure, and inspect source details and realization from the ADR index                                                                                                                     |

## Completeness and the next workflow

Ask `/ontology-sync` to review completeness/readiness when you want a read-only
assessment of the actual business workflow. It reports business-model
sufficiency, ADR contract readiness and actual execution evidence separately,
including unknown scope. Use `/ontology-build` for additional information,
`/ontology-edit` for a requested change, the reconciliation path of
`/ontology-sync` for direct edits, and `/ontology-align` for execution evidence.
The read-only review is an agent workflow using existing commands, not a new
CLI flag. The viewer opens on an event-first EventStorming canvas: domain events
lead the story across contexts, with their producing actions, incoming policies
and conditions. Related business rules and recorded open paths appear beside the
flow, preserving their scope and evidence. Branches and returning links remain
visible; position does not establish time or an unrecorded causal relation.

The model has two tabs: Event flow and Business structure. The latter already
shows context districts, process towers, steps and event/policy hand-offs in 3D,
so there is no separate context map. The event inspector can open the same step
in Business structure. Both views keep their navigation in the open page;
reopening resets it. Read actual context ownership from the model details,
not a process tower's physical placement.

The event flow uses a readable front-facing canvas with restrained depth and
subtle directional strokes. Motion can be paused, respects reduced motion and
stops while hidden or out of view. It illustrates recorded event reactions, not
live traffic or sequence-only relations. Candidate boards can show source-backed
changes before a model exists, using only the event flow and complete source
cards; see `references/eventstorming-board.md`. Unknown changes and unperformed
reviews remain explicit.

## Business ontology

Model documents use the closed vocabulary in `templates/ontology/vocabulary.ttl`; `templates/ontology/example.ttl` shows a small model. The model owns business flows, event hand-offs, policies, cross-step rules and business terms. The rules are in `references/ontology.md`; the deterministic commands are `node scripts/ontology.mjs <command>` with `validate`, `format`, `diff`, `query`, `impact`, `apply`, `transition`, `align`, `lifecycle`, `changes` and `view`, documented at the top of the script. `validate` also checks the ADR index's `realizes` links against the model.

## Working with adr-writer

- The ADR index, `docs/adr/.mapping.json`, belongs to adr-writer. A category's `realizes` list is the only link between a feature and the steps it realizes: this plugin writes those links in the same change unit as the model and validates them, and adr-writer checks only their shape and moves them when categories split or merge.
- A model change that affects ADRs needs adr-writer: the ADR revisions in its approval summary follow `/adr-new`'s draft rules, and `/adr-impl` implements them. Without adr-writer such a change stops before the approval summary; a change that affects no ADR is saved by this plugin alone.
- With a model present, adr-writer's session directive adds one line saying that business context is checked through this plugin. Without this plugin, ADR work states that the business context was not checked.
- This plugin carries copies of the adr-writer scripts it runs — reading the ADR index and ADR Status, recording a Status transition, opening a report — and of the shared report-writer skill. Edit the originals; `pnpm shared-scripts:sync` and `pnpm report-skill:sync` refresh the copies, and CI fails on a stale one.

## Hook

| Hook           | When it fires                          | Role                                                                                                                                                                 |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart` | Startup, resume, clear, and compaction | With an ADR index and a business ontology, ask for the business-context query before an ADR decision or contract changes and before code of a linked feature changes |

The directive names the query command and renders neither the model nor the index. Claude Code discovers `hooks/hooks.json` automatically; Codex registers the same file through its manifest.

## Report writing

The skills' human-facing reports follow the bundled `report-writer` skill, the same one adr-writer ships.

## License

[MIT](../../LICENSE)
