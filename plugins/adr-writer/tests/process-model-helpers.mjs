// The example model and the process-model CLI runner the process-model tests share.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PLUGIN_ROOT } from "./helpers.mjs";

export const EXAMPLE = readFileSync(
  path.join(PLUGIN_ROOT, "templates", "process", "example.ttl"),
  "utf8",
);
export const CLI = path.join(PLUGIN_ROOT, "scripts", "process-model.mjs");
export const ACCEPTED = EXAMPLE.replaceAll(
  'pm:status "Proposed"',
  'pm:status "Accepted (2020-01-01)"',
);

/** Run the CLI in `dir`: its exit code and its output, stderr after stdout. */
export function cli(dir, args, env = process.env) {
  try {
    return {
      code: 0,
      out: execFileSync("node", [CLI, ...args], { cwd: dir, encoding: "utf8", env }),
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
