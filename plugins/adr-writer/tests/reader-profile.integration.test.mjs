import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
  readFileSync,
  utimesSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../skills/report-writer/scripts/reader-profile.mjs",
);
const git = (cwd, ...args) => {
  const out = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
};
const jsonl = (file, records) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
};

/** One repository with a worktree, its sessions in both clients and an unrelated project. */
function fixture() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "reader-profile-"));
  const repo = path.join(temp, "shop");
  mkdirSync(repo);
  git(repo, "init", "-q");
  git(
    repo,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "init",
  );
  const worktree = path.join(temp, "shop-feature");
  git(repo, "worktree", "add", "-q", "-b", "feature", worktree);
  const other = path.join(temp, "shop-other");
  mkdirSync(other);
  const real = (p) => spawnSync("realpath", [p], { encoding: "utf8" }).stdout.trim() || p;
  const [r, w, o] = [real(repo), real(worktree), real(other)];
  const enc = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
  const claude = path.join(temp, "claude-projects");
  const human = (cwd, at, text) => ({
    type: "user",
    cwd,
    timestamp: at,
    origin: { kind: "human" },
    promptSource: "typed",
    message: { role: "user", content: text },
  });
  jsonl(path.join(claude, enc(r), "a.jsonl"), [
    human(r, "2026-10-01T09:00:00Z", "결제 정산 배치가 뭔지 설명해줘. 메일은 me@corp.example"),
    {
      type: "user",
      cwd: r,
      timestamp: "2026-10-01T09:01:00Z",
      message: { role: "user", content: [{ type: "tool_result", content: "TOOL OUTPUT" }] },
    },
    {
      type: "user",
      cwd: r,
      isMeta: true,
      timestamp: "2026-10-01T09:02:00Z",
      message: { role: "user", content: "<system-reminder>META</system-reminder>" },
    },
    { ...human(r, "2026-10-01T09:03:00Z", "SIDECHAIN PROMPT"), isSidechain: true },
    {
      type: "user",
      cwd: r,
      timestamp: "2026-10-01T09:04:00Z",
      origin: { kind: "task-notification" },
      message: { role: "user", content: "<task-notification>NOTE</task-notification>" },
    },
    {
      type: "assistant",
      cwd: r,
      timestamp: "2026-10-01T09:05:00Z",
      message: { role: "assistant", content: [{ type: "text", text: "ASSISTANT REPLY" }] },
    },
    {
      type: "attachment",
      cwd: r,
      timestamp: "2026-10-01T09:06:00Z",
      attachment: {
        type: "queued_command",
        origin: { kind: "human" },
        prompt: "중간에 추가한 질문: 멱등성 키는?",
      },
    },
    {
      type: "attachment",
      cwd: r,
      timestamp: "2026-10-01T09:07:00Z",
      attachment: {
        type: "queued_command",
        origin: { kind: "task-notification" },
        prompt: "QUEUED NOTE",
      },
    },
  ]);
  jsonl(path.join(claude, enc(w), "b.jsonl"), [
    human(w, "2026-11-05T10:00:00Z", "워크트리에서 한 질문"),
  ]);
  jsonl(path.join(claude, enc(o), "c.jsonl"), [human(o, "2026-11-05T10:00:00Z", "OTHER PROJECT")]);
  const codex = path.join(temp, "codex-sessions");
  const meta = (cwd, source) => ({ type: "session_meta", payload: { cwd, source } });
  jsonl(path.join(codex, "2026/11/06/root.jsonl"), [
    meta(r, "vscode"),
    {
      type: "response_item",
      timestamp: "2026-11-06T08:00:00Z",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "# AGENTS.md instructions for repo\nINJECTED" }],
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-11-06T08:00:01Z",
      payload: {
        type: "item_completed",
        item: {
          type: "UserMessage",
          content: [{ type: "text", text: "Codex에서 물어본 웹훅 질문" }],
        },
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-11-06T08:00:02Z",
      payload: {
        type: "item_completed",
        item: { type: "AgentMessage", content: [{ type: "text", text: "CODEX REPLY" }] },
      },
    },
  ]);
  jsonl(path.join(codex, "2026/11/06/sub.jsonl"), [
    { type: "session_meta", payload: { cwd: r, source: { subagent: { thread_spawn: {} } } } },
    {
      type: "event_msg",
      timestamp: "2026-11-06T08:01:00Z",
      payload: {
        type: "item_completed",
        item: { type: "UserMessage", content: [{ type: "text", text: "SUBAGENT PROMPT" }] },
      },
    },
  ]);
  jsonl(path.join(codex, "2026/11/06/exec.jsonl"), [
    meta(r, "exec"),
    {
      type: "event_msg",
      timestamp: "2026-11-06T08:02:00Z",
      payload: {
        type: "item_completed",
        item: { type: "UserMessage", content: [{ type: "text", text: "AUTOMATION PROMPT" }] },
      },
    },
  ]);
  const env = {
    ...process.env,
    REPORT_WRITER_CLAUDE_PROJECTS: claude,
    REPORT_WRITER_CODEX_SESSIONS: codex,
    REPORT_WRITER_PROFILE_DIR: path.join(temp, "profiles"),
  };
  const run = (args, input) => {
    const out = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: w,
      env,
      input,
      encoding: "utf8",
    });
    return {
      status: out.status,
      json: out.stdout ? JSON.parse(out.stdout) : null,
      stderr: out.stderr,
    };
  };
  return { temp, repo: r, run, env, profiles: env.REPORT_WRITER_PROFILE_DIR };
}

test("extraction keeps only this project's typed messages, redacted and newest first", () => {
  const f = fixture();
  try {
    const { status, json } = f.run(["extract"]);
    assert.equal(status, 0);
    const texts = json.messages.map((m) => m.text);
    assert.deepEqual(texts, [
      "Codex에서 물어본 웹훅 질문",
      "워크트리에서 한 질문",
      "중간에 추가한 질문: 멱등성 키는?",
      "결제 정산 배치가 뭔지 설명해줘. 메일은 [email]",
    ]);
    assert.deepEqual(
      json.messages.map((m) => m.client),
      ["codex", "claude", "claude", "claude"],
    );
    assert.equal(json.messages[0].date, "2026-11-06");
    assert.deepEqual(Object.keys(json.messages[0]).sort(), ["client", "date", "text"]);
    const since = f.run(["extract", "--since", "2026-11-01"]).json;
    assert.deepEqual(
      since.messages.map((m) => m.text),
      texts.slice(0, 2),
    );
    assert.equal(f.run(["extract", "--since", "11/01"]).status, 2);
  } finally {
    rmSync(f.temp, { recursive: true, force: true });
  }
});

test("status, save and delete keep one checked profile outside the repository", () => {
  const f = fixture();
  try {
    let status = f.run(["status"]).json;
    assert.equal(status.action, "ask-to-create");
    assert.equal(status.project, "shop", "a worktree resolves to its main repository");
    assert.ok(status.profilePath.startsWith(f.profiles));
    assert.ok(!status.profilePath.startsWith(f.repo));
    const today = new Date().toISOString().slice(0, 10);
    const profile = (updated, extra = "") =>
      `---\nproject: shop\nupdated: ${updated}\narea-basis: project-area\n---\n\n# Reader profile\n\n## Overall\n\n- level: beginner\n- knows: online shopping as a customer\n- unfamiliar: settlement batches${extra}\n`;
    const rejected = f.run(["save"], profile(today, " (ask ops@shop.example)"));
    assert.equal(rejected.status, 1);
    assert.equal(rejected.json.saved, false);
    assert.equal(f.run(["status"]).json.exists, false, "a failing candidate never reaches disk");
    const saved = f.run(["save"], profile(today));
    assert.equal(saved.json.saved, true);
    assert.equal(statSync(saved.json.profilePath).mode & 0o777, 0o600);
    assert.equal(f.run(["status"]).json.action, "use");
    const old = new Date();
    old.setUTCMonth(old.getUTCMonth() - 4);
    writeFileSync(saved.json.profilePath, profile(old.toISOString().slice(0, 10)));
    assert.equal(f.run(["status"]).json.action, "ask-to-refresh");
    assert.equal(f.run(["delete"]).json.deleted, true);
    assert.equal(f.run(["status"]).json.exists, false);
  } finally {
    rmSync(f.temp, { recursive: true, force: true });
  }
});

test("ADR categories supply the fallback area basis", () => {
  const f = fixture();
  try {
    assert.deepEqual(f.run(["areas"]).json, { basis: "project-area", areas: [] });
    mkdirSync(path.join(f.repo, "docs/adr"), { recursive: true });
    writeFileSync(
      path.join(f.repo, "docs/adr/.mapping.json"),
      JSON.stringify({ categories: { "billing/settlement": { feature: "Settlement", adrs: [] } } }),
    );
    assert.deepEqual(f.run(["areas"]).json, {
      basis: "adr-category",
      areas: [{ key: "billing/settlement", feature: "Settlement" }],
    });
  } finally {
    rmSync(f.temp, { recursive: true, force: true });
  }
});

test("the digest drops operational noise, leads with questions and stays within its budget", () => {
  const f = fixture();
  try {
    const human = (text, at) => ({
      type: "user",
      cwd: f.repo,
      timestamp: at,
      origin: { kind: "human" },
      message: { role: "user", content: text },
    });
    const records = [
      human("커밋하고 푸시해줘.", "2026-11-07T00:00:00Z"),
      human("진행해줘.", "2026-11-07T00:01:00Z"),
      human(
        "This session is being continued from a previous conversation. Summary",
        "2026-11-07T00:02:00Z",
      ),
      human("정산 배치에서 웹훅 재시도는 왜 필요한 거야?", "2026-11-07T00:03:00Z"),
      ...Array.from({ length: 80 }, (_, i) =>
        human(
          `웹훅 재시도 정책과 정산 배치 순서를 정리해 문서 ${i}번 항목으로 남겨줘`,
          `2026-11-07T01:${String(i).padStart(2, "0")}:00Z`,
        ),
      ),
    ];
    writeFileSync(
      path.join(f.temp, "claude-projects", f.repo.replace(/[^A-Za-z0-9]/g, "-"), "noise.jsonl"),
      records.map((r) => JSON.stringify(r)).join("\n") + "\n",
    );
    const out = spawnSync(process.execPath, [SCRIPT, "digest", "--budget", "1500"], {
      cwd: f.repo,
      env: f.env,
      encoding: "utf8",
    });
    assert.equal(out.status, 0, out.stderr);
    const text = out.stdout;
    assert.ok(text.length <= 1500 + 200, `digest is bounded: ${text.length}`);
    assert.doesNotMatch(text, /커밋하고 푸시해줘|진행해줘|This session is being continued/);
    assert.match(text, /## Terms the user writes[^\n]*\n[^\n]*웹훅/);
    const questions = text.indexOf("## Questions");
    assert.ok(text.indexOf("왜 필요한 거야?") > questions);
    assert.ok(text.indexOf("왜 필요한 거야?") < text.indexOf("## Requests"));
    assert.match(text, /near-duplicate/);
    assert.doesNotMatch(text, /me@corp\.example/);
  } finally {
    rmSync(f.temp, { recursive: true, force: true });
  }
});

test("Codex sessions are judged by their first line, including leading blanks and a long header", () => {
  const f = fixture();
  try {
    const codex = path.join(f.temp, "codex-sessions", "2026/11/07");
    const item = (text) => ({
      type: "event_msg",
      timestamp: "2026-11-07T09:00:00Z",
      payload: {
        type: "item_completed",
        item: { type: "UserMessage", content: [{ type: "text", text }] },
      },
    });
    const header = (cwd, extra = {}) =>
      JSON.stringify({ type: "session_meta", payload: { cwd, source: "cli", ...extra } });
    mkdirSync(codex, { recursive: true });
    writeFileSync(
      path.join(codex, "blank-lead.jsonl"),
      `\n  \n${header(f.repo)}\n${JSON.stringify(item("앞에 빈 줄이 있는 세션의 질문"))}\n`,
    );
    writeFileSync(
      path.join(codex, "long-header.jsonl"),
      `${header(f.repo, { base_instructions: "가".repeat(300000) })}\n${JSON.stringify(item("긴 첫 줄 세션의 질문"))}\n`,
    );
    writeFileSync(
      path.join(codex, "other-project.jsonl"),
      `${header("/somewhere/else")}\n${JSON.stringify(item("OTHER PROJECT CODEX"))}\n${"x".repeat(2_000_000)}\n`,
    );
    const texts = f.run(["extract", "--since", "2026-11-07"]).json.messages.map((m) => m.text);
    assert.ok(texts.includes("앞에 빈 줄이 있는 세션의 질문"));
    assert.ok(texts.includes("긴 첫 줄 세션의 질문"));
    assert.ok(!texts.some((t) => t.includes("OTHER PROJECT")));
  } finally {
    rmSync(f.temp, { recursive: true, force: true });
  }
});
