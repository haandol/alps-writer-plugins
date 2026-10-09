---
name: adr-sync
description: Verify that ADRs in docs/adr/ accurately describe the repository implementation and fix any drift. Uses the ADR index at docs/adr/.mapping.json (categories → adrs with path/status/summary + dependsOn; no code paths and no PRD reference — the implementation an ADR governs is found by reading the ADR and searching the repo). Use when the user invokes /adr-sync or asks to audit ADRs against shipping code or IaC. Keywords - "/adr-sync", "ADR sync", "ADR drift check", "ADR 동기화", "ADR drift 검사".
argument-hint: "[category?] [--quick]"
---

# adr-sync

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

Read `docs/adr/glossary.md` only when the selected ADRs need a term definition.
Its absence is normal; preserve it as supporting material, not an indexed ADR.
When this workflow permits ADR writing and a definition needs creation or change,
apply `${CLAUDE_PLUGIN_ROOT}/references/glossary.md` under the existing approval
boundary. Review-only work reports unclear or conflicting meanings without editing.

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

## Questions and continuation

When intent, conflicts or concrete change approval remain unresolved, read
`${CLAUDE_PLUGIN_ROOT}/references/decision-questions.md`. Prepare independent
work first, collect questions by feature in one report, and reuse already
confirmed answers. All instructions below to ask or confirm use that batch;
they do not require interrupting once per ADR. After answers, apply the
confirmed scope and continue validation automatically. Preserve the caller's
read-only/quick modes and destructive approval boundaries.

## Workflow

### 1. Load the index and mapping

Use the repository's rule documents when present; otherwise use the matching
`${CLAUDE_PLUGIN_ROOT}/templates/adr/` files. Reuse unchanged sections already
loaded in this context. Load conditional references only on their active path.

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

Quick mode performs only this step plus the index-based **detection and proposal** of stale `fN` naming from the adrs[] paths in `.mapping.json`; it skips Pass 2 and any actual file moves.

If those paths reveal stale `fN` naming, read `references/repository-hygiene.md` completely and apply only its "Canonical stale Feature-ID naming" detection and proposal rules. Do not read that reference or perform repository-hygiene checks when no candidate exists.

### 3. Pass 2 — deep verification (deep mode only)

Read [deep verification](references/deep-verification.md) only for deep mode.
It owns structural checks, per-ADR claim comparison, the requirement gate,
current-state reconstruction, rationale preservation and reconciliation.
Apply the ADR admission gate and regeneration test. Requirement values and
non-numeric requirements remain ADR-authoritative; code presence alone never
promotes `Proposed`. Only repository-local evidence is allowed. Unknown intent
and contract changes remain in the consolidated question report; quick mode
skips this module and all actual moves.

### 7. Report and resume

Apply `${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` and
`references/report.md` for the complete result fields and evidence boundary.
Lead with At a glance, then the semantic diff of each changed Decision and Requirement contract.
New ADR needed findings must pass the ADR admission gate.
`Unchanged` means that axis was inspected and still matches.
`Unverified` means the available evidence could not establish it. When user input is needed, follow
`references/decision-questions.md` from the plugin root: present one report,
apply confirmed answers, then continue rather than ending at the question list.

## Notes

- An ADR records **why this decision was made.** A small bug fix or style change is not a reason to update an ADR.
- Numbers increase sequentially within a category. A number vacated by a split stays as a gap (never renumber). Sync does not rearrange numbers — closing gaps is exclusive to `adr-rollup`. The "Canonical stale Feature-ID naming" path in `references/repository-hygiene.md` removes an `fN-` prefix or re-keys a folder while preserving `NNNN`; it is not a renumber.
- Feature-ID naming detection may run under `--quick` from the mapping paths alone. Quick mode only detects and proposes; in either mode, an actual move requires user confirmation under `references/repository-hygiene.md`.
- Apply the **ADR admission gate before suggesting `[New ADR needed?]`**. A library, SDK, framework, credential/auth adapter, or module-structure choice that preserves the same contracts and boundaries is ordinary implementation discretion, not missing architecture.
- `/adr-sync` never expands into a live infrastructure audit. IaC and repository-local configuration are code evidence; cloud APIs, consoles, clusters, remote state, databases, and SaaS administration are outside scope even when access is read-only.
- After admission, apply the **decision identity check before suggesting a new ADR**. Search the mapping summaries and plausible ADR bodies for the same architectural question and owned boundary. If one current-state record can hold the intended result, route the change to that existing ADR; provider/alternative changes and reversals are edit-in-place, not new identities. Suggest a new ADR only when no owner exists or the topic truly forks.
- What the code is the source of truth for is **limited to Status and code-level facts** — code-level facts are usually removed from the ADR rather than mirrored there. By contrast, **admitted gray-zone decisions (adoption rationale, domain rules, state transitions, fallback) and requirements (whether numeric, a value set, a mandatory field, or a permission) are the ADR's authority.** Enums split — **names and representation belong to the code, the allowed set and transition rules to the ADR.** When the code contradicts such a decision, do not overwrite the ADR to match it; branch into "decision change vs violation" (see "Scope of the source of truth" under step 3 item 6 above).
