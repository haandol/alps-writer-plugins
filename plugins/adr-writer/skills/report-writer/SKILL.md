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
Keep the report self-contained, preserve exact evidence and the caller's scope,
and use stable terms whose definitions connect to their examples and later uses.
Reuse loaded guidance. Read the common references once, then load additional
modules only for the content or format being handled:

- **Common writing and review:** [explanation design](references/explanation-design.md)
  owns the opening, intent and domain hierarchy; [editorial review](references/editorial-review.md)
  owns meaning, terminology and continuity checks; [format and layout](references/format-and-layout.md)
  owns paragraph layout, verification and delivery.
- **Explanation-specific guidance:** for unfamiliar or complex concepts, use
  [abstraction and analogy](references/abstraction-and-analogy.md). When choosing,
  drawing or reviewing figures, use [diagrams](references/diagrams.md); when a
  quantitative claim supports a judgment, use [quantitative claims](references/quantitative-claims.md).
  Include useful figures when evidence and format support them; prefer an overview
  for whole-system or multi-step explanations. Figures never gate delivery.
- **Review content:** use [review presentation](references/review-results.md),
  prepare files through [artifact storage](references/review-artifacts.md), and
  read [code evidence](references/code-evidence.md) when actual code matters.
- **Structured output:** use [the document contract](references/report-document.md)
  with `scripts/render-report.mjs` when hierarchy and evidence validation help.
  This Node-only renderer needs no package installation. For HTML composition
  and static layout checks, use [HTML layout](references/html-layout.md).

Strongly recommend a short quiz when it helps the reader apply the core content.
Honor explicit inclusion or exclusion; otherwise choose by reader value without
approval or an omission record. If included, read [comprehension support](references/comprehension.md)
for its content, schema and disclosure. Never start a conversational quiz without
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
