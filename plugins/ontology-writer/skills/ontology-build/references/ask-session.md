# Web question session

After presenting the report, open a local web question session so the user can
answer the same questions by choosing options or writing short answers instead
of typing everything into the conversation. The session only collects answers.
It never saves the model, the ADR index or the glossary; the approval summary
and the save approval stay in the conversation.

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

`wait` exits when the user delivers answers or the session ends and prints the
delivered answers as JSON. On each wake-up:

1. Read the answers as the user's answers to those questions only.
2. Update the candidates, draft and `impact` as the answers require.
3. Rewrite `questions.json`: close settled questions, add follow-up questions
   (for example `Q3.1`) and set `agent.message` to a short summary of what changed.
   Rewriting the file ends the screen's working indicator.
4. Start `wait` again unless the session ended.

Choosing an option saves the answer at once; free text is saved with its
button. The user chooses on the screen between sending each answer at once (the
default) and collecting answers to send together; collected answers do not wake
the agent until they are sent. If the host cannot notify you when a background
command finishes, ask the user to tell you in the conversation when they have
sent answers, then run `wait --timeout 1` or `answers` to read them.

Answers given in the conversation use the same identifiers. Record them with
`ontology-ask.mjs record <run> <id> [--option <id>] [--text <text>]` so the
screen shows them. When a question is answered twice, the latest answer counts.
`ontology-ask.mjs answers <run>` prints every question with its latest answer.

Answers persist in `<run>/ask/answers.jsonl`; reopening the session shows them.
When the session ends, unanswered questions remain questions of the report and
their candidates are not saved. Then continue with section 5 in the conversation.
