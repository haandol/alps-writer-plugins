// Copy each canonical file to the plugins that ship it, or with --check report a
// copy that differs. A marketplace install ships each plugin alone, so plugins
// carry copies; the canonical file stays the one to edit.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {Array<{source: string, targets: string[]}>} pairs Repository-relative paths.
 * @param {{script: string, drift: string, fix: string, done: (check: boolean) => string}} labels
 */
export function syncFiles(pairs, { script, drift, fix, done }, args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== "--check")) throw new Error(`Usage: ${script} [--check]`);
  const check = args.includes("--check");
  let mismatch = false;
  for (const { source, targets } of pairs) {
    const content = readFileSync(path.join(ROOT, source));
    for (const target of targets) {
      const dest = path.join(ROOT, target);
      if (!check) {
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, content);
      } else if (!existsSync(dest) || !readFileSync(dest).equals(content)) {
        console.error(`${drift}: ${target}; run ${fix}`);
        mismatch = true;
      }
    }
  }
  if (mismatch) process.exitCode = 1;
  else console.log(done(check));
}
