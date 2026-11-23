# Plugin distribution and report development

Read this guide when the matching task in `AGENTS.md` applies. Paths and commands
refer to the repository root unless a different base is stated.

## Plugin distribution

The two root manifests register all three plugins from their own directories under `plugins/`. Codex reads `.agents/plugins/marketplace.json` and Claude Code reads `.claude-plugin/marketplace.json`. Each plugin has client-specific manifests under `.codex-plugin/` and `.claude-plugin/`. The clients share the skills. Codex invokes them with `$skill-name` or natural language. Claude Code exposes them as `/skill-name`.

Codex plugin hooks set `PLUGIN_ROOT` and also set `${CLAUDE_PLUGIN_ROOT}` for Claude compatibility, so shared hook commands and skill instructions can retain the existing variable. The alps-writer Codex MCP config uses plugin-relative `cwd` and `./dist/index.js`.

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add alps-writer@alps-writer
codex plugin add adr-writer@alps-writer
codex plugin add ontology-writer@alps-writer   # optional business ontology
```

```
/plugin marketplace add haandol/alps-writer-plugins
/plugin install alps-writer@alps-writer   # PRD plugin (MCP server + skills)
/plugin install adr-writer@alps-writer    # ADR plugin (skills + hooks)
/plugin install ontology-writer@alps-writer   # optional business ontology
```

- **alps-writer** runs its MCP server from the committed bundle plus its local `skills/`.
- **adr-writer** ships local `skills/`, `agents/`, `hooks/`, and `templates/adr/`. Codex requires users to review and trust the bundled hook before it runs. No MCP.
- **ontology-writer** ships the business ontology skills, CLI and business-context hook.

The hook script (in adr-writer) is ESM (`.mjs`) and reads NDJSON events from stdin per the Claude Code hooks spec. The hooks configuration runs it with Bun; it uses only built-in modules (no extra deps), so the plugin requires nothing beyond Bun >= 1.4.2.

### Proportional implementation and review

An unchanged approved implementation proceeds at every comprehension-load score;
high load can prompt non-blocking split guidance. Independent Implementation
Hills may run in parallel/batches or become the primary work while another
verifies. Actual prerequisites and shared-resource conflicts retain their order.
Review mode uses changed protected surfaces and actual impact, not existing
implementation breadth. Standard can use a short Context, capability claims,
complete contract coverage and direct code evidence; detailed zooms are optional.
Selected rich interactions keep their existing delivery route. Compact standard
can render the final shared-report HTML directly from validated native artifacts.

### Shared report-writing skill

`shared/report-writer/` owns the common English skill, editorial guidance, formatting
rules, and dependency-free report helper. Mermaid syntax is checked with a vendored official parser;
HTML embeds the official browser engine and reports pending, rendered or failed
status honestly. The parser needs no runtime package installation, and the embedded engine loads
without network access. `mermaidRuntime({ packed: true })` embeds the same engine
gzip-compressed (about a third of its size) and unpacks it with the browser's
`DecompressionStream` before the first figure is drawn; the ontology views use it, reports keep
the plain engine. `scripts/sync-report-skill.mjs` copies the skill into
adr-writer and ontology-writer; the ADR diagram module and the process view use that same
implementation.
Edit the canonical source, then synchronize. `report-skill:check` rejects drift.
The responsive article layout lives in `scripts/report.css` within the skill;
code evidence rendering uses vendored diff2html and stays static in the delivered
HTML. `bun run report-assets:sync` refreshes the upstream bundle, stylesheet and
licenses from pinned development dependencies; `report-assets:check` checks
their bytes. The Mermaid assets include the browser engine and a parser bundle for the CLI runtime
with its DOM implementation and license notices. `bun run test:report-rendering`
checks actual SVG notation in an isolated headless browser and runs in `bun run test`.
It uses an installed Chrome/Chromium or `MERMAID_BROWSER_PATH`; marketplace runtime
and the bare-Bun test suite do not require a browser executable. Build refreshes those assets before synchronizing the skill. Keep
upstream assets unformatted and committed so marketplace installs and bare-Bun
tests need no package installation. Code diffs use the existing evidence controls
for screen disclosure and print inclusion; long lines wrap in print.
Use `--global` only when updating the user-level `~/.agents/skills/report-writer`;
normal builds never write to the user's home directory.

Review reports and supporting artifacts belong in a unique per-run directory
under `.adr-review/`, which is excluded from Git and formatting. Keep HTML,
Markdown, JSON, and reproduction evidence together; never store them in `docs/`
or the ADR index. Consumer projects follow the shared skill's local ignore
setup so review-only runs do not modify tracked configuration. Existing runs
remain available until the user chooses to remove them.

Only adr-writer advertises report-writer through SessionStart, independently
of the ADR mapping. ontology-writer carries a copy of the report-writer
skill for its own reports but registers no report hook, and ALPS Writer has no report
skill, report hook, or report-writer dependency; so the report directive still
appears once per session event. Select a report for explicit report requests or
when complex explanations and review findings need structured depth to be understood.
Answer short, simple requests in chat without report files, browser opening or quizzes.
If report usefulness is unclear, ask once before generating it, reuse the user's
choice for the same scope and continue independent work while waiting. Technical
subjects, review labels and length alone do not require reports. Preserve artifacts
explicitly required by a specialized workflow the user selected; do not infer that
requirement from a task label. The owning workflow still controls inspection,
verdicts, severity and edit permissions. The packaged skill directory
can also be installed independently with `bunx skills add`. See the [ADR Writer README](../../plugins/adr-writer/README.md) for the source path. Native review schemas remain complete audit input, while final
reports use domain-scoped hierarchy, at most four child explanation branches, readable paragraph
breaks, evidence-grounded diagrams, worked calculations, and whole-output review.
The renderer validates structure and source coverage; semantic review remains a
separate, explicitly reported step.

Reports include useful figures whenever evidence and format support them, from
the overview through the deepest explanation. Whole-system and multi-step
processes prefer a Mermaid overview after the brief background and answer, then
expand the same responsibilities. Figures are never a delivery gate, including
for top-down, C4-like or drill-down requests. Honor diagram exclusions and format
constraints; use prose with material limitations when a figure is not feasible.
Validate supplied figures and review their meaning separately from their presence.

Once a report is selected, default to standalone HTML. After
final verification, open the nonempty file once in the operating system's default
browser and return its absolute path. Explicit format or delivery constraints
take precedence. Keep native Markdown/JSON as supporting artifacts. Do not open
drafts or create an automation browser or local server merely to display a file.
If opening fails, preserve the HTML and report the path and actual reason.
Ordinary completion notices need no new report.

Report openings place separate localized `Purpose` and `Context` sections
(`목표` and `배경` in Korean) directly below the title, in that order.
Purpose states what this report should enable the reader to understand, decide,
explain or do. Context describes the confirmed situation, problem and request
trigger, with relevant scope and priorities. The answer and material limitations
follow immediately in their own display area. The Overview then shows how the
parts connect. Domain openings state their outcome before behavior and evidence.
Subsequent headings and organization follow the
report's subject and reader questions; preserve mandatory content without a fixed outline.
Collapsed branches explain
what opening them will clarify. Sources and quizzes support their owning
explanation without consuming its four-child allowance; both output formats
place child explanations before the parent's source evidence, and HTML also places
them before the parent's quiz. Review
what the reader learns with details closed and after opening one branch.
ADR writing preserves its required sections: Purpose introduces the problem,
intended outcome, and direction; the adjacent Decision Drivers retain all current
selection criteria; Decision owns the full choice, rationale, and exact contract.
Current reasons remain in the body even when the log records their role in a
major transition. Review both the opening alone and the whole document. The ADR reading
order is owned by `plugins/adr-writer/templates/adr/authoring-rules.md`; report
presentation is owned by `shared/report-writer/`.

Intent is durable judgment context for details an agent must decide autonomously.
Preserve the user's problem, intended outcome, and supplied priorities or scope
so a plausible local choice does not pursue a different purpose. Purpose and the
exact contract bound those choices; project conventions and convenience do not
override intent. Reversible details within the contract and authorized scope can
be chosen without routine approval. Intent does not authorize new policy or scope;
ask only when a material choice remains unresolved. This interpretation boundary
is not a new DDD context, fixed writing framework, schema, or approval registry.
Reports show how material autonomous choices and evidence serve that intent.
ADR readers and structure checks accept legacy `Context` as the Purpose section;
agent context, bounded contexts, and C4 Context views retain their names.

HTML reports actively use local interactive explanations when responsibility
expansion, condition changes or case comparisons help understanding. Preserve the
same subject from whole to roles and concrete behavior; topic tabs and control
counts alone do not establish depth. Keep exact source evidence, visible limits,
keyboard access and a static/print reading path. Interaction does not imply new
service execution or measured learning. The shared interaction reference owns
composition and verification guidance.

Include a core-content quiz in every HTML report; a report delivered only as Markdown
or plain text has none. If the user explicitly excludes it from an HTML report,
record the request in `comprehensionCheck.excluded`. Otherwise include at least
one medium-difficulty question, with four choices and one correct answer per
question. The whole-report cap is 10 for `beginner`, 6 for `intermediate` and 5
for `expert`. Use the least advanced level for a report spanning different levels.
The [reader profile](../../shared/report-writer/references/reader-profile.md)
sets the explanation level, including the beginner default. The
[comprehension guidance](../../shared/report-writer/references/comprehension.md)
covers question selection and the user's choice to start a conversational quiz.
The renderer validates and displays staged self-check and
print-safe answer hiding. Implementation review retains its native audit schema
and PR-readiness rules. Paragraph count is unrestricted; the four-child limit
applies to independent explanation branches. Default delivery uses semantic and
static artifact checks; browser interaction and actual print inspection run on
request and their actual coverage is reported.

### Cycle hooks layout (adr-writer)

| File                            | Event          | Purpose                                                                                                                     |
| ------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `hooks/surface-adr-context.mjs` | `SessionStart` | Inject a compact ADR admission directive on startup, resume, clear, and compaction recovery; never inject mapping contents. |

The cycle relies on the **main session model** for text understanding — the hook calls no auxiliary LLM and uses no intent regex. It supplies structured context; classification (and keeping the PRD → ADR → code flow intact) stays with the main model. There is deliberately no `PreToolUse` enforcement hook: the ADR ↔ code link is not stored, so a non-LLM hook can't map an edited file back to an ADR — that judgment belongs to the model.

The compact directive is injected when session context starts or is replaced (`startup`, `resume`, `clear`, `compact`). This restores it after compaction without running a hook for every user message. A request that passes the admission gate must read the full mapping and plausible ADR bodies before code changes; exempt requests do not pay that context cost.
