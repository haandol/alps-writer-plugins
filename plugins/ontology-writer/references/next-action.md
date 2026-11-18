# Continue the conversation

Help the user reach a verified Accepted business process where this is their goal. Build and edit establish confirmed target work; sync and view expose gaps and links; alignment checks contracts and real execution before promotion. Respect the current request, a retired process and a decision to stop.

Close each user-facing ontology reply with one concrete next action in the
user's language. Name the process, step, ADR or input, explain why it comes
next, and give the relevant command or a question the user can answer. If the
next step is already authorized, carry it out and report what remains. A
recommendation alone grants no permission to write, execute or change Status.
Put **exactly one recommendation last** in a status or workflow reply. If several
processes or blockers were discussed, choose one that can advance now, name
its exact process, criterion, event or ADR, and state what the action will
produce. Use a runnable skill invocation with the real target, or a concrete
natural-language request when no ID is known. Never invent an ID. A short
invitation such as “Shall I draft that change?” may close the same sentence;
it is about that one action. Keep later steps, alternatives and other
processes out of the closing recommendation. A numbered roadmap alone does
not give the user this decision. If evidence is missing, recommend the one
read-only check that would settle it. If the work is finished, identify one
optional way to use the result, or state that no further action is needed.
If there is a pending choice or approval, use that existing question.
Honor a request to stop.

Write the closing line as a single action sentence. For example:
“배너 부분 환불의 관찰 기준에 누락된 과금 요청 인계를 연결하는 초안을 준비할까요?”
Stop there. Check the last paragraph for a second verb that asks the user to
do something else later. Move necessary background before the recommendation;
omit later implementation, tests or promotion from the recommendation itself.

- When showing a saved process Status, read its process query or alignment
  plan and use its next action. For `Proposed`, explain that the target flow
  is recorded and end-to-end verification is pending. Prefer the actual
  blocker (a diagnostic, missing link, outstanding ADR or observation gap).
  When implementation is next, check the named feature's declared prerequisites;
  identify the outstanding prerequisite first if there is one. If the
  implementation skill is unavailable, name the required plugin or owner.
  If the mechanical gates hold, offer `/ontology-align <process>` to check
  contracts and run the real criteria. A plan is not evidence of execution.
- After a real alignment run, use the actual result over the plan. Name the
  failed or unverified criterion and its missing evidence. If all passed,
  give the evidence location and offer to inspect it. A retired process can
  lead to its recorded replacement or its history.
- During build, edit, review or viewing, use the task already in progress.
  Ask for the specific missing input, present the pending choice, or offer
  the concrete follow-up to the finding or view just delivered. Respect saved
  setup and ADR review choices. For completed or declined work, say what is
  complete and offer an optional way to use or revisit the result; do not
  reopen a settled choice.
