# Web question session

After presenting the report, open a local web question session so the user can
answer the same questions by choosing options or writing short answers instead
of typing everything into the conversation. A separate discussion area lets the
user ask the current authoring agent about the model or a particular question.
It never saves the model, the ADR index or the glossary; the approval summary
and the save approval stay in the conversation.

Candidate answers use one input mode. Editing free text clears that card's radio
selection immediately; sending it does not retain the old option. Choosing an
option sends that option without a previous text answer. A saved earlier answer
remains visible as history while a replacement is being written. Polling and
older save responses must not replace the current draft.

## Write the questions

`ontology-candidates.mjs prepare` writes `<run>/ask/questions.json` from the
candidate file's questions (see [candidate artifacts](candidates.md)). Otherwise
write it in the report's run directory:

```json
{
  "version": 1,
  "title": "Ontology build questions",
  "intro": "Optional context, such as the report and board paths.",
  "agent": { "message": "Optional status shown while waiting." },
  "diagram": {
    "source": "flowchart LR\n  A[Conversation] --> B[Dictionary]",
    "caption": "Optional"
  },
  "questions": [
    {
      "id": "Q3",
      "group": "Expression dictionary",
      "text": "Do podcast expressions only become suggestions?",
      "detail": "Optional summary of what the sources say.",
      "diagram": { "source": "flowchart LR\n  P[Playback] --> S[Suggestions]" },
      "evidence": [
        { "source": "docs/adr/audio/0001-x.md", "detail": "line 33 — …", "verdict": "conflicting" }
      ],
      "options": [
        {
          "id": "suggest",
          "label": "Suggestions only",
          "description": "Optional",
          "recommended": true,
          "diagram": {
            "source": "flowchart LR\n  P[Playback] --> S[Suggestions] -->|learner picks| D[Dictionary]"
          }
        },
        { "id": "review", "label": "Also in review" }
      ],
      "allowText": true
    },
    {
      "id": "Q7",
      "text": "Does finishing the daily quiz count as a study day?",
      "resolved": { "summary": "Yes — the newer accepted decision says so.", "optionId": "yes" },
      "evidence": [
        { "source": "docs/adr/mission/0003-x.md", "detail": "Decision — …", "verdict": "stated" }
      ],
      "options": [
        { "id": "yes", "label": "Counts" },
        { "id": "no", "label": "Does not count" }
      ]
    }
  ]
}
```

Use the report's question identifiers unchanged. Options are optional; free
text is accepted unless `allowText` is `false`. A question can be marked
`"closed": true` once settled. Text, evidence and diagram sources are shown as
plain text, so document passages never run as markup.

Visualize every question whose answer depends on a flow, a boundary or a
consequence: give the question a Mermaid `diagram` of the business situation,
and give each option a `diagram` of the flow that option would produce, so the
user compares outcomes side by side. Use `evidence` items with their source
verdicts (`stated`, `inferred`, `conflicting`, `unconfirmed`) for the sources
behind the question; conflicting evidence opens by default. A session-level
`diagram` gives an overview, such as the bounded contexts the questions touch.
Mermaid renders in the page from the bundled engine with strict security; a
diagram it cannot draw shows its source and the error.

Before asking, apply the resolve-before-asking pass of section 3. A question a
current repository source answers gets `resolved` (a `summary` and, when an
option fits, its `optionId`) with that source in `evidence`; the screen lists it
under resolved questions, and the user can still answer it. When sources settle
only part of a question, add `"partial": true` to `resolved`, put the settled
part in its `summary` and ask only the remaining part as the question's text; it
stays among the asked questions. Ask the rest.

Check the diagrams' syntax before opening or after rewriting the file:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs check <run>
```

## Run the loop

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs open <run> --lang ko   # run in the background
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs wait <run>             # run in the background
```

`open` binds to the loopback address with a per-session token, prints
`ASK_SESSION <url>`, opens the browser (`--no-open`, `--browser <name>`) and
writes `<run>/ask/session.json`. Give the user the URL. Reopening a session that
ended keeps the same address when its port is free, so an open page keeps
working; while the session is still running, `open` prints its address and
`ALREADY_OPEN` instead of starting a second server.

`wait` exits when the user delivers candidate answers, asks a model question, or
ends the session. Its JSON separates `answers` from discussion `messages`.
Only an active `wait` command advertises that the agent is listening; starting
the server alone does not establish an available authoring agent. On each wake-up:

1. Read `answers` as the user's candidate answers to those questions only.
   Read `messages` as questions seeking explanation, with their supplied question
   context. They do not change candidate answers or approve saving.
2. Update the candidates, draft and `impact` only as candidate answers require.
   For each discussion message, read the relevant current model/candidate and
   source evidence, then answer the question through `reply` below. Do not
   reinterpret a discussion question or your reply as an answer selection.
3. Rewrite `questions.json`: close settled questions, add follow-up questions
   (for example `Q3.1`) and set `agent.message` to a short summary of what changed.
   Rewriting the file ends the screen's working indicator. A discussion-only
   exchange does not require regenerating the candidates or question cards.
4. Start `wait` again unless the session ended.

Choosing an option saves the answer at once; free text is saved with its
button. The user chooses on the screen between sending each answer at once (the
default) and collecting answers to send together; collected answers do not wake
the agent until they are sent. If the host cannot notify you when a background
command finishes, tell the user how to notify you in the main conversation after
sending an answer or question, then run `wait --timeout 1`, `answers`, or
`messages` to read it. Preserve the queued message and describe that limitation;
do not promise an automatic response or start another model/provider as a fallback.

## Answer model questions

The current authoring agent supplies the explanation; the local server has no
inference backend and exposes no browser operation for writing agent replies.
Use the delivered `messageId` to associate a complete reply with its question:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs messages <run>
bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs reply <run> <message-id> --text-file <reply.txt>
```

Write the reply file inside the disposable run directory. `--text` is also
available for a short safely quoted response. A repeated identical reply is a
no-op; a different reply under the same message identity is rejected rather than
silently overwriting the explanation. The screen shows the question's original
context, reply, and whether it is awaiting delivery or an answer. Discussion
messages are sent independently of the candidate-answer batching preference.

Return to `wait` after replying unless the session ended. Discussion and its
message/reply pairing survive question updates and session reopening in the same
disposable event log. They never enter the model, ADR index or glossary.
On resume, inspect `messages` for delivered questions with no reply before
waiting again; a stopped author may have consumed a delivery before answering.
Reuse that message identity and leave completed replies intact.

## Answers from the main conversation

Answers given in the conversation use the same identifiers. Record them with
`ontology-ask.mjs record <run> <id> [--option <id>] [--text <text>]` so the
screen shows them. Choose `--option` or a nonempty `--text`, not both. This command
records an actual candidate answer; it is not the way to answer a model question.
When a question is answered twice, the latest answer counts.
`ontology-ask.mjs answers <run>` prints every question with its latest answer.

Answers persist in `<run>/ask/answers.jsonl`; reopening the session shows them.
When the session ends, unanswered questions remain questions of the report and
their candidates are not saved. Then continue with section 5 in the conversation.
