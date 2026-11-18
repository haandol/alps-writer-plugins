#!/usr/bin/env bun
// Local web sessions for ontology build questions and agent-run alignment requests.
// The agent writes <run>/ask/questions.json; the user answers in the browser;
// answers are appended to <run>/ask/answers.jsonl. The session never saves the
// model, the ADR index or the glossary — final approval stays in the conversation.
//
// Usage:
//   bun ontology-ask.mjs open <run> [--no-open] [--browser NAME] [--lang ko|en] [--idle-minutes N]
//   bun ontology-ask.mjs wait <run> [--timeout SECONDS]
//   bun ontology-ask.mjs answers <run>
//   bun ontology-ask.mjs record <run> <question-id> [--option ID] [--text TEXT]
//   bun ontology-ask.mjs messages <run>
//   bun ontology-ask.mjs reply <run> <message-id> [--text TEXT | --text-file FILE]
//   bun ontology-ask.mjs prompt <run> <message-id> --file <prompt.json>
//   bun ontology-ask.mjs approved <run> <message-id> <prompt-id>
//   bun ontology-ask.mjs request <run> <message-id> --process ID
//   bun ontology-ask.mjs respond <run> <message-id> <prompt-id> answer|clarify|approve|decline [--text-file FILE]
//   bun ontology-ask.mjs check <run>
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { openerCommand } from "./adr-impl-review-open.mjs";
import { alignmentPage } from "./ontology-align-session.mjs";
import {
  approvedProposal,
  confirmPrompt,
  dialogueFor,
  preparePrompt,
  userResponse,
} from "./ontology-align-dialog.mjs";
import { parseMermaidAll, parseMermaid } from "../skills/report-writer/scripts/mermaid.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ID = /^[A-Za-z0-9._-]{1,40}$/;
const MAX_TEXT = 4000;
const MAX_BODY = 32 * 1024;
const MAX_DIAGRAM = 20000;
const VERDICTS = new Set(["stated", "inferred", "conflicting", "unconfirmed"]);
const ALIGNMENT_OUTCOMES = new Set(["passed", "failed", "blocked", "unverified"]);
const MERMAID = path.join(HERE, "../skills/report-writer/scripts/vendor/mermaid.min.js");

/** A diagram is Mermaid source with an optional caption; returns an error text or null. */
function diagramError(d, where) {
  if (d === undefined) return null;
  if (!d || typeof d.source !== "string" || !d.source.trim() || d.source.length > MAX_DIAGRAM)
    return `${where} diagram needs Mermaid source of at most ${MAX_DIAGRAM} characters`;
  if (d.caption !== undefined && typeof d.caption !== "string")
    return `${where} diagram caption must be text`;
  return null;
}

function evidenceError(list, where) {
  if (list === undefined) return null;
  if (!Array.isArray(list)) return `${where} evidence must be an array`;
  for (const e of list) {
    if (!e || typeof e.source !== "string" || !e.source.trim())
      return `${where} evidence needs a source`;
    if (e.verdict !== undefined && !VERDICTS.has(e.verdict))
      return `${where} evidence verdict must be one of ${[...VERDICTS].join(", ")}`;
  }
  return null;
}

/** Every diagram in a question document, with where it appears. */
export function diagramsOf(doc) {
  const out = [];
  if (doc.diagram) out.push({ where: "session", source: doc.diagram.source });
  for (const q of doc.questions ?? []) {
    if (q.diagram) out.push({ where: q.id, source: q.diagram.source });
    for (const o of q.options ?? [])
      if (o.diagram) out.push({ where: `${q.id}/${o.id}`, source: o.diagram.source });
  }
  return out;
}

/** Check every diagram's syntax with the bundled Mermaid parser. */
export function checkDiagrams(doc) {
  const all = diagramsOf(doc);
  parseMermaidAll(all.map((d) => d.source));
  return all.flatMap((d) => {
    const parsed = parseMermaid(d.source);
    return parsed.error ? [{ where: d.where, error: parsed.error }] : [];
  });
}

export const sessionFiles = (run) => {
  const dir = path.join(path.resolve(run), "ask");
  return {
    dir,
    questions: path.join(dir, "questions.json"),
    answers: path.join(dir, "answers.jsonl"),
    cursor: path.join(dir, "cursor.json"),
    session: path.join(dir, "session.json"),
    listener: path.join(dir, "listener.json"),
  };
};

/** Validate the agent-authored question file; returns { ok, value | error }. */
export function parseQuestions(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `questions.json is not JSON: ${error.message}` };
  }
  const fail = (error) => ({ ok: false, error });
  if (doc?.alignment !== undefined && doc.questions === undefined) doc.questions = [];
  if (!doc || doc.version !== 1 || !Array.isArray(doc.questions))
    return fail("questions.json needs version 1 and a questions array");
  if (doc.alignment !== undefined) {
    if (!Array.isArray(doc.alignment?.processes)) return fail("alignment needs a processes array");
    const processes = new Set();
    for (const process of doc.alignment.processes) {
      if (typeof process?.id !== "string" || !process.id.trim() || processes.has(process.id))
        return fail("alignment processes need distinct nonempty ids");
      processes.add(process.id);
      if (!Array.isArray(process.criteria)) return fail(`process ${process.id} needs criteria`);
      const criteria = new Set();
      for (const item of process.criteria) {
        if (
          typeof item?.criterion !== "string" ||
          !item.criterion.trim() ||
          criteria.has(item.criterion)
        )
          return fail(`process ${process.id} needs distinct nonempty criterion ids`);
        criteria.add(item.criterion);
      }
    }
  }
  const top = diagramError(doc.diagram, "session");
  if (top) return fail(top);
  const seen = new Set();
  for (const q of doc.questions) {
    if (!q || !ID.test(q.id ?? ""))
      return fail(`question id ${JSON.stringify(q?.id)} must match ${ID}`);
    if (seen.has(q.id)) return fail(`duplicate question id ${q.id}`);
    seen.add(q.id);
    if (typeof q.text !== "string" || !q.text.trim()) return fail(`question ${q.id} needs text`);
    const opts = q.options ?? [];
    if (!Array.isArray(opts)) return fail(`question ${q.id} options must be an array`);
    const optIds = new Set();
    for (const o of opts) {
      if (!o || !ID.test(o.id ?? "") || typeof o.label !== "string" || !o.label.trim())
        return fail(`question ${q.id} has an option without a valid id and label`);
      if (optIds.has(o.id)) return fail(`question ${q.id} repeats option ${o.id}`);
      optIds.add(o.id);
      const bad = diagramError(o.diagram, `option ${q.id}/${o.id}`);
      if (bad) return fail(bad);
    }
    const bad =
      diagramError(q.diagram, `question ${q.id}`) ?? evidenceError(q.evidence, `question ${q.id}`);
    if (bad) return fail(bad);
    // A question the agent answered from repository sources; the user may still answer it.
    if (q.resolved !== undefined) {
      const r = q.resolved;
      if (!r || typeof r.summary !== "string" || !r.summary.trim())
        return fail(`question ${q.id} resolved needs a summary`);
      if (r.optionId && !optIds.has(r.optionId))
        return fail(`question ${q.id} resolved names unknown option ${r.optionId}`);
      // A partly resolved question shows the settled part and still asks the rest.
      if (r.partial !== undefined && typeof r.partial !== "boolean")
        return fail(`question ${q.id} resolved.partial must be true or false`);
    }
    if (!opts.length && q.allowText === false)
      return fail(`question ${q.id} accepts neither an option nor text`);
  }
  return { ok: true, value: doc };
}

export function readEvents(file) {
  return existsSync(file) ? parseEvents(readFileSync(file, "utf8")) : [];
}

function parseEvents(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return []; // a torn last line is ignored; earlier answers stay intact
      }
    });
}

/**
 * Append one event. The server and the `record` command are separate processes, so the
 * sequence number is taken under a short exclusive lock; two writers never share one.
 */
function appendEvent(file, event, reuse = () => null) {
  return withLock(`${file}.lock`, () => {
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    const events = parseEvents(text);
    const existing = reuse(events, event);
    if (existing) return existing;
    const seq = events.length + 1;
    const record = { ...event, seq, at: new Date().toISOString() };
    // A writer that died mid-line leaves a torn tail; start on a new line so this record survives.
    const separator = text && !text.endsWith("\n") ? "\n" : "";
    appendFileSync(file, `${separator}${JSON.stringify(record)}\n`);
    return record;
  });
}

const LOCK_WAIT_MS = 15_000;
const LOCK_STALE_MS = 10_000;

/** Run `fn` holding a directory lock; a lock left by a writer that died is stale after a while. */
export function withLock(lock, fn) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let age = 0;
      try {
        age = Date.now() - statSync(lock).mtimeMs;
      } catch {
        continue; // released between the two calls
      }
      if (age > LOCK_STALE_MS) rmSync(lock, { recursive: true, force: true });
      else if (Date.now() > deadline) throw new Error(`the answers file stays locked: ${lock}`);
      else Bun.sleepSync(5);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** The recorded session, or null. */
export function readSession(run) {
  return readJson(sessionFiles(run).session);
}

/** Only a live, open alignment session can be shared between terminal launches. */
export function activeAlignmentSession(run) {
  const session = readSession(run);
  if (
    !session?.alignment ||
    !Number.isInteger(session.pid) ||
    session.pid <= 0 ||
    !session.url ||
    !alive(session.pid)
  )
    return null;
  const lifecycle = readEvents(sessionFiles(run).answers).findLast(
    (event) => event.type === "open" || event.type === "close",
  );
  return lifecycle?.type === "open" ? session : null;
}

/** Latest answer per question, which web answers still wait for delivery, and closure. */
export function summarize(doc, events) {
  const latest = new Map();
  const delivered = new Map();
  let lastDeliver = null;
  let closed = null;
  for (const e of events) {
    if (e.type === "answer") latest.set(e.questionId, e);
    else if (e.type === "deliver") {
      for (const id of e.questionIds ?? []) delivered.set(id, e.seq);
      lastDeliver = e;
    } else if (e.type === "close") closed = e;
    else if (e.type === "open") closed = null;
  }
  const questions = (doc?.questions ?? []).map((q) => {
    const a = latest.get(q.id) ?? null;
    const pending = Boolean(a && a.channel === "web" && (delivered.get(q.id) ?? 0) < a.seq);
    const option = a?.optionId ? (q.options ?? []).find((o) => o.id === a.optionId) : null;
    return {
      ...q,
      answer: a && {
        optionId: a.optionId ?? null,
        optionLabel: option?.label ?? null,
        text: a.text ?? "",
        channel: a.channel,
        at: a.at,
      },
      pending,
    };
  });
  return { questions, lastDeliver, closed };
}

/** New answers have one input mode; historical combined answers remain readable. */
function answerError(q, optionId, text) {
  if (optionId && !(q.options ?? []).some((o) => o.id === optionId)) return "unknown option";
  if (text.length > MAX_TEXT) return "text too long";
  if (text.trim() && q.allowText === false) return "text not accepted";
  if (optionId && text.trim()) return "choose an option or write an answer, not both";
  if (!optionId && !text.trim()) return "empty answer";
  return null;
}

function discussionError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** Store a user question separately from candidate answers, reusing its retry identity. */
export function recordDiscussionMessage(
  run,
  { messageId, text, questionId = null },
  scope = null,
  channel = "web",
) {
  const files = sessionFiles(run);
  const doc = loadQuestions(files);
  if (!doc.ok) throw discussionError(doc.error);
  if (typeof messageId !== "string" || !ID.test(messageId))
    throw discussionError("invalid message identity");
  if (typeof text !== "string" || !text.trim()) throw discussionError("empty question");
  if (!scope && text.length > MAX_TEXT) throw discussionError("question too long");
  const q = questionId === null ? null : doc.value.questions.find((q) => q.id === questionId);
  const question = text.trim();
  return appendEvent(
    files.answers,
    {
      type: "discussion-question",
      messageId,
      text: question,
      context: q ? { questionId: q.id, text: q.text, detail: q.detail ?? "" } : null,
      ...(scope ? { scope, channel } : {}),
    },
    (events) => {
      const prior = events.find(
        (e) => e.type === "discussion-question" && e.messageId === messageId,
      );
      if (prior && (prior.text !== question || (prior.context?.questionId ?? null) !== questionId))
        throw discussionError("message identity already has different content", 409);
      if (!prior && questionId !== null && !q) throw discussionError("unknown question context");
      if (Boolean(doc.value.alignment) !== Boolean(scope))
        throw discussionError("request does not match this session");
      if (!prior && scope) {
        const process = doc.value.alignment.processes.find((p) => p.id === scope.process);
        if (!process) throw discussionError("unknown process");
        const criteria = new Set(process.criteria.map((item) => item.criterion));
        if (scope.criteria.some((id) => !criteria.has(id)))
          throw discussionError("unknown criterion for this process");
      }
      return prior;
    },
  );
}

/** A click requests only the named catalogue scope; empty criteria mean the entire process. */
function recordVerification(run, body, channel = "web") {
  if (
    Object.keys(body).some((key) => !["messageId", "process", "criteria"].includes(key)) ||
    typeof body.process !== "string" ||
    !body.process.trim() ||
    !Array.isArray(body.criteria) ||
    body.criteria.some((id) => typeof id !== "string" || !id)
  )
    throw discussionError("expected messageId, process and a list of criterion ids");
  const scope = { process: body.process, criteria: [...new Set(body.criteria)].sort() };
  return recordDiscussionMessage(
    run,
    { messageId: body.messageId, text: JSON.stringify(scope) },
    scope,
    channel,
  );
}

/** Agent prompts are local CLI operations. The browser may only answer the displayed revision. */
export function publishAlignmentPrompt(run, id, input) {
  const files = sessionFiles(run);
  const doc = loadQuestions(files);
  if (!doc.ok || !doc.value.alignment) throw discussionError("Alignment session required");
  const event = preparePrompt(readEvents(files.answers), doc.value, id, input);
  return appendEvent(files.answers, event, (events) => confirmPrompt(events, event));
}

function recordAlignmentResponse(run, body, channel = "web") {
  const files = sessionFiles(run);
  const doc = loadQuestions(files);
  if (!doc.ok || !doc.value.alignment) throw discussionError("Alignment session required");
  return appendEvent(files.answers, {}, (events, event) => {
    const { existing, event: response } = userResponse(events, body, doc.value);
    if (existing) return existing;
    Object.assign(event, response, { channel });
  });
}

function alignmentResult(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw discussionError("alignment reply must be JSON");
  }
  if (
    !ALIGNMENT_OUTCOMES.has(value?.outcome) ||
    typeof value.evidence !== "string" ||
    !value.evidence.trim() ||
    typeof value.nextAction !== "string" ||
    !value.nextAction.trim() ||
    Object.keys(value).some((key) => !["outcome", "evidence", "nextAction"].includes(key))
  )
    throw discussionError(
      "alignment reply needs outcome (passed, failed, blocked or unverified), evidence and nextAction",
    );
  return {
    outcome: value.outcome,
    evidence: value.evidence.trim(),
    nextAction: value.nextAction.trim(),
  };
}

/** Only the local authoring agent can publish a reply; the browser has no reply endpoint. */
export function recordDiscussionReply(run, messageId, text) {
  const files = sessionFiles(run);
  if (typeof messageId !== "string" || !ID.test(messageId))
    throw discussionError("invalid message identity");
  if (typeof text !== "string" || !text.trim()) throw discussionError("empty reply");
  const reply = { type: "discussion-reply", messageId, text: text.trim() };
  return appendEvent(files.answers, reply, (events) => {
    const question = events.find(
      (e) => e.type === "discussion-question" && e.messageId === messageId,
    );
    if (!question) throw discussionError("unknown discussion message");
    if (text.length > (question.scope ? MAX_BODY : MAX_TEXT))
      throw discussionError("reply too long");
    if (question.scope) {
      reply.result = alignmentResult(text);
      reply.text = JSON.stringify(reply.result);
      const dialogue = dialogueFor(events, messageId);
      const turn = dialogue.findLast((item) => item.kind === "proposal");
      if (dialogue.some((item) => item.current && !item.response))
        throw discussionError("A user decision is pending", 409);
      if (
        ["decline", "stale", "clarify"].includes(turn?.response?.decision) &&
        reply.result.outcome === "passed"
      )
        throw discussionError(
          "The last proposal has no approval; this request cannot be marked passed",
          409,
        );
    }
    const prior = events.find((e) => e.type === "discussion-reply" && e.messageId === messageId);
    if (prior && prior.text !== reply.text)
      throw discussionError("message already has a different reply", 409);
    return prior;
  });
}

function discussionPayload(e) {
  return {
    messageId: e.messageId,
    text: e.text,
    context: e.context,
    at: e.at,
    ...(e.scope ? { scope: e.scope } : {}),
  };
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

/** A live wait command establishes availability; a question-file message does not. */
function discussionState(files, events) {
  const listener = readJson(files.listener);
  const available = Boolean(
    listener?.waiting && listener.until > Date.now() && alive(listener.pid),
  );
  const cursor = readJson(files.cursor)?.seq ?? 0;
  const replies = new Map(
    events.filter((e) => e.type === "discussion-reply").map((e) => [e.messageId, e]),
  );
  return {
    available,
    messages: events
      .filter((e) => e.type === "discussion-question")
      .map((e) => {
        const reply = replies.get(e.messageId);
        return {
          ...discussionPayload(e),
          ...(e.scope ? { dialogue: dialogueFor(events, e.messageId) } : {}),
          delivered: e.seq <= cursor,
          reply: reply
            ? { text: reply.text, at: reply.at, ...(reply.result ? { result: reply.result } : {}) }
            : null,
        };
      }),
  };
}

export function discussionMessages(run) {
  const files = sessionFiles(run);
  return discussionState(files, readEvents(files.answers));
}

const loadQuestions = (files) => parseQuestions(readFileSync(files.questions, "utf8"));

/** The answers a delivery hands to the agent, with the question text they answer. */
function answerPayload(doc, events, ids) {
  const { questions } = summarize(doc, events);
  return questions
    .filter((q) => ids.has(q.id) && q.answer)
    .map((q) => ({ questionId: q.id, question: q.text, ...q.answer }));
}

// ---- open: the session server ----------------------------------------------------------
export function startServer(
  run,
  { lang = "ko", idleMinutes = 120, port = 0, onClose = () => {}, refreshAlignment } = {},
) {
  const files = sessionFiles(run);
  const first = loadQuestions(files);
  if (!first.ok) throw new Error(first.error);
  const alignment = Boolean(first.value.alignment);
  let good = first.value;
  let goodMtime = statSync(files.questions).mtimeMs;
  let warning = null;
  const current = () => {
    const mtime = statSync(files.questions).mtimeMs;
    if (mtime !== goodMtime) {
      const next = loadQuestions(files);
      if (next.ok && Boolean(next.value.alignment) !== alignment)
        warning = "session mode cannot change while open";
      else if (next.ok) [good, warning] = [next.value, null];
      else warning = next.error; // keep showing the last valid questions
      goodMtime = mtime;
    }
    return good;
  };
  // Reopening a session keeps its address, so the page the user has open still works.
  const previous = readSession(run);
  const token =
    previous?.url?.match(/\/s\/([A-Za-z0-9_-]{32})\//)?.[1] ??
    randomBytes(24).toString("base64url");
  const prefix = `/s/${token}`;
  let lastSeen = Date.now();
  appendEvent(files.answers, { type: "open" });

  const headers = {
    "Content-Security-Policy":
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  const deny = (status, reason) => json({ error: reason }, status);
  const asset = (name, type) =>
    new Response(readFileSync(path.resolve(HERE, name)), {
      headers: { ...headers, "Content-Type": type },
    });

  let refreshedThrough = 0;
  const state = () => {
    let doc = current();
    const events = readEvents(files.answers);
    const latestReply =
      alignment && refreshAlignment && events.findLast((e) => e.type === "discussion-reply");
    if (latestReply && latestReply.seq > refreshedThrough) {
      try {
        const updated = { ...doc, alignment: refreshAlignment() };
        const tmp = files.questions + ".refresh";
        writeFileSync(tmp, JSON.stringify(updated), { mode: 0o600 });
        renameSync(tmp, files.questions);
        doc = good = updated;
        goodMtime = statSync(files.questions).mtimeMs;
        warning = null;
      } catch {
        warning =
          lang === "ko"
            ? "저장된 모델을 다시 읽지 못했습니다. 표시된 상태는 이전 조회 결과입니다."
            : "Could not refresh the model. The displayed status is from the earlier snapshot.";
      }
      refreshedThrough = latestReply.seq;
    }
    const s = summarize(doc, events);
    const working = Boolean(s.lastDeliver && Date.parse(s.lastDeliver.at) > goodMtime);
    return {
      title: doc.title ?? "",
      intro: doc.intro ?? "",
      diagram: doc.diagram ?? null,
      agent: doc.agent ?? null,
      ...(alignment ? { alignment: doc.alignment } : {}),
      lang,
      questions: s.questions,
      sequence: events.at(-1)?.seq ?? 0,
      questionRevision: goodMtime,
      discussion: discussionState(files, events),
      working,
      warning,
      closed: Boolean(s.closed),
    };
  };

  const shutdown = (reason) => {
    appendEvent(files.answers, { type: "close", reason });
    setTimeout(() => {
      server.stop(true);
      onClose(reason);
    }, 50);
  };

  async function handle(req) {
    const url = new URL(req.url);
    const origin = `http://127.0.0.1:${server.port}`;
    if (req.headers.get("host") !== `127.0.0.1:${server.port}`) return deny(403, "host");
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`))
      return deny(404, "not found");
    lastSeen = Date.now();
    const route = url.pathname.slice(prefix.length) || "/";
    if (req.method === "GET") {
      if (route === "/")
        return new Response(alignment ? alignmentPage(lang, prefix) : page(lang, prefix), {
          headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
        });
      if (route === "/app.js")
        return asset(
          alignment ? "ontology-align-session-client.js" : "ontology-ask-client.js",
          "text/javascript; charset=utf-8",
        );
      if (route === "/app.css")
        return asset(
          alignment ? "ontology-align-session.css" : "ontology-ask.css",
          "text/css; charset=utf-8",
        );
      if (!alignment && route === "/mermaid.js")
        return asset(MERMAID, "text/javascript; charset=utf-8");
      if (route === "/api/state") return json(state());
      return deny(404, "not found");
    }
    if (req.method !== "POST") return deny(405, "method");
    if (req.headers.get("origin") !== origin) return deny(403, "origin");
    if (!(req.headers.get("content-type") ?? "").startsWith("application/json"))
      return deny(415, "content type");
    const raw = await req.text();
    if (raw.length > MAX_BODY) return deny(413, "too large");
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return deny(400, "json");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return deny(400, "object required");
    if (state().closed) return deny(409, "closed");
    if (route === "/api/close") {
      shutdown("user");
      return json({ closed: true });
    }
    if (alignment) {
      if (route !== "/api/respond") return deny(404, "not found");
      try {
        recordAlignmentResponse(run, body);
        return json(state());
      } catch (error) {
        return deny(error.status ?? 500, error.message);
      }
    }
    if (route === "/api/answer") {
      const doc = current();
      const q = doc.questions.find((x) => x.id === body.questionId);
      if (!q || q.closed) return deny(400, "unknown or closed question");
      const optionId = body.optionId ?? null;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const invalid = answerError(q, optionId, text);
      if (invalid) return deny(400, invalid);
      appendEvent(files.answers, {
        type: "answer",
        channel: "web",
        questionId: q.id,
        optionId,
        text,
      });
      if (body.deliver) appendEvent(files.answers, { type: "deliver", questionIds: [q.id] });
      return json(state());
    }
    if (route === "/api/discussion") {
      try {
        recordDiscussionMessage(run, body);
        return json(state());
      } catch (error) {
        return deny(error.status ?? 500, error.message);
      }
    }
    if (route === "/api/deliver") {
      const ids = state()
        .questions.filter((q) => q.pending)
        .map((q) => q.id);
      if (ids.length) appendEvent(files.answers, { type: "deliver", questionIds: ids });
      return json(state());
    }
    return deny(404, "not found");
  }
  const serve = (p) => Bun.serve({ hostname: "127.0.0.1", port: p, fetch: handle });
  let server;
  try {
    server = serve(port || previous?.port || 0);
  } catch (error) {
    if (port || !previous?.port) throw error;
    server = serve(0); // the earlier port is taken, so the address changes
  }
  const url = `http://127.0.0.1:${server.port}${prefix}/`;
  // The address carries the session token: keep it private, and never let a reader see half of it.
  const sessionTmp = `${files.session}.${process.pid}.tmp`;
  writeFileSync(
    sessionTmp,
    JSON.stringify(
      { url, port: server.port, pid: process.pid, alignment, startedAt: new Date().toISOString() },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  renameSync(sessionTmp, files.session);
  const idle = setInterval(() => {
    if (Date.now() - lastSeen > idleMinutes * 60_000) {
      clearInterval(idle);
      shutdown("idle");
    }
  }, 5_000);
  idle.unref?.();
  return {
    url,
    alignment,
    server,
    stop: (reason = "stopped") => {
      clearInterval(idle);
      shutdown(reason);
    },
  };
}

function page(lang, prefix) {
  const title = lang === "ko" ? "온톨로지 질문" : "Ontology questions";
  return `<!doctype html>
<html lang="${lang === "ko" ? "ko" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="icon" href="data:,"><link rel="stylesheet" href="${prefix}/app.css"></head>
<body><main id="app" data-lang="${lang === "ko" ? "ko" : "en"}"></main><script src="${prefix}/mermaid.js"></script><script src="${prefix}/app.js"></script></body>
</html>`;
}

// ---- wait / answers / record ------------------------------------------------------------
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Deliver candidate answers and model questions separately; never treat discussion as approval. */
export async function waitForAnswers(run, { timeoutSeconds = 0, pollMs = 300 } = {}) {
  const files = sessionFiles(run);
  const deadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : Infinity;
  const waiter = randomBytes(12).toString("hex");
  try {
    for (;;) {
      writeFileSync(
        files.listener,
        JSON.stringify({
          id: waiter,
          pid: process.pid,
          waiting: true,
          until: Date.now() + Math.max(1500, pollMs * 3),
        }),
      );
      const cursor = readJson(files.cursor)?.seq ?? 0;
      const events = readEvents(files.answers);
      const fresh = events.filter(
        (e) =>
          e.seq > cursor &&
          ["deliver", "discussion-question", "alignment-response", "close"].includes(e.type),
      );
      // Read like every other session reader: a session being (re)started is not a crash.
      const session = readSession(run);
      const lifecycle = events.findLast((e) => e.type === "open" || e.type === "close");
      const closed = lifecycle?.type === "close" ? lifecycle : null;
      const stopped = !fresh.length && session && !alive(session.pid);
      if (fresh.length || stopped || closed) {
        const ids = new Set(
          fresh.filter((e) => e.type === "deliver").flatMap((e) => e.questionIds),
        );
        const doc = loadQuestions(files);
        const responses = fresh.filter((e) => e.type === "alignment-response");
        const result = {
          answers: doc.ok ? answerPayload(doc.value, events, ids) : [],
          messages: fresh.filter((e) => e.type === "discussion-question").map(discussionPayload),
          ...(responses.length || doc.value?.alignment ? { responses } : {}),
          closed: Boolean(closed || stopped),
          ...(closed ? { reason: closed.reason } : stopped ? { reason: "server stopped" } : {}),
        };
        // Overlapping waits share a delivery cursor. A retry that lost the
        // claim must wait for a new request instead of running this one twice.
        if (fresh.length) {
          const claimed = withLock(`${files.cursor}.lock`, () => {
            if ((readJson(files.cursor)?.seq ?? 0) !== cursor) return false;
            writeFileSync(files.cursor, JSON.stringify({ seq: fresh.at(-1).seq }));
            return true;
          });
          if (!claimed) continue;
        }
        return result;
      }
      if (Date.now() > deadline) return { answers: [], messages: [], closed: false, timeout: true };
      await Bun.sleep(pollMs);
    }
  } finally {
    if (readJson(files.listener)?.id === waiter)
      writeFileSync(files.listener, JSON.stringify({ id: waiter, waiting: false }));
  }
}

export function allAnswers(run) {
  const files = sessionFiles(run);
  const doc = loadQuestions(files);
  if (!doc.ok) throw new Error(doc.error);
  const s = summarize(doc.value, readEvents(files.answers));
  return {
    questions: s.questions.map((q) => ({
      id: q.id,
      text: q.text,
      answer: q.answer,
      pending: q.pending,
    })),
    closed: Boolean(s.closed),
  };
}

/** Record an answer the user gave in the conversation, so the screen shows it too. */
export function recordChatAnswer(run, questionId, { optionId = null, text = "" } = {}) {
  const files = sessionFiles(run);
  const doc = loadQuestions(files);
  if (!doc.ok) throw new Error(doc.error);
  const q = doc.value.questions.find((x) => x.id === questionId);
  if (!q) throw new Error(`unknown question ${questionId}`);
  const invalid = answerError(q, optionId, text);
  if (invalid) throw new Error(invalid);
  return appendEvent(files.answers, {
    type: "answer",
    channel: "chat",
    questionId,
    optionId,
    text: text.trim(),
  });
}

// ---- CLI ------------------------------------------------------------------------------------
function usage(message) {
  if (message) console.error(message);
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n");
  console.error(
    lines
      .filter((l) => l.startsWith("//   bun "))
      .map((l) => l.slice(5))
      .join("\n"),
  );
  process.exit(2);
}

async function main(argv) {
  const [command, run, ...rest] = argv;
  if (!command || !run) usage();
  const flag = (name, fallback = null) => {
    const i = rest.indexOf(name);
    return i >= 0 ? (rest[i + 1] ?? usage(`${name} requires a value`)) : fallback;
  };
  const files = sessionFiles(run);
  if (!existsSync(files.questions)) usage(`missing ${files.questions}`);
  if (command === "open") {
    // A second server would race the first on the same answers; point at the running one.
    const running = readSession(run);
    const closedLast = readEvents(files.answers).findLast(
      (e) => e.type === "open" || e.type === "close",
    );
    if (
      running?.pid &&
      running.pid !== process.pid &&
      alive(running.pid) &&
      closedLast?.type === "open"
    ) {
      console.log(`${running.alignment ? "ALIGN_SESSION" : "ASK_SESSION"} ${running.url}`);
      console.log("ALREADY_OPEN");
      return;
    }
    const lang = flag("--lang", "ko");
    const { url, stop, alignment } = startServer(run, {
      lang,
      idleMinutes: Number(flag("--idle-minutes", "120")),
      onClose: () => process.exit(0),
    });
    console.log(`${alignment ? "ALIGN_SESSION" : "ASK_SESSION"} ${url}`);
    for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stop("stopped"));
    if (!rest.includes("--no-open")) {
      const opener = openerCommand(url, process.platform, flag("--browser"));
      const result = opener
        ? spawnSync(opener.command, opener.args, { stdio: "ignore" })
        : { status: 1 };
      if (result.status !== 0) console.log(`NOT_OPENED ${url}`);
    }
    return;
  }
  if (command === "wait") {
    console.log(
      JSON.stringify(
        await waitForAnswers(run, { timeoutSeconds: Number(flag("--timeout", "0")) }),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "answers") return console.log(JSON.stringify(allAnswers(run), null, 2));
  if (command === "messages") return console.log(JSON.stringify(discussionMessages(run), null, 2));
  if (command === "request") {
    recordVerification(
      run,
      {
        messageId: rest[0],
        process: flag("--process"),
        criteria: JSON.parse(flag("--criteria", "[]")),
      },
      "chat",
    );
    console.log(`REQUESTED ${rest[0]}`);
    return;
  }
  if (command === "respond") {
    const [requestId, promptId, decision] = rest;
    const file = flag("--text-file");
    recordAlignmentResponse(
      run,
      { requestId, promptId, decision, text: file ? readFileSync(file, "utf8") : "" },
      "chat",
    );
    console.log(`RECORDED ${requestId} ${promptId}`);
    return;
  }
  if (command === "prompt") {
    const file = flag("--file");
    if (!file || !rest[0]) usage("prompt needs a request id and --file");
    const e = publishAlignmentPrompt(run, rest[0], JSON.parse(readFileSync(file, "utf8")));
    console.log(`PUBLISHED ${e.requestId} ${e.promptId}`);
    return;
  }
  if (command === "approved") {
    const doc = loadQuestions(files);
    if (!doc.ok || !doc.value.alignment) usage("Alignment session required");
    console.log(
      JSON.stringify(approvedProposal(readEvents(files.answers), doc.value, rest[0], rest[1])),
    );
    return;
  }
  if (command === "reply") {
    const [messageId] = rest;
    if (!messageId) usage("reply needs a message id");
    const file = flag("--text-file");
    if (file && flag("--text")) usage("choose --text or --text-file");
    const text = file ? readFileSync(file, "utf8") : flag("--text", "");
    recordDiscussionReply(run, messageId, text);
    return console.log(`REPLIED ${messageId}`);
  }
  if (command === "check") {
    const doc = loadQuestions(files);
    if (!doc.ok) usage(doc.error);
    const errors = checkDiagrams(doc.value);
    console.log(JSON.stringify({ diagrams: diagramsOf(doc.value).length, errors }, null, 2));
    process.exit(errors.length ? 1 : 0);
  }
  if (command === "record") {
    const [questionId] = rest;
    if (!questionId) usage("record needs a question id");
    recordChatAnswer(run, questionId, { optionId: flag("--option"), text: flag("--text", "") });
    return console.log(`RECORDED ${questionId}`);
  }
  usage(`unknown command ${command}`);
}

if (import.meta.main) await main(process.argv.slice(2));
