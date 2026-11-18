// Schedule an ordinary editor save at a reproducible point in the real disk writes.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { mock } from "bun:test";

const model = path.resolve("docs/ontology/model.ttl");
const mapping = path.resolve("docs/adr/.mapping.json");
const log = path.resolve("docs/ontology/change-log.md");
const marker = "\n# Editor's newer note.\n";
const mode = process.env.TEST_EDIT_AT;
const nativeWrite = fs.writeFileSync;
const nativeRename = fs.renameSync;
let edited = false;
function edit(file) {
  if (edited) return;
  edited = true;
  fs.appendFileSync(file, marker);
}
function write(file, ...args) {
  const result = nativeWrite(file, ...args);
  if (!edited && mode === "stage-realizer" && path.resolve(file).startsWith(mapping + ".tmp-")) {
    edited = true;
    nativeWrite("docs/adr/payments/0002-retry.md", "# ADR 0002: Retry\n\n## Status\n\nProposed\n");
  }
  if (path.resolve(file).startsWith(log + ".tmp-")) {
    if (mode === "move-head") execFileSync("git", ["commit", "--allow-empty", "-qm", "HEAD moved"]);
    if (mode === "move-extra") execFileSync("git", ["branch", "-f", "comparison", "HEAD"]);
    if (mode === "delete-extra") execFileSync("git", ["branch", "-D", "comparison"]);
  }
  if (path.resolve(file).startsWith(model + ".tmp-")) {
    if (mode === "stage-model") edit(model);
    if (mode === "stage-adr") edit("docs/adr/payments/0001-b.md");
  }
  return result;
}
function rename(from, to) {
  if (mode === "rollback" && path.resolve(to) === log) {
    edit(model);
    throw Object.assign(new Error("log write failed"), { code: "EIO" });
  }
  nativeRename(from, to);
  if (mode === "after-index" && path.resolve(to) === mapping) edit(model);
}
mock.module("node:fs", () => ({
  ...fs,
  default: { ...fs, writeFileSync: write, renameSync: rename },
  writeFileSync: write,
  renameSync: rename,
}));
