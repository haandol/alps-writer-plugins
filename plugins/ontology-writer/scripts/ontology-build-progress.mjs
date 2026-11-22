#!/usr/bin/env bun
// A build keeps one disposable handoff in its own review directory.
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { withLock } from "./directory-lock.mjs";
import { findModelDocuments } from "./model-documents.mjs";
import { isForeignReviewFile } from "./review-workspace.mjs";

const filename = "build-progress.json";
const stages = ["sources", "event-map", "boundaries", "workflow"];
const present = (value) => typeof value === "string" && value.trim().length > 0;
const strings = (value) => Array.isArray(value) && value.every(present);
const stat = (file) => lstatSync(file, { throwIfNoEntry: false });
const hash = (value) => createHash("sha256").update(value).digest("hex");

function projectRoot() {
  try {
    return realpathSync(
      execFileSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    return realpathSync(process.cwd());
  }
}

// Temp fallback runs are discoverable without a pointer or a cross-project index.
function runKind(root) {
  return `ontology-build-${hash(root).slice(0, 16)}`;
}

function verifyRun(root, dir) {
  const parent = path.dirname(dir);
  if (stat(dir)?.isDirectory()) {
    if (parent === path.join(root, ".adr-review") && stat(parent)?.isDirectory()) return dir;
    const name = path.basename(dir);
    if (name.startsWith(runKind(root) + "-")) {
      const temp = realpathSync(tmpdir());
      if (realpathSync(parent) === temp) return path.join(temp, name);
    }
  }
  throw new Error("Expected a build run in this project's local review space");
}

function validateUnit(input) {
  if (
    !stages.includes(input?.stage) ||
    !present(input.unit) ||
    !present(input.finding) ||
    !strings(input.open) ||
    !strings(input.references)
  )
    throw new Error("Expected stage, unit, finding, open questions and reference locations");
}

function readProgress(dir) {
  const file = path.join(dir, filename);
  const entry = stat(file);
  if (!entry) return null;
  if (!entry.isFile()) throw new Error("Expected a regular build progress file");
  const doc = JSON.parse(readFileSync(file, "utf8"));
  if (doc.task !== undefined && doc.task !== hash(dir)) return null;
  if (
    doc.version !== 1 ||
    typeof doc.complete !== "boolean" ||
    !present(doc.scope) ||
    !present(doc.next) ||
    !Array.isArray(doc.units) ||
    !doc.units.length
  )
    throw new Error("Invalid build progress");
  for (const unit of doc.units) {
    validateUnit(unit);
    if (
      !present(unit.scope) ||
      !present(unit.modelInventory) ||
      !Array.isArray(unit.stamps) ||
      unit.stamps.length !== unit.references.length ||
      !unit.stamps.every((value) => value === null || typeof value === "string")
    )
      throw new Error("Invalid reference stamps");
  }
  return doc;
}

// Both the original and current writer put the scope before the work units.
// Discovery needs only this header; the selected task is validated in full.
async function readScope(dir) {
  const file = path.join(dir, filename);
  const entry = stat(file);
  if (!entry) return null;
  if (!entry.isFile()) throw new Error("Expected a regular build progress file");
  const stream = createReadStream(file, { encoding: "utf8", highWaterMark: 256 });
  let prefix = "";
  try {
    for await (const chunk of stream) {
      prefix += chunk;
      const end = prefix.search(/,\s*"units"\s*:\s*\[/);
      if (end < 0) continue;
      const header = JSON.parse(prefix.slice(0, end) + "}");
      if (header.task !== undefined && header.task !== hash(dir)) return null;
      if (header.version === 1 && typeof header.complete === "boolean" && present(header.scope))
        return { scope: header.scope, complete: header.complete };
      break;
    }
    throw new Error("Invalid build progress header");
  } finally {
    stream.destroy();
  }
}

// A new or removed model document can change the scope even for a batch
// completed before the first model existed. Contents are checked per reference.
function modelInventory(root) {
  const dir = path.join(root, "docs/ontology");
  const files = findModelDocuments(dir, (_path, error) => {
    throw error;
  });
  return hash(JSON.stringify(files.map((file) => path.relative(dir, file))));
}

// Keep each cited location in the handoff, but read a project file only once
// per command even when several sections or symlinks point to it.
async function stamp(root, run, location, stampsByFile) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(location)) return null;
  const file = path.resolve(root, location.split("#", 1)[0]);
  if (isForeignReviewFile(root, run, file)) return "foreign-run";
  if (!file.startsWith(root + path.sep)) return null;
  if (stampsByFile.has(file)) return stampsByFile.get(file);
  let value = null;
  try {
    const real = realpathSync(file);
    if (isForeignReviewFile(root, run, real)) return "foreign-run";
    if (stampsByFile.has(real)) value = stampsByFile.get(real);
    else if (real.startsWith(root + path.sep) && stat(real)?.isFile()) {
      const digest = createHash("sha256");
      for await (const chunk of createReadStream(real)) digest.update(chunk);
      value = digest.digest("hex");
      stampsByFile.set(real, value);
    }
  } catch (error) {
    if (error.code === "ENOENT") value = "missing";
  }
  stampsByFile.set(file, value);
  return value;
}

// Publish the whole small snapshot with one rename. An interrupted temporary
// file is never used for discovery or for the next update.
function update(dir, change) {
  return withLock(path.join(dir, ".build-progress.lock"), () => {
    const next = change(readProgress(dir));
    const file = path.join(dir, filename);
    const tmp = path.join(dir, `.build-progress-${randomUUID()}.tmp`);
    try {
      writeFileSync(tmp, JSON.stringify({ task: hash(dir), ...next }, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      renameSync(tmp, file);
    } finally {
      rmSync(tmp, { force: true });
    }
    return { run: dir, scope: next.scope, complete: next.complete };
  });
}

async function save(root, run, input) {
  validateUnit(input);
  if (!present(input.scope) || !present(input.next))
    throw new Error("Expected scope and next action");
  const { scope, stage, unit, finding, open, references, next } = input;
  const existing = run ? verifyRun(root, path.resolve(run)) : null;
  const stamps = [];
  const stampsByFile = new Map();
  for (const ref of references) {
    const value = await stamp(root, existing, ref, stampsByFile);
    if (value === "foreign-run")
      throw new Error(
        "Another task's working file is outside this build; cite the original source",
      );
    stamps.push(value);
  }
  const inventory = modelInventory(root);
  const allocated = existing
    ? { dir: existing }
    : (await import("./ontology-fs.mjs")).allocateRunDirectory(root, runKind(root));
  const dir = verifyRun(root, path.resolve(allocated.dir));
  const result = update(dir, (doc) => {
    if (doc?.complete) throw new Error("This build is complete");
    const units = doc?.units ?? [];
    const result = {
      scope,
      stage,
      unit,
      finding,
      open,
      references,
      stamps,
      modelInventory: inventory,
    };
    const at = units.findIndex((item) => item.stage === stage && item.unit === unit);
    if (at === -1) units.push(result);
    else units[at] = result;
    return { version: 1, complete: false, scope, units, next };
  });
  return allocated.note ? { ...result, note: allocated.note } : result;
}

async function describe(root, run, doc) {
  const units = [];
  const stampsByFile = new Map();
  const inventory = modelInventory(root);
  let rebuild = false;
  for (const { stamps, modelInventory: savedInventory, ...unit } of doc.units) {
    const recheck = [];
    for (const [i, location] of unit.references.entries()) {
      const now = await stamp(root, run, location, stampsByFile);
      if (now === "foreign-run") {
        rebuild = true;
        recheck.push({ reason: "rebuild-from-original-sources" });
        break;
      }
      if (now === null || now === "missing" || now !== stamps[i])
        recheck.push({
          location,
          reason: now === null ? "verify-at-source" : now === "missing" ? "missing" : "changed",
        });
    }
    if (recheck.some((item) => item.reason === "rebuild-from-original-sources")) {
      units.push({
        scope: unit.scope,
        stage: unit.stage,
        unit: unit.unit,
        recheck: [{ reason: "rebuild-from-original-sources" }],
      });
      continue;
    }
    units.push({
      ...unit,
      scopeChanged: unit.scope !== doc.scope,
      modelFilesChanged: inventory !== savedInventory,
      recheck,
    });
  }
  const next = rebuild
    ? "Rebuild the flagged units from the current model and original sources."
    : doc.next;
  return { run, scope: doc.scope, complete: doc.complete, units, next };
}

async function resume(root, scope) {
  const matches = [];
  const warnings = [];
  const needle = scope.toLowerCase();
  const localDir = path.join(root, ".adr-review");
  const search = [
    [localDir, ""],
    [tmpdir(), runKind(root) + "-"],
  ];
  for (const [directory, prefix] of search) {
    let base = directory;
    let entries;
    try {
      if (prefix) {
        base = realpathSync(directory);
        if (base === localDir) continue; // Already searched as the local review space.
      }
      if (!stat(base)?.isDirectory()) continue;
      entries = readdirSync(base, { withFileTypes: true });
    } catch (error) {
      if (error.code !== "ENOENT") warnings.push({ run: base, reason: error.message });
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
      const run = path.join(base, entry.name);
      try {
        const header = await readScope(run);
        if (header && !header.complete && header.scope.toLowerCase().includes(needle))
          matches.push({ run, scope: header.scope });
      } catch (error) {
        warnings.push({ run, reason: error.message });
      }
    }
  }
  if (matches.length === 1 && !warnings.length) {
    const { run, scope } = matches[0];
    try {
      const doc = readProgress(run);
      if (doc && !doc.complete && doc.scope === scope)
        return { selected: await describe(root, run, doc) };
      matches.length = 0;
    } catch (error) {
      warnings.push({ run, reason: error.message });
      matches.length = 0;
    }
  }
  return { matches, warnings };
}

async function main([command, arg, ...extra]) {
  if (extra.length) throw new Error("Expected at most one run or scope argument");
  const root = projectRoot();
  if (command === "save")
    return save(root, arg && path.resolve(arg), JSON.parse(readFileSync(0, "utf8")));
  if (command === "resume") return resume(root, arg ?? "");
  if (arg && (command === "show" || command === "finish")) {
    const dir = verifyRun(root, path.resolve(arg));
    if (command === "finish")
      return update(dir, (doc) => {
        if (!doc) throw new Error("No saved build progress");
        return { ...doc, complete: true };
      });
    const doc = readProgress(dir);
    if (!doc) throw new Error("No saved build progress");
    return describe(root, dir, doc);
  }
  throw new Error("Use save [RUN] < checkpoint.json, resume [scope], show RUN or finish RUN");
}

try {
  console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2));
} catch (error) {
  console.error(`ontology-build-progress: ${error.message}`);
  process.exitCode = 1;
}
