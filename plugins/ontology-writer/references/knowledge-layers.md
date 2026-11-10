# Construct ontology knowledge in layers

Layer the knowledge while authoring the ontology. The small upper layer contains
bounded contexts only: each BC's responsibility, its core business logic at BC
resolution, and its collaborations with other BCs. Author these facts from the
evidence and the user's decisions; do not manufacture them at query time.

The lower layer holds the heavier business knowledge inside those BCs:
processes, steps, actors, events, policies, concepts, cross-step rules and
observation criteria. `inContext` connects its contextual elements to their BC.
A process can cross BCs. Exact values, state machines and feature-level
conditions stay in the realizing ADRs, reached through the ADR index.

Business workflow and functional realization are different resolutions. Use the
model's processes and responsibilities to organize business work within a BC;
use the ADR index to connect the functional decisions that realize it. Do not
turn ADR folders into business containers or redefine a BC from its current
implementation inventory. This separation lets confirmed business structure
guide code organization through ADRs without copying code structure upward.

## Author the upper knowledge

- Keep the BC's responsibility in `definition`. Put its principal business
  inputs, decisions and outcomes in `coreLogic`, as one concise business
  explanation. Preserve the reasons and conditions that distinguish its work;
  do not copy every internal step, policy, number or implementation detail.
- Record `collaboratesWith` between distinct BCs when the business connects
  them. One direction of storage is enough: the relationship is read from both
  ends. It does not assert a direction, a cause or an implementation prerequisite.
  Internal events, policies, sequence and rules explain the particular connection.
- Then open each relevant BC into its internal workflow knowledge. Keep the
  whole-scope EventStorming map as discovery evidence, while the saved upper
  knowledge and each BC's details remain independently readable.
- Unknown upper knowledge remains a candidate or a question. A query must not
  silently promote a generated summary or an inferred collaboration to a fact.

These are logical knowledge layers in one Turtle graph, not an additional index
or a second copy of the detailed workflow. A shared BC document and per-process
documents can keep editing convenient; file layout does not own the hierarchy.

## Validate construction

Use `validate --require-layers` for a model being constructed or presented as
layer-complete. For a scoped extension, add `--layer-context <id>` for each BC
in that scope. The same flags work with `impact` and `apply`. They check that
the selected BCs have authored core logic and that the upper collaborations
cover modeled cross-BC relations. Review the text's meaning and resolution too;
structural success cannot establish that the explanation captures the business.

Without construction flags, legacy gaps are warnings so an old model remains
readable. New BCs must satisfy the layer checks on save. Do not fill legacy
knowledge automatically or claim that a partially layered model is complete.
Keep existing business-change approval, history and downstream contract checks.

## Retrieve at the needed resolution

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --overview
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --context ordering --search payment
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --context ordering --offset 20
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --step ordering.confirm-order
```

For broad or unlocated work, read the whole lightweight BC layer, choose the
relevant BCs, then search or page through their internal knowledge. Follow the
returned `next` parameters against the same model and retain a custom
`--adr-dir` if one was supplied. Navigation pages are not complete contract
evidence; inspect the relevant detail and realizing ADRs before judging work.
An already known category, process, step, concept or event can be queried directly.

Whole-model text search (`query --overview --search <text>`) returns BC candidates
only, even when the match is in an internal event or rule. Open the returned BC
search to inspect it. Empty search results are not evidence of absent business
rules. Check neighboring BCs for cross-boundary effects.

C4 inspires the different knowledge resolutions; HNSW inspires narrowing the
search from a small upper layer. The BC boundary comes from business meaning.
This implementation uses local deterministic text and graph queries. It neither
implements HNSW nor promises its complexity, and parsing the local graph still
has a cost even when the LLM receives only a small result.
