---
name: adr-search
description: Find local ADR candidates by text, title or identifier with current source locations and Status. Use when locating an existing decision or requirement before reading its full contract. Read-only; does not replace admission, prerequisite or full-document checks.
argument-hint: "[query] [category]"
---

# Search local decisions

Run the plugin-local search with Bun 1.4.2 or later. No package installation,
database server or model call is needed.

```bash
bun "${CLAUDE_PLUGIN_ROOT}/scripts/adr-search.mjs" --query "<text>" --json
```

Use `--category <key>` for one category or bounded-context prefix,
`--adr-dir <directory>` for a custom document root and `--root <repository>`
when the command is launched elsewhere. Follow the returned page continuation;
`--limit` and `--offset` never change the source documents.

Unquoted words must all match one section, in any order. Double-quoted phrases
require adjacency. Matching preserves short Korean and substring searches,
normalizes compatibility forms/case/whitespace, and ranks direct identifiers
and titles ahead of incidental body matches.

Read the result's diagnostics, current and indexed Status, matched fields and
source locations. A title/summary hit identifies the document; body hits identify
the section. Relevance does not approve a decision or establish implementation
completion. Missing matches do not prove the absence of requirements.

Search helps locate plausible bodies. It does not replace the full mapping read,
prerequisite traversal, or reading plausible full ADRs on an admitted change.
Do not change code or contracts merely from a search excerpt or score.

The SQLite index is a disposable cache rebuilt from the current files. A missing,
corrupt or unwritable cache uses the same search in memory. Source errors remain
visible and incomplete. `--cache-dir` or `WRITER_SEARCH_CACHE_DIR` can select cache
storage; never register it as a decision, approval record or model artifact.
