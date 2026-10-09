# Implementation target and ADR changes

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

1. **Identify the target ADR**

   Branching by argument:
   - **The argument is a file path** → target that single ADR file. **If the path does not exist on disk**, do not stop immediately — it may have been moved by a rollup renumber, so look for it once:
     - First check on disk for a kebab-title match in the same category directory (`docs/adr/<cat>/*-<title>.md`, the ADR whose post-number string matches) — this works without git and is the simplest.
     - If the match is ambiguous or absent, confirm it via git rename history: `git log --all --diff-filter=R --name-status -- '*<title>.md'` (or grep the old path out of the `git log --all --diff-filter=R --name-status` output) prints the old→new mapping on a single line in the form `R100  docs/adr/<cat>/<old>.md  docs/adr/<cat>/<new>.md` — the clearest signal. (`git log --follow -- <old-path>` on the old path also tracks the rename and shows the commits, but it does not give you the new path at a glance, so use `--diff-filter=R --name-status`.)
     - Once found, confirm with "`<old-path>` was moved to `<new-path>` by a rollup. Shall I implement this file?" and then take the new path as the target. If you still cannot find it, fall back to "Printing the Proposed list" below.
   - **The argument is a category key** (e.g. `auth`, `identity/login`) → match it against the **category keys** in `docs/adr/.mapping.json`. Category keys are derived canonically from the feature name (`identity/login`). A key like `f1` — used when there was no feature name and a purely numeric workshop id was used as the fallback key — is also interpreted as-is; this is literal category-key matching, not a Feature ID lookup (the mapping has no field that holds a Feature ID). If the user gave only the feature segment without the context prefix (`login`) and the same feature name exists in multiple contexts, so it is ambiguous, ask once which context they mean (this happens only rarely, in multi-context repos that use grouping).
   - **When the argument is empty, the match is ambiguous, or there is no mapping / mapping file** — show the list of ADRs in `Proposed` state (not implemented) all at once and ask the user which ADR to implement (the "Printing the Proposed list" procedure below).

   **Procedure for printing the Proposed list**:
   1. If `docs/adr/.mapping.json` exists, iterate over every category. If not, walk `docs/adr/**/*.md` **recursively** (e.g. `find docs/adr -name '[0-9][0-9][0-9][0-9]-*.md'`) to build the ADR file list — it must include **both** flat keys (`docs/adr/auth/0001.md`) and 2-segment feature sub-folders (`docs/adr/identity/login/0001.md`). Do not use a non-recursive glob (`docs/adr/*/*.md`), because it misses 2-segment sub-folder ADRs entirely.
   2. Read each ADR file's `## Status` section and keep only `Proposed` ones (exclude `Accepted`, `Deprecated`, `Superseded`).
   3. Show the user the following format once and take their selection:

      ```
      There are N ADRs that have not been implemented yet. Which ADR should I implement?

      1. identity/login — Email signup (docs/adr/identity/login/0001-email-signup.md)
      2. identity/password-reset — Password reset (docs/adr/identity/password-reset/0001-password-reset.md)
      3. cart — Cart totals (docs/adr/cart/0003-cart-totals.md)

      Answer with a number or a category key (e.g. `identity/login`). To implement several at once, answer like "1,2" or "identity/login, cart".
      ```

   4. Once the user answers, take that selection as the category argument and go back to the beginning of step 1.
   5. **If there are 0 Proposed ADRs**, tell the user _"Every ADR is already implemented. To record a new decision, write the ADR first with `/adr-new <category>`. You can also use `/feature-to-adr` to batch-convert ALPS Section 7 features."_ and finish.
   6. **If there is not a single ADR on disk at all**, tell the user _"There are no ADRs yet. Write one directly with `/adr-new <category>`, or if you have ALPS Section 7 features, convert them with `/feature-to-adr` and call this again."_ and finish.

   Once the target ADR is identified, check its current Status — this command handles the `Proposed → Accepted` transition automatically. If an ADR that is already `Accepted` is given as the implementation target, apply the ADR admission gate to the requested change before treating it as an ADR change. A replaceable library, SDK, framework, middleware, module layout, credential provider chain, signer, authentication adapter, or other behavior-preserving reinforcement leaves the ADR and its `Accepted` Status untouched throughout implementation and review; scope it in the implementation plan instead. Do not demote an unchanged `Accepted` ADR to `Proposed` merely because code is being edited or reviewed. If an admitted decision or requirement changed, classify from the request whether the intent is a partial change or reinforcement; if that distinction is ambiguous, carry the one unresolved question into the single step 3 baseline approval instead of asking separately here. At this point, apply the **decision identity check**: the target remains the owner when it still answers the same architectural question and owns the same requirement or system/data/security/external boundary, even if the provider, adopted alternative, Decision Drivers, or direction changed. If **the decision itself changed because of a requirement or architectural change** (not a mere implementation correction — for the judgment call see `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"), reflect the new decision in that ADR body as the current state (edit-in-place), revert Status to `Proposed`, and proceed with this implementation. A GPT-5.6 provider change from Amazon Bedrock to the OpenAI API, and a later return to Bedrock, both update the same provider-boundary ADR when one current-state record still describes the choice. During that rewrite, apply `authoring-rules.md` "Final-state wording": state the requested result directly in the body and mapping summary, and remove replaced identifiers, previous values, and migration narration that add no current contract. Keep rejected choices in Alternatives and major old → new history in `decision-log.md`; never delete a current prohibition that passed the requirement gate. **A request that changes only a requirement value or rule ("max 7 turns → 10 turns", "retention 30 days → 90 days") also falls here** — even though it looks like editing a single constant in the code, a system behavior requirement has changed, so do not touch the code first; update the ADR's requirement contract to the new value first (`authoring-rules.md` "Requirements live in the code and in the ADR") (after the tests and step 6 completion review pass, step 7 will auto-promote it back to `Accepted` — `concepts.md` "Automatic transition rules"). If that decision change is **major** (swapping the adopted alternative, reversing a Driver, changing the core algorithm/architecture, changing an external provider, reverting to a former provider, or a bug fix that changes behavior — `authoring-rules.md` "What to log — minor vs major"), leave a one-line entry in the category's `decision-log.md`. Judge it a supersede **only when the decision topic has branched and the old decision must coexist as a separate record**; in that case create a new ADR with `/adr-new`, leave the old one as `Superseded`, and take that new ADR as the implementation target (a supersede is also major, so log it).

   **Every Status transition in this workflow must use the deterministic status script.** Do not edit a Status value with `apply_patch`, regex replacement, or a search for the first matching string — `.mapping.json` commonly contains many identical `Proposed` or dated `Accepted` values. After updating the ADR decision text, use:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs <target-adr-path> Proposed --summary "<current one-line decision summary>"
   ```

   The script addresses the mapping record by its exact ADR `path`, requires exactly one match, refuses a pre-existing body/index mismatch, and updates the body and index together.

   **Once the target is identified, never go straight to step 3 (planning) under any circumstances. You must perform the step 2 dependency check first.** Whether it is a single ADR or the user picked several at once like `1,2` / `f1, f2`, step 2 is taken without exception.
