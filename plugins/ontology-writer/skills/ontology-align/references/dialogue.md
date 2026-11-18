# Resolve discrepancies in the active alignment request

Read the saved process, its linked ADRs and prerequisites, then inspect the
code and its real entry points. Compare the expected business outcome, the
ADR obligation and observed behavior. Keep the original whole-process
`messageId` open throughout. Report a terminal blocker only when the user
declines, access or evidence is actually unavailable, or no authorized action
can advance it.

Use the local session helper `bun "${CLAUDE_PLUGIN_ROOT}/scripts/ontology-ask.mjs"`
with the following commands in the **project working directory**. Prompt files
and drafts belong in the disposable session directory. User-facing fields are
in the user's language.

1. If evidence leaves a business choice, publish one focused question:
   `prompt RUN REQUEST --file question.json`, with
   `{"id":"q1","kind":"question","question":"Which event should release the order?"}`.
   Use `wait RUN`. Its `responses` identify the request, process, prompt and
   explicit decision. `messages RUN` recovers the conversation after interruption.
   A plain answer informs the draft and never approves edits.
   A user can participate from the host conversation as well. Mirror an
   explicit whole-process request with `request RUN REQUEST --process ID`
   and an actual chat answer with `respond RUN REQUEST PROMPT answer --text-file FILE`.
   Record `approve` or `decline` only if the user saw and explicitly decided
   that exact current proposal. Do not infer approval from a request to align.
2. Prepare only the changes this process needs. If the code violates an
   approved ADR, fix the implementation under that contract. If business
   meaning changes, draft the model and the owning ADR revisions before
   implementation using the ontology-edit approval path. Do not make all
   three layers change just to match observed code. Prepare the owner's
   impact/base hash and actual drafts where required.
3. Publish the exact proposal with a fresh id using the same `prompt` command:

   ```json
   {
     "id": "p1",
     "kind": "proposal",
     "question": "Apply these changes and rerun the original process?",
     "changes": [
       {
         "layer": "code",
         "target": "src/returns.ts",
         "before": "Credits on submission.",
         "after": "Credit once the return is received."
       }
     ],
     "files": ["docs/adr/returns/0001-refunds.md", "docs/ontology/returns.ttl"],
     "verification": "Run a submitted return and a received return through the local refund entry point; observe zero and one credits respectively."
   }
   ```

   Use the actual project-relative file as each target. Include every file
   that determines the decision and any prepared drafts in `files`; the
   targets themselves are automatically bound. Describe exact contract
   values, semantic deltas and affected ADRs. Carry the owning workflow's
   approval summary into those fields. The screen's **approve** applies only
   to this proposal; a clarification or a user asking another question does
   not authorize even a partial write.

4. On `clarify`, answer the question in the same request and publish a fresh
   proposal or question. On `decline` leave the proposed files alone and send
   the actual outcome. On `stale`, recompute from the new inputs and submit
   the revised range for approval. Silence is not a decision.
5. On `approve`, run `approved RUN REQUEST PROMPT` immediately before
   mutation. Failure means the scope is no longer usable. On success execute
   the owning change and implementation workflows yourself in their original
   order (model and realization links, ADR, code), preserving their native
   stale checks. Use the exact approved proposal once. Recover from an
   interruption by comparing actual files and state before resuming; do
   not blindly replay a completed edit. No additional user invocation is needed.
6. Execute the affected local code paths and tests, then re-run the original
   whole-process alignment. If more business decisions or material changes
   are needed, repeat the dialogue for just those changes. Otherwise promote
   only if all gates and criteria pass, read back the saved Status and use
   `reply` to report the changed files, actual results/evidence and one next
   action. A passed test or approved proposal alone cannot promote a process.
