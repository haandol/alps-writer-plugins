---
name: report-writer
description: Write reports and present review results in any requested format. Use for code, pull request, ADR, architecture, or document reviews, as well as reports, audits, evaluations, and synchronization results. Apply even when the user asks only for a review. Organize findings by domain with at most four peer units, clear paragraphs, evidence-grounded prose, and explanatory Mermaid diagrams.
argument-hint: "[report-topic-or-source] [format]"
---

# Report writing

Apply this workflow whenever delivering review findings or a human-facing report, including when
another skill owns the underlying analysis. It governs presentation and writing
quality without changing the caller's scope, evidence, verdict, permissions, or
mandatory artifact schema. Ordinary acknowledgements and short progress messages
do not need a report structure.

A request to review code, a pull request, an ADR, an architecture, or a document
also selects this skill for presenting the result; the user need not separately
ask for a report. The owning review workflow still determines what to inspect,
what counts as a defect, the verdict, and whether changes are authorized.
Read [review results](references/review-results.md) for these requests. A brief
review may stay in chat; honor the requested format and preserve required
caller artifacts without adding empty sections.

Before creating review, audit, sync, or rollup report files or supporting
artifacts, follow [review artifact storage](references/review-artifacts.md).
Keep each run in its own Git-ignored `.adr-review/` subdirectory in the reviewed
project; final reports and intermediate evidence use the same run directory.

Generate one to five medium-difficulty quiz questions about the report's core
content to support understanding and reduce cognitive load. Apply
[comprehension support](references/comprehension.md) when composing the report;
this skill owns quiz generation, including for reviews. Omit the quiz only when
the user excludes it or the output has no substantive concept to check. Keep
questions in the report and start a conversational quiz only on explicit request.

Write skill instructions and model-facing prompts in English. Write the report
in the user's requested language. This skill governs final human-facing
presentation; a caller's review strength, findings, approval boundaries, required
data fields, and source artifacts remain authoritative.

Read [editorial review](references/editorial-review.md) before drafting or
reviewing prose, and [format and layout](references/format-and-layout.md) for the
chosen delivery format. Reuse instructions already loaded in the current
context. The same instructions apply inside another skill.

## Establish the reader's question

- Identify the reader, the question or decision, the requested language and
  format, and the evidence available. Follow the user's current preferences.
- Lead with the answer, material implications, remaining uncertainty, and next
  action. Supply background where the reader first needs it.
- Preserve exact requirements, values, units, conditions, permissions, ordering,
  findings, tests, and sources. Distinguish facts, supported inferences, and
  proposals; never invent outcomes, historical policies, motives, or measurements.
  Repeated observations alone do not establish robustness, general accuracy, or
  causality beyond the conditions actually tested.
- Keep authoritative PRD/ADR schemas and native evidence complete. Apply this
  skill to the human-facing explanation rather than deleting required fields or
  silently changing machine-readable data.

## Build a domain-scoped hierarchy

Use C4's idea of changing resolution: overview first, then domain responsibilities
and interactions, followed by detailed behavior and evidence when needed. Do not
force C4 diagram types or technical-layer headings onto every report.

- Name the scope and reader question at each level. Prefer evidenced subdomains
  and bounded contexts; within them, divide by business responsibility or concept.
  Do not substitute file order, technical layers, or work phases for domain scope.
  Do not assume team, system, domain, and bounded-context boundaries coincide.
- Keep at most four immediate child explanation units. When there are five or
  more peer sections, list items, cards, or comparison items, add meaningful
  domain grouping or depth. Do not truncate, hide a giant unstructured dump, or
  use arbitrary numbered batches to satisfy the limit.
- Make parent-child scope and drill-down paths clear. A brief answer may fit in
  one node; do not add empty levels. If a grouping is editorial rather than an
  established architectural boundary, say so.
- Keep complete source evidence reachable at the appropriate depth. Use a
  focused excerpt for explanation and a full original artifact when needed.
  The grouping limit must never erase an independent obligation or failure.

## Explain relationships visually

- Use Mermaid `sequenceDiagram` when participants, requests, responses, or timing
  are central. Prefer a flowchart for branching flow, a state diagram for state
  transitions, and an entity-relationship diagram for data relationships.
- Keep each figure within its domain and abstraction level. Break a complicated
  picture into an overview and detailed flows rather than making the reader
  reconstruct many independent responsibilities at once.
- Place the figure beside its explanation. Briefly state how to read it and what
  it establishes. Draw only supported actors, relationships, order, and failure
  paths; distinguish uncertainty. Do not add a decorative diagram to a trivial fact.
  If evidence does not establish the requested interaction, identify the missing
  information or draw a clearly labeled conceptual view of supported relationships;
  do not invent service calls to fill a requested diagram type.
- Preserve Mermaid source and use the requested format's supported rendering.
  In HTML, provide both the rendered view and accessible source. In Markdown,
  use a Mermaid fence; in static exports, retain source with the supporting
  material. If rendering fails, identify the limitation rather than calling the
  diagram verified or substituting an invented picture.

## Review and deliver

Apply the loaded [editorial review](references/editorial-review.md) and
[format and layout](references/format-and-layout.md) guidance to the latest whole
output, including folded details. Those references own prose, continuity,
quantitative examples, paragraph spacing, wrapping, and the High/Medium/Low
editorial checks; do not repeat their checklists in another report artifact.

Verify hierarchy, complete evidence, links, and actual rendering separately from
semantic review. Fix supported material issues and recheck affected transitions.
Never weaken findings or invent evidence to pass. Report the changes and checks
actually performed, with unresolved evidence or rendering limits. A self-review
is not an independent review. Do not introduce paid calls or publication solely
to satisfy this workflow without existing authorization.

For HTML or Markdown, use [the report document contract](references/report-document.md)
and `scripts/render-report.mjs` when a structured output helps validate hierarchy
and evidence coverage. It runs with Node.js and no package installation. Other
formats follow the same reading hierarchy using their available authoring tools.

If a caller's existing renderer forces a flat legacy layout, keep that output as
an audit source and compose the final human-facing report through this skill.
Do not present the legacy layout as satisfying this contract. Preserve the
caller's complete evidence, test results, and required interactions; group
them under their owning domain instead of discarding them.
