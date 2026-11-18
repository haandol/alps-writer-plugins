# Comprehension artifacts

Read when writing or revising a review's quiz.
For explicitly requested conversational grading, load
[the interactive check](interactive-check.md) separately. Inclusion never starts it.

The [common comprehension workflow](../../report-writer/references/comprehension.md)
owns quiz generation, omission criteria, difficulty, count, placement and staged
self-check. The quiz is required: retain the generated `Comprehension check`
audit section. Only when the user explicitly excluded the quiz, set
`comprehensionCheck` to `{ "excluded": "<the user's request>" }` and write no
quiz section.
The fields below adapt that common quiz to this review's native audit schema.

Set `comprehensionCheck.readerLevel` to the effective level from the common
workflow and apply its whole-report question limit.

For each question, keep these native fields:

- `id` — `Q1` onward in order
- `question` — the visible application prompt
- `options` — exactly four `{ "id": "A".."D", "text": "...", "feedback": "..." }` objects
- `revisit` — boolean; mark one or two questions for later re-check (the sole question when there is just one)
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

The materializer writes the PR guidance to Markdown. For each question it writes
only the visible prompts and four options. Keep hidden feedback, answers and grading evidence in `findings.json`.
HTML uses the common recall, teach-back, revisit and neutral feedback controls.
Its self-check cannot establish PR comprehension readiness.

Use a white page background for both screen and print. The handout prints the
main narrative, diagrams, and comprehension questions with all four choices.
Do not print answers, feedback, the reader's selected option, or interactive
controls. Keep detailed audit evidence in the HTML. Use print margins, fit
figures to page width, and avoid splitting a question/choice group that fits on
one page. Screen answer disclosure remains unchanged.

Revisit guidance can invite the reader back without scheduling reminders or
persisting progress. Feedback stays hidden until self-check. Do not add scores,
praise, grades, or judgments of ability.
