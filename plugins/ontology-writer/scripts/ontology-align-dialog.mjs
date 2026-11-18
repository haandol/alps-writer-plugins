// Agent-authored prompts and user decisions belong to one full-process request.
// The session log is disposable; the owning workflow still checks the approved
// draft, applies the change, and verifies the actual product entry points.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const idPattern = /^[A-Za-z0-9._-]{1,80}$/;
const nonempty = (text) => typeof text === "string" && !!text.trim();
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const prompts = (events, requestId) =>
  events.filter((e) => e.type === "alignment-prompt" && e.requestId === requestId);
const responses = (events, requestId, promptId) =>
  events.filter(
    (e) => e.type === "alignment-response" && e.requestId === requestId && e.promptId === promptId,
  );
// New proposals replace the previous proposal. Questions are independent.
const latestProposal = (turns) => turns.findLast((p) => p.kind === "proposal");
const isClosed = (events) =>
  events.findLast((e) => e.type === "open" || e.type === "close")?.type === "close";

function request(events, requestId) {
  const q = events.find((e) => e.type === "discussion-question" && e.messageId === requestId);
  if (!q?.scope || q.scope.criteria.length)
    fail("Dialogue requires a whole-process alignment request");
  return q;
}
function finished(events, requestId) {
  return events.some((e) => e.type === "discussion-reply" && e.messageId === requestId);
}

/** Bind the agent's private proposal inputs without disclosing file contents to the browser. */
function fingerprint(root, names) {
  if (!nonempty(root)) fail("Reopen alignment from the project to bind proposal inputs");
  const base = realpathSync(root);
  const hash = createHash("sha256");
  for (const name of names) {
    if (
      !nonempty(name) ||
      path.isAbsolute(name) ||
      name.split(/[\\/]/).some((p) => p === ".." || p === ".git")
    )
      fail("Expected a project-relative input path");
    const file = path.resolve(base, name);
    let existing = file;
    while (!lstatSync(existing, { throwIfNoEntry: false })) existing = path.dirname(existing);
    const resolved = path.relative(base, realpathSync(existing));
    if (resolved === ".." || resolved.startsWith(".." + path.sep) || path.isAbsolute(resolved))
      fail("Input leaves the project");
    const bytes = existing === file ? readFileSync(file) : null;
    const destination = path.join(resolved, path.relative(existing, file));
    hash.update(
      JSON.stringify([
        name,
        destination,
        bytes && createHash("sha256").update(bytes).digest("hex"),
      ]),
    );
  }
  return hash.digest("hex");
}

export function preparePrompt(events, doc, requestId, input) {
  const q = request(events, requestId);
  if (
    typeof input?.id !== "string" ||
    !idPattern.test(input.id) ||
    !nonempty(input?.question) ||
    !["question", "proposal"].includes(input.kind)
  )
    fail("Expected prompt id, question and kind question or proposal");
  const event = {
    type: "alignment-prompt",
    requestId,
    promptId: input.id,
    kind: input.kind,
    question: input.question.trim(),
    scope: q.scope,
  };
  if (input.kind === "proposal") {
    if (
      !Array.isArray(input.changes) ||
      !input.changes.length ||
      input.changes.some(
        (c) =>
          !["ontology", "adr", "code"].includes(c?.layer) ||
          ![c.target, c.before, c.after].every(nonempty),
      ) ||
      !nonempty(input.verification) ||
      !Array.isArray(input.files) ||
      !input.files.length
    )
      fail("A proposal needs concrete changes, verification and input files");
    event.changes = input.changes.map(({ layer, target, before, after }) => ({
      layer,
      target,
      before,
      after,
    }));
    event.verification = input.verification;
    event.files = [...new Set([...input.files, ...event.changes.map((c) => c.target)])].sort();
    event.baseHash = fingerprint(doc.alignment.projectRoot, event.files);
  }
  return event;
}

export function confirmPrompt(events, event) {
  const previous = prompts(events, event.requestId).find((p) => p.promptId === event.promptId);
  if (previous) {
    const { seq, at, ...data } = previous;
    if (JSON.stringify(data) !== JSON.stringify(event))
      fail("Use a new prompt id for revised content", 409);
    return previous;
  }
  if (finished(events, event.requestId) || isClosed(events))
    fail("Request or session is closed", 409);
  return null;
}

export function userResponse(events, body, doc) {
  if (
    !doc.alignment ||
    Object.keys(body).some((k) => !["requestId", "promptId", "decision", "text"].includes(k))
  )
    fail("Invalid alignment response");
  const { requestId, promptId, decision, text = "" } = body;
  const q = request(events, requestId);
  const turns = prompts(events, requestId);
  const prompt = turns.find((p) => p.promptId === promptId);
  if (!prompt || (prompt.kind === "proposal" && prompt !== latestProposal(turns)))
    fail("This prompt has been replaced", 409);
  if (typeof text !== "string" || text.length > 4000) fail("Invalid answer text");
  if (
    prompt.kind === "question"
      ? decision !== "answer" || !nonempty(text)
      : !["approve", "decline", "clarify"].includes(decision) ||
        (decision === "clarify" ? !nonempty(text) : !!text.trim())
  )
    fail("Choose an available response for this prompt");
  const event = {
    type: "alignment-response",
    requestId,
    promptId,
    decision,
    text: text.trim(),
    scope: q.scope,
  };
  const old = responses(events, requestId, promptId)[0];
  if (old) {
    if (
      (old.decision !== decision && !(old.decision === "stale" && decision === "approve")) ||
      old.text !== event.text
    )
      fail("This prompt was already answered", 409);
    return { existing: old };
  }
  if (finished(events, requestId) || isClosed(events)) fail("Request or session is closed", 409);
  // Wake the agent to recompare and send a new proposal. Stale answers do not authorize a write.
  if (decision === "approve") {
    try {
      if (fingerprint(doc.alignment.projectRoot, prompt.files) !== prompt.baseHash)
        event.decision = "stale";
    } catch {
      event.decision = "stale";
    }
  }
  return { event };
}

/** The owner checks this immediately before applying and still uses its native concurrency guards. */
export function approvedProposal(events, doc, requestId, promptId) {
  request(events, requestId);
  const turns = prompts(events, requestId);
  const p = latestProposal(turns);
  if (
    !p ||
    p.kind !== "proposal" ||
    p.promptId !== promptId ||
    finished(events, requestId) ||
    isClosed(events) ||
    responses(events, requestId, promptId)[0]?.decision !== "approve" ||
    turns.some(
      (turn) => turn.kind === "question" && !responses(events, requestId, turn.promptId).length,
    )
  )
    fail("No current approval for this proposal", 409);
  if (fingerprint(doc.alignment.projectRoot, p.files) !== p.baseHash)
    fail("Approval inputs changed; present the revised proposal", 409);
  return p;
}

export function dialogueFor(events, requestId) {
  const turns = prompts(events, requestId);
  return turns.map((p) => ({
    promptId: p.promptId,
    kind: p.kind,
    question: p.question,
    ...(p.changes
      ? {
          changes: p.changes,
          verification: p.verification,
          baseline: { files: p.files, fingerprint: p.baseHash },
        }
      : {}),
    current: (p.kind === "question" || p === latestProposal(turns)) && !finished(events, requestId),
    response: responses(events, requestId, p.promptId)[0] ?? null,
  }));
}
