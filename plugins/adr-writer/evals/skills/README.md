# Skill evaluation

One workspace command prepares or runs classification probes, controlled Skill
selection, and actual ADR document operations. The existing scorers and the
DeepEval GEval adapter are reused. No evaluation dependency enters the shipped
ALPS MCP bundle or the dependency-free ADR runtime tests.

## Prepare and inspect

From the workspace root after `pnpm install`:

```bash
pnpm eval:skills --prepare --runs 1 --open
pnpm eval:skills --list --suite execution
pnpm eval:skills --prepare --suite execution --compare without-skill --runs 3
```

Preparation is the default and makes no model calls. It writes a self-contained
`index.html`, original `results.json`, per-case records, input snapshots, and
preflight checks under a fresh `.codex/evals/skills-*` directory. The report says
**미실행**, not PASS. It is safe to inspect the report before choosing a paid run.
`--out` selects a new/empty directory. `--open` opens only the generated local file.

The catalog includes 52 existing classification scenarios, eight controlled
routing cases and eleven execution cases. The real-repository classification
probe remains in the report as unrun unless selected explicitly with `--only
review-real-repo-adr` and its existing environment inputs. Ordinary runs never
silently read the user's separate real repository.

## Run and compare

```bash
# Explicit paid calls through locally configured Claude Code + the GEval judge:
pnpm eval:skills --live --suite execution --compare without-skill --runs 5 --open
pnpm eval:skills --live --suite execution --compare both --baseline HEAD~1 --runs 3
pnpm eval:skills --live --suite routing --runs 3
pnpm eval:skills --live --suite classification --only comprehension-load --runs 3

# Preview branch + staged + unstaged + untracked impact without calling models:
pnpm eval:skills --list --changed main
```

`--suite` accepts `all`, `classification`, `routing`, or `execution`.
`--only` matches a case ID substring; `--changed` selects affected cases instead.
`--jobs` bounds concurrent cases and `--timeout` bounds each model call in seconds.
Trials of one case use separate workspaces and alternate comparison order.
Defaults are three repeats, one concurrent case and 300 seconds per call. These
are starting settings, not evidence of statistical reliability.

`--compare none` is the default. `versions` compares the selected baseline commit
with the candidate instructions; `without-skill` compares candidate guidance with
no execution guidance; `both` records all three. Version comparison requires
`--baseline`. Comparisons apply only to the execution suite.

Both conditions retain the same task, initial repository, product/organization
contracts, fixture tool permissions, verification scripts, judge and time budget.
The candidate snapshot owns those fixed inputs, including the read-only shared
`docs/adr/decision-log.template.md` seed required by the organization rules.
Withholding that required seed only from the no-skill condition would measure a
missing resource rather than instruction lift. The no-skill condition receives
no Skill body and cannot read/list `plugin/` guidance. The target has only the
confined fixture MCP tools: no host shell, native filesystem tool, external MCP,
user hooks or automatically discovered Skills. This measures the execution
instruction bundle, not removing the product/organization contract itself.

`--model` selects the Claude target. Semantic classification and execution use
DeepEval with the existing Bedrock defaults: profile `default`, region
`us-east-1`, model `us.openai.gpt-5.6-sol`. `--judge-model`, `--judge-profile`,
`--judge-region` and `--judge-provider bedrock|claude` override the judge separately.
There is no automatic provider fallback. Deterministic classification and routing
checks do not invoke a semantic judge. Routing includes a second target call to
read selected Skill bodies; no second call is needed for an empty selection.

## Read the result

The three suites deliberately report different evidence:

| Suite          | Evidence and limits                                                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classification | Existing response/scorer checks, sometimes with artifact checks. Never labeled task completion rate. Natural-language digest obligations use GEval.                                                                                                                                    |
| Routing        | Shipped name/description catalog → selected set → selected bodies. Required omissions and irrelevant selections are separate; optional allowed report support is excluded from required-route precision/recall. This is not native client installation/automatic routing verification. |
| Execution      | Actual files, replies, intermediate tool events, final deterministic checks and GEval obligation judgments. A passing judge cannot cancel a failed mandatory deterministic check.                                                                                                      |

A scored result is `PASS` or `NOT_PROVEN`; the latter can mean a demonstrated
violation **or insufficient evidence**. `ERROR` and `NOT_RUN` stay outside the
behavior-rate denominator but remain in requested/completed/error counts.
The report retains every case and trial, including failures and exclusion reasons.
Unknown cost is shown as unpriced calls rather than zero-cost service use.

Skill Lift uses valid pairs of the same case and repeat: candidate success rate
minus no-skill success rate, in percentage points. For example, **hypothetical**
60/100 no-skill successes and 85/100 candidate successes yield +25 pp. Models,
fixed inputs, date, verifiers and execution limits must match. Unknown/incompatible
conditions exclude a pair; no valid pair means no numeric lift. The report does
not assert confidence intervals or statistical significance from a few repeats.

Provider identity evidence matters. The Bedrock adapter currently reports the
**requested inference profile**, not a verified underlying model revision. Those
runs still have valid per-case GEval results, but unified Lift marks their model
identity incomplete and excludes them from numeric paired claims. A judge adapter
returning actual model identity (for example, Claude Code's `modelUsage`) can
produce comparable pairs; a requested alias alone is not silently substituted.

Model/client upgrades can reuse the same case corpus. Runtime, instruction,
metadata, input and scorer hashes identify what was evaluated. Retiring a Skill
never deletes its cases or relaxes their contracts; missing guidance is an error
for its enabled condition, while its no-skill condition can still execute. The
runner never automatically removes a Skill or changes a release requirement.

## Regenerate without rerunning

```bash
pnpm eval:report .codex/evals/<run-directory>
pnpm eval:skills --report .codex/evals/<run-directory> --open
```

Both commands rebuild HTML from the recorded results without target or judge
calls. Original scores, evidence and evaluation timestamps remain unchanged.
The existing DeepEval-only report format is still supported by `eval:report`.
The common report renderer validates hierarchy, source coverage, Mermaid and
staged self-check controls. Its output is marked as an automatic draft: structural
validation does not claim human semantic or visual review.

Live quality failures are observations, not CI gates. Exit 0 means a successful
free operation or at least one scored live outcome (even when its checks fail).
Exit 2 means invalid setup/preparation or no scorable live result. Existing
commands remain compatible. CI exercises the new pipeline with stub providers
through the real DeepEval SDK, plus deterministic metrics and fixture boundary tests.
