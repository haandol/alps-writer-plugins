# ADR authoring rules and review checklist

What goes into an ADR body and what stays out. The principle these rules follow from, the gray zone, and the dependency model: [`concepts.md`](./concepts.md). Directory and mapping policy: [`structure.md`](./structure.md). The directory index and the ADR template: [`README.md`](./README.md).

An ADR records an architectural decision (Context, Decision, Consequences). To keep code changes from dragging ADR edits behind them, **implementation detail stays out of the ADR.**

**Every rule in this document is one constraint on resolution.** PRD, ADR, and code are the same system at three zoom levels (like C4's context / container / component), and the point of a level is what it refuses to show — so that a reader can load one level, get its question answered, and stop. Each keep/drop call below is therefore the same question in different clothes: _does this fact belong to this level's resolution?_ Detail from a lower level makes the ADR untrustworthy alone; a requirement pushed out of it lands in no level at all. For the full principle see [`concepts.md` "The abstraction ladder"](./concepts.md#the-abstraction-ladder--the-principle-every-rule-follows-from).

## ADR admission gate — decide whether the decision belongs here

Apply this gate **before creating an ADR, before updating one because code changed, and before classifying code as an undecided decision.** The line-level filters below assume the ADR's core subject already belongs at the architectural level; they cannot rescue an ADR whose subject is merely a library or wiring choice.

Keep the decision at the ADR level only when it changes at least one of:

- a requirement contract, domain invariant, allowed state/transition, permission, or visibility rule
- a system boundary, deployment topology, data/key design, or security trust boundary
- the adopted external system, provider, or model and its fallback/degradation policy
- an algorithm, consistency model, or operating trade-off that constrains multiple implementations

Then ask the **implementation substitution test**:

> Could a developer replace this library, SDK, framework, middleware, module layout, credential-loading mechanism, signer, or adapter while preserving the same requirement contract, system boundaries, trust boundaries, and accepted trade-offs?

- **Yes → implementation detail.** Do not create or update an ADR. Keep the choice and its verification in code, tests, dependency metadata, or project conventions.
- **No → architectural candidate.** Continue with the requirement gate and the two line-level filters below.

Examples:

| ADR-level decision                                                                | Code-level realization                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Use GPT-5.6 through Amazon Bedrock as the external model/provider boundary        | Which AWS SDK client, wrapper library, request builder, or retry helper performs the call          |
| Workloads authenticate across a defined trust boundary without long-lived secrets | Which credential provider chain, signer, middleware, or adapter loads and attaches the credentials |
| Private boards are visible only to invited members                                | Which middleware function or authorization library performs the check                              |
| Orders use optimistic concurrency because duplicate fulfillment is unacceptable   | Which ORM helper, repository method, or conditional-write wrapper implements the check             |

Technology names are not sufficient evidence by themselves. A provider/model selection can be architectural because it fixes an external boundary and durable constraints; a library or authentication adapter usually remains replaceable implementation detail. If changing the choice would make ordinary behavior-preserving code work drag an ADR edit behind it, the choice fails the **stability check** and belongs one level down.

If an existing ADR's core subject fails this gate, do not merely clean up its wording. Propose retiring it and move any useful implementation guidance to the code or project documentation. Likewise, code that contains an unrecorded implementation choice does not automatically need an ADR; it must pass this gate first.

## Decision identity check — update before create

The admission gate answers **whether an ADR should exist**. It does not answer **whether the requested decision already has an ADR**. After a request passes admission, run this check before creating a category, allocating the next number, or drafting a new file:

1. Read `.mapping.json` and compare the request with existing ADR summaries. Start with the requested category, then inspect plausible matches in other categories so a naming change does not hide the owner.
2. Read every plausible ADR body. Identify a decision by the architectural question it answers and the requirement, system, data, security, or external boundary it owns — not by its current provider, product name, adopted alternative, or direction of change.
3. If one existing ADR can be rewritten as a single current-state record, update that ADR in place. Keep its path and number. Refresh its body and mapping summary, record a major transition in `decision-log.md` when required, and return an implemented `Accepted` ADR to `Proposed` before changing code.
4. Create a new ADR only when no existing ADR owns the topic, or when the topic forks so multiple decisions must remain independently valid and separately referenceable.

A provider replacement is normally an evolution of the provider-boundary decision, not a new decision identity. Keeping the model while changing Amazon Bedrock to the OpenAI API updates the existing model/provider ADR. Returning from the OpenAI API to Amazon Bedrock updates the same ADR again; reversal does not create a fresh identity. The same rule applies when Decision Drivers change or the adopted alternative is replaced.

**Do not create a new ADR and immediately supersede or deprecate the old one merely to preserve history.** The current body owns the present decision, `decision-log.md` owns major transitions, and Git owns the verbatim diff.

## What an ADR must satisfy — the regeneration test

An ADR's goal is **not to reproduce the same code, but to make regenerated code satisfy the business requirements.** So completeness reduces to one question:

> **Regeneration test**: "If all the code were deleted and only this ADR survived, could someone read it and rebuild code that honors the business requirements exactly?"

- **Implementation, structure, file layout, and names may differ** — they are not in the ADR, so they are the implementer's discretion. That is correct, and an ADR must not pin them.
- **Nothing the result must honor may be missing** — if it is, the regenerated code violates a requirement. That is a defect in the ADR.

These two sentences govern every other rule here. The filters below are tools for "what to drop"; the regeneration test is the standard for "what may never be dropped."

### Reviewable contract rows and observable evidence

An ADR carries the intent that implementation review later checks. Write each requirement-contract row as **one independently reviewable obligation**. Do not bundle several values, permissions, transitions, or failure guarantees into a sentence whose partial implementation could look complete.

For each obligation, record implementation-independent **observable evidence**: what result would let a reviewer distinguish a conforming implementation from a violating one. Examples:

- Requirement: "Free plan users upload at most 5 files per month." Observable evidence: "the sixth upload in one month is rejected and the stored file count remains 5."
- Prohibition: "A cancelled order never moves to shipping." Observable evidence: "a shipping request from cancelled leaves the order cancelled."
- Failure guarantee: "Provider failure never records payment completion." Observable evidence: "a failed provider call leaves no completed payment."

Observable evidence is a review oracle, not a test prescription. Do not name test files, commands, libraries, functions, classes, fixtures, internal tables, or data representations. Different implementations may use different tests and structures while producing the same observable result.

## The requirement gate and two filters

Apply three questions to each line of the body, **in this order**:

0. **Requirement gate**: "If this fact were missing, could code rebuilt from the ADR alone violate a requirement?" — YES → **always keep it.** Do not apply the filters below.
1. **Code-readthrough test**: "Would an agent reading the code this ADR governs discover this fact?" — YES → leave it out (code is the source of truth).
2. **Litmus test**: "If this value/detail changed in the code, would the architectural decision itself change?" — NO → leave it out.

**Why the gate comes first**: applying only 1 and 2 lets **requirements themselves leak out** under the excuse "you can read it in the code." Code tells you the system behaves this way today; it does not tell you whether that is a contract to honor or a value the implementation happened to pick. When the code is gone, so is that distinction — so requirements were never subject to the code-readthrough test.

The litmus test alone, without filter 1, lets decision facts that are obvious from the code back in and blurs the gray zone. Only for lines that fail the gate: filter with the code-readthrough test first, then the litmus test.

## Requirements — what the result must honor

### Concrete numbers — keep requirement values, drop tuning values

A number is not dropped for being a number. **If the number is a requirement, it belongs in the ADR verbatim**; if the implementation picked it, it belongs in the code. One question decides: **"If a developer changed this value at will, would that violate a requirement?"**

- **Yes → requirement value. Write the number and unit verbatim.** Product, business, contract, or regulation set it, so regenerated code must use the same value.
- **No → implementation tuning value. Leave it out.** The implementation chose it for performance or stability; changing it leaves the requirement intact.

| Requirement value — put in the ADR                    | Tuning value — leave in code  |
| ----------------------------------------------------- | ----------------------------- |
| A chat session is capped at 20 turns                  | HTTP connection pool size 10  |
| Free plan allows 5 uploads per month                  | Retry backoff 200ms           |
| 7-day grace period after signup; refresh token 7 days | Local perf cache TTL 30s      |
| Password minimum 10 characters (security policy)      | bcrypt cost factor 12         |
| Attachments up to 25MB (pricing/UX contract)          | Upload streaming chunk 64KB   |
| p95 response within 3s (NFR target)                   | 4 worker threads              |
| Account locks after 5 consecutive failed sign-ins     | Job queue poll interval 500ms |
| Search returns 20 results per page                    | Index refresh interval 1s     |

Judging edge cases:

- **Retry counts** — "at most 3" is a requirement value when it is a contract the user or billing sees (duplicate-payment prevention, an SLA). If it merely absorbs transient errors it is a tuning value, so write only "retries are finite."
- **Timeouts** — a response ceiling promised to users is a requirement value; an internal connection timeout is a tuning value.
- **Retention, quotas, limits** — usually requirement values (pricing, law, or UX contracts set them).
- When unsure, **lean toward writing it.** A missing requirement builds the wrong product; one extra value is just noise.

**Write values as domain sentences, never as code identifiers** — constant names, environment variable names, and config keys stay banned (the code owns and renames those). Not `MAX_TURNS = 20` but "a chat session is capped at 20 turns; exceeding it starts a new session." **Attach a scrap of justification** ("pricing policy", "security rule", "contract §4.2") — without it the next reader mistakes the value for a tuning value and deletes it.

### Non-numeric requirements — value sets, mandatory fields, permissions, ordering

Requirements do not arrive only as numbers. Apply the **same deciding question** ("would a developer changing this at will violate a requirement?") to non-numeric facts. YES means it passes the requirement gate, so it stays. Treating only numbers as requirements lets the facts below get filed as "obvious from the code" and leak out, and the regenerated code breaks the contract.

| Requirement fact — put in the ADR                                           | Implementation's choice — leave in code   |
| --------------------------------------------------------------------------- | ----------------------------------------- |
| **Allowed value set**: an order is paid, shipping, delivered, or cancelled  | Constant names and wire-string casing     |
| **Mandatory or not**: a refund request must state a reason (regulation)     | Whether validation uses zod or the ORM    |
| **Permission/visibility**: only invited members can read a private board    | Whether the check sits in middleware      |
| **Ordering/uniqueness**: payment succeeds at most once per order            | Which hash builds the idempotency key     |
| **Unit/format**: amounts in integer KRW, timestamps stored UTC (billing)    | Internal DTO field types                  |
| **Allowed/forbidden transitions**: a cancelled order never goes to shipping | Whether transitions use a switch or table |

**The key split — the business-defined set vs the name the implementation gave it**: the _set_ of order states and its _transition rules_ are a business contract, so the ADR is authoritative. The **constant name, enum identifier, and wire representation** (`StatusPaid` vs `"PAID"`) are implementation facts, so the code is authoritative. So "enums are code-authoritative" must not be applied wholesale — split it: **set and transitions belong to the ADR, names and representation to the code.** This split also governs the [source-of-truth scope](#changing-an-adr--edit-in-place-vs-supersede) decision and the code-reconciliation steps in `/adr-sync` and `/adr-rollup`.

When unsure, **lean toward writing it** here too — same reason as with numbers.

### Requirements live in the code and in the ADR — layers, not duplication

A requirement value or rule exists in **both the ADR and the code.** This is not the duplication the [code-readthrough test](#the-requirement-gate-and-two-filters) removes, because the two hold different things:

- **ADR = the contract** ("a chat session is capped at 7 turns — pricing policy"). What must be honored, and why.
- **Code = enforcement of that contract** (counting turns and starting a new session past 7). How it is honored.

From the code alone you can see "it is 7 turns today," but **not whether that is a contract to honor or a value the implementation happened to pick.** Only the ADR carries that distinction, so dropping the value from the ADR because the code has it destroys the basis for telling contract from coincidence.

#### So the change order is fixed — ADR first, code second

Changing a requirement value or rule **changes a system behavior requirement.** Therefore:

1. **Update the ADR's requirement contract to the new value or rule** (7 turns → 10 turns).
2. Record the transition as one line in the category's `decision-log.md` — a requirement value or rule change is major at minimum ([logging criteria](#what-to-log--minor-vs-major)).
3. **Bring the code to that value in the same change unit.**

**Never change the code first and reconcile the ADR later.** That lets a code change redefine the requirement after the fact, inverting the PRD → ADR → code direction ([stability gradient](./concepts.md#dependencies-run-one-way-references-are-written-in-neither-direction)). This holds even when the edit looks like "one constant" — the order is set by **whether it is a contract**, not by the size of the change.

By contrast, **tuning values absent from the ADR** (pool sizes, backoff, cache TTL, worker counts) carry no such order. Change them freely in code, and do not write them back up into the ADR.

`/adr-impl` (value changes during implementation), `/adr-sync` (its "requirement value — ADR is authoritative" branch), and `/adr-impl-review` (the contract-compliance axis) all enforce this same direction.

## Code references — folder level only

When an ADR points at code, **folder (directory) granularity is the limit.** Never go to file level or below.

- Allowed: `packages/api/handlers/`, `apps/web/src/components/`, `services/<domain>/`
- Forbidden: `apps/web/src/components/Login.tsx`, `services/auth/auth_service.go`
- Forbidden: filename or line-number citations (e.g. `prompt_template.md:42`)

This applies equally to prose, tables, and Mermaid diagrams. Inside diagrams, describe the behavior rather than naming functions or method calls — Bad: `stats.IncrementSourceCount("chat")`; Good: `increment sourceCounts.<source>`. That holds for sequenceDiagram, stateDiagram, and flowchart alike. If a decision truly requires quoting a function, class, or file name, reconsider whether it belongs in a docstring, README, or inline comment instead of an ADR.

Symmetrically, **code must not carry ADR IDs or paths** — not in comments, constants, or imports. Likewise, **an ADR body must not carry PRD (ALPS) paths, section numbers, or feature IDs** (Context and Related included): adr-writer is standalone, so an ADR absorbs the PRD's motivation once at import time and never points back at it, and the mapping stores no PRD reference either. The category → ADR → (searched-for) code link lives in exactly one place, [`.mapping.json`](./structure.md#the-adr-registry-mappingjson). Full rationale: [the dependency model](./concepts.md#dependencies-run-one-way-references-are-written-in-neither-direction).

## What to exclude from an ADR

Exclude everything discoverable by reading the code, plus detail outside the gray zone. **Items that passed the requirement gate override this table** — "forbidden" is the default for when the fact is _not_ a requirement. The last column records each exception.

| Forbidden                          | Example                                | Instead                              | Exception when it is a requirement                                                                                      |
| ---------------------------------- | -------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| File paths or deeper               | `apps/web/src/Login.tsx`               | Folder level (`apps/web/src/`)       | None (a path cannot be a requirement)                                                                                   |
| Code snippets                      | Signatures, interfaces, structs        | The code is the source of truth      | None — state a contract as prose or a table                                                                             |
| Function/class responsibilities    | "AuthService calls SessionStore"       | Code and docstrings                  | None                                                                                                                    |
| Module/package dependency graphs   | "auth → users → notifications"         | The imports themselves               | None                                                                                                                    |
| Design patterns used               | "Repository pattern", "DI container"   | Obvious from code structure          | None                                                                                                                    |
| Libraries, SDKs, frameworks        | AWS SDK client, ORM, state library     | Dependency metadata and code         | Only the external provider/system boundary or a mandated platform constraint belongs in the ADR                         |
| Credential/auth wiring             | Provider chain, signer, middleware     | Code and security configuration      | Only a required trust boundary or security policy belongs in the ADR; its plumbing does not                             |
| Detailed entity field tables       | `phraseHash \| S \| ...`               | Delegate to `docs/tables/`           | None (key design is under "what to keep")                                                                               |
| Field types, validation, defaults  | `email: string, required, max 255`     | Schema/zod/ORM definitions           | **Business-set limits, formats, and mandatory fields** (10-char password, 25MB attachment, required refund reason) stay |
| Enum identifiers and wire form     | `StatusPaid`, `"PAID"`, value casing   | Type and constant definitions        | **The business-set allowed value set and transition rules** go in as domain sentences (set = ADR, name = code)          |
| Implementation tuning values       | Pool of 10, backoff 200ms              | Concepts only ("retries are finite") | **Requirement values** (20 turns, 5/month, 7 days) go in verbatim                                                       |
| Env var names and config keys      | `AUTH_TOKEN_TTL`, `DB_POOL_SIZE`       | Config docs, code defaults           | Names stay banned — if the value is a requirement, write **only the value** as a sentence                               |
| Error messages, UI labels, logs    | "Invalid credentials"                  | i18n / message catalog               | Wording stays banned — **what the user must be told** goes in                                                           |
| Migration/ops commands             | `uv run python migrate_...`            | Document in the script itself        | None — record only constraints such as zero-downtime                                                                    |
| API paths/method tables            | `POST /v1/auth/session`                | OpenAPI, routes, and tests           | A public compatibility contract may stay as a domain statement; internal endpoint names and paths do not                |
| Full API JSON examples             | A 20-line request/response             | OpenAPI and schemas                  | None — state only the **meaning** of required fields                                                                    |
| Algorithm pseudocode               | "1. verify token 2. create session..." | The function body is the truth       | If the ordering is a **domain rule**, write it as transitions and invariants                                            |
| Directory/file naming conventions  | "handlers are `*-handler.ts`"          | AGENTS.md / CONTRIBUTING.md          | None                                                                                                                    |
| CSS classes and Tailwind utilities | `bg-primary`, `flex-col`               | Design-token docs (DESIGN.md)        | None                                                                                                                    |

## What to keep in an ADR

Keep only the gray zone — what code cannot reveal, or what loses its intent unless gathered in one place. **Everything that passed the requirement gate is added to this** — a contract the result must honor stays even when it looks obvious in the code.

- **Requirements the result must honor** — [requirement values](#concrete-numbers--keep-requirement-values-drop-tuning-values) (limits, quotas, cycles, retention, allowed ranges) and [non-numeric requirements](#non-numeric-requirements--value-sets-mandatory-fields-permissions-ordering) (allowed sets, mandatory fields, permission and visibility rules, ordering and uniqueness, units), plus user-visible behavior contracts and required validation conditions. With the code gone, this alone must be enough to rebuild code honoring the same contract
- **Problem background and motivation** (WHY) — why this decision was needed; which constraints and assumptions forced this choice
- **Decision-changing assumptions** — only facts or expectations that materially change which alternative is preferred. Keep each as one line in Context or the relevant Decision Driver: `<assumption> — reconsider <decision> if false`. A requirement belongs in the requirement contract instead; a replaceable implementation default belongs in code and the implementation review
- **Decision Drivers** — the pressures, constraints, and requirements that discriminate between options (see [Decision Drivers](#decision-drivers))
- **Decision summary** — what was decided and why over the alternatives (the rationale is the point: the decision shows up in code, but "why not the other way" does not)
- **Alternatives table** — the options considered and why they were not adopted (see [Alternatives](#alternatives--at-least-two))
- **Business rules translated into system behavior** — how a rule like "7-day grace period after signup" maps onto triggers, state values, and events (conceptual, not a call chain). **Values carried by the rule (7 days) are written verbatim, never rounded or blurred into "a certain period"**
- **Entity relationships** (conceptual) — "Flashcard is a separate entity from Vocabulary, linked by phrase hash" (not a field list)
- **DB key design** — PK/SK/GSI patterns, whether an index is sparse — key structure shifts the decision, so it stays (per-field types go in `docs/tables/`)
- **Access patterns** — purpose, query type (Table/GSI/GetItem/BatchGet), call frequency — the evidence that validates the key design
- **Behavioral rules and state transitions** — grading schemes, state machines, domain invariants: things scattered across the code that only make sense gathered
- **Cross-system integration** — "completing a quiz triggers an SRS review" (domain-event level, not a call chain)
- **Fallback / degradation policy for external dependencies** — "on LLM failure return the last cached result; if none, degrade gracefully to empty"
- **Mermaid diagrams** — use freely for async flows, service integration, and event-driven processing. Prefer a diagram when it is clearer than prose. Inside diagrams, express domain behavior rather than function names
- **Consequences** — positive and negative effects, intended trade-offs, risks
- **Public interface compatibility policy** — only when consumers or a requirement depend on it. Internal methods, paths, and request/response shapes stay in OpenAPI and code

## Decision Drivers

Record only the pressures, constraints, and requirements that **actually discriminate** between options. Not mandatory in every ADR, but almost always needed for the alternatives comparison to read as more than taste.

- 3-5 is a useful default, not a validity threshold. Keep only facts that discriminate; fewer are valid when the decision is tightly constrained and says why
- Mix business and technical drivers — one kind alone makes the rationale look thin
- State facts and constraints. Opinions and preferences ("we like a modern stack") are not drivers
- They must discriminate — an item every option satisfies equally is not a driver, just a shared premise

| Bad                       | Good                                                     |
| ------------------------- | -------------------------------------------------------- |
| "It must be scalable"     | "10k concurrent users, p99 latency within 200ms"         |
| "It must be maintainable" | "The team knows only Go, no Rust experience"             |
| "Security matters"        | "PII must not leave for an external LLM (contract §4.2)" |

Note that every Good entry **keeps its numbers and constraints intact** — blur a driver's figures and it can no longer discriminate, so it stops being a driver. A target used as a driver ("p95 within 3s") is itself a requirement the result must honor, so do not blur it in the Decision body either.

Thin drivers make [alternatives](#alternatives--at-least-two) thin too — they come as a pair.

## Decision-changing assumptions — use the existing structure

An assumption is not a requirement and not an implementation default. It is a fact or expectation the alternatives comparison relies on: for example, an upstream provider guarantees idempotent requests, the organization cannot operate a second data store, or traffic is expected to remain inside one region.

Record an assumption only when changing it could change the adopted architecture. Put one short line in Context or the relevant Decision Driver:

`Assumption: <fact> — reconsider <decision or trade-off> if false`

Do not add a separate assumptions section, confidence taxonomy, evidence table, or placeholder row. The ADR already has Context and Decision Drivers for facts that shape the choice.

- A value or rule the result must honor goes in the requirement contract.
- An unresolved assumption that changes a contract or durable boundary is a question to resolve before approval.
- A library, SDK, adapter, pool size, timeout chosen only for implementation convenience, internal module shape, or other replaceable default stays in code. The implementation review may expose it in its ephemeral Notable implementation choices, but the ADR does not persist it.
- Omit assumptions when the choice does not depend on one. A short ADR is clearer than an empty taxonomy.

## Alternatives — realistic comparison, not a quota

An ADR should record realistic alternatives when they existed. Two or more usually make the trade-off clear, but a constrained decision may record one credible rejected alternative or explain why policy, regulation, or an external boundary left no other valid path. Never invent a strawman to satisfy a count.

- Write each alternative's pros and cons **against the [Decision Drivers](#decision-drivers)** — generalities unrelated to the drivers are meaningless
- **No strawmen** — do not pad the count with options nobody would take ("just hand-write everything"). Only options that genuinely reached the table
- Describe each alternative in one or two paragraphs at the architecture level — implementation detail like signatures or directory layout is caught by the [code-readthrough test](#the-requirement-gate-and-two-filters)
- Assess vertical-slice viability too — which option lets one feature be built and tested independently from UI → API → Data
- Never leave it as "no alternatives considered." If the user insists there are none, ask once whether this belongs in ALPS Section 7 or a docstring instead

Common failures:

- Only one option with no explanation of why the choice was constrained → fails review rule R14
- Two options that are "do this" and "do nothing" — not real alternatives
- Pros and cons that are generalities unrelated to the drivers ("there's a learning curve", "it's flexible")

## API section

Keep the endpoint list (Method, Path, description) — it is part of the architectural decision. Leave out full request/response JSON examples, header details, and error payloads (replace with a one- or two-sentence summary).

## DB schema and access patterns — one change unit

Key design (PK/SK/GSI) is core to the architectural decision, so it stays in the ADR. When an ADR adds a new entity or changes an existing key pattern, handle all of the following **as a single change unit**:

1. Write the key design and access-pattern table in the ADR body
2. Add or update that entity in `docs/tables/{table}.md` (field definitions, possible SK prefix patterns, examples)
3. Add a back-link to the new ADR in that file's **Related ADRs** section
4. Link the table document from the ADR's Related section

The work is done only when all three (ADR, table doc, bidirectional links) are updated. Updating one side alone accumulates inconsistency.

For projects without `docs/tables/`, substitute the equivalent schema document (`prisma/schema.prisma`, `db/schema.sql`, an OpenAPI spec) with bidirectional links — the point is that the source-of-truth document and the ADR always move together.

## One ADR = one decision

One ADR covers one logical decision. Mixing several into one file makes review, supersede, and roll-up all harder.

Split signals:

- The body exceeds 350 lines (Mermaid blocks and the alternatives table do not count — see length guidance below)
- Decisions about different entities or systems sit in one file
- Two or more clauses begin with "and additionally…"
- Status applies only partly (the core flow is implemented and should be Accepted, but some flow is unbuilt and stays Proposed)

Split when two or more of these hold (e.g. `0003-payment.md` → `0003-payment-checkout.md` + `0004-payment-refund.md`).

**Length guidance** — count the body excluding Mermaid blocks and the alternatives table, since this document actively encourages diagrams ([diagram selection](#diagram-selection)):

- **Standard 50-150 lines** — most ADRs land here.
- **< 30 lines** — a signal that motivation or alternatives are missing.
- **> 350 lines** — a split signal, but not sufficient alone; split when it appears together with the other signals above.

## Changing an ADR — edit-in-place vs supersede

Run the [decision identity check](#decision-identity-check--update-before-create) before this section. When it finds an existing owner, use the criterion below to choose **edit-in-place** over **a new superseding ADR**. It recurs often, so follow the checklist rather than deciding ad hoc. This section is the source of truth for that call; other skills and documents link here.

The criterion is **whether the decision can still be expressed as one current-state record**. A changed Context, Decision Driver, adopted alternative, or direction can still belong to the same logical decision. Most changes are **edit-in-place** — overwrite the body to the current state. **A new ADR (supersede) is the exception**, and among edit-in-place cases only major transitions also get one line in the [decision log](#decision-log-decision-logmd). Three branches:

**① Edit-in-place, no log (minor)** — the "why" is unchanged and only details shift:

- Context / Decision Drivers / adoption rationale are **unchanged**; only details are adjusted.
- Removing or correcting stale implementation facts — internal API paths, entity/field names, enum **identifiers and representation**, state-value **names**: things verifiable by reading the code that should normally leave the ADR instead of being mirrored there. **But a changed value set or transition rule is not ①** — if allowed states are added or removed, or a forbidden transition becomes allowed, the contract changed, so treat it as ② at minimum per [non-numeric requirements](#non-numeric-requirements--value-sets-mandatory-fields-permissions-ordering).
- **Fine-tuning** a gray-zone decision — refining boundary or exception wording while keeping the direction.
- Wording and structure cleanup.

> **A changed requirement value is not ①** — "20 turns → 30", "free 5 → 3" and the like change [the contract the result must honor](#concrete-numbers--keep-requirement-values-drop-tuning-values), so treat them as ② (one log line) at minimum. One value looks small, but regenerated code behaves differently. Tuning-value adjustments are not in the ADR to begin with, so they never enter this decision.

**② Edit-in-place + one decision-log line (major)** — the decision's direction holds (the topic can still be described as a single current-state record), but the "why/what" substantively changed in a way worth referencing later. Rewrite the body to the current state and log the transition:

- **Replacing the adopted alternative** (e.g. optimistic → pessimistic locking). The log preserves the old approach's rationale — do not keep the whole old ADR.
- **Inverted Decision Drivers** — a pressure or constraint that narrowed the decision changed (e.g. the "no PII leaves for an external LLM" constraint disappeared).
- **A core algorithm or architecture change**, or **a core bug fix that changes behavior**.
- **Changing an external provider or reverting to a previously used provider** while the ADR still owns the same integration boundary and can state one current choice.

**③ Supersede — create a new ADR and mark the old one `Status: Superseded by [ADR XXXX](link)`** — only when ② cannot hold it. Reserve it narrowly:

- **The decision topic itself forks** — one decision splits into two or more that live independently, requiring the old one to coexist as a **separately referenceable record.** (This is the case when the change also produces the [one ADR = one decision](#one-adr--one-decision) split signals.)
- That is, when the old and new ADR must **each be valid as "current state" simultaneously.** If one decision merely **replaces** another (the old is no longer valid), ②'s edit-in-place suffices — the log preserves the rationale.

**Single criterion**: if the decision is still **expressible as one current-state record** after the change, edit in place (① if minor, ② if major); if the old decision must **coexist as a separate record**, supersede (③). When unsure, **edit-in-place plus a log entry is the default** — it keeps the body at current state while the log preserves the rationale.

Choosing supersede means handling, **as one change unit**: the old ADR's Status transition, bidirectional Related links, the `.mapping.json` index (`adrs[]` path, status, summary), and repointing other ADRs that cited the old number (Related is an ADR↔ADR reference, which is fine). Save the new ADR as `Proposed`; `/adr-impl` promotes it to `Accepted` once implementation, tests, and the final implementation review pass. Supersede is also a major transition, so log one line.

**When the same decision evolves, edit-in-place plus a log is the default** — do not stack a new ADR per revision, and keep evolution narration ("added in v2", "changed from the previous approach") out of the body. This keeps a category's ADR count equal to the number of genuinely distinct decisions. If a legacy supersede chain has scattered one decision's history across several ADRs, `/adr-rollup` harvests that bundle's major history into `decision-log.md`, merges it into one current-state ADR, and deletes the rest (per bundle, not per category) — see `${CLAUDE_PLUGIN_ROOT}/skills/adr-rollup/SKILL.md`.

## Decision log (decision-log.md)

An ADR body is **a requirements and architecture document describing the current admitted decision and contract**, not the current shape of the code — no timeline narration ("it was X at first, then became Y") and no synchronized copy of implementation identifiers. But burying the rationale for major transitions in Git commits alone makes "why was this algorithm replaced?" hard to trace later. So **major decision changes only** go into a per-category `docs/adr/<category>/decision-log.md`, newest first, one line each. **ADR body = current admitted decision, log = timeline of major changes, Git = verbatim diff** — three layers preserving different things.

### What to log — minor vs major

Reached from ②/③ of [edit-in-place vs supersede](#changing-an-adr--edit-in-place-vs-supersede).

- **Log it (major)** — replacing the adopted alternative, inverted Decision Drivers, a core algorithm or architecture change, a core bug fix that changes behavior, supersede, **a requirement value change** (20 turns → 30 etc., since the contract the result must honor changed), and **a non-numeric requirement change** (allowed set added or removed, mandatory → optional, changed permission or visibility rules, a formerly forbidden transition becoming allowed — see [non-numeric requirements](#non-numeric-requirements--value-sets-mandatory-fields-permissions-ordering)). **Deprecating a decision with no replacement** is also a major entry.
- **Do not log it (minor)** — removing/correcting implementation facts (internal API paths, enum identifiers, field names, Status), refining boundary wording, rewording. Logging these fills the log with noise and drowns the signal; Git preserves them. (Tuning-value adjustments are not in the ADR, so they never qualify.) **An enum's _name_ changing is minor, but its _allowed set_ changing is major** — see above.
- Add the entry **at the moment the decision changes** — separate from the automatic `Accepted`/`Proposed` Status transition. The log records the _decision_; Status records the _implementation fact_.

### Location and nature

- One `decision-log.md` per category (feature leaf or flat context), alongside the ADR files in `docs/adr/<category>/`.
- **It is a convention file, not an ADR, and is not registered in `.mapping.json`.** The deterministic harness (`adr-structure-lint`) does not enumerate it as an ADR because it does not start with `NNNN-`, so it is exempt from per-ADR checks, index consistency, and orphan detection. **One exception — links**: the harness does verify that the log's ADR pointer resolves on disk (`decision-log-link-broken`). A rollup renumber moves that ADR, and if the pointer is not fixed the log points at a vanished path that no other check would catch.
- The log holds **only links pointing to current ADRs** and never references code or the PRD — log → ADR, one way. An ADR body (Related included) does not link back to the log.
- **Format lives in the seed file [`decision-log.template.md`](./decision-log.template.md)** (copied alongside into `docs/adr/`). On a category's first major transition, copy it to `docs/adr/<category>/decision-log.md` and fill in `<category>` and the entry — do not rewrite the format from memory. The `current ADR` pointer is the **only** ADR reference and always points at the live path; keeping old numbers out of the prose means a later `/adr-rollup` renumber requires fixing only that one line, and the rollup's stale-citation finder will not flag the log.

## Final-state wording — record the result, not the transition

When an ADR is created or edited, write the currently valid result as a direct assertion. Do not make the reader reconstruct it from the replaced name, the migration step, or a contrast with the previous choice.

| Transition narration                                                           | Final-state assertion                 |
| ------------------------------------------------------------------------------ | ------------------------------------- |
| "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다." | "이벤트 이름은 `CURRENT_EVENT`다."    |
| "타임아웃을 10초에서 30초로 변경한다."                                         | "타임아웃은 30초다."                  |
| "The service uses the primary queue rather than the legacy queue."             | "The service uses the primary queue." |

Apply this rewrite to the current-state parts of Context, Decision, the requirement contract, Consequences, diagrams, and the matching `.mapping.json` summary:

1. Identify the actor or subject and the currently valid behavior, value, state, or identifier.
2. State that result directly in the present tense.
3. Remove replaced identifiers, previous values, migration steps, and contrast carriers such as "instead of", "rather than", "no longer", "without mixing", "기존 ~ 대신", and "~와 혼용하지 않고" when they add no current contract.
4. Keep the selection rationale in Decision Drivers and Alternatives. Put a major old → new transition in `decision-log.md`.

This is not a blanket ban on negative sentences. A prohibition that the current system must still enforce is a requirement and survives the rewrite: "PII never leaves the region" and "a cancelled order never moves to shipping" state present contracts. Apply the [requirement gate](#the-requirement-gate-and-two-filters) before deleting any negative wording. The test is whether the earlier term or comparison changes what rebuilt code must honor today; if not, it is history or drafting residue, not ADR content.

## Prose style — say it in the fewest words, in the active voice

An ADR is read under time pressure, by someone deciding whether to trust it. Padding costs the reader attention they would otherwise spend on the decision, and the passive voice hides **who acts**, which is exactly what a decision record exists to state. These rules are about how a sentence is written; they never license dropping content — [requirements](#requirements--what-the-result-must-honor) survive regardless of length.

- **Active voice by default.** "The gateway rejects a duplicate payment", not "duplicate payments are rejected." The passive drops the actor, and in a decision record the actor is often the point — who validates, who retries, who owns the state. Keep the passive only where the actor is genuinely unknown, irrelevant, or is the system as a whole ("the token is rotated every 7 days" is fine when nothing turns on which component rotates it).
- **Cut the words that carry no information.** Hedges ("basically", "essentially", "it is worth noting that"), throat-clearing openers ("In order to achieve this, we decided that we would"), and doubled phrasing ("각각의 개별", "future roadmap ahead"). "In order to" → "to". "Has the ability to" → "can". "At this point in time" → "now".
- **One idea per sentence.** A sentence with three clauses chained by "and" is three sentences. This is what makes an ADR skimmable — a reader scanning for the decision should not have to parse a subordinate clause to find it.
- **Prefer the concrete noun to the abstract one.** "The retry budget" beats "the relevant mechanism"; "the checkout handler" beats "the appropriate component." Vague nouns are where a decision quietly stops being verifiable.
- **State the decision, do not narrate the deciding or the transition.** "Payments use an idempotency key" — not "we discussed several options and eventually concluded that…" and not "payments no longer use the previous key strategy." The rationale belongs in Decision Drivers and Alternatives; major transition history belongs in `decision-log.md`.
- **Never trade completeness for brevity.** Deleting a requirement value, a permission rule, or a fallback policy to shorten a paragraph is a defect, not a style improvement. Compress the wording; keep the content. Prose padding is noise, but a missing contract is a wrong product.

The test: **if a sentence can lose a word without losing meaning, it should.** But if losing the word loses a constraint, it was not padding.

## Diagram selection

| Diagram           | When to use                                                                  |
| ----------------- | ---------------------------------------------------------------------------- |
| `sequenceDiagram` | Async flows, inter-service calls, event-driven processing                    |
| `stateDiagram-v2` | State transitions are core to the decision (order state machine, lifecycles) |
| `flowchart`       | Conditional branching, decision trees, routing rules                         |
| `erDiagram`       | Only when new entity relationships are core and cannot go to `docs/tables/`  |

Prefer a diagram whenever it is clearer than prose.

## Conventions

- **Write ADR bodies in the language the user writes in** — this rules file and every harness prompt are English, but the ADRs they govern follow the user. Keep technical terms, code identifiers, and proper nouns in their original form.
- **Filenames**: `XXXX-kebab-case-title.md`. **Never put a PRD Feature ID (`F1` etc.) in a filename or folder name** — Feature IDs are stored nowhere, category keys are always derived from the canonical name, and `/adr-impl` resolves targets by category key alone (`f1` exists only as an ordinary literal key when it was a fallback).
- **Numbering** increases sequentially within a category. Numbers vacated by a split stay as gaps (no renumbering). **Rollup is the sole exception** — a category where a chain was merged and ADRs deleted gets its gaps closed in `adr-rollup`'s final step (rollup leaves no trace). Split and sync never renumber.
- Titles: clear and concise.
- **Folder names = ubiquitous language**: top-level context folders take the domain expert's model vocabulary (`identity/`, `ordering/`); feature sub-folders take user-action vocabulary (`login/`, `checkout/`). The two layers may differ. At either layer, technical layer names (`api`, `db`, `services`) are banned (`structure.md` "Anti-pattern categories"). Key derivation and fallback rules: `structure.md` "The ADR registry (.mapping.json)".
- **Clean up progressively** — when an existing ADR violates these rules, fix it as that ADR is next updated. There is no need to sweep every ADR at once.

## ADR review checklist

For the PR reviewer or the author before merge.

- [ ] **Status is a valid value** (`Proposed`/`Accepted`/`Deprecated`/`Superseded by [...]`)
- [ ] **The one-line decision summary** is updated in the matching `.mapping.json` `adrs[]` record
- [ ] **Regeneration test** — imagining all code deleted and only this ADR left, could requirement-honoring code be rebuilt? Is any contract missing (limits, cycles, permissions, required validation, state transitions)?
- [ ] **Reviewable contract rows** — each requirement row states one obligation, so implementation review can assign it one coverage status without hiding partial completion
- [ ] **Observable evidence** — each obligation has an implementation-independent result that distinguishes compliance from violation; no test file, command, library, function, class, fixture, or internal representation is pinned
- [ ] **Requirement values appear verbatim** — numbers the result must honor (max turns, count limits, retention, size caps, NFR targets) are not blurred into "appropriately" or "is limited". Does each carry a scrap of justification (policy, contract, regulation)?
- [ ] **Non-numeric requirements survived too** — allowed value sets, mandatory fields, permission and visibility rules, ordering and uniqueness, units and formats, forbidden transitions were not dropped as "obvious from the code" ([non-numeric requirements](#non-numeric-requirements--value-sets-mandatory-fields-permissions-ordering))
- [ ] **Decision-changing assumptions are explicit and correctly routed** — every assumption that could change the adopted alternative appears in Context or the relevant Driver with what must be reconsidered if false; requirements remain in the contract, implementation defaults remain in code
- [ ] **No unresolved material assumption is hidden** — an assumption affecting the requirement contract or durable architecture boundary was resolved before approval, or remains an explicit blocking question
- [ ] **No tuning values** — values a developer may change without violating a requirement (pool sizes, backoff, cache TTL, worker counts) are absent
- [ ] **Code-readthrough test** — for every paragraph, asking "is this obvious from reading the code this ADR governs?", nothing obvious remains (the code is the source of truth for those). Items that passed the requirement gate stay even when obvious
- [ ] **Final-state wording** — the body and `.mapping.json` summary state the current result directly. No evolution narration ("originally it was", "added in v2", "changed from before") or comparison residue ("not X but Y", "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만") remains outside Alternatives or [`decision-log.md`](#decision-log-decision-logmd). Current prohibitions and forbidden transitions that passed the requirement gate remain intact
- [ ] **Prose style** — active voice by default (the actor is named where it matters), no hedges or throat-clearing, one idea per sentence, concrete nouns over vague ones ([Prose style](#prose-style--say-it-in-the-fewest-words-in-the-active-voice)). Tightening wording must never have dropped a requirement
- [ ] **Gray-zone check** — the body actually contains **at least one** of: (a) adoption rationale / alternatives, (b) business rules translated into system behavior, (c) domain rules and state transitions, (d) external-dependency fallback (without these the ADR has little value)
- [ ] **ADR admission gate** — the core decision changes a requirement contract, durable system/security boundary, external provider/model/fallback, data/key design, or cross-implementation trade-off. A replaceable library, SDK, framework, credential/auth adapter, or module structure is not the ADR's subject
- [ ] **Decision identity check** — before adding a new ADR, existing mapping summaries and plausible ADR bodies were checked for the same architectural question and owned boundary. A provider/alternative change or reversal that remains one current-state decision updates the existing ADR
- [ ] **No code references below folder level** anywhere in prose, tables, or diagrams
- [ ] **No back-references from code** — the code this ADR governs (comments, constants, imports) carries no ADR ID or path. If the code exists, check via adr-reviewer R17 or `/adr-sync` step 5(a) grep; for a new `Proposed` with no code yet, `/adr-sync` checks after implementation
- [ ] **No forbidden items** (code snippets, tuning values, call graphs, field-type tables, env var names, pseudocode, full JSON, migration commands) — requirement values and business limits are _not_ forbidden items
- [ ] **Decision Drivers** are discriminating facts or constraints; 3-5 is a default, not a quota
- [ ] **At least two alternatives**, each with pros and cons weighed against the Decision Drivers (no strawmen)
- [ ] **A grounded Mermaid diagram** is not missing where a flow, state, boundary, or alternative relationship is clearer visually, and no diagram copies a code call graph or invents a relationship
- [ ] **If a DB key pattern changed**, `docs/tables/{name}.md` (or the equivalent) exists with bidirectional links
- [ ] **No PRD back-references** — no ALPS path, section number, or feature ID in the body (Context and Related included)
- [ ] **Related** dependency ADR links (if any) resolve — ADR ↔ ADR references are fine; PRD links are not
- [ ] **One ADR = one decision** holds (no split signals)
- [ ] **`.mapping.json`** has the matching category entry including the new ADR

<!-- adr-writer:rules-version 0.8.15 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
