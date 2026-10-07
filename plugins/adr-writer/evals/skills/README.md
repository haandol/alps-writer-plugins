# Skill evaluation

One workspace command prepares or runs classification probes, controlled Skill
selection, and actual ADR document operations. The existing scorers and the
DeepEval GEval adapter are reused. `pnpm eval:llm` is the classification-only
entry point to the same runner. No evaluation dependency enters the shipped
ALPS MCP bundle or the dependency-free ADR runtime tests.

## Prepare and inspect

From the workspace root after `pnpm install`:

```bash
pnpm eval:skills --prepare --runs 1 --open
pnpm eval:llm --prepare --runs 1 --open
pnpm eval:skills --list --suite execution
pnpm eval:skills --prepare --suite execution --compare without-skill --runs 3
```

Preparation is the default and makes no model calls. It writes a self-contained
`index.html`, original `results.json`, per-case records, input snapshots, and
preflight checks under a fresh `.codex/evals/skills-*` directory. The report says
**미실행**, not PASS. It is safe to inspect the report before choosing a paid run.
`--out` selects a new/empty directory. `--open` opens only the generated local file.

The catalog includes 52 existing classification scenarios and five report-writing
probes and controlled routing cases. Execution includes the eleven original rollup/sync cases and existing-project import cases. The real-repository classification
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
pnpm eval:llm --live --only lite-alps- --runs 3
pnpm eval:llm --live --only report- --runs 3
pnpm eval:llm --live --only report-scope- --runs 2

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

`--model` selects the Claude target. All catalog classification probes and execution use
DeepEval with the existing Bedrock defaults: profile `default`, region
`us-east-1`, model `us.openai.gpt-5.6-sol`. `--judge-model`, `--judge-profile`,
`--judge-region` and `--judge-provider bedrock|claude` override the judge separately.
There is no automatic provider fallback. A classification trial normally calls
the semantic judge once. An unsupported source/quotation permits one citation
repair call against the same evidence and criteria; both raw calls are retained.
Other schema/score/transport errors are not retried, and a second invalid
citation remains ERROR. Local checks add no model call. Routing is scored
deterministically and includes a second target call to
read selected Skill bodies; no second call is needed for an empty selection.

If the target must use a specific AWS profile independently of the user's Claude
settings, supply all three options: `--target-profile default --target-region
us-east-1 --model <Bedrock-model-id>`. This explicitly selects Bedrock for the
target, ignores user/project/local Claude settings in that child process, and
removes inherited static/bearer AWS credentials there so the selected profile
is used. It does not edit user settings or change the judge's separate profile.
Without these options the existing configured Claude provider remains in use;
the runner never automatically switches credentials after an error.

## Existing-project import execution

The unified execution catalog includes `import-confirmed-adoption-and-repeat`,
`import-partial-approval-and-repeat`, and `import-unknown-answer-stays-pending`.
Each runs three real fixture-tool turns: question report, user response and
adoption (or deferral), then an equivalent repeat. Turn snapshots plus recorded
mutations check approval timing, exact scope, Proposed state, original-file
preservation, and no-op behavior. Content and rationale remain semantic-judge
obligations; structural checks do not claim to understand prose.

Prerequisite cases also cover guarantee ownership across and within categories,
and decision graphs whose category projection would create a cycle. They check
that affected document writes remain pending while independent approved work can
proceed. Local verifier tests exercise missing guarantees or owners, dropped
dependencies and unauthorized writes; they validate the evidence checks, not
general model reliability. Use the same `--only import-` filter to include these
cases.

The `import-cycle-options-batch` classification scenario exercises one question
report across Commerce, Wallet, Access and Support. It compares independent
concept extraction, an inseparable merge and existing-owner orientation, with
exact guarantee ownership and proposed document changes. Local tests check
declared graph/record coverage and forbidden mutations; false prose explanations
are retained as GEval inputs, not classified by keyword checks. Select it with
`--suite classification --only import-cycle-options-batch`.

```bash
pnpm eval:skills --prepare --suite execution --only import- --runs 1
# Explicit model execution, separate from preparation and CI:
pnpm eval:skills --live --suite execution --only import- --runs 1
```

Cases may declare exact `artifactPaths` under `.adr-review/` for Markdown, JSON
or HTML reports. Only those additional files may be written; source/test files,
seeded rules, traversal and symlinks remain protected. This does not add report
move/delete permissions or expand other cases' default document access.
The same declarations reach the actual MCP transport and both comparison variants.
Discovery evidence requires a successful result paired to its read request and
the exact confined path; a request or matching filename suffix is insufficient.

## Rollup evidence checks

Rollup has separate planning and local execution-evidence checks.
`rollup-targeted-discovery` evaluates a proposed scope without executing reads.
`tests/rollup-execution-evidence.test.mjs` uses real fixture-tool results and
phase snapshots to check retrieved content, bounded exploration, evidence reuse
and changes between preparation and resume. Repeated/reordered reads and complete
search evidence are accepted; filenames or partial snippets cannot replace a
required original. These are instrumented local traces, not live-agent success
rates or a prescribed production tool sequence. Optional renumbering-reference
loading is checked separately.

## Read the result

The three suites deliberately report different evidence:

| Suite          | Evidence and limits                                                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classification | DeepEval GEval judges the response, files and tool events against fixed behavior obligations. Existing local checks also gate success where present. Never labeled task completion rate.                                                                                               |
| Routing        | Shipped name/description catalog → selected set → selected bodies. Required omissions and irrelevant selections are separate; optional allowed report support is excluded from required-route precision/recall. This is not native client installation/automatic routing verification. |
| Execution      | Actual files, replies, intermediate tool events, final deterministic checks and GEval obligation judgments. A passing judge cannot cancel a failed mandatory deterministic check.                                                                                                      |

A scored result is `PASS` or `NOT_PROVEN`; the latter can mean a demonstrated
violation **or insufficient evidence**. `ERROR` and `NOT_RUN` stay outside the
behavior-rate denominator but remain in requested/completed/error counts.
The report retains every case and trial, including failures and exclusion reasons.
Unknown cost is shown as unpriced calls rather than zero-cost service use.

The default semantic obligation uses the scenario's authored description, scoped
to the exact task and evidence. It is not generated from the model response,
machine tail or local scorer result. A scenario's explicit `obligations` (named export first, then the default object)
takes precedence, as in the approval digest; that path skips its legacy semantic
scorer to avoid double judging. The report-writer probes have separate obligations
for counts/denominators, evidence limits and presentation or review scope.
The drill-down probes add a comparison report, a causal incident explanation,
and a paired review of useful versus shallow nesting using the same supplied
facts. They check prerequisites, new explanatory content at each depth, and
visible limitations without requiring one heading list. Preparation only checks
the registered scenarios and artifacts; live model behavior and reader learning
gains are separate claims.
The abstraction probes keep one system's facts fixed while varying known novice
context, known API expertise, and absent reader context. They check an approachable
upper view, expansion of the same subject, analogy-to-concept mappings and limits,
and preservation of exact behavior. A paired review rejects cosmetic nesting,
raw-source substitution, invented familiarity, and unsupported analogy guarantees.
Select them with `--only report-drilldown-`; preparation makes no model calls.
The `report-drilldown-overview-` probes cover explicit C4-like requests, the
whole-process overview default, prose-only and unavailable-evidence paths, and
a review that recommends a feasible missing overview without failing delivery
solely for its absence. They judge useful figures and meaningful descent where
feasible, and accurate prose with limitations where figures cannot be supplied.
Renderer checks alone do not establish those semantics.
The `report-drilldown-visual-` pair checks a useful sequence within the detailed
timing explanation and rejects overview-only coverage, copied diagrams, and
forced figure quotas. Simple leaf facts may remain prose. It evaluates the
visual explanation and its location, not a required total number of figures.
The `report-drilldown-print-handout` probe checks expanded default delivery,
continuous print reading, and preservation of screen choices when print requires
temporary expansion. It does not claim that response evaluation verifies a real
browser's page layout. The HTML report opens every case by default regardless of
its outcome; a successful result is not a reason to hide its explanation.
The eight `report-scope-` probes load the shipped report hook, skill and delivery
references. They cover simple explanations, local reviews, complex flows,
unclear usefulness, explicit reports, chat-only overrides, an existing delivery
choice and mandatory workflow artifacts. They judge the proposed next response
and actions, not actual file creation, browser opening or native client routing.
A scenario may also supply `deterministicScore` alongside its explicit obligations,
using a named export or a property on the default object. The registered catalog
uses that same function, including its tool-scope guards. Named exports win when
both forms are present.
The unified runner then uses only those exact local checks plus GEval, while the
legacy runner retains `score`. Feature splitting keeps numeric ranges and tail
cardinalities local; SDK admission keeps file/index absence local. Their prose
meaning is judged by GEval so word order or nearby negation does not cause a
keyword-based false failure. A review-only report permits read-only evidence
lookup and forbids mutations; its rubric does not invent a no-tools restriction.
Generic description-based obligations are a starting rubric, not a claim of
human-calibrated judge accuracy. Existing keyword checks can still reject valid
paraphrases; inspect the separate local checks and GEval result when they disagree.

`test-case.json` stores the actual DeepEval input, output evidence and fixed
expected obligations. Target files and tool events are captured before local
scorers can create validation artifacts. The semantic judge therefore sees
transient writes/restores but never mistakes scorer-generated files for work
performed by the target. A semantic PASS cannot cancel a failed local check;
judge errors stay ERROR instead of falling back to regex success.

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
