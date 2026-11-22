#!/usr/bin/env bun
// Resume only this review. Plan reads the current project and refreshes its own checkpoint.
// record RUN ADR KEY reads {verdict, review, r19} from stdin after semantic review.
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isForeignReviewFile } from "./review-workspace.mjs";
import { withLock } from "./directory-lock.mjs";
import { reviewChanges } from "./review-changes.mjs";

const project = realpathSync(process.cwd());
const plugin = fileURLToPath(new URL("../", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const digest = (value) => hash(JSON.stringify(value));
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const verdicts = new Set(["PASS", "FIX_REQUIRED", "BLOCK"]);
const below = (root, file) => file.startsWith(root + path.sep);

function currentHead() {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const fileName = "review-progress.json";

function runDirectory(name, create) {
  const dir = path.resolve(name);
  const base = path.join(project, ".adr-review");
  if (create && path.dirname(dir) === base && !lstatSync(dir, { throwIfNoEntry: false })) {
    if (!lstatSync(base, { throwIfNoEntry: false })?.isSymbolicLink()) {
      mkdirSync(base, { recursive: true });
      const ignored = () =>
        spawnSync("git", ["check-ignore", "-q", path.join(dir, fileName)], {
          cwd: project,
          stdio: "ignore",
        }).status;
      const status = ignored();
      const exclusion = path.join(base, ".gitignore");
      if (status !== 0 && !lstatSync(exclusion, { throwIfNoEntry: false })) {
        try {
          writeFileSync(exclusion, "*\n", { flag: "wx" });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
      if (status === 1 && ignored() !== 0)
        throw Error("Allocate an ignored review folder or a fresh temporary run");
      mkdirSync(dir, { recursive: true });
    }
  }
  const real = realpathSync(dir);
  if (lstatSync(dir).isSymbolicLink() || (below(project, dir) && real !== dir))
    throw Error("Select this task's own review directory");
  if (
    !below(base, real) &&
    (below(project, real) || real === project || !below(realpathSync(tmpdir()), real))
  )
    throw Error("Use a disposable review run directory");
  return real;
}

function evidence(record) {
  return record && verdicts.has(record.verdict) && nonempty(record.review) && nonempty(record.r19);
}

function readCheckpoint(run) {
  const file = path.join(run, fileName);
  if (!lstatSync(file, { throwIfNoEntry: false })?.isFile()) return null;
  const bytes = readFileSync(file, "utf8");
  try {
    const { checksum, ...state } = JSON.parse(bytes);
    if (state.task === digest([project, run]) && state.version === 1 && checksum === digest(state))
      return state;
  } catch {
    /* A missing or interrupted checkpoint starts a fresh review. */
  }
  return null;
}

function writeCheckpoint(run, state) {
  const file = path.join(run, fileName);
  const tmp = path.join(run, `.review-${randomUUID()}.tmp`);
  try {
    writeFileSync(tmp, JSON.stringify({ ...state, checksum: digest(state) }, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    renameSync(tmp, file);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function freshLint(run, request) {
  const root = path.resolve(request.adrRoot ?? "docs/adr");
  if (
    !below(project, root) ||
    isForeignReviewFile(project, run, root) ||
    (lstatSync(root, { throwIfNoEntry: false }) && realpathSync(root) !== root)
  )
    throw Error("Select the current project's source ADR directory");
  const args = [path.join(plugin, "scripts/adr-structure-lint.mjs"), "--documents-only", "--json"];
  if (request.adrRoot) args.push("--adr-dir", request.adrRoot);
  if (request.warnAsError) args.push("--warn-as-error");
  if (request.target) args.push(request.target);
  const result = spawnSync(process.execPath, args, {
    cwd: project,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status))
    throw Error(result.stderr || result.error?.message || "Could not run document lint");
  return JSON.parse(result.stdout);
}

// Keep just the per-document lint basis needed to reject a stale recording key.
// The next planning pass obtains findings again from the current project.
function lintBasis(lint) {
  const byPath = new Map(lint.documents.map((p) => [p, []]));
  const shared = [];
  for (const item of [...lint.errors, ...lint.warnings]) {
    const bucket =
      item.scope !== "repository" &&
      (byPath.get(item.where) ?? byPath.get(item.where.replace(/:\d+$/, "")));
    (bucket || shared).push(item);
  }
  return {
    shared: digest(shared),
    unchecked: shared.some((item) =>
      ["invariants-env", "invariants-spawn", "read", "target-missing"].includes(item.rule),
    ),
    documents: Object.fromEntries(
      [...byPath].map(([adr, findings]) => [
        adr,
        findings.length
          ? {
              digest: digest(findings),
              error: findings.some((item) => item.level === "error" || lint.warnAsError),
            }
          : null,
      ]),
    ),
  };
}

function loadInputs(run, inputs, basis) {
  const adrRoot = path.resolve(inputs.adrRoot ?? "docs/adr");
  if (!below(project, adrRoot)) throw Error("ADR root must be inside the reviewed project");
  const mappingPath = path.join(adrRoot, ".mapping.json");
  let categories = {};
  let mappingUnreadable = false;
  try {
    if (lstatSync(mappingPath, { throwIfNoEntry: false }))
      categories = readJson(mappingPath).categories;
    if (!categories || typeof categories !== "object" || Array.isArray(categories))
      throw Error("Invalid categories");
  } catch {
    categories = {};
    mappingUnreadable = true;
  }
  const hashes = new Map();
  const fileHash = (file) => {
    if (!hashes.has(file)) hashes.set(file, hash(readFileSync(file)));
    return hashes.get(file);
  };
  const ruleNames = ["README.md", "concepts.md", "authoring-rules.md", "structure.md"];
  const installed = [
    "agents/adr-reviewer.md",
    "skills/adr-review/SKILL.md",
    "skills/adr-review/references/checkpoints.md",
    "skills/adr-review/references/report.md",
    "references/non-invasive-harness.md",
    "references/reader-first-writing.md",
    "references/comprehension-load.md",
    ...ruleNames.map((n) => "templates/adr/" + n),
  ].map((name) => [name, fileHash(path.join(plugin, name))]);
  const owners = new Map();
  for (const [key, entry] of Object.entries(categories)) {
    if (!Array.isArray(entry?.adrs)) continue;
    for (const item of entry.adrs)
      owners.set(typeof item === "string" ? item : item?.path, [key, entry]);
  }
  function snapshot(adr) {
    if (
      !Object.hasOwn(basis.documents, adr) ||
      !below(adrRoot, path.resolve(adr)) ||
      !/^\d{4}-.+\.md$/.test(path.basename(adr))
    )
      throw Error("ADR is outside the current lint scope");
    const options = { files: [], intent: null, ...inputs.documents?.[adr] };
    const owner = owners.get(adr) ?? null;
    const category = path.relative(adrRoot, path.dirname(path.resolve(adr))).split(path.sep)[0];
    const files = new Set([path.resolve(adr), ...options.files.map((f) => path.resolve(f))]);
    const dependencies = [];
    for (const dependency of owner?.[1].dependsOn ?? []) {
      const entry = categories[dependency];
      if (!entry || !Array.isArray(entry.adrs)) throw Error(`Unverified dependency: ${dependency}`);
      dependencies.push([dependency, entry]);
      for (const item of entry.adrs)
        files.add(path.resolve(typeof item === "string" ? item : item.path));
    }
    const optional = [...ruleNames, "glossary.md", path.join(category, "glossary.md")];
    for (const name of optional) {
      const file = path.join(adrRoot, name);
      if (lstatSync(file, { throwIfNoEntry: false })) files.add(file);
    }
    const stamps = [];
    for (const file of [...files].sort()) {
      if (isForeignReviewFile(project, run, file))
        throw Error(
          "Rebuild this review from its original sources; another task’s working files are outside its inputs",
        );
      if (!below(project, file) || realpathSync(file) !== file || !lstatSync(file).isFile())
        throw Error(`Unverified document input: ${file}`);
      stamps.push([path.relative(project, file), fileHash(file)]);
    }
    const findings = basis.documents[adr];
    return {
      key: digest([
        1,
        project,
        run,
        adr,
        owner,
        dependencies,
        installed,
        basis.shared,
        findings,
        Boolean(inputs.warnAsError),
        options.intent,
        stamps,
      ]),
      paths: stamps.map(([file]) => file),
      error: basis.unchecked || Boolean(findings?.error),
      allowReuse: options.reuse !== false && !basis.unchecked && !mappingUnreadable,
    };
  }
  return { paths: Object.keys(basis.documents), snapshot };
}

function plan(run, records, inputs) {
  const results = [];
  const groups = new Map();
  for (const adr of inputs.paths) {
    const item = { path: adr, action: "review" };
    results.push(item);
    try {
      const current = inputs.snapshot(adr);
      item.key = current.key;
      const saved = records[adr];
      if (!current.allowReuse || !evidence(saved) || saved.key !== current.key || !saved.base)
        continue;
      const group = groups.get(saved.base) ?? [];
      group.push({ item, current, saved });
      groups.set(saved.base, group);
    } catch (error) {
      item.reason = error.message;
    }
  }
  for (const [base, group] of groups) {
    const paths = [...new Set(group.flatMap((g) => g.current.paths))];
    const comparison = reviewChanges(base, paths, project);
    const changed = new Set([...(comparison.paths ?? []), ...(comparison.unverifiedPaths ?? [])]);
    for (const { item, current, saved } of group) {
      if (comparison.status === "unverified" && !comparison.unverifiedPaths) {
        item.reason = comparison.reason;
        continue;
      }
      const affected = current.paths.some((file) =>
        changed.has(path.posix.join(comparison.prefix ?? "", file)),
      );
      if (affected) item.reason = comparison.reason ?? "Changed review inputs";
      else if (!(current.error && saved.verdict === "PASS"))
        Object.assign(item, {
          action: "reuse",
          verdict: saved.verdict,
          review: saved.review,
          r19: saved.r19,
        });
    }
  }
  return results;
}

function validateRequest(run, request) {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    Object.keys(request).some(
      (key) => !["target", "adrRoot", "warnAsError", "documents"].includes(key),
    )
  )
    throw Error("Expected a target and optional current document inputs");
  if (
    (request.target !== undefined &&
      (!nonempty(request.target) || request.target.startsWith("-"))) ||
    (request.adrRoot !== undefined && !nonempty(request.adrRoot)) ||
    (request.warnAsError !== undefined && typeof request.warnAsError !== "boolean") ||
    (request.documents !== undefined &&
      (!request.documents ||
        typeof request.documents !== "object" ||
        Array.isArray(request.documents)))
  )
    throw Error("Invalid review scope or inputs");
  for (const [adr, entry] of Object.entries(request.documents ?? {})) {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      Object.keys(entry).some((key) => !["files", "intent", "reuse"].includes(key)) ||
      (entry.files !== undefined &&
        (!Array.isArray(entry.files) || !entry.files.every(nonempty))) ||
      (entry.intent != null && !nonempty(entry.intent)) ||
      (entry.reuse !== undefined && typeof entry.reuse !== "boolean")
    )
      throw Error(`Invalid current inputs for ${adr}`);
    for (const file of [adr, ...(entry.files ?? [])])
      if (isForeignReviewFile(project, run, file))
        throw Error("Another task's working file cannot be a review input");
  }
}

function prepare(run, suppliedRequest, includeLint) {
  const request = suppliedRequest ?? readCheckpoint(run)?.request ?? {};
  validateRequest(run, request);
  const lint = freshLint(run, request);
  const basis = lintBasis(lint);
  const records = withLock(path.join(run, ".review.lock"), () => {
    const state = readCheckpoint(run);
    if (!suppliedRequest && state && digest(state.request) !== digest(request))
      throw Error("The review scope changed; plan this task again");
    const records = state?.records ?? {};
    if (!state || digest([state.request, state.basis]) !== digest([request, basis]))
      writeCheckpoint(run, { version: 1, task: digest([project, run]), request, basis, records });
    return records;
  });
  const documents = plan(run, records, loadInputs(run, request, basis));
  return includeLint ? { lint, documents } : documents;
}

function record(run, adr, key, result) {
  return withLock(path.join(run, ".review.lock"), () => {
    const state = readCheckpoint(run);
    if (!state) throw Error("No checkpoint for this task; plan again from the current sources");
    const snapshot = loadInputs(run, state.request, state.basis).snapshot(adr);
    if (key !== snapshot.key)
      throw Error("Review inputs changed; plan and review the affected scope again");
    if (!evidence(result) || (snapshot.error && result.verdict === "PASS"))
      throw Error(
        "Supply a supported verdict, the review and R19 evidence consistent with the lint",
      );
    const base = snapshot.allowReuse ? currentHead() : null;
    state.records[adr] = {
      key,
      base,
      verdict: result.verdict,
      review: result.review,
      r19: result.r19,
    };
    writeCheckpoint(run, state);
    return { path: adr, verdict: result.verdict };
  });
}

try {
  const [command, name, ...args] = process.argv.slice(2);
  const usage = "Use plan RUN [--inputs] [--with-lint], record RUN ADR KEY, or finish RUN";
  if (!name || !["plan", "record", "finish"].includes(command)) throw Error(usage);
  if (
    (command === "plan" && args.some((arg) => !["--inputs", "--with-lint"].includes(arg))) ||
    (command === "record" && args.length !== 2) ||
    (command === "finish" && args.length)
  )
    throw Error(usage);
  if (command === "finish" && !lstatSync(path.resolve(name), { throwIfNoEntry: false })) {
    console.log(JSON.stringify({ removed: false }));
    process.exit(0);
  }
  const run = runDirectory(name, command === "plan");
  let result;
  if (command === "plan") {
    const request = args.includes("--inputs") ? JSON.parse(readFileSync(0, "utf8")) : null;
    result = prepare(run, request, args.includes("--with-lint"));
  } else if (command === "record") {
    result = record(run, args[0], args[1], JSON.parse(readFileSync(0, "utf8")));
  } else {
    result = withLock(path.join(run, ".review.lock"), () => {
      const removed = Boolean(readCheckpoint(run));
      if (removed) rmSync(path.join(run, fileName));
      return { removed };
    });
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`adr-review-progress: ${error.message}`);
  process.exitCode = 1;
}
