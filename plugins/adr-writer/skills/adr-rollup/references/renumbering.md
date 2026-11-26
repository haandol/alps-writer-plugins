# Requested number cleanup

**Preserve existing numbers and gaps by default.** A `numbering-gap` warning is
advisory, not a reason to propose or perform renumbering. If the user already
chose to keep gaps, do not ask again for the same gaps.

Only when the user requests number cleanup, prepare the moves:

- **The request names exact old → new paths**: that request approves those
  paths, so do not ask again. Move only the named paths. Before moving, show the
  external-link impact and the old → new table in the same response, and keep
  the table in the completion report.
- **The request names no paths**: first present every old → new path and its
  external-link impact, then move only the paths the user approves.

Keep relative order within the approved leaf category and include independent
ADRs affected by a rename in the explicit scope. Renumber only categories
participating in this rollup; other categories remain untouched. Choose a safe
move mechanism, such as `git mv` for tracked files, and update each title number,
index entry, Related link, and decision-log current-ADR link together. Detect
occupied destinations and source changes before applying; do not overwrite a
file merely to obtain consecutive numbers. Plan moves without destination
collisions, using temporary names within the approved scope when necessary.

**Default when the user does not respond or the answer is unclear: leave the gap.**
Include every old → new path in step 10. Generic rollup approval that omits these
paths does not authorize renumbering, and named paths do not authorize moving
any other file. No reply is not approval to apply any other unapproved
destructive action either.

## External impact

The step 7 renumber corrects every reference inside the repo in step 8, but effects remain outside the repo and in history tools. These are trade-offs rather than losses, so proceed with them in mind:

- **External links break**: URLs in PRs, issues, wikis, and bookmarks that pointed at the old path (`docs/adr/<cat>/0004-...md`) return 404 after the renumber (GitHub gives no redirect for a file rename). Show this impact with the "old path → new path" table before any move, and repeat the table in the step 10 completion report so the user can update external references.
- **Reading history**: a rename may affect line attribution immediately after the change. Choose history tools that recover the original decision changes; `git log --follow` and `git show` are available examples for Git repositories.
- Keeping gaps avoids these path changes and is the default. Only prepare the
  number-cleanup option when the user requests it.
