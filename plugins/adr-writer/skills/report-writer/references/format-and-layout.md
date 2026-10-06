# Format and layout

The reader's question and domain scope determine organization. The requested
format determines navigation and wrapping, not which facts may be omitted.

## Paragraphs and line breaks

Separate changes in actor, topic, example, or condition with a paragraph break.
Keep naturally connected causes, conditions, and results together. Do not
mechanically place every sentence on its own line or enforce sentence-count quotas.

Distinguish paragraph breaks from visual wrapping. On responsive pages, use
readable text width, line height, and paragraph spacing instead of inserting
hard line breaks to fit one screen. In Korean, avoid splitting a word merely
to justify a line. Let long identifiers wrap or scroll without clipping.

Check numbers with units, negations with their conditions, and referenced
identifiers as reading units. Preserve literal quotes, code, values, and source
meaning. Review heading, list, table, and figure spacing, including mobile and
print layouts actually supported by the delivery.

## Default HTML appearance

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

## Navigation and evidence

Apply [explanation design](explanation-design.md) for the opening, domain
hierarchy and expanded explanations versus collapsed evidence. Use semantic
headings, anchors and accessible disclosure controls to express that structure.
Labels identify what a collapsed branch adds; source groups retain complete
access without hiding conclusion-changing facts. Preserve an established report
design when changing its depth; use the shared stylesheet when none exists.

In every format, place a node's child explanations before its comprehension
questions and detailed source evidence. Label parent support material with its
owning scope when a linear format resumes it after child sections. A question
depending on collapsed child explanations provides a route back to them;
reading them is never an approval or task-completion gate.

Native evidence files and required schemas remain intact. Link to complete
source material while keeping enough explanation in the report to understand
the claim without opening every attachment.

## Figures, tables, and calculations

Use sequence diagrams for important interactions and timing, and other Mermaid
types when they explain the relationship better. Align terms and abstraction
level with the prose. Include source and an explanation of what the reader
should notice. Check rendered labels, arrows, and reading order.
When one figure expands another, name the parent element it opens up and retain
the correspondence as internal relationships appear. An analogy view must map
its elements to the actual concepts before detailed figures rely on them.

Keep a useful detail figure inside the section that explains it, including a
collapsed or leaf section; do not collect all figures at the top or in a remote
appendix. When opened, that section should show the relevant figure and its
explanation together, with labels and relationships readable at the delivered
size. Preserve the overview's lower detail and the existing design while allowing
the deeper view to show more. Check wrapping and overflow in opened details as
well as at the top level, within the permitted verification tools.

A table should expose a comparison or mapping, not duplicate neighboring prose.
Keep independent peer items within the hierarchy limit by domain grouping.
Worked calculations show inputs, units, substitution, results, and interpretation;
hypothetical values must be distinguishable from measurements through their
framing or an inline qualifier, without a redundant explanatory sentence.

### Print and handout layout

Print all explanatory subsections, figures, and evidence marked as necessary
regardless of their current collapsed state. Leave optional evidence folded unless
the reader has opened it and its enclosing evidence group; do not automatically
add raw logs and code appendices to the handout. Restore the screen state after printing;
repeated print events must not lose it. The initial HTML itself must contain
expanded subsections rather than relying on a script to reveal the document.
Keep the background, answer, child explanations, questions, and included source
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
screen. Apply the verification levels below to the continuous document and print output;
distinguish static print-style checks from actual print verification.

## Final delivery

Apply the [delivery decision](../SKILL.md#choose-the-delivery) before this section.
For a selected report, default to standalone local HTML when the user has not
specified a format or delivery constraint. Short, simple explanations and review
results delivered in chat do not need a report file, browser opening or quiz.
An ordinary acknowledgement, progress update or completion notice is not a report.
Keep required Markdown/JSON audit artifacts alongside the final human view.
Explicit other-format, chat-only, no-file, no-open or browser requests override
the default within their scope. Do not add an HTML copy when the user requests
only another format.

### Verification levels

Default delivery requires semantic review of the latest content and static checks
of the generated artifact: structure, complete evidence, local links and anchors,
nonempty output, and applicable layout and interaction code. For included diagrams,
confirm rendered output is present, retains the source's relationships and labels,
and does not silently fall back. Use existing renderer tests when relevant; do not
invent per-report tests or require browser approval solely for delivery.

Browser visual inspection, clicking controls, mobile viewport checks and actual
print/export inspection run when the user requests those checks. Keep automation
separate from the user's work. A requested check that cannot run remains unverified;
complete independent work and report the actual blocker. Explicit PDF or other
static-export delivery still requires checking that produced artifact with the
permitted format tools.

State which checks ran and which did not. Static markup, styles or passing helper
tests do not establish visual or browser-interaction success for this report.
Unperformed optional browser/print checks do not block ordinary HTML delivery.
Do not introduce external publication or paid calls to perform them.

After the content and structural checks, confirm that the final HTML exists and
is nonempty, then open its absolute path once using the operating system's
default file opener. On macOS, use `open "<absolute-report-path>"`; on Windows,
use `Start-Process` with a literal path, or `xdg-open` on Linux. Respect an explicit
browser choice. Do not open drafts or open again after every render. The renderer
itself stays usable without launching a browser; opening is the delivery step.

Do not start an automation browser, dedicated browser session or local server
merely to show one local HTML file. Automate browser verification only when the
user explicitly requests it, and keep that session separate from their work.
Opening the file is not proof of visual verification. If the opener is absent
or fails, preserve the HTML and return its absolute path and the actual failure
reason without claiming success. The final response briefly states the result
and links to the report.
