---
name: process-view
description: Open a read-only standalone HTML view of the business process model — the business landscape (bounded contexts, processes and the events and policies between them), each process flow, and element details with realization status computed from the ADR index — so the user can find what to change and then ask for it in natural language or edit the Turtle directly. Use when the user asks to see, browse or visualize docs/process. Keywords - "/process-view", "프로세스 보기", "업무 흐름 시각화", "process model view".
argument-hint: "[--include-retired]"
---

# process-view

This view is a navigation screen, not a review, evaluation or analysis report:
the report-writing contract does not apply, only its delivery rules. The view
never edits the model, the ADR index or ADRs, and it has no saving behavior.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/process-model.mjs view [--include-retired] [--lang en|ko] \
  [--no-open | --browser <name>]
```

- Use `--lang ko` when the user writes Korean; other languages use English labels.
- Include `Deprecated` and `Superseded` processes only when the user asks for
  them (`--include-retired`); they are marked retired.
- By default the file is written to a fresh, Git-ignored `.adr-review/` run
  directory and opened once in the default browser. Honor a request not to open
  it (`--no-open`) or to use a specific browser (`--browser <name>`).
- Report the absolute path the command prints and whether it opened. When
  opening fails, report the actual reason with the path.
- Without model documents the command creates no view; say that the repository
  has no business process model.

The view shows validation errors at their positions and marks the parts they
affect as incomplete; it marks uncommitted model edits and unsynced direct edits
of `Accepted` processes. A step is shown as implemented only when every realizing
feature has an `Accepted` ADR and no `Proposed` ADR; outside-system steps are not
realized by features, and a system step without a realizing feature is marked
unrealized. Realization is computed when the view is generated and is never
stored.

To change what the view shows, use `/process-edit` with a natural-language
request, or edit the Turtle document named in the element's details and run
`/process-sync`.
