---
name: report-writer
description: Create or revise requested reports, and use reports when connected explanations or evidence materially help the reader. Answer simple requests in chat; ask when report usefulness is unclear. Selected reports default to standalone HTML opened in the default browser, subject to user preferences.
---

# Report writing

## Choose the delivery

- **Explicit request:** Create or revise the requested report, including a direct
  skill invocation, even for a short topic. Honor chat-only, no-file, no-open, other-format and browser requests.
- **Complex content:** Create a report when connecting conditions, relationships,
  comparisons or evidence needs structured depth. Do not ask for routine permission.
- **Short, simple content:** Answer in chat when a short explanation or small list
  conveys the complete answer and evidence. Do not create a file, open a browser
  or add a quiz. Technical vocabulary, review labels and length alone do not
  determine complexity.
- **Unclear usefulness:** Ask one brief delivery question before generating a
  report. Reuse the user's choice for the same scope, continue independent work
  while waiting, and do not treat silence as permission.

Apply these criteria without narrating routing. Stop here for chat delivery.
Preserve artifacts explicitly required by a specialized workflow the user chose;
its scope, findings, verdict, permissions and native schema remain authoritative.
A review-only request does not authorize changes to the subject.

## Compose a selected report

Write model-facing instructions in English and the report in the user's language.
Keep the report self-contained, preserve exact evidence and the caller's scope,
and use stable terms whose definitions connect to their examples and later uses.
Open with separate Purpose and Context sections, in that order, before the answer.
Every report follows the same fixed reading order: title, Purpose, Context, the
core answer, Overview, then subject-named sections; the renderer localizes the
fixed headings.

The template owns the structure: which regions exist, their order and the
abstraction level each one carries. You own what goes inside each section: its
title, what to say, in what order, and in which form (prose, diagram, table,
list or code). Choose that form by what helps this reader understand; prefer a
diagram for flows, relationships and states, and a table for comparisons,
mappings, before/after differences or several attributes per item, whenever
that is clearer than sentences.

Write in this order; do not start prose before the plan holds:

0. **Calibrate to the reader.** Run `scripts/reader-profile.mjs status` and follow
   [reader profile](references/reader-profile.md): use the profile section for the
   report's area to set the starting level, analogies and which terms to unpack.
   If it is missing or older than three months, ask once whether to build it;
   on no answer or a decline, write at a plain general level.
1. **Plan the reading path.** Following [reading path](references/reading-path.md),
   fix the reader's goal, a one-sentence core message, the parts (at most four)
   that produce it, each section's question and its paragraph flow. Keep the plan
   as a working step, not a saved artifact.
2. **Fill the template.** Copy [the report template](templates/report.json) and
   replace every `{{...}}` placeholder from the plan. Keep each region at its
   level: the core answer carries no implementation identifiers, the Overview
   shows how the parts connect, sections open one part each, and children hold
   concrete cases and exact values. Delete optional blocks you do not use and
   add the diagrams, tables, lists or code each section needs.
3. **Write the content.** Apply [writing style](references/writing-style.md):
   one register (the Korean plain declarative form), one claim per sentence, each
   paragraph led by its point, and a visual form wherever it explains better.
4. **Render.** Produce HTML and Markdown only through `scripts/render-report.mjs`
   ([document contract](references/report-document.md)). Never hand-write the
   page shell or its styles; the renderer embeds the shared template and stylesheet
   and rejects unfilled placeholders.

Before rendering, fill the template's `comprehensionCheck` with one to six
questions on the core content; the quiz is required. Only when the user
explicitly excluded the quiz for this report, replace it with
`{ "excluded": "<the user's request>" }`; the renderer refuses anything else.

Build from the reader's relevant known context to an understandable whole, then
open the same subject's responsibilities, relationships and concrete behavior.
Preserve evidenced domain boundaries while letting the reader's question guide
the route through them. Use this principle for reviews and comparisons as well
as concept explanations. Lead each explanatory section with its answer in one or
two sentences, including conditions that change it. Use visualization as far
as it helps understanding: give the Overview and sections explaining flows,
data paths, classifications or decisions focused figures, and present
comparisons and mappings as tables, when evidence and format support them.

Use HTML interaction proactively where exploring a responsibility, condition or
case helps the reader understand that subject. Add modules inside the owning
section of the rendered page; controls must reveal meaningful relationships or
behavior, and their presence does not establish explanation depth.

Reuse loaded guidance. Read the common references once, then load additional
modules only for the content or format being handled:

- **Common writing and review:** [reading path](references/reading-path.md) and
  [writing style](references/writing-style.md) own the plan, level budget and
  register; [explanation design](references/explanation-design.md) owns the
  opening, intent and domain hierarchy; [editorial review](references/editorial-review.md)
  owns meaning, terminology and continuity checks; [format and layout](references/format-and-layout.md)
  owns paragraph layout, verification and delivery.
- **Explanation-specific guidance:** when choosing a familiar starting point or
  connecting it to an unfamiliar part, use
  [abstraction and analogy](references/abstraction-and-analogy.md). When choosing,
  drawing or reviewing figures, use [diagrams](references/diagrams.md); when a
  quantitative claim supports a judgment, use [quantitative claims](references/quantitative-claims.md).
  Figures never gate delivery. For HTML exploration, use
  [interactive explanations](references/interactive-explanations.md) to connect
  controls, explanation states and their evidence.
- **Review content:** use [review presentation](references/review-results.md),
  prepare files through [artifact storage](references/review-artifacts.md), and
  read [code evidence](references/code-evidence.md) when actual code matters.
- **Template and rendering:** [the document contract](references/report-document.md)
  owns the template fields and `scripts/render-report.mjs`, which runs on Bun with
  no package installation. For static layout checks, use [HTML layout](references/html-layout.md).

Read [comprehension support](references/comprehension.md) for the quiz's
content, schema and disclosure. Never start a conversational quiz without
an explicit request. Worked examples linked from modules are optional references,
not additional required reading for every report.

## Review and deliver

Review the latest whole output with the applicable editorial and format guidance.
Correct confirmed in-scope problems and recheck; for review-only work, describe
corrections without editing the subject. Honor limits on redrawing or rephrasing.
Never invent verification, weaken findings, or add paid calls or publication to
complete a report. A renderer pass or general LLM PASS cannot overrule an evidenced
mismatch or establish reader understanding.

Follow [verification and final delivery](references/format-and-layout.md#final-delivery).
Default delivery uses semantic and static checks, creates a nonempty standalone
HTML file, opens its absolute path once in the operating system's default browser,
and returns that path. Honor delivery overrides and report actual opening failures.
Requested browser, interaction and print checks have separately reported results.
If a specialized renderer forces a flat legacy layout, preserve it as audit input
and compose the human view through this skill without losing native schemas,
complete evidence, required interactions or the caller's verdict.
