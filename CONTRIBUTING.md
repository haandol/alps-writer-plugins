# Contributing Guide

This document defines the rules to follow when contributing to the ALPS (PRD) Writer MCP Server project.

## Table of Contents

- [Commit Message Convention](#commit-message-convention)
- [Branch Strategy](#branch-strategy)
- [Code Style](#code-style)
- [Pull Request](#pull-request)

---

## Commit Message Convention

We follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### Format

```
<type>(<scope>): <subject>

[body]

[footer(s)]
```

### Type (required)

| Type       | Purpose                                     | SemVer Impact |
| ---------- | ------------------------------------------- | ------------- |
| `feat`     | New feature                                 | MINOR         |
| `fix`      | Bug fix                                     | PATCH         |
| `refactor` | Code refactoring without behavior change    | -             |
| `docs`     | Documentation changes                       | -             |
| `test`     | Adding or updating tests                    | -             |
| `chore`    | Build config, dependency updates, etc.      | -             |
| `style`    | Code formatting (no logic change)           | -             |
| `perf`     | Performance improvement                     | -             |
| `ci`       | CI/CD configuration changes                 | -             |
| `build`    | Build system or external dependency changes | -             |

### Scope (optional)

| Scope       | Target                                                      |
| ----------- | ----------------------------------------------------------- |
| `server`    | MCP server entry point (`plugins/alps-writer/src/index.ts`) |
| `templates` | Template tools (`plugins/alps-writer/src/tools/templates/`) |
| `documents` | Document tools (`plugins/alps-writer/src/tools/documents/`) |
| `guides`    | Section guides (`plugins/alps-writer/src/guides/`)          |
| `adr`       | adr-writer plugin (skills, hooks, agents, templates)        |
| `plugin`    | Plugin manifests / marketplace / distribution               |
| `deps`      | Dependencies (`package.json`)                               |
| `release`   | Version bumps across plugin manifests + marketplace         |

### Subject (required)

- Start with lowercase
- Use imperative mood: "add", "fix", "change" (O) / "added", "fixes", "changed" (X)
- No period at the end
- 50 characters recommended (72 max)

### Body (optional)

- Explain **why** the change was made when the subject is not sufficient
- Separate from subject with a blank line
- Wrap at 72 characters per line

### Footer (optional)

- `BREAKING CHANGE: <description>` — Breaking change (SemVer MAJOR)
- `Refs: #<issue>` — Related issue reference

### Good Examples

```
feat(templates): add section dependency validation
```

```
fix(documents): handle missing subsection on read
```

```
docs: update README with Kiro configuration guide
```

```
chore(deps): bump @modelcontextprotocol/sdk to 1.13.0
```

### Bad Examples

```
# No type
Update document service

# Past tense
feat: Added export feature

# Too vague
update stuff

# Multiple changes in one commit
feat(documents): add export and fix parsing and update README
```

### Atomic Commits

Each commit should contain exactly one logical change:

- Don't mix feature additions with bug fixes
- Don't mix refactoring with behavior changes
- Split large changes into multiple commits

---

## Branch Strategy

### Branch Naming

```
<type>/<short-description>
```

| Prefix      | Purpose       | Example                     |
| ----------- | ------------- | --------------------------- |
| `feat/`     | New feature   | `feat/section-validation`   |
| `fix/`      | Bug fix       | `fix/xml-parsing-edge-case` |
| `refactor/` | Refactoring   | `refactor/document-service` |
| `docs/`     | Documentation | `docs/contributing-guide`   |
| `chore/`    | Maintenance   | `chore/update-dependencies` |

### Workflow

1. Create a new branch from `main`
2. Make changes and commit (following the convention above)
3. Create a Pull Request
4. Merge to `main` after review

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature
# ... work ...
git add <files>
git commit -m "feat(scope): add my feature"
git push -u origin feat/my-feature
```

---

## Code Style

### Linting & Formatting

This project uses **ESLint** for linting and **Prettier** for code formatting.

```bash
bun run lint                          # Run ESLint on the MCP server (--filter alps-writer)
bun run --filter alps-writer lint:fix # Run ESLint with auto-fix
bun run format                        # Format all files with Prettier (repo-wide)
bun run format:check                  # Check formatting; reuse unchanged content results
```

- Run `bun run lint` and `bun run format:check` before committing to ensure code quality
- ESLint config: `plugins/alps-writer/eslint.config.mjs` (flat config with typescript-eslint)
- Prettier config: `.prettierrc` (repo root)

### Tests

```bash
bun run test:unit         # unit tests: no git, browser or other external tool (seconds)
bun run test:integration  # integration tests: git, a browser or another external tool
bun run test              # asset/guidance checks, ALPS, then every ADR, ontology, DeepEval and browser test
bun run bump:check        # every release-version site agrees (16 of them)
```

Tests come in two kinds, and behaviour evals are a third thing (below). A unit
test needs no external tool: it runs in its own process, or starts only this
repository's own scripts, which start none either. An integration test needs
git, a browser or another external tool; its file is named
`*.integration.test.mjs`, or lives in an `integration-tests/` directory
(`plugins/adr-writer/` or `plugins/ontology-writer/`).
Put a new test in the unit file when it needs no external tool and in the
matching `*.integration.test.mjs` file when it does. `bun run test:unit` runs the
ALPS tests and the ADR, ontology and DeepEval unit tests; `bun run test:integration` runs the
rest. Keep special cases of git or the file system to one representative test
per kind.

Tests run on Bun's test runner through `scripts/run-tests.mjs`, which splits a
group's files across one `bun test` process per CPU (`TEST_SHARDS` overrides the
count) and prints each shard's report, then a summary. Files in one shard share a
process, so a test keeps its own temporary fixtures and restores any environment
it changes. The files use the `node:test` API, which Bun implements; `bunfig.toml`
preloads the git-shim and timezone setup for every `bun test`. Run one with
`bun run test:alps`, `bun run test:adr`, `bun run test:ontology`, `bun run test:deepeval`, or
`bun run test:report-rendering`. `bun run test:workspace` runs the installed-dependency
suites and shared asset/guidance checks; CI runs the dependency-free ADR and ontology
suites with no install — the ADR unit tests in `build` before its install, the rest
in `runtime` — so every test runs once across the required jobs.

Prettier keeps a content cache under `node_modules/.cache/prettier`, and
`format:check` skips the files it holds as formatted. Prettier fills the cache only
when it writes, so `bun run format` and the pre-commit formatter run with `--cache`; a
check adds nothing to it, and a run without `--cache` deletes it. Run `bun run format`
once after a fresh install to fill it. Changes to file content, formatting options
or the Prettier version invalidate entries. Delete that disposable cache or run
`bunx prettier --check .` for a full scan. CI still checks every file on a
fresh checkout.

`bun test` runs its tests in UTC unless `TZ` is set, while a CLI a test starts
would otherwise use the machine's zone. The timezone preload exports the zone the
tests run in, so a date a test computes and a date its CLI records agree.

On macOS, `/usr/bin/git` is a shim that looks the developer tools up through
`xcrun` before every run, and the tests start thousands of git processes. When
that shim is the first `git` on `PATH`, the test preload puts a private
temporary directory holding only a link to the git it finds first on `PATH`
for the run, and remove it at the end. It is the same git binary, so results
do not change; elsewhere, or with another git first on `PATH`, nothing changes.

Automated in these places, so you rarely have to remember:

- **`.husky/pre-commit`** formats the staged files, rebuilds and stages
  `plugins/alps-writer/dist/` when the MCP server source is staged, and otherwise
  typechecks only when the commit changes the package configuration or the
  dependencies — the only other inputs of that typecheck.
- **`.husky/pre-push`** runs the fast part locally and blocks the push on any
  failure: the generated-asset checks, the unit tests of `bun run test:unit` (the ALPS
  Writer ones beside the rest), `lint`, `format:check`,
  `bump:check`, a boot check on the committed MCP bundle and the adr-writer hook,
  and a rebuild (with the typecheck) that fails if `plugins/alps-writer/dist/` is
  stale. Integration tests are left to CI, whose required jobs run them on every
  pull request; run `bun run test:integration` locally when a change touches git
  history reading, a CLI or a browser view. The checks that only read the tree
  run while the unit tests run and report after them, in order; the rebuild waits
  for the tests. For a WIP branch you know is red: `SKIP_TESTS=1 git push …` —
  that skips only the unit tests, nothing else.
- **`.github/workflows/ci.yaml`** splits `bun run test` between `test`, `runtime` and
  the start of `build`, and runs `lint`, `format:check`, version checks and a rebuild that fails if the
  committed `plugins/alps-writer/dist/` is stale. The `runtime` job checks what a
  marketplace install actually executes with **no install step** — the
  dependency-free adr-writer integration and ontology-writer suites in one runner
  (`build` runs adr-writer's unit tests the same way, before its install), an MCP
  `initialize` round-trip against the committed bundle, and the hooks — since a
  consumer has no `node_modules` and the installed jobs always do. Every job sets
  up only Bun, at the declared floor (`engines.bun >= 1.4.2`); no job installs
  Node.js. Hooks can be skipped with `--no-verify`, CI cannot. On a push to main, its `verified` job looks for the merged pull request:
  when the workflow passed on that head and the pushed commit carries its tree,
  the three jobs skip instead of repeating the same checks, and otherwise they
  all run.
- **`.github/workflows/release.yaml`** runs after CI passes on a main commit. When
  that commit's version has no tag yet, it tags the commit and publishes the
  GitHub release, with the merged pull request's `## Release notes` section as its
  notes (GitHub's generated notes without one); otherwise it does nothing.

Behaviour evals (`plugins/adr-writer/evals/`) are **not** part of `bun run test` —
they call a real model, cost money, and are non-deterministic. Run them by hand
when reproducing a reported LLM defect: `node evals/run.mjs --live --only <name> --runs 10`.

The [rollup/sync regression suite](./plugins/adr-writer/evals/deepeval/README.md)
adds actual fixture edits, DeepEval GEval judgments, and local HTML/JSON reports.
Use `bun run eval:regression --prepare` without model calls and explicitly add
`--live` for execution. Its dependency-free harness tests and the workspace-only `test:deepeval` integration tests are part of `bun run test`; live results
remain outside the CI quality gate. `bun run eval:golden` exports the dataset and
coverage; `bun run eval:calibration --live` evaluates the judge using authored controls
whose draft labels are separate from human-reviewed ground truth.

Do not delete or weaken a test to make it pass — fix the code instead.

### Prettier Rules

| Rule            | Value   |
| --------------- | ------- |
| `semi`          | `true`  |
| `singleQuote`   | `false` |
| `trailingComma` | `"all"` |
| `tabWidth`      | `2`     |
| `printWidth`    | `100`   |

### TypeScript

- TypeScript 5.9+ with strict mode
- ES modules (`"type": "module"`)
- Follow existing patterns in the codebase

### Project Structure

bun run workspace. The MCP server (npm package `alps-writer`) lives in `plugins/alps-writer/`; the adr-writer plugin in `plugins/adr-writer/`. See [AGENTS.md](./AGENTS.md#repository-structure) for the full tree.

```
plugins/alps-writer/src/
├── index.ts              # MCP server entry point + tool registration
├── constants.ts          # Section titles, references, paths
├── tools/
│   ├── templates/        # Template tools (controller + service)
│   └── documents/        # Document tools (controller + service)
├── guides/               # Section conversation guides (01-09.md)
└── templates/            # ALPS (PRD) templates (overview.md + chapters/*.xml)
```

### Key Patterns

- **Controller/Service separation**: Controllers define the MCP tool interface, services contain business logic
- **Constants centralized**: All section metadata in `constants.ts`
- **Static assets**: Templates and guides are read from filesystem at runtime

---

## Pull Request

### PR Title

Use the same Conventional Commits format as commit messages:

```
feat(documents): add batch export support
```

### PR Body

```markdown
## Summary

Summarize changes in 1-3 bullet points.

## Motivation

Explain why this change is needed.

## Changes

- Detailed list of changes

## Test Plan

- [ ] Existing functionality verified
- [ ] New scenarios tested manually
```

### Merge Rules

- Use squash merge by default
- Merge commit message must follow Conventional Commits format
- Do not push directly to `main`

Git hooks must clear inherited repository-local Git environment variables before
running tests that create temporary repositories. In a linked worktree, an inherited
absolute `GIT_DIR` can otherwise send fixture commits, config and index writes to
the checkout being pushed. The pre-push regression test exercises a real local push
and verifies that fixture work leaves the outer checkout unchanged.

### Shared report-writing changes

Edit `shared/report-writer/`, not the generated adr-writer and ontology-writer
copies. Run `bun run report-skill:sync` and `bun run report-skill:check`.

### Scripts ontology-writer shares with adr-writer

Local search is owned by `shared/search/`. Run `bun run search:sync` after editing
it and `bun run search:check` to verify both plugin copies. Shipped CLIs, hooks and the
MCP server run with Bun 1.4.2 or later, as do the tests that start them. Keep query
semantics and ranking in the pure shared module so saved-model HTML agrees
with CLI search. Bun subprocess checks are integration tests.

ontology-writer runs copies of `adr-lint-lib.mjs`, `adr-status-transition.mjs` and
`adr-impl-review-open.mjs`. Edit the adr-writer originals, then run
`bun run shared-scripts:sync`; `bun run shared-scripts:check`, part of
`bun run test:checks`, rejects a stale copy. The dependency-free Mermaid
implementation remains in the ADR scripts; the sync step distributes it with the
standalone skill. Global installation is an explicit
`node scripts/sync-report-skill.mjs --global`, never a build side effect.

Keep common explanation rules in `explanation-design.md`, meaning and terminology
checks in `editorial-review.md`, and delivery checks in `format-and-layout.md`.
Load `diagrams.md`, `quantitative-claims.md` and `html-layout.md` only for the
relevant content or format. Quiz and diff schemas live with `comprehension.md`
and `code-evidence.md`; `report-document.md` owns the common renderer fields.
Long worked examples live under `references/examples/` and are optional reading.
When moving guidance, update callers and tool-free evaluation prompt references
so the same checks remain available; keep the task evidence and graders fixed.

Test report hierarchy, evidence coverage, safe rendering and the adr-writer report hook.
Verify that alps-writer has no report skill, hook, or report-writer dependency.
Inspect the actual report for paragraph flow, line wrapping, diagram semantics
and source support; a structural pass is not an editorial pass.
Check that feasible figures are encouraged at each explanation depth without
turning their presence into a delivery gate. Test diagram-free HTML and Markdown,
honest unsupported-syntax fallbacks, and preservation of existing files on invalid
input. Prepare the `report-drilldown-overview-` probes to verify scenario
integration; actual model behavior requires an explicitly selected live evaluation.

### Shared authoring guidance

Edit `requirement-delegation.md` and `comprehension-load.md` under
`plugins/adr-writer/references/`, then run `bun run authoring-guidance:sync`.
Commit the generated alps-writer copies too. `bun run authoring-guidance:check`
verifies that each independently installed plugin has its own matching guidance.
