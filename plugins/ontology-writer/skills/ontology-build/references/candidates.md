# Candidate artifacts

Write the build's candidates once, as one JSON file in the run directory, and let
`ontology-candidates.mjs` produce the draft, the board, the index draft, the
question file and a review summary from it. Do not write project-specific
scripts for these artifacts. The file is disposable review material: its
sources, verdicts and questions never enter the model, the index or ADRs.

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-candidates.mjs check <run>/candidates.json
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-candidates.mjs prepare <run>/candidates.json --run <run>
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-candidates.mjs prepare <run>/candidates.json --run <run> --confirmed-only
```

`check` reports errors (unknown references, wrong types, missing required
facts) and warnings (ids that name a number, policies and rules without a basis).
`prepare` writes, inside `<run>` only:

- `draft/`: every current model document, with the candidates merged in. Untouched
  documents are copied byte for byte; touched ones are rewritten canonically. New
  elements go to their context's document (`<context>.ttl`), actors to
  `actors.ttl`. Pass it to `ontology.mjs impact --draft <run>/draft`.
- `board.json`: the EventStorming board (one stage per candidate step; links from
  `flowsTo` as order and from policies as reactions). Render it with
  `eventstorming-view.mjs`.
- `mapping.draft.json`: the ADR index with the candidate `realizes` links added.
- `ask/questions.json`: the web session's questions. A question without a
  `diagram` gets a flow of its `stages`.
- `candidates-summary.json`: per-context counts, verdicts, planned items, basis
  gaps and the candidates still needing confirmation, for the report.

With `--confirmed-only` it writes `save-draft/` and `mapping.save.json` from the
candidates marked `"confirmed": true` only, and warns about each relation it left
out because its other end is not confirmed. Use them for the save's `impact` and
`apply`. `--ontology-dir` and `--mapping` override `docs/ontology` and
`docs/adr/.mapping.json`.

## File

```json
{
  "version": 1,
  "title": "Order and payment build",
  "scope": "From a customer's order to its confirmation",
  "language": "ko",
  "contexts": [],
  "actors": [],
  "concepts": [],
  "events": [],
  "processes": [],
  "steps": [],
  "policies": [],
  "rules": [],
  "criteria": [],
  "subdomains": [],
  "links": [],
  "questions": [],
  "notHeld": []
}
```

Every element has `id`, `label`, `definition`, `verdict` (`stated`, `inferred`,
`conflicting`, `unconfirmed`), `evidence` (`[{ "source", "detail" }]`, empty when
none was found) and optionally `planned`, `confirmed`, `comment` and `changes`.
An element whose id is already in the model keeps its current wording; list in
`changes` the attributes a document states a change of (for example `["label"]`).
Relations are listed on their element:

| List        | Fields beyond the common ones                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contexts`  | `coreLogic`, `collaboratesWith` (context ids)                                                                                                                 |
| `actors`    | —                                                                                                                                                             |
| `concepts`  | `context`, `hasPart`, `refersTo`, `correspondsTo` (concept ids)                                                                                               |
| `events`    | `context`                                                                                                                                                     |
| `processes` | `startCondition`, `businessOutcome`, `summary`, `openScope`, `steps` (step ids)                                                                               |
| `steps`     | `context`, `kind` (`system`, `outside-system`), `performers` (actor ids), `flowsTo`, `emits` (event ids), `uses`, `openScope`; board-only `entities`, `views` |
| `policies`  | `context`, `trigger` (event id), `starts` (step ids), `condition`, `basis`, `uses`                                                                            |
| `rules`     | `constrains` (step, policy, concept or process ids), `basis`                                                                                                  |
| `criteria`  | `process`, `startCondition`, `observedResult`, `passesThrough` (event ids)                                                                                    |

`basis` is `{ "kind": "regulation" | "contract" | "operating-policy" |
"user-decision", "text": "…" }`; leave it out when none was found, so the gap
becomes a basis question. `openScope` items are `{ "kind": "open-path" |
"not-applicable", "text": "…" }` or `{ "kind": "none" }`. A new process is
written `Proposed`.

`subdomains` use the board's subdomain form. `links` are feature-to-step
candidates: `{ "category", "step", "reason", "verdict", "evidence", "confirmed" }`.
`questions` use the web session's question form plus optional `stages` (step
ids), `scope` and `scopeType` for the board. `notHeld` lists what the model does
not hold (`{ "text", "source" }`) for the report's transfer section.

Name ids from business meaning under [candidate review](candidate-review.md); `check` warns about ids
such as `rule-01`.
