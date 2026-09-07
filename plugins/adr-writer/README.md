# adr-writer

ADR-driven development cycle for Codex and Claude Code. The ADR admission gate records only durable requirements and architectural decisions, leaving replaceable libraries, SDKs, frameworks, and credential/auth wiring in code. User-facing authoring leads with decision intent and a Decision Digest, records one reviewable obligation and implementation-independent observable evidence per contract row, and keeps implementation defaults below ADR resolution. Edits and sync lead with semantic changes. Human-facing review reports use the user's language when established, otherwise the target ADR or review scope's dominant language. They start with verdict, impact, action, and risk, explain ADR intent, then follow the most important verified flow. Multi-step algorithms and control/data flows require grounded Mermaid diagrams; diagrams may appear in `Visual map` or any narrative section, with multiple diagrams when they explain distinct relationships. Simple local changes record why a diagram is unnecessary. Implementation-review HTML groups findings into fix, decision, verification, and suggestion tasks; each card shows impact, expected and observed behavior, requested change, edit target, and completion criteria before collapsible technical evidence. A shared reader-first pass removes repetitive contrast templates, ornamental labels, forced list symmetry, filler bridges, duplicate visuals, and invented narrative. The complete ADR remains authoritative for decisions and contracts; review summaries remain disposable views over code.

ADR digests, implementation plans, and document reviews also show an ephemeral `Comprehension load: N/10` line. Skills calculate it internally from five axes and a shared 1-10 calibration guide, with 4-6 as the recommended range. They never persist the score or use it as an approval or completion verdict. For `/adr-impl`, a score of `8/10` or higher pauses before implementation to ask whether to review a split or proceed with the original ADR; concrete split candidates appear only after the user chooses split review or explicitly requests a split.

## Non-invasive by design

adr-writer is a removable harness over durable artifacts. ADRs retain admitted
decisions, rationale, and requirement contracts; code and tests retain
implementation truth; project conventions remain in README, AGENTS.md, and
CONTRIBUTING. Plans, review transcripts, model choices, and agent topology are
ephemeral. Uninstalling the plugin does not invalidate the artifacts or leave a
hidden approval or execution registry behind.

The skills constrain observable outputs, evidence, allowed actions, escalation,
and lifecycle transitions. They do not request private chain-of-thought or
prescribe a model's internal reasoning sequence. The active model decides
whether a review uses no subagent, one, or several; named or generic roles;
parallel or sequential execution; and which available model performs a role.
The required review perspectives, contract coverage, tests, verdicts, and
Status behavior stay the same.

When an approved ADR revision is unchanged, `/adr-impl` presents its plan as a progress update. Plans below `8/10` are non-blocking; plans at `8/10` or higher wait only for the split-review-versus-original-ADR choice, then continue without another plan approval. It fills logical consequences of the explicit contract, established repository conventions, and authoritative reversible domain defaults without asking the user to restate them. Gaps with several valid product outcomes are consolidated into one Decision request containing a recommendation, basis, alternatives, impact, and exact ADR wording.

Every named function or method created or materially changed for ADR behavior uses the repository's language-standard documentation form, such as GoDoc or a Python docstring. The comment explains why the function exists and how it enforces the behavior, reusing contract vocabulary for searchability without citing an ADR number, path, link, or source label. Every implemented behavior also receives an ideal-case test and its relevant edge cases; happy-path-only coverage cannot complete the cycle.

**Standalone**: adr-writer requires no ALPS PRD and never references the `alps-writer` plugin. ADRs are its first-class artifact; code is implemented from ADRs. `docs/adr/.mapping.json` (the ADR index) stores no PRD reference. The ADR ↔ code link is not stored anywhere — an agent finds the code an ADR governs by reading the ADR and searching the repo, so refactors never churn a stored mapping.

## Install

**Codex**

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add adr-writer@alps-writer
```

**Claude Code**

```text
/plugin marketplace add haandol/alps-writer-plugins
/plugin install adr-writer@alps-writer
```

## Slash commands

| Command                          | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/adr-new <category>`            | Apply the admission gate, then author a durable architectural decision directly; assumptions that could change the decision stay in Context or Decision Drivers, while implementation-only choices create no ADR                                                                                                                                                                                                                                                                                                                                           |
| `/adr-impl [category]`           | Implement an ADR in code with language-standard why/how function documentation and ideal plus relevant edge tests. Comments reuse contract vocabulary but never cite an ADR. An unchanged approved ADR proceeds after a non-blocking plan update; project/domain defaults are resolved automatically and product-policy gaps become one Decision request. On request, keep one Feature/ADR intact and offer dependency-ordered Stacked PR delivery when semantic splitting is inappropriate. With no argument, lists Proposed ADRs and asks which to build |
| `/adr-impl-refactor [category]`  | Review efficiency, complexity, coupling, duplication, and proportionate reuse; apply only high-confidence local behavior-preserving refactors with before/after tests, using the smallest model-selected review strategy that preserves the safety gates                                                                                                                                                                                                                                                                                                   |
| `/adr-impl-review [category]`    | Derive the complete implementation scope from every ADR decision and contract row, select `standard` or `full` by risk, explain ADR intent and the major flow, and open the validated report through a content-fingerprinted local URL. Comprehension questions are optional and appear only on request or for high-load/broad reviews (report-only)                                                                                                                                                                                                       |
| `/adr-review [category]`         | Review **hand-edited or inherited** ADRs as documents against the authoring rules — no code read, report-only. The summary leads with the outcome and visualizes cross-ADR conflict, dependency, or duplication when useful. No arg → every ADR. Not run after `/adr-new`, which judges its own draft against the same rules                                                                                                                                                                                                                               |
| `/adr-sync [category] [--quick]` | Detect/repair drift between code and ADR, lead with semantic changes, and visualize complex decision, dependency, or unresolved contradiction flows                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/adr-rollup [category]`         | Consolidate ADR groups whose evolution history of one logical decision is split (no arg → all categories)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

The shared authoring rules and procedures (category-split, Status transitions, finding the code an ADR governs) live in `docs/adr/` (`concepts.md` — the principle, dependency model, and Status transitions; `authoring-rules.md`; `structure.md`; plus `README.md` as the index) — seeded from this plugin's `templates/adr/` on first run. Every command reads them as the single source of truth.

## Deterministic self-test harness

Six dependency-free scripts let the cycle verify ADRs and deliver implementation-review evidence without an LLM judgment call. The first two check that ADRs are well-formed. The materializer derives repeated Markdown evidence views from `findings.json`, the validator gates `/adr-impl-review` artifacts, the renderer builds a standalone HTML report, and the open helper validates that report before one default-browser open attempt.

| Script                                    | Scope                                                  | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/adr-invariants.sh`               | repo-wide, one-way dependency oracle                   | code→ADR (a) and ADR→PRD (b) reverse references; rollup stale citations (c)/(d). Exit 0/1/2, fail-closed on grep error. A consuming repo can wire it into pre-commit/CI. Its optional root `.adr-invariants-code-ignore` file excludes intentional examples or fixtures from code→ADR scanning only; ADR→PRD and rollup checks remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scripts/adr-structure-lint.mjs`          | per-ADR body + `.mapping.json` + disk state (Node ESM) | Status enum/date (R1), required sections, filename `NNNN-kebab` (no `fN-`), path depth ≤2, anti-pattern key segments (R5a), Decision Drivers count (R13), alternatives ≥2 (R14), Related-link existence (R10), `dependsOn` integrity (R16), mapping↔disk + status↔body consistency (R8), values written as code constants (R18 form half — `MAX_TURNS = 20` should read as a domain sentence; the harness never flags a bare number, because deleting a requirement value is the failure mode this plugin guards hardest against), and each `decision-log.md`'s ADR pointer resolving on disk — the one thing checked in an otherwise unindexed convention file, because a rollup renumber can orphan it and no other oracle sees it. Invokes `adr-invariants.sh` and folds its exit. |
| `scripts/adr-impl-review-materialize.mjs` | narrative `implementation-review.md` + `findings.json` | Deterministically fills At a glance, ADR contract coverage, Notable implementation choices, and visible comprehension prompts so the model does not maintain duplicate Markdown and JSON copies of the same evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `scripts/adr-impl-review-validate.mjs`    | `/adr-impl-review` artifact directory                  | Validates the At a glance handoff, intent-first narrative, structured visualization decision, required Mermaid map, hidden-answer comprehension questions, decision ledger, implementation choices, evidence-complete `findings.json`, and conditional repair guidance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `scripts/adr-impl-review-report.mjs`      | validated `findings.json`                              | Renders the common standard/full Evidence Package as one self-contained `adr-impl-review-report.html` with task-grouped action cards, easy-language contract states, collapsible technical evidence, Markdown and compact Mermaid rendering, optional self-check, and ruling controls only for human-decision findings.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `scripts/adr-impl-review-open.mjs`        | rendered HTML report                                   | Rejects a missing or empty report, then opens a valid report through a size/mtime-fingerprinted local URL; unavailable openers keep the verified path and report the reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Run over a project's live ADRs:

```bash
node <plugin>/scripts/adr-structure-lint.mjs [category]   # deterministic structure + invariants
bash <plugin>/scripts/adr-invariants.sh                   # reverse-reference oracle only
```

`adr-structure-lint` handles the deterministic half of the reviewer's R-rules. `/adr-impl-review` is the pre-promotion completion gate and an on-demand audit of an existing implementation. Every invocation derives the complete implementation scope from the ADR, traces direct and indirect call paths plus related tests, and keeps the diff as separate change context. Standard mode uses a decision ledger, a sufficiency perspective, concise notable implementation choices, and targeted tests for localized implementations; full mode adds separately grounded necessity and sufficiency perspectives. Both modes reject missing or source-referencing language-standard function documentation and happy-path-only test coverage, render the validated Evidence Package to `adr-impl-review-report.html`, and run `adr-impl-review-open.mjs` to open it once in the host's default browser. The report starts with the outcome and ADR intent, then shows task-grouped findings with the reason, expected and observed behavior, requested change, edit target, and completion criteria. Complete audit fields remain in `findings.json` and collapsible technical evidence. The local self-check can reveal criteria only after answer entry, while semantic grading remains an explicit later request and never changes the implementation verdict or ADR Status.

## Hook

One hook supports the main session — **no external LLM calls**; the main model classifies text and decides.

| Hook           | When it fires                          | Role                                                                                                       |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SessionStart` | Startup, resume, clear, and compaction | Inject a compact ADR admission directive; admitted work reads `docs/adr/.mapping.json` before code changes |

The directive first applies the ADR admission gate. Requirement contracts, durable boundaries, provider/model choices, key designs, algorithms, and fallback policies enter the cycle and trigger an on-demand read of the full mapping and plausible ADR bodies; replaceable SDKs, libraries, frameworks, and credential/auth adapters stay in code. The hook never blocks an edit, injects mapping contents, or dictates private reasoning or agent topology. Running at session start, resume, clear, and compaction recovery keeps the directive available without executing on every user message.

Claude Code discovers `hooks/hooks.json` automatically; its manifest does not register the file a second time. Codex registers the same file once through its client-specific manifest. In both clients the only event is `SessionStart` — there is no `UserPromptSubmit` hook.

## Troubleshooting

### Amazon Bedrock rejects a subagent request

Codex sessions using Amazon Bedrock can fail immediately after a review skill starts a subagent:

```text
{"error":{"code":"validation_error","message":"invalid request body: Invalid 'input': value did not match any expected variant","type":"invalid_request_error"}}
```

Codex multi-agent workflows use a hosted Responses API orchestration action. The [Codex Bedrock guide](https://developers.openai.com/codex/amazon-bedrock) explains that the Bedrock path does not use OpenAI's hosted Responses API and that hosted features are unavailable there; the [multi-agent guide](https://developers.openai.com/api/docs/guides/responses-multi-agent) describes that orchestration action. With the current Bedrock transport, disable multi-agent before starting the session so the invalid request is never sent:

```toml
[features]
multi_agent = false
```

Put that setting in the `~/.codex/config.toml` used by the Bedrock session, then start a new Codex session. Existing subagent threads may retain the failed request state.

The review skills degrade as follows:

| Skill                | Bedrock / no-subagent behavior                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/adr-review`        | Reviews ADRs sequentially in the main session and reports that isolated contexts were absent                                     |
| `/adr-impl-review`   | Runs the required perspectives as separate main-session passes and reports the isolation limit                                   |
| `/adr-impl-refactor` | Uses the available review path; automatic application still requires local scope, exact evidence, and passing before/after tests |

If provider identity was unavailable and the validation error occurs once, the skills do not retry another named or generic subagent in that command. The plugin never edits a user's Codex configuration automatically.

## Relationship to alps-writer

The companion [`alps-writer`](https://github.com/haandol/alps-writer-plugins) plugin writes ALPS documents. `/feature-to-adr` transfers each implementable Feature's complete contract into one or several ADRs and delegates new decision owners to this plugin's `/adr-new`. After handoff, ADRs are the implementation authority and the PRD is a legacy planning document. Explicit re-import is an ALPS-side semantic comparison; this standalone plugin never reads the PRD.

## License

[MIT](../../LICENSE)
