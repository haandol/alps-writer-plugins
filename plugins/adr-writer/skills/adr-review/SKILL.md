---
name: adr-review
description: Review existing ADRs as documents — sweep every ADR (or one category) against the authoring rules R1-R20 and return a punch list. Report-only; never edits ADRs, the mapping, or code. Use when the user asks to review ADR quality, check abstraction level, verify requirement values survived, or audit ADRs without touching code. Keywords - "/adr-review", "ADR 리뷰", "ADR 품질 검토", "ADR 추상화 레벨 점검", "review my ADRs", "audit ADR quality".
argument-hint: "[category-or-adr-path?]"
---

# adr-review

> **Review results**: Apply [report-write](../report-write/SKILL.md), including when the user asks only for an ADR review.

Review ADRs that already exist **as documents** and return a punch list. With no argument it sweeps every ADR; with an argument it narrows to one category or a single ADR.

> **This is the document-quality axis.** It asks "should this decision be an ADR at all, is it written at the right abstraction level, and is every requirement it must carry still in it?" — never "does the code match?" The ADR admission gate rejects replaceable libraries, SDKs, frameworks, credential/auth adapters, and module structure even when their prose is polished. Pick the right command:
>
> Both halves of that question come from one principle (`concepts.md` "The abstraction ladder"): **PRD, ADR, and code are the same system at three resolutions**, and an ADR earns its place only while it can be read alone to answer "why this decision, and what must the result honor?" Detail pulled up from the code level makes it untrustworthy alone; a requirement pushed out of it lands in no level at all. Every R1-R20 finding is one of those two leaks, so read the sweep's findings as **"which ADRs stopped being readable at their own level"** rather than as a style audit.
>
> | Question                                                                      | Command                                                          |
> | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
> | Is the ADR written correctly? (abstraction level, requirements, alternatives) | **`/adr-review`** (this one)                                     |
> | Does the ADR match the shipping code, and fix the drift?                      | `/adr-sync [category]`                                           |
> | Did the implemented code honor the ADR?                                       | `/adr-impl-review [category]`                                    |
> | Reviewing a brand-new draft before saving it                                  | `/adr-new` (judges its own draft in step 6 — no separate review) |
>
> Reach for this one when you want ADR quality judged **without reading code** — a periodic audit, an inherited ADR set, or a check after hand-editing several ADRs. Since it never opens the codebase, it is far cheaper than `/adr-sync` and does not care whether the code exists yet.
>
> **This is the review path for an ADR nobody holds an authoring context for.** `/adr-new` does not call a reviewer: its author was walked through these same rules one turn before writing, so it self-checks at its step 6 and saves. That context dies with the session — so the moment an ADR is **edited by hand, changed by another session, or inherited**, nobody knows what its author was told, and this command is what supplies the missing independent read. Run it when the user asks, not on a schedule.

> **Report-only**: never edit an ADR, `.mapping.json`, or code. Return findings and let the user decide. That is what makes a full sweep safe — a sweep that also edited would fan one misjudgment across every ADR at once.

> **Language**: this skill and every other harness prompt are written in English. Write the human-facing report in the language the user explicitly requests or currently uses. If the conversation does not establish a language, use the target ADR's dominant language; for a sweep, use the dominant language across the reviewed ADRs. Keep technical terms when translation would reduce precision. Any user-facing phrasing below is a guide, not a literal string.

Apply `${CLAUDE_PLUGIN_ROOT}/references/non-invasive-harness.md`: the document
verdict and evidence are contractual, while the number and type of subagents,
parallelism, and model selection are execution details chosen by the current
model.

## Procedure

### 1. Fix the scope

- **No argument** → every ADR on disk. Enumerate `docs/adr/**/NNNN-*.md` **recursively** (e.g. `find docs/adr -name '[0-9][0-9][0-9][0-9]-*.md'`) so both flat keys (`docs/adr/auth/0001-x.md`) and two-segment feature sub-folders (`docs/adr/identity/login/0001-x.md`) are included. A non-recursive glob (`docs/adr/*/*.md`) silently misses the sub-folder ADRs.
- **A category key** (`auth`, `identity/login`) → the ADRs in that category.
- **An ADR file path** → that one ADR.
- `decision-log.md` is a convention file, not an ADR (`structure.md` "Decision log") — exclude it from the sweep. It gets its own lightweight check in step 5.
- If there are no ADRs at all, say so and suggest `/adr-new <category>`, then finish.

Then load `docs/adr/.mapping.json`, plus **only the rule-document sections this session itself needs** (falling back to `${CLAUDE_PLUGIN_ROOT}/templates/adr/`):

- `authoring-rules.md` — "Decision log" (step 5's by-eye check) and "Requirements live in the code and in the ADR" (the step 7 routing and the Prohibited guard).
- `structure.md` — "Anti-pattern categories" (the step 4 duplication finding) and "Decision log" (the step 1 exclusion).

**Do not load the rule documents whole here.** `adr-reviewer` owns R1-R20 and reads its own sections per ADR (see its step 1), so a full copy in this session buys nothing but pays for every token again — and the same division of labor is why step 3 tells you not to restate the reviewer's criteria. Read a further section on demand if an aggregation finding turns on it.

**Announce the scope before starting a full sweep.** For more than a handful of ADRs, print the count and the per-category breakdown and confirm once ("Reviewing 23 ADRs across 6 categories. Proceed?"). The model may use one or more review contexts depending on scope and capability, so the user should see the size before that cost is incurred.

### 2. Run the deterministic harness once, for the whole scope

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs [category]   # omit the argument to lint every category
```

Run this **once for the entire scope**, not per ADR — it already walks every ADR and the mapping in one pass. It mechanically settles the format, existence, and consistency half of the rules (Status enum and date format, required sections, canonical filenames, path depth, anti-pattern category segments, Decision Drivers and alternatives counts, Related links resolving, `dependsOn` integrity, mapping↔disk consistency and status↔body agreement, values written in code-constant form, and — internally via `adr-invariants.sh` — code→ADR and ADR→PRD back-references).

Keep the result and pass each ADR's slice of it to that ADR's reviewer, so the LLM never re-derives what the harness already proved. **Inherit, do not re-diagnose**: an item the harness reported as `error` goes into the final report as `FIX_REQUIRED (confirmed by harness)`.

**The harness never flags a bare number** — whether a value is a requirement (keep) or a tuning value (drop) is judgment, so it stays with the reviewer in step 3. This is deliberate: pushing an author to delete a requirement value is the failure mode this plugin guards against hardest.

### 3. Review each ADR against the `adr-reviewer` contract

For each ADR in scope, apply the `adr-reviewer` role contract. The role owns rules R1-R20 and is the source of truth for them; do not restate its criteria here.

Before choosing the execution strategy, read `${CLAUDE_PLUGIN_ROOT}/references/subagent-dispatch.md` completely. The model may use named reviewers, generic read-only subagents, main-session passes, or a mixture. It chooses the smallest strategy that keeps each ADR's contract and findings independently reviewable.

Whichever strategy is chosen, ground each ADR's judgment only in that ADR, its mapping entry, its harness slice, and the rule docs. Do not use another ADR's findings as evidence for this ADR. Cross-ADR patterns and contradictions are synthesized only in step 4. Record a context-isolation limitation only when it materially weakens confidence.

Pass each reviewer: the ADR path, that category's `.mapping.json` entry, and **that ADR's slice of the harness result**.

- Agent count and parallelism are not part of the report contract. The model may group mechanical loading work or reuse a context when it can still produce a complete per-ADR R19 regeneration check without anchoring on prior conclusions.
- Never collapse several ADRs into one combined verdict. Every ADR receives its own verdict, regeneration check, evidence, and comprehension-load line even when the execution strategy batches work.
- Require only the agent file's existing review-result format in the response.
- If the scope is large, tell the user the execution grouping, rather than silently reviewing a subset. Never truncate the scope without saying so.

Before scoring the first ADR, read
`${CLAUDE_PLUGIN_ROOT}/references/comprehension-load.md` completely. Apply the
same advisory score to every ADR in the sweep.

Only when the user asks to split, offer up to three candidates. Split ADRs only
for independent decisions. Keep one inherently difficult decision in one ADR
and offer implementation steps instead; never split by technical layer.

### 4. Aggregate — where the value of a sweep actually is

A per-ADR punch list is just N separate reviews. What a sweep adds is what only becomes visible **across** ADRs, so spend the aggregation effort here:

- **Recurring rule violations** — the same rule failing across many ADRs is a signal about the team's authoring habit, not about one document. Report it as one grouped finding with the ADR list ("R18a: requirement values blurred in 7 of 23 ADRs"), because the fix is a shared habit, not 7 unrelated edits.
- **Contradictions between ADRs** — two ADRs stating different values or rules for the same behavior (thresholds, allowed value sets, state transitions, error handling). Neither ADR's own review can see this, so only the sweep catches it. Record which ADRs conflict and on what, and route it to the user for a ruling — never pick a winner yourself.
- **Cross-category duplication** — the same decision recorded in two categories, which usually means the category boundary is wrong (`structure.md` "Anti-pattern categories") rather than that one ADR is bad.
- **Weak spots in the set** — categories where every ADR fails R12 (gray-zone substance), or an expected decision boundary implied by the ADR set has no owner. Do not infer missing decisions from code in this document-only command.
- **Prose style across the set (R20, advisory)** — report it as **one grouped finding for the whole sweep**, not per ADR: a house habit like passive-voice decisions or padded openers shows up everywhere at once, and N separate style nags would bury the findings that actually matter. Name the habit, give two or three representative rewrites, and list the affected ADRs. Never let style suggestions outweigh a `FIX_REQUIRED`, and never propose a cut that removes content.

### 5. Companion checks (cheap, and only where they need no code)

- **`decision-log.md`** in each category, if present — the harness already verifies its ADR pointers resolve (`decision-log-link-broken`), so trust that and only check by eye that no old ADR number is embedded in the prose, no PRD is cited, and it holds no duplicated current state or implementation constants (`authoring-rules.md` "Decision log").
- **Index hygiene** is fully covered by the step 2 harness (mapping↔disk, status↔body, `dependsOn` integrity) — report its result rather than re-checking.
- **Rule-doc health leads the report, above the per-ADR findings.** A sweep is the one command that reveals this as a set-wide fact: if the repo's rules predate an upstream rule, every reviewer in this run judged that axis against a document the project does not have, so the axis is unjudged across all N ADRs at once — a far larger hole than any single ADR's finding. Two kinds, both from the step 2 harness:
  - **Version lag** (`rules-doc-stale` / `rules-doc-unstamped`) — report which docs lag and which rules that costs.
  - **Layout lag** (`rules-doc-layout-legacy` / `rules-doc-layout-duplicated`) — the repo predates the `README.md` (index) / `concepts.md` (working model) split, or half-migrated and left duplicate sections behind. Say so plainly: the reviewers still found the material (they fall back to `README.md`), but a duplicated copy can drift from the one `concepts.md` holds, so a rule may have been judged against the stale half.

  Route the fix to `/adr-new` (its step 1 owns both and asks before overwriting hand-edits). Never refresh them here — this command is report-only.

- **Do not open the codebase.** R1's code-reality half and R17 (code→ADR back-references) need code, so they are out of scope here — say so explicitly in the report and route them to `/adr-sync`. Suppressing that boundary would let a reader mistake a clean `/adr-review` for "the ADRs match the code".

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

### 7. Route the follow-ups

This command stays report-only. Route what the user approves:

- **R3/R4 (implementation detail, code-readable content)** → edit the ADR body directly.
- **R18a (a missing requirement value or rule)** → this needs the user, not a guess. The code cannot tell you whether a value is a contract, so ask what the requirement is and record it with its basis (`authoring-rules.md` "Concrete numbers" / "Non-numeric requirements"). **Never invent a number.**
- **R12/R13/R14 (admission failure, weak gray zone, Drivers, alternatives)** → if the core subject is a replaceable implementation means, recommend retiring the ADR and moving useful detail down; otherwise strengthen the admitted decision.
- **A contradiction between ADRs** → the user rules on which value holds; then whichever ADR changes gets a `decision-log.md` line if the change is major (`authoring-rules.md` "What to log — minor vs major").
- **A wrong category boundary or a decision split across categories** → `/adr-sync` (its step 3.5 owns category realignment).
- **Anything needing the code** → `/adr-sync [category]`, or `/adr-impl-review [category]` when the question is whether the implementation honored the decision.

## Prohibited

- Never edit an ADR, `.mapping.json`, `decision-log.md`, or code — this command reports only.
- Never collapse several ADRs into one verdict or use one ADR's findings as evidence for another.
- Never silently narrow the scope. If you review a subset, say which ADRs were skipped and why.
- Never report a clean sweep as "the ADRs are correct" — it means the ADRs are well _written_. Consistency with code is `/adr-sync`'s verdict.
- Never propose deleting a requirement value because it looks like a constant, or a number because the code also holds it (`authoring-rules.md` "Requirements live in the code and in the ADR").
