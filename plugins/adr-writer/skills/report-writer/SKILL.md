---
name: report-writer
description: Create or revise requested reports, and use reports when connected explanations or evidence materially help the reader. Answer simple requests in chat; ask when report usefulness is unclear. Selected reports default to standalone HTML opened in the default browser, subject to user preferences.
argument-hint: "[report-topic-or-source] [format]"
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
Make the report self-contained for its stated audience and question. Do not
assume the reader has read cited documents, companion reports, or the authoring
conversation. Bring the source-backed context needed to understand the reasoning,
conclusions, and next actions into this report. Citations preserve attribution
and access to further detail; following them must not be a prerequisite for
understanding the report. Apply this in every delivery format.

Include useful figures whenever the evidence and delivery format support them,
from the overview through detailed explanations. For a whole-system or multi-step
process, prefer a Mermaid overview after the short background and answer, before
component detail. Figures are never a delivery gate, including for top-down,
C4-like or drill-down walkthroughs. Honor diagram exclusions; when a figure is
not feasible, explain the supported relationships in prose and retain material
limitations. Follow explanation design for meaningful descent.
Reuse guidance already loaded in this context. Load references for their actual
purpose rather than collecting every file:

- Read [explanation design](references/explanation-design.md) for the opening,
  domain hierarchy, disclosure and diagrams, and
  [editorial review](references/editorial-review.md) for prose and meaning checks.
- Read [format and layout](references/format-and-layout.md) for the chosen format's
  appearance, verification and delivery. For unfamiliar or complex explanations,
  also use [abstraction and analogy](references/abstraction-and-analogy.md).
- For review results, read [review presentation](references/review-results.md).
  Before creating review or audit outputs, follow
  [artifact storage](references/review-artifacts.md).
- When actual code evidence matters, read [code evidence](references/code-evidence.md).
  For structured HTML or Markdown, use [the document contract](references/report-document.md)
  and `scripts/render-report.mjs` when hierarchy and evidence validation help.
  The Node-only renderer needs no package installation.

Strongly recommend a short quiz when it helps the reader apply the core content.
Quiz generation is not mandatory: honor explicit inclusion or exclusion, otherwise
use the report's purpose and learning value to decide without approval or a required
omission record. If included, follow [comprehension support](references/comprehension.md).
Never start a conversational quiz without an explicit request.

## Review and deliver

Review the latest whole output with the loaded editorial and format guidance,
including deeper explanations and evidence. Preserve findings and exact sources;
do not invent verification, weaken a verdict or add paid calls or publication
solely to complete a report.

Follow [verification and final delivery](references/format-and-layout.md#final-delivery).
The default is semantic review plus static artifact checks; requested browser,
interaction or print checks are additional work with their own reported results.
Default HTML delivery creates a nonempty standalone file, opens its absolute path
once in the operating system's default browser, and returns that path with a short
summary. Honor delivery overrides and report actual opening failures.

If a specialized renderer forces a flat legacy layout, retain its output as an
audit source and compose the final human view through this skill. Preserve native
schemas, complete evidence, required interactions and the caller's verdict.
