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

During development, ask which business responsibility or constraint the change
needs to understand, then start at the smallest known scope. Do not visit every
layer or query kind merely to follow a sequence. This is context retrieval, not
an ontology build, synchronization or alignment review.

| What is already known                      | Starting query                                                                                                                                 | Expand when needed                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The business boundary is unknown           | `query --overview`; business wording can narrow candidates with `--search`                                                                     | Select a BC by its authored responsibility and explicit identity                                     |
| The relevant BC is known                   | `query --context <id> --search <wording>`                                                                                                      | Follow matching process/step ids and relevant boundary links                                         |
| A process, step, concept or event is known | `query --process <id>`, `--step <id>`, `--concept <id>` or `--event <id>`                                                                      | Open another process or BC only for a relevant hand-off, rule, shared concept or unresolved question |
| The feature/ADR category is known          | Inspect its declared `realizes` links; query the affected step when known, or use `query --category <key>` for feature-wide or uncertain scope | Keep every changed step's business context covered; handle missing, empty or broken links explicitly |

For unlocated work, one possible route is:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --overview
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --context ordering --search payment
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs query --step ordering.confirm-order
```

If the step is already known, start with the last query. If the question concerns
the process's start/result or observation criteria, use the process detail.
Feature-wide decisions may need the category's full connected context. Do not
infer a BC from the category folder or a similar name.

`--search`, `--limit` and `--offset` apply to overview/context navigation, not
detailed queries. Follow returned `next` parameters only while further results
are needed, retaining the search, model and current index selection (`--index FILE`
or a custom `--adr-dir`). Check the result's
scope, remaining counts and diagnostics before relying on it. If detail is too
broad, choose a justified smaller target instead of cutting off its output.
Navigation pages are not complete contract evidence: inspect relevant detail
and realizing ADRs, including cross-BC effects the change depends on. A full
model read by the LLM or every page of unrelated work is not required.

Whole-model text search (`query --overview --search <text>`) returns BC candidates
only, even when the match is in an internal event or rule. Open the returned BC
search to inspect it. Empty search results are not evidence of absent business
rules. Check neighboring BCs for cross-boundary effects.

Stop ontology exploration when the business question driving the change,
relevant responsibilities and dependencies, and the owning ADRs are identified.
Report unresolved scope rather than treating it as absent. Read the owning ADRs'
full contracts and find the implementation from them. Selective
ontology retrieval does not replace required ADR admission reads, prerequisite
checks or implementation/review coverage.

Reuse already checked context within the same active change while its source
assumptions hold; do not repeat the same query before each file edit or phase.
Refresh affected queries when their basis changes: relevant model facts,
realization links, ADR contracts or Status, or the requested business scope.
Query results and working
selections remain ephemeral, not a persisted summary or approval registry.

C4 inspires the different knowledge resolutions; HNSW inspires narrowing the
search from a small upper layer. The BC boundary comes from business meaning.
This implementation uses local deterministic text and graph queries. It neither
implements HNSW nor promises its complexity, and parsing the local graph still
has a cost even when the LLM receives only a small result.
