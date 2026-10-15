# Optional comprehension artifacts

Read only when a quiz is included or its existing artifacts are being revised.
For explicitly requested conversational grading, load
[the interactive check](interactive-check.md) separately. Inclusion never starts it.

The [common comprehension workflow](../../report-writer/references/comprehension.md)
owns quiz generation, omission criteria, difficulty, count, placement and staged
self-check. Generation is strongly recommended, not mandatory. If included,
retain the generated `Comprehension check` audit section; otherwise omit the
optional data and section without an approval or required omission record.
The fields below adapt that common quiz to this review's native audit schema.

When present, `comprehensionCheck.questions` contains one to five questions with
non-empty `id`, `question`, exactly four `options`, one boolean `revisit`, one
`correctOptionId`, `explanation`, and `evidence`. Never generate free-response
primary questions or filler to reach five. For each question, keep:

- `id` — `Q1` through `Q5` in order
- `question` — the visible application prompt
- `options` — exactly four `{ "id": "A".."D", "text": "...", "feedback": "..." }` objects
- `revisit` — boolean; exactly one or two questions are marked for later re-check
- `correctOptionId` — the one correct option id
- `explanation` — why the correct option follows from the contract and evidence
- `evidence` — the ADR, code, or test evidence used to grade it

State explicitly in `prGuidance`:

- the code verdict and comprehension readiness are separate;
- a `PASS` verdict does not prove the reader understands the implementation;
- unverified or failed comprehension does not block PR publishing by default;
- publishing still requires user authorization and repository checks;
- only an explicitly selected user/team quiz gate requires every prepared
  question to pass without consulting answers or criteria before publishing.

When a gate applies, identify its basis in the current user instruction or team
convention. Do not infer a publishing gate from a quiz request or the presence of
questions. Do not infer permission to start an interactive quiz from gate
selection; interactive mode still requires an explicit request. Keep this
guidance in the existing field, without adding a progress or approval registry.

Exactly one or two questions have `revisit: true`; when the check contains one
question, that question is marked. Do not manually put hidden feedback, the
correct option, explanation, or evidence in Markdown. The materializer writes
only the visible prompts and four options.

The HTML uses the common staged self-check controls and never sets PR
comprehension readiness. Preserve the shared question, recall, teach-back,
revisit and neutral-feedback behavior when composing the review page.

Use a white page background for both screen and print. The handout prints the
main narrative, diagrams, and comprehension questions with all four choices.
Do not print answers, feedback, the reader's selected option, or interactive
controls. Keep detailed audit evidence in the HTML. Use print margins, fit
figures to page width, and avoid splitting a question/choice group that fits on
one page. Screen answer disclosure remains unchanged.

Do not manually copy the hidden quiz data into Markdown. Keep the PR guidance,
visible questions and options, revisit marker, correct option, neutral option
feedback, explanation, and ADR/code/test evidence in `findings.json`. The
materializer writes only the guidance, prompts, and choices. In HTML, show the
question and recall cue before options, reveal choices only on request, then
show a non-graded one-sentence teach-back cue after selection and before
self-check. Revisit guidance asks the reader to reopen the report later without
timers, notifications, completion state, or persisted progress. Hidden feedback
stays unavailable until self-check. Never output scores, grades, celebration,
praise, ability judgments, or gamification.
