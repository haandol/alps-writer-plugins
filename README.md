# ALPS Writer Plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A Codex and Claude Code **marketplace** that ships two independent plugins for spec-driven development: **alps-writer** (PRD authoring) and **adr-writer** (ADR-driven cycle). Both install from the marketplace alone — **no npm, no npx, no build step** for end users. The alps-writer MCP server is bundled (dependencies inlined) and committed at `plugins/alps-writer/dist/`.

| Plugin                  | Scope                                                                                                                          | Depends on                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **`alps-writer`** (PRD) | Write Full ALPS or lightweight mockup/PoC product documents conversationally. Bridges Full ALPS Section 7 features to ADRs.    | adr-writer (only for the bridge) |
| **`adr-writer`** (ADR)  | ADR-driven development: author, implement, adversarially review, and sync; an ADR-first hook runs when session context starts. | nothing — fully standalone       |

The two are split so that **adr-writer never references ALPS**. The only coupling is one-way (`alps-writer → adr-writer`): `/feature-to-adr` transfers each implementable Feature's complete contract into one or several ADRs. After handoff the PRD remains a legacy planning document; explicit re-import compares it with authoritative ADRs and applies only approved semantic changes.

## A removable, non-invasive harness

The plugins are management harnesses, not an additional authority layer. Product
intent remains in PRDs, admitted architecture decisions and requirement
contracts remain in ADRs, implementation truth remains in code and tests, and
repository conventions remain in README/AGENTS/CONTRIBUTING. Removing either
plugin leaves those artifacts readable and useful to a future model without
hidden plugin state.

Skills and hooks constrain observable artifacts, external actions, evidence,
approval boundaries, and Status transitions. They do not require private
chain-of-thought or prescribe how a model must internally reason. The active
model chooses action-level orchestration—whether to use no subagent, one, or
several; named or generic agents; parallel or sequential execution; and the
available model for each role—while preserving the same user-visible workflow.
Comprehension-load behavior, dependency gates, risk-selected reviews, Evidence
Packages, and completion rules remain stable regardless of that orchestration.

## The core rule: preserve reproducible conditions, not recoverable facts

The system persists only information whose loss would make a future
implementation violate human intent, an admitted decision, or a requirement.
It does not persist a second copy of facts that an agent can recover by reading
code, tests, dependency metadata, or deterministic tool output.

Apply the tests in this order:

1. **Requirement gate** — if the fact disappeared, could regenerated code violate
   a required value, state, permission, ordering rule, failure guarantee,
   boundary, or success condition? If yes, preserve it at the level that owns
   the contract.
2. **Code-readthrough test** — if the fact is not a requirement and an agent can
   recover it from the implementation, leave it in code and tests.
3. **ADR admission gate and litmus test** — if code cannot explain why one
   durable alternative was adopted and changing the fact would change the
   architectural decision, preserve the decision, rationale, trade-off, and
   decision-changing assumptions in an ADR.

“Reproducible” does not mean recreating the same files, functions, libraries, or
module layout. It means a different implementation can be generated while still
honoring the same observable product behavior and architectural constraints.

| Level             | Persist                                                                                                                                    | Do not persist                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| ALPS PRD          | user problem, observable outcomes, product contracts, success conditions, explicit non-goals, durable system constraints                   | code paths, stack inventories, implementation plans, copied tickets/logs     |
| ADR               | admitted decision, exact requirement contract, rationale, alternatives, durable boundaries, implementation-independent observable evidence | libraries, SDKs, signatures, field tables, tuning values, internal call flow |
| Code and tests    | implementation structure, identifiers, dependencies, tuning, enforcement, executable verification                                          | PRD or ADR back-references                                                   |
| Issue, PR, commit | change-specific intent and verbatim history                                                                                                | a competing source of product or architecture truth                          |

Plans, search results, mapping snapshots, approval views, reviewer transcripts,
eval results, and derived evidence packages stay disposable because the
authoritative artifacts can reproduce them.

## What is ALPS?

**ALPS** (Agentic Lean Product Spec) is a PRD format built for agentic development. A traditional PRD assumes a human reader who fills in gaps from intuition; ALPS assumes an AI agent that needs an unambiguous specification to write reliable code.

It fixes the format (9 sections, explicit dependencies, vertical-slice features) and inverts the authoring loop: the **agent asks focused questions, the human answers**, with no section saved without confirmation. Out of Scope is a first-class section so the agent knows what _not_ to build.

**Lite ALPS** is a 4-section working-backwards simplification of Full ALPS for planners and PMs defining a minimum PoC. The user first confirms the target problem and Desired Business Impact; AI then proposes the minimum solution, a product-level C4 Context diagram, Essential User Experiences, and a concrete executable Demo Scenario for approval. Unwritten optional scope is omitted from Markdown. Lite and Full keep independent files, state, and completion.

See [`about-alps.md`](./plugins/alps-writer/templates/alps/about-alps.md) for the full design rationale and how ALPS feeds into the ADR-driven cycle.

## Quick Start

Register this repository as a marketplace, then install whichever plugins you want. They are independent — install one or both.

**Codex**

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add alps-writer@alps-writer
codex plugin add adr-writer@alps-writer
```

Invoke skills with `$alps-init`, `$lite-alps-init`, `$feature-to-adr`, `$adr-new`, `$adr-impl`, `$adr-impl-refactor`, `$adr-impl-review`, `$adr-review`, `$adr-sync`, and `$adr-rollup`, or ask for the workflow in natural language. On first use, review and trust ADR Writer's single `SessionStart` hook when Codex prompts you. It restores context on startup, resume, clear, and compaction; it does not run for every user prompt.

**Claude Code**

```
/plugin marketplace add haandol/alps-writer-plugins
/plugin install alps-writer@alps-writer   # PRD authoring (/alps-init, /lite-alps-init, /feature-to-adr)
/plugin install adr-writer@alps-writer    # ADR cycle (/adr-new, /adr-impl, /adr-impl-refactor, /adr-impl-review, /adr-review, /adr-sync, hooks)
```

> `/feature-to-adr` (in alps-writer) delegates ADR authoring to `/adr-new` (in adr-writer), so install **both** if you want the ALPS → ADR bridge. adr-writer on its own works without any ALPS PRD.

Three independent entry flows, driven by `$skill-name` in Codex or `/skill-name` in Claude Code:

- **PoC authoring** — `/lite-alps-init` → minimum PoC scope and demo
- **PRD-first** — `/alps-init` → `/feature-to-adr` → `/adr-impl` → `/adr-impl-refactor` (automatic) → `/adr-impl-review` (completion gate) → `Accepted`
- **ADR-only** — `/adr-new` → `/adr-impl` → `/adr-impl-refactor` (automatic) → `/adr-impl-review` (completion gate) → `Accepted`

Lite ALPS reuses Full ALPS's conversation-led authoring behavior but keeps an independent document lifecycle. Neither reads, updates, converts into, or shares completion state with the other.

Completion counts only subsections or Features with non-empty bodies. An empty
save can still clear content, but the section becomes incomplete; an empty
optional section is omitted from export. Resume follows the first incomplete
required section in the profile's authoring order.

Examples illustrate supplied inputs, not product defaults. Their values, units,
populations, and measurement conditions must remain consistent when carried into
acceptance criteria or metrics. Delegating a value does not make a protected
product decision an implementation tuning value.

Run `/adr-sync` when review finds implementation-fact drift, after broad refactors or manual ADR edits, or as a periodic audit; it is not a mandatory deep scan after every small implementation.

See the [Usage guide](./docs/usage.md) for the full cycle, walkthroughs, slash commands, hook behavior, and the mapping file, or the [ADR process overview](./docs/adr-process.md) for the same cycle drawn as diagrams.

Codex users on Amazon Bedrock should disable multi-agent before running ADR review skills; see [ADR Writer troubleshooting](./plugins/adr-writer/README.md#amazon-bedrock-rejects-a-subagent-request).

## Features

**alps-writer (PRD)**

- 9-section ALPS (PRD) template with structured XML templates, conversation guides, durable architecture constraints, and per-Feature demos connected to the end-to-end demo scenario
- 4-section Lite ALPS template that starts from Desired Business Impact and has AI propose the minimum solution, one product-level C4 Context, Essential User Experiences, and executable demo
- Interactive Q&A workflow — atomic confirmation by default, with explicit batch approval for complete structured input
- Contract-complete plain-text approval digests — concise raw-text views preserve every requirement value and rule before subsection-level persistence
- Document management — create, save, load, and export as clean Markdown
- Section dependency tracking — ensures referenced sections are reviewed first
- **Disposable comprehension signal** — Section 7 Features use a calibrated `1–10` scale with `4–6` as the recommended range; Features at `8/10` or higher receive up to three non-blocking user-behavior split candidates
- **First-reader-friendly Feature specs** — Section 7 explains unfamiliar terms for junior developers and recommends optional Mermaid diagrams, preferring `sequenceDiagram` when multi-participant data flow is clearer visually
- **ALPS → ADR ownership handoff** — `/feature-to-adr` transfers every implementation-relevant Feature contract into `1..N` real ADRs, leaves replaceable means to code, and makes equivalent explicit re-imports no-ops
- Works with Claude Desktop, Claude Code, Cursor, Kiro, and any MCP-compatible client (MCP server only)

**adr-writer (ADR)**

- **ADR-driven development cycle** — author ADRs directly with `/adr-new`, implement them with `/adr-impl`, and keep them in sync with `/adr-sync`
- **Domain-aware gap resolution** — `/adr-impl` derives obligations already implied by the contract, reuses established project/domain defaults for reversible implementation choices, and packages only real product-policy gaps as one recommendation-led Decision request
- **Searchable implementation documentation and executable cases** — `/adr-impl` requires language-standard why/how comments for changed functions, reuses contract terminology without citing ADR files, and tests both the ideal path and relevant edge cases
- **Junior-readable review reports** — document, sync, implementation, and refactor reviews lead with verdict, impact, action, and risk, explain unfamiliar terms once, preserve exact evidence below, and use grounded Mermaid for multi-participant, state, dependency, data, and failure flows. Implementation-review HTML adds a table of contents, renders the narrative and Mermaid relationships, shows findings before detailed evidence, and collapses proven coverage, scope, metrics, choices, and comprehension by default
- **Disposable comprehension signal** — ADR digests, implementation plans, and document reviews show only an ephemeral `1–10` score from an internal five-axis assessment; the score never becomes an ADR field or workflow gate
- **Requested Stacked PR fallback** — when one Feature and ADR must stay intact, `/adr-impl` can offer dependency-ordered PR layers with one review question each; it never creates a Stack from the score alone
- **ADR admission gate** — record durable requirement/architecture decisions while leaving replaceable libraries, SDKs, frameworks, and credential/auth wiring at the code level
- **Verified implementation refactoring** — before Status promotion, independently review efficiency, complexity, coupling, duplication, and proportionate reuse; immediately apply only local behavior-preserving changes with before/after tests and propose the rest
- **Implementation and Review Hiking** — ADR implementation and review use the same low vertical Hills. Each Hill is a user flow, logical capability, or evidence-grounded bounded context—not a technical layer, file group, or lifecycle phase. The implementation records its contract, cross-layer behavior, targeted test command, and observed result before moving on. The review uses reading zooms: Context for intent/contracts/scope, Container/Hill for a vertical capability, Component for detailed implementation, and collapsed Code for a focused diff or current excerpt. Every ADR contract appears in exactly one Hill. Localized implementations use a sufficiency perspective, while protected-surface or broad implementations add separately grounded necessity/sufficiency perspectives. The ordinary main-session completion response never prints Q1 or starts grading.
- **Provider-aware review fallback** — Codex sessions on Amazon Bedrock avoid unsupported subagent dispatch and retries; reviews continue through available model-selected paths while preserving the same evidence and refactor safety gates
- **Model-selected review orchestration** — review perspectives and evidence are contractual, while subagent count, named/generic/main-session execution, parallelism, and model selection remain disposable choices made from current capability and risk
- **ADR-first hook** — one `SessionStart` hook runs only on startup, resume, clear, and compaction recovery, injecting the admission-aware directive without mapping contents; admitted work reads `docs/adr/.mapping.json` before coding
- Fully standalone — no ALPS PRD required

## Documentation

- [Usage guide](./docs/usage.md) — development cycle, walkthroughs, slash commands, hook, mapping file
- [ADR process overview](./docs/adr-process.md) — the lifecycle, critical command paths, routing, and efficiency review as diagrams (Korean)
- [Dependency model](./docs/dependency-model.md) — how PRD → ADR → code stay decoupled (the design core)
- [MCP server](./docs/mcp-server.md) — run the alps-writer MCP server in other clients, env vars, tool reference
- [`about-alps.md`](./plugins/alps-writer/templates/alps/about-alps.md) — ALPS format design rationale
- [ADR templates](./plugins/adr-writer/templates/adr/) — authoring rules, directory structure, mapping schema

## Repository layout

```
alps-writer-plugins/                 # marketplace root (this repo)
├── .agents/plugins/marketplace.json # Codex marketplace
├── .claude-plugin/marketplace.json  # Claude Code marketplace
├── docs/                            # usage, dependency model, MCP server guides
└── plugins/
    ├── alps-writer/                 # PRD plugin (bundles its own MCP server)
    │   ├── .codex-plugin/plugin.json    # Codex metadata + MCP registration
    │   ├── .claude-plugin/plugin.json   # Claude Code metadata + MCP registration
    │   ├── .mcp.json                    # Codex MCP server command
    │   ├── src/                     # MCP server source (TypeScript)
    │   ├── dist/                    # committed bundle (index.js + assets) — runs as-is
    │   ├── skills/                  # /alps-init, /lite-alps-init, /feature-to-adr
    │   └── templates/alps/
    └── adr-writer/                  # ADR plugin (standalone, ALPS-agnostic)
        ├── .codex-plugin/plugin.json
        ├── .claude-plugin/plugin.json
        ├── skills/                  # /adr-new, /adr-impl, /adr-impl-refactor, /adr-impl-review, /adr-review, /adr-sync, /adr-rollup
        ├── agents/                  # ADR authoring + isolated refactor/implementation review roles
        ├── hooks/                   # ADR-first directive hook (SessionStart)
        └── templates/adr/           # README + concepts + authoring-rules + structure + mapping.schema.json
```

## Development

This is a pnpm workspace. The MCP server lives in `plugins/alps-writer/`; root scripts proxy to it.

```bash
pnpm install        # Install dependencies (whole workspace)
pnpm build          # Bundle the alps-writer MCP server into plugins/alps-writer/dist/
pnpm lint           # ESLint the MCP server
pnpm format         # Prettier across the repo

# Or work inside the package directly:
pnpm --filter alps-writer dev     # Run with tsx (watch mode)
pnpm --filter alps-writer start   # Run the built bundle
```

> **The bundle is committed.** `plugins/alps-writer/dist/` is checked into git (esbuild output with dependencies inlined) so the plugin runs from a marketplace install with no build step. **Whenever you change `src/`, run `pnpm build` and commit the regenerated `dist/`.**

See [AGENTS.md](./AGENTS.md) for the full architecture, code style, and conventions.

For rollup/sync prompt regression, `pnpm eval:regression --prepare` creates
reference-based fixtures and an unexecuted HTML report without calling a model.
`pnpm eval:regression --live` runs the selected skills through the logged-in
Claude Code CLI and uses DeepEval GEval to produce HTML/JSON results. The judge
defaults to Bedrock `us.openai.gpt-5.6-sol`, AWS profile `default`, in `us-east-1`. See the
[regression suite guide](./plugins/adr-writer/evals/deepeval/README.md) for
baseline comparisons, case selection, execution boundaries, and costs.
`pnpm eval:golden` renders the current inputs, obligations, pinned provenance, and
Mermaid coverage. `pnpm eval:calibration --live` checks the judge against authored
positive/negative examples; its draft labels still require human review.

## Report writing across projects

Both plugins include `report-write` for code, pull request, ADR, architecture,
and document review results, as well as reports, audits, sync, rollup, and
evaluations. A review request selects it even without a separate report request.
The owning workflow still determines inspection scope, findings, verdicts, and
edit permissions. It keeps skill instructions in
English and writes the report in the user's requested language and format.
Reports start with the answer, then drill into evidenced domains with at most
four peer units. The shared review covers reader context, worked calculations,
paragraph breaks, diagrams, and factual/causal support.

Use `$report-write` in Codex or `/report-write` in Claude Code. Existing
structured review data remains complete; the final human presentation follows
the common skill instead of treating a flat audit export as the final report.

The canonical source is `shared/report-write/`. Plugin copies are synchronized
and checked during development. For this computer's other projects:

```bash
node scripts/sync-report-skill.mjs --global
node scripts/sync-report-skill.mjs --check --global
```

This installs the same standalone skill in `~/.agents/skills/report-write`.
To install from GitHub with the `skills` CLI:

```bash
npx skills add https://github.com/haandol/alps-writer-plugins/tree/main/plugins/adr-writer/skills/report-write --global --agent codex
```

Omit `--global` for a project-local installation. The explicit directory selects
the packaged skill, including its references and Mermaid helper, rather than
the development source or another same-named copy. No separate npm publication
of this repository is required. Installing the skill alone does not install the
plugins' SessionStart hooks or their review engines.

Its Node-only helper renders a validated report document as HTML or Markdown
and preserves Mermaid source and evidence.
The session hook also announces the common report skill in repositories without
an ADR mapping; it does not initialize ADRs or call a model.

## Contributing

Contributions are welcome. Before opening a PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for commit convention (Conventional Commits), branch naming, and code style. Open an issue first for substantial changes, make sure `pnpm lint` and `pnpm format:check` pass, and keep commits atomic.

Bug reports and feature requests: [GitHub Issues](https://github.com/haandol/alps-writer-plugins/issues).

## License

[MIT](./LICENSE)
