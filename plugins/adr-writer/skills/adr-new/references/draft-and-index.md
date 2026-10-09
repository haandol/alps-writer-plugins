# ADR draft and index

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 3. Draft the ADR

Use [review artifact storage](../../report-writer/references/review-artifacts.md) to
allocate a unique ignored run directory. Under it, create a draft root containing
a copy of the existing `docs/adr/` tree, including its mapping, rule documents,
and prerequisite ADRs. Copy other documents needed to resolve Related links at
their repository-relative paths. Use independent copies, not symlinks or hard
links to live files. Keep new or changed ADR bodies and supporting document
candidates in this tree, with their intended final paths. It is disposable
validation input, not a second authority or approval registry.

Make Purpose useful to an agent resolving unspecified details: preserve the
user's problem, intended outcome, and supplied priorities or boundaries that
would change a reasonable choice. Do not stop at an aspirational benefit or
invent exclusions. Apply the shared requirement-delegation guidance to preserve
autonomy within the contract and identify only material unresolved decisions.
Author `Purpose`; accept legacy `Context` without losing its background or
assumptions. Keep the normal ADR structure.

Follow `concepts.md`, `authoring-rules.md`, and `structure.md` under `docs/adr/` strictly (falling back to the same files under `${CLAUDE_PLUGIN_ROOT}/templates/adr/`).

- Candidate category directory: `<draft-root>/docs/adr/<category>/` (create it in the draft tree if absent; for flat-structure projects use `<draft-root>/docs/adr/` alone)
- Assign the next number within the category. Filename: `NNNN-kebab-title.md` — always canonical form. **Never put an ALPS Feature ID in the filename** (no `0001-f1-...`) — Feature IDs are stored nowhere, and `/adr-impl` matches targets by category key.
- **Fill the `Date:` at the top of the body with the authoring date (`YYYY-MM-DD`)** — it records when the ADR was written and is separate from the Status transition date (`Accepted (YYYY-MM-DD)`). A `Proposed` Status line carries no date.
- **Status always starts as `Proposed`** (`/adr-impl` switches it to `Accepted` automatically after implementation, tests, and the final implementation review pass). Never ask the user about promotion — see `concepts.md` "Automatic transition rules".
- Body structure: Status / Purpose / Decision Drivers / Decision / alternatives / Consequences / (optional) Implementation Notes / Related. **The four required sections are Status, Purpose, Decision, and Consequences**, and `adr-structure-lint` hard-checks their presence. Decision Drivers and the alternatives section are strongly recommended (a warning when absent), and Implementation Notes is an optional section kept only when there are architecture-level implementation considerations (matching README's `## ADR template`).
- **Record only the gray zone** — leave out anything discoverable by reading the code that is also not a requirement (function responsibilities, module dependencies, field types, error message wording, logs, env var names, pseudocode, implementation tuning values). Each of those belongs to the level below, and copying it up is what makes an ADR unreadable alone. The body's center of gravity should be "the motivation behind the decision that the code cannot show": adoption rationale, business rules translated into system behavior, domain rules and state transitions, external-dependency fallback — see `concepts.md` "What an ADR covers — the gray zone between business and code".
- **Keep the core subject above code resolution** — a cleanly written ADR about a replaceable library, SDK, framework, middleware, credential/auth adapter, or module structure still fails the admission gate. Do not hide a code-level subject behind architecture vocabulary. If the provider/model boundary is the decision, name that boundary and leave its client and credential plumbing out.
- **Route each fact to its level before writing it** (`authoring-rules.md` "The requirement gate and two filters", in this order). (0) **Requirement gate** — "if this were missing, could code rebuilt from the ADR alone violate a requirement?" YES keeps it unconditionally, and no filter below applies. (1) **Code-readthrough test** — for a fact that failed the gate, "would an agent reading this code discover it?" YES sends it down to the code level. (2) **Litmus test** — "if this value changed, would the decision itself change?" NO sends it down too. Asking (1) before (0) is how a requirement gets deleted for being "visible in the code", which is this skill's most expensive mistake.
- **Record requirement values verbatim** — put the limits, cycles, caps, and targets collected in step 2 into the `Decision`'s requirement contract (the README template's `### Requirement contract`) with the number and its basis. Do not blur them into "is limited" or "within a reasonable time," and equally do not write them as constant or environment-variable names (`MAX_TURNS = 20` ✗ / "a chat session is capped at 20 turns — pricing policy" ✓). **Record non-numeric requirements in the same place** — allowed value sets, mandatory fields, permissions, visibility, ordering, uniqueness, and units go in as domain sentences, never as enum identifiers (`Status = ["PAID","SHIPPED"]` ✗ / "an order is paid, shipping, delivered, or cancelled, and a cancelled order never moves to shipping" ✓). For the detailed criteria see `authoring-rules.md` "Concrete numbers" and "Non-numeric requirements".
- **Group the requirement contract for scanning** — place each populated row under `Required guarantees`, `Prohibitions`, or `Failure guarantees`. Omit empty groups. This is presentation, not a filter: preserve every exact value, allowed state, permission, ordering rule, uniqueness rule, unit, and basis that passed the requirement gate.
- **Make the contract reviewable** — keep one independently reviewable obligation per row and add `Observable evidence` that names the implementation-independent result used to distinguish compliance from violation. Do not prescribe test files, commands, functions, classes, libraries, fixtures, or internal data representation.
- **Keep decision-changing assumptions inside the existing structure** — include only assumptions that could change the adopted alternative, as one line in Purpose or the relevant Decision Driver with what must be reconsidered if false. Never move requirement values into an assumption, and never persist replaceable implementation defaults there. Do not create a separate assumptions section or confidence scale.
- **Put yourself through the regeneration test once** — after finishing the draft, ask "if all this code were deleted and only this ADR survived, could requirement-honoring code be rebuilt from it alone, and could a reviewer tell requirement by requirement whether the rebuilt code complies?" A different implementation is normal, but if a contract or implementation-independent observable result is missing (requirement values, permission rules, required validation, state transitions, guaranteed behavior on failure), ask the user right there and fill it in — the reviewer's R19 in step 6 checks the same thing.
- **Describe the Decision as a vertical slice** — connect user action → API → data change without a break, in one paragraph or a sequenceDiagram. Covering the UI/API/Data decisions of one feature (the leaf — a feature sub-folder or a single-feature context) together is normal; never split into per-layer ADRs. When async flow or state transitions are central, use stateDiagram-v2 or flowchart.
- **Write the final state, not the transition** (`authoring-rules.md` "Final-state wording"). State the currently valid result directly in the body and `.mapping.json` summary: "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다" ✗ / "이벤트 이름은 `CURRENT_EVENT`다" ✓. Remove replaced identifiers, previous values, migration steps, and contrast phrases when they add no current contract. Alternatives may name rejected choices, and major changes belong in `decision-log.md`. A real current prohibition or forbidden transition that passed the requirement gate remains.
- **Write it tight, and in the active voice** (`authoring-rules.md` "Prose style"). An ADR is read under time pressure by someone deciding whether to trust it, so every padding word costs the reader attention the decision needed. Use the active voice by default — "the gateway rejects a duplicate payment", not "duplicate payments are rejected" — because the passive drops the actor, and who validates or owns the state is often the decision itself. Cut hedges ("basically", "it is worth noting that") and throat-clearing ("in order to" → "to"; "has the ability to" → "can"), keep connected conditions and results together while splitting changes in actor or point, prefer the concrete noun to the vague one, and state the decision rather than narrating how you reached it. **But never shorten by deleting content** — a dropped requirement value, permission rule, or fallback policy is a defect, not concision.
- **Lead with intent and remove mechanical writing patterns** (`reader-first-writing.md` and `authoring-rules.md` "Reading order — intent before detail"). Purpose opens with the affected actor or system, verified problem, intended outcome, and a brief direction preview. The adjacent Decision Drivers state all currently applicable selection criteria. Decision states the choice and its discriminating reason before the full contract. Keep the current rationale understandable from the body alone, even when the same reason also explains a transition in `decision-log.md`. Check both the opening alone and the complete ADR; preserve required sections and every obligation. Prefer a verified causal flow to a forced list. Rewrite repeated contrast templates, one-off ornamental English labels, forced numbered symmetry, filler bridges, and tables or diagrams that repeat adjacent prose. Never invent an anecdote, project result, measurement, or causal relationship.
- **Use diagrams to explain, not decorate** — when a decision flow, state, system boundary, or alternatives relationship is clearer visually, add a Mermaid diagram containing only architecture-level relationships established by the decision. Do not copy the implementation call graph, name file-level symbols, or add a diagram that merely repeats the paragraph.
- For the full forbidden/keep lists see `authoring-rules.md` (the same rules apply inside diagrams).

### 4. Prepare the mapping candidate

Edit only `<draft-root>/docs/adr/.mapping.json`, starting from the existing mapping or the empty skeleton when absent. The final destination is `docs/adr/.mapping.json` (schema: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`). The mapping is **the single ADR index** — each ADR is registered once with its path, Status, and a one-line summary. **It stores no ADR↔code paths** (the code is located by reading the ADR each time) **and no PRD reference** (adr-writer is standalone). Preserve unrelated records; do not apply this candidate to the repository yet.

```json
{
  "categories": {
    "<category>": {
      "feature": "<the ADR title, or one line representing the category>",
      "subdomainType": "<core|supporting|generic — only when step 2 item 6 was asked and answered>",
      "adrs": [
        {
          "path": "docs/adr/<category>/NNNN-...md",
          "status": "Proposed",
          "summary": "<one-line Key Decision summary>"
        }
      ],
      "dependsOn": ["<prerequisite category key>"],
      "tableDocs": ["<if there was a DB change and you updated docs/tables/, schema.prisma, etc.>"]
    }
  }
}
```

- An `adrs` item is an **object** `{ "path", "status", "summary" }`, not a string. `path` is the final repo-relative path, never the draft root's absolute path. `status` mirrors the `## Status` of the candidate ADR body (so a new ADR always starts as `"Proposed"`), and `summary` is a one-line compression of the Decision (the Key Decision). This record is the candidate index entry (see step 5).
- If the category already has an entry, append the new record only to the candidate's `adrs` array.
- **`dependsOn`** — record, as an array, the category keys the user named as prerequisites in step 2 item 5. This is exactly the field `/adr-impl`'s prerequisite gate reads, in the same category-key id-space. Reference only existing category keys and keep the graph acyclic (never including itself) — see `dependsOn` in `mapping.schema.json`. An edge pointing at a category in another context is normal. If the user answered "none" to item 5, record `dependsOn` as `[]` — the empty array means "explicitly checked, no dependencies," and `/adr-impl` proceeds without a notice. Omitting `dependsOn` entirely makes `/adr-impl` treat it as "dependencies undeclared" and emit a one-line warning, so never omit it on the `/adr-new` path where item 5 was asked.
- **`subdomainType`** (optional) — record it on the context-level entry only when step 2 item 6 was answered (feature sub-folder entries inherit the parent context's classification, so they usually omit it). Omit it for flat or unknown cases — it is advisory metadata and the mapping stays valid without it.
- `feature` is a human-readable label, never a PRD back-reference, including after an import. Reuse dependencies supplied by `/feature-to-adr`; standalone authoring follows the same explicit `dependsOn` rules above.

### 5. Check the candidate index

The ADR index is `docs/adr/.mapping.json` — the README holds no ADR list. The candidate `adrs[]` record from step 4 is the entire proposed index change; no separate index edit is needed. Confirm that its one-line `summary` accurately compresses the Decision and its `status` matches the candidate body's `## Status` (`Proposed`). The repository index remains unchanged until step 7. Leave the README untouched here.
