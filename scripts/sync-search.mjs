#!/usr/bin/env node
// Each independently installed plugin carries the same local search implementation.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["search-text.mjs", "search-index.mjs"];
const plugins = ["adr-writer", "ontology-writer"];
if (process.argv.slice(2).some((arg) => arg !== "--check"))
  throw new Error("Usage: sync-search.mjs [--check]");
const check = process.argv.includes("--check");
let failed = false;
for (const plugin of plugins) {
  const target = path.join(root, "plugins", plugin, "scripts", "search");
  if (!check) mkdirSync(target, { recursive: true });
  for (const file of files) {
    const source = readFileSync(path.join(root, "shared/search", file));
    const dest = path.join(target, file);
    if (check) {
      if (!existsSync(dest) || !readFileSync(dest).equals(source)) {
        console.error(
          "Shared search drift: " + path.relative(root, dest) + "; run pnpm search:sync",
        );
        failed = true;
      }
    } else writeFileSync(dest, source);
  }
}
if (failed) process.exitCode = 1;
else console.log((check ? "Verified" : "Synchronized") + " local search in both plugins.");
