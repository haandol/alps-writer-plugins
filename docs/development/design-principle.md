# Design principle

Read this guide when the matching task in `AGENTS.md` applies. Paths and commands
refer to the repository root unless a different base is stated.

## The design principle — an abstraction ladder, C4-style

Everything in this repo serves one idea, so weigh changes against it.

**PRD, ADR, and code are not three documents about three topics. They are the same system at three resolutions** — the way a C4 diagram shows one architecture at context, container, and component zoom. What gives a level its value is what it **refuses to show**: a context diagram that also drew every class would answer no question better than the code already does.

| Level                     | Artifact                                  | The one question it answers                                                 | Owner               |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| **Zoom out**              | ALPS PRD (`*.alps.xml`)                   | WHAT / WHY — the user's problem                                             | **alps-writer**     |
| **Above ADRs (optional)** | Business ontology (`docs/ontology/*.ttl`) | HOW the business flows across features — events, policies, cross-step rules | **ontology-writer** |
| **Middle**                | ADR (`docs/adr/`)                         | HOW (architecture) — the decision, its rationale, the requirement contract  | **adr-writer**      |
| **Zoom in**               | Code / AGENTS.md / README                 | HOW (detail) — structure, names, signatures, tuning values                  | the user's repo     |

Full ALPS applies the C4 analogy literally in Section 4 with both a Mermaid
`C4Context` and `C4Container` diagram. Lite ALPS keeps only one business-wording
`C4Context` as its Business Context Diagram. Component, Dynamic, Deployment, and
Code-level C4 diagrams belong below the PRD resolution and must not be generated
there.

### The persistence rule — preserve conditions, not recoverable facts

**The goal is selective reading: a reader loads one level, gets its question
answered, and stops.** Persist only what is needed to regenerate an implementation
that preserves human intent, admitted decisions, and exact requirements. Do not
persist a second copy of facts recoverable from code, tests, dependency metadata,
search, or deterministic tools.

Apply these tests in order:

1. **Requirement gate** — if the fact vanished, could regenerated code violate a
   required value, state, permission, ordering rule, failure guarantee, boundary,
   or success condition? If yes, preserve it at the owning level even when the
   current code also enforces it.
2. **Code-readthrough test** — if the fact is not a requirement and an agent can
   recover it from code, tests, dependency metadata, or deterministic output,
   leave it there. Do not copy libraries, SDKs, signatures, fields, module
   layouts, internal call flow, commands, or tuning values into PRDs or ADRs.
3. **ADR admission gate and litmus test** — if code cannot explain why one
   durable alternative was adopted and changing the fact would change the
   architectural decision, preserve the decision, rationale, alternatives,
   trade-offs, and decision-changing assumptions in the ADR.

The regeneration target is **behavior and constraints, not identical code**.
Files, functions, libraries, and internal structure may differ. Required values,
allowed states, permissions, ordering, failure behavior, user-visible outcomes,
and durable system/data/security/external boundaries may not.

| Owner               | Durable content                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALPS PRD            | user problem, observable outcome, product contract, success condition, explicit non-goal, durable product/system constraint                           |
| ADR                 | admitted architecture decision, exact requirement contract, rationale, alternatives, durable boundary, implementation-independent observable evidence |
| Code and tests      | implementation structure, identifiers, dependencies, tuning, enforcement, executable verification                                                     |
| Issue / PR / commit | change-specific intent and verbatim history                                                                                                           |

Two leaks break it, and nearly every rule in `plugins/adr-writer/templates/adr/` exists to catch one of them:

- **Detail pulled up from a lower level** (signatures, field types, pool sizes, pseudocode, file paths in an ADR) — the level stops being trustworthy alone, because it asserts things the level below may already have changed. A reader must open the code to learn which half still holds.
- **A requirement pushed out of the ADR** ("the PRD or code has the number, so drop it") — worse, because code shows enforcement and the PRD shows user intent, but neither explains the admitted architectural contract and rationale. This is the failure mode the plugin guards hardest, and why the requirement gate is asked before any exclusion filter.

Section 7 may state reproducible requirement values and rules at user-problem resolution. `/feature-to-adr` classifies every implementation-relevant input and completes each Feature's handoff only when ADRs own its full contract and every current-reference-level proposal it depends on is approved. From that point ADRs are the sole implementation authority and the PRD remains a legacy planning document. A later PRD edit has no effect unless the user explicitly re-imports it; equivalent input is a no-op, and changed or removed contracts require an ADR-first decision.

Both reduce to one test, and it is the test to apply when reviewing a change to any prompt, template, or rule here:

> **The single-level read test**: can this level be read alone and answer its own question — with nothing in it that belongs to a level below, and nothing missing that no other level holds?

The same ladder governs **context lifetime**. Persist only information whose loss would erase human intent, an important decision or trade-off, or a requirement future work must honor. Put it at the level that owns it: product intent in the PRD, admitted architecture decisions and contracts in ADRs, major transitions in `decision-log.md`, implementation truth in code and tests, repository-wide conventions here or in README/CONTRIBUTING, and change-specific intent in the Issue, PR, or commit history.

Everything a capable coding agent can recover by reading those artifacts, running a deterministic tool, repeating a search, or asking one short question should remain **ephemeral**. This includes approval state, implementation plans, search results, discovered code scopes, copied tickets and logs, mapping snapshots, intermediate summaries, subagent transcripts, exploratory reasoning, temporary review artifacts, eval results, and reproducible test/build observations. If approval evidence is absent, ask again rather than building an approval registry. A derived cache may exist for performance, but it must be disposable, non-authoritative, and safe to rebuild.

Keep only the working material needed for the current result or to resume expensive work in a fresh session. A task owns its checkpoint across session restarts. Start independent work from the owning documents, code, tests and current user inputs. When a checkpoint is absent, rebuild from those sources. Never look up a different task's scratch files, copy them into a new task, or require them for acceptance. A finished, explicitly supplied deliverable can be assessed on its own.

Apply the single-level read test at runtime through **selective reading and progressive disclosure**: keep hooks and core skill instructions compact; load mappings, ADR bodies, detailed references, and reviewer instructions only when the active path needs them; and do not carry intermediate context into later stages when authoritative artifacts are sufficient.

The plugins are a **non-invasive, removable harness** over that ladder. Durable
context remains in the artifact that owns its resolution, so uninstalling a
plugin or upgrading the model leaves PRDs, ADRs, code, tests, and repository
conventions independently readable. Harnesses constrain observable artifacts,
actions, evidence, approval boundaries, and lifecycle transitions; they do not
prescribe private chain-of-thought, a fixed subagent count, a model family, or a
parallel/sequential execution topology. Those action-level choices are
ephemeral model discretion as long as the same user-visible contracts and
verification results are preserved.

Named applications of the same test, all defined in `plugins/adr-writer/templates/adr/`: the **ADR admission gate** (whether the decision belongs in an ADR at all), the **regeneration test** (delete all code, can requirement-honoring code be rebuilt?), the **requirement gate + code-readthrough + litmus** filters (routing one fact to its level), the **stability gradient** `Code >> ADR >> PRD` (detecting a violation after the fact — a code change dragging an ADR edit means the ADR held a resolution that was never its own), and the **`Spec violation` vs `Impl-fact mismatch`** split in impl-review (which level owns a disagreement). When editing any skill or agent prompt, keep these names — they are how the levels stay aligned across separately-running subagents.

The source of truth for the principle is `plugins/adr-writer/templates/adr/concepts.md` "The abstraction ladder"; `docs/dependency-model.md` covers the reference rules that follow from it.
