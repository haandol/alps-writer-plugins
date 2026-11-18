# Validation, evaluation and releases

Read this guide when the matching task in `AGENTS.md` applies. Paths and commands
refer to the repository root unless a different base is stated.

## Commands

The root is a private Bun workspace; the MCP server package lives in `plugins/alps-writer/`. Root scripts proxy to it.

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
`bun scripts/publish-release.mjs <merge-sha>` publishes the same release by hand.

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

Tests run on Bun's test runner (`bun scripts/run-tests.mjs <group>`, sharded across processes); the files keep the `node:test` API, which Bun implements. ALPS TypeScript tests run directly, with no transpiler step; ADR tests are dependency-free `.mjs` tests. `bunfig.toml` preloads the git shim and `scripts/test-env.mjs`, which sets the environment every process a test starts inherits: the test's time zone (`bun test` runs in UTC) and `BUN_OPTIONS=--no-install`, so no shipped script is tested with packages installed on the fly. Spawn a shipped script with plain `process.execPath`; do not repeat those settings at the call. A unit test needs no external tool (it runs in process or starts only this repository's own scripts, which start none either); an integration test needs git, a browser or another external tool, and its file is named `*.integration.test.mjs` or lives in a plugin's `integration-tests/`. `bun run test:unit` runs ALPS and the ADR, ontology and DeepEval unit tests; `bun run test:integration` runs the rest. Keep git and file-system special cases to one representative test per kind. `bun run test` checks generated assets and synchronized guidance, runs ALPS, then runs the ADR, ontology, DeepEval and browser test files through `scripts/run-tests.mjs`, one `bun test` shard per CPU. `bun run test:workspace` runs the same checks and installed-dependency suites; CI runs the dependency-free ADR and ontology suites with no install, the ADR unit tests in `build` before its install and the rest in `runtime`. Files in one shard share a process, so each test keeps its own fixtures and restores any environment it changes; every shard failure blocks success.

**Behaviour evals** (`plugins/adr-writer/evals/`) are separate and NOT in `bun run test`. `bun run test` proves a prompt _says_ something; the evals check whether an agent given that prompt _does_ it, by running real scenarios against a live model and reporting per-check hit rates. They cost money, take minutes, and are non-deterministic, so they never gate CI — their job is reproducing a reported defect (`bun plugins/adr-writer/evals/run.mjs --live --only <name> --runs 10`) and telling you whether it happens 3/10 or 10/10, which decides the fix. Use `bun plugins/adr-writer/evals/run.mjs --changed <base> --list` to preview the disposable impact-map selection for a branch without invoking a model. The harness itself _is_ covered by `bun run test` via a stub agent, because an eval whose scorer cannot tell a bad reply from a good one reports green and is worse than no eval. See `plugins/adr-writer/evals/README.md`.

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

- **`.github/workflows/ci.yaml`** — three jobs, all on Bun 1.4.2 (the declared floor). `test` runs
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
typechecks, bundles and releases with the same Bun. CI pins `setup-bun` to the declared floor (`engines.bun >= 1.4.2`) so
the floor is the version actually verified. Bun overrides name a package, not a
version range, so each security floor in `package.json` applies to every copy of
its package; the `//overrides` note says what each floor keeps. DeepEval declares
two OpenTelemetry trace exporters the evals never load (telemetry is opted out);
the overrides point them at the empty packages in `stubs/`, which keeps gRPC and
protobufjs out of the install. A stub throws if anything loads it.

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
