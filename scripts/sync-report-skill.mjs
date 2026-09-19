#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(ROOT, "shared/report-write");
if (process.argv.slice(2).some((arg) => !["--check", "--global"].includes(arg)))
  throw new Error("Usage: sync-report-skill.mjs [--check] [--global]");
const check = process.argv.includes("--check");
const global = process.argv.includes("--global");
const targets = [
  "plugins/adr-writer/skills/report-write",
  "plugins/alps-writer/skills/report-write",
].map((p) => path.join(ROOT, p));
if (global) targets.push(path.join(os.homedir(), ".agents/skills/report-write"));
function files(folder, prefix = "") {
  return readdirSync(path.join(folder, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(folder, name) : [name];
  });
}
const entries = files(source).map((relative) => [
  relative,
  readFileSync(path.join(source, relative)),
]);
// The existing dependency-free Mermaid parser remains the implementation owner.
entries.push([
  "scripts/mermaid.mjs",
  readFileSync(path.join(ROOT, "plugins/adr-writer/scripts/adr-impl-review-diagrams.mjs")),
]);
let mismatch = false;
for (const target of targets)
  for (const [relative, baseContent] of entries) {
    const content =
      relative === "SKILL.md" && target.startsWith(path.join(ROOT, "plugins"))
        ? Buffer.from(
            baseContent
              .toString()
              .replace("\n---\n", '\nargument-hint: "[report-topic-or-source] [format]"\n---\n'),
          )
        : baseContent;
    const dest = path.join(target, relative);
    if (check) {
      if (!existsSync(dest) || !readFileSync(dest).equals(content)) {
        console.error(`Report skill drift: ${dest}`);
        mismatch = true;
      }
    } else {
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, content);
    }
  }
if (mismatch) process.exitCode = 1;
else
  console.log(
    `${check ? "Verified" : "Synchronized"} report-write in ${targets.length} locations.`,
  );
