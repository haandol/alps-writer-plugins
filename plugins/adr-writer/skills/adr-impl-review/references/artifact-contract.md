# Implementation review artifact contract

Read this delivery spine completely only after the review evidence has been
synthesized and the verdict is known. It owns standard/full artifact delivery,
validation, opening, failure handling, and the ordinary completion response.
Reuse loaded owners; load a child only for its stated operation:

- **Writing or repairing native artifacts:** read [artifact schema](artifact-schema.md)
  for exact fields, generated anchors, coverage and disclosure. Load the
  [worked JSON example](artifact-example.md) only when an example is needed.
- **Quiz included:** read [quiz artifacts](quiz-artifact.md). Quiz generation is
  strongly recommended, not mandatory; the [common comprehension workflow](../../report-writer/references/comprehension.md)
  owns selection. Without a quiz, omit its data and section without approval or
  an omission record. Do not load quiz details for a no-quiz report.
- **Repair guide:** read [repair guidance](repair-guide.md) only for `FIX_REQUIRED`,
  `BLOCK`, or requested detailed repair guidance.
- **Explicit interactive request:** read [interactive check](interactive-check.md)
  only when the user asks to run it. Neither quiz inclusion nor gate selection
  authorizes conversational grading.

## 1. Prepare the evidence package

Apply the `adr-impl-review-report-writer` role contract. This step creates no new
conclusions. The model may use a named agent, generic subagent, or write directly;
whichever path writes it, read and follow
`${CLAUDE_PLUGIN_ROOT}/agents/adr-impl-review-report-writer.md`.

Supply the original ADR, complete implementation scope, separate change scope,
`review-baseline.md` when full mode produced one, available optional explanation
plus necessity/sufficiency artifacts, normalized Notable implementation choices,
and verified findings and test results. Preserve the selected mode's evidence
and independent perspectives. Save exactly `implementation-review.md` and
`findings.json`; `final-review.md` or `review.md` cannot replace the former.
An optional `explanation.md` never replaces the final narrative.

Before writing, read `${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md`
completely and apply `${CLAUDE_PLUGIN_ROOT}/skills/report-writer/SKILL.md`.
Those owners govern progressive disclosure, continuous essay prose, hierarchy,
language, editorial review and layout. The human-facing order is prose first,
evidence second. Native sections are complete audit inputs, not a flat final-page
outline. Keep all `contractCoverage`, `implementationChoices`, findings, code/test
proof and source identifiers, including clause-level gaps and verification limits.
The schema's `At a glance` anchor supplies the displayed Abstract.

Build the optional related-ADR comparison under the schema's bounded candidate
reads. Follow [visualization](visualization.md) for diagram questions, placement,
semantic/static checks and the request-only browser QA branch. Figure absence
never gates delivery; source fallback or pending figures are not rendered figures.

## 2. Materialize, validate, compose, and open

Validate and build the HTML in both modes:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-materialize.mjs <artifact-dir>
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-validate.mjs <artifact-dir>
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-report.mjs <findings.json> --out <artifact-dir>/adr-impl-review-audit.html
# Apply report-writer to compose and check the final adr-impl-review-report.html
# from the validated audit inputs, preserving all required interactions.
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-open.mjs <artifact-dir>/adr-impl-review-report.html
```

If materialization or validation fails, do not report completion or generate the
HTML. Fill the omissions it names in the narrative source or `findings.json` and
re-run until both exit 0. In particular, fill `perspective`, `code`, `evidence`,
`test`, and `testResult` for every finding, and where a test could not be run,
write `NOT RUN — <reason>` rather than leaving it blank. If HTML rendering fails
or produces an empty file, the review is also incomplete.

Inspect the materialized Markdown and generated HTML main narrative with the
common owner's semantic and static checks, not only the author's source, before
the final non-empty check and open. Browser, interaction and viewport QA run
only when explicitly requested; opening is not visual verification. Equal structured
Hill fields are composed once automatically. Remove redundant authored
paraphrases when they add no information, while preserving exact contracts,
distinct conditions, examples, code evidence, and independently readable Hills.
If prose changes, materialize, validate, and render again before delivery.

In both modes, run `adr-impl-review-open.mjs` immediately after the non-empty
check, honoring explicit no-open or browser delivery overrides from report-writer. The helper attempts the host's default browser exactly once and prints
`OPENED <path>` or `NOT_OPENED <path> — <reason>`. Do not silently skip the
command based on an assumption that the environment is headless. A
`NOT_OPENED` result for a valid artifact does not invalidate the review; state
the reason and provide the exact path.

## 3. Completion response

The ordinary main-session completion response contains only the verdict, key
impact/action/risk, applied fixes, tests, lifecycle result, and the HTML path
plus `OPENED` or `NOT_OPENED` result. Do not copy any comprehension question,
correct option, option feedback, explanation, grading evidence, or answer
request into that response. A
pre-promotion invocation by `/adr-impl` must not ask the user to rule
`apply / skip / defer` on `PROVEN` coverage rows, implementation choices, or
ordinary evidence-backed repairs; the caller owns remediation. Contract
coverage and Notable implementation choices are read-only context, not
individual approval items.

The standalone HTML must likewise omit ruling controls and feedback export when
no finding requires human judgment. A local self-check may reveal stored
comprehension criteria after answer entry, but only an explicitly requested
interactive comprehension check may semantically grade the answer or call the
PR comprehension-ready.

Do not automatically begin the comprehension check after the report or
lifecycle result. Keep the prepared questions and hidden grading data inside the
HTML/JSON artifacts. When the user does not explicitly request an interactive
comprehension check, leave PR comprehension readiness unverified and complete
the main-session response without a question. This unverified state does not
block publishing by default. If the user or team explicitly selected a quiz
gate, preserve that publishing condition and report it without starting the
quiz automatically. Publishing permission and repository checks remain required
whether a quiz gate applies or not.
