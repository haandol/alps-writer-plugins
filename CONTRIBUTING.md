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
pnpm lint                          # Run ESLint on the MCP server (--filter alps-writer)
pnpm --filter alps-writer lint:fix # Run ESLint with auto-fix
pnpm format                        # Format all files with Prettier (repo-wide)
pnpm format:check                  # Check formatting; reuse unchanged content results
```

- Run `pnpm lint` and `pnpm format:check` before committing to ensure code quality
- ESLint config: `plugins/alps-writer/eslint.config.mjs` (flat config with typescript-eslint)
- Prettier config: `.prettierrc` (repo root)

### Tests

```bash
pnpm test:unit         # unit tests: no git, browser or other external tool (seconds)
pnpm test:integration  # integration tests: git, a browser or another external tool
pnpm test              # asset/guidance checks, ALPS, then every ADR, ontology, DeepEval and browser test
pnpm bump:check        # every release-version site agrees (16 of them)
```

Tests come in two kinds, and behaviour evals are a third thing (below). A unit
test needs no external tool: it runs in its own process, or starts only this
repository's Node scripts, which start none either. An integration test needs
git, a browser or another external tool; its file is named
`*.integration.test.mjs`, or lives in an `integration-tests/` directory
(`plugins/adr-writer/` or `plugins/ontology-writer/`).
Put a new test in the unit file when it needs no external tool and in the
matching `*.integration.test.mjs` file when it does. `pnpm test:unit` runs the
ALPS tests and the ADR, ontology and DeepEval unit tests; `pnpm test:integration` runs the
rest. Keep special cases of git or the file system to one representative test
per kind.

In `pnpm test`, the ALPS tests run first, then the ADR, ontology, DeepEval and browser test files share one Node worker pool,
so independent files overlap within a single CPU-based concurrency limit. Test
files keep process isolation and their own temporary fixtures. Run one with
`pnpm test:alps`, `pnpm test:adr`, `pnpm test:ontology`, `pnpm test:deepeval`, or
`pnpm test:report-rendering`. `pnpm test:workspace` runs the installed-dependency
suites and shared asset/guidance checks; CI pairs it with the full ADR and ontology
suites in `runtime`, so the tests run once across those two required jobs.

`format:check` uses Prettier's content cache under `node_modules/.cache/prettier`.
Changes to file content, formatting options or the Prettier version invalidate
entries. Delete that disposable cache or run `pnpm exec prettier --check .` for
a full scan. CI still checks every file on a fresh checkout.

The Node test scripts also enable Node's compile cache in temporary storage and
share its path with child CLI processes. Source or runtime changes invalidate
compiled entries; test execution and assertions always run. CI uses runner
temporary storage and does not upload the cache between runs. An unavailable
cache falls back to normal execution. Set `NODE_DISABLE_COMPILE_CACHE=1` to
disable it, or `NODE_COMPILE_CACHE` to choose a different directory.

On macOS, `/usr/bin/git` is a shim that looks the developer tools up through
`xcrun` before every run, and the tests start thousands of git processes. When
that shim is the first `git` on `PATH`, the Node test scripts put a private
temporary directory holding only a link to the git it finds first on `PATH`
for the run, and remove it at the end. It is the same git binary, so results
do not change; elsewhere, or with another git first on `PATH`, nothing changes.

Automated in these places, so you rarely have to remember:

- **`.husky/pre-commit`** formats the staged files, rebuilds and stages
  `plugins/alps-writer/dist/` when the MCP server source is staged, and otherwise
  typechecks only when the commit changes the package configuration or the
  dependencies — the only other inputs of that typecheck.
- **`.husky/pre-push`** runs the fast part locally and blocks the push on any
  failure: the generated-asset checks, `pnpm test:unit`, `lint`, `format:check`,
  `bump:check`, a boot check on the committed MCP bundle and the adr-writer hook,
  and a rebuild (with the typecheck) that fails if `plugins/alps-writer/dist/` is
  stale. Integration tests are left to CI, whose required jobs run them on every
  pull request; run `pnpm test:integration` locally when a change touches git
  history reading, a CLI or a browser view. The checks that only read the tree
  run while the unit tests run and report after them, in order; the rebuild waits
  for the tests. For a WIP branch you know is red: `SKIP_TESTS=1 git push …` —
  that skips only the unit tests, nothing else.
- **`.github/workflows/ci.yaml`** splits `pnpm test` between `test` and `runtime`,
  and runs `lint`, `format:check`, version checks and a rebuild that fails if the
  committed `plugins/alps-writer/dist/` is stale. The `runtime` job checks what a
  marketplace install actually executes with **no install step** — the
  dependency-free adr-writer and ontology-writer suites in one runner, an MCP
  `initialize` round-trip against the committed bundle, and the hooks — since a
  consumer has no `node_modules` and the pnpm-based jobs always do. Everything is
  on Node 24 (`engines.node >= 24`); Hooks can be skipped with `--no-verify`, CI
  cannot. On a push to main, its `verified` job looks for the merged pull request:
  when the workflow passed on that head and the pushed commit carries its tree,
  the three jobs skip instead of repeating the same checks, and otherwise they
  all run.
- **`.github/workflows/release.yaml`** runs after CI passes on a main commit. When
  that commit's version has no tag yet, it tags the commit and publishes the
  GitHub release, with the merged pull request's `## Release notes` section as its
  notes (GitHub's generated notes without one); otherwise it does nothing.

Behaviour evals (`plugins/adr-writer/evals/`) are **not** part of `pnpm test` —
they call a real model, cost money, and are non-deterministic. Run them by hand
when reproducing a reported LLM defect: `node evals/run.mjs --live --only <name> --runs 10`.

The [rollup/sync regression suite](./plugins/adr-writer/evals/deepeval/README.md)
adds actual fixture edits, DeepEval GEval judgments, and local HTML/JSON reports.
Use `pnpm eval:regression --prepare` without model calls and explicitly add
`--live` for execution. Its dependency-free harness tests and the workspace-only `test:deepeval` integration tests are part of `pnpm test`; live results
remain outside the CI quality gate. `pnpm eval:golden` exports the dataset and
coverage; `pnpm eval:calibration --live` evaluates the judge using authored controls
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

pnpm workspace. The MCP server (npm package `alps-writer`) lives in `plugins/alps-writer/`; the adr-writer plugin in `plugins/adr-writer/`. See [AGENTS.md](./AGENTS.md#repository-structure) for the full tree.

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
copies. Run `pnpm report-skill:sync` and `pnpm report-skill:check`.

### Scripts ontology-writer shares with adr-writer

ontology-writer runs copies of `adr-lint-lib.mjs`, `adr-status-transition.mjs` and
`adr-impl-review-open.mjs`. Edit the adr-writer originals, then run
`pnpm shared-scripts:sync`; `pnpm shared-scripts:check`, part of
`pnpm test:checks`, rejects a stale copy. The dependency-free Mermaid
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
`plugins/adr-writer/references/`, then run `pnpm authoring-guidance:sync`.
Commit the generated alps-writer copies too. `pnpm authoring-guidance:check`
verifies that each independently installed plugin has its own matching guidance.
