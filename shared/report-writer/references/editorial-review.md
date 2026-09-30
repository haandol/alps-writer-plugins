# Editorial review

These are meaning checks, not an AI-authorship detector. Use them for reports in
any language or format. Report-only requests remain report-only.

## Establish the reader's context

### Explain intent as the boundary for judgment

A report should make it possible to judge whether an agent's discretionary
choices served the user's original purpose. Explicit requirements leave details
open; clear intent reduces the risk of filling those gaps with choices aimed at
a different outcome. Preserve the affected user, problem, desired result, and
any supplied priority or scope that materially distinguishes a suitable choice.
Do not invent intent, incidents, business impact, or exclusions to justify the
implementation after the fact.

For each material autonomous choice, explain the relevant intent, the choice
and its basis, and the observed consequence. Use a concrete example when it
helps: a hypothetical review assistant may group findings to help a person
inspect risk, but automatically approving changes to save time exceeds that
purpose and authority. A passing test or a common convention does not by itself
show that a choice serves the user's intended outcome.

Distinguish a safe detail chosen within the contract and scope from a protected
product policy or scope expansion requiring a decision. Several suitable local
implementations are not a reason to ask for approval. If intent is unclear only
on a material choice, identify that gap and the smallest needed decision; do
not label every unspecified detail a missing requirement.

Open with the localized "Background and goals" heading and short request context
below the title, then immediately state the answer and material limitation.
Check that subsequent headings fit this report rather than fill a universal
outline, while retaining mandatory content. Check that the opening explains why the report
exists and what the user wants to understand, decide, or achieve, not merely
which operation was requested. Retain only supplied background; an absent motive
is not permission to invent one. Use the existing domain hierarchy to connect
purpose, behavior, and evidence. Review meaning: could a
reader use this intent to distinguish a plausible but purpose-defeating choice,
and do the reported acceptance checks actually cover the intended outcome?
Preserve unverified limits and do not mistake expected benefits for measured
results.

### Check continuity at each reading depth

Source verification and reader comprehension are separate. A fact in the
conversation may be true but still missing from the report the reader receives.

- Read the title and opening alone: can a reader distinguish this task from
  concurrent work, identify why it was requested and the intended outcome, then
  find the answer, its significance, and any condition that changes the conclusion?
  Then scan headings and each domain's first paragraph: can the reader choose
  where to inspect the explanation or evidence without reconstructing the
  author's investigation? A title such as "Analysis" or a list of component
  names does not supply that orientation by itself.
- At a meaningful transition, identify what the reader has learned so far and
  what the next paragraph assumes. Locate the earlier passage that establishes
  the task, event, constraint, or referent; a repeated noun alone is insufficient.
- State what the new passage adds: evidence, an example, a condition, a result,
  a distinction, a judgment, or useful orientation.
- Try removing an empty opening sentence. If the next sentence establishes the
  situation better without losing meaning, remove the setup rather than adding
  a smoother connector.
- Re-read entry and exit transitions after moving or rewriting a passage.
  Preserve useful answer-first domain openings after the initial request context;
  do not repeat background everywhere.
- Check every reading depth for a misleading simplification. A shorter overview
  may defer exact evidence, but must retain a caveat, failure, or exception that
  changes its answer. Details must substantiate or qualify the parent claim;
  a new unrelated claim needs its own meaningful scope.

Inspect the output with details closed, then open one branch at a time. At the
closed level, the reader should recover the answer, material limitations, and
why a branch is worth opening. After opening it, identify the new reason,
mechanism, condition, or example it teaches. Reject a child that only repeats
its parent, assumes a prerequisite introduced elsewhere without orientation,
or makes the reader reconstruct the explanation from raw evidence. Substantive
parents explain the relationship among their children; a simple source list
does not need a filler paragraph. Keep these as meaning checks, not a fixed
outline, mandatory number of levels, or paragraph quota.

When evaluating this behavior, compare grounded examples and counterexamples
using the same facts across different report subjects. Check the initial view
and the next branch separately; valid nesting, source coverage, or a passing
model judgment alone does not establish reader learning gains.

When reporting a material flow finding, give its location, assumed context,
missing or misplaced premise, and reader impact. For a substantial report,
briefly ground the connection assessment in one actual transition even when
no actionable issue remains; do not create a paragraph-by-paragraph audit table.

## Explain quantitative claims

When a formula or ratio supports a judgment, show a worked example close to it.
Include the situation, input values, units and assumptions, substitution and
calculation, and the practical meaning of the result. Explain operators such as
`min` in ordinary language. Reuse a scenario across related formulas when useful.

Check arithmetic and units. Show a nontrivial value when a variable disappears
at a convenient value such as 1. Label hypothetical numbers and conceptual
curves; do not present them as measurements.

For example, in a **hypothetical** evaluation with 10 requests, 8 valid judgments
and 2 errors, 6 matching judgments give `6 / 8 = 75%` agreement among valid
judgments. Report the two errors alongside that rate. This is neither agreement
across all requests nor proof of accuracy against human-reviewed labels.

## Review in three groups

The six editorial concerns fit three peer groups. They guide judgment rather
than prescribe sentence forms, scores, or a minimum number of findings.

- **Sentence and continuity:** natural wording and rhythm; connections between
  sentences, paragraphs, and domains using only context the reader has received.
- **Purpose and evidence:** the title's promise, central answer, hierarchy,
  concrete explanation, numerical examples, source support, and claim strength.
- **Repetition and voice:** generic or inflated rhetoric, decorative naming,
  duplicated prose and diagrams, and consistency with supplied reference
  passages and the user's current preferences.

Explain technical shorthand through behavior, not merely by expanding an
acronym. Familiar metaphors such as boundary, contract, debt, and loop still
need context. Use consistent terminology across prose, figures, tables, and
translations. Do not invent an author's voice profile or force personal-opinion
phrasing into an evidence report. Read provided examples when relevant; do not
require an arbitrary number of old blog posts for every report.

## Classify, repair, and recheck

Keep editorial severity separate from findings about the system being reported.
A well-written report may correctly contain an unresolved high-risk system
finding. Never remove or downgrade that finding to pass editorial review.

- **High:** writing defeats the report's purpose, materially misleads, fabricates
  support, or distorts the user's intended position.
- **Medium:** a meaningful passage or recurring pattern obscures an explanation,
  breaks continuity, or conflicts with the evidenced reading level or style.
- **Low:** optional local polish when meaning, flow, credibility, and purpose
  already hold. An equally effective alternative may need no finding.

For an editing task, fix supported in-scope issues and reread the latest whole
report across all three groups until editorial High and Medium findings are zero.
Do not stop at an arbitrary round limit or reuse an earlier zero count after
changes. Low findings alone do not require more rounds.

For a review-only task, report locations, evidence, reader impact, and concrete
suggestions without editing. When evidence or an author decision is missing,
complete independent work, name the unresolved issue and needed input, and do not
claim it resolved. Keep actual review scope and remaining findings visible.
