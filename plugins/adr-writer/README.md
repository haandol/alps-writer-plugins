# adr-writer

ADR-driven development cycle for Codex and Claude Code. The ADR admission gate records only durable requirements and architectural decisions, leaving replaceable libraries, SDKs, frameworks, and credential/auth wiring in code. User-facing authoring leads with decision intent and a Decision Digest, records one reviewable obligation and implementation-independent observable evidence per contract row, and keeps implementation defaults below ADR resolution. Edits and sync lead with semantic changes. Implementation and review use **Hiking**: the complete scope becomes one or more low vertical **Hills**, each representing a user flow, logical capability, or evidence-grounded bounded context. Review uses reading zooms: Context for intent/contracts/scope, Container/Hill for a vertical capability, Component for detailed implementation, and collapsed Code for a focused diff or current excerpt. Contract evidence remains co-located inside the owning Hill.

ADR digests, implementation plans, and document reviews also show an ephemeral `Comprehension load: N/10` line. Skills calculate it internally from five axes and a shared 1-10 calibration guide, with 4-6 as the recommended range. They never persist the score or use it as an approval or completion verdict. For `/adr-impl`, a score of `8/10` or higher pauses before implementation to ask whether to review a split or proceed with the original ADR; concrete split candidates appear only after the user chooses split review or explicitly requests a split.

## Non-invasive by design

Uncommon terminology is explained at first use and, when needed, preserved in
`docs/adr/glossary.md`. ADR authoring requires a clear user meaning, reuses supplied
definitions, and saves new or changed meanings under the existing ADR approval.
Conflicts are resolved before updating entries; unrelated entries are preserved.
The glossary has no ADR number, Status, or mapping entry. It is not a domain
classification exercise and never replaces the contract in an ADR body.

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

| Command                          | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/adr-new <category>`            | Apply the admission gate, then author a durable architectural decision directly; assumptions that could change the decision stay in Context or Decision Drivers, while implementation-only choices create no ADR                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/adr-impl [category]`           | Implement an ADR as vertical user-flow/capability/context Hills. Before the next Hill starts, record the current Hill's context, design/contracts, cross-layer implementation, targeted ideal/edge command, and observed result. Run full project tests and Review Hiking after every Hill has verified results. Comments reuse contract vocabulary but never cite an ADR. An unchanged approved ADR proceeds after a non-blocking plan update; project/domain defaults are resolved automatically and product-policy gaps become one Decision request. With no argument, lists Proposed ADRs and asks which to build |
| `/adr-impl-refactor [category]`  | Review efficiency, complexity, coupling, duplication, and proportionate reuse; apply only high-confidence local behavior-preserving refactors with before/after tests, using the smallest model-selected review strategy that preserves the safety gates                                                                                                                                                                                                                                                                                                                                                              |
| `/adr-impl-review [category]`    | Derive the complete implementation scope, write Context, classify question-level diagram requirements, and review each vertical Container/Hill through Component detail and focused Code diff/excerpt evidence. Select `standard` or `full` by risk and open the validated report through a content-fingerprinted local URL. Comprehension questions are optional and appear only on request or for high-load/broad reviews (report-only)                                                                                                                                                                             |
| `/adr-review [category]`         | Review **hand-edited or inherited** ADRs as documents against the authoring rules — no code read, report-only. The summary leads with the outcome and visualizes cross-ADR conflict, dependency, or duplication when useful. No arg → every ADR. Not run after `/adr-new`, which judges its own draft against the same rules                                                                                                                                                                                                                                                                                          |
| `/adr-sync [category] [--quick]` | Detect/repair drift between code and ADR, lead with semantic changes, and visualize complex decision, dependency, or unresolved contradiction flows                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/adr-rollup [category]`         | Consolidate ADR groups whose evolution history of one logical decision is split (no arg → all categories)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

The shared authoring rules and procedures (category-split, Status transitions, finding the code an ADR governs) live in `docs/adr/` (`concepts.md` — the principle, dependency model, and Status transitions; `authoring-rules.md`; `structure.md`; plus `README.md` as the index) — seeded from this plugin's `templates/adr/` on first run. Every command reads them as the single source of truth.

## Deterministic self-test harness

Six dependency-free scripts let the cycle verify ADRs and deliver implementation-review evidence without an LLM judgment call. The first two check that ADRs are well-formed. The materializer derives repeated Markdown evidence views from `findings.json`, the validator gates `/adr-impl-review` artifacts, the renderer builds a standalone HTML report, and the open helper validates that report before one default-browser open attempt.

| Script                                    | Scope                                                  | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/adr-invariants.sh`               | repo-wide, one-way dependency oracle                   | code→ADR (a) and ADR→PRD (b) reverse references; rollup stale citations (c)/(d). Exit 0/1/2, fail-closed on grep error. A consuming repo can wire it into pre-commit/CI. Its optional root `.adr-invariants-code-ignore` file excludes intentional examples or fixtures from code→ADR scanning only; ADR→PRD and rollup checks remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scripts/adr-structure-lint.mjs`          | per-ADR body + `.mapping.json` + disk state (Node ESM) | Status enum/date (R1), required sections, filename `NNNN-kebab` (no `fN-`), path depth ≤2, anti-pattern key segments (R5a), Decision Drivers count (R13), alternatives ≥2 (R14), Related-link existence (R10), `dependsOn` integrity (R16), mapping↔disk + status↔body consistency (R8), values written as code constants (R18 form half — `MAX_TURNS = 20` should read as a domain sentence; the harness never flags a bare number, because deleting a requirement value is the failure mode this plugin guards hardest against), and each `decision-log.md`'s ADR pointer resolving on disk — the one thing checked in an otherwise unindexed convention file, because a rollup renumber can orphan it and no other oracle sees it. Invokes `adr-invariants.sh` and folds its exit. |
| `scripts/adr-impl-review-materialize.mjs` | narrative `implementation-review.md` + `findings.json` | Deterministically fills the Abstract, Introduction, each educational Container/Hill, Components, Code diff/excerpt evidence, review diagnostics, contract cards, implementation choices, and visible four-option self-check prompts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `scripts/adr-impl-review-validate.mjs`    | `/adr-impl-review` artifact directory                  | Validates Context, vertical Container/Hill types, Components, focused Code evidence, exact contract assignment, question-level diagram triggers and requirements, hidden-answer comprehension questions, and evidence-complete `findings.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `scripts/adr-impl-review-report.mjs`      | validated `findings.json`                              | Renders a self-contained `adr-impl-review-report.html` with Context, Container/Hills, question-specific diagrams, Component detail, collapsed Code evidence, contract cards, findings, and an optional recall-first objective self-check with non-persistent revisit guidance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `scripts/adr-impl-review-open.mjs`        | rendered HTML report                                   | Rejects a missing or empty report, then opens a valid report through a size/mtime-fingerprinted local URL; unavailable openers keep the verified path and report the reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Run over a project's live ADRs:

```bash
node <plugin>/scripts/adr-structure-lint.mjs [category]   # deterministic structure + invariants
bash <plugin>/scripts/adr-invariants.sh                   # reverse-reference oracle only
```

`adr-structure-lint` handles the deterministic half of the reviewer's R-rules. `/adr-impl-review` derives complete implementation scope from the ADR, keeps the diff as separate change context, builds Context, selects visual questions and records each Hill’s diagram assignment or local omission, assigns every contract row exactly once across vertical Container/Hills, and records Component implementation plus focused Code evidence before synthesizing the verdict. Standard mode uses a decision ledger and sufficiency perspective; full mode adds separately grounded necessity and sufficiency perspectives. Both modes render the same validated Evidence Package and open it once in the host's default browser.

The abstract shows the verdict and next action before detailed evidence. Expand
the table of contents to navigate, or a comparison's evidence to inspect its
source. Sequence SVGs show participants, messages, and branches; component SVGs show
shared nodes, connections, and boundaries. Required diagrams must render.
Unsupported syntax retains the complete source for repair. In the optional
self-check, changing an answer hides the previous result until the next check.

The report uses a readable headline, sans-serif text, generous spacing, and thin
section rules. Its single stylesheet lives in `scripts/adr-impl-review-report.css`
and is embedded in the exported HTML, so sharing or reopening the report needs no
additional assets. Optional `findings.json.title` supplies a review-specific
headline; otherwise the document heading is used.

The materializer and HTML renderer share the same Hill prose composition. An
identical explanation field is shown once within that Hill; distinct actors,
conditions, units, code evidence, and other Hills are retained. The final writing
pass checks the generated output as well as the author's source.

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

For handouts, the report uses a white background and print styles that fit diagrams
inside the page. Comprehension check is a main section directly below the
conclusion. On screen, choices remain hidden until requested; in print, questions
and choices are visible while answers, feedback, selected-option marks, controls,
and detailed audit disclosures are omitted. The full evidence stays in HTML.

## Report writing

Use `/report-write` (or `$report-write` in Codex) for standalone reports. Review,
sync, rollup and implementation skills also load it before final human delivery.
The skill organizes content by domain with at most four peer units, uses Mermaid
for meaningful relationships, and reviews prose, worked calculations, paragraph
breaks and source support. Its helper renders HTML or Markdown without installing
packages. Existing structured review artifacts remain complete audit inputs.
