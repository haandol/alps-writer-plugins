#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** report-writer and its companion reader-profile skill ship side by side in each plugin. */
const SKILLS = {
  "report-writer": '\nargument-hint: "[report-topic-or-source] [format]"\n---\n',
  "reader-profile": '\nargument-hint: "[build|refresh|show|delete]"\n---\n',
};
if (process.argv.slice(2).some((arg) => !["--check", "--global"].includes(arg)))
  throw new Error("Usage: sync-report-skill.mjs [--check] [--global]");
const check = process.argv.includes("--check");
const global = process.argv.includes("--global");
const roots = [
  path.join(ROOT, "plugins/adr-writer/skills"),
  path.join(ROOT, "plugins/ontology-writer/skills"),
];
if (global) roots.push(path.join(os.homedir(), ".agents/skills"));
function files(folder, prefix = "") {
  return readdirSync(path.join(folder, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(folder, name) : [name];
  });
}
let mismatch = false;
for (const [skill, hint] of Object.entries(SKILLS)) {
  const source = path.join(ROOT, "shared", skill);
  const entries = files(source).map((relative) => [
    relative,
    readFileSync(path.join(source, relative)),
  ]);
  for (const root of roots) {
    const target = path.join(root, skill);
    for (const [relative, baseContent] of entries) {
      const content =
        relative === "SKILL.md" && target.startsWith(path.join(ROOT, "plugins"))
          ? Buffer.from(baseContent.toString().replace("\n---\n", hint))
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
  }
}
if (mismatch) process.exitCode = 1;
else
  console.log(
    `${check ? "Verified" : "Synchronized"} report-writer and reader-profile in ${roots.length} location${roots.length === 1 ? "" : "s"}.`,
  );
