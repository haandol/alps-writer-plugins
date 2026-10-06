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

## Navigation and evidence

Use semantic headings or a tree of domain nodes. Each parent has at most four
immediate child explanation units. If more are needed, create meaningful
responsibility groups or depth; never truncate or invent numbered batches.

Keep the overview understandable on its own. Put detailed mechanisms
and exact sources with their owning domain. In HTML, collapsible details and
anchors can provide drill-down; in Markdown or text, use nested headings and
clear references. Do not hide an unstructured report inside one giant detail.
All explanatory subsections default to expanded at every depth, so the document
is readable from start to finish without interaction. Detailed evidence and raw
sources default to collapsed. Keep the facts needed to understand the conclusion,
limitations, and next action in the body; expand a focused evidence item when
needed rather than exposing every log or contract excerpt. Complete sources stay
reachable regardless of their display state.
Retain optional collapsing for the reader; start collapsed only when explicitly
requested. Do not collapse successful findings or ordinary detail automatically.
These controls expose an explanation hierarchy; they do not define its abstraction
levels. When improving explanatory depth, preserve the existing report design
unless the user also requests a design change. Use the shared renderer's default
presentation when no other design is established, without adding a separate theme
merely to demonstrate drill-down.

Place the standalone, localized "Background and goals" heading directly below
the title. Keep the report's reason and intended use visible without expanding
details: the concrete problem and what reading should enable, as described in
[editorial review](editorial-review.md#make-the-reports-intended-use-concrete).
Follow it immediately
with a visually distinct answer and conclusion-changing limitations,
before navigation, long tables, or audit material. Preserve this reading order
in HTML, Markdown, text, and print. Use disclosure labels that name the question or
evidence inside, so readers can choose what to open. Keep material findings and
required actions visible; expandable evidence must not conceal their existence.
Choose subsequent headings and organization for the report's subject and reader
questions; preserve mandatory content without imposing common section names.
The answer may have an authored heading when useful, but no universal answer
title is required. For existing inputs with no separate background, preserve
their text without guessing which sentences are background.

If the reader collapses a branch, it shows its title and what it will
clarify. Keep substantive parent explanations understandable without opening
source material. Supporting sources and quizzes occupy their own regions under
the explanation; count the independent explanation branches toward the
four-child limit, not each source or question. Keep original sources reachable
inside the evidence group and retain each source's owning scope.

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
screen. Inspect the continuous document and the supported print output with the
permitted tools, and distinguish static checks from actual print verification.

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

Verify the actual format produced. A Markdown source is not proof that its HTML,
PDF, or slide export is readable. Inspect wrapping, clipping, broken links,
orphan headings, page breaks, and diagram consistency where applicable.

Use available format tools without changing the user's requested medium or
introducing unapproved external publication. Keep mandatory review interactions
and evidence when reorganizing a caller's report. If a format or diagram cannot
be rendered, state that limitation and retain source; do not claim visual success.

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
