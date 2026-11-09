#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--check")) {
  console.error("Usage: sync-authoring-guidance.mjs [--check]");
  process.exit(2);
}
const check = args.includes("--check");
// Guidance owned by adr-writer, copied into each plugin that installs alone and reads it.
const copies = {
  "alps-writer": [
    "requirement-delegation.md",
    "comprehension-load.md",
    "feature-boundaries.md",
    "outcome-evaluation.md",
  ],
  "ontology-writer": ["execution-boundary.md"],
};
let drift = false;
for (const [plugin, name] of Object.entries(copies).flatMap(([p, names]) =>
  names.map((n) => [p, n]),
)) {
  const source = path.join(root, "plugins/adr-writer/references", name);
  const target = path.join(root, "plugins", plugin, "references", name);
  const content = readFileSync(source);
  if (check) {
    if (!existsSync(target) || !readFileSync(target).equals(content)) {
      console.error(`Authoring guidance drift: ${path.relative(root, target)}`);
      drift = true;
    }
  } else {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}
if (drift) process.exitCode = 1;
else console.log(`${check ? "Verified" : "Synchronized"} shared authoring guidance.`);
