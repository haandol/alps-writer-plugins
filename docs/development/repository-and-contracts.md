# Repository and cross-plugin contracts

Read this guide when the matching task in `AGENTS.md` applies. Paths and commands
refer to the repository root unless a different base is stated.

## Repository Structure

```
.claude-plugin/
└── marketplace.json      # Marketplace manifest — registers the three plugins
.agents/plugins/
└── marketplace.json      # Codex marketplace manifest
package.json              # Private workspace root (prettier/husky/lint-staged); version pinned 0.0.0
bun.lock                  # Bun lockfile (workspace: plugins/alps-writer)
bunfig.toml               # Bun runs package bins; bun test preloads (git shim, test environment)
stubs/                    # Empty stand-ins for dependencies' unused packages (see //overrides)
.github/workflows/
├── ci.yaml               # Bun test/build/runtime jobs + dist-drift gate; a main push reuses its PR's pass
└── release.yaml          # After CI passes on main, tags a new version and publishes its release
scripts/
├── bump-version.mjs      # Set/verify the release version across all 16 sites
└── publish-release.mjs   # The Release workflow's tag-and-publish step
.adr-invariants-code-ignore # Self-hosting exclusions for code→ADR example scanning

plugins/alps-writer/      # PRD plugin (bundles + commits its own MCP server)
├── .claude-plugin/plugin.json   # declares the MCP server; Claude Code discovers skills/
├── .codex-plugin/plugin.json    # Codex metadata; registers skills + .mcp.json
├── .mcp.json                    # Codex MCP command (bun ./dist/index.js)
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
├── skills/               # alps-init, lite-alps-init, alps-research, feature-to-adr
└── templates/alps/       # about-alps.md

plugins/adr-writer/       # ADR plugin (standalone, ALPS-agnostic)
├── .claude-plugin/plugin.json   # Claude metadata; hooks/ is auto-discovered
├── .codex-plugin/plugin.json    # Codex metadata; registers skills + hooks
├── README.md
├── skills/               # adr-import, adr-new, adr-impl, adr-impl-refactor, adr-impl-review, adr-review, adr-search, adr-sync, adr-rollup, report-writer
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
├── skills/               # ontology-edit, ontology-sync, ontology-align, ontology-build, ontology-view, report-writer, reader-profile
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

The ontology represents actual business workflows and responsibility boundaries.
Its purpose follows Domain-Driven Design: guide that business structure through
feature-level ADR contracts into code organization, behavior and tests. Existing
functional ADRs, services and source folders do not define the business units;
discover the business structure first and connect its realizing features below it.
The plugin-specific core intent lives in `plugins/ontology-writer/AGENTS.md`.
A perfect ontology or inference capability is not the objective. Build from evidence-based
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
The saved-model UI follows one hierarchy: domain/BC → business process →
realizing functional ADR. EventStorming and 3D share scope, search, paging,
selection and return state. Processes come from the business model and retain
shared participation; ADR categories supply realization links, not business
containers. Category-level links disclose their precision. Only the selected
layer and requested detail are instantiated, and indexed ADR Markdown is read
inside its real document root. Navigation ends at the ADR contract. Transitions
honor reduced motion and stop while hidden. Explicit draft and supplied board
inputs remain read-only and do not adopt the model.

The plugins are split so adr-writer never references ALPS or reads the business ontology. The couplings run one way, from the upper level down: alps-writer's `/feature-to-adr` transfers each implementable Feature's complete contract into one or several ADRs and delegates each new decision owner to adr-writer's `/adr-new`; ontology-writer writes the ADR index's `realizes` links in the same change unit as the model and hands a model change's ADR revisions to adr-writer's `/adr-new` draft rules and `/adr-impl`. Normal implementation then reads only ADRs; explicit PRD re-import remains an alps-writer-side semantic comparison. adr-writer knows the model only as the shape of `realizes` and, when model documents exist, one session-directive line saying that business context is checked through ontology-writer. ontology-writer runs copies of three adr-writer scripts (reading the ADR index and Status, recording a Status transition, opening a report), refreshed by `scripts/sync-shared-scripts.mjs` and checked in `bun run test:checks`.

Shared authoring guidance is owned by `plugins/adr-writer/references/`:
`requirement-delegation.md`, `comprehension-load.md`, `feature-boundaries.md`, and
`outcome-evaluation.md` are copied into
alps-writer's own `references/` by `scripts/sync-authoring-guidance.mjs`.
Both packages use plugin-local references rather than assuming sibling install
directories. Build synchronizes them; `authoring-guidance:check` rejects drift.

PRDs and ADRs record evaluation so an agent can judge its own work against the
business intent. A metric is only a proxy for that intent, and optimizing it alone
can raise the score while defeating the purpose; a tension metric protects the
same purpose and worsens when the primary metric is pushed up through a shortcut.
Acceptance evaluates the intended outcome before implementation; improvement
signals remain distinct. Users rarely think of tension metrics, which come from
abuse and opposite-failure scenarios, so agents always propose one for every
primary metric: product KPIs (Full Sections 2 and 8, Lite 1.2) and Feature or
experience metrics. The user decides adoption; a declined candidate never blocks. `/feature-to-adr` carries each pair, its
protected purpose and required-or-monitoring meaning into the owning ADR's
Observable evidence, so implementation compares both without the PRD. Distinguish monitoring signals from confirmed required
conditions; only the latter are gates, and primary gains never cancel their
violations. Full uses 7.x.6 Evaluation Rubric: Ideal Cases and Edge Cases retain inputs,
observations and decision rules; Automated Evaluation Metrics connects their
results to calculations, scope and eval/tension pairs. Existing Acceptance
Criteria headings remain readable without an automatic migration.
Code comparisons, actual user-entry evidence and LLM meaning judgments serve
different obligations; only aggregation of fixed inputs is deterministic. Missing
required evidence remains unverified. Lite uses impact signals in 1.2, experience
outcomes and optional improvement signals in 2.2, and initial pass/fail observations
in 4.1, preserving its four Sections and approval units.

ADR folders are organized along two axes — a DDD **bounded context** (top-level folder / first key segment) containing one or more **features** (vertical slices, the second segment). A single-feature context stays flat (`auth/`, workshop `f1/`), so existing flat repos need no migration. The ADR index lives in `docs/adr/.mapping.json` itself (path/status/summary per ADR), and admitted work reads it on demand; the README keeps no separate ADR list. The mapping carries an optional advisory `subdomainType` (core/supporting/generic) per context and stores no PRD reference. Context discovery is the default for product and ADR authoring. Inspect repository organization separately from execution/deployment shape, then group by business language and rule ownership, not service or technical-layer folders. Preserve confirmed grouping; propose grounded candidates when absent and confirm only material ambiguity. `/feature-to-adr` preserves that meaning in plugin-local guidance, while adr-writer stays independent of the PRD. Category keys remain at most two segments; a valid single-feature context can stay flat. Each context's ADRs, read with the code they govern at any snapshot, must explain each other without another context's documents, the root mapping or another repository: a dependent ADR records what it relies on from another context, repository or external system under Relied-on boundary, the providing ADR stays the owner, and in a multirepo system each repository keeps the ADRs for its own code. The mapping is a derived index. A context's own `<context>/glossary.md` holds the meanings it uses; the root glossary keeps terms that mean the same everywhere. An edit to an implemented contract reaches the shared branch with its code in one change unit. This holds with ADRs alone; a business ontology, when present, helps verify the boundaries against the cross-context flow. Code refactoring or moving existing ADRs requires its own authorized scope.
