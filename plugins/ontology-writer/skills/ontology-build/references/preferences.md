# First-model preferences

From the project directory, run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/ontology-preferences.mjs"` with the arguments below. The CLI shares user-local settings across Codex and Claude Code and across the same repository's Git worktrees. Outside Git, it uses the current project directory.

| Request                                      | Arguments                                                         |
| -------------------------------------------- | ----------------------------------------------------------------- |
| Show the choices                             | `show` or `show setup` / `show adr-review`                        |
| Remember the answer to the creation question | `set setup build`, `set setup skip`, or `set setup later`         |
| Remember the chosen ADR review route         | `set adr-review review-first` or `set adr-review build-direct`    |
| Ask again next time                          | `reset setup` or `reset adr-review`; reset both only if requested |

An unset choice is `null`. Store the explicit answer to an unanswered question
or an explicit change to the default. A one-time request overrides the saved
choice for that run only. Silence, missing ADRs and unavailable tools are not
answers. A direct build request with no saved setup choice can be recorded as
`build` unless it was for this run only.

Any saved setup choice suppresses the automatic creation question, including
“later” until the user asks to build or resets the choice. A saved “build” does
not start work in a new conversation. Use the saved review route only during a
currently requested first build with existing ADRs. Store only those two
choices. Actual review findings, ADR edits and model saves follow the current
workflow and its approvals.

If the helper fails, explain which preference could not be read or saved.
An explicit current instruction can still be followed for this run. Only
report a choice as remembered after the helper succeeds.
