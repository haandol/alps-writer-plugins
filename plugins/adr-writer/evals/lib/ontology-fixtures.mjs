// Fixture helpers for business-context scenarios: the shipped template model, the real
// ontology-writer query CLI and session directive run inside the fixture, so a prompt shows
// exactly what an agent in that repository would see.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { ONTOLOGY_PLUGIN_ROOT } from "./harness.mjs";

export const EXAMPLE_MODEL = readFileSync(
  path.join(ONTOLOGY_PLUGIN_ROOT, "templates", "ontology", "example.ttl"),
  "utf8",
);
const CLI = path.join(ONTOLOGY_PLUGIN_ROOT, "scripts", "ontology.mjs");
const HOOK = path.join(ONTOLOGY_PLUGIN_ROOT, "hooks", "surface-business-context.mjs");

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

/** The text `ontology.mjs query <args>` prints in the fixture; a non-zero exit is part of it. */
export function ontologyQuery(dir, args) {
  const result = run(process.execPath, [CLI, "query", ...args], { cwd: dir });
  return `${result.stdout}${result.stderr}`.trim();
}

/** Commit everything in the fixture, creating its repository on first use. */
export function commitFixture(dir, message = "fixture") {
  const git = (...args) => {
    const result = run("git", args, { cwd: dir });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  };
  git("init", "-q");
  git("add", "-A");
  git(
    "-c",
    "user.name=eval",
    "-c",
    "user.email=eval@example.invalid",
    "commit",
    "-q",
    "-m",
    message,
  );
}

/**
 * The SessionStart directive Ontology Writer gives a new session in the fixture, with an
 * isolated preference store (`choices`: the saved first-model answers, by key).
 */
export function ontologyDirective(dir, { source = "startup", choices = {} } = {}) {
  const preferences = mkdtempSync(path.join(tmpdir(), "ontology-eval-preferences-"));
  const env = { ...process.env, ONTOLOGY_WRITER_PREFERENCES_DIR: preferences };
  try {
    for (const [key, value] of Object.entries(choices)) {
      const helper = path.join(ONTOLOGY_PLUGIN_ROOT, "scripts", "ontology-preferences.mjs");
      const set = run(process.execPath, [helper, "set", key, value], { cwd: dir, env });
      if (set.status !== 0) throw new Error(`preference ${key}: ${set.stderr}`);
    }
    const result = run(process.execPath, [HOOK], {
      cwd: dir,
      input: JSON.stringify({ hook_event_name: "SessionStart", source, cwd: dir }),
      env: { ...env, CLAUDE_PROJECT_DIR: dir },
    });
    if (result.status !== 0) throw new Error(`ontology hook failed: ${result.stderr}`);
    const out = result.stdout.trim();
    return out ? (JSON.parse(out).hookSpecificOutput?.additionalContext ?? "") : "";
  } finally {
    rmSync(preferences, { recursive: true, force: true });
  }
}
