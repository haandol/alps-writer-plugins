# ALPS Writer Plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Two plugins for Codex and Claude Code: write product requirements, record architecture decisions, and implement them with review.

| Plugin        | Purpose                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alps-writer` | Write product requirements documents (PRDs) in Full or Lite ALPS format through conversation. Transfer Full ALPS features to ADRs.                    |
| `adr-writer`  | Create architecture decision records (ADRs), adopt them in existing projects, implement decisions, review results, and reconcile documents with code. |

Install either plugin independently. The Full ALPS → ADR workflow requires both.

## Quick Start

Requires Node.js 24 or later. Marketplace installs include the bundled server and dependencies; no npm install or build step is needed.

### Codex

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add alps-writer@alps-writer
codex plugin add adr-writer@alps-writer
```

Invoke a skill with `$skill-name`, such as `$alps-init` or `$adr-new`, or ask for a workflow in natural language.

When prompted, review and trust ADR Writer's `SessionStart` hook. It restores the ADR directive on startup, resume, clear, and compaction; it does not run for every user prompt.

### Claude Code

```text
/plugin marketplace add haandol/alps-writer-plugins
/plugin install alps-writer@alps-writer
/plugin install adr-writer@alps-writer
```

Use `/skill-name` instead of `$skill-name`. The examples below use Claude Code notation.

For Codex on Amazon Bedrock, see [ADR Writer troubleshooting](./plugins/adr-writer/README.md#amazon-bedrock-rejects-a-subagent-request) before running review skills.

## Choose a workflow

| Starting point                               | Commands                                       |
| -------------------------------------------- | ---------------------------------------------- |
| Define a proof of concept (PoC)              | `/lite-alps-init`                              |
| Plan a product, then implement it            | `/alps-init` → `/feature-to-adr` → `/adr-impl` |
| Make an architecture or requirement decision | `/adr-new` → `/adr-impl`                       |
| Document decisions in an existing codebase   | `/adr-import [project-path-or-feature-scope]`  |

### Write a product spec

ALPS (Agentic Lean Product Spec) has two formats:

- **Full ALPS:** nine sections covering the product problem, scope, constraints, features, and demos. The agent asks focused questions and saves content after confirmation.
- **Lite ALPS:** four sections for a minimum PoC. You provide the problem and Desired Business Impact; the agent proposes a solution, essential user experiences, and an executable demo for approval.

Both export to Markdown, keep separate files and completion state, and add a glossary only when terms need confirmed definitions. See the [ALPS format guide](./plugins/alps-writer/templates/alps/about-alps.md) and [Lite walkthrough](./docs/usage.md#a-lite-alps--independent-poc-authoring).

For Full ALPS, `/feature-to-adr` transfers each feature's complete implementation requirements into one or more ADRs. After handoff, ADRs govern implementation; the PRD remains a planning record. Re-import a changed PRD explicitly to propose ADR updates. Equivalent input leaves the ADRs unchanged.

### Implement and maintain decisions

New ADRs start as `Proposed`. `/adr-impl` checks prerequisites, implements the approved requirements, runs tests, and reviews the result. It uses `/adr-impl-refactor` when a separate refactoring pass is warranted and `/adr-impl-review` as the completion gate. A passing review promotes the ADR to `Accepted`.

Use `/adr-review` to review ADR documents without editing them or reading code. Use `/adr-sync` to reconcile proven drift, check broad refactors or manual ADR edits, or run a periodic audit. `/adr-rollup` consolidates the recorded evolution of one decision while preserving its requirements and rationale.

Changes to requirements or architecture need confirmation before implementation. Fixes that restore intended behavior and refactors that preserve it can proceed without a new ADR.

### Adopt an existing project

`/adr-import` reads local code, tests, and documents to propose decisions grouped by business responsibility. With no argument, it uses the current repository. It prepares drafts and collects unresolved intent, conflicts, and approval questions in one report.

Confirm, revise, or defer items by question ID. The agent saves and validates confirmed contracts as `Proposed` ADRs without changing application code or accessing live systems. Repeating an equivalent import leaves existing documents unchanged. See the [adoption guide](./plugins/adr-writer/README.md#adopt-an-existing-project).

## What belongs in each artifact

The plugins preserve conditions needed to rebuild the system, while leaving recoverable facts in code and tests.

| Artifact          | What it owns                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| PRD               | User problems, expected outcomes, product requirements, and exclusions                                      |
| ADR               | Architecture decisions, exact requirement values and rules, rationale, alternatives, and durable boundaries |
| Code and tests    | Implementation details and executable verification                                                          |
| Issue, PR, commit | Change-specific intent and history                                                                          |

Apply three checks in order:

1. **Requirement gate:** preserve any fact whose loss could change required behavior, values, permissions, ordering, or failure guarantees.
2. **Code-readthrough test:** leave non-requirement facts in code when they can be recovered from the implementation.
3. **ADR admission gate and litmus test:** record durable architectural choices, their reasons, and trade-offs when code alone cannot explain them.

Rebuilding does not mean recreating the same files, functions, or libraries. It means preserving behavior and constraints. See the [dependency model](./docs/dependency-model.md) for the reference rules.

Removing the plugins leaves PRDs, ADRs, code, and tests readable on their own. Hooks and skills govern artifacts, actions, evidence, and approvals. They leave private reasoning and subagent orchestration to the model.

## Report writing

ADR Writer includes `$report-writer` in Codex and `/report-writer` in Claude Code. It creates standalone HTML for explicit report requests or explanations that need structured detail. Short answers stay in chat; when a report's usefulness is unclear, it asks once. Your format and delivery preferences take precedence.

Whole-system and multi-step process reports start with a Mermaid overview after
the brief background and answer, then expand the same responsibilities into
their internal relationships and rules. An explicit top-down or C4-like request
requires that overview; diagram exclusions take precedence. Simple facts need
no figure, and deeper diagrams appear where they explain new relationships.

By default, the skill reviews the content and checks the generated file, opens it once in the default browser, and returns its path. Browser interaction and actual print checks run when requested; unperformed checks are reported. Review reports and evidence stay in separate, Git-excluded `.adr-review/` directories. Self-check questions are strongly recommended when useful, but optional unless you request them. The ordinary main-session completion response never prints Q1 or starts grading.

The default page uses an article-style reading column with responsive spacing and
wider figures and code evidence. Code reviews can show selected diffs through
bundled diff2html, with line numbers and change highlighting. Key evidence marked
for printing stays included, and long code lines wrap on paper. Reports work
offline without downloading fonts, stylesheets or a diff library.

To install only the report skill, without plugin hooks or review workflows:

```bash
npx skills add https://github.com/haandol/alps-writer-plugins/tree/main/plugins/adr-writer/skills/report-writer --global --agent codex
```

Omit `--global` for a project-local installation. See the [report skill](./plugins/adr-writer/skills/report-writer/SKILL.md) for delivery and presentation rules.

## Documentation

| Guide                                                | Contents                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Usage](./docs/usage.md)                             | Walkthroughs, all commands, hooks, and the ADR index                                                        |
| [ADR process](./docs/adr-process.md)                 | Lifecycle, critical command paths, routing, and efficiency review as diagrams (Korean)                      |
| [ADR templates](./plugins/adr-writer/templates/adr/) | Authoring rules, directory structure, and index schema                                                      |
| [MCP server](./docs/mcp-server.md)                   | Use the ALPS server in other Model Context Protocol (MCP) clients; environment variables and tool reference |

When calling ALPS document tools directly, pass `doc_path` on every request. Initialization or loading does not select a default for later calls; missing or invalid targets return an error without changing another document.

## Development

The repository is a pnpm workspace. `plugins/alps-writer/` contains the TypeScript MCP server; `plugins/adr-writer/` contains skills, hooks, templates, and validation scripts.

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
pnpm format:check
pnpm bump:check
```

For server development, use `pnpm --filter alps-writer dev` to watch source changes or `pnpm --filter alps-writer start` to run the bundle.

The marketplace runs the committed `plugins/alps-writer/dist/` bundle. After changing server source or bundled dependencies, run `pnpm build` and include the regenerated bundle. Use `pnpm bump <version>` for releases so all version sites stay in sync.

To prepare a skill evaluation report without model calls:

```bash
pnpm eval:skills --prepare --runs 1 --open
```

Live evaluations require `--live` and incur model costs. See the [skill evaluation guide](./plugins/adr-writer/evals/skills/README.md) and [rollup/sync regression guide](./plugins/adr-writer/evals/deepeval/README.md) for execution, comparison, and saved-report commands.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for branch, commit, and pull request conventions, and [AGENTS.md](./AGENTS.md) for architecture and repository rules. Open an issue before substantial changes.

For dependency updates, inspect `pnpm audit` and Dependabot alerts, keep overrides narrowly scoped, and rebuild the committed bundle before testing and publishing.

[Bug reports and feature requests](https://github.com/haandol/alps-writer-plugins/issues) · [MIT License](./LICENSE)
