# Requested browser and output QA

Load only when the user explicitly requests browser, interaction, viewport or
print/export inspection. Follow [the common delivery owner](../../report-writer/references/format-and-layout.md)
for the requested check, isolation, failure reporting and opening policy.
Do not start automation merely to deliver one local HTML file.

For supplied figures, inspect the requested output: sequence lifelines/messages
and component nodes/boundaries/connections must actually be visible, with readable
labels. Check wide and narrow views when viewport/layout QA is requested. Preserve
class relationships, lifecycle endpoints and data cardinality in the chosen notation.
For requested interaction or print checks, also verify required disclosure and,
when included, the [quiz artifact](quiz-artifact.md) controls and hidden answers.

Report what actually ran. A source fallback or pending figure is not rendered SVG.
If a requested check cannot run, complete independent work and name the actual
blocker and unverified scope. Never claim browser/print success from static checks
or introduce paid calls or publication to complete verification.
