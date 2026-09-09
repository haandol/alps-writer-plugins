# Decision Log: <category>

This document is the **major decision-change history** of the <category> category. Each
ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

<!-- Rules:
  - Reverse order (newest first). Major changes only — replacing the adopted alternative,
    inverting a Driver, a core algorithm/architecture change, a bug fix that changes
    behavior, a requirement value change, a requirement rule change (allowed set added or
    removed, mandatory → optional, a permission change, a forbidden transition allowed),
    a supersede, and retirement with no replacement.
    Minor items (correcting implementation facts, renaming an enum identifier, refining
    boundary wording, rephrasing) are not recorded — Git preserves them. For the criteria
    see authoring-rules.md "What to log — minor vs major".
  - Never duplicate the current state (that is the ADR body's job) — the currently valid
    requirements live in the ADR body, so do not copy them here. No implementation
    constants or field tables. But for a transition where a requirement value or rule
    changed, write it on the "What" line as old → new (that is the content of the transition).
    This log and the ADR's Alternatives section are the only places where a replaced
    identifier or previous value should be named for comparison.
  - Never reference the PRD (ALPS).
  - Never embed an ADR number in the prose — point at it only through the single
    "Current ADR" link.
  - This file is a convention file — it is not registered in .mapping.json and
    adr-structure-lint does not check it (it is not enumerated as an ADR because it does
    not start with NNNN-).
  - Replace the example entry below with real content when recording the first major transition. -->

## YYYY-MM-DD — <one-line change summary>

- **Current ADR**: [<kebab-title>](./NNNN-kebab-title.md)
- **Change type**: algorithm | architecture | adopted alternative replaced | Driver inverted | requirement value change | requirement rule change | behavior-changing bug fix | retirement
- **What**: <previous approach → current approach, one or two sentences at the decision level>
- **Why**: <the change in the driver or constraint that prompted this>
- **What is now void** (optional): <the Consequences the previous decision left that no longer apply>

<!-- adr-writer:rules-version 0.8.18 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
