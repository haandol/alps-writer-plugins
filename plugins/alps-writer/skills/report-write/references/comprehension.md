# Comprehension support

Generate a short quiz as part of writing a substantive report. Its purpose is to
help the reader understand the core content and reduce the amount they must hold
in mind at once. Generating a quiz or selecting a correct answer does not measure
learning gains or cognitive-load reduction.

## Select the core content

After the report's explanation is grounded and coherent, select the concepts
the reader needs to understand its conclusion or use it correctly. Generate one
to five questions for the whole report, not per domain. Use fewer when that
covers the material; never add filler to reach five.

Questions have medium difficulty: ask the reader to apply a central concept,
causal relationship, condition, boundary, or important choice in a small
situation. The answer must follow from the document and its evidence. A new
example may illustrate that content, but must not require outside knowledge or
invent facts about the reviewed system.

Each question has exactly four distinct choices and exactly one correct answer.
Distractors represent plausible misunderstandings of the same core content.
Avoid symbol-name trivia, line-number recall, trick wording, and clues from
option length or tone. Read all four choices against the report to rule out
ambiguous or multiple correct answers. Review topical importance and difficulty
semantically; schema validation cannot establish them.

Omit questions when the user excludes them or the output has no substantive
concept to check, such as a simple completion notice. A review PASS alone is
not a reason to omit them. State the actual omission reason briefly in the
report's review basis when using the structured renderer.

## Place questions with their explanation

Place each question after the owning domain's explanation and before detailed
evidence. Keep at most four immediate peer explanation units; distribute five
questions by their actual subject, not arbitrary numbered batches.

Keep question identifiers, four choices, the single correct choice, neutral
feedback for every option, an explanation, and the grading evidence in the
source data. Mark one or two core questions for a later re-check; if there is
only one question, mark that one. Use the schema and rendering instructions in
[report document](report-document.md). Preserve a caller's native audit schema
through an adapter when needed.

## Offer staged self-check

- Initially show the question and a short cue to recall the answer. Reveal all
  four choices only after the reader requests them.
- After one choice is selected, invite the reader to explain it in one sentence
  before checking. This cue has no response field and is not graded.
- Reveal the correct choice, selected option's neutral feedback, explanation,
  and evidence only after exactly one choice and an explicit self-check.
  Changing the selection clears the previous feedback. Use no scores, grades,
  celebrations, praise, or ability judgments.
- Marked questions invite the reader to reopen the report and retry later.
  Do not add timers, notifications, completion histories, or persisted progress.

HTML must provide and verify these controls. Its printable view shows questions
and all choices, with answers, feedback, previous selections, and controls
excluded. Markdown and text keep questions and choices separate from answers
and explanations; do not claim they automatically grade or conceal answers.
Source HTML or JSON can contain the answer data: staged disclosure is a reading
aid, not an exam-security boundary.

## Keep understanding separate from task completion

The quiz does not block approval, the original task's completion, or a code
verdict. A report's PASS and a reader's understanding are different claims.
Keep a caller's specific readiness rules in that caller rather than applying
them to every report.

The ordinary completion response delivers the result and report location; it
does not ask quiz questions or request answers. Only when the user explicitly
asks to run the quiz, present one prepared question at a time. Accept one of its
four choices. For an incorrect answer, explain the missing concept with the
stored evidence and retry the same question. Keep progress in the conversation,
not in an ADR, mapping, repository, or other authoritative registry.
