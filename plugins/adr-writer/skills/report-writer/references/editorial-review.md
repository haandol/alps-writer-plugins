# Editorial review

These are meaning checks, not an AI-authorship detector. Use them for reports in
any language or format. Report-only requests remain report-only.

## Establish the reader's context

### Connect purpose, approach, and result

Apply Simon Sinek's **Golden Circle (Why → How → What)** to the explanation:

- **Why:** identify the reader's problem or decision and the outcome at stake.
  Use the supplied intent or verified conditions. Do not invent a benefit,
  incident, or measured impact to give the report a stronger opening.
- **How:** explain the relevant approach, behavior, or assessment criteria and
  why they address that purpose. Use domain mechanisms and evidence; a recap
  of the author's searches and tool calls rarely answers this question.
- **What:** state the concrete finding, observed outcome, deliverable, or action
  and its limits. Distinguish an intended outcome from one actually verified.
  When test or eval evidence supports acceptance, show which purpose or
  obligation its criterion checks; test success by itself proves no broader
  product outcome.

Keep the answer and material limitation visible in the opening. A short opening
can connect purpose and answer in one paragraph before explaining the approach;
an urgent finding can come first. Use the domain hierarchy for depth and do not
force `Why`, `How`, and `What` headings, repeat the same purpose in every child,
or add a purpose field to a native schema. A short result may need only one
paragraph. A missing causal connection calls for explanation or an explicit
evidence gap, not persuasive filler.

For example, in a hypothetical retry review, the purpose is preventing repeated
charges, the approach reuses the result for the same payment identity, and the
verified outcome is one charge in the tested retry situation. If a timeout path
was not exercised, that test does not establish the outcome for that path.

### Check continuity at each reading depth

Source verification and reader comprehension are separate. A fact in the
conversation may be true but still missing from the report the reader receives.

- Read the title and opening alone: can a reader identify the concrete problem,
  the answer, its significance, and any condition that changes the conclusion?
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
  Preserve useful answer-first openings and do not repeat background everywhere.
- Check every reading depth for a misleading simplification. A shorter overview
  may defer exact evidence, but must retain a caveat, failure, or exception that
  changes its answer. Details must substantiate or qualify the parent claim;
  a new unrelated claim needs its own meaningful scope.

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
