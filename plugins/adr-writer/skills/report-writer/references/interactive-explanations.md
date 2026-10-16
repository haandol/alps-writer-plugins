# Interactive explanations in HTML

Read when composing or reviewing interactive parts of a report. Use interaction
proactively where exploring a responsibility, condition or case improves
understanding. Keep the report's main answer and material limits readable before
any interaction. A simple fact does not need a control, and module count is not
a quality target.

## Choose what the reader will learn

Start with the reader's question, the object being explored, what a selection
changes, and the relationship or behavior that becomes clearer. Choose a small
module that fits that purpose, for example:

- A responsibility explorer that opens a parent into its internal relationships
  and then a concrete rule or case, with a visible route back.
- A condition or case selector that updates the applicable rule, result and
  explanation together, so the reader can compare why outcomes differ.
- A process walkthrough that highlights the current input, responsibility and
  output without implying unverified runtime ordering.
- An evidence-scope view that connects each observed result to what it establishes
  and what remains unverified, without changing the recorded observations.

Peer tabs, a source accordion or animation alone do not establish drill-down.
Keep the selected subject recognizable as the explanation becomes more precise.
Introduce roles and relationships before implementation identifiers. Preserve
the domain hierarchy and the four-child explanation limit; do not hide a flat
inventory behind many buttons.

## Preserve meaning and a continuous reading path

Every state uses the report's evidence and exact conditions. Label illustrative
inputs naturally and keep hypothetical outcomes distinct from recorded results.
Do not invent data, measured performance, selection guarantees or completed
verification to make a control seem useful. A reading control must not look like
it runs the real service or evaluates new answers.

Keep interactions local to the delivered report. Use native controls with clear
labels, visible selection and keyboard access. Show the result and its reason
together; retain material limits in every affected state. Provide a way to return
to the parent or initial view. Do not add network calls, uploads or persisted
progress for a reading aid. Render source text as text, not executable markup.

Retain a coherent static explanation and a print view. Script failure or disabling
JavaScript must not erase the answer, conditions or source access. Interactive
views can focus one case on screen while the printable or static view preserves
all necessary cases. Existing quiz disclosure rules still govern actual quizzes;
a case explorer is not automatically a quiz.

## Compose with the existing report

Use the existing article layout and place a module beside the explanation it
expands. Avoid a separate dashboard of controls without a narrative path. Narrow
screens should stack controls and results without hiding text; focus and selection
must remain distinguishable without relying only on color.

The structured renderer's current document schema does not accept arbitrary
interactive modules or executable HTML fields. Do not smuggle scripts into plain
paragraphs or add unknown fields. Compose custom HTML locally when needed, or
augment validated core output while retaining its required content and evidence.
Renderer validation of the core does not validate the added module.

## Verify the explanation states

Review each meaningful selection against its supporting passage: the displayed
condition, result, reason and limitation must agree. Check the initial state,
state changes and return path; no stale panel, hidden prerequisite or changed
source claim may survive a selection. A DOM-level check can exercise local
handlers and content assertions without contacting a service.

Use [verification levels](format-and-layout.md#verification-levels): distinguish
static/code or DOM checks from actual browser interaction, visual inspection and
print inspection. Browser automation remains subject to the user's requested
scope. Check fallback content and print rules even when those browser checks are
not requested. Never treat successful clicking or a model PASS as evidence of
reader learning. Open the final file once through the normal delivery path.
