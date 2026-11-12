---
name: reader-profile
description: Build, refresh, show, correct or delete the per-project reader profile that report-writer uses to pitch explanations at the user's level. It reads only the user's own typed messages from this project's Claude Code and Codex sessions, with personal and business identifiers removed, and stores a short per-area profile outside the repository. Use when the user asks to create or update their profile or understanding level for reports, or agrees when report-writer asks.
argument-hint: "[build|refresh|show|delete]"
---

# Reader profile

Follow [reader profile](../report-writer/references/reader-profile.md) with its
script `../report-writer/scripts/reader-profile.mjs`. This skill owns the
explicit requests; report-writer reads the profile and asks before a missing or
stale one is built.

- **Build or refresh:** run the [build or refresh](../report-writer/references/reader-profile.md#build-or-refresh)
  steps. Run them only when the user asked for it or agreed to report-writer's
  question; never read sessions otherwise.
- **Show:** run `status` and read the file at its `profilePath`.
- **Correct:** apply the user's correction to the profile and pipe the result to
  `save`; the check must pass before anything is written.
- **Delete:** run `delete`.

The profile records only each area's `level`, what the user `knows` and what is
`unfamiliar`. It never contains personal data, business-sensitive details,
quotations of messages or judgments of the person. The extracted messages stay
in context only and are never written to a file. Report what was saved or
deleted and the profile path; do not echo extracted messages back.
