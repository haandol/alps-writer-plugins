# Classify an ontology change

Read before deciding whether a draft or direct edit changes business meaning or
a process lifecycle. These are ontology-edit rules shared by build and sync.
Keep same-meaning confirmations separate from structural changes.

## Meaning and lifecycle

- From the impact report, separate meaning changes from formatting, same-meaning
  wording and description edits. Only a meaning change — an added or removed
  element or relation, or a fact attribute whose meaning changed — moves Status
  or ADRs. When you cannot settle whether a wording keeps its meaning, show that
  part as unconfirmed; never save it as a no-op before the user confirms.
- Pass every changed fact-attribute text the user confirmed keeps its meaning to
  `impact` as `--same-meaning <id>=<property>`, and build the summary from that
  run. The change stays in the diff marked `sameMeaning: true` but makes no
  process `Proposed`, affects no feature and is no change-log candidate.
  Relation, type and structure changes never qualify.
- `processesToPropose` lists the processes whose business composition changed:
  they become `Proposed`. Open scope alone and description edits make no process
  `Proposed`. When a saved change touches an `Accepted` process only through
  confirmed same-meaning wording or open scope, `apply` renews its `Accepted`
  date — if nothing else changed since it became `Accepted`, no lifecycle edit is
  pending and the alignment gates hold — so the next comparison starts from that
  confirmation; otherwise it saves without renewing and says why. On the day of
  the current `Accepted` date the date cannot change, so the edit stays flagged
  until a later confirmation; tell the user.
- Elements and relations another path already confirmed are not asked again;
  when the model that confirmation relied on changed, re-present only the changed
  range.
