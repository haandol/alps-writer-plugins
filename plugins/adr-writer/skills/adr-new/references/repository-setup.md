# ADR repository setup

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

After the decision passes the gate, check the mapping state:

- Create `docs/adr/` if it does not exist.
- If `docs/adr/README.md` (and `concepts.md`, `authoring-rules.md`, `structure.md`, `decision-log.template.md`) are absent, copy all five of the same files from `${CLAUDE_PLUGIN_ROOT}/templates/adr/`. `decision-log.template.md` is a **read-only seed** — copy it to `docs/adr/<category>/decision-log.md` when that category gets its first major decision change; do not pre-create it in the category folder now (the log exists only after there is a transition to record).
- **If the seeded rule documents lag the installed plugin** (`rules-doc-stale`, `rules-doc-unstamped`, `rules-doc-layout-legacy` or `rules-doc-layout-duplicated`), read and apply `${CLAUDE_PLUGIN_ROOT}/references/rule-doc-refresh.md`. If the user declines, continue with the existing docs — the ADR you are about to write is judged by the rules the repo actually holds.
- If `docs/adr/.mapping.json` is absent, start the draft mapping in step 4 with an empty skeleton (`{ "categories": {} }`); create the repository copy only after approval.

Check for category bloat — once the category is settled, follow the inspect-and-propose procedure in `structure.md` "When a context grows — splitting into feature sub-folders". If the target folder (a feature sub-folder or directly under the context) holds 15 or more ADRs, propose a feature sub-folder split once; if the user accepts, target this ADR at the sub-folder (`docs/adr/<context>/<feature>/`) — the normal path by which a flat key like `pricing` grows into `pricing/<feature>`. Draft it there in the candidate tree and apply after step 7 approval. If they decline, or there are fewer than 15, continue with the flat structure and do not ask again.
