---
name: ontology-view
description: "Open the read-only business ontology UI: domains/BCs, business processes and realizing ADRs share one hierarchy in EventStorming and 3D. Use to browse or visualize a saved model or explicit draft; supplied evidence stays separate from model adoption."
argument-hint: "[--include-retired]"
---

# ontology-view

This view is a navigation screen, not a review, evaluation or analysis report:
the report-writing contract does not apply, only its delivery rules. The view
never edits the model, the ADR index or ADRs, and it has no saving behavior.

Use the bundled viewer. Its hierarchy is **domain/BC → business process →
realizing functional ADR** in both EventStorming and 3D. The process is the
business unit; existing ADR categories and source folders do not define it.
Business structure guides ADR contracts and code organization. Read the final
ADR contract without opening a source-code exploration layer.

## Open the requested scope

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs view [--include-retired] [--lang en|ko] \
  [--no-open | --browser <name>] [--draft DIR] [--mapping FILE] [--board FILE]
```

- Use `--lang ko` when the user writes Korean; other languages use English labels.
- Include `Deprecated` and `Superseded` processes only when the user asks for
  them (`--include-retired`); they are marked retired.
- By default the file is written to a fresh, Git-ignored `.adr-review/` run
  directory and opened once in the default browser. Honor a request not to open
  it (`--no-open`) or to use a specific browser (`--browser <name>`).
- Without model documents the command creates no view; say that the repository
  has no business ontology. An explicit `--draft DIR` previews an unadopted model
  without saving it. Use `--mapping FILE` for its proposed realization links.
- Use `--board FILE` only for supplied, validated business evidence. Domain
  membership uses provided identities and verdicts; do not infer it from ADR
  paths or names. For evidence the model cannot supply, read
  [additional viewing evidence](references/evidence.md) before preparing a board.

## Explain the result and limits

Return the absolute path and actual open result. Report validation errors,
incomplete knowledge, uncommitted/unsynced changes or unreadable sources; do not
present an unchecked scope as complete. A draft is separate from saved-model
history and adoption approval.

The two expressions share scope, search, page, selection and return path. Shared
processes and ADRs retain identity, and category-level realizes links do not
prove that every ADR directly implements every associated activity. The viewer
reads only indexed Markdown within the real ADR root; an unreadable document is
not permission to open other files or execute source text.

Realization comes from current ADR Status: every realizing feature needs an
Accepted ADR and no Proposed ADR, excluding retired ADRs. Outside-system and
unrealized system steps remain distinct. This is not proof of business
sufficiency or execution success. For those questions, use `/ontology-sync`'s
read-only review or `/ontology-align` respectively; the view executes neither.

The renderer owns camera controls, motion and detailed presentation. When
explaining or enriching its EventStorming evidence, use the semantic and source
rules in [the board contract](../../references/eventstorming-board.md), rather
than reconstructing facts from visual placement. Source/model changes go through
`/ontology-build`, `/ontology-edit` or authorized direct-edit reconciliation.
