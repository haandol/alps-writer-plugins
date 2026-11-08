#!/usr/bin/env bun
// Copy the ADR Writer scripts that Ontology Writer also runs: reading and checking
// the ADR index and ADR Status, recording a Status transition, and opening a report.
// A marketplace install ships each plugin alone, so Ontology Writer carries its own
// copy; ADR Writer's file stays the one to edit, and --check reports a stale copy.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "plugins/adr-writer/scripts");
const TARGET = path.join(ROOT, "plugins/ontology-writer/scripts");
const FILES = ["adr-lint-lib.mjs", "adr-status-transition.mjs", "adr-impl-review-open.mjs"];

if (process.argv.slice(2).some((arg) => arg !== "--check"))
  throw new Error("Usage: sync-shared-scripts.mjs [--check]");
const check = process.argv.includes("--check");
let mismatch = false;
for (const name of FILES) {
  const content = readFileSync(path.join(SOURCE, name));
  const dest = path.join(TARGET, name);
  if (check) {
    if (!existsSync(dest) || !readFileSync(dest).equals(content)) {
      console.error(
        `Shared script drift: ${path.relative(ROOT, dest)}; run bun run shared-scripts:sync`,
      );
      mismatch = true;
    }
  } else writeFileSync(dest, content);
}
if (mismatch) process.exitCode = 1;
else
  console.log(
    `${check ? "Verified" : "Synchronized"} ${FILES.length} ADR Writer scripts in Ontology Writer.`,
  );
