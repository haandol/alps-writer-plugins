# Format and layout

The reader's question and domain scope determine organization; format determines
navigation and wrapping, not which facts may be omitted. Use
[HTML layout](html-layout.md) for HTML composition and static appearance checks.
Other formats retain the common reading order and evidence rules below.

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

A table should expose a comparison or mapping without duplicating nearby prose.
Use [diagrams](diagrams.md) for figure selection and checks, and
[quantitative claims](quantitative-claims.md) when calculations support a judgment.
Read these only when the report needs that content.

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

When an available renderer or validator reports an in-scope error, use its
diagnostics to correct the report source and run that check again. Verify the
latest saved output, not an earlier successful version. Do not bypass the check,
drop required evidence, or equate a validator's source-URL syntax check with
proof that a local file or fragment exists. Resolve links from the delivered
file's location. If a required check cannot run, state that unverified scope.

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
