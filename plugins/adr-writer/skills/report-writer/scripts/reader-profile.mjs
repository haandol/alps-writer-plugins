#!/usr/bin/env bun
/**
 * Reader profile support for report-writer: locate the per-project profile, extract the
 * user's own typed messages from local Claude Code and Codex sessions with personal and
 * business identifiers removed, and check a profile before it is saved.
 *
 * Extracted messages go to stdout and are never persisted. `save` writes the profile only
 * when `check` passes, so a failing candidate never reaches disk.
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** A profile older than this many calendar months prompts a refresh question. */
export const STALE_AFTER_MONTHS = 3;
export const LEVELS = ["beginner", "intermediate", "expert"];
export const AREA_BASES = ["bounded-context", "adr-category", "project-area"];
/** Only interactive Codex sessions carry text a person typed; exec, MCP and subagents do not. */
const CODEX_INTERACTIVE_SOURCES = new Set(["cli", "vscode", "app", "desktop"]);

const home = () => process.env.HOME || os.homedir();
const profileDir = () =>
  process.env.REPORT_WRITER_PROFILE_DIR ||
  path.join(home(), ".agents", "report-writer", "reader-profiles");
const claudeDir = () =>
  process.env.REPORT_WRITER_CLAUDE_PROJECTS ||
  path.join(process.env.CLAUDE_CONFIG_DIR || path.join(home(), ".claude"), "projects");
const codexDir = () =>
  process.env.REPORT_WRITER_CODEX_SESSIONS ||
  path.join(process.env.CODEX_HOME || path.join(home(), ".codex"), "sessions");

function git(cwd, args) {
  const out = spawnSync("git", args, { cwd, encoding: "utf8" });
  return out.status === 0 ? out.stdout.trim() : null;
}

/** The project is the main repository and every worktree that shares its history. */
export function resolveProject(cwd = process.cwd()) {
  const start = path.resolve(cwd);
  const common = git(start, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const root = common ? (path.basename(common) === ".git" ? path.dirname(common) : common) : start;
  const listed = git(root, ["worktree", "list", "--porcelain"]);
  const paths = new Set([root]);
  for (const line of (listed ?? "").split("\n"))
    if (line.startsWith("worktree ")) paths.add(line.slice("worktree ".length));
  const name = path.basename(root);
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project";
  const key = createHash("sha256").update(root).digest("hex").slice(0, 8);
  return {
    root,
    name,
    paths: [...paths],
    profilePath: path.join(profileDir(), `${slug}-${key}.md`),
  };
}

const inProject = (cwd, project) =>
  typeof cwd === "string" &&
  project.paths.some((p) => cwd === p || cwd.startsWith(p.endsWith(path.sep) ? p : p + path.sep));

function parseDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? "")) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date;
}
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next;
}

/** Frontmatter is a flat `key: value` block; the body is Markdown sections. */
export function parseProfile(text) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, "\n"));
  if (!match) return { meta: null, body: text };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const kv = /^([a-z-]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: match[2] };
}

export function status(cwd) {
  const project = resolveProject(cwd);
  const result = {
    project: project.name,
    profilePath: project.profilePath,
    exists: existsSync(project.profilePath),
    updated: null,
    stale: true,
    staleAfterMonths: STALE_AFTER_MONTHS,
    areaBasis: null,
  };
  if (!result.exists) return { ...result, action: "ask-to-create" };
  const { meta } = parseProfile(readFileSync(project.profilePath, "utf8"));
  const updated = parseDate(meta?.updated);
  result.updated = updated ? meta.updated : null;
  result.areaBasis = meta?.["area-basis"] ?? null;
  result.stale = !updated || addMonths(updated, STALE_AFTER_MONTHS) < today();
  return { ...result, action: result.stale ? "ask-to-refresh" : "use" };
}

/** Ordered replacements: each removes one kind of personal, secret or business identifier. */
const REDACTIONS = [
  [/```[\s\S]*?(?:```|$)/g, "[code]"],
  [/`[^`\n]{1,200}`/g, "[code]"],
  [/<[a-z][\w-]*(?:\s[^>]*)?>[\s\S]*?<\/[a-z][\w-]*>/gi, " "],
  [/\b[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+/g, "[url]"],
  [/\bwww\.\S+/gi, "[url]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  [/(?:~|\.{1,2})?(?:\/[\w.@-]+){2,}\/?/g, "[path]"],
  [/\b[A-Za-z]:\\[^\s]+/g, "[path]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "[ip]"],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[secret]"],
  [/\b(?:sk|pk|rk|ghp|gho|ghs|xox[abprs]|glpat|AIza)[-_]?[A-Za-z0-9_-]{10,}\b/g, "[secret]"],
  [/\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+){0,2}/g, "[secret]"],
  [/\b[0-9a-f]{24,}\b/gi, "[secret]"],
  [/[A-Za-z0-9+/_=-]{32,}/g, "[secret]"],
  [/\b\d{6}-[1-4]\d{6}\b/g, "[id]"],
  [/(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]\d{3,4}[\s-]\d{4}\b/g, "[phone]"],
  [/(^|[^\w])@[A-Za-z0-9_][A-Za-z0-9_.-]*/g, "$1[handle]"],
  [/\b[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+){3,}\b/g, "[identifier]"],
  [/\b(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z0-9]{16,}\b/g, "[identifier]"],
];
export function redact(text) {
  let out = String(text);
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text the client writes into a human turn: continuation summaries and interruption markers. */
const CLAUDE_GENERATED =
  /^\s*(?:This session is being continued from a previous conversation|\[Request interrupted by user[^\]]*\]\s*$)/;
/** Claude Code: typed prompts and mid-turn queued prompts the harness marks as human. */
function claudeMessages(project, since) {
  const base = claudeDir();
  if (!existsSync(base)) return [];
  const encoded = project.paths.map((p) => p.replace(/[^A-Za-z0-9]/g, "-"));
  const found = [];
  for (const dir of readdirSync(base)) {
    if (!encoded.some((prefix) => dir.startsWith(prefix))) continue;
    const folder = path.join(base, dir);
    if (!statSync(folder).isDirectory()) continue;
    for (const file of readdirSync(folder)) {
      if (!file.endsWith(".jsonl")) continue;
      const full = path.join(folder, file);
      if (since && statSync(full).mtime < since) continue;
      for (const line of readFileSync(full, "utf8").split("\n")) {
        if (!line.trim()) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }
        if (record.isSidechain || record.isMeta || !inProject(record.cwd, project)) continue;
        let text = null;
        if (record.type === "user" && record.message?.role === "user") {
          const legacy = record.origin === undefined && record.promptSource === undefined;
          if (record.origin?.kind !== "human" && !legacy) continue;
          const content = record.message.content;
          if (typeof content === "string") text = content;
          else if (
            Array.isArray(content) &&
            content.every((b) => b?.type === "text" || b?.type === "image")
          )
            text = content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n");
          if (legacy && text && /^\s*</.test(text)) {
            const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text);
            text = args ? args[1] : null;
          }
        } else if (
          record.type === "attachment" &&
          record.attachment?.type === "queued_command" &&
          record.attachment.origin?.kind === "human"
        )
          text = record.attachment.prompt;
        if (typeof text === "string" && CLAUDE_GENERATED.test(text)) continue;
        if (typeof text === "string" && text.trim())
          found.push({
            client: "claude",
            at: record.timestamp ?? record.attachment?.timestamp,
            text,
          });
      }
    }
  }
  return found;
}

const CODEX_INJECTED =
  /^\s*(?:#\s*AGENTS\.md instructions|<(?:environment_context|user_instructions|turn_aborted|subagent_notification|user_shell_command|skill|INSTRUCTIONS)\b)/;
/**
 * Read a file only up to its first non-blank line, in chunks, so a session from another project
 * is judged by its header without loading the whole transcript. Returns null for an empty file.
 */
export function firstLine(file, chunkSize = 64 * 1024) {
  const fd = openSync(file, "r");
  try {
    const chunks = [];
    const buffer = Buffer.alloc(chunkSize);
    for (;;) {
      const read = readSync(fd, buffer, 0, chunkSize, null);
      if (read === 0) break;
      const chunk = buffer.subarray(0, read);
      let start = 0;
      for (let at = chunk.indexOf(10); at !== -1; at = chunk.indexOf(10, start)) {
        chunks.push(chunk.subarray(start, at));
        const line = Buffer.concat(chunks).toString("utf8");
        if (line.trim()) return line;
        chunks.length = 0;
        start = at + 1;
      }
      chunks.push(Buffer.from(chunk.subarray(start)));
    }
    const rest = Buffer.concat(chunks).toString("utf8");
    return rest.trim() ? rest : null;
  } finally {
    closeSync(fd);
  }
}

/** Codex: interactive root sessions only; prefer the typed UserMessage item over raw turns. */
function codexMessages(project, since) {
  const base = codexDir();
  if (!existsSync(base)) return [];
  const files = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".jsonl") && !(since && statSync(full).mtime < since))
        files.push(full);
    }
  })(base);
  const found = [];
  for (const file of files) {
    let meta;
    try {
      meta = JSON.parse(firstLine(file) ?? "null");
    } catch {
      continue;
    }
    const session = meta?.type === "session_meta" ? meta.payload : null;
    if (
      !session ||
      !CODEX_INTERACTIVE_SOURCES.has(session.source) ||
      !inProject(session.cwd, project)
    )
      continue;
    // Only this project's interactive sessions are read in full.
    const lines = readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.trim());
    const typed = [],
      raw = [];
    for (const line of lines) {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      const p = record.payload ?? {};
      const textOf = (content) =>
        (Array.isArray(content) ? content : [])
          .map((b) => (b?.type === "text" || b?.type === "input_text" ? b.text : ""))
          .join("\n");
      if (
        record.type === "event_msg" &&
        p.type === "item_completed" &&
        p.item?.type === "UserMessage"
      )
        typed.push({ client: "codex", at: record.timestamp, text: textOf(p.item.content) });
      else if (
        record.type === "event_msg" &&
        p.type === "user_message" &&
        typeof p.message === "string"
      )
        typed.push({ client: "codex", at: record.timestamp, text: p.message });
      else if (record.type === "response_item" && p.type === "message" && p.role === "user") {
        const text = textOf(p.content);
        if (!CODEX_INJECTED.test(text)) raw.push({ client: "codex", at: record.timestamp, text });
      }
    }
    found.push(...(typed.length ? typed : raw).filter((m) => m.text.trim()));
  }
  return found;
}

/**
 * Collect, redact, deduplicate and bound the user's own messages, newest first.
 * The result carries only a day-level date and the client name besides the redacted text.
 */
export function extract(cwd, { since, maxMessages = 400, maxChars = 500, maxTotal = 60000 } = {}) {
  const project = resolveProject(cwd);
  const sinceDate = since ? parseDate(since) : null;
  if (since && !sinceDate) throw new Error("--since must be a YYYY-MM-DD date");
  const all = [...claudeMessages(project, sinceDate), ...codexMessages(project, sinceDate)];
  const seen = new Set();
  const messages = [];
  let total = 0;
  const sorted = all
    .map((m) => ({ ...m, date: typeof m.at === "string" ? m.at.slice(0, 10) : null }))
    .filter((m) => !sinceDate || (m.date && parseDate(m.date) >= sinceDate))
    .sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  let omitted = 0;
  for (const message of sorted) {
    let text = redact(message.text);
    if (!text || /^\[(?:code|url|path|secret|identifier)\]$/.test(text)) continue;
    const norm = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (text.length > maxChars) text = text.slice(0, maxChars) + " …";
    if (messages.length >= maxMessages || total + text.length > maxTotal) {
      omitted++;
      continue;
    }
    total += text.length;
    messages.push({ date: message.date, client: message.client, text });
  }
  return {
    project: project.name,
    since: sinceDate ? since : null,
    through: messages[0]?.date ?? null,
    count: messages.length,
    omitted,
    messages,
  };
}

/** Short operational commands ("proceed", "commit", "release") say nothing about understanding. */
const OPERATIONAL =
  /^(?:(?:이어서|계속|순서대로|바로|다시|그냥|그럼|좋아|오케이|ok|okay|yes|네|응|ㅇㅇ|continue|go on|proceed|lgtm)[\s,.!]*)*(?:진행|커밋|푸시|머지|병합|릴리즈|배포|업데이트|정리|삭제|지워|열어|닫아|재시도|실행|해줘|해|하자|ㄱㄱ|continue|proceed|commit|push|merge|release|deploy|retry|run|go)[^?？]{0,14}$/i;
const QUESTION =
  /[?？]\s*$|[?？]\s|왜|뭐(?:지|야|가|예요|죠|임)|무엇|무슨|뭔지|어떻게\s?(?:되|하|동작|작동|쓰|써)|어떤\s?(?:차이|의미|뜻)|차이가|인가요?\b|일까|할까요?\b|되나요?\b|되는지|맞나|맞는지|맞아\?|뜻이|의미가|설명해|알려줘|모르겠|헷갈|궁금|\b(?:why|what|how|which|explain|meaning|difference)\b/i;
const STOP = new Set(
  "the and for with this that from into your you are was not but can will all any have has had use using make about then than when what which also just only very more most some such each other them they their there here been being does done like want need should would could into over under after before code file files test tests ok yes".split(
    " ",
  ),
);
const KO_STOP = new Set(
  "해줘 해주세요 있어 있는 없어 없는 같아 같은 지금 이거 그거 저거 이건 그건 이번 여기 거기 그리고 근데 그래서 하는 하고 해서 했는데 하면 되는 된다 된 것 수 좀 더 다 잘 안 못 왜 뭐 어떻게 이렇게 그렇게 정도 부분 경우 때문 현재 기존 다시 계속 진행 내용 해당 대한 너무 그냥 실제 필요 원래 전체 방식 형태 사용 추가 수정 확인 작성 생성 처리 관련 문제 결과 상태 기준 이후 이전 하나 모든 각각 정말 아직 이미 계속 우선 일단 혹시 다른 같이 위해 통해 대해 보면 나서".split(
    " ",
  ),
);
/** Hangul tokens ending like verbs, adjectives or connectives are not terms. */
const KO_NOT_TERM =
  /(?:줘|요|다|지|야|데|게|고|면|서|니|나|까|어|아|해|해서|했|함|음|임|거|도록|는지|는데|던|든|며|자|네|군|ㄴ|겠|았|었|할|한|된|될|하는|있는|없는|같은|좋을|싶)$/;
const KO_PARTICLE =
  /(?:에서는|으로는|에서|으로|에게|까지|부터|처럼|보다|하고|이랑|랑|은|는|이|가|을|를|의|에|로|와|과|도|만|요)$/;
/** Count the terms the user writes unprompted: a cheap signal for what they already know. */
function terms(texts, limit = 40) {
  const counts = new Map();
  for (const text of texts) {
    const seen = new Set();
    for (const raw of text
      .replace(/\[[a-z]+\]/g, " ")
      .match(/[A-Za-z][A-Za-z0-9.+#-]*[A-Za-z0-9+#]|[가-힣]{2,}/g) ?? []) {
      let term = /[가-힣]/.test(raw) ? raw.replace(KO_PARTICLE, "") : raw;
      if (term.length < 2) continue;
      const key = /[A-Z]{2,}/.test(term) ? term : term.toLowerCase();
      if (STOP.has(key.toLowerCase()) || KO_STOP.has(key) || seen.has(key)) continue;
      if (/[가-힣]/.test(key) && (KO_NOT_TERM.test(key) || KO_NOT_TERM.test(raw))) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

/**
 * A compact, model-ready digest: term counts, every question (the strongest signal of what is
 * unfamiliar) and a bounded sample of directions, as plain lines within a character budget.
 */
export function digest(cwd, { since, budget = 6000, lineChars = 160, directions = 40 } = {}) {
  const all = extract(cwd, { since, maxMessages: 2000, maxChars: 2000, maxTotal: Infinity });
  const kept = [];
  const prefixes = new Set();
  let operational = 0,
    duplicates = 0;
  for (const message of all.messages) {
    const text = message.text.replace(/\s+/g, " ").trim();
    if ((OPERATIONAL.test(text) || text.length <= 15) && !QUESTION.test(text)) {
      operational++;
      continue;
    }
    const prefix = text.slice(0, 40).toLowerCase();
    if (prefixes.has(prefix)) {
      duplicates++;
      continue;
    }
    prefixes.add(prefix);
    kept.push({ ...message, text, question: QUESTION.test(text) });
  }
  const line = (m) =>
    `- ${m.date ? m.date.slice(5) : "--"} ${m.text.length > lineChars ? m.text.slice(0, lineChars) + "…" : m.text}`;
  const questions = kept.filter((m) => m.question).map(line);
  const directed = kept
    .filter((m) => !m.question)
    .slice(0, directions)
    .map(line);
  const dates = all.messages
    .map((m) => m.date)
    .filter(Boolean)
    .sort();
  const header = [
    `# Reader-profile digest: ${all.project}`,
    `messages ${all.count} (${dates[0] ?? "?"} to ${dates.at(-1) ?? "?"}); dropped ${operational} operational, ${duplicates} near-duplicate`,
    "",
    "## Terms the user writes (documents containing the term)",
    terms(kept.map((m) => m.text))
      .map(([t, n]) => `${t} ${n}`)
      .join(", ") || "(none)",
    "",
  ];
  const out = [...header];
  let used = out.join("\n").length;
  let shownQuestions = 0,
    shownDirections = 0;
  /** Add lines in order until the next one would pass `limit`; the rest of the section is cut. */
  const push = (lines, limit, onAdd) => {
    for (const l of lines) {
      if (used + l.length + 1 > limit) return;
      out.push(l);
      used += l.length + 1;
      onAdd();
    }
  };
  // Questions show what is unfamiliar; directions show the vocabulary the user already commands.
  const questionBudget = used + Math.floor((budget - used) * 0.6);
  out.push("## Questions and explanation requests (newest first)");
  push(questions, questionBudget, () => shownQuestions++);
  out.push("", "## Requests and directions (newest first)");
  push(directed, budget, () => shownDirections++);
  out.push(
    "",
    `shown: ${shownQuestions}/${questions.length} questions, ${shownDirections}/${kept.length - questions.length} directions`,
  );
  return out.join("\n") + "\n";
}

/** Patterns a saved profile must never contain, checked after the agent writes it. */
const FORBIDDEN = [
  ["email address", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/],
  ["URL", /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+|\bwww\.\S+/i],
  ["file path", /(?:~|\.{1,2})?(?:\/[\w.@-]+){2,}|\b[A-Za-z]:\\/],
  ["IP address", /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  [
    "credential or token",
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:sk|ghp|gho|xox[abprs]|glpat)[-_][A-Za-z0-9_-]{10,}|\b[0-9a-f]{24,}\b|[A-Za-z0-9+/_=-]{32,}/i,
  ],
  [
    "phone or national ID",
    /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]\d{3,4}[\s-]\d{4}\b|\b\d{6}-[1-4]\d{6}\b/,
  ],
  ["handle or mention", /(^|[^\w])@[A-Za-z0-9_]/],
  [
    "redaction marker copied from extracted input",
    /\[(?:code|url|email|path|ip|secret|id|phone|handle|identifier)\]/,
  ],
  [
    "business figure (money or percentage)",
    /[$€£¥₩]\s?\d|\d[\d,.]*\s?(?:%|만원|원|억|달러|USD|KRW|EUR)(?![A-Za-z])/,
  ],
  ["verbatim quotation", /["“”「」『』][^"“”「」『』\n]{20,}["“”「」『』]/],
];
const MAX_LINE = 240;
const MAX_TOTAL = 8000;
const MAX_SECTIONS = 30;

/** Deterministic shape and privacy check; it cannot detect names, so authoring rules still apply. */
export function checkProfile(text) {
  const findings = [];
  const { meta, body } = parseProfile(text);
  if (!meta) findings.push("missing frontmatter (--- project/updated/area-basis ---)");
  else {
    if (!meta.project) findings.push("frontmatter: project is required");
    const updated = parseDate(meta.updated);
    if (!updated) findings.push("frontmatter: updated must be YYYY-MM-DD");
    else if (updated > today()) findings.push("frontmatter: updated is in the future");
    if (!AREA_BASES.includes(meta["area-basis"]))
      findings.push(`frontmatter: area-basis must be one of ${AREA_BASES.join(", ")}`);
    const extra = Object.keys(meta).filter(
      (k) => !["project", "updated", "area-basis"].includes(k),
    );
    if (extra.length) findings.push(`frontmatter: unexpected keys ${extra.join(", ")}`);
  }
  if (text.length > MAX_TOTAL)
    findings.push(`profile exceeds ${MAX_TOTAL} characters; keep it concise`);
  const sections = [...body.matchAll(/^## (.+)$/gm)];
  if (!sections.length) findings.push("no sections: add an Overall section and one per area");
  if (sections.length > MAX_SECTIONS) findings.push(`more than ${MAX_SECTIONS} sections`);
  const basis = meta?.["area-basis"];
  if (sections.length && !sections.some((s) => /^Overall\s*$/.test(s[1])))
    findings.push('missing "## Overall" section');
  sections.forEach((section, i) => {
    const heading = section[1].trim();
    if (
      heading !== "Overall" &&
      basis !== "project-area" &&
      !/^[a-z0-9][a-z0-9/_.-]*(?: — \S.*)?$/.test(heading)
    )
      findings.push(
        `## ${heading}: head ${basis} areas with their identifier, optionally " — <display name>"`,
      );
    const end = i + 1 < sections.length ? sections[i + 1].index : body.length;
    const block = body.slice(section.index, end);
    const level = /^- level:\s*(\S+)\s*$/m.exec(block);
    if (!level) findings.push(`## ${section[1]}: missing "- level:" line`);
    else if (!LEVELS.includes(level[1]))
      findings.push(`## ${section[1]}: level must be one of ${LEVELS.join(", ")}`);
    for (const line of block.split("\n").slice(1)) {
      if (!line.trim()) continue;
      if (!/^- (?:level|knows|unfamiliar):\s/.test(line))
        findings.push(
          `## ${section[1]}: only "- level:", "- knows:" and "- unfamiliar:" lines are allowed`,
        );
      if (line.length > MAX_LINE)
        findings.push(`## ${section[1]}: a line exceeds ${MAX_LINE} characters`);
    }
  });
  for (const [label, pattern] of FORBIDDEN)
    if (pattern.test(text)) findings.push(`contains ${label}`);
  return [...new Set(findings)];
}

/** Write a checked profile outside the repository; refuse on any finding. */
export function saveProfile(cwd, text) {
  const project = resolveProject(cwd);
  const findings = checkProfile(text);
  if (findings.length) return { saved: false, profilePath: project.profilePath, findings };
  mkdirSync(path.dirname(project.profilePath), { recursive: true, mode: 0o700 });
  writeFileSync(project.profilePath, text.endsWith("\n") ? text : text + "\n", { mode: 0o600 });
  return { saved: true, profilePath: project.profilePath, findings: [] };
}

export function deleteProfile(cwd) {
  const project = resolveProject(cwd);
  const existed = existsSync(project.profilePath);
  rmSync(project.profilePath, { force: true });
  return { deleted: existed, profilePath: project.profilePath };
}

/** ADR categories are the fallback area basis when no bounded-context list is available. */
export function adrAreas(cwd) {
  const project = resolveProject(cwd);
  const mapping = path.join(project.root, "docs", "adr", ".mapping.json");
  if (!existsSync(mapping)) return { basis: "project-area", areas: [] };
  const categories = JSON.parse(readFileSync(mapping, "utf8")).categories ?? {};
  return {
    basis: "adr-category",
    areas: Object.entries(categories).map(([key, value]) => ({
      key,
      feature: value.feature ?? null,
    })),
  };
}

const USAGE = `Usage:
  bun reader-profile.mjs status [--cwd DIR]
  bun reader-profile.mjs extract [--cwd DIR] [--since YYYY-MM-DD] [--max-messages N]
  bun reader-profile.mjs digest [--cwd DIR] [--since YYYY-MM-DD] [--budget CHARS]
  bun reader-profile.mjs areas [--cwd DIR]
  bun reader-profile.mjs check <profile.md>
  bun reader-profile.mjs save [--cwd DIR] < profile.md
  bun reader-profile.mjs delete [--cwd DIR]`;

function main(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) opts[rest[i].slice(2)] = rest[++i];
    else positional.push(rest[i]);
  }
  const cwd = opts.cwd ?? process.cwd();
  if (command === "status") return console.log(JSON.stringify(status(cwd), null, 2));
  if (command === "digest") {
    const budget = opts.budget ? Number(opts.budget) : undefined;
    if (budget !== undefined && !(budget >= 1000))
      throw new Error("--budget must be at least 1000");
    return process.stdout.write(digest(cwd, { since: opts.since, budget }));
  }
  if (command === "areas") return console.log(JSON.stringify(adrAreas(cwd), null, 2));
  if (command === "extract") {
    const maxMessages = opts["max-messages"] ? Number(opts["max-messages"]) : undefined;
    if (maxMessages !== undefined && !(maxMessages > 0))
      throw new Error("--max-messages must be positive");
    return console.log(JSON.stringify(extract(cwd, { since: opts.since, maxMessages }), null, 2));
  }
  if (command === "save") {
    const result = saveProfile(cwd, readFileSync(0, "utf8"));
    console.log(JSON.stringify(result, null, 2));
    if (!result.saved) process.exitCode = 1;
    return;
  }
  if (command === "delete") return console.log(JSON.stringify(deleteProfile(cwd), null, 2));
  if (command === "check") {
    if (!positional[0]) throw new Error(USAGE);
    const findings = checkProfile(readFileSync(positional[0], "utf8"));
    console.log(JSON.stringify({ ok: !findings.length, findings }, null, 2));
    if (findings.length) process.exitCode = 1;
    return;
  }
  throw new Error(USAGE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
