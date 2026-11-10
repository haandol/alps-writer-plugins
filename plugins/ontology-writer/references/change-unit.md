# Approved ontology change unit

Ontology-edit owns these shared rules. Read this module completely after the
caller has validated and classified its draft or direct edit, before preparing
downstream revisions and the approval summary. Build supplies confirmed
candidates; sync supplies the current direct edit and its comparison bases.
Neither caller bypasses this approval or the cascade.

## Prepare the downstream changes

ADR revisions and their implementation belong to the separate adr-writer plugin.
When the impact report lists affected ADRs, confirm that adr-writer's `/adr-new`
and `/adr-impl` are available. If adr-writer is not installed, stop before the
approval summary: say that this change needs adr-writer, name the affected ADRs
and write nothing. A change that affects no ADR continues without it.

- **Affected ADRs.** Read the ADRs of the directly affected features and of the
  features realizing steps of processes that become `Proposed`. Draft each
  needed edit-in-place change in the same disposable space using adr-writer's
  `/adr-new` draft rules: compliance contracts at feature resolution, changed contracts,
  pending rows where a meaning awaits another approval. Never weaken or delete a
  contract or feature automatically; a deletion candidate keeps its current
  contract until the user confirms it. `affectedAdrs` lists the ADR files of the
  affected features, and the base hash binds them; `affectedAdrReasons` gives each
  file's reasons (`direct`, `proposed-process`, `relinked`). Leave an affected ADR
  unrevised only when its current contract already holds the changed business
  meaning — for example a new link to a step its feature already implements, with
  the hand-off compliance contracts already there — and record that reason; it
  keeps its content and Status.
- **Unrealized system steps.** For every system step without a realizing feature,
  new ones included, apply the ADR admission gate and the decision identity check
  and present an existing-ADR update or a new ADR candidate, or the reason there
  is none.
- **Index links.** Prepare the `.mapping.json` change: every `linkChanges`
  entry — a link to a removed step or to a step of a retiring process — removed
  or moved, links of new realizing features added.
- **Glossary.** When the model would define a business concept or context term
  the glossary also defines, propose removing that entry as part of the same
  decision. The summary's `glossaryCleanup` covers the layouts the glossary reader
  recognizes, so also read `docs/adr/glossary.md` yourself for the concepts and
  contexts the change saves. When the entry is a heading that only organizes other
  terms, propose rewording that heading (for example `## Payment terms`) instead of
  removing its section. When it is a detail of another term's entry — a facet line
  such as `- **Category**: …` or a row of a details table — propose rewording that
  label (for example `- **Kind**: …`) instead of removing the detail. If the meanings
  differ, ask which meaning stays. Without the user's
  choice, neither delete the entry nor save the concept. If the user declines
  the cleanup, do not save that concept or the relations using it, and report the
  remaining scope. A `glossaryCleanup` item marked `possible` is the term's name in a
  table column that may hold other content (a context, a category, a related term):
  ask the user in the same decision whether that cell defines the term. If it does,
  clean it up as an entry; if not, leave it — the save does not stop for it.
- **Change log.** For each major change the impact report lists as a candidate —
  and you confirm changes meaning — write one line with its reason.

## One approval summary

Show, in one summary: the model's semantic diff in business language; the
affected features found through the index; the index-link changes; the processes
that become `Proposed`; for each affected ADR whether it is revised and why, and
for each revised ADR the semantic diff of Decision, Decision Drivers, requirement
contract and Consequences and its regeneration checklist (group the unrevised ones
by reason, one line each); new realizing candidates; the glossary cleanup decision; change-log
lines; and any Turtle comments the rewrite drops. Approving it approves exactly
the shown ontology change and ADR revisions; do not ask again for the same
revision in `/adr-impl`.

## Apply the approved change unit

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs apply --draft <draft> \
  --base-hash <hash from impact> [--same-meaning <id>=<property>]... \
  [--mapping <draft mapping>] [--glossary <draft glossary>] \
  [--log "<id>: <change> — <reason>"]... [--allow-comment-removal]
```

The command above applies a draft. A direct-edit sync uses its prepared
`apply --base <ref> [--also-base <commit>]... [--process <id>] --base-hash <hash>` command instead;
that mode never rewrites the model. Keep the selected comparison mode and scope.

Run `impact` for the summary with the drafted `--mapping` and `--glossary`, and
pass `apply` the base hash of that run with exactly its `--mapping`,
`--glossary` and `--same-meaning`: the hash binds those drafts and the ADRs of
every feature whose links they change, so an existing ADR offered as a
realizing candidate is bound too. `apply` checks the whole unit before the
first write, then writes the model in canonical form, sets every process whose
composition changed to `Proposed`, and writes the index, the glossary and the
change-log lines together; if a write fails, it restores every file it touched.
When it refuses because the bound state changed after the summary — the model,
index, glossary, change log, draft, an affected ADR or the confirmations —
nothing was written: compare each affected ADR with the version the draft
started from, keep the user's newer edit, rerun `impact`, and re-present only
the changed range. For any other refusal, fix what it reports, rerun `impact`
and re-present anything the fix changes. Then save the approved ADR revisions
in place; each revised ADR is `Proposed` through
`bun ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs`, this plugin's copy of
adr-writer's transition.
A renewed `Accepted` date becomes the comparison baseline once the saved unit is
committed; ask the user to commit it before the next ontology sync. `apply`
refuses while the working tree holds a lifecycle edit made by hand or a
retirement it did not approve: commit an earlier approved unit first, or run
`/ontology-sync` to report the edit. It also refuses while HEAD's model cannot be read — a committed document that does not
parse, one linked from outside the repository or kept in a submodule, objects missing
locally — because a lifecycle edit made by hand could not be told from an approved
one: make HEAD's model readable as the refusal says first.

## Cascade and report

- Run adr-writer's `/adr-impl` for the revised ADRs in prerequisite order. No revised ADR is
  reported complete before its prerequisites. An unrevised affected ADR keeps its
  Status and is not re-implemented.
- When the last revised ADR becomes `Accepted` — or right after `apply` when no
  ADR was revised — run `/ontology-align` for each process that became
  `Proposed`.
- When implementation or the alignment review fails part way, the process stays
  `Proposed`; report the completed and the remaining features separately, never
  as a full success.
- If the user rejects the summary, write nothing.

Never store approval state, comparison baselines or review results as a record;
they come again from the repository history and the current documents.
