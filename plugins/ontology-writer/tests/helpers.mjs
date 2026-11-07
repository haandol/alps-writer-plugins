// Shared helpers for ontology-writer tests. No external deps — Node's built-in
// test runner + child_process only. Each test builds a throwaway fixture repo
// under os.tmpdir() so runs are hermetic and parallel-safe.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(HERE, "..");
export const HOOK = path.join(PLUGIN_ROOT, "hooks", "surface-business-context.mjs");

// Make a fresh temp dir; caller removes it (or use withTmp).
export function mkTmp(prefix = "ontology-test-") {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function withTmp(fn) {
  const dir = mkTmp();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function write(dir, rel, content) {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

/** Match a phrase across line wraps without depending on exact spacing. */
const phrase = (text) =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
/** Assert that `source` holds every phrase. */
export const has = (source, ...texts) => texts.forEach((t) => assert.match(source, phrase(t)));

/**
 * The ADR files an index lists, each stating its recorded Status, as a repository
 * holding that index has them; files that exist are left alone.
 */
export function writeAdrFiles(dir, mapping) {
  for (const entry of Object.values(mapping?.categories ?? {}))
    for (const rec of entry?.adrs ?? [])
      if (typeof rec?.path === "string" && !existsSync(path.join(dir, rec.path)))
        write(
          dir,
          rec.path,
          `# ${path.basename(rec.path, ".md")}\n\n## Status\n\n${rec.status ?? "Proposed"}\n`,
        );
}

export function git(dir, args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

export function initRepo(dir) {
  git(dir, ["init", "-q"]);
  // The fixture's identity, as `git config` writes it, without two more git processes.
  appendFileSync(path.join(dir, ".git", "config"), "[user]\n\temail = t@t.co\n\tname = t\n");
}

const templates = new Map();
let templateRoot = null;
/**
 * Make `dir` the repository `build` makes in an empty folder: built once per test
 * process for each `key` and copied after that, since a fixture's commits cost several
 * git processes and a copy costs none. A folder that already holds something (a link
 * the fixture must write through) is built in place.
 */
export function cachedRepo(dir, key, build) {
  if (existsSync(dir) && readdirSync(dir).length) return build(dir);
  if (!templates.has(key)) {
    if (!templateRoot) {
      templateRoot = mkdtempSync(path.join(tmpdir(), "ontology-fixture-"));
      process.on("exit", () => rmSync(templateRoot, { recursive: true, force: true }));
    }
    const template = mkdtempSync(path.join(templateRoot, "t-"));
    build(template);
    templates.set(key, template);
  }
  cpSync(templates.get(key), dir, { recursive: true });
}

export function commitAll(dir, msg = "init") {
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", msg]);
}

// Run the SessionStart hook against a fixture and return the parsed
// additionalContext string (or the whole JSON when raw=true).
export function runHook(dir, { raw = false, env = {} } = {}) {
  const out = execFileSync(process.execPath, [HOOK], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }),
    encoding: "utf8",
  });
  const parsed = JSON.parse(out);
  if (raw) return parsed;
  return parsed.hookSpecificOutput?.additionalContext ?? "";
}
