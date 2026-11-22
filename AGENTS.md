# AGENTS.md

`alps-writer-plugins` — a Codex and Claude Code marketplace shipping three independent plugins: **alps-writer** (ALPS/PRD authoring via an MCP server), **ontology-writer** (an optional business ontology above ADRs) and **adr-writer** (ADR-driven development cycle). Each installs from the marketplace alone. The alps-writer MCP server is bundled with esbuild (dependencies inlined) and the bundle is committed at `plugins/alps-writer/dist/`, so the plugin runs straight from a marketplace install.

**Tech Stack**: TypeScript 5.9+, Bun >= 1.4.2 (runtime, package manager, test runner), Bun workspace, MCP SDK (`@modelcontextprotocol/sdk`), Zod

Each plugin exposes at most **5 MCP tools** and **10 public skills**, counted
separately including aliases. Group related operations without removing features
or weakening approval, validation or failure guarantees. Keep operation-specific
detail in selectively loaded, plugin-local references. ADR Writer handles reader
profile requests through `report-writer profile`.

## Acceptance intent across ADR Writer and Ontology Writer

Every public skill contributes within its own authority to a justified outcome
for the user's decision or business process. Choose the next action from the
current contract, prerequisites, missing evidence and user intent. An implemented
ADR reaches `Accepted` through implementation, tests and the completion review.
An approved business process reaches `Accepted` through its realizing contracts
and real execution of its observation criteria. Keep unresolved, declined,
retired and already completed work visible in its proper state. Search, review,
views, reports and reader preferences support the user's decision within their
existing permissions. Preserve the plugins' independent installation boundaries.

## The design principle — an abstraction ladder, C4-style

C4 shows the same system at different resolutions, from its external context to
containers and components. Apply that idea when choosing where to record a fact.
The PRD explains the user's problem and intended outcome. The optional ontology
describes business workflows and responsibilities. ADRs record architecture
decisions and exact requirement contracts. Code and tests show the implementation.

Full ALPS Section 4.1 requires both Mermaid `C4Context` and `C4Container`.
Lite ALPS uses one product-level `C4Context` in Solution Strategy. Component,
Dynamic, Deployment and Code diagrams stay below the PRD level.

### Preserve conditions, not recoverable facts

Apply these filters in order:

1. **Requirement gate** — preserve required values, states, permissions, ordering,
   uniqueness, units, failure guarantees, boundaries and success conditions at
   their owning level, even when code currently enforces them.
2. **Code-readthrough test** — leave non-requirement facts recoverable from code,
   tests, dependencies or deterministic tools there. Keep signatures, libraries,
   fields, module layouts, commands and tuning out of PRDs and ADRs.
3. **ADR admission gate and litmus test** — preserve a durable adopted choice,
   rationale, alternatives, trade-offs and decision-changing assumptions in an
   ADR when code alone cannot explain the choice.

The regeneration target is **behavior and constraints, not identical code**.
Use the **single-level read test**: each level answers its own question alone,
without lower-level detail or missing requirements. Keep the **regeneration test**,
**stability gradient** `Code >> ADR >> PRD`, and **Spec violation** versus
**Impl-fact mismatch** names when editing skills or agent prompts.

Persist intent, decisions and exact requirements in their owning artifacts, major
transitions in `decision-log.md`, and change-specific intent in Issue / PR / commit
history. Keep plans, approvals, search results, scope discoveries, summaries,
review/eval artifacts and reproducible observations ephemeral. If approval
evidence is absent, ask again; do not create an approval registry. Derived caches
must be disposable, non-authoritative and safe to rebuild.
Keep intermediate material in memory unless it is needed to finish or resume
the current task. A fresh session may resume that task's checkpoint. A new
task starts from authoritative sources and current inputs. Missing checkpoints
are rebuilt from those sources. Never rely on another task's working files.

The harness must remain non-invasive and removable. Constrain observable
artifacts, actions, evidence, approval boundaries and lifecycle transitions;
leave private reasoning, model choice, agent counts and execution topology to
the current model. Load mappings, full ADRs and detailed references only on the
active path, and stop carrying intermediate context when authoritative artifacts
are sufficient.

The [abstraction ladder](plugins/adr-writer/templates/adr/concepts.md) defines
the principle. The [dependency model](docs/dependency-model.md) defines the
resulting reference rules.

## Read the guidance for the active task

Before changing the corresponding surface, read its guide. The guides preserve
the detailed requirements; this file is the startup entry point. Load relevant
sections and their references as needed, rather than every guide at startup.

| Task                                                                                                             | Required guide                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change skills, agents, templates, artifact ownership or persistence rules                                        | [Design principle](docs/development/design-principle.md)                                                                                                 |
| Change PRDs, ADRs, business ontology, handoffs, evaluation contracts, domain grouping or cross-plugin boundaries | [Repository and contracts](docs/development/repository-and-contracts.md), plus the [ontology guide](plugins/ontology-writer/AGENTS.md) for ontology work |
| Change MCP tools, Full/Lite authoring, document selection, XML, assets, research or glossary behavior            | [ALPS server](docs/development/alps-server.md)                                                                                                           |
| Change manifests, hooks, shared guidance, reports or implementation/review behavior                              | [Plugin distribution](docs/development/plugin-distribution.md)                                                                                           |
| Run or change validation, evaluations, shared search, vocabularies, dependencies, CI, versioning or releases     | [Validation and releases](docs/development/validation-and-release.md)                                                                                    |
| Change ADR import, sync, rollup or maintenance questions                                                         | [ADR maintenance](docs/development/adr-maintenance.md)                                                                                                   |

Normal implementation reads ADRs as its sole implementation authority after
handoff. Later PRD edits require explicit semantic re-import. Coupling runs from
upper levels down: adr-writer stays independent of ALPS and never reads the
business ontology. Each plugin must work from its own installation; synchronize
shared sources rather than importing a sibling plugin.

## Common commands

Use Bun for runtime, dependencies, tests and builds. The root is a private Bun
workspace; server scripts proxy to `plugins/alps-writer/`.

```bash
bun install
bun run test:unit
bun run test:integration
bun run test
bun run build
bun run lint
bun run format:check
bun run bump:check
```

Read the validation/release guide for suite selection, live-eval opt-in and release
steps. Maintainer version-bump requests authorize validation, commit, push,
required PR/CI, merge and publication verification unless the request is narrower;
default to patch and always use `bun run bump`.

## Conventions

Document-only ADR review invokes `adr-structure-lint.mjs --documents-only`.
It checks document structure and ADR→PRD references without the code→ADR scan.
Other callers retain the default full invariant checks. `--no-invariants` is
the separate escape hatch for callers that explicitly supply those checks.

- TypeScript strict mode, ES modules (`"type": "module"`)
- Bun >= 1.4.2 as runtime, package manager and test runner
- Conventional Commits (details: CONTRIBUTING.md)
- Scopes: `server`, `templates`, `documents`, `guides`, `adr`, `plugin`, `deps`
- Branch naming: `<type>/<short-description>` (e.g., `feat/section-validation`)
- **Diagrams**: use Mermaid and choose any type supported by the bundled engine to match the reader's question and requested notation; examples are not an allowlist. Preserve relationship semantics, including UML inheritance/composition and state/ER notation. Do not author ASCII/box-drawing diagrams unless the user explicitly asks for one. Applies to README, AGENTS, ADR templates, command/skill prose, and anything this plugin generates inside user projects. Directory trees (`tree`-style with `├── └──`) are exempt — they are listings, not diagrams.

## Definition of Done

Verify before completing any task:

1. `bun run test` passes
2. `bun run build` succeeds
3. `bun run lint` passes
4. `bun run format:check` passes
5. `bun run bump:check` reports every version site in sync
6. If `src/` changed: the regenerated `plugins/alps-writer/dist/` is committed alongside it
7. Related docs (README, AGENTS.md, CONTRIBUTING.md) are up to date

CI has three jobs, all on Bun 1.4.2 (`test`, `build`, `runtime`). The pre-push hook
is the local gate; the GitHub ruleset requires a PR and successful checks before
`main` changes. Read the validation guide for ordering, integration scope and
marketplace checks without installed dependencies.

## Do-Not Rules

- Do not introduce XML parser libraries — maintain current regex-based parsing
- Do not auto-generate content in `src/templates/` or `src/guides/` — manually curated
- Do not modify `dist/` directly — always generate via `bun run build`
- Do not bypass git hooks with `--no-verify`
- Do not delete or modify tests to make them pass — fix the code instead

## References

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Commit messages, branching, code style, PR rules
