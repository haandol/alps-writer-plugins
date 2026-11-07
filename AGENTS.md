# AGENTS.md

`alps-writer-plugins` — a Codex and Claude Code marketplace shipping three independent plugins: **alps-writer** (ALPS/PRD authoring via an MCP server), **ontology-writer** (an optional business ontology above ADRs) and **adr-writer** (ADR-driven development cycle). Each installs from the marketplace alone — no npm. The alps-writer MCP server is bundled with esbuild (dependencies inlined) and the bundle is committed at `plugins/alps-writer/dist/`, so the plugin runs straight from a marketplace install.

**Tech Stack**: TypeScript 5.9+, Bun >= 1.4.2 (runtime, package manager, test runner — no Node.js or pnpm), Bun workspace, MCP SDK (`@modelcontextprotocol/sdk`), Zod

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

Section 7 may state reproducible requirement values and rules at user-problem resolution. `/feature-to-adr` classifies every implementation-relevant input and completes each Feature's handoff only when ADRs own its full contract and every current-reference-level proposal it depends on is approved. From that point ADRs are the sole implementation authority and the PRD remains a legacy planning document. A later PRD edit has no effect unless the user explicitly re-imports it; equivalent input is a no-op, and changed or removed contracts require an ADR-first decision.

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

Root is a private bun run workspace; the MCP server package lives in `plugins/alps-writer/`. Root scripts proxy to it.

```bash
bun install          # Install dependencies (whole workspace)
bun run test:unit        # Unit tests: no git, browser or other external tool (seconds)
bun run test:integration # Integration tests: git, a browser or another external tool
bun run test             # Asset/guidance checks, ALPS, then pooled ADR/DeepEval/browser tests
bun run build            # Bundle the alps-writer MCP server (bun run --filter alps-writer build)
bun run lint             # ESLint the MCP server
bun run search:check     # Verify standalone plugins carry the current shared search
bun run format           # Prettier across the repo

bun run bump 0.4.24      # Set the release version (or: patch | minor | major)
bun run bump:check       # Verify every version site agrees

bun run --filter alps-writer dev     # Run the MCP server from src with Bun
bun run --filter alps-writer start   # Run built bundle (bun dist/index.js)
```

### Versioning

When the maintainer asks to raise the version, complete the release through
validation, commit, branch push, required PR/CI and merge. Routine confirmation is
not needed. Default to a patch increment; increase minor or major only when
explicitly requested, including an exact version. Honor narrower instructions
such as bump-only or no-push. The personal `deploy-release` skill covers this workflow.

Publication follows the merge on its own. Give the release pull request a
`## Release notes` section before merging it: once CI passes on the merged main
commit, the Release workflow (`.github/workflows/release.yaml`) tags that commit
`v<version>` and publishes the GitHub release titled after the marketplace's
plugins, with that section as its notes, or GitHub's generated notes without it.
A merge whose version already has a tag publishes nothing. Verify the published
release and its tag instead of creating them; only when the workflow cannot run,
`node scripts/publish-release.mjs <merge-sha>` publishes the same release by hand.

The pre-push hook is the local gate before a push, and CI runs the integration
tests on every pull request. Locally, run the integration test files a change
touches (git history reading, a CLI or a browser view) rather than the whole
`bun run test` again.
On a push to main, CI skips its jobs when it already passed on the merged pull
request's head and the pushed commit carries that head's tree, which the
ruleset's up-to-date requirement guarantees for every merge method.

The release version lives in **16 sites** that must agree, in four groups: the six plugin manifests (`.claude-plugin/` + `.codex-plugin/` for each of the three plugins), the four `marketplace.json` versions (metadata + one per plugin entry), the `serverInfo` literal in `plugins/alps-writer/src/index.ts`, and the five `adr-writer:rules-version` stamps in `plugins/adr-writer/templates/adr/`. The `serverInfo` literal is what an MCP client reports, and `tsconfig`'s `rootDir: "src"` prevents importing the version from `package.json`. The stamps are what `adr-structure-lint` compares a consumer's seeded docs against, so a stamp left behind makes the plugin report its own templates as stale to everyone at once. Always bump with `bun run bump <version>`: it runs `bun run build` afterwards, so the committed `dist/` carries the new `serverInfo`. Bumping by hand has drifted twice (0.3.0 and 0.4.20 both shipped with a stale server version).

`version-consistency.test.ts` covers the first eleven sites; the five stamps are covered only by `bun run bump:check`, which is why pre-push and CI both run it.

Both `package.json` files are **deliberately pinned to `0.0.0`** and are not part of the release version — they are `private: true`, so their version reaches no consumer. Don't "resync" them; `version-consistency.test.ts` asserts the pin.

Build (inside `plugins/alps-writer/`) runs `tsc --noEmit` (typecheck), then esbuild bundles `src/index.ts` → `dist/index.js` with deps inlined (ESM, node24 target), then copies static assets `cp -r src/templates dist/ && cp -r src/guides dist/`. The asset copy is required because the server reads XML templates / MD guides at runtime via `fs.readFileSync` (`import.meta.url`-relative). **`dist/` is committed** — regenerate and commit it whenever `src/` changes.

Tests run on Bun's test runner (`bun scripts/run-tests.mjs <group>`, sharded across processes); the files keep the `node:test` API, which Bun implements. ALPS TypeScript tests run directly, with no transpiler step; ADR tests are dependency-free `.mjs` tests. `bunfig.toml` preloads the git-shim and timezone setup: `bun test` runs in UTC, and the preload exports that zone so CLIs a test starts use the same calendar. A unit test needs no external tool (it runs in process or starts only this repository's Node scripts, which start none either); an integration test needs git, a browser or another external tool, and its file is named `*.integration.test.mjs` or lives in a plugin's `integration-tests/`. `bun run test:unit` runs ALPS and the ADR, ontology and DeepEval unit tests; `bun run test:integration` runs the rest. Keep git and file-system special cases to one representative test per kind. `bun run test` checks generated assets and synchronized guidance, runs ALPS, then schedules ADR, DeepEval and browser test files together in one Node worker pool. This overlaps independent tests without multiplying the CPU-based worker limit across separate runners. `bun run test:workspace` runs the same checks and installed-dependency suites; CI runs the dependency-free ADR and ontology suites with no install, the ADR unit tests in `build` before its install and the rest in `runtime`. Each test file retains process isolation and every suite failure blocks success.

**Behaviour evals** (`plugins/adr-writer/evals/`) are separate and NOT in `bun run test`. `bun run test` proves a prompt _says_ something; the evals check whether an agent given that prompt _does_ it, by running real scenarios against a live model and reporting per-check hit rates. They cost money, take minutes, and are non-deterministic, so they never gate CI — their job is reproducing a reported defect (`node evals/run.mjs --live --only <name> --runs 10`) and telling you whether it happens 3/10 or 10/10, which decides the fix. Use `node evals/run.mjs --changed <base> --list` to preview the disposable impact-map selection for a branch without invoking a model. The harness itself _is_ covered by `bun run test` via a stub agent, because an eval whose scorer cannot tell a bad reply from a good one reports green and is worse than no eval. See `plugins/adr-writer/evals/README.md`.

`bun run eval:skills` is the unified workspace entry point for classification,
controlled Skill routing and actual document-operation evaluation. Preparation is
the default and makes no model calls; `--live` is explicit. Execution comparisons
keep task contracts and verifiers fixed while varying instruction access.
`bun run eval:llm` selects the classification suite: all LLM response probes use
DeepEval GEval, with mechanical artifact/action checks retained as independent gates; natural-language word/phrase and evaluation-tail scores are not runtime gates.
The authored scenario description supplies the default semantic obligation;
explicit obligation arrays take precedence and never invoke a second legacy judge.
`bun run eval:skills --live --rejudge <run-directory>` reuses saved target evidence with the current GPT-6.1 judge and current mechanical checks, preserves original results and labels grading-policy changes.
`bun run eval:report` regenerates both unified and legacy DeepEval HTML without model
calls. The source and usage contract are in `plugins/adr-writer/evals/skills/`.
Workspace-only integration tests in `evals/deepeval/skills.integration.test.mjs` use the real
DeepEval SDK with stub providers; dependency-free metric tests stay in `tests/`.

The rollup/sync artifact regression path uses `bun run eval:regression` with DeepEval GEval.
The judge defaults to Bedrock `us.openai.gpt-6.1-sol`, explicit AWS profile `default`,
and region `us-east-1`; `--model` selects only the Claude Code target agent.
Its fixture tool boundary, live opt-in, framework integration, and HTML report workflow
are documented in `plugins/adr-writer/evals/deepeval/README.md`. `test:deepeval` is a
workspace-only SDK integration suite included in `bun run test`; the bare-Bun runtime
suite remains dependency-free. `bun run eval:custom` retains the earlier grader.
`eval:golden` exports the 11-case corpus and pinned provenance without model calls.
`eval:calibration` checks the judge against 37 authored examples; labels are explicit
AI drafts until human review, and their agreement is not human-ground-truth accuracy.

## Repository Structure

```
.claude-plugin/
└── marketplace.json      # Marketplace manifest — registers the three plugins
.agents/plugins/
└── marketplace.json      # Codex marketplace manifest
package.json              # Private workspace root (prettier/husky/lint-staged); version pinned 0.0.0
bun.lock                  # Bun lockfile (workspace: plugins/alps-writer)
bunfig.toml               # bun test preloads (git shim, timezone)
.github/workflows/
├── ci.yaml               # Bun test/build/runtime jobs + dist-drift gate; a main push reuses its PR's pass
└── release.yaml          # After CI passes on main, tags a new version and publishes its release
scripts/
├── bump-version.mjs      # Set/verify the release version across all 16 sites
└── publish-release.mjs   # The Release workflow's tag-and-publish step
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
├── skills/               # adr-import, adr-new, adr-impl, adr-impl-refactor, adr-impl-review, adr-sync, adr-rollup, report-writer
├── agents/               # ADR authoring reviewer + isolated refactor/impl explainer/review/report roles
├── evals/                # behaviour evals (real model; NOT in bun run test)
│   ├── run.mjs           # runner — N runs per scenario, hit rates, shareable report
│   ├── lib/harness.mjs   # fixture builder + scorers; passes the REAL skill/agent text
│   └── scenarios/        # one reproducible situation each
├── scripts/              # deterministic checkers (standard built-ins / bash only)
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
├── references/business-context.md # how ADR work uses a business ontology's context (never reads the model)
└── templates/adr/
    ├── README.md         # ADR concepts (copied into docs/adr/ on /adr-new)
    ├── authoring-rules.md, structure.md
    ├── decision-log.template.md  # Seed for a category's decision-log.md
    └── mapping.schema.json   # Schema for docs/adr/.mapping.json

plugins/ontology-writer/  # Business ontology plugin (optional level above ADRs)
├── .claude-plugin/plugin.json   # Claude metadata; hooks/ is auto-discovered
├── .codex-plugin/plugin.json    # Codex metadata; registers skills + hooks
├── README.md
├── skills/               # ontology-edit, ontology-sync, ontology-align, ontology-build, ontology-view, report-writer
├── scripts/              # deterministic tools (standard built-ins only)
│   ├── ontology-lib.mjs      # vocabulary, Turtle subset, closed-world checks, canonical form, diff
│   ├── ontology-fs.mjs       # model documents + ADR index-link findings
│   ├── ontology.mjs          # CLI: validate, format, diff, query, impact, apply, transition, align, view …
│   └── adr-lint-lib.mjs, adr-status-transition.mjs, adr-impl-review-open.mjs  # adr-writer copies (sync-shared-scripts.mjs)
├── hooks/
│   ├── hooks.json        # SessionStart registration
│   └── surface-business-context.mjs  # SessionStart — ask for the business-context query when an index and a model exist
├── references/ontology.md   # ownership, vocabulary, validation
└── templates/ontology/
    ├── vocabulary.ttl    # RDFS vocabulary of the business ontology (never copied into docs/ontology)
    └── example.ttl       # canonical example model
```

The ontology's purpose is to capture actual business workflows accurately and
richly so their business logic reaches ADR contracts, code and tests. A perfect
ontology or inference capability is not the objective. Build from evidence-based
EventStorming: a whole-scope event map first, then bounded contexts and subdomains,
then confirmed model facts and feature-level ADR contracts. Capture relevant
exceptions, decisions and their reasons, manual/external hand-offs and unknown
scope. Preserve exact requirements at their owning level; abstraction never
justifies losing a business obligation. Judge completeness by the context needed
to implement and verify the workflow. Keep model sufficiency, ADR contract
readiness and actual execution evidence separate.

Construct ontology knowledge in layers, not merely its query presentation.
The small upper layer contains BCs only: responsibilities, authored core business
logic and declared collaborations. Internal workflows belong to the heavier BC
knowledge layer and connect through context membership. Read the whole upper
layer before selecting and searching a BC; known targets can be queried directly.
`coreLogic` and `collaboratesWith` are model facts, not generated summaries.
Construction uses `--require-layers` (and `--layer-context` for scoped work), while
legacy gaps remain readable and explicitly incomplete. C4 and HNSW motivate this
resolution and retrieval strategy; no approximate vector index is implied.
The saved-model UI follows the same BC-first hierarchy through a 3D BC map,
camera descent into the selected BC's current search page, and element detail.
Spatial and list views share scope, paging and navigation state; transitions
honor reduced motion and stop while hidden. Internal scenes are created on
selection. Whole event flow and its 3D structure are opened explicitly; their
renderers remain idle on the initial BC screen.

The plugins are split so adr-writer never references ALPS or reads the business ontology. The couplings run one way, from the upper level down: alps-writer's `/feature-to-adr` transfers each implementable Feature's complete contract into one or several ADRs and delegates each new decision owner to adr-writer's `/adr-new`; ontology-writer writes the ADR index's `realizes` links in the same change unit as the model and hands a model change's ADR revisions to adr-writer's `/adr-new` draft rules and `/adr-impl`. Normal implementation then reads only ADRs; explicit PRD re-import remains an alps-writer-side semantic comparison. adr-writer knows the model only as the shape of `realizes` and, when model documents exist, one session-directive line saying that business context is checked through ontology-writer. ontology-writer runs copies of three adr-writer scripts (reading the ADR index and Status, recording a Status transition, opening a report), refreshed by `scripts/sync-shared-scripts.mjs` and checked in `bun run test:checks`.

Shared authoring guidance is owned by `plugins/adr-writer/references/`:
`requirement-delegation.md`, `comprehension-load.md`, `feature-boundaries.md`, and
`outcome-evaluation.md` are copied into
alps-writer's own `references/` by `scripts/sync-authoring-guidance.mjs`.
Both packages use plugin-local references rather than assuming sibling install
directories. Build synchronizes them; `authoring-guidance:check` rejects drift.

Acceptance evaluates the intended outcome before implementation; improvement
signals remain distinct. Propose meaningful tension metrics that expose harm from
over-optimizing a primary metric, without a mandatory count or a blocker when
none is suitable. Distinguish monitoring signals from confirmed required
conditions; only the latter are gates, and primary gains never cancel their
violations. Full uses 7.x.6 Evaluation Rubric: Ideal Cases and Edge Cases retain inputs,
observations and decision rules; Automated Evaluation Metrics connects their
results to calculations, scope and useful eval/tension pairs. Existing Acceptance
Criteria headings remain readable without an automatic migration.
Code comparisons, actual user-entry evidence and LLM meaning judgments serve
different obligations; only aggregation of fixed inputs is deterministic. Missing
required evidence remains unverified. Lite uses impact signals in 1.2, experience
outcomes and optional improvement signals in 2.2, and initial pass/fail observations
in 4.1, preserving its four Sections and approval units.

ADR folders are organized along two axes — a DDD **bounded context** (top-level folder / first key segment) containing one or more **features** (vertical slices, the second segment). A single-feature context stays flat (`auth/`, workshop `f1/`), so existing flat repos need no migration. The ADR index lives in `docs/adr/.mapping.json` itself (path/status/summary per ADR), and admitted work reads it on demand; the README keeps no separate ADR list. The mapping carries an optional advisory `subdomainType` (core/supporting/generic) per context and stores no PRD reference. Context discovery is the default for product and ADR authoring. Inspect repository organization separately from execution/deployment shape, then group by business language and rule ownership, not service or technical-layer folders. Preserve confirmed grouping; propose grounded candidates when absent and confirm only material ambiguity. `/feature-to-adr` preserves that meaning in plugin-local guidance, while adr-writer stays independent of the PRD. Category keys remain at most two segments; a valid single-feature context can stay flat. Code refactoring or moving existing ADRs requires its own authorized scope.

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

**Document selection** — Every document-specific MCP request requires `doc_path`. The controller creates a request-scoped DocumentService, sharing only template metadata; the service validates that path before the operation. Prior init/load calls never select a default for another request. Existing documents can be read or changed on a fresh connection without an earlier load. Missing/invalid targets and document validation errors return MCP `isError: true`.

**Evidence research** — After Full's nine Sections or Lite's required Sections
1, 2, and 4 are approved and written, offer one optional deep-research review of
the selected document's evidence and errors. Reuse an explicit research request
or answered choice in the current conversation. Unwritten optional Lite Section 3,
a decline, deferral, unanswered invitation, or research failure does not change
completion. `alps-research` prefers an available built-in deep-research capability,
then uses the agent's web search and source reading, falling back to connected
DuckDuckGo MCP when search is unavailable or fails. Discover actual capabilities;
do not configure providers or install a server. Review real document items,
distinguish factual errors and evidence gaps from goals/policies, and connect
findings to verified sources and proposed corrections. Research is read-only;
selected edits use existing approval units and explicit document targets. Keep
research artifacts disposable and retain the existing post-handoff boundary.

**Optional glossary** — Both profiles keep their numbered Sections unchanged and
append a glossary only when qualifying jargon, uncommon terms/acronyms, or
expressions that cannot be written out plainly need confirmed definitions. Ask
for unclear meanings at first use; reuse supplied meanings and the current
Section approval. `read_alps_glossary` and `save_alps_glossary_entry` operate on the
explicitly selected document. The optional XML glossary follows all Sections, survives later
saves and reloads, and exports last. Never pre-seed a dictionary or add a separate DDD exercise for glossary maintenance.

`/feature-to-adr` transfers needed definitions to `docs/adr/glossary.md` unless a
current reference level such as the business ontology owns the term, in
which case it routes a change proposal to that level; ADR authoring creates or
updates the glossary under the existing approval when needed.
Equivalent meanings are no-ops, unrelated entries are preserved, and conflicting
meanings are resolved before replacement. This file is supporting material at the
ADR level, without Status or mapping registration; contract rules remain in the
owning ADR body. Consumers read it selectively.

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

- **alps-writer** runs its MCP server from the committed bundle plus its local `skills/`; no npm/bunx is required.
- **adr-writer** ships local `skills/`, `agents/`, `hooks/`, and `templates/adr/`. Codex requires users to review and trust the bundled hook before it runs. No MCP.

The hook script (in adr-writer) is ESM (`.mjs`) and reads NDJSON events from stdin per the Claude Code hooks spec. The hooks configuration runs it with Bun; it uses only built-in modules (no extra deps), so the plugin requires nothing beyond Bun >= 1.4.2.

### Proportional implementation and review

An unchanged approved implementation proceeds at every comprehension-load score;
high load can prompt non-blocking split guidance. Independent Implementation
Hills may run in parallel/batches or become the primary work while another
verifies. Actual prerequisites and shared-resource conflicts retain their order.
Review mode uses changed protected surfaces and actual impact, not existing
implementation breadth. Standard can use a short Context, capability claims,
complete contract coverage and direct code evidence; detailed zooms are optional.
Selected rich interactions keep their existing delivery route. Compact standard
can render the final shared-report HTML directly from validated native artifacts.

### Shared report-writing skill

`shared/report-writer/` owns the common English skill, editorial guidance, formatting
rules, and dependency-free report helper. Mermaid syntax is checked with a vendored official parser;
HTML embeds the official browser engine and reports pending, rendered or failed
status honestly. The parser needs no runtime package installation, and the embedded engine loads
without network access. `scripts/sync-report-skill.mjs` copies the skill into
adr-writer and ontology-writer; the ADR diagram module and the process view use that same
implementation.
Edit the canonical source, then synchronize. `report-skill:check` rejects drift.
The responsive article layout lives in `scripts/report.css` within the skill;
code evidence rendering uses vendored diff2html and stays static in the delivered
HTML. `bun run report-assets:sync` refreshes the upstream bundle, stylesheet and
licenses from pinned development dependencies; `report-assets:check` checks
their bytes. The Mermaid assets include the browser engine and a parser bundle for the CLI runtime
with its DOM implementation and license notices. `bun run test:report-rendering`
checks actual SVG notation in an isolated headless browser and runs in `bun run test`.
It uses an installed Chrome/Chromium or `MERMAID_BROWSER_PATH`; marketplace runtime
and the bare-Bun test suite do not require a browser executable. Build refreshes those assets before synchronizing the skill. Keep
upstream assets unformatted and committed so marketplace installs and bare-Bun
tests need no package installation. Code diffs use the existing evidence controls
for screen disclosure and print inclusion; long lines wrap in print.
Use `--global` only when updating the user-level `~/.agents/skills/report-writer`;
normal builds never write to the user's home directory.

Review reports and supporting artifacts belong in a unique per-run directory
under `.adr-review/`, which is excluded from Git and formatting. Keep HTML,
Markdown, JSON, and reproduction evidence together; never store them in `docs/`
or the ADR index. Consumer projects follow the shared skill's local ignore
setup so review-only runs do not modify tracked configuration. Existing runs
remain available until the user chooses to remove them.

Only adr-writer includes report-writer and advertises it through SessionStart
independently of the ADR mapping. ontology-writer carries a copy of the report-writer
skill for its own reports but registers no report hook, and ALPS Writer has no report
skill, report hook, or report-writer dependency; so the report directive still
appears once per session event. Select a report for explicit report requests or
when complex explanations and review findings need structured depth to be understood.
Answer short, simple requests in chat without report files, browser opening or quizzes.
If report usefulness is unclear, ask once before generating it, reuse the user's
choice for the same scope and continue independent work while waiting. Technical
subjects, review labels and length alone do not require reports. Preserve artifacts
explicitly required by a specialized workflow the user selected; do not infer that
requirement from a task label. The owning workflow still controls inspection,
verdicts, severity and edit permissions. The packaged skill directory
can also be installed independently with `bunx skills add`; see README for the
explicit source path. Native review schemas remain complete audit input, while final
reports use domain-scoped hierarchy, at most four child explanation branches, readable paragraph
breaks, evidence-grounded diagrams, worked calculations, and whole-output review.
The renderer validates structure and source coverage; semantic review remains a
separate, explicitly reported step.

Reports include useful figures whenever evidence and format support them, from
the overview through the deepest explanation. Whole-system and multi-step
processes prefer a Mermaid overview after the brief background and answer, then
expand the same responsibilities. Figures are never a delivery gate, including
for top-down, C4-like or drill-down requests. Honor diagram exclusions and format
constraints; use prose with material limitations when a figure is not feasible.
Validate supplied figures and review their meaning separately from their presence.

Once a report is selected, default to standalone HTML. After
final verification, open the nonempty file once in the operating system's default
browser and return its absolute path. Explicit format or delivery constraints
take precedence. Keep native Markdown/JSON as supporting artifacts. Do not open
drafts or create an automation browser or local server merely to display a file.
If opening fails, preserve the HTML and report the path and actual reason.
Ordinary completion notices need no new report.

Report openings place separate localized `Purpose` and `Context` sections
(`목표` and `배경` in Korean) directly below the title, in that order.
Purpose states what this report should enable the reader to understand, decide,
explain or do. Context describes the confirmed situation, problem and request
trigger, with relevant scope and priorities. The answer and material limitations
follow immediately in their own display area; domain openings state their outcome
before behavior and evidence. Subsequent headings and organization follow the
report's subject and reader questions; preserve mandatory content without a fixed outline.
Collapsed branches explain
what opening them will clarify. Sources and quizzes support their owning
explanation without consuming its four-child allowance; both output formats
place child explanations before the parent's quiz and source evidence. Review
what the reader learns with details closed and after opening one branch.
ADR writing preserves its required sections: Purpose introduces the problem,
intended outcome, and direction; the adjacent Decision Drivers retain all current
selection criteria; Decision owns the full choice, rationale, and exact contract.
Current reasons remain in the body even when the log records their role in a
major transition. Review both the opening alone and the whole document. The ADR reading
order is owned by `plugins/adr-writer/templates/adr/authoring-rules.md`; report
presentation is owned by `shared/report-writer/`.

Intent is durable judgment context for details an agent must decide autonomously.
Preserve the user's problem, intended outcome, and supplied priorities or scope
so a plausible local choice does not pursue a different purpose. Purpose and the
exact contract bound those choices; project conventions and convenience do not
override intent. Reversible details within the contract and authorized scope can
be chosen without routine approval. Intent does not authorize new policy or scope;
ask only when a material choice remains unresolved. This interpretation boundary
is not a new DDD context, fixed writing framework, schema, or approval registry.
Reports show how material autonomous choices and evidence serve that intent.
ADR readers and structure checks accept legacy `Context` as the Purpose section;
agent context, bounded contexts, and C4 Context views retain their names.

HTML reports actively use local interactive explanations when responsibility
expansion, condition changes or case comparisons help understanding. Preserve the
same subject from whole to roles and concrete behavior; topic tabs and control
counts alone do not establish depth. Keep exact source evidence, visible limits,
keyboard access and a static/print reading path. Interaction does not imply new
service execution or measured learning. The shared interaction reference owns
composition and verification guidance.

The shared report skill strongly recommends core-content comprehension quizzes
when useful; generation is not mandatory. Honor explicit inclusion or exclusion;
otherwise decide by reader value without an approval or required omission record.
When included, generate one to five medium-difficulty questions with four choices
and one answer each. The renderer validates and displays staged self-check and
print-safe answer hiding. Implementation review retains its native audit schema
and PR-readiness rules. Paragraph count is unrestricted; the four-child limit
applies to independent explanation branches. Default delivery uses semantic and
static artifact checks; browser interaction and actual print inspection run on
request and their actual coverage is reported.

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

These are automated in two places, so the list above is what you run locally to
avoid a round trip — not the only thing standing between a bad commit and `main`:

- **`.husky/pre-push`** — the fast part, all blocking: the generated-asset checks,
  `bun run test:unit`, `lint`, `format:check`, `bump:check`, the committed-bundle boot
  and hook-start checks, and the dist-drift rebuild with its typecheck. Every static
  check CI runs is here, so a push is not red on GitHub over a lint or formatting
  problem already sitting in the tree; the integration tests are left to CI, whose
  required jobs run them on every pull request (`bun run test:integration` runs them
  locally). `SKIP_TESTS=1 git push …` bypasses only the unit tests for a
  knowingly-red WIP branch and is rejected when the push updates `main`; every
  other check always runs.

  Ordering matters in one place: the bundle-boot check runs **before** the
  `bun run build` rebuild, so it judges the bundle being pushed rather than one just
  regenerated. With the checks the other way round a hand-edited or truncated
  `dist/` passed, because the file under test was no longer the file in the commit.
  The checks that only read the tree (lint, formatting, versions, bundle boot,
  hook start) run while the unit tests run and report after them in that order;
  the rebuild rewrites generated files the tests check, so it waits for the tests.

- **`.github/workflows/ci.yaml`** — three jobs, all on Bun 1.4.2 (the declared floor), with no Node.js setup. `test` runs
  `test:workspace`; `build` adds lint, `format:check`, `bump:check`, and a rebuild
  that fails if the committed `plugins/alps-writer/dist/` differs; `runtime` runs
  the complete ADR suite once and checks consumer entry points with **no install step**. The hooks only exist for someone who
  ran `bun install` and can be skipped with `--no-verify`, so CI is the gate that
  actually holds.

- **GitHub ruleset** — `main` requires a pull request and successful `test`,
  `build`, and `runtime` checks. Local hooks are feedback; the remote ruleset is
  the final publication boundary.

**Why Bun only.** Users run the MCP server, hooks and plugin scripts with Bun,
so the repository installs (`bun install`, `bun.lock`), tests (`bun test`),
typechecks, bundles and releases with the same Bun — no Node.js or pnpm
anywhere. CI pins `setup-bun` to the declared floor (`engines.bun >= 1.4.2`) so
the floor is the version actually verified. Bun overrides name a package, not a
version range, so each security floor in `package.json` applies to every copy of
its package; the `//overrides` note records the one that crosses a major version
(protobufjs) and the tests that exercise it.

The `runtime` job still exists because installing is not the same as shipping: a
marketplace install has no `node_modules` at all — the MCP server is a bundle with
dependencies inlined, and the plugin scripts and hooks use built-in modules only.
The manifests, hook configurations, skill commands and script shebangs name
`bun`. The job runs an MCP `initialize` round-trip against the committed bundle
and the `SessionStart` hooks under a bare `bun`, and the dependency-free suites
with nothing installed. The installed jobs cannot catch a break there, since they
always have a populated `node_modules`.

### Local decision and ontology search

ADR search and the ontology CLI run with Bun like every shipped script. The canonical module `shared/search/search-text.mjs`
is copied into each plugin by `scripts/sync-search.mjs`. Build synchronizes it and
`search:check` rejects drift, so neither plugin imports a sibling installation.

Search keeps no index or cache. Every query ranks the units it has just read from
the current files — the ontology CLI already parses the whole model for its graph
and diagnostics, and ADR search already reads every registered document for Status
and diagnostics — so an index would save little and add freshness checks,
rebuilds and corruption recovery. Measured against the removed SQLite FTS5 index,
the direct computation returned identical results and was faster. Revisit only
when parsing the sources themselves becomes the bottleneck; that is a change of
the storage design, not a search index.

Unquoted terms all match one unit in any order; quoted phrases remain adjacent.
Normalize compatibility forms, case and whitespace; preserve short Korean and
substring matches. The CLIs and the saved-model browser use the same pure
matching/ranking module. BM25 ranks body relevance below direct
identifier/title matches. Search does not replace full mapping/ADR reads or
the ontology's mandatory relationships, scope diagnostics and BC-only overview.

New Bun command tests belong to integration tests; pure ranking tests remain
dependency-free unit tests. The runtime CI job installs Bun and checks the
shipped scripts without npm dependencies.

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
- Do not modify `dist/` directly — always generate via `bun run build`
- Do not bypass git hooks with `--no-verify`
- Do not delete or modify tests to make them pass — fix the code instead

## References

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Commit messages, branching, code style, PR rules

### Existing-project onboarding and maintenance questions

`adr-import` reads local project evidence, distinguishes repository organization
from execution/deployment shape, and proposes business-context/vertical-feature
ADR contracts through four reviewable views: business workflows/events, context
boundaries, decision candidates, and contract prerequisites. Source discovery
starts from important business outcomes and deepens incrementally. Each
prerequisite edge identifies a required guarantee; interaction timing is not a
dependency. Decision-level graphs remain disposable report evidence and are
checked against the category-level `dependsOn` representation before saving.
On a cycle, `import-cycle-resolution.md` compares three contract-level options:
independent shared concept, one-decision merge, or orientation around an existing
owner. Concrete drafts and ownership changes are prepared before all pending
questions are collected once by domain/bounded context; a cross-context cycle
is reviewed once. Implementation interfaces and renamed links are not substitutes
for resolving decision contracts.
It uses `feature-boundaries.md`, `decision-reconciliation.md` and
`decision-questions.md` from adr-writer's local references. Missing intent and
conflicts are presented together with visible decision IDs; confirmed answers
resume authorized application and validation. New ADRs stay Proposed until the
completion cycle passes; identical re-imports are no-ops. No application refactor,
live-system access, hidden approval registry or code-path mapping is introduced.
Sync and rollup share that question flow, preserving their own mutation limits.

Rollup uses target-centred discovery: selected ADRs, complete candidate chains
and related contracts first, then only the source/tests or farther references
needed for an actual ownership, conflict or reference question. It reuses
unchanged evidence and does not require whole-system event/context maps. Clear
chains use contract tables and summaries; difficult cases may need small local
diagrams. Global mechanical checks, original contract preservation, exact
approval and pre-apply freshness checks remain required.
Rollup leaves tool choice and equivalent local verification methods to the
agent. Command examples are available implementations; evidence, check results
and mandatory approval/history/freshness boundaries determine correctness.
Requested renumbering details live in its conditional skill-local reference.
