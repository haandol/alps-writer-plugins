---
name: report-writer
description: Create or revise requested reports, and automatically explain complex topics or review findings through a report when structured depth materially helps understanding. Answer short, simple requests in chat; ask when report usefulness is unclear. For selected reports, default to standalone HTML and open it in the default browser, honoring delivery preferences.
argument-hint: "[report-topic-or-source] [format]"
---

# Report writing

Decide whether a report is useful before starting the report workflow. These
rules apply to technical explanations, reviews, audits, evaluations, sync and
rollup results; the task's name alone does not require a report.

## Choose the delivery

- **Explicit request:** Create or revise a report when the user asks for one or
  directly invokes this skill, even for a short topic. Honor explicit chat-only,
  no-file, no-open, other-format and browser requests within their scope.
- **Complex content:** Automatically create a report when the reader needs to
  connect conditions, relationships, comparisons or evidence that structured
  depth, diagrams or evidence navigation would materially clarify. A failure
  path across several components or a comparison with interacting constraints
  may qualify. Do not ask for routine permission in this case.
- **Short, simple content:** Answer in chat when a short explanation or small
  list can convey the complete answer and necessary evidence. A term definition,
  one-step instruction or local review finding often fits. Do not create a
  report file, open a browser or add a quiz. Technical vocabulary, a review
  request, word count or item count alone is not a complexity threshold.
- **Unclear usefulness:** Ask one brief question about whether the user wants a
  report before generating it. Keep the clarification to that question and only
  the context needed to choose; do not repeat it after an explanation or turn it
  into a report outline. Reuse a delivery choice already established for
  the same scope. Continue independent investigation or task work while waiting;
  silence is not permission to create a file.

Apply the delivery criteria without narrating the skill or its routing rules to
the user. On chat and clarification paths, answer or ask directly.

Preserve report and audit artifacts explicitly required by a specialized
workflow the user has selected. Do not infer such a requirement merely because
the task is a review or evaluation. This skill does not change the caller's
inspection scope, evidence, verdict, permissions or mandatory artifact schema.

Stop here for chat delivery; the report structure and quiz rules below do not
apply. Once a report is selected, read [review results](references/review-results.md)
for review presentation and follow the workflow below. Unless the user specifies
another format or delivery constraint, create standalone HTML, validate it, open
the final file once in the operating system's default browser and return its
absolute path. A chat summary accompanies a selected HTML report rather than
replacing it. Keep caller-required Markdown or JSON as supporting artifacts.

## Compose a selected report

Before creating review, audit, sync, or rollup report files or supporting
artifacts, follow [review artifact storage](references/review-artifacts.md).
Keep each run in its own Git-ignored `.adr-review/` subdirectory in the reviewed
project; final reports and intermediate evidence use the same run directory.

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

Omit commentary that explains what the reader already understands, including
obvious example labels, repeated conclusions, and repeated caveats. Keep context
and qualifications that change the meaning; follow the editorial guidance below.

## Design the explanation

Read [explanation design](references/explanation-design.md) for the opening,
domain hierarchy and visual explanations. For unfamiliar or complex material,
also read [abstraction and analogy](references/abstraction-and-analogy.md).
Keep the following
constraints in view while composing:

- Put the localized, standalone "Background and goals" heading below the title.
  Ground the report's purpose in the confirmed problem and intended reading use,
  then place the answer and material limitations in a distinct display area.
- Descend through evidenced domains and responsibilities, with at most four
  immediate child explanations. Keep source evidence and quizzes with their
  owning explanation without counting them toward that allowance.
- Default explanatory subsections to expanded and detailed sources to collapsed;
  expose evidence needed to understand the result. Preserve explicit disclosure
  preferences, complete source access, print behavior and original schemas.
- Explain meaningful relationships at the depth where they appear. Use Mermaid
  sequence diagrams for important requests, responses and timing; retain source
  alongside the rendered figure. Do not invent relationships or verification.

For a code-review report, follow
[code evidence](references/code-evidence.md) to select actual diffs or excerpts,
connect them to the finding and verification, and preserve source locations.
Load this reference only when code evidence is relevant. The default responsive
appearance is owned by [format and layout](references/format-and-layout.md).

## Review and deliver

Apply the loaded [editorial review](references/editorial-review.md) and
[format and layout](references/format-and-layout.md) guidance to the latest whole
output, including folded details. Those references own prose, continuity,
quantitative examples, paragraph spacing, wrapping, and the High/Medium/Low
editorial checks; do not repeat their checklists in another report artifact.

Verify hierarchy, complete evidence, links, and actual rendering separately from
semantic review. Fix supported material issues and recheck affected transitions.
Review opened detail sections as well as the overview: check for missing useful
figures, repeated parent diagrams, and pictures that add no explanatory value.
Never weaken findings or invent evidence to pass. Report the changes and checks
actually performed, with unresolved evidence or rendering limits. A self-review
is not an independent review. Do not introduce paid calls or publication solely
to satisfy this workflow without existing authorization.

For HTML or Markdown, use [the report document contract](references/report-document.md)
and `scripts/render-report.mjs` when a structured output helps validate hierarchy
and evidence coverage. It runs with Node.js and no package installation. Other
formats follow the same reading hierarchy using their available authoring tools.

For HTML delivery, follow [format and layout](references/format-and-layout.md#final-delivery)
to verify the final file and open it once, subject to the user's delivery constraints.
Include its absolute path in the final
response. If opening is unavailable or fails, keep the generated HTML and
report the actual reason and path; do not claim that it opened.

If a caller's existing renderer forces a flat legacy layout, keep that output as
an audit source and compose the final human-facing report through this skill.
Do not present the legacy layout as satisfying this contract. Preserve the
caller's complete evidence, test results, and required interactions; group
them under their owning domain instead of discarding them.
