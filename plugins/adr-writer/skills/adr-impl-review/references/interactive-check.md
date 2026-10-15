# Explicitly requested interactive comprehension check

Read only for an explicit request to run the conversational check. Load the
prepared quiz artifact and [quiz contract](quiz-artifact.md); if no questions
exist, prepare them under that contract before asking the first question. A quiz
in the report or an opt-in publishing gate alone does not select this module.

Only when the user explicitly asks to run the comprehension check, load the
prepared artifact and ask one primary question at a time with all four choices.
Do not reveal the correct option, feedback, explanation, or evidence first.

- On a correct selection, state the supporting concept and ask the next question
  without praise, celebration, scoring, grading, or ability judgment.
- On an incorrect selection, state that the PR is not
  comprehension-ready, explain the missing concept with the stored evidence,
  and let the reader retry the same question. A retry does not create a sixth
  primary question.
- If a question is skipped or the session ends before all questions pass, keep
  PR comprehension readiness unverified.
- Only after every prepared question passes may the response say the PR is
  comprehension-ready.

This interactive check does not reopen the implementation verdict, block
evidence-backed remediation, or delay an otherwise valid ADR Status transition.
An incorrect, skipped, or unanswered question blocks publishing only under an
explicitly selected user/team quiz gate. Passing the quiz does not grant
publishing permission or waive repository checks. HTML self-check does not
establish comprehension readiness or satisfy the opt-in publishing gate.
Do not persist quiz progress or pass/fail state in the ADR, mapping, repository,
or another registry.
