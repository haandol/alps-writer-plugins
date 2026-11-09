#!/usr/bin/env bun
// Local web question session for an ontology build.
// The agent writes <run>/ask/questions.json; the user answers in the browser;
// answers are appended to <run>/ask/answers.jsonl. The session never saves the
// model, the ADR index or the glossary — final approval stays in the conversation.
//
// Usage:
//   bun ontology-ask.mjs open <run> [--no-open] [--browser NAME] [--lang ko|en] [--idle-minutes N]
//   bun ontology-ask.mjs wait <run> [--timeout SECONDS]
//   bun ontology-ask.mjs answers <run>
//   bun ontology-ask.mjs record <run> <question-id> [--option ID] [--text TEXT]
//   bun ontology-ask.mjs check <run>
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { openerCommand } from "./adr-impl-review-open.mjs";
import { parseMermaidAll, parseMermaid } from "../skills/report-writer/scripts/mermaid.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ID = /^[A-Za-z0-9._-]{1,40}$/;
const MAX_TEXT = 4000;
const MAX_BODY = 32 * 1024;
const MAX_DIAGRAM = 20000;
const VERDICTS = new Set(["stated", "inferred", "conflicting", "unconfirmed"]);
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
  if (!doc || doc.version !== 1 || !Array.isArray(doc.questions))
    return fail("questions.json needs version 1 and a questions array");
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
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
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
function appendEvent(file, event) {
  return withLock(`${file}.lock`, () => {
    const seq = readEvents(file).length + 1;
    const record = { ...event, seq, at: new Date().toISOString() };
    appendFileSync(file, `${JSON.stringify(record)}\n`);
    return record;
  });
}

const LOCK_WAIT_MS = 15_000;
const LOCK_STALE_MS = 10_000;

/** Run `fn` holding a directory lock; a lock left by a writer that died is stale after a while. */
function withLock(lock, fn) {
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
  const file = sessionFiles(run).session;
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
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
  { lang = "ko", idleMinutes = 120, port = 0, onClose = () => {} } = {},
) {
  const files = sessionFiles(run);
  const first = loadQuestions(files);
  if (!first.ok) throw new Error(first.error);
  let good = first.value;
  let goodMtime = statSync(files.questions).mtimeMs;
  let warning = null;
  const current = () => {
    const mtime = statSync(files.questions).mtimeMs;
    if (mtime !== goodMtime) {
      const next = loadQuestions(files);
      if (next.ok) [good, warning] = [next.value, null];
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

  const state = () => {
    const doc = current();
    const events = readEvents(files.answers);
    const s = summarize(doc, events);
    const working = Boolean(s.lastDeliver && Date.parse(s.lastDeliver.at) > goodMtime);
    return {
      title: doc.title ?? "",
      intro: doc.intro ?? "",
      diagram: doc.diagram ?? null,
      agent: doc.agent ?? null,
      lang,
      questions: s.questions,
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
        return new Response(page(lang, prefix), {
          headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
        });
      if (route === "/app.js")
        return asset("ontology-ask-client.js", "text/javascript; charset=utf-8");
      if (route === "/app.css") return asset("ontology-ask.css", "text/css; charset=utf-8");
      if (route === "/mermaid.js") return asset(MERMAID, "text/javascript; charset=utf-8");
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
    if (state().closed) return deny(409, "closed");
    if (route === "/api/answer") {
      const doc = current();
      const q = doc.questions.find((x) => x.id === body.questionId);
      if (!q || q.closed) return deny(400, "unknown or closed question");
      const optionId = body.optionId ?? null;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (optionId && !(q.options ?? []).some((o) => o.id === optionId))
        return deny(400, "unknown option");
      if (text.length > MAX_TEXT) return deny(400, "text too long");
      if (text && q.allowText === false) return deny(400, "text not accepted");
      if (!optionId && !text) return deny(400, "empty answer");
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
    if (route === "/api/deliver") {
      const ids = state()
        .questions.filter((q) => q.pending)
        .map((q) => q.id);
      if (ids.length) appendEvent(files.answers, { type: "deliver", questionIds: ids });
      return json(state());
    }
    if (route === "/api/close") {
      shutdown("user");
      return json({ closed: true });
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
  writeFileSync(
    files.session,
    JSON.stringify(
      { url, port: server.port, pid: process.pid, startedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  const idle = setInterval(() => {
    if (Date.now() - lastSeen > idleMinutes * 60_000) {
      clearInterval(idle);
      shutdown("idle");
    }
  }, 5_000);
  idle.unref?.();
  return {
    url,
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

/** Block until the user delivers answers or the session ends; print them and advance the cursor. */
export async function waitForAnswers(run, { timeoutSeconds = 0, pollMs = 300 } = {}) {
  const files = sessionFiles(run);
  const cursor = existsSync(files.cursor)
    ? (JSON.parse(readFileSync(files.cursor, "utf8")).seq ?? 0)
    : 0;
  const deadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : Infinity;
  for (;;) {
    const events = readEvents(files.answers);
    const fresh = events.filter(
      (e) => e.seq > cursor && (e.type === "deliver" || e.type === "close"),
    );
    const session = existsSync(files.session)
      ? JSON.parse(readFileSync(files.session, "utf8"))
      : null;
    const stopped = !fresh.length && session && !alive(session.pid);
    if (fresh.length || stopped) {
      const ids = new Set(fresh.filter((e) => e.type === "deliver").flatMap((e) => e.questionIds));
      const doc = loadQuestions(files);
      const closed = fresh.find((e) => e.type === "close");
      const result = {
        answers: doc.ok ? answerPayload(doc.value, events, ids) : [],
        closed: Boolean(closed || stopped),
        ...(closed ? { reason: closed.reason } : stopped ? { reason: "server stopped" } : {}),
      };
      writeFileSync(
        files.cursor,
        JSON.stringify({ seq: Math.max(cursor, ...fresh.map((e) => e.seq)) }),
      );
      return result;
    }
    if (Date.now() > deadline) return { answers: [], closed: false, timeout: true };
    await Bun.sleep(pollMs);
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
  if (optionId && !(q.options ?? []).some((o) => o.id === optionId))
    throw new Error(`unknown option ${optionId}`);
  if (!optionId && !text.trim()) throw new Error("an answer needs --option or --text");
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
    mkdirSync(files.dir, { recursive: true });
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
      console.log(`ASK_SESSION ${running.url}`);
      console.log("ALREADY_OPEN");
      return;
    }
    const lang = flag("--lang", "ko");
    const { url, stop } = startServer(run, {
      lang,
      idleMinutes: Number(flag("--idle-minutes", "120")),
      onClose: () => process.exit(0),
    });
    console.log(`ASK_SESSION ${url}`);
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
