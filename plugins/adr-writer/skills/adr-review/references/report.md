# ADR document review report

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 6. Report

Before writing the human-facing report or chat summary, read
`${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` completely and apply
it. Keep the reviewer agents' raw punch lists unchanged; the aggregation layer
owns the junior-facing explanation and any Mermaid visualization.

```
## ADR Review Sweep

### At a glance
- Verdict: <what the sweep concluded>
- Impact: <what this means for a developer or reviewer>
- Action: <the next required action, or "None">
- Risk: <what remains uncertain or unjudged, or "None">

### Scope
- ADRs reviewed: <n> (categories: <list>)
- Rule docs: <in sync at X.Y.Z | STALE — <docs> lag the installed X.Y.Z, so <rules> went unjudged across all <n> ADRs → refresh via /adr-new>
- Doc layout: <README index + concepts working model | PRE-SPLIT — no concepts.md, reviewers fell back to README.md → /adr-new | DUPLICATED — README.md still holds <sections> that concepts.md owns, so a rule may have been judged against the stale copy → /adr-new>
- Harness: <pass | n errors, m warnings>
- Unjudged axes: <none | <rules> — <why: the repo's rule docs lack that section, a reviewer could not reach it, or the scope was batched>, so those rules went unjudged across <n> ADRs>
- Not covered here: ADR↔code consistency (R1 code-reality, R17) → /adr-sync

### Verdict
<n> PASS · <n> FIX_REQUIRED · <n> BLOCK

### Visual map
<the smallest grounded Mermaid required by the shared report guide, or omit this section>
Notice: <the one relationship the reader should verify>

### Cross-ADR findings
- [Recurring] R18a — requirement values blurred: <adr list>
- [Contradiction] <ADR A> ↔ <ADR B> — <what conflicts> (user ruling needed)
- [Duplication] <ADR A> ↔ <ADR B> — same decision in two categories, category boundary suspect
- [Gap] <category> — no ADR for <decision the set implies>

### Per-ADR
- <path> — FIX_REQUIRED — Comprehension load: <N>/10
  - [R18a] <short diagnosis> — <quote>
    Fix: <one line>
- <path> — PASS — Comprehension load: <N>/10

### Prose style (R20, advisory)
- <the house habit, with 2-3 rewrites and the affected ADRs — or "clean">

### Suggestions
- <the shared habit worth changing, or the next command to run>
```

Order the per-ADR section **worst first** (BLOCK, then FIX_REQUIRED, then PASS) so the reader meets the expensive problems first, and keep PASS entries to one line each.

**A `PASS` count is not a clean bill of health while an axis went unjudged.** The per-ADR verdict stays the reviewer's three values (`PASS` / `FIX_REQUIRED` / `BLOCK`) — do not invent a fourth — but an ADR can only be judged against the rules its reviewer could actually reach, so a rule nobody evaluated silently rides along inside `PASS`. That is why `Unjudged axes` sits in Scope, above the verdict: when it is non-empty, **say in the chat summary that the PASS count excludes those rules** rather than reporting "N passed" flat. This is the same discipline `/adr-impl-review` applies with `INCONCLUSIVE` — unverified must never read as verified — expressed without disturbing the reviewer's verdict vocabulary.

**Summarize in chat rather than dumping the whole report**: the At a glance
verdict, impact, action and risk, then the two or three ADRs that need attention
most. For a large sweep, write the full report to a file and give the path.

Lead the chat summary with the four questions a reader must answer: **Decision** (what was chosen), **Contract** (what the result must honor), **Rationale** (why this option won), and **Risk** (what remains costly, uncertain, or unjudged). Keep rule IDs, quotations, paths, confidence, and detailed evidence in the full report unless they are needed to understand an actionable finding. Progressive disclosure must never hide a requirement value, a `BLOCK`, or an unjudged axis.
