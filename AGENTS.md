# AGENTS.md

`alps-writer-plugins` — a Codex and Claude Code marketplace shipping two independent plugins: **alps-writer** (ALPS/PRD authoring via an MCP server) and **adr-writer** (ADR-driven development cycle). Both install from the marketplace alone — no npm. The alps-writer MCP server is bundled with esbuild (dependencies inlined) and the bundle is committed at `plugins/alps-writer/dist/`, so the plugin runs straight from a marketplace install.

**Tech Stack**: TypeScript 5.9+, Node.js >= 24, pnpm workspace, MCP SDK (`@modelcontextprotocol/sdk`), Zod

## The design principle — an abstraction ladder, C4-style

Everything in this repo serves one idea, so weigh changes against it.

**PRD, ADR, and code are not three documents about three topics. They are the same system at three resolutions** — the way a C4 diagram shows one architecture at context, container, and component zoom. What gives a level its value is what it **refuses to show**: a context diagram that also drew every class would answer no question better than the code already does.

| Level        | Artifact                  | The one question it answers                                                | Owner           |
| ------------ | ------------------------- | -------------------------------------------------------------------------- | --------------- |
| **Zoom out** | ALPS PRD (`*.alps.xml`)   | WHAT / WHY — the user's problem                                            | **alps-writer** |
| **Middle**   | ADR (`docs/adr/`)         | HOW (architecture) — the decision, its rationale, the requirement contract | **adr-writer**  |
| **Zoom in**  | Code / AGENTS.md / README | HOW (detail) — structure, names, signatures, tuning values                 | the user's repo |

Full ALPS applies the C4 analogy literally in Section 4 with both a Mermaid
`C4Context` and `C4Container` diagram. Lite ALPS keeps only one product-level
`C4Context` inside Solution Strategy. Component, Dynamic, Deployment, and
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

Section 7 may state reproducible requirement values and rules at user-problem resolution. `/feature-to-adr` classifies every implementation-relevant input and completes the handoff only when ADRs own the full contract. From that point ADRs are the sole implementation authority and the PRD remains a legacy planning document. A later PRD edit has no effect unless the user explicitly re-imports it; equivalent input is a no-op, and changed or removed contracts require an ADR-first decision.

Both reduce to one test, and it is the test to apply when reviewing a change to any prompt, template, or rule here:

> **The single-level read test**: can this level be read alone and answer its own question — with nothing in it that belongs to a level below, and nothing missing that no other level holds?

The same ladder governs **context lifetime**. Persist only information whose loss would erase human intent, an important decision or trade-off, or a requirement future work must honor. Put it at the level that owns it: product intent in the PRD, admitted architecture decisions and contracts in ADRs, major transitions in `decision-log.md`, implementation truth in code and tests, repository-wide conventions here or in README/CONTRIBUTING, and change-specific intent in the Issue, PR, or commit history.

Everything a capable coding agent can recover by reading those artifacts, running a deterministic tool, repeating a search, or asking one short question should remain **ephemeral**. This includes approval state, implementation plans, search results, discovered code scopes, copied tickets and logs, mapping snapshots, intermediate summaries, subagent transcripts, exploratory reasoning, temporary review artifacts, eval results, and reproducible test/build observations. If approval evidence is absent, ask again rather than building an approval registry. A derived cache may exist for performance, but it must be disposable, non-authoritative, and safe to rebuild.

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

Named applications of the same test, all defined in `templates/adr/`: the **ADR admission gate** (whether the decision belongs in an ADR at all), the **regeneration test** (delete all code, can requirement-honoring code be rebuilt?), the **requirement gate + code-readthrough + litmus** filters (routing one fact to its level), the **stability gradient** `Code >> ADR >> PRD` (detecting a violation after the fact — a code change dragging an ADR edit means the ADR held a resolution that was never its own), and the **`Spec violation` vs `Impl-fact mismatch`** split in impl-review (which level owns a disagreement). When editing any skill or agent prompt, keep these names — they are how the levels stay aligned across separately-running subagents.

The source of truth for the principle is `plugins/adr-writer/templates/adr/concepts.md` "The abstraction ladder"; `docs/dependency-model.md` covers the reference rules that follow from it.

## Commands

Root is a private pnpm workspace; the MCP server package lives in `plugins/alps-writer/`. Root scripts proxy to it.

```bash
pnpm install          # Install dependencies (whole workspace)
pnpm test             # ALPS, dependency-free ADR, and DeepEval integration tests; blocks pre-push
pnpm build            # Bundle the alps-writer MCP server (pnpm --filter alps-writer build)
pnpm lint             # ESLint the MCP server
pnpm format           # Prettier across the repo

pnpm bump 0.4.24      # Set the release version (or: patch | minor | major)
pnpm bump:check       # Verify every version site agrees

pnpm --filter alps-writer dev     # Run MCP server with tsx in watch mode
pnpm --filter alps-writer start   # Run built bundle (node dist/index.js)
```

### Versioning

The release version lives in **13 sites** that must agree, in four groups: the four plugin manifests (`.claude-plugin/` + `.codex-plugin/` for both plugins), the three `marketplace.json` versions (metadata + one per plugin entry), the `serverInfo` literal in `plugins/alps-writer/src/index.ts`, and the five `adr-writer:rules-version` stamps in `plugins/adr-writer/templates/adr/`. The `serverInfo` literal is what an MCP client reports, and `tsconfig`'s `rootDir: "src"` prevents importing the version from `package.json`. The stamps are what `adr-structure-lint` compares a consumer's seeded docs against, so a stamp left behind makes the plugin report its own templates as stale to everyone at once. Always bump with `pnpm bump <version>`, then `pnpm build` so the committed `dist/` carries the new `serverInfo`; bumping by hand has drifted twice (0.3.0 and 0.4.20 both shipped with a stale server version).

`version-consistency.test.ts` covers the first eight sites; the five stamps are covered only by `pnpm bump:check`, which is why pre-push and CI both run it.

Both `package.json` files are **deliberately pinned to `0.0.0`** and are not part of the release version — they are `private: true`, so their version reaches no consumer. Don't "resync" them; `version-consistency.test.ts` asserts the pin.

Build (inside `plugins/alps-writer/`) runs `tsc --noEmit` (typecheck), then esbuild bundles `src/index.ts` → `dist/index.js` with deps inlined (ESM, node24 target), then copies static assets `cp -r src/templates dist/ && cp -r src/guides dist/`. The asset copy is required because the server reads XML templates / MD guides at runtime via `fs.readFileSync` (`import.meta.url`-relative). **`dist/` is committed** — regenerate and commit it whenever `src/` changes.

Tests use Node's built-in test runner. ALPS TypeScript tests run through `tsx`; ADR tests are dependency-free `.mjs` tests. Run all suites with `pnpm test`.

**Behaviour evals** (`plugins/adr-writer/evals/`) are separate and NOT in `pnpm test`. `pnpm test` proves a prompt _says_ something; the evals check whether an agent given that prompt _does_ it, by running real scenarios against a live model and reporting per-check hit rates. They cost money, take minutes, and are non-deterministic, so they never gate CI — their job is reproducing a reported defect (`node evals/run.mjs --only <name> --runs 10`) and telling you whether it happens 3/10 or 10/10, which decides the fix. Use `node evals/run.mjs --changed <base> --list` to preview the disposable impact-map selection for a branch without invoking a model. The harness itself _is_ covered by `pnpm test` via a stub agent, because an eval whose scorer cannot tell a bad reply from a good one reports green and is worse than no eval. See `plugins/adr-writer/evals/README.md`.

The rollup/sync artifact regression path uses `pnpm eval:regression` with DeepEval GEval.
The judge defaults to Bedrock `us.openai.gpt-5.6-sol`, explicit AWS profile `default`,
and region `us-east-1`; `--model` selects only the Claude Code target agent.
Its fixture tool boundary, live opt-in, framework integration, and HTML report workflow
are documented in `plugins/adr-writer/evals/deepeval/README.md`. `test:deepeval` is a
workspace-only SDK integration suite included in `pnpm test`; the bare-Node runtime
suite remains dependency-free. `pnpm eval:custom` retains the earlier grader.
`eval:golden` exports the 11-case corpus and pinned provenance without model calls.
`eval:calibration` checks the judge against 21 authored examples; labels are explicit
AI drafts until human review, and their agreement is not human-ground-truth accuracy.

## Repository Structure

```
.claude-plugin/
└── marketplace.json      # Marketplace manifest — registers both plugins
.agents/plugins/
└── marketplace.json      # Codex marketplace manifest
package.json              # Private workspace root (prettier/husky/lint-staged); version pinned 0.0.0
pnpm-workspace.yaml       # packages: plugins/alps-writer
.github/workflows/
└── ci.yaml               # Node 24 test/build/runtime jobs + dist-drift gate
scripts/
└── bump-version.mjs      # Set/verify the release version across all 13 sites
.adr-invariants-code-ignore # Self-hosting exclusions for code→ADR example scanning

plugins/alps-writer/      # PRD plugin (bundles + commits its own MCP server)
├── .claude-plugin/plugin.json   # mcpServers only; skills/ (alps-init, lite-alps-init, feature-to-adr) are auto-discovered
├── .codex-plugin/plugin.json    # Codex metadata; registers skills + .mcp.json
├── .mcp.json                    # Codex MCP command (node ./dist/index.js)
├── package.json          # private; build tooling for the bundle
├── tsconfig.json, eslint.config.mjs
├── src/
│   ├── index.ts          # MCP server entry point + tool registration
│   ├── constants.ts      # Backward-compatible section/path exports + NOT_STARTED
│   ├── profiles.ts       # Full/Lite metadata, ordering, templates, optional/dynamic sections
│   ├── xml.ts            # regex XML helpers shared by both tool layers
│   ├── tools/
│   │   ├── templates/    # Template tools (controller + service)
│   │   └── documents/    # Document tools (controller + service)
│   ├── guides/           # Full 01-09 + Lite 01-04
│   └── templates/        # Full + Lite 01-04
├── dist/                 # committed esbuild bundle (index.js + copied assets)
├── skills/               # alps-init, lite-alps-init, feature-to-adr
└── templates/alps/       # about-alps.md

plugins/adr-writer/       # ADR plugin (standalone, ALPS-agnostic)
├── .claude-plugin/plugin.json   # Claude metadata; hooks/ is auto-discovered
├── .codex-plugin/plugin.json    # Codex metadata; registers skills + hooks
├── README.md
├── skills/               # adr-new, adr-impl, adr-impl-refactor, adr-impl-review, adr-sync, adr-rollup
├── agents/               # ADR authoring reviewer + isolated refactor/impl explainer/review/report roles
├── evals/                # behaviour evals (real model; NOT in pnpm test)
│   ├── run.mjs           # runner — N runs per scenario, hit rates, shareable report
│   ├── lib/harness.mjs   # fixture builder + scorers; passes the REAL skill/agent text
│   └── scenarios/        # one reproducible situation each
├── scripts/              # deterministic checkers (Node built-ins / bash only)
│   ├── adr-invariants.sh          # one-way dependency oracle (code→ADR, ADR→PRD, rollup)
│   ├── adr-structure-lint.mjs     # per-ADR + mapping structure CLI; shells out to the above
│   ├── adr-lint-lib.mjs           # pure checkers + the shared vocabularies the CLI and tests read
│   ├── adr-impl-review-categories.mjs  # finding-category table shared by the validator + renderer
│   ├── adr-impl-review-materialize.mjs # derives repeated Markdown sections from findings.json
│   ├── adr-impl-review-validate.mjs    # /adr-impl-review artifact validator
│   ├── adr-impl-review-report.mjs      # renders findings.json → standalone review HTML
│   └── adr-impl-review-open.mjs        # validates and opens the local HTML report once
├── hooks/
│   ├── hooks.json        # SessionStart registration
│   └── surface-adr-context.mjs  # SessionStart — inject a compact ADR admission directive
└── templates/adr/
    ├── README.md         # ADR concepts (copied into docs/adr/ on /adr-new)
    ├── authoring-rules.md, structure.md
    ├── decision-log.template.md  # Seed for a category's decision-log.md
    └── mapping.schema.json   # Schema for docs/adr/.mapping.json
```

The two plugins are split so adr-writer never references ALPS. The only coupling is one-way: alps-writer's `/feature-to-adr` transfers each implementable Feature's complete contract into one or several ADRs and delegates each new decision owner to adr-writer's `/adr-new`. Normal implementation then reads only ADRs; explicit PRD re-import remains an alps-writer-side semantic comparison.

Shared authoring guidance is owned by `plugins/adr-writer/references/`:
`requirement-delegation.md` and `comprehension-load.md` are copied into
alps-writer's own `references/` by `scripts/sync-authoring-guidance.mjs`.
Both packages use plugin-local references rather than assuming sibling install
directories. Build synchronizes them; `authoring-guidance:check` rejects drift.

ADR folders are organized along two axes — a DDD **bounded context** (top-level folder / first key segment) containing one or more **features** (vertical slices, the second segment). A single-feature context stays flat (`auth/`, workshop `f1/`), so existing flat repos need no migration. The ADR index lives in `docs/adr/.mapping.json` itself (path/status/summary per ADR), and admitted work reads it on demand; the README keeps no separate ADR list. The mapping carries an optional advisory `subdomainType` (core/supporting/generic) per context and stores no PRD reference. Context grouping is only applied when ALPS already groups features or the user asks for it — `/feature-to-adr` never invents a domain boundary the PRD doesn't assert, so the one-way alps-writer → adr-writer coupling and "adr-writer never references ALPS" both hold. The DDD overlay is metadata + framing only; it adds no folder depth (keys stay ≤2 segments) and `scripts/adr-invariants.sh` is unaffected.

## Architecture

**MCP Server** (`src/index.ts`) — Entry point. Creates `McpServer` instance, registers all tools with Zod schemas, connects via `StdioServerTransport`. Tool handlers are thin wrappers that delegate to controllers.

**Controller/Service pattern** — Separates domain-specific controllers (MCP interface) from services (business logic):

- `src/tools/templates/` — Read-only access to ALPS templates and conversation guides
- `src/tools/documents/` — Document CRUD (init, load, save, read, export) with state management

**Document profiles** (`src/profiles.ts`) — Full ALPS and four-section Lite ALPS metadata: section titles, dependency graph, authoring order, optional Sections, file suffix, template/guide paths, and dynamic Feature sections where applicable. Section ranges are derived from each profile. Lite reuses Full's approval and persistence behavior while keeping independent document state and completion. Lite uses `Overview → Solution and Essential User Experiences → Out of Scope → Demo Scenario`; Section 3 is optional and omitted from Markdown when unwritten. Section 1 captures `Desired Business Impact`, Section 2 has AI propose the minimum Solution Strategy with one product-level `C4Context` and the Essential User Experiences, and Section 4 has AI propose the concrete starting state, input, user actions, and visible results that demonstrate every experience.

**Conversation-led authoring** — Full ALPS retains its pre-Lite section-by-section conversation: explain the section, ask one focused question or at most two closely related questions when context is missing, integrate the answer, present a contract-complete approval digest, and save only after confirmation. Lite ALPS keeps the same approval boundary but uses a working-backwards interaction: the user supplies the target problem and Desired Business Impact, while AI proposes Section 2 and the executable Section 4 flow. Lite asks only when a protected product decision cannot be safely proposed. Optional Section 3 skips the question when no explicit exclusion exists and the approved boundary is not materially ambiguous. Shared Lite support must not rewrite Full skills, guides, examples, or wizards.

**XML helpers** (`src/xml.ts`) — `attribute`, `decodeXml`, `escapeXmlAttribute`, `escapeXmlText`, shared by the document and template layers (this project parses XML with regex by design — see Do-Not Rules). `attribute()` always returns the **decoded** value: an attribute's value is its decoded text, and both callers compare it against plain text.

**Static assets** (read from filesystem at runtime):

- `src/templates/chapters/01-09.xml` — XML section templates
- `src/templates/overview.md` — ALPS overview
- `src/guides/01-09.md` — Per-section conversation guides
- `src/templates/lite/chapters/01-04.xml` — Current Lite ALPS XML templates
- `src/templates/lite/overview.md` — Current Lite ALPS overview
- `src/guides/lite/01-04.md` — Current Lite ALPS conversation guides

**Document format** — Full documents use `.alps.xml`; Lite documents use `.lite.alps.xml` and a `profile="lite"` root attribute. Lite documents must contain the current four Sections and exact titles in order. Both use `<alps-document>`, `<section>`, and `<subsection>` tags and are parsed via regex (no XML parser library). Output directory is controlled by `ALPS_OUTPUT_DIR` (`PRD_OUTPUT_DIR` is also supported for backward compatibility).

**DocumentService state** — `workingDoc` holds the current document path in memory. Read/write operations require `initDocument()` or `loadDocument()` to be called first.

## Plugin distribution

The repo root is a dual-client marketplace. `.agents/plugins/marketplace.json` registers the plugins for Codex and `.claude-plugin/marketplace.json` registers them for Claude Code; both point to `./plugins/alps-writer` and `./plugins/adr-writer`. Each plugin has client-specific manifests under `.codex-plugin/` and `.claude-plugin/`. Skills are shared between both clients. Codex invokes them with `$skill-name` or natural language; Claude Code exposes the same skills as `/skill-name`.

Codex plugin hooks set `PLUGIN_ROOT` and also set `${CLAUDE_PLUGIN_ROOT}` for Claude compatibility, so shared hook commands and skill instructions can retain the existing variable. The alps-writer Codex MCP config uses plugin-relative `cwd` and `./dist/index.js`.

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add alps-writer@alps-writer
codex plugin add adr-writer@alps-writer
```

```
/plugin marketplace add haandol/alps-writer-plugins
/plugin install alps-writer@alps-writer   # PRD plugin (MCP server + skills)
/plugin install adr-writer@alps-writer    # ADR plugin (skills + hooks)
```

- **alps-writer** runs its MCP server from the committed bundle plus its local `skills/`. Its report-writing SessionStart hook adds a compact style directive; no npm/npx is required.
- **adr-writer** ships local `skills/`, `agents/`, `hooks/`, and `templates/adr/`. Codex requires users to review and trust the bundled hook before it runs. No MCP.

The hook script (in adr-writer) is Node ESM (`.mjs`) and reads NDJSON events from stdin per the Claude Code hooks spec. It uses only Node built-ins (no extra deps), so the plugin requires nothing beyond a Node.js >= 24 runtime.

### Shared report-writing skill

`shared/report-write/` owns the common English skill, editorial guidance, formatting
rules, and Node-only report helper. `scripts/sync-report-skill.mjs` copies it into
both plugins; its Mermaid helper is copied from the existing ADR diagram module.
Edit the canonical source, then synchronize. `report-skill:check` rejects drift.
Use `--global` only when updating the user-level `~/.agents/skills/report-write`;
normal builds never write to the user's home directory.

Both plugins advertise report-write through SessionStart independently of the ADR
mapping. All report-producing skills and review roles load it for the final human
presentation, including code, PR, ADR, architecture and document review requests
that do not explicitly ask for a report. The owning workflow still controls
inspection, verdicts, severity and edit permissions. The packaged skill directory
can also be installed independently with `npx skills add`; see README for the
explicit source path. Native review schemas remain complete audit input, while final
reports use domain-scoped hierarchy, at most four peer units, readable paragraph
breaks, evidence-grounded diagrams, worked calculations, and whole-output review.
The renderer validates structure and source coverage; semantic review remains a
separate, explicitly reported step.

The shared report skill also owns core-content comprehension quizzes: one to five
medium-difficulty questions per report, four choices and one answer each. Authors
generate questions from the report; the dependency-free renderer validates and
displays them with staged self-check and print-safe answer hiding. Implementation
review reuses these controls and retains its native audit schema and PR-readiness
rules. Omit quizzes only on user request or when there is no substantive concept
to check; a PASS verdict alone is not an omission reason.

### Cycle hooks layout (adr-writer)

| File                            | Event          | Purpose                                                                                                                     |
| ------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `hooks/surface-adr-context.mjs` | `SessionStart` | Inject a compact ADR admission directive on startup, resume, clear, and compaction recovery; never inject mapping contents. |

The cycle relies on the **main session model** for text understanding — the hook calls no auxiliary LLM and uses no intent regex. It supplies structured context; classification (and keeping the PRD → ADR → code flow intact) stays with the main model. There is deliberately no `PreToolUse` enforcement hook: the ADR ↔ code link is not stored, so a non-LLM hook can't map an edited file back to an ADR — that judgment belongs to the model.

The compact directive is injected when session context starts or is replaced (`startup`, `resume`, `clear`, `compact`). This restores it after compaction without running a hook for every user message. A request that passes the admission gate must read the full mapping and plausible ADR bodies before code changes; exempt requests do not pay that context cost.

## Conventions

Document-only ADR review invokes `adr-structure-lint.mjs --documents-only`.
It checks document structure and ADR→PRD references without the code→ADR scan.
Other callers retain the default full invariant checks. `--no-invariants` is
the separate escape hatch for callers that explicitly supply those checks.

- TypeScript strict mode, ES modules (`"type": "module"`)
- Node.js >= 24
- pnpm as package manager
- Conventional Commits (details: CONTRIBUTING.md)
- Scopes: `server`, `templates`, `documents`, `guides`, `adr`, `plugin`, `deps`
- Branch naming: `<type>/<short-description>` (e.g., `feat/section-validation`)
- **Diagrams**: always Mermaid (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`). Do not author ASCII/box-drawing diagrams unless the user explicitly asks for one. Applies to README, AGENTS, ADR templates, command/skill prose, and anything this plugin generates inside user projects. Directory trees (`tree`-style with `├── └──`) are exempt — they are listings, not diagrams.

## Definition of Done

Verify before completing any task:

1. `pnpm test` passes
2. `pnpm build` succeeds
3. `pnpm lint` passes
4. `pnpm format:check` passes
5. `pnpm bump:check` reports every version site in sync
6. If `src/` changed: the regenerated `plugins/alps-writer/dist/` is committed alongside it
7. Related docs (README, AGENTS.md, CONTRIBUTING.md) are up to date

These are automated in two places, so the list above is what you run locally to
avoid a round trip — not the only thing standing between a bad commit and `main`:

- **`.husky/pre-push`** — everything CI runs, all blocking, ~20s: typecheck,
  `pnpm test`, `lint`, `format:check`, `bump:check`, the committed-bundle boot and
  hook-start checks, and the dist-drift rebuild. The rule is **if CI fails on it,
  pre-push fails on it** — the two were split before, so a push could be green
  locally and red on GitHub over a lint or formatting problem already sitting in
  the tree. `SKIP_TESTS=1 git push …` bypasses only the slow suite for a
  knowingly-red WIP branch and is rejected when the push updates `main`; every
  other check always runs.

  Ordering matters in one place: the bundle-boot check runs **before** the
  `pnpm build` rebuild, so it judges the bundle being pushed rather than one just
  regenerated. With the checks the other way round a hand-edited or truncated
  `dist/` passed, because the file under test was no longer the file in the commit.

- **`.github/workflows/ci.yaml`** — three jobs, all on Node 24. `test` runs the
  suite; `build` adds lint, `format:check`, `bump:check`, and a rebuild that fails
  if the committed `plugins/alps-writer/dist/` differs; `runtime` re-runs what a
  consumer executes with **no install step**. The hooks only exist for someone who
  ran `pnpm install` and can be skipped with `--no-verify`, so CI is the gate that
  actually holds.

- **GitHub ruleset** — `main` requires a pull request and successful `test`,
  `build`, and `runtime` checks. Local hooks are feedback; the remote ruleset is
  the final publication boundary.

**Why `engines.node` is 24 and CI runs no older matrix.** The floor used to read
`>= 20`, and nothing could check it: `pnpm@11` needs Node >= 22.13 (it imports
`node:sqlite`) and `node --test`'s glob support landed in 21, so a Node 20 leg
fails at `pnpm install` or at collecting the test files — neither is a real
incompatibility finding. Rather than keep an unverifiable claim, the declaration
was moved to match reality (`engines.node >= 24`, esbuild `--target=node24`).

The `runtime` job still exists because installing is not the same as shipping: a
marketplace install has no `node_modules` at all — the MCP server is a bundle with
dependencies inlined, and the adr-writer scripts, hook, and tests use Node
built-ins only. It runs the dependency-free adr-writer suite, an MCP `initialize`
round-trip against the committed bundle, and the `SessionStart` hook, all
under a bare `node`. The pnpm-based jobs cannot catch a break there, since they
always have a populated `node_modules`.

### Shared vocabularies

Several tables are read by more than one consumer, and each one previously existed
as hand-synced copies. They now have a single home, and
`plugins/adr-writer/tests/shared-vocab.test.mjs` fails the build if a consumer
grows its own copy again:

| Table                                    | Home                                     | Read by                                                      |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| `ANTIPATTERN_SEGMENTS`                   | `scripts/adr-lint-lib.mjs`               | mapping-key check + on-disk directory check in the lint CLI  |
| `SEEDED_RULE_DOCS` / `STAMPED_RULE_DOCS` | `scripts/adr-lint-lib.mjs`               | lint staleness check, test fixtures, eval fixtures, `bump`   |
| `CATEGORIES` (hue/authority/priority)    | `scripts/adr-impl-review-categories.mjs` | impl-review validator allow-list + HTML report render & sort |

`scripts/bump-version.mjs` is the one deliberate exception — it spells the stamped
doc list out rather than importing plugin internals, because it is a repo-level
release script. The test asserts the two agree.

## Do-Not Rules

- Do not introduce XML parser libraries — maintain current regex-based parsing
- Do not auto-generate content in `src/templates/` or `src/guides/` — manually curated
- Do not modify `dist/` directly — always generate via `pnpm build`
- Do not bypass git hooks with `--no-verify`
- Do not delete or modify tests to make them pass — fix the code instead

## References

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Commit messages, branching, code style, PR rules
