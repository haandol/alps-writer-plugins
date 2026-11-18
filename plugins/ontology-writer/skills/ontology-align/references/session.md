# Alignment decisions

Start verification in the terminal conversation. Only when user input is needed, open or reuse one decision session for this project in a background task. Use the user's
language, honor no-open or a named browser, and pass the selected index or ADR
directory when applicable:

```sh
bun "${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs" align --ui --lang ko
```

A second start in the same project and ADR index returns the existing URL
and run directory with `ALREADY_OPEN`. Use that decision screen for all
in-scope processes. Return the actual
`ALIGN_SESSION` URL and use the exact `ALIGN_RUN` directory in subsequent
commands. This is a live loopback application. A static HTML delivery bridge
cannot carry its requests. On a remote workspace use the host's existing
private port-forwarding facility for the printed loopback port; preserve its
port and tokenized path. For example, when the remote session uses port
44957, a workstation with an SSH alias for the host can run
`ssh -N -L 44957:127.0.0.1:44957 <ssh-host>` and open the printed URL.
Report connection/opening failures honestly.

1. Register each existing terminal task with `ontology-ask.mjs request RUN REQUEST --process ID` (add `--criteria '["criterion-id"]'` for a partial run). Publish the independent questions the user can answer now, each with its own ID, before waiting. A revised proposal supersedes the previous proposal while independent questions remain answerable. Start `bun "${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs" wait "<ALIGN_RUN>"`
   and keep listening. A client without background notifications can notify
   the agent in chat after sending an answer or decision. Recover delivered but
   unanswered decisions using `messages "<ALIGN_RUN>"` on the same script.
2. For each received `messageId`, use its server-validated `scope.process`
   and `scope.criteria`. An empty criteria list requests whole-process
   verification. Re-read the current plan with the session's selected index
   and recheck the chosen IDs. If prerequisites, process or criteria changed,
   identify the discrepancy; never silently substitute another task.
3. Run the requested scope using the alignment skill's contract, contradiction
   and actual-entry-point checks. Record evidence before deciding. A request
   for individual criteria, even if all are listed individually, is partial and
   never promotes the process. A whole-process request may promote only after
   every original gate passes. A full request also starts the [alignment dialogue](dialogue.md)
   when code, ADR or model disagree. Diagnose and draft immediately; editing
   requires the user's explicit approval of the actual proposal. A partial
   request authorizes local verification of its criteria only.
4. For a passing whole-process request on a Proposed process, run the normal
   `transition --process <id> --to Accepted` and read the stored Status back
   using the same index. Include that Status in the evidence. If the transition
   refuses, return the reason and one next action as a blocked result. The
   user does not need to enter a second command to finish alignment.
5. Publish each outcome to the same request. Write UTF-8 JSON in the disposable
   run directory with `outcome` (`passed`, `failed`, `blocked` or `unverified`),
   `evidence` (actual observations, limitations and the evidence location),
   and `nextAction` (one specific recommendation). Use:

   ```sh
   bun "${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs" reply "<ALIGN_RUN>" "<messageId>" --text-file "<result.json>"
   ```

   Never claim a result reached the screen until the reply succeeds. Resume
   waiting until the user ends the session or the server closes. If the agent
   or a local test input is unavailable, show that limit; the session server
   never executes a verification command or launches its own model call.
