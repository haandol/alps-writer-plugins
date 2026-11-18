#!/usr/bin/env bun
// Explicit, user-local choices for the first-model conversation.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveProject } from "../skills/report-writer/scripts/reader-profile.mjs";

const choices = {
  setup: ["build", "skip", "later"],
  "adr-review": ["review-first", "build-direct"],
};
const usage =
  "Use show [setup|adr-review], set setup build|skip|later, set adr-review review-first|build-direct, or reset setup|adr-review.";

/**
 * Where this user's choices for the project live: outside the repository, under one key per
 * project. The key is the Git common root, so every linked worktree and both Codex and Claude
 * Code share one choice; another user, or another project, has its own.
 * `ONTOLOGY_WRITER_PREFERENCES_DIR` moves the base for tests and isolated runs.
 */
function directory(cwd) {
  const { root } = resolveProject(realpathSync(cwd));
  const key = createHash("sha256").update(root).digest("hex");
  const base =
    process.env.ONTOLOGY_WRITER_PREFERENCES_DIR ||
    path.join(homedir(), ".agents", "ontology-writer", "preferences");
  return path.join(base, key);
}

function readChoice(dir, key) {
  let value;
  try {
    value = readFileSync(path.join(dir, key), "utf8").trim();
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!choices[key].includes(value))
    throw new Error(`Invalid saved ${key} preference. Use reset ${key} to clear it.`);
  return value;
}

/**
 * The saved first-model setup choice (`build`, `skip` or `later`), or null when none was made.
 * A stored value outside that set throws instead of reading as "no choice", so a damaged
 * preference never re-asks or silently skips the question: callers report it and point to reset.
 */
export function setupPreference(cwd = process.cwd()) {
  return readChoice(directory(cwd), "setup");
}

function run(args) {
  const [command, key, value] = args;
  const dir = directory(process.cwd());
  if (command === "show" && args.length === 1)
    return Object.fromEntries(Object.keys(choices).map((name) => [name, readChoice(dir, name)]));
  if (!Object.hasOwn(choices, key)) throw new Error(usage);
  if (command === "show" && args.length === 2) return { [key]: readChoice(dir, key) };
  const file = path.join(dir, key);
  if (command === "reset" && args.length === 2) {
    rmSync(file, { force: true });
    return { [key]: null };
  }
  if (command !== "set" || args.length !== 3 || !choices[key].includes(value))
    throw new Error(usage);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Separate files let concurrent sessions update different choices independently.
  const temp = path.join(dir, `.${key}-${randomUUID()}`);
  try {
    writeFileSync(temp, value + "\n", { flag: "wx", mode: 0o600 });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
  return { [key]: value };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(run(process.argv.slice(2))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
