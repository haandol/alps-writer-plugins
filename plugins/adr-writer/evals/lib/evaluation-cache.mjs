// Evaluation fingerprints and the disposable result cache.
//
// Reuse depends on content, not on the environment that ran it. A behaviour
// fingerprint covers what the model is given: the prompt, the fixture files and
// the tool permissions. Plugin files a run reads, lists or executes through its
// tools are recorded per run and compared again on reuse: editing a file no
// cached run of a case consumed keeps them current, while editing one any of
// them consumed makes the case stale. A scoring fingerprint covers how a
// captured run is judged: the obligations and the scoring code. The target
// model, client, judge and harness are recorded with each result but are not
// reuse keys; comparing them calls for a fresh run.
//
// A cached result whose fingerprints and dependencies all match is current
// evidence. One whose behaviour matches but whose scoring changed is rejudged
// from its stored artifacts without calling the target again. The cache is
// derived and non-authoritative: deleting it only causes re-execution.
import { randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { confined, listFiles, sha } from "../regression/workspace.mjs";
import { STAMPED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";
import { ONTOLOGY_PLUGIN_ROOT } from "./harness.mjs";

const EVALS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.resolve(EVALS, "..");
const ROOT = path.resolve(PLUGIN, "../..");

const VERSION = JSON.parse(
  readFileSync(path.join(PLUGIN, ".claude-plugin/plugin.json"), "utf8"),
).version;

/**
 * Values that differ between runs without changing content: the fixture and
 * repository paths, the rules-version stamp equal to the current release (a
 * deliberately older stamp stays distinct) and the reference date.
 */
export function normalize(text, root, date) {
  let local = root ? text.split(root).join("<FIXTURE>") : text;
  local = local.split(ROOT).join("<REPO>");
  if (date) local = local.split(date).join("<DATE>");
  return local.replace(/(adr-writer:rules-version\s+)(\d+\.\d+\.\d+)/g, (all, prefix, version) =>
    version === VERSION ? `${prefix}<CURRENT>` : all,
  );
}

const fileHash = (file) => (existsSync(file) ? sha(normalize(readFileSync(file, "utf8"))) : null);

const TEMPLATES = path.join(PLUGIN, "templates/adr");
const templateName = (file) => STAMPED_RULE_DOCS.find((name) => file.endsWith(`docs/adr/${name}`));
const templateHash = (name, root = PLUGIN) => fileHash(path.join(root, "templates/adr", name));

/**
 * Content of every fixture file, as the model first sees it. A rule document
 * the fixture copied unchanged from the plugin templates is plugin content: it
 * is a behaviour input only when a run reads it (a `template:` dependency), so
 * editing a template does not re-run every case that merely carries a copy. A
 * copy the scenario changed (an old stamp, a legacy layout) keeps its content.
 */
export function fixtureFiles(root, date) {
  if (!root) return null;
  return listFiles(root).map((file) => {
    const text = readFileSync(confined(root, file), "utf8");
    const name = templateName(file);
    const template = name && path.join(TEMPLATES, name);
    if (
      template &&
      existsSync(template) &&
      normalize(text) === normalize(readFileSync(template, "utf8"))
    )
      return [file, `template:${name}`];
    return [file, sha(normalize(text, root, date))];
  });
}

/**
 * Fingerprint of the content the model is given. `extra` holds kind-specific
 * content such as execution turns or a routing schema; `date` is a value that
 * is neutralised wherever it appears.
 */
export function behaviourFingerprint({ prompt, root, item, extra = null, date }) {
  return sha({
    kind: item.type,
    prompt: prompt == null ? null : normalize(prompt, root, date),
    fixture: fixtureFiles(root, date),
    tools: {
      guidance: !item.directiveOnly,
      artifactPaths: item.artifactPaths ?? [],
      draftRoot: item.draftRoot ?? null,
      businessContext: Boolean(item.businessContext),
      // Present only on a model-change case, so every other fingerprint stays as it was.
      ...(item.modelChange === undefined ? {} : { modelChange: item.modelChange }),
    },
    extra,
  });
}

// The plugin programs behind run_check and status transitions, and the
// business-context query, are plugin content a run consumes when it calls them.
const CHECKERS = [
  "scripts/adr-structure-lint.mjs",
  "scripts/adr-lint-lib.mjs",
  "scripts/adr-invariants.sh",
  "scripts/adr-status-transition.mjs",
];

function programHash(name, checkerRoot) {
  if (name === "checkers")
    return sha(CHECKERS.map((file) => fileHash(path.join(checkerRoot, file))));
  if (name === "ontology") {
    const seen = moduleClosure(path.join(ONTOLOGY_PLUGIN_ROOT, "scripts/ontology.mjs"));
    return sha(
      [...seen].sort().map((file) => [path.relative(ROOT, file), closures.get(file).hash]),
    );
  }
  return undefined;
}

/**
 * Current value of one recorded dependency. `pluginRoot` is the tree the model
 * read through `plugin/`, `checkerRoot` the tree whose checkers ran, and
 * `skills` the shipped skill bodies a routing trial was shown. Ontology
 * Writer's guidance read through `ontology-plugin/` is its own plugin's. An
 * unknown kind never matches, so a stale cache format re-runs instead of failing.
 */
function dependencyValue(key, { pluginRoot, checkerRoot = pluginRoot, skills }) {
  const [kind, subject] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  try {
    if (kind === "read") return fileHash(confined(pluginRoot, subject));
    if (kind === "list") return sha(listFiles(pluginRoot, subject));
    if (kind === "ontology-read") return fileHash(confined(ONTOLOGY_PLUGIN_ROOT, subject));
    if (kind === "ontology-list")
      return sha(
        listFiles(ONTOLOGY_PLUGIN_ROOT, subject).filter((file) =>
          /^(skills|references|templates)\//.test(file),
        ),
      );
    if (kind === "program") return programHash(subject, checkerRoot);
    if (kind === "skill") return skills?.has(subject) ? sha(skills.get(subject)) : null;
    if (kind === "template")
      return subject === "*"
        ? sha(STAMPED_RULE_DOCS.map((name) => templateHash(name, checkerRoot)))
        : templateHash(subject, checkerRoot);
  } catch {
    return null;
  }
  return undefined;
}

/**
 * Plugin content a run actually consumed through its tools: each plugin file it
 * read or listed, the checkers it ran and the business-context query or model
 * change program. `skills` names the skill bodies a routing trial was shown.
 */
export function recordDependencies(events, context, { guidance = true, skills = [] } = {}) {
  const keys = new Set(skills.map((name) => `skill:${name}`));
  for (const event of events) {
    if (event.kind !== "request") continue;
    const target = event.arguments?.path ?? event.arguments?.prefix;
    if (["read_file", "list_files"].includes(event.tool) && target?.startsWith("plugin/")) {
      if (guidance) keys.add(`${event.tool === "read_file" ? "read" : "list"}:${target.slice(7)}`);
    } else if (
      ["read_file", "list_files"].includes(event.tool) &&
      target?.startsWith("ontology-plugin/")
    ) {
      const subject = target.slice("ontology-plugin/".length).replace(/\/+$/, "");
      if (guidance) keys.add(`ontology-${event.tool === "read_file" ? "read" : "list"}:${subject}`);
    } else if (event.tool === "read_file" && templateName(target ?? ""))
      // A seeded rule document read from the fixture is the template's content.
      keys.add(`template:${templateName(target)}`);
    else if (event.tool === "search") keys.add("template:*");
    else if (["run_check", "demote_adr_status"].includes(event.tool)) {
      // The checkers read the seeded rule documents too.
      keys.add("program:checkers");
      keys.add("template:*");
    } else if (["query_business_context", "change_business_model"].includes(event.tool))
      keys.add("program:ontology");
  }
  return Object.fromEntries([...keys].sort().map((key) => [key, dependencyValue(key, context)]));
}

/** Whether every dependency a cached run consumed still has the content it saw. */
export function dependenciesMatch(dependencies, context) {
  return Object.entries(dependencies ?? {}).every(([key, value]) => {
    const current = dependencyValue(key, context);
    return current !== undefined && current === value;
  });
}

// Module sources do not change during one evaluation process.
const closures = new Map();

/** Local modules a file imports, recursively, so a scorer helper change is not missed. */
function moduleClosure(file, seen = new Set()) {
  if (!file || seen.has(file) || !existsSync(file)) return seen;
  seen.add(file);
  if (!closures.has(file)) {
    const source = readFileSync(file, "utf8");
    closures.set(file, {
      hash: sha(source),
      imports: [...source.matchAll(/(?:from|import\()\s*["'](\.{1,2}\/[^"']+)["']/g)].map(
        ([, spec]) => path.resolve(path.dirname(file), spec),
      ),
    });
  }
  for (const child of closures.get(file).imports) moduleClosure(child, seen);
  return seen;
}

// Shared checks by kind: classification runs the artifact/action checks (and
// the plugin lint when the case's own scorer calls it); execution adds its final
// checks and lint; routing is scored by its own code alone.
const LINT = CHECKERS.filter((file) => !file.includes("status-transition"));
const sharedChecks = (item) =>
  item.type === "routing"
    ? []
    : item.type === "execution"
      ? ["evals/skills/mechanical-checks.mjs", "evals/lib/execution-checks.mjs", ...LINT]
      : ["evals/skills/mechanical-checks.mjs", ...(item.score ? LINT : [])];

/**
 * Fingerprint of the scoring content: the obligations (or routing
 * expectations), the case's own scoring code with its local helpers, and the
 * shared checks. The judge is recorded, not part of the key.
 */
export function scoringFingerprint({ item, code = [] }) {
  const own = item.score || item.verifyEvidence;
  const modules = new Set();
  if (own)
    for (const file of [
      item.file && path.join(EVALS, "scenarios", item.file),
      item.module && path.join(EVALS, item.module),
    ])
      moduleClosure(file, modules);
  return sha({
    obligations: (item.semanticObligations ?? item.obligations ?? []).map(({ id, text }) => [
      id,
      text,
    ]),
    routing: item.type === "routing" ? { required: item.required, allowed: item.allowed } : null,
    functions: [item.score, item.verifyEvidence, ...code].map((fn) => (fn ? String(fn) : null)),
    modules: [...modules]
      .sort()
      .map((file) => [path.relative(EVALS, file), closures.get(file).hash]),
    shared: sharedChecks(item).map((file) => [file, fileHash(path.join(PLUGIN, file))]),
  });
}

/** The result cache at `dir` (default `.codex/evals/cache`, or `ADR_EVAL_CACHE`). */
export function openCache(
  dir = process.env.ADR_EVAL_CACHE ?? path.join(ROOT, ".codex/evals/cache"),
) {
  const caseFolder = (caseId) => confined(dir, caseId);
  return {
    root: dir,
    /** Cached results for one case, oldest first; an unreadable entry is skipped, never fatal. */
    entries(caseId) {
      if (!/^[a-z0-9-]+$/.test(caseId) || !existsSync(path.join(dir, caseId))) return [];
      return readdirSync(caseFolder(caseId))
        .map((id) => path.join(caseFolder(caseId), id, "meta.json"))
        .filter((file) => existsSync(file))
        .flatMap((file) => {
          try {
            const entry = JSON.parse(readFileSync(file, "utf8"));
            return entry?.id && entry.createdAt ? [entry] : [];
          } catch {
            process.stderr.write(`Ignoring unreadable cache entry ${file}\n`);
            return [];
          }
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    },
    /** Copy one completed run folder into the cache; the metadata is written last and atomically. */
    store(caseId, meta, folder) {
      const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
      mkdirSync(dir, { recursive: true });
      const entry = confined(dir, `${caseId}/${id}`);
      mkdirSync(entry, { recursive: true });
      cpSync(folder, path.join(entry, "artifacts"), { recursive: true });
      const stored = { ...meta, id, caseId, createdAt: new Date().toISOString() };
      const temporary = path.join(entry, `meta.${randomUUID()}.tmp`);
      writeFileSync(temporary, JSON.stringify(stored, null, 2));
      renameSync(temporary, path.join(entry, "meta.json"));
      return stored;
    },
    /** Restore a cached run's artifacts into a new run folder. */
    restore(entry, folder) {
      const source = path.join(caseFolder(entry.caseId), entry.id, "artifacts");
      if (!existsSync(path.join(source, "result.json")))
        throw new Error(`cached artifacts of ${entry.id} are incomplete`);
      cpSync(source, folder, { recursive: true });
    },
  };
}

const SCORED = new Set(["PASS", "NOT_PROVEN"]);

/**
 * The cached runs of one case with the same behaviour, one per original target
 * run, newest first. Each is reusable when its scoring is current and it was
 * scored; otherwise its captured reply can be rejudged. `stale` marks a case
 * whose consumed plugin files changed since one of its runs.
 */
export function cachedSamples(cache, caseId, { behaviour, scoring, context }) {
  if (!cache) return { reusable: [], rejudgeable: [] };
  const same = cache
    .entries(caseId)
    .filter((e) => e.behaviour === behaviour)
    .reverse();
  // When any cached run of the case consumed a plugin file that has since
  // changed, the case's inputs changed: keeping only the runs that happened not
  // to read it would bias the sample, so none is current.
  if (same.some((e) => !dependenciesMatch(e.dependencies, context)))
    return { reusable: [], rejudgeable: [], stale: true };
  // A rejudge copies the original target evidence, so one original is one sample.
  const used = new Set();
  const reusable = [];
  const rejudgeable = [];
  for (const e of same) {
    const origin = e.source ?? e.id;
    if (used.has(origin)) continue;
    used.add(origin);
    (e.scoring === scoring && SCORED.has(e.verdict) ? reusable : rejudgeable).push(e);
  }
  return { reusable, rejudgeable };
}
