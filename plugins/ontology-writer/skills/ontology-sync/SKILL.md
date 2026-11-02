---
name: ontology-sync
description: Bring direct edits of the business ontology back into the governed path — validate them, review them like a save, find their meaning against the last committed or last Accepted model, mark changed Accepted processes Proposed, report lifecycle edits, glossary coexistence and pending ADR rows, and propose the downstream propagation with one approval summary. Distinct from /adr-sync, which compares ADRs with code. Keywords - "/ontology-sync", "온톨로지 동기화", "모델 직접 편집", "ontology drift".
argument-hint: "[process-id?]"
---

# ontology-sync

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

Read `${CLAUDE_PLUGIN_ROOT}/references/ontology.md` completely. A direct
edit is a change the user wrote in the Turtle documents; this skill confirms it
the same way `/ontology-edit` confirms a requested change, without overwriting
it. Without `docs/ontology/*.ttl` there is nothing to sync; say so and stop.

## 1. Validate before reading meaning

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs impact --base HEAD --json`
and judge structure by its model findings (`draftValid`, `findings`), the check
a drafted change gets. Index links left by deleted steps are not a reason to
stop: they are index-link changes for the summary, listed in `linkChanges` by
the comparisons below. Then review each edited process like a save: the three
axes (start, end and normal flow; performers and rules; exceptions, rejections
and hand-offs) each have elements, an open path or a confirmed not-applicable
item, and every rule relying on another feature's state reaches the step
changing it. If either fails, report the positions or missing items and start no
propagation from that edit.

## 2. Find the direct edits

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs changes --json
node ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs lifecycle --json
```

- **Uncommitted edits** compare with the last committed model:
  `impact --base HEAD`.
- **Committed edits of an `Accepted` process** compare with the model where its
  current `Accepted` Status appeared: `changes` lists the process in
  `unsyncedAccepted` with that commit as `since` — or a commit right after ones
  history cannot read, where a change of its Status may hide, when HEAD differs from
  it. Summarize each with
  `impact --base <since> --process <id> --json`, which leaves out other
  processes' changes, and the same way against each commit in `alsoSince`: the other
  commits where the Status may have last appeared (another branch's acceptance, or a
  commit right after ones history cannot read). A change against any of them counts,
  and a renewal must keep the business composition against all of them. `compositionChanged: false` means only open scope changed;
  it is never grounds for `transition --to Proposed`.
- **History `changes` cannot read** — `committedUnavailable` (a partial clone, a
  model document linked from outside the repository, a submodule) or
  `unsyncedUnknown` (a shallow clone, an `Accepted` Status that first shows
  after commits history cannot read, or two or more commits in a row history cannot
  read on the way to it) — makes it exit non-zero: those committed edits are
  unknown, never absent. When `changes` reports no flags at all
  (`available: false`: not a git work tree, a model directory outside the
  repository, or git unable to read HEAD's model), every edit of an `Accepted`
  process is unknown: report each as unchecked. For a shallow or partial clone,
  fetch the missing history (for example `git fetch --unshallow`) and run `changes`
  again; for history that cannot be read, or when fetching is not possible, report
  each such process as unchecked and keep treating it as possibly edited directly. When `lifecycle` reports that it could not audit history
  (`historyUnavailable`) or only partly (`historyLimited`), report those lifecycles
  as unchecked too. `uncommittedDocuments` lists documents that differ from HEAD when the
  committed model cannot be compared element by element; read them to find the
  edits.
- **Two or more commits in a row history cannot read** may hide the Status of an
  `Accepted` process leaving and coming back on a composition nobody can see
  (`unsyncedUnknown` gives that reason; a process whose Status the documents that do
  parse there show throughout is not listed). Report the process as unchecked and ask the
  user whether those commits changed its business composition. If the user confirms
  they did not, run `transition --process <id> --to Accepted --unread-unchanged`: it
  renews the `Accepted` date as for a confirmed edit, and once that is committed the
  next comparison starts after those commits. Otherwise mark the process `Proposed`
  (`transition --process <id> --to Proposed`) for an alignment review. Each process
  takes its own answer.
- **Judge meaning before any transition**, as `/ontology-edit` §4 does: pass each
  changed text the user confirms keeps its meaning to the `impact` run that
  compares it, as `--same-meaning <id>=<property>`. An `Accepted` process that
  run still lists in `processesToPropose` — after an uncommitted or a committed
  edit — changed its business composition. A changed business composition makes
  the process `Proposed`: run `transition --process <id> --to Proposed`. This
  detection is a lifecycle transition Ontology Writer performs.
- **Renew a confirmed `Accepted` process.** When the user confirms that a direct
  edit of an `Accepted` process changes only open scope or keeps its meaning, run
  `transition --process <id> --to Accepted [--same-meaning <id>=<property>]...`:
  it renews the `Accepted` date so the confirmation becomes the next comparison's
  baseline and the edit is not flagged or asked again. It refuses when the
  business composition changed, the alignment gates do not hold or a lifecycle
  edit is pending; report that instead. On the day of the process's current
  `Accepted` date the date cannot change: it says so, and the edit stays flagged
  until it is confirmed again on a later day — tell the user. The renewal becomes
  the baseline once it is committed: ask the user to commit the renewed Status
  with the edit before the next ontology sync, which otherwise compares it with
  HEAD again.
- **A `Proposed` process** keeps its Status. Compare its model meaning with its
  realizing ADRs and propose only the meaning they do not reflect yet; do not ask
  again for a change already approved.
- **Lifecycle edits** — a Status or replacement changed by hand — are errors to
  report. A process added by hand may only be `Proposed`. `lifecycle` audits,
  from repository history, the change that produced each process's current
  lifecycle state, so committed hand edits are reported too; a process removed
  and added again is judged as one change, from its last state before the
  removal. One limit remains: history cannot tell a committed promotion to
  `Accepted`, a committed re-dating of `Accepted` whose composition or open scope
  changed, or a committed retirement with its change-log line from one Ontology Writer
  made when its gates held — none is reported, nor a hand edit committed together
  with one. An uncommitted promotion or renewal whose gates hold is the
  `ontology-lifecycle-needs-alignment` warning, and an uncommitted retirement with
  its change-log line the `ontology-lifecycle-needs-approval` warning; one whose
  gates fail is an error. When the user says a promotion, re-dating or retirement
  was made by hand, treat it as a lifecycle edit. No save goes in while the working
  tree holds a lifecycle edit made by hand or a retirement it did not approve:
  commit an earlier approved unit first, or report the edit. Nor does one go in
  while HEAD's model cannot be read, because such an edit could not be told from
  an approved one: make HEAD's model readable as the refusal says first.
- An alignment difference that arose without a model change is a lower-level
  alignment issue for the ADRs or the code; it changes no process Status.

## 3. Report what the model and the ADR level disagree on

- **Glossary coexistence.** When a business term is defined both in the model and
  in `docs/adr/glossary.md` (`ontology-glossary-overlap`), propose removing the
  glossary entry if the meanings are the same; otherwise ask which meaning stays.
  When the entry is a heading that only organizes other terms, propose rewording that
  heading instead of removing its section; when it is a detail of another term's entry
  (a facet line or a details-table row), propose rewording its label instead of
  removing the detail.
  `ontology-glossary-mention` names the term in a table column that may hold other
  content: ask the user whether that cell defines the term, and if it does, treat it
  as an entry; if not, leave it.
  The warning covers the layouts the reader recognizes, so also read the glossary
  yourself for every concept and context the model owns: a direct edit of the
  glossary can create a coexistence no model change touches.
- **Pending rows.** Search the realizing ADRs of the affected features for
  contract rows marked pending on a business change, and report each with the
  change it awaits.
- **Missing compliance contracts** an `/adr-sync` or ADR review reported come here
  as alignment issues; include them in the propagation.

## 4. Propose the propagation

Read `../ontology-edit/SKILL.md` §§5–8 and follow them for drafting, the one
approval summary, approval and the cascade; do not work from memory of them.
Run the transitions of §2 first. Then build the summary from a fresh
`impact --base <ref> [--also-base <commit>]... [--process <id>] --json` run with the
drafted `--mapping` and `--glossary` and the `--same-meaning` list of §2 — with
`--also-base` for each `alsoSince` commit `changes` named, so the summary holds what
changed against any of them and binds every ADR any of them affects — because a
transition rewrites a Status line and changes the bound state, and without that
list a renewed process would show as becoming `Proposed`. The save accepts
Ontology Writer's own transitions of §2 and refuses the lifecycle edits §2 names: one
made by hand, a retirement it did not approve, and any while HEAD's model cannot
be read. The model edit is already the user's: save the
approved index, glossary and change-log changes with
`apply --base <ref> [--also-base <commit>]... [--process <id>] --base-hash <hash>`,
passing the same bases, process, `--mapping`, `--glossary` and `--same-meaning`
list as the `impact` run the summary showed.
It never rewrites the model, and its base hash binds the commits those bases
named and the ADRs that run listed as `affectedAdrs`. When `apply` refuses because the bound state changed, compare
each affected ADR with the version the draft started from, keep the user's newer
edit, and re-present only the changed range.

If the user rejects the summary, the direct edit stays, the process stays
`Proposed`, and no ADR changes. Never store a sync record; the next run derives
the same comparison from the history and the documents.
