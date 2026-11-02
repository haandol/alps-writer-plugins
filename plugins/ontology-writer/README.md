# ontology-writer

Business process model level above ADRs for Codex and Claude Code. A repository keeps one or more Turtle documents in `docs/process/` that describe how the business flows across features: processes and their steps, the events steps emit and the policies that react to them, actors, business rules that span steps, business concepts and terms, and observation criteria. The vocabulary is a closed RDFS-lite ontology, so a model built by an agent is checked mechanically and the same question gets the same answer. The model owns flows and relations; ADRs stay the only implementation authority and keep values, state machines and detailed conditions. Without model documents nothing here runs.

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

| Command                      | Role                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/process-edit [change]`     | Change the business process model (`docs/process/*.ttl`) from a request: one approval summary with the semantic diff, affected features, link changes, processes that become `Proposed` and each affected ADR's semantic diff, then cascade to ADRs, adr-writer's `/adr-impl` and an alignment review |
| `/process-sync [process]`    | Confirm direct Turtle edits like a save, mark changed `Accepted` processes `Proposed`, and propose the downstream propagation without overwriting the edit                                                                                                                                            |
| `/process-align [process]`   | Make a process current only when its realizing features are implemented, compliance contracts are in place, nothing contradicts the model and every observation criterion passed by executing the features' real entry points                                                                         |
| `/process-build [documents]` | Build model candidates from documents (AgentStorm maps included) with sources and verdicts; save only what the user confirms                                                                                                                                                                          |
| `/process-view`              | Open a read-only standalone view of the model: a 3D business city, an explorer that finds every element by bounded context, the landscape, flows and details, with realization status from the ADR index                                                                                              |

## Business process model

Model documents use the closed vocabulary in `templates/process/vocabulary.ttl`; `templates/process/example.ttl` shows a small model. The model owns business flows, event hand-offs, policies, cross-step rules and business terms. The rules are in `references/process-model.md`; the deterministic commands are `node scripts/process-model.mjs <command>` with `validate`, `format`, `diff`, `query`, `impact`, `apply`, `transition`, `align`, `lifecycle`, `changes` and `view`, documented at the top of the script. `validate` also checks the ADR index's `realizes` links against the model.

## Working with adr-writer

- The ADR index, `docs/adr/.mapping.json`, belongs to adr-writer. A category's `realizes` list is the only link between a feature and the steps it realizes: this plugin writes those links in the same change unit as the model and validates them, and adr-writer checks only their shape and moves them when categories split or merge.
- A model change that affects ADRs needs adr-writer: the ADR revisions in its approval summary follow `/adr-new`'s draft rules, and `/adr-impl` implements them. Without adr-writer such a change stops before the approval summary; a change that affects no ADR is saved by this plugin alone.
- With a model present, adr-writer's session directive adds one line saying that business context is checked through this plugin. Without this plugin, ADR work states that the business context was not checked.
- This plugin carries copies of the adr-writer scripts it runs — reading the ADR index and ADR Status, recording a Status transition, opening a report — and of the shared report-writer skill. Edit the originals; `pnpm shared-scripts:sync` and `pnpm report-skill:sync` refresh the copies, and CI fails on a stale one.

## Hook

| Hook           | When it fires                          | Role                                                                                                                                                                      |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart` | Startup, resume, clear, and compaction | With an ADR index and a business process model, ask for the business-context query before an ADR decision or contract changes and before code of a linked feature changes |

The directive names the query command and renders neither the model nor the index. Claude Code discovers `hooks/hooks.json` automatically; Codex registers the same file through its manifest.

## Report writing

The skills' human-facing reports follow the bundled `report-writer` skill, the same one adr-writer ships.

## License

[MIT](../../LICENSE)
