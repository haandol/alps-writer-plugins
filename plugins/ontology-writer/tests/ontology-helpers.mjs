// The example model and the ontology CLI runner the ontology tests share.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PLUGIN_ROOT } from "./helpers.mjs";

export const EXAMPLE = readFileSync(
  path.join(PLUGIN_ROOT, "templates", "ontology", "example.ttl"),
  "utf8",
);
export const CLI = path.join(PLUGIN_ROOT, "scripts", "ontology.mjs");
export const ACCEPTED = EXAMPLE.replaceAll(
  'onto:status "Proposed"',
  'onto:status "Accepted (2020-01-01)"',
);

let cacheDirectory;
function searchCacheForTests() {
  if (!cacheDirectory) {
    cacheDirectory = mkdtempSync(path.join(tmpdir(), "ontology-test-search-cache-"));
    process.once("exit", () => rmSync(cacheDirectory, { recursive: true, force: true }));
  }
  return cacheDirectory;
}

/** Run the CLI in `dir`: its exit code and its output, stderr after stdout. */
export function cli(dir, args, env = process.env) {
  const childEnv = {
    ...env,
    WRITER_SEARCH_CACHE_DIR: env.WRITER_SEARCH_CACHE_DIR ?? searchCacheForTests(),
  };
  try {
    const runtime = childEnv.ONTOLOGY_TEST_RUNTIME ?? "node";
    return {
      code: 0,
      out: execFileSync(runtime, [...(runtime === "bun" ? ["--no-install"] : []), CLI, ...args], {
        cwd: dir,
        encoding: "utf8",
        env: childEnv,
      }),
    };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
/** Run the CLI once and assert its exit code, showing its output otherwise. */
export function exits(dir, args, code) {
  const run = cli(dir, args);
  assert.equal(run.code, code, run.out);
  return run;
}
export const json = (dir, args) => JSON.parse(cli(dir, [...args, "--json"]).out);
