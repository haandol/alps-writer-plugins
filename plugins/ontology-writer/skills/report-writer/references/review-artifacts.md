# Review artifact storage

Review reports and supporting evidence are disposable local outputs. Keep them
out of source and durable documentation directories, including `docs/` and
`docs/adr/`. This applies to code, PR, ADR, architecture, and document reviews,
as well as audit, sync, rollup, and refactor reports. Authoritative documents
changed by an authorized workflow still belong in their normal locations.

## Prepare one ignored directory per run

Use the reviewed project's root, not the installed plugin directory. In a Git
worktree, use that worktree's root. Create `.adr-review/` and establish its Git
exclusion before writing any report or evidence:

- Reuse an existing ignore rule if it covers the entire directory. Otherwise,
  create `.adr-review/.gitignore` containing `*` on its own line. This excludes
  both the local ignore file and the run directories without editing tracked
  project configuration. Preserve an existing local ignore file; append the
  rule only if needed. Do not edit it if it is already tracked.
- Verify the local ignore file and a prospective run artifact with
  `git check-ignore`, and check `git ls-files -- .adr-review` for tracked files.
  Ignore rules do not untrack existing files. Do not automatically untrack,
  move, overwrite, or delete previous outputs during a review.
- Allocate a fresh `.adr-review/<timestamp>-<review-kind>-<scope>-<unique>/`
  directory. Use a filesystem-generated unique suffix or exclusive directory
  creation with collision retry, so repeated or concurrent reviews cannot
  overwrite each other. Reuse that directory for passes within the same run.
- Pass its absolute path to the participating roles and output commands. Keep
  final HTML/Markdown, JSON, reproduction files, and supporting evidence there.
  Preserve required artifact filenames and schemas. Verify links from the new
  location, and provide the final report's absolute path to the user.

If the local directory cannot be safely created or fully ignored, use a fresh
directory under the system temporary directory and report that actual path and
the reason. In a project without Git, use the same local directory layout and
local ignore file, but do not claim Git verification. Honor an explicitly
requested output location; do not silently relocate it or change the user's
tracking choice.

## Keep outputs disposable

Do not stage review artifacts, add them to an ADR mapping, or treat them as
approval state or implementation authority. Do not create tracked indexes or
latest-report pointers. A review-only run must leave tracked files unchanged
and add no untracked review files to normal `git status` output. Compare status
before and after without disturbing changes that were already present.

Review runs may accumulate locally. Do not impose automatic expiry, cleanup,
or deletion of earlier runs. They can be removed later without changing the
source, ADR contracts, or future review behavior.
