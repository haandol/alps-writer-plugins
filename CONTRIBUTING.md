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
pnpm format:check                  # Check formatting without writing
```

- Run `pnpm lint` and `pnpm format:check` before committing to ensure code quality
- ESLint config: `plugins/alps-writer/eslint.config.mjs` (flat config with typescript-eslint)
- Prettier config: `.prettierrc` (repo root)

### Tests

```bash
pnpm test        # ALPS + dependency-free ADR + DeepEval SDK integration tests
pnpm bump:check  # every release-version site agrees (13 of them)
```

Automated in two places, so you rarely have to remember:

- **`.husky/pre-push`** runs the whole CI set locally (~20s) and blocks the push on
  any failure: typecheck, `pnpm test`, `lint`, `format:check`, `bump:check`, a boot
  check on the committed MCP bundle and the adr-writer hook, and a rebuild that
  fails if `plugins/alps-writer/dist/` is stale. If CI would fail on it, this fails
  on it first. For a WIP branch you know is red: `SKIP_TESTS=1 git push …` — that
  skips only the test suite, nothing else.
- **`.github/workflows/ci.yaml`** runs the same commands plus `lint`,
  `format:check`, and a rebuild that fails if the committed
  `plugins/alps-writer/dist/` is stale. A separate `runtime` job re-runs what a
  marketplace install actually executes with **no install step** — the
  dependency-free adr-writer suite, an MCP `initialize` round-trip against the
  committed bundle, and the hook — since a consumer has no `node_modules` and the
  pnpm-based jobs always do. Everything is on Node 24 (`engines.node >= 24`);
  Hooks can be skipped with `--no-verify`, CI cannot.

Behaviour evals (`plugins/adr-writer/evals/`) are **not** part of `pnpm test` —
they call a real model, cost money, and are non-deterministic. Run them by hand
when reproducing a reported LLM defect: `node evals/run.mjs --only <name> --runs 10`.

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

### Shared report-writing changes

Edit `shared/report-write/`, not the generated plugin copies. Run
`pnpm report-skill:sync` and `pnpm report-skill:check`. The dependency-free Mermaid
implementation remains in the ADR scripts; the sync step distributes it with the
standalone skill. Global installation is an explicit
`node scripts/sync-report-skill.mjs --global`, never a build side effect.

Test report hierarchy, evidence coverage, safe rendering and both plugin hooks.
Inspect the actual report for paragraph flow, line wrapping, diagram semantics
and source support; a structural pass is not an editorial pass.

### Shared authoring guidance

Edit `requirement-delegation.md` and `comprehension-load.md` under
`plugins/adr-writer/references/`, then run `pnpm authoring-guidance:sync`.
Commit the generated alps-writer copies too. `pnpm authoring-guidance:check`
verifies that each independently installed plugin has its own matching guidance.
