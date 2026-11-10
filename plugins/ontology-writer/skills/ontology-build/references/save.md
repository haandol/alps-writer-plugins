# Save confirmed candidates

Read when candidate confirmation reaches the save stage. If a touched `Accepted`
process has uncommitted or unsynced direct edits, run `/ontology-sync` first. Read
[change meaning](../../../references/change-meaning.md) for same-meaning wording,
open scope and the conditions on renewing an `Accepted` date.

- Save only confirmed elements and relations, through the ontology's
  approval path in [the approved change unit](../../../references/change-unit.md):
  `impact`, one approval summary, `apply` and the cascade. Read it completely
  before preparing the approval. New processes start `Proposed`. Inferred, conflicting and unconfirmed
  candidates are never saved without the user's confirmation, and a candidate
  conflicting with the current model leaves the model unchanged until the user
  decides.
- Do not ask again for elements and relations confirmed in the report; the
  approval summary asks only for affected ADR revisions, index-link changes,
  existing processes that become `Proposed`, realizing candidates for unrealized
  system steps, ADR candidates for transferred content and glossary cleanup.
- When the report compared an existing model, keep its draft and the base hash
  its `impact` returned, and rerun that `impact` unchanged at save time. A
  different hash means the model, index, glossary, change log or an affected ADR
  changed since the report: re-present only the changed range.
- Build the save draft the same way — every current model document plus only
  the confirmed candidates (`ontology-candidates.mjs prepare --confirmed-only`)
  — and pass `apply` the base hash of the `impact` run whose comparison the
  approval summary showed.
- Unconfirmed paths are not saved. When they belong to one of the three axes,
  record them as open paths on the saved process or step; an axis the user says
  the business does not have becomes not applicable. Show these open-scope items
  in the scope confirmation.
- A saved basis holds its kind and a short sentence only — a regulation,
  contract or policy may be named with its article, but never a quote or an input
  file name, path or page. A rule or policy the user confirmed without a document
  basis has the basis kind `user-decision`.
- A concept saved where the glossary defines the same term asks for the glossary
  cleanup in the same decision; if the user declines it, that concept and its
  relations are not saved and are reported as remaining scope. Where the glossary
  names the term only in a table column that may hold other content (`possible` in
  `glossaryCleanup`), ask whether that cell defines it; only a definition is cleaned up.

Document text, source lists and locations, the candidate graph and the questions
stay in the disposable report; they never enter model attributes, the change
log, ADRs, the ADR index or the glossary. A candidate that matches an existing element — or one of its open-scope items —
reuses that element's identifier and wording unless a document states a change
of meaning, so running again with the same documents and the same model
changes nothing. When part of the reading or saving fails,
report the completed and the remaining scope separately.
