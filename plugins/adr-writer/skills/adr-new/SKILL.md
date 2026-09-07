---
name: adr-new
description: Author a new ADR directly (no ALPS PRD required). Drafts a Proposed ADR and records it in the docs/adr/.mapping.json index (path + Status + Key Decision summary). Use when the user invokes /adr-new or asks to write an ADR for a fresh decision (refactor, infra choice, new feature direction). Keywords - "/adr-new", "ADR 새로 작성", "ADR 만들어줘", "draft an ADR", "write a new ADR".
argument-hint: "<category> [title?]"
---

# adr-new

Author an ADR directly. Works without an ALPS PRD — this is the plugin's canonical ADR authoring path, while `/feature-to-adr` is "the helper that auto-converts an ALPS Section 7 feature when one already exists."

> When to use: whenever a decision passes the **ADR admission gate** and must be recorded before changing code — a requirement contract, external boundary, data/key design, security trust boundary, adopted algorithm, fallback policy, or durable trade-off. A replaceable implementation means does not enter this skill. The ADR you write can go straight into `/adr-impl`.
>
> **Refactoring is out of scope** — a structural change that does not alter behavior is left to the coding agent's planning step rather than turned into an ADR (`concepts.md` "What an ADR is not"). If the user tries to record a refactor as an ADR, ask once: "Does this change alter behavior or a decision (the adopted alternative, a state transition, the key design)? If it is pure structural cleanup, planning without an ADR is the better path." If a decision does change, it is not a refactor, so proceed.

> **Apply the ADR admission gate before eliciting or drafting.** Ask whether the choice changes a requirement contract, system/data/security boundary, external provider/model or fallback, adopted algorithm, consistency model, or another durable cross-implementation trade-off. Then use the implementation substitution test: if a library, SDK, framework, middleware, module layout, credential provider chain, signer, or adapter can be replaced while preserving those contracts and boundaries, do not create an ADR. Tell the user it belongs in the implementation plan, code, tests, dependency metadata, or project conventions. "GPT-5.6 through Amazon Bedrock" can pass because it fixes an external model/provider boundary; the Bedrock SDK or credential/auth adapter does not pass by itself. **After admission, run the decision identity check before creating anything**: update the ADR that already owns the architectural question and boundary; create a new ADR only when no owner exists or the topic truly forks.

> **Language**: this skill and every other harness prompt are written in English, but **talk to the user and write the ADR body in the language the user writes in** (`authoring-rules.md` "Conventions"). The prompts below are phrasing guides, not literal strings to paste.

Before eliciting or drafting, read
`${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely. Apply it
to the ADR body and the Decision Digest without weakening any contract.

## Authoritative working model

Read the target repository's `docs/adr/concepts.md` abstraction ladder and
`docs/adr/authoring-rules.md` requirement gate, falling back to the plugin
templates. They own the single-level read and regeneration tests.

**PRD, ADR, and code are the same system at three resolutions** — like C4's context / container / component zoom, not three documents about three topics. The value of a level is what it **refuses** to show, because that is what lets a reader load one level, get its question answered, and stop.

So an ADR answers exactly one question: **"why this decision, and what must the result honor?"** Two ways to get that wrong, and you are guarding both directions at once:

- **Pulling detail up from the code level** (signatures, field types, pool sizes, pseudocode, file paths) — the ADR stops being trustworthy on its own, because it asserts things the code may already have changed. The reader must open the code to learn which half still holds, and the level no longer answers its question.
- **Pushing a requirement out** ("the PRD or code already has that number") — code shows enforcement and the PRD shows user intent, but neither explains the admitted architectural contract and rationale. This is the more expensive failure, which is why step 2 makes you ask about requirement values even unprompted.

The one test behind both, applied when you finish the draft:

> **Can this ADR be read alone and answer its own question — with nothing in it that belongs to the code level, and nothing missing that no other level holds?**

The regeneration test in step 3 is that test's second half; the "record only the gray zone" bullet is its first half. Full principle: `concepts.md` "The abstraction ladder".

## Procedure

### 1. Interpret the arguments

- **`<category>`** (required) — a kebab-case category key. Accept all of these forms (see `structure.md` "Directory structure"):
  - **A single-segment context / flat key** (`identity`, `auth`) — a single-feature context (flat), or a cross-cutting decision directly under a context. Derive the key from the feature name. Only for workshop or number-based PRDs where no feature name yields a meaningful kebab do you fall back to an ALPS Feature ID such as `f1` or `f-auth-01` — and even then the ID is not preserved as a separate field; it merely derives this category key.
  - **A two-segment `<context>/<feature>` key** (`identity/login`, `ordering/checkout`) — one feature (vertical slice) inside a bounded context. Use it when a context holds several features.

  For the category rules (top level = bounded context, sub-folder = feature, forbidden categories, cross-cutting and subdomain conditions), see `structure.md` "Directory structure" / "Anti-pattern categories". If the user supplies an anti-pattern category (`frontend`, `backend`, `api`, `db`, and the like — whether as the context folder or the feature sub-folder), ask once: "Does this decision belong to one feature (e.g. `identity/login`, `ordering/checkout`)? If two or more share it, a system-wide cross-cutting context (`infra`, `data`, `integration`, `security`, `platform`) is the better fit."

- **`[title]`** (optional) — if a title arrives as an argument, start from it. Otherwise ask the user once ("Which decision should this ADR record? One line for the title.").

Apply `authoring-rules.md` "ADR admission gate" **before any filesystem write or mapping initialization**:

- If the requested decision fails the gate, stop this skill without creating `docs/adr/`, `.mapping.json`, a category, or an ADR. Return one line naming the replaceable implementation means and where it belongs instead.
- If the choice is ambiguous because it may establish a trust boundary or externally supported contract, ask only for that boundary/contract. Never use "it is a technology choice" as sufficient evidence.
- An old low-level ADR does not justify adding another low-level ADR beside it.

After the request passes admission, apply `authoring-rules.md` **"Decision identity check — update before create" before any filesystem write, category creation, or ADR number allocation**:

1. If `docs/adr/.mapping.json` exists, read every summary. Inspect the requested category first, then plausible matches elsewhere so a renamed or miscategorized owner is not missed.
2. Read the full body of each plausible match. Compare the architectural question and the requirement/system/data/security/external boundary it owns, not the current product name, provider, adopted alternative, or direction of change.
3. If one existing ADR can express the requested result as a single current-state record, **stop the new-ADR path**. Do not create a category, allocate `NNNN`, or append an `adrs[]` record.
   - When code has not changed yet, route to `/adr-impl <existing-category>` so it rewrites that exact ADR in place, records a major transition when required, returns an implemented `Accepted` ADR to `Proposed`, and then implements.
   - When code already embodies the intended decision and the ADR is catching up, route to `/adr-sync <existing-category>`.
   - A provider replacement, an adopted-alternative replacement, an inverted Decision Driver, and a return to a formerly used provider are all edit-in-place when the same ADR still owns the topic. For example, GPT-5.6 via Amazon Bedrock → GPT-5.6 via the OpenAI API → Amazon Bedrock again keeps one provider-boundary ADR and one path.
4. Continue creating a new ADR only when no existing ADR owns the topic, or when the topic forks and multiple decisions must remain independently current and separately referenceable. When uncertain, the default is edit-in-place plus a decision-log entry.

After the decision passes the gate, check the mapping state:

- Create `docs/adr/` if it does not exist.
- If `docs/adr/README.md` (and `concepts.md`, `authoring-rules.md`, `structure.md`, `decision-log.template.md`) are absent, copy all five of the same files from `${CLAUDE_PLUGIN_ROOT}/templates/adr/`. `decision-log.template.md` is a **read-only seed** — copy it to `docs/adr/<category>/decision-log.md` when that category gets its first major decision change; do not pre-create it in the category folder now (the log exists only after there is a transition to record).
- **Reconcile the doc layout — `README.md` is the index, `concepts.md` is the working model.** 0.5.0 split them: the abstraction ladder, the gray zone, the dependency model, and Status transitions moved out of `README.md` into `concepts.md`, leaving `README.md` with what an ADR is, the ADR template, and where the index lives. The harness names each half-state, so **run the step 6(a) harness now if you have not, and act on whichever it reports**:
  - **`rules-doc-layout-legacy`** (a `README.md` with no `concepts.md`) — the repo predates the split. Offer to seed `concepts.md` from `${CLAUDE_PLUGIN_ROOT}/templates/adr/` and cut the moved sections out of `README.md`. **Diff before overwriting**: those sections may carry hand-edits (a translation, a tightened rule, a house convention), so carry them into the new `concepts.md` rather than dropping them. If the user declines, continue — every skill and agent falls back to reading those sections out of `README.md`, so the old layout still works.
  - **`rules-doc-layout-duplicated`** (both files exist, but `README.md` still holds sections `concepts.md` now owns) — worse than the un-migrated case, because two copies of one rule can drift apart and no reader can tell which went stale. Confirm `concepts.md` carries any edits made in the `README.md` copy, then offer to delete those sections from `README.md`.
  - Both are warnings, not errors: a lagging layout does not make an ADR wrong. Ask once, and never rewrite the docs without approval.
- **If they are present but stale, offer to refresh them.** Each seeded doc carries an `<!-- adr-writer:rules-version X.Y.Z -->` stamp; the harness reports a lag as `rules-doc-stale` (or `rules-doc-unstamped` for a copy predating the stamp). Seeding once and never again is how a repo keeps the rule set it got on day one while every rule added upstream stops existing for it — and since these docs are the source of truth every reviewer reads, that axis is not failed loudly, it goes unjudged. So when the stamp trails the installed plugin, **say which docs lag and ask once** before overwriting. Two things make this a question rather than an automatic copy: a project may have **hand-edited** its rules on purpose (translated them, tightened a rule, added a house convention), and an overwrite loses that silently. Diff first, name what a refresh would drop, and carry those edits into the new copy. If the user declines, continue with the existing docs — the ADR you are about to write is judged by the rules the repo actually holds.
- If `docs/adr/.mapping.json` is absent, create it as an empty skeleton (`{ "categories": {} }`).

Check for category bloat — once the category is settled, follow the inspect-and-propose procedure in `structure.md` "When a context grows — splitting into feature sub-folders". If the target folder (a feature sub-folder or directly under the context) holds 15 or more ADRs, propose a feature sub-folder split once; if the user accepts, write this ADR inside the sub-folder (`docs/adr/<context>/<feature>/`) — the normal path by which a flat key like `pricing` grows into `pricing/<feature>`. If they decline, or there are fewer than 15, continue with the flat structure and do not ask again.

### 2. Elicit the decision's motivation

Writing a good ADR without an ALPS requires the following. Ask briefly, one item at a time:

1. **What problem or need is driving this decision?** (Context)
2. **Which pressures, constraints, or requirements discriminate between the options?** (Decision Drivers — usually 3-5, but keep only real discriminators. Not generic quality attributes like "scalability" or "maintainability".) If the decision is tightly constrained, record why fewer drivers are sufficient.
3. **What choice are you making? One core line.** (Decision)
   - **Collect the values and contracts the result must honor as well** (the requirement contract — `authoring-rules.md` "Concrete numbers" + "Non-numeric requirements"). Even if the user says "that can just go in the code," record it in the ADR too — the value is enforced in code, but **only the ADR records that it is a contract**, which is what later justifies changing the ADR first (`authoring-rules.md` "Requirements live in the code and in the ADR"). **Always ask once**, even unprompted: "Are there values or rules a developer must not decide on their own here? For example a maximum count or number of turns, a usage quota, a retention period, a size cap, a response-time target — and also **the list of allowed states or values, whether an input is mandatory, who may see what, whether duplicates are allowed, and the unit of money or time.**" **Requirements do not arrive only as numbers, so do not stop at probing for numbers.** Carry each answer into the ADR **with its number and basis (policy, contract, regulation) verbatim.** The deciding question is "if a developer changed this value, would that violate a requirement?" — YES makes it a requirement value that must be recorded; NO makes it an implementation tuning value that must not. Classify anything the user answers with "whatever seems right" as a tuning value and leave it out — **never invent a number and record it as though it were a requirement.**
   - **Collect observable evidence for each contract row** — ask what implementation-independent result would show that the obligation is met or violated. Keep one obligation per row so later implementation review can assign one coverage status. Record outcomes such as "the sixth upload is rejected and the count remains 5", not test commands, file names, functions, libraries, fixtures, or internal representations.
   - **Expose only decision-changing assumptions.** When the alternatives comparison depends on an unstated fact, ask: "What assumption is this choice relying on, and what decision would we reconsider if it were false?" Route the answer before writing it. A value or rule the result must honor goes in the requirement contract. An assumption that changes which architectural alternative is preferred becomes one short line in Context or the relevant Decision Driver: `<assumption> — reconsider <decision> if false`. A replaceable library, SDK, adapter, internal structure, timeout, pool size, retry count, or other implementation default stays out of the ADR and is surfaced later by implementation review. If an unverified assumption changes the contract or a durable architecture boundary, resolve it before approval rather than recording it as accepted fact. Do not add a separate assumptions section, confidence taxonomy, or fixed table.

4. **Were other options considered and rejected? Collect the realistic alternatives that actually existed.** Two or more are useful when available. If policy, regulation, or an external boundary left only one valid path, record that constraint instead of inventing a strawman.
5. **Is there another category that must be implemented before this one (a prerequisite)?** (Upstream dependency — e.g. "checkout needs the cart working first".) If so, collect that **prerequisite category key** (otherwise "none"). This answer is stored as `dependsOn` in `.mapping.json` in step 4 and read by `/adr-impl`'s prerequisite gate — the "Prerequisites" line on step 7's confirmation screen comes from here too. In a project that also has an ALPS PRD, `/feature-to-adr` carries dependencies over from Section 6.3, so you need not ask again.
6. **(Optional) Which bounded context does this decision belong to, and what is its DDD subdomain classification?** — ask lightly only when the category is two-segment (`identity/login`) or the user cares about domain classification ("Is this context core to the product's competitiveness, supporting, or generic enough to be replaced by an off-the-shelf product?"). If they answer, store it as the context entry's `subdomainType` in step 4. **If they do not know, or the structure is flat and single-feature, skip the question** — it is advisory metadata and never forced.

If the user answers everything at once, take it as given; if they answer briefly, break it into one or two rounds. If they say they do not know, do not guess — agree on "shall we leave this blank, save as Proposed, and fill it in during /adr-impl?"

### 3. Draft the ADR

Follow `concepts.md`, `authoring-rules.md`, and `structure.md` under `docs/adr/` strictly (falling back to the same files under `${CLAUDE_PLUGIN_ROOT}/templates/adr/`).

- Category directory: `docs/adr/<category>/` (create it if absent; for flat-structure projects use `docs/adr/` alone)
- Assign the next number within the category. Filename: `NNNN-kebab-title.md` — always canonical form. **Never put an ALPS Feature ID in the filename** (no `0001-f1-...`) — Feature IDs are stored nowhere, and `/adr-impl` matches targets by category key.
- **Fill the `Date:` at the top of the body with the authoring date (`YYYY-MM-DD`)** — it records when the ADR was written and is separate from the Status transition date (`Accepted (YYYY-MM-DD)`). A `Proposed` Status line carries no date.
- **Status always starts as `Proposed`** (`/adr-impl` switches it to `Accepted` automatically after implementation, tests, and the final implementation review pass). Never ask the user about promotion — see `concepts.md` "Automatic transition rules".
- Body structure: Status / Context / Decision Drivers / Decision / alternatives / Consequences / (optional) Implementation Notes / Related. **The four required sections are Status, Context, Decision, and Consequences**, and `adr-structure-lint` hard-checks their presence. Decision Drivers and the alternatives section are strongly recommended (a warning when absent), and Implementation Notes is an optional section kept only when there are architecture-level implementation considerations (matching README's `## ADR template`).
- **Record only the gray zone** — leave out anything discoverable by reading the code that is also not a requirement (function responsibilities, module dependencies, field types, error message wording, logs, env var names, pseudocode, implementation tuning values). Each of those belongs to the level below, and copying it up is what makes an ADR unreadable alone. The body's center of gravity should be "the motivation behind the decision that the code cannot show": adoption rationale, business rules translated into system behavior, domain rules and state transitions, external-dependency fallback — see `concepts.md` "What an ADR covers — the gray zone between business and code".
- **Keep the core subject above code resolution** — a cleanly written ADR about a replaceable library, SDK, framework, middleware, credential/auth adapter, or module structure still fails the admission gate. Do not hide a code-level subject behind architecture vocabulary. If the provider/model boundary is the decision, name that boundary and leave its client and credential plumbing out.
- **Route each fact to its level before writing it** (`authoring-rules.md` "The requirement gate and two filters", in this order). (0) **Requirement gate** — "if this were missing, could code rebuilt from the ADR alone violate a requirement?" YES keeps it unconditionally, and no filter below applies. (1) **Code-readthrough test** — for a fact that failed the gate, "would an agent reading this code discover it?" YES sends it down to the code level. (2) **Litmus test** — "if this value changed, would the decision itself change?" NO sends it down too. Asking (1) before (0) is how a requirement gets deleted for being "visible in the code", which is this skill's most expensive mistake.
- **Record requirement values verbatim** — put the limits, cycles, caps, and targets collected in step 2 into the `Decision`'s requirement contract (the README template's `### Requirement contract`) with the number and its basis. Do not blur them into "is limited" or "within a reasonable time," and equally do not write them as constant or environment-variable names (`MAX_TURNS = 20` ✗ / "a chat session is capped at 20 turns — pricing policy" ✓). **Record non-numeric requirements in the same place** — allowed value sets, mandatory fields, permissions, visibility, ordering, uniqueness, and units go in as domain sentences, never as enum identifiers (`Status = ["PAID","SHIPPED"]` ✗ / "an order is paid, shipping, delivered, or cancelled, and a cancelled order never moves to shipping" ✓). For the detailed criteria see `authoring-rules.md` "Concrete numbers" and "Non-numeric requirements".
- **Group the requirement contract for scanning** — place each populated row under `Required guarantees`, `Prohibitions`, or `Failure guarantees`. Omit empty groups. This is presentation, not a filter: preserve every exact value, allowed state, permission, ordering rule, uniqueness rule, unit, and basis that passed the requirement gate.
- **Make the contract reviewable** — keep one independently reviewable obligation per row and add `Observable evidence` that names the implementation-independent result used to distinguish compliance from violation. Do not prescribe test files, commands, functions, classes, libraries, fixtures, or internal data representation.
- **Keep decision-changing assumptions inside the existing structure** — include only assumptions that could change the adopted alternative, as one line in Context or the relevant Decision Driver with what must be reconsidered if false. Never move requirement values into an assumption, and never persist replaceable implementation defaults there. Do not create a separate assumptions section or confidence scale.
- **Put yourself through the regeneration test once** — after finishing the draft, ask "if all this code were deleted and only this ADR survived, could requirement-honoring code be rebuilt from it alone, and could a reviewer tell requirement by requirement whether the rebuilt code complies?" A different implementation is normal, but if a contract or implementation-independent observable result is missing (requirement values, permission rules, required validation, state transitions, guaranteed behavior on failure), ask the user right there and fill it in — the reviewer's R19 in step 6 checks the same thing.
- **Describe the Decision as a vertical slice** — connect user action → API → data change without a break, in one paragraph or a sequenceDiagram. Covering the UI/API/Data decisions of one feature (the leaf — a feature sub-folder or a single-feature context) together is normal; never split into per-layer ADRs. When async flow or state transitions are central, use stateDiagram-v2 or flowchart.
- **Write the final state, not the transition** (`authoring-rules.md` "Final-state wording"). State the currently valid result directly in the body and `.mapping.json` summary: "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다" ✗ / "이벤트 이름은 `CURRENT_EVENT`다" ✓. Remove replaced identifiers, previous values, migration steps, and contrast phrases when they add no current contract. Alternatives may name rejected choices, and major changes belong in `decision-log.md`. A real current prohibition or forbidden transition that passed the requirement gate remains.
- **Write it tight, and in the active voice** (`authoring-rules.md` "Prose style"). An ADR is read under time pressure by someone deciding whether to trust it, so every padding word costs the reader attention the decision needed. Use the active voice by default — "the gateway rejects a duplicate payment", not "duplicate payments are rejected" — because the passive drops the actor, and who validates or owns the state is often the decision itself. Cut hedges ("basically", "it is worth noting that") and throat-clearing ("in order to" → "to"; "has the ability to" → "can"), keep one idea per sentence, prefer the concrete noun to the vague one, and state the decision rather than narrating how you reached it. **But never shorten by deleting content** — a dropped requirement value, permission rule, or fallback policy is a defect, not concision.
- **Lead with intent and remove AI slop** (`reader-first-writing.md`). Start Context from the verified problem and decision pressure, and state the current Decision before supporting detail. Prefer a verified causal flow to a forced list. Rewrite repeated contrast templates, one-off ornamental English labels, forced numbered symmetry, filler bridges, and tables or diagrams that repeat adjacent prose. Never invent an anecdote, project result, measurement, or causal relationship.
- **Use diagrams to explain, not decorate** — when a decision flow, state, system boundary, or alternatives relationship is clearer visually, add a Mermaid diagram containing only architecture-level relationships established by the decision. Do not copy the implementation call graph, name file-level symbols, or add a diagram that merely repeats the paragraph.
- For the full forbidden/keep lists see `authoring-rules.md` (the same rules apply inside diagrams).

### 4. Update the mapping

`docs/adr/.mapping.json` (schema: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`). The mapping is **the single ADR index** — each ADR is registered once with its path, Status, and a one-line summary. **It stores no ADR↔code paths** (the code is located by reading the ADR each time) **and no PRD reference** (adr-writer is standalone).

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

- An `adrs` item is an **object** `{ "path", "status", "summary" }`, not a string. `path` is repo-relative, `status` mirrors the `## Status` of the ADR body you just wrote (so a new ADR always starts as `"Proposed"`), and `summary` is a one-line compression of the Decision (the Key Decision). This record is the ADR index entry (see step 5 for the index's role).
- If the category already has an entry, push the new record object onto the `adrs` array.
- **`dependsOn`** — record, as an array, the category keys the user named as prerequisites in step 2 item 5. This is exactly the field `/adr-impl`'s prerequisite gate reads, in the same category-key id-space. Reference only existing category keys and keep the graph acyclic (never including itself) — see `dependsOn` in `mapping.schema.json`. An edge pointing at a category in another context is normal. If the user answered "none" to item 5, record `dependsOn` as `[]` — the empty array means "explicitly checked, no dependencies," and `/adr-impl` proceeds without a notice. Omitting `dependsOn` entirely makes `/adr-impl` treat it as "dependencies undeclared" and emit a one-line warning, so never omit it on the `/adr-new` path where item 5 was asked.
- **`subdomainType`** (optional) — record it on the context-level entry only when step 2 item 6 was answered (feature sub-folder entries inherit the parent context's classification, so they usually omit it). Omit it for flat or unknown cases — it is advisory metadata and the mapping stays valid without it.
- adr-writer stores no PRD link — even when this ADR came from an ALPS import, `feature` is just a human-readable label, not a PRD back-reference. For an imported category, `dependsOn` is usually filled by `/feature-to-adr` from Section 6.3. Still, if a standalone `/adr-new` call asked step 2 item 5, **record `dependsOn` as `[]` per the rule above even when the user named no prerequisite — do not omit the key** (omitting it makes `/adr-impl` warn about "dependencies undeclared"). Treating `[]` and an omitted key differently maps directly onto `/adr-impl`'s prerequisite-gate split between "no dependencies (checked)" and "undeclared (warning)".

### 5. Update the index

The ADR index is `docs/adr/.mapping.json` — the README no longer holds an ADR list. The `adrs[]` record pushed in step 4 (path + `status:"Proposed"` + summary) _is_ the index entry: its `summary` is the lookup entry point for later admitted work and `/adr-sync --quick`. So the index was already updated in step 4 with no separate edit, and all you need here is to confirm (a) that the one-line `summary` accurately compresses the Decision and (b) that `status` matches the body's `## Status` (= `Proposed`) — see step 4. The README remains a conceptual index only (what an ADR is, the gray zone, the dependency model, the template), so leave it untouched here.

### 6. Verify before saving — the deterministic harness, then your own R1-R20 pass

Verify in two stages just before saving: **the deterministic harness settles the mechanical rules, and the authoring path performs the judgment pass.** Self-check is the default; for a long ADR, new domain, high uncertainty, or an axis the author cannot judge independently, the current model may use an independent reviewer or separately grounded pass.

The default self-check avoids repeating the same read when the authoring context is
fresh. Use an independent reviewer only when length, novelty, uncertainty, or a
known blind spot makes a separately grounded read materially stronger.
`/adr-review` remains the later path for inherited or hand-edited ADRs.

**(a) The deterministic harness — `adr-structure-lint`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <the category key of the ADR you just wrote>
```

This harness parses the `docs/adr/` this ADR lives in and mechanically verifies the following (grounded in `authoring-rules.md`, `concepts.md`, and `structure.md`):

- The Status enum and date format (the first half of R1), presence of the required sections (Status/Context/Decision/Consequences), canonical filename (`NNNN-kebab.md`, no stale `fN-` prefix), title number = filename number, path depth ≤ 2 segments
- Anti-pattern category segments (the first half of R5), advisory Driver/alternative count warnings (R13/R14), Related links resolving (R10), whether a value is written in code-constant form (R18's format half — the `value-as-constant` warning)
- The `.mapping.json` schema and `dependsOn` integrity (dangling / self-edge / cycles — R16), mapping↔disk consistency (R8), plus the mapping `adrs` record shape (path/status/summary) and status↔body agreement
- Internally it calls `adr-invariants.sh` to also check code→ADR and ADR→PRD back-references (R15/R17)
- Seeded-doc health, reported once for the directory rather than per ADR: version lag (`rules-doc-stale` / `rules-doc-unstamped`) and layout lag (`rules-doc-layout-legacy` / `rules-doc-layout-duplicated`) — all four route back to step 1, which owns the seeding and the refresh question

If there is an `error`, fix it in this session before moving to the save in step 7 (usually resolved by editing the ADR body or the mapping). Carry the `warning`s (alternative/driver counts, suspected code references, and the like) into the (b) pass and rule on each there — a warning is where the harness found the shape but cannot judge the substance.

**(b) Your own pass over the judgment rules**: once the harness passes (or leaves only warnings), walk the **ADR review checklist** in `docs/adr/authoring-rules.md` (falling back to `${CLAUDE_PLUGIN_ROOT}/templates/adr/`) over the draft you just wrote. That checklist is the same rule set the reviewer agent applies as R1-R20, so it is the authority here — do not work from memory of it.

Skip the items the harness already proved (Status format, required sections, filename, driver and alternative counts, Related links, mapping consistency, code and PRD back-references) and spend the pass on **what the harness structurally cannot see** — it never flags a bare number, judges substance, or reads a sentence:

- **Missing requirement values and non-numeric requirements (R18a)** — is any limit, quota, cycle, retention period, cap, or target implied by Context/Drivers/Decision blurred into "appropriately", "is limited", or "a certain period"? Is any allowed value set, mandatory field, permission or visibility rule, ordering or uniqueness constraint, unit, or forbidden transition missing?
- **The regeneration test (R19)** — delete all code, keep only this ADR: could requirement-honoring code be rebuilt, and could each obligation be reviewed through an implementation-independent observable result? Name every contract and review oracle a rebuild would have to honor, and say which are absent.
- **Tuning-value intrusion (R18b)** and **implementation-detail creep (R3)** — a value a developer may change without violating a requirement, a code snippet, a field-type table, an env var name, pseudocode.
- **The level filters (R4)** in gate-then-filters order — the requirement gate first, and only then the code-readthrough and litmus tests. Applying a filter before the gate is how a requirement gets deleted for being "visible in the code", and it is this skill's most expensive mistake.
- **Gray-zone substance (R12)**, **discriminating Drivers (R13's quality half)**, **strawman alternatives (R14's quality half)**, **vertical-slice cohesion (R5's latter half)**, **one ADR = one decision (R11)**.
- **ADR admission gate (R12)** — does the core subject itself change a durable contract, boundary, provider/model/fallback, key design, or cross-implementation trade-off? If it is only a replaceable implementation means, do not save the ADR.
- **Final-state wording (R3)** — do the body and mapping summary state the current result directly, without carrying replaced identifiers, previous values, or transition narration outside Alternatives and `decision-log.md`? Confirm that removing comparison residue did not remove a current prohibition.
- **Decision identity check (R11/R12)** — did the mapping and plausible ADR bodies reveal an existing owner for this architectural question or boundary? If yes, stop and route to edit-in-place; a new provider name, reversed direction, or changed Driver is not by itself a new decision.
- **Prose style (R20)** — advisory. Apply `reader-first-writing.md`, including
  its AI-slop signals, and never accept a cut that drops content.

**Two of these you cannot check as well as a fresh reader, so make them explicit rather than assumed.** The values were in this conversation and the alternatives are yours, so a draft missing a requirement still reads as complete to you, and your own alternatives never look like strawmen. So for **R18a and R19, write the check out** — list the contracts a rebuild must honor and mark each present or absent, instead of concluding "the contract is complete". Anything absent goes back to the user as a question in step 7; **never invent a number to close the gap.**

Fix what the pass finds before step 7. If the draft needs splitting, or a DB schema change needs `docs/tables/` updated in the same change, return to step 3. **Report the pass in one line at step 7** ("harness passed; R18a/R19 checked; independent read: used|not needed — run `/adr-review <category>` for a later second opinion").

### 7. User confirmation

Show a verified **Decision Digest** and ask for approval. The digest is an ephemeral reading view over the ADR, not a second artifact or source of truth; the complete ADR body and `.mapping.json` remain authoritative. Show the full ADR body or detailed Alternatives only when the user asks or when the digest cannot expose a material ambiguity:

Before showing the digest, read
`${CLAUDE_PLUGIN_ROOT}/references/comprehension-load.md` completely and apply
its advisory score.

Only when the user asks to split, offer up to three candidates. Split into
separate ADRs only for independent decisions. Keep one inherently difficult
decision in one ADR and offer implementation steps instead; never split by
technical layer.

```
## Decision Digest — ADR <NNNN>: <title>

**Category**: <category key — e.g. identity/login (context: identity, subdomain: core)>
**Comprehension load**: <N>/10
**Decision question**: <the architectural question this ADR answers>
**Decision intent**: <the verified problem, pressure, and result this decision exists to protect>
**Current decision**: <2-3 sentences stating the final state>
**Decision Drivers**: <real discriminators; usually 3-5>
**Decision-changing assumptions**: <assumption → what decision is reconsidered if false; omit when none>
**Requirement contract**:
- Required guarantees: <verbatim values and rules with their basis, or omit this row>
- Prohibitions: <forbidden states, transitions, actions, or visibility, or omit this row>
- Failure guarantees: <what remains guaranteed on rejection or failure, or omit this row>
- Observable evidence: <one implementation-independent result per obligation; no test or code details>
<write "none" only when the complete contract is empty>
**Why this decision**: <the discriminating rationale against the realistic alternatives>
**Main risks**: <the negative consequences or material uncertainties>
**Regeneration checklist**: <each contract rebuilt code must honor and the observable result used to review it, marked present; unresolved items are explicit questions>
**Alternatives considered**: <N realistic options; expand only on request or when one affects approval>
**Prerequisites**: <dependency ADRs, or none>
**Verification**: <harness: pass | n warnings> · R1-R20 checked · independent read: <used|not needed>

Does this current-state decision, any decision-changing assumptions, complete contract, rationale, risks, and complete regeneration checklist match your intent? If approved, save the full ADR as `Proposed` and move on to implementation (`/adr-impl`). This is the routine intent/spec-fitness confirmation; implementation review does not ask the same questions again unless the ADR changes or a genuine contract ambiguity is discovered.
```

> Show the context/subdomain information on the category line only when step 2 item 6 was asked and answered — otherwise print the category key alone.

Do not start changing code before approval. If the user requests changes, update the ADR and confirm again. Preserve this approved ADR as the implementation baseline; after code and review pass, `/adr-impl` promotes it without another routine confirmation.

### 8. Point to the next step

After saving, offer the next step in one line:

- "Continue straight into implementation with `/adr-impl <category>`?" — the common flow.
- "If there are more ADRs to write alongside this decision, call `/adr-new <category>` again for the same category."
- Offer `/adr-review <category>` only when the user asks for a second opinion, or when step 6(b) left an axis you could not settle — it is the path for an ADR nobody has an authoring context for, which is what a hand-edited ADR becomes. Do not run it automatically here; the draft was just judged against the same rules.

> **Note**: if an ALPS Section 7 feature already exists and you want to bulk-convert it into ADRs, use `/feature-to-adr`. `/adr-new` is the path for authoring a single decision directly, as it comes up.
