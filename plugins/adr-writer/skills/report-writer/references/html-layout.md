# HTML layout

Use when composing HTML or checking its markup and styles. Follow the common
[verification levels](format-and-layout.md#verification-levels): these instructions
do not request browser automation or actual print inspection.

## Default appearance

Use a quiet, article-like page, similar to Medium or Notion: a white background,
dark neutral text, restrained dividers, and clear heading and paragraph spacing.
Center a comfortable reading column within a wider fluid page. Figures and tables
may use the wider area when their content needs it; do not stretch ordinary prose
across a large monitor or leave it pinned to one side of an otherwise wide page.

Keep the same reading width in nested explanations instead of accumulating card
borders and horizontal padding. Express hierarchy through headings, spacing, and
disclosure controls. On small screens, reduce page gutters and heading sizes;
allow long words and links to wrap. Keep wide diagrams and tables in their own
keyboard-accessible horizontal scroll regions without hiding or clipping content
or forcing the whole page to scroll sideways. Do not enlarge a small diagram to
an arbitrary minimum width. Preserve usable focus indicators and print layout.

The shared renderer embeds `scripts/report.css` into the standalone HTML; no font
download or external stylesheet is needed. Use that stylesheet as the default
instead of adding a separate theme when composing a report.
Code-review diffs use the bundled diff2html view described in
[code evidence](code-evidence.md), with print styles that preserve line numbers
and change markers while wrapping long lines across the available page width.

For modules that expand a responsibility or compare conditions and cases, apply
[interactive explanations](interactive-explanations.md). Keep controls beside the
explanation they change, with a coherent static and print reading path.

## Figures and disclosure

Use semantic headings, anchors and accessible disclosure controls for the
[explanation hierarchy](explanation-design.md#build-a-domain-scoped-hierarchy).
Keep useful figures inside the section that explains them. Check wrapping and
overflow in opened details as well as the overview, preserving the existing
design. Figures and labels must be readable at their delivered size; wider views
may use their own scroll region without widening the whole page.

## Print and handout layout

Print all explanatory subsections, figures, and evidence marked as necessary
regardless of their current collapsed state. Leave optional evidence folded unless
the reader has opened it and its enclosing evidence group; do not automatically
add raw logs and code appendices to the handout. Restore the screen state after printing;
repeated print events must not lose it. The initial HTML itself must contain
expanded subsections rather than relying on a script to reveal the document.
Keep the purpose, context, answer, child explanations, questions, and included source
evidence in their established reading order. No material limitation or required
action may exist only in an optional folded source.

Use the page width for content instead of accumulating nested card indentation.
Avoid orphan headings and unnecessary page breaks; let long prose and source
excerpts continue across pages instead of clipping them in scroll boxes. Keep
figures and their explanation together when feasible. Split an oversized diagram
into meaningful views if fitting it to the page would make labels unreadable.
Use print-friendly backgrounds and text while preserving the established design.

Omit navigation controls and optional Mermaid source views from the default
printout; retain source access in HTML. Follow the existing quiz contract: print
questions and all four choices, excluding answers, feedback, prior selections,
and controls. Expanded report sections do not change staged quiz disclosure on
screen. Apply the common verification levels to the continuous document and print output;
distinguish static print-style checks from actual print verification.
