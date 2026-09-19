---
name: adr-sync
description: Verify that ADRs in docs/adr/ accurately describe the repository implementation and fix any drift. Uses the ADR index at docs/adr/.mapping.json (categories → adrs with path/status/summary + dependsOn; no code paths and no PRD reference — the implementation an ADR governs is found by reading the ADR and searching the repo). Use when the user invokes /adr-sync or asks to audit ADRs against shipping code or IaC. Keywords - "/adr-sync", "ADR sync", "ADR drift check", "ADR 동기화", "ADR drift 검사".
argument-hint: "[category?] [--quick]"
---

# adr-sync

> **Reports**: Before human-facing reports, apply [report-write](../report-write/SKILL.md).

Verify that every ADR in `docs/adr/` matches the repository implementation, including IaC and repository-local configuration. Fix drifted ADRs, resolve contradictions between related ADRs, and synchronize the `.mapping.json` index (the adrs[] path/status/summary).

Alongside verification and correction, **refine each ADR into one self-contained document describing the current admitted decision and requirement contract.** Reconstruct the evolution narration that accumulated mid-body over time ("originally it was X, then changed to Y", "added Z in v2", "changed to B compared with the previous A") into a single current-state description, so reading one ADR conveys its durable decision without code-level implementation facts. Of what you strip out, **harvest major transitions** into the category's `decision-log.md` (Pass 2's step 3-E); **minor** evolutions and individual diffs are preserved by Git, so the ADR body carries no evolution history. (This is cleanup within a single ADR — merging an evolution _chain_ spread across several ADRs into one is `adr-rollup`'s job.)

The default is **deep mode**: read every ADR body in scope and compare every claim (APIs, error codes, enums, entity fields, IaC, Status, Related links) against repository evidence. With `--quick`, check only the adrs[] summary in `.mapping.json` (the one-line Key Decision).

## Modes

| Flag      | Mode  | When to use                                                          |
| --------- | ----- | -------------------------------------------------------------------- |
| (default) | Deep  | Periodic audits, after a large refactor, onboarding cleanup          |
| `--quick` | Quick | Regression check after a small code change, token-budget constraints |

If the argument is a category, target only that category (`/adr-sync auth`).

> **If the question is only about how the ADRs are written, use `/adr-review` instead.** This command's job is ADR ↔ code consistency, so it greps the codebase for every ADR — expensive, and pointless when the code does not exist yet. `/adr-review` sweeps the same ADRs against the authoring rules (R1-R20: abstraction level, requirement preservation, alternatives, prose style) without opening the code, and reports rather than edits.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Workflow

### 1. Load the index and mapping

- Read `concepts.md` (the abstraction ladder, the gray zone, the dependency model, Status and its automatic transitions), `docs/adr/README.md` (the index and the ADR template), `docs/adr/authoring-rules.md` (authoring rules and the review checklist), and `docs/adr/structure.md` (directory and mapping policy). In a repo seeded before the README/concepts split, all of the concepts material sits inside `README.md` — read it there instead
- Read `docs/adr/.mapping.json` (the single ADR index — categories → adrs[] with path, status, summary, plus `dependsOn`). The mapping stores neither ADR↔code paths nor a PRD reference — locate the code an ADR governs by **reading the ADR's Decision body and searching the repo each time** (see "Finding the related code" below).
- Enumerate every ADR file on disk: **only `NNNN-*.md` (ADR files that start with a number)** under `docs/adr/<category>/`. An ADR file on disk that is absent from `.mapping.json`'s adrs[], or an adrs[] path pointing at a file that does not exist, is itself drift (two-way disk↔mapping consistency). **`decision-log.md` is a convention file, not an ADR, so exclude it from this enumeration** — it is not registered in the mapping (`structure.md` "Decision log") and must never be reported as orphan drift. (The deterministic harness likewise does not enumerate this file as an ADR, since it does not start with `NNNN-`.)

#### Finding the related code

Verifying an ADR and judging its Status requires looking at the repository implementation it governs. Code evidence includes source, tests, IaC, deployment manifests, and repository-local configuration. Since the mapping holds no code paths, narrow the scope for each ADR with the three steps in `structure.md` "Finding the related code" (extract domain keywords from the Decision/Mermaid/title → narrow with `Glob`/`Grep` → cross-check against the ADR's Decision). **Reuse a scope once found for the duration of this sync run** (Pass 1 → Pass 2); never persist it in the mapping.

#### Evidence boundary — repository and local execution only

`/adr-sync` verifies the repository implementation, **not deployed runtime state**. Never access live infrastructure, provider APIs or consoles, remote state, clusters, databases, SaaS administration, or deployment platforms — including read-only calls and even when credentials already exist. Do not log in, discover credentials, refresh remote state, deploy, or apply changes. Run a local command only when it is known not to authenticate or contact a remote service.

When an ADR or scope involves infrastructure, deployment, cloud, clusters, remote services, or IaC, read `references/local-evidence-boundary.md` completely before verification. If a claim can only be established from a live environment, report `[Runtime state unverified]`; do not classify it as ADR drift, claim `In Sync` for the deployed environment, or use it to change Status. Route live-state assurance to a separate explicitly authorized operational audit.

#### When the mapping file is absent

If `docs/adr/.mapping.json` does not exist yet or is empty, infer category candidates from the `docs/adr/<category>/` directory names on disk and proceed. Narrow the per-category code scope with "Finding the related code" above, once per ADR — never ask the user for a code glob just to create a mapping.

### 2. Pass 1 — quick drift detection (the quick-mode entry point)

For each ADR, extract the adrs[] summary from `.mapping.json` (the one-line Key Decision) and grep the scope narrowed by "Finding the related code". Mark the repository result **In Sync**, **Drift Suspected**, or **Unverified**. `In Sync` means ADR ↔ repository implementation only.

Quick mode performs only this step plus the index-based **detection and proposal** of stale `fN` naming in 3.7 (detecting stale `fN` naming from the adrs[] paths in `.mapping.json`) — it skips the remaining 3.x deep checks and any actual file moves.

If those paths reveal stale `fN` naming, read `references/repository-hygiene.md` completely and apply only its "Canonical stale Feature-ID naming" detection and proposal rules. Do not read that reference or perform repository-hygiene checks when no candidate exists.

### 3. Pass 2 — deep verification (always run in deep mode)

Before starting Pass 2, read `references/repository-hygiene.md` completely and read `references/reconciliation-boundary.md` completely. They own repository hygiene and ADR ↔ repository authority respectively. Apply their checks after the per-ADR semantic verification below and before the report.

**Secure structure and consistency with the deterministic harness first** — filter out the mechanical rules before the LLM spends tokens on filenames, the Status enum, or index consistency:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs [category]   # all categories when the argument is omitted
```

This harness parses each ADR body plus `.mapping.json` plus the disk state and mechanically verifies: the Status enum and date format (the first half of R1), presence of required sections, canonical filenames and stale `fN-` prefixes, path depth ≤ 2, anti-pattern category segments (the first half of R5), the Decision Drivers and alternatives counts (R13/R14), Related links resolving (R10), `dependsOn` integrity (R16), mapping↔disk consistency plus the adrs record shape (path/status/summary) and status↔body agreement (R8 / status-index-mismatch), whether a value is written in code-constant form (R18's format half — the `value-as-constant` warning), and — internally, via `adr-invariants.sh` — code→ADR and ADR→PRD back-references (R15/R17). Correct any `error` the harness caught in the corresponding Pass 2 step below (filename and mapping hygiene in step 6, Status format under 2-Status below, back-reference removal in step 5) and record it under **Fixed** in the step 7 report. The **semantic judgments** the harness cannot see (Status drift judged from what exists in code, gray-zone decision ↔ code contradictions, evolution-narration cleanup, **missing or drifted requirement values**) are carried out by the deep steps below — the harness looks at format and consistency, while the body of sync looks at decision drift. **The harness never flags a bare number** (the risk of pushing someone to delete a requirement value is too high) — which values must stay is entirely the judgment steps' job.

For each target ADR:

1. Read the entire ADR body.
   - **Apply the ADR admission gate to the core subject before comparing details.** If the ADR is fundamentally about a replaceable library, SDK, framework, middleware, module layout, credential provider chain, signer, or authentication adapter and no requirement or architecture/security boundary depends on that exact choice, do not synchronize the detail toward the code. Record `[Retire low-level ADR]` and propose moving useful guidance to code/project docs. Code changes to that implementation means are not ADR drift.
2. Extract the verifiable claims:
   - **Status** — grep the scope narrowed by "Finding the related code" to confirm what exists in repository source, IaC, configuration, and tests. Auto-correct an invalid completion claim (`Accepted` but absent from repository implementation or tests → `Proposed`). Deployment presence and live runtime state are not Status prerequisites. Do **not** promote `Proposed` merely because code and tests exist: `Accepted` also requires `/adr-impl-review` to pass, and review evidence is not persisted in the ADR or mapping. Record that case under **Suggestions** and route it to `/adr-impl <category>` to run the completion gate. For the status semantics and the automatic transition policy see `concepts.md` "Automatic transition rules". **Every Status correction must use the deterministic transition script with the exact target ADR path**:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs <target-adr-path> Proposed
     ```

     Do not edit the body Status or a `.mapping.json` status manually with `apply_patch`, regex replacement, or a search for the first matching value. The script updates the exact matching `adrs[]` record and body in lockstep, and refuses an absent, duplicated, or already inconsistent path. Add `--summary "<current one-line decision summary>"` only when the ADR decision changed and the index summary must change with it. Record the correction under **Fixed** in the step 7 report.

   - **API endpoints** — the method + path table. Grep routers and handlers.
   - **Error codes** — grep the constants.
   - **Enum / type values** — grep `oneof=...`, validate tags, TS unions.
   - **Entity field names** — grep DB tags (`dynamodbav`, ORM annotations).
   - **GSI / sparse index key patterns** — grep schema or IaC definitions, partition names, and sort-key prefixes.
   - **Infrastructure topology and policy** — inspect IaC, deployment manifests, local configuration, and policy tests; never query the deployed resource.
   - **UI labels and constants** — grep user-facing strings.
   - **Repository companion-document pointers** — whether a repository-local path such as "see `docs/tables/auth.md` for the schema" still exists and agrees with that file itself.
   - **Related ADR links** — whether they exist and their Status is consistent.

3. Identify implementation-detail bloat — **apply the requirement gate first** (`authoring-rules.md` "The requirement gate and two filters"), set aside everything that passes the gate as not-for-removal, then sweep the body with the two criteria below:
   - **The requirement gate (the do-not-remove line)**: "if this fact were missing, could code rebuilt from the ADR alone violate a requirement?" YES means **keep it** even when it looks obvious in the code — requirement values (limits, cycles, retention, caps, targets), and **non-numeric requirements** (allowed value sets, transition rules, mandatory fields, permissions, visibility, ordering, uniqueness, units — `authoring-rules.md` "Non-numeric requirements"), required validation conditions, and behavior guaranteed on failure. If sync strips requirements in the name of removing bloat, the ADR becomes a formally tidy but empty document and the next implementation loses that contract.
   - **The code-readthrough test** (`concepts.md` "What an ADR covers — the gray zone between business and code"): is a paragraph that failed the gate obvious from reading the related code? If it is, take it out of the ADR (function responsibilities, module dependency graphs, field-type tables, error message wording and UI labels, env var names, pseudocode, and the like).
   - **The forbidden-items table** (`authoring-rules.md` "What to exclude from an ADR" — read the "exception when it is a requirement" column alongside it): file paths (below folder level), code snippets, **implementation tuning values** (connection pools, backoff, cache TTL, worker counts — values a developer may change without violating a requirement), detailed entity field tables, migration commands, full JSON.
   - **Look for omissions at the same time** — if the code clearly holds a requirement contract (e.g. a session turn cap, a per-plan usage quota) that the ADR body lacks, ask the user whether it is a requirement or an implementation tuning value, and if it is a requirement add it to the ADR with its value and basis. This is the opposite direction from removing bloat; record it in `Suggestions` as `[Missing requirement] <what>`. **But never conclude a value in code is a requirement and quietly copy it over** — the code does not tell you whether a value is a contract or a coincidence, so always confirm with the user.
     3-E. **Final-state reconstruction — keep the result, remove the transition.** When the body or mapping summary contains evolution narration, replaced identifiers or values, migration steps, comparison carriers, embedded history, or duplicated decision descriptions, read `references/current-state-reconstruction.md` completely and apply it. Keep `Final-state reconstruction` current-state-only, preserve genuine prohibitions and the complete requirement contract, and harvest major transitions to `decision-log.md`.
4. Check ADR admission and gray-zone substance — if the core subject fails the admission gate, record `[Retire low-level ADR]` rather than strengthening it. If it passes but the body contains none of (a) alternatives comparison / adoption rationale (b) business rules translated into system behavior (c) domain rules and state transitions (d) external-dependency fallback, record in `Suggestions` as "strengthen the gray zone or consider retiring the ADR".
   4-b. **The regeneration test** (`authoring-rules.md` "What an ADR must satisfy") — ask "if all the code in this category were deleted and only this ADR survived, could requirement-honoring code be rebuilt from it alone?" Differences in implementation, structure, and naming are normal, so ignore them and look **only for missing result contracts** — requirement values, **allowed value sets, transition rules, mandatory fields, ordering, uniqueness, units** (`authoring-rules.md` "Non-numeric requirements"), permission and visibility rules, required validation conditions, state transitions and invariants, and the behavior guaranteed to the user on failure. When you spot an omission, record it in `Suggestions` as `[Missing requirement] <what is missing — which code behavior is the basis>` and confirm with the user to fill it in. This check is the counterpart to the bloat removal in step 3 — sync is not a command that only takes away, it is a command that **keeps the contract whole**.
5. Check Decision Drivers and alternatives ≥ 2 (`authoring-rules.md` "Decision Drivers" / "Alternatives — at least two"):
   - If the Decision Drivers are thin (0-2) or consist entirely of generic quality attributes ("maintainability", "scalability") → record in `Suggestions` as "strengthen the Drivers into discriminating facts and constraints"
   - If there is only one alternative, or they are strawmen → record in `Suggestions` as "add realistic alternatives or consider retiring the ADR" (an already-`Accepted` ADR is the common omission case — record the options that were on the table at the time, even retrospectively)
6. Reconcile the ADR and code according to ownership — but **what follows the code is decided by "Scope of the source of truth" below.** Status follows verified implementation. Non-requirement implementation facts generally leave the ADR instead of being synchronized detail-for-detail. Only an admitted public contract or architecture-level fact may be corrected in place. When a gray-zone decision contradicts the code, do not match the ADR to the code but treat it as a decision violation. Update the corresponding adrs[] summary (the one-line Key Decision) in `.mapping.json` as a final-state assertion too; never leave the old identifier or transition wording in the summary after cleaning the body.

**Caution**: never add new implementation detail to an ADR. An ADR covers only the gray zone between business and code (the rationale for the decision, domain rules, trade-offs) and **the requirement contract the result must honor** — facts discoverable by reading the code that are also not requirements go to the code and its docstrings. Conversely, **a requirement contract missing from the ADR is an omission to be added**, so handle it through step 3's `[Missing requirement]` branch (after user confirmation).

#### Scope of the source of truth — what follows repository evidence and what follows the ADR

Apply `references/reconciliation-boundary.md`; it is the full authority for this branch.

- Status and non-requirement implementation facts follow repository evidence, and stale low-level facts usually leave the ADR.
- Requirement values and **Non-numeric requirements (the ADR is authoritative)** never follow code silently. In particular, allowed states being added or removed, or a formerly forbidden transition becoming allowed, is a contract change.
- Gray-zone decisions remain ADR-authoritative. On contradiction ask the user to rule **An intended decision change** versus implementation violation, and use `decision-log.md` for a major transition.
- Repository behavior that looks like an omitted contract is `[Missing requirement]`, not proof that the ADR should copy it.
- Infrastructure repository evidence follows the local-only boundary; deployed state remains unverified.

### 7. Report

Before writing the human-facing report or chat summary, read
`${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` completely and apply
it.

```
## ADR Sync Results (mode: deep|quick)

### At a glance
- Verdict: <what is aligned, changed, or unresolved>
- Impact: <what a developer or operator can observe>
- Action: <the next required action, or "None">
- Risk: <what remains unverified or contradictory, or "None">

### Scope
- Categories: <list or "all">
- ADRs inspected: <n>

### Evidence boundary
- Repository evidence inspected: <source/IaC/config/tests/local-only outputs>
- Live environment access: Not performed — outside adr-sync scope
- Runtime-only claims: <none | [Runtime state unverified] ...>

### Visual map
<the smallest grounded Mermaid required by the shared report guide, or omit this section>
Notice: <the decision, dependency, or unresolved branch the reader should verify>

### Fixed
- [ADR <category>/NNNN: semantic diff]
  - Decision: <Changed: old meaning → current meaning | Unchanged | Unverified>
  - Requirement contract: <Changed: exact values/rules | Unchanged | Unverified>
  - Decision Drivers: <Changed: old pressure → current pressure | Unchanged | Unverified>
  - Consequences: <Changed: old risk/trade-off → current risk/trade-off | Unchanged | Unverified>
- [ADR <category>/NNNN: document cleanup] — removed evolution narration / rewrote in present tense: <what, and how>. Gray-zone decisions preserved: <rationale, alternatives>. (only for the ADRs affected)
- [decision-log <category>] — major transitions harvested: <what>. (only when major narration was moved into the log)

### Contradictions Resolved
- [ADR A ↔ ADR B] — what conflicted and how it was reconciled

### In Sync
- [ADR ...], ...

### Index Hygiene
- .mapping.json changes (path/status/summary)
- decision-log: <lightweight verification result — newest-first order, current-ADR links valid, no PRD citations or old numbers; corrections applied>

### Suggestions
- [New ADR needed?] — an unrecorded decision that passes the ADR admission gate
- [Retire low-level ADR] — <category>: the core subject is a replaceable implementation means. Move useful guidance to code/project docs; do not synchronize it as an architectural decision
- [Supersede recommended?] — only when the decision topic has branched and the old decision must coexist as a separate record (i.e. when edit-in-place + decision-log cannot hold it — `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"). A plain decision switch is absorbed by edit-in-place + decision-log, not a supersede
- [Sub-folder split recommended] — <category>: <n> ADRs, candidate sub-features ...
- [Feature-ID naming] — <category>: old fN naming, canonicalization deferred (when the user declined)
- [Runtime state unverified] — <claim>: repository evidence was inspected, but deployed state would require live access outside adr-sync
- [Missing requirement] — <category>: a contract the code honors (<what>) is absent from the ADR. If it is a requirement, add it with its value and basis (user confirmation required)
- [Requirement value drift] — <category>: ADR "<value/set/rule>" ↔ code "<value/set/rule>". Needs a ruling on whether it was an intended change or a violation (this bucket covers not only numbers but also mismatched allowed value sets, mandatory fields, permissions, and transition rules)
```

In chat, lead with At a glance, then show each changed ADR's `Decision` and
`Requirement contract` semantic diff. Keep file locations, code evidence, and
harness detail in the full report unless they explain an unresolved
contradiction. `Unchanged` means that axis was inspected and still matches.
`Unverified` means the available evidence could not establish it and must never
be rendered as `Unchanged`.

## Notes

- An ADR records **why this decision was made.** A small bug fix or style change is not a reason to update an ADR.
- Numbers increase sequentially within a category. A number vacated by a split stays as a gap (never renumber). Sync does not rearrange numbers — closing gaps (renumbering) is a step performed only by `adr-rollup` when it merges a chain and deletes ADRs. **The canonicalization in 3.7 is not a renumber** — removing an `fN-` filename prefix and re-keying a folder leave the number (`NNNN`) untouched, so they do not conflict with the renumber ban above.
- The Feature-ID naming canonicalization in 3.7 only detects and proposes even under `--quick` (the adrs[] paths in `.mapping.json` alone reveal stale naming) — in both modes the actual move happens only after user confirmation.
- Apply the **ADR admission gate before suggesting `[New ADR needed?]`**. A library, SDK, framework, credential/auth adapter, or module-structure choice that preserves the same contracts and boundaries is ordinary implementation discretion, not missing architecture.
- `/adr-sync` never expands into a live infrastructure audit. IaC and repository-local configuration are code evidence; cloud APIs, consoles, clusters, remote state, databases, and SaaS administration are outside scope even when access is read-only.
- After admission, apply the **decision identity check before suggesting a new ADR**. Search the mapping summaries and plausible ADR bodies for the same architectural question and owned boundary. If one current-state record can hold the intended result, route the change to that existing ADR; provider/alternative changes and reversals are edit-in-place, not new identities. Suggest a new ADR only when no owner exists or the topic truly forks.
- What the code is the source of truth for is **limited to Status and code-level facts** — code-level facts are usually removed from the ADR rather than mirrored there. By contrast, **admitted gray-zone decisions (adoption rationale, domain rules, state transitions, fallback) and requirements (whether numeric, a value set, a mandatory field, or a permission) are the ADR's authority.** Enums split — **names and representation belong to the code, the allowed set and transition rules to the ADR.** When the code contradicts such a decision, do not overwrite the ADR to match it; branch into "decision change vs violation" (see "Scope of the source of truth" under step 3 item 6 above).
