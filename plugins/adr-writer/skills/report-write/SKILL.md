---
name: report-write
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

## Review prose and reading layout

### Meaning and continuity

Remove context-free introductions, exaggerated claims, ornamental terminology,
repetitive contrasts or conclusions, and transitions that add no meaning. Keep
useful conversational signals and supported narrative detail. Explain unfamiliar
terms where first needed, and make actors, conditions, actions, and results clear.

Read across paragraph and section boundaries: the reader must have the context
needed for the next example or judgment. Do not make individual sentences sound
smoother while leaving a missing premise or unsupported causal claim.

### Paragraphs, line breaks, and spacing

- Break paragraphs when the actor or topic changes, or when introducing a new
  example or condition. Keep connected conditions, causes, and results together.
  Do not turn every sentence into a separate line or fragment connected prose.
- Distinguish semantic paragraph breaks from visual wrapping. Adapt text width,
  line height, and paragraph spacing to the format and viewport. Do not insert
  hard breaks merely to meet a fixed character count.
- Check numbers and units, conditions and negations, and identifiers as reading
  units. Avoid awkward splits that obscure their meaning. Do not alter quoted
  evidence, source code, or contract meaning just to make a line fit.
- Inspect spacing around headings, lists, tables, figures, labels, and captions.
  Check the actual supported screen and export layouts for stranded headings,
  dense paragraphs, clipped text, or awkwardly split explanations.

### Completion checks

- Read the final artifact in the reader's order, including its title, hierarchy,
  prose, diagrams, tables, and folded details. Check that each level answers its
  own question and supplies a useful route to supporting detail.
- Check maximum fan-out, evidence completeness, links, wrapping, and rendering
  separately from meaning. Word scans, sentence counts, and AI-detection scores
  are not proof of clear prose or successful semantic review.
- Repair material factual, logical, or reading-flow problems and inspect the
  affected transitions again. Do not weaken evidence, downgrade an unresolved
  issue, or invent certainty to claim completion.
- Report the changes and verification actually performed. Distinguish missing
  evidence and unverified rendering, and do not claim independent review when
  only self-review occurred. Do not introduce paid calls or external publication
  solely to satisfy this writing workflow without existing authorization.

For HTML or Markdown, use [the report document contract](references/report-document.md)
and `scripts/render-report.mjs` when a structured output helps validate hierarchy
and evidence coverage. It runs with Node.js and no package installation. Other
formats follow the same reading hierarchy using their available authoring tools.

If a caller's existing renderer forces a flat legacy layout, keep that output as
an audit source and compose the final human-facing report through this skill.
Do not present the legacy layout as satisfying this contract. Preserve the
caller's complete evidence, test results, and required interactions; group
them under their owning domain instead of discarding them.
