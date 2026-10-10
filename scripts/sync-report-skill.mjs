#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(ROOT, "shared/report-writer");
if (process.argv.slice(2).some((arg) => !["--check", "--global"].includes(arg)))
  throw new Error("Usage: sync-report-skill.mjs [--check] [--global]");
const check = process.argv.includes("--check");
const global = process.argv.includes("--global");
const targets = [path.join(ROOT, "plugins/adr-writer/skills/report-writer")];
if (global) targets.push(path.join(os.homedir(), ".agents/skills/report-writer"));
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
    `${check ? "Verified" : "Synchronized"} report-writer in ${targets.length} location${targets.length === 1 ? "" : "s"}.`,
  );
