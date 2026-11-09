#!/usr/bin/env bun
// ontology.mjs — command line for the optional business ontology
// level (docs/ontology/*.ttl), run with Bun.
//
// Usage:
//   bun ontology.mjs validate [--adr-dir DIR] [--json]
//   bun ontology.mjs format [--check | --write [--allow-comment-removal]]
//   bun ontology.mjs diff [--base REF] [--json]
//   bun ontology.mjs validate [--require-layers] [--layer-context ID]...
//   bun ontology.mjs query (--overview | --context ID) [--search TEXT] [--limit N] [--offset N]
//   bun ontology.mjs query (--category KEY | --process ID | --step ID | --concept ID | --event ID)
//                                [--include-retired] [--adr-dir DIR] [--json]
//   bun ontology.mjs impact (--draft DIR | --base REF [--also-base REF]...) [--process ID]
//                                [--same-meaning ID=PROPERTY]... [--mapping FILE] [--glossary FILE] [--json]
//   bun ontology.mjs changes [--json]
//   bun ontology.mjs apply (--draft DIR | --base REF [--also-base REF]... [--process ID]) --base-hash HASH
//                                [--same-meaning ID=PROPERTY]...
//                                [--mapping FILE] [--glossary FILE]
//                                [--log TEXT]... [--allow-comment-removal]
//   bun ontology.mjs transition --process ID --to Accepted|Proposed [--date YYYY-MM-DD]
//                                [--same-meaning ID=PROPERTY]... [--unread-unchanged]
//   bun ontology.mjs align --process ID [--together ID,ID] [--json]
//   bun ontology.mjs lifecycle [--base REF] [--json]
//   bun ontology.mjs view [--include-retired] [--lang en|ko] [--no-open | --browser NAME]
//
//   validate  closed-world model checks plus the ADR index's `realizes` links;
//             the model is the Turtle documents in the ADR directory's sibling
//             `ontology/` (docs/ontology for the default docs/adr)
//   format    canonical Turtle: --check (default) lists documents that differ,
//             --write rewrites them; a document with Turtle comments is rewritten
//             only with --allow-comment-removal, after the approval showed the removal
//   diff      semantic diff of the model against a git revision (default HEAD);
//             formatting, ordering and comments never appear
//   query     BC overview/internal navigation, or business context of one feature,
//             process, step, concept or event: only the
//             connected elements, with process and ADR Status, in-scope validation
//             errors and uncommitted / unsynced-edit flags
//   impact    what an ontology change approval shows for a draft model directory
//             (or for the current documents against a git revision with --base, and
//             against each --also-base revision too, the union bound as one):
//             semantic diff, processes that become Proposed, affected features,
//             index-link changes, unrealized system steps, glossary cleanup,
//             change-log candidates, and the base hash the approval binds (the
//             model, index, glossary, change log, drafts — --mapping and --glossary
//             included — the affected and relinked ADRs and the confirmations)
//   changes   model edits not yet synced: uncommitted elements against HEAD,
//             Accepted processes edited in committed history since they last became
//             Accepted (with the commit where that Status appeared, and in alsoSince
//             the other commits where it may have), lifecycle edits, and what history
//             could not judge, with the reason
//   apply     write an approved draft as one change unit — model documents in
//             canonical form, Proposed for changed processes, the index, the
//             glossary and change-log lines — only if nothing changed since
//             the summary (the base hash) and every link still resolves; an
//             Accepted process the draft changed only by open scope or confirmed
//             same-meaning wording gets its Accepted date renewed when nothing else
//             changed since it became Accepted and the gates hold (otherwise the
//             output says why not). With --base, the direct edit's index, glossary
//             and change-log changes only
//   transition promote a process to Accepted after a passing alignment review; renew
//             an Accepted process's date after confirming that its changes since it
//             became Accepted are open scope or same-meaning wording (--same-meaning),
//             or that commits history cannot read in a row changed nothing in its
//             business composition (--unread-unchanged, the user's confirmation);
//             or mark a directly edited Accepted process Proposed. Retirements go
//             through apply. --date records the day of the review or confirmation
//             (default: today); it may not be later than today, nor, for a renewal,
//             before the current Accepted date
//   align     the alignment-review plan: realization and ADR Status gates,
//             where compliance contracts must exist, criteria execution scope,
//             cross-process hand-offs to run now or deferred
//   lifecycle lifecycle changes since a revision that Ontology Writer's transitions
//             cannot explain (direct edits of Status or replacement)
//   view      read-only standalone HTML: landscape, process flows, element details
//             with realization status; written to an ignored .adr-review/ run
//             directory and opened once in the default (or named) browser
//
// Exit: 0 = clean / no difference / complete context, 1 = findings, differences,
//       a missing target or an incomplete context, 2 = usage error.
// --overview returns the complete authored BC layer by default; --context uses
// 20 rows per page. Optional --limit (1..100) and --offset page navigation only.
// --require-layers and repeatable --layer-context also apply to impact/apply.

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  ONTO,
  TRANSITIONS,
  addedLines,
  businessComposition,
  checkRealizes,
  compositionAndOpenScope,
  classifyProcessStatus,
  diffGraphs,
  elementId,
  elementIri,
  glossaryOverlap,
  indexGraph,
  isAccepted,
  knowledgeLayerFindings,
  lifecycleFindings,
  parseDocument,
  parseTurtle,
  processStatus,
  sameKeys,
  sameMeaningKeys,
  serializeTurtle,
  termKey,
  unionGraph,
  validateModel,
} from "./ontology-lib.mjs";
import { validateMappingShape } from "./adr-lint-lib.mjs";
import { alignmentPlan, impactSummary } from "./ontology-align.mjs";
import {
  CHANGE_LOG,
  acceptedBaselines,
  allocateRunDirectory,
  changeFlags,
  findModelDocuments,
  lifecycleHistoryAudit,
  lifecycleHistoryFindings,
  modelDocumentsAt,
  ontologyFindings,
  readDocument,
  readModelHistory,
  recordedAdrFiles,
} from "./ontology-fs.mjs";
import { openReviewReport } from "./adr-impl-review-open.mjs";
import { renderView } from "./ontology-view.mjs";
import { currentAdrPaths, queryContext, renderContext } from "./ontology-query.mjs";
import { navigationOptions } from "./ontology-navigation.mjs";

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join("/");
// Text output keeps a list this long on one line; a longer one takes a line per item.
const SHORT_LIST = 20;
const mappingPathOf = (opts) => path.join(opts.adrDir, ".mapping.json");

/** The usage the header comment documents, without its comment markers. */
function usageText() {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("// Usage:"));
  const end = lines.findIndex((l, i) => i > start && !l.startsWith("//"));
  return `${lines
    .slice(start, end)
    .map((l) => l.replace(/^\/\/ ?/, ""))
    .join("\n")}\n`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (["help", "--help", "-h"].includes(command)) return { command: "help" };
  const opts = {
    command,
    adrDir: "docs/adr",
    ontologyDir: null,
    json: false,
    write: false,
    allowCommentRemoval: false,
    base: "HEAD",
    target: null,
    includeRetired: false,
    search: "",
    limit: null,
    offset: 0,
    requireLayers: false,
    layerContexts: [],
    draft: null,
    baseHash: null,
    mappingFile: null,
    glossaryFile: null,
    logs: [],
    process: null,
    to: null,
    date: null,
    together: [],
    sameMeaning: [],
    alsoBase: [],
    lang: "en",
    open: true,
    browser: null,
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const value = () => rest[++i] ?? usage(`${a} requires a value`);
    if (a === "--adr-dir") opts.adrDir = value().replace(/\/+$/, "");
    else if (a === "--base") opts.base = value();
    else if (a === "--json") opts.json = true;
    else if (a === "--write") opts.write = true;
    else if (a === "--check") opts.write = false;
    else if (a === "--allow-comment-removal") opts.allowCommentRemoval = true;
    else if (a === "--include-retired") opts.includeRetired = true;
    else if (a === "--require-layers" && ["validate", "impact", "apply"].includes(command))
      opts.requireLayers = true;
    else if (a === "--layer-context" && ["validate", "impact", "apply"].includes(command))
      opts.layerContexts.push(value());
    else if (a === "--draft") opts.draft = value().replace(/\/+$/, "");
    else if (a === "--base-hash") opts.baseHash = value();
    else if (a === "--mapping") opts.mappingFile = value();
    else if (a === "--glossary") opts.glossaryFile = value();
    else if (a === "--log") opts.logs.push(value());
    else if (a === "--same-meaning") opts.sameMeaning.push(value());
    else if (a === "--unread-unchanged") opts.unreadUnchanged = true;
    else if (a === "--also-base") opts.alsoBase.push(value());
    else if (a === "--overview" && command === "query") {
      if (opts.target) usage("give exactly one query target");
      opts.target = { kind: "overview" };
    } else if (a === "--search" && command === "query") opts.search = value();
    else if (["--limit", "--offset"].includes(a) && command === "query") {
      const v = value();
      if (!/^\d+$/.test(v)) usage(`${a} requires an integer`);
      opts[a.slice(2)] = Number(v);
    } else if (
      ["--category", "--concept", "--event"].includes(a) ||
      (["--context", "--step"].includes(a) && command === "query") ||
      (a === "--process" && command === "query")
    ) {
      if (opts.target) usage("give exactly one query target");
      opts.target = { kind: a.slice(2), id: value() };
    } else if (a === "--process") opts.process = value();
    else if (a === "--to") opts.to = value();
    else if (a === "--date") opts.date = value();
    else if (a === "--together") opts.together = value().split(",").filter(Boolean);
    else if (a === "--lang") opts.lang = value();
    else if (a === "--no-open") opts.open = false;
    else if (a === "--browser") opts.browser = value();
    else usage(`unknown argument: ${a}`);
  }
  const commands = [
    "validate",
    "format",
    "diff",
    "query",
    "impact",
    "changes",
    "apply",
    "transition",
    "align",
    "lifecycle",
    "view",
  ];
  if (!commands.includes(command))
    usage(`expected a command: ${commands.join(", ")} (help shows the usage)`);
  if (opts.layerContexts.length && !opts.requireLayers)
    usage("--layer-context requires --require-layers");
  if (command === "query" && !opts.target)
    usage("query needs --overview, --context, --category, --process, --step, --concept or --event");
  if (command === "query") {
    const navigation = ["overview", "context"].includes(opts.target.kind);
    if (!navigation && rest.some((a) => ["--search", "--limit", "--offset"].includes(a)))
      usage("--search, --limit and --offset apply only to --overview or --context");
    if (navigation) {
      try {
        navigationOptions(opts);
      } catch (e) {
        usage(e.message);
      }
      if (rest.includes("--search") && !opts.search.trim())
        usage("--search requires nonempty text");
    }
  }
  if (command === "apply" && !opts.draft && !argv.includes("--base"))
    usage("apply needs --draft DIR, or --base REF for an approved direct edit");
  if (command === "impact" && !opts.draft && !argv.includes("--base"))
    usage("impact needs --draft DIR or --base REF");
  if (command === "apply" && !opts.baseHash) usage("apply needs --base-hash from impact");
  if (opts.alsoBase.length && (opts.draft || !argv.includes("--base")))
    usage("--also-base adds bases to a --base comparison of a direct edit");
  if ((command === "impact" || command === "apply") && opts.draft && opts.process)
    usage("--process limits a --base comparison; a draft is summarized whole");
  if ((command === "transition" || command === "align") && !opts.process)
    usage(`${command} needs --process ID`);
  if (command === "transition" && !opts.to) usage("transition needs --to STATE");
  opts.ontologyDir = path.join(path.dirname(opts.adrDir), "ontology");
  return opts;
}

function usage(msg) {
  process.stderr.write(`ontology: ${msg}\n`);
  process.exit(2);
}

/**
 * The ADR index and, when the file exists but cannot be read or parsed, an error
 * finding with its position — an unreadable index is never read as "no index".
 */
function loadMapping(adrDir) {
  const file = path.join(adrDir, ".mapping.json");
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR")
      return { mapping: null, finding: null };
    return {
      mapping: null,
      finding: {
        level: "error",
        code: "ontology-index-unreadable",
        where: rel(file),
        element: null,
        msg: `the ADR index cannot be read (${error.message}); every business context that depends on it is incomplete`,
      },
    };
  }
  try {
    return { mapping: JSON.parse(text), finding: null };
  } catch (error) {
    const at = Number(/position (\d+)/.exec(error.message)?.[1] ?? text.length);
    const lines = text.slice(0, at).split("\n");
    return {
      mapping: null,
      finding: {
        level: "error",
        code: "ontology-index-unreadable",
        where: `${rel(file)}:${lines.length}:${lines.at(-1).length + 1}`,
        element: null,
        msg: `the ADR index cannot be parsed (${error.message}); every business context that depends on it is incomplete`,
      },
    };
  }
}

/** Model and index findings of the working tree, the unreadable-index finding included. */
function levelFindings(opts) {
  const { mapping, finding } = loadMapping(opts.adrDir);
  const level = ontologyFindings({
    ontologyDir: opts.ontologyDir,
    adrRoot: opts.adrDir,
    mapping,
    mappingPath: rel(path.join(opts.adrDir, ".mapping.json")),
    rel,
  });
  return { ...level, mapping, findings: finding ? [finding, ...level.findings] : level.findings };
}

function validate(opts) {
  const { model, index, findings: originalFindings } = levelFindings(opts);
  const findings =
    opts.requireLayers && index
      ? [
          ...originalFindings.filter((f) => !f.code.startsWith("ontology-layer-")),
          ...knowledgeLayerFindings(index, {
            required: !opts.layerContexts.length,
            requiredContexts: new Set(opts.layerContexts.map(elementIri)),
          }),
        ]
      : originalFindings;
  const errors = findings.filter((f) => f.level === "error");
  if (opts.json)
    process.stdout.write(JSON.stringify({ ok: !errors.length, model, findings }, null, 2) + "\n");
  else {
    if (!model && !findings.length) process.stdout.write(`no ontology in ${opts.ontologyDir}\n`);
    for (const f of findings)
      process.stdout.write(
        `${f.level === "error" ? "✗" : "⚠"} [${f.code}] ${f.where}\n    ${f.msg}\n`,
      );
    if (model && !errors.length)
      process.stdout.write(
        `✓ ontology valid${findings.length ? ` (${findings.length} warning(s))` : ""}\n`,
      );
  }
  return errors.length ? 1 : 0;
}

function format(opts) {
  const files = findModelDocuments(opts.ontologyDir);
  if (!files.length) {
    process.stdout.write(`no ontology in ${rel(opts.ontologyDir)}; nothing to format\n`);
    return 0;
  }
  const documents = files.map((file) => ({ file, doc: rel(file), ...readDocument(file) }));
  const check = validateModel(documents, { modelDir: rel(opts.ontologyDir) });
  const parseErrors = check.findings.filter(
    (f) => f.level === "error" && f.code !== "ontology-not-validated" && !check.index,
  );
  if (parseErrors.length) {
    for (const e of parseErrors) process.stdout.write(`✗ [${e.code}] ${e.where}\n    ${e.msg}\n`);
    return 1;
  }
  const changed = [];
  const blocked = [];
  const canonicalOf = new Map();
  // Every document parsed: validation's parse of each is the one to serialize.
  for (const [i, d] of documents.entries()) {
    const parsed = check.parsed[i];
    const canonical = serializeTurtle(parsed.triples);
    if (canonical === d.text) continue;
    changed.push(d.doc);
    canonicalOf.set(d.file, canonical);
    if (parsed.comments.length && !opts.allowCommentRemoval)
      blocked.push(`${d.doc} (comments on line(s) ${parsed.comments.join(", ")})`);
  }
  if (opts.write && blocked.length) {
    process.stdout.write(
      `✗ not rewritten: Turtle comments would be dropped. Show the removal in the approval summary, then rerun with --allow-comment-removal:\n` +
        blocked.map((b) => `  - ${b}\n`).join(""),
    );
    return 1;
  }
  if (!changed.length) {
    process.stdout.write("✓ model documents are canonical\n");
    return 0;
  }
  if (opts.write) for (const [file, canonical] of canonicalOf) writeFileSync(file, canonical);
  process.stdout.write(
    `${opts.write ? "rewrote" : "not canonical"}:\n${changed.map((c) => `  - ${c}\n`).join("")}`,
  );
  return opts.write ? 0 : 1;
}

/**
 * Triples of every model document at a git revision, and its change log, read the
 * way the working tree is read; an absent model is an empty graph. Throws when the
 * revision cannot be read; command entry points turn that into a usage error.
 */
function graphAt(ref, ontologyDir) {
  let read;
  try {
    read = modelDocumentsAt(ref, ontologyDir);
  } catch (e) {
    throw new Error(`cannot read ${ref}: ${String(e.stderr || e.message).trim()}`);
  }
  const parsed = read.docs.map((d) => parseDocument({ ...d, doc: `${ref}:${d.file}` }));
  return { parsed, triples: unionGraph(parsed), changeLog: read.changeLog, commit: read.commit };
}

/**
 * HEAD's model and change log from a history read that read all of HEAD, as
 * `graphAt("HEAD")` reads them; null where it did not, so the caller reads HEAD itself.
 */
function headRevision(history) {
  if (!history?.available || !history.head || history.headSkipped.length) return null;
  const parsed = history.headDocuments().map((d) => parseDocument({ ...d, doc: `HEAD:${d.file}` }));
  return {
    parsed,
    triples: unionGraph(parsed),
    changeLog: history.changeLogAt(history.head) ?? "",
    commit: history.head,
  };
}

/** graphAt for command entry points: an unreadable revision is a usage error. */
function revision(ref, ontologyDir) {
  try {
    return graphAt(ref, ontologyDir);
  } catch (error) {
    return usage(error.message);
  }
}

function diff(opts) {
  const before = revision(opts.base, opts.ontologyDir);
  const after = validateModel(
    findModelDocuments(opts.ontologyDir).map((f) => ({ doc: rel(f), ...readDocument(f) })),
  ).parsed;
  const failed = [...before.parsed, ...after].flatMap((p) => p.errors);
  if (failed.length) {
    for (const e of failed)
      process.stdout.write(
        `✗ [ontology-${e.code === "syntax" ? "parse" : e.code}] ${e.doc}:${e.line}:${e.col}\n    ${e.message}\n`,
      );
    return 1;
  }
  const result = diffGraphs(before.triples, unionGraph(after));
  if (opts.json)
    process.stdout.write(JSON.stringify({ base: opts.base, ...result }, null, 2) + "\n");
  else if (result.same) process.stdout.write(`✓ no semantic change against ${opts.base}\n`);
  else
    for (const e of result.elements) {
      process.stdout.write(`${e.change} ${e.type ?? "?"} ${e.id}\n`);
      for (const p of e.properties)
        process.stdout.write(
          `    ${p.property} [${p.family}]${p.removed.length ? ` - ${p.removed.join(", ")}` : ""}${p.added.length ? ` + ${p.added.join(", ")}` : ""}\n`,
        );
    }
  return result.same ? 0 : 1;
}

function query(opts) {
  const { model, findings, index, mapping } = levelFindings(opts);
  if (!model) {
    const none = {
      kind: opts.target.kind,
      id: opts.target.id,
      model: false,
      note: `no ontology in ${opts.ontologyDir}; the business ontology level does not apply`,
    };
    process.stdout.write(opts.json ? JSON.stringify(none, null, 2) + "\n" : `${none.note}\n`);
    return 0;
  }
  const result = queryContext({
    index,
    mapping,
    findings,
    changes: index
      ? changeFlags(opts.ontologyDir, index, { mappingPath: mappingPathOf(opts) })
      : null,
    target: opts.target,
    includeRetired: opts.includeRetired,
    search: opts.search,
    limit: opts.limit,
    offset: opts.offset,
  });
  process.stdout.write(opts.json ? JSON.stringify(result, null, 2) + "\n" : renderContext(result));
  return result.found && result.complete ? 0 : 1;
}

// ── lifecycle commands ─────────────────────────────────────────────────────

const CHANGE_LOG_HEAD =
  "# Ontology change log\n\nNewest first. One line per major business change or process retirement, with its reason.\n\n";

function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** Parse every model document of a directory; null documents mean a parse failure was printed. */
function loadModel(dir) {
  const docs = findModelDocuments(dir).map((f) => ({ file: f, ...readDocument(f) }));
  const check = validateModel(
    docs.map((d) => ({ ...d, doc: rel(d.file) })),
    { modelDir: rel(dir) },
  );
  if (!check.index) {
    for (const e of check.findings.filter((f) => f.level === "error"))
      process.stdout.write(`✗ [${e.code}] ${e.where}\n    ${e.msg}\n`);
    return null;
  }
  return {
    dir,
    docs: docs.map((d, i) => ({ ...d, parsed: check.parsed[i] })),
    index: check.index,
    findings: check.findings,
  };
}

/** The approval preview and save validate the same model and construction scope. */
function validateModelChange(documents, before, mapping, opts) {
  return validateModel(documents, {
    categoryKeys: Object.keys(mapping?.categories ?? {}),
    modelDir: rel(opts.draft ?? opts.ontologyDir),
    requireKnowledgeLayers: opts.requireLayers && !opts.layerContexts.length,
    requiredContexts: new Set(opts.layerContexts.map(elementIri)),
    previousContexts: new Set(before.ofType("BoundedContext")),
  });
}

/**
 * A path's real location as the volume stores it, or null when it cannot be
 * resolved. The native call returns the stored spelling, so on a volume that folds
 * letter case or Unicode form two spellings of one file are one real location.
 */
const realOf = (f) => {
  try {
    return realpathSync.native(f);
  } catch {
    return null;
  }
};

/** Where a file is really kept, or its absolute path when that cannot be resolved. */
const realName = (f) => realOf(f) ?? path.resolve(f);

/** Whether a path names a symbolic link; false when nothing is there. */
const isLink = (f) => {
  try {
    return lstatSync(f).isSymbolicLink();
  } catch {
    return false;
  }
};

/** The directory entry a path names — its link, not the link's target — or null. */
const entryOf = (f) => {
  try {
    const st = lstatSync(f);
    return `${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
};

/** The file a path leads to, following links — the same for hard links — or null. */
const fileOf = (f) => {
  try {
    const st = statSync(f);
    return `${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
};

/**
 * Draft documents as `{doc, text}` labelled relative to the draft directory. A
 * draft is a set of copies; a document that resolves into the model directory or
 * to the file of a model document (a shared document linked into the model, or a
 * hard link to one) would let a draft edit change the model before approval, so
 * it is refused.
 */
function draftDocuments(draft, ontologyDir) {
  const model = realOf(ontologyDir);
  const liveDocs = findModelDocuments(ontologyDir);
  const live = new Set(liveDocs.map(realOf).filter(Boolean));
  const liveFiles = new Set(liveDocs.map(fileOf).filter(Boolean));
  const files = findModelDocuments(draft);
  for (const f of files) {
    const real = realOf(f);
    if (
      (real &&
        ((model && (real === model || real.startsWith(model + path.sep))) || live.has(real))) ||
      liveFiles.has(fileOf(f))
    )
      usage(
        `draft document ${rel(f)} is a model document under another name (a link or a hard link), so an edit made through it has already changed the model; a draft holds copies (cp -RL, or write the text), never links`,
      );
  }
  return files.map((f) => ({
    doc: path.relative(draft, f).split(path.sep).join("/"),
    ...readDocument(f),
  }));
}

/**
 * The hash an ontology change approval binds: the model documents, the index, the
 * glossary and the change log as they are now, the draft, the index and glossary
 * drafts, every ADR file of the affected and relinked features, the confirmed
 * same-meaning changes, the summary's scope and the commits a direct edit was compared
 * with, so an apply against another base or a moved ref is not the approved change.
 */
function baseHash(
  opts,
  {
    drafts = [],
    adrs = [],
    sameMeaning = [],
    scope = null,
    mappingDraft = null,
    glossaryDraft = null,
    base = null,
    alsoBases = [],
  } = {},
) {
  const h = createHash("sha256");
  for (const f of findModelDocuments(opts.ontologyDir))
    h.update(`${rel(f)}\0${readText(f) ?? ""}\0`);
  for (const f of [
    path.join(opts.adrDir, ".mapping.json"),
    path.join(opts.adrDir, "glossary.md"),
    path.join(opts.ontologyDir, CHANGE_LOG),
  ])
    h.update(`${f}\0${readText(f) ?? ""}\0`);
  for (const d of drafts) h.update(`draft:${d.doc}\0${d.text}\0`);
  h.update(`mapping-draft\0${mappingDraft ?? ""}\0glossary-draft\0${glossaryDraft ?? ""}\0`);
  for (const a of [...adrs].sort()) h.update(`adr:${a}\0${readText(a) ?? ""}\0`);
  h.update(`same-meaning\0${[...sameMeaning].sort().join("\n")}\0scope\0${scope ?? ""}\0`);
  h.update(`base\0${base ?? ""}\0also-base\0${alsoBases.join("\n")}\0`);
  return h.digest("hex");
}

/** Categories whose `realizes` links the index draft changes, and their ADR files. */
function relinked(current, draft) {
  if (!draft) return { categories: [], adrs: [] };
  const links = (m, k) => {
    const r = m?.categories?.[k]?.realizes;
    return Array.isArray(r) ? JSON.stringify([...r].sort()) : "none";
  };
  const keys = new Set([
    ...Object.keys(current?.categories ?? {}),
    ...Object.keys(draft?.categories ?? {}),
  ]);
  const categories = [...keys].filter((k) => links(current, k) !== links(draft, k)).sort();
  // A feature binds its current ADRs when it realizes a step before or after the change:
  // recording that a feature realizes none, when it realized none, revises no ADR.
  const realizing = (m, k) =>
    Array.isArray(m?.categories?.[k]?.realizes) && m.categories[k].realizes.length > 0;
  const adrs = categories
    .filter((k) => realizing(current, k) || realizing(draft, k))
    .flatMap((k) => [
      ...currentAdrPaths(draft.categories?.[k]),
      ...currentAdrPaths(current?.categories?.[k]),
    ]);
  return { categories, adrs: [...new Set(adrs)].sort() };
}

/**
 * Why each affected ADR is bound: its feature realizes a changed element (`direct`), a step of
 * a process that becomes Proposed (`proposed-process`), or its index links change (`relinked`).
 * The reasons let a summary judge which ADRs need a revision; every listed ADR stays bound.
 */
function affectedAdrReasons(summary, index, relink) {
  const reasons = new Map();
  const add = (paths, why) => {
    for (const p of paths) reasons.set(p, new Set([...(reasons.get(p) ?? []), why]));
  };
  for (const c of summary.directlyAffectedCategories)
    add(currentAdrPaths(index?.categories?.[c]), "direct");
  for (const c of summary.categoriesOfProposedProcesses)
    add(currentAdrPaths(index?.categories?.[c]), "proposed-process");
  add(relink.adrs, "relinked");
  return Object.fromEntries(
    [...reasons].sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, set]) => [p, [...set].sort()]),
  );
}

/** An index or glossary draft passed to impact or apply, read as text; a missing one is a usage error. */
function draftText(file, flag) {
  if (!file) return null;
  const text = readText(file);
  if (text === null) usage(`cannot read ${flag} ${file}`);
  return text;
}

/** Confirmed same-meaning keys, or a usage error naming the confirmations that do not qualify. */
function confirmations(opts, before, after) {
  const { keys, errors } = sameMeaningKeys(opts.sameMeaning, before, after);
  if (errors.length) usage(`--same-meaning: ${errors.join("; ")}`);
  return keys;
}

/**
 * Ontology sync's same-meaning confirmations over every commit where a process may have
 * last become Accepted (`candidates`, each with its `graph`): a confirmation keeps the
 * meaning of the one text the result replaced, so it counts where every candidate whose
 * text differs from the result's holds that same text, and is `ambiguous` where they
 * hold different ones. A confirmation of text no candidate changed is a usage error.
 */
function renewalConfirmations(opts, candidates, to) {
  const keys = new Set();
  for (const raw of opts.sameMeaning ?? []) {
    const checks = candidates.map((c) => sameMeaningKeys([raw], c.graph, to));
    const changed = checks.flatMap((r, i) => (r.errors.length ? [] : [i]));
    if (!changed.length) usage(`--same-meaning: ${checks[0].errors.join("; ")}`);
    // Two candidates hold different replaced texts where one changed into the other.
    const [first, ...others] = changed.map((i) => candidates[i].graph);
    if (others.some((g) => !sameMeaningKeys([raw], first, g).errors.length))
      return { keys, ambiguous: raw };
    for (const key of checks[changed[0]].keys) keys.add(key);
  }
  return { keys };
}

/**
 * The impact summary of a direct edit against its base and each `--also-base` commit —
 * the other commits where a process may have last become Accepted (`alsoSince` of
 * `changes`): whatever changed against any of them is in it, so its approval binds
 * every ADR any of them affects. A same-meaning confirmation counts against each base
 * whose text it changes, and must change one. Returns `{summary}` or `{error}`.
 */
function summaryOverBases(opts, before, after, { mapping, glossary, scope }) {
  const befores = [before];
  // The commits the extra bases name, which the approval binds.
  const alsoBases = [];
  for (const ref of opts.alsoBase) {
    const at = revision(ref, opts.ontologyDir);
    if (at.parsed.some((x) => x.errors.length))
      return { error: `the model at ${ref} cannot be parsed` };
    befores.push(indexGraph(at.triples));
    alsoBases.push(at.commit);
  }
  if (befores.length === 1)
    return {
      alsoBases,
      summary: impactSummary({
        before,
        after,
        mapping,
        glossary,
        sameMeaning: confirmations(opts, before, after),
        scope,
      }),
    };
  const checks = befores.map((b) => sameMeaningKeys(opts.sameMeaning, b, after));
  for (const raw of opts.sameMeaning)
    if (
      checks.every((c) => sameMeaningKeys([raw], befores[checks.indexOf(c)], after).errors.length)
    )
      usage(`--same-meaning: ${sameMeaningKeys([raw], before, after).errors.join("; ")}`);
  const summaries = befores.map((b, i) =>
    impactSummary({ before: b, after, mapping, glossary, sameMeaning: checks[i].keys, scope }),
  );
  const union = (key) => [...new Set(summaries.flatMap((x) => x[key]))].sort();
  const unique = (key, id) => [
    ...new Map(summaries.flatMap((x) => x[key]).map((v) => [id(v), v])).values(),
  ];
  return {
    alsoBases,
    summary: {
      ...summaries[0],
      same: summaries.every((x) => x.same),
      diff: unique("diff", (e) => e.id),
      processesToPropose: union("processesToPropose"),
      directlyAffectedCategories: union("directlyAffectedCategories"),
      categoriesOfProposedProcesses: union("categoriesOfProposedProcesses"),
      affectedAdrs: union("affectedAdrs"),
      linkChanges: unique("linkChanges", (l) => `${l.category}\0${l.step}\0${l.reason}`),
      glossaryCleanup: unique("glossaryCleanup", (g) => `${g.id}\0${Boolean(g.possible)}`),
      majorChangeCandidates: unique("majorChangeCandidates", (c) => `${c.id}\0${c.change}`),
    },
  };
}

function impact(opts) {
  const current = loadModel(opts.ontologyDir);
  if (!current) return 1;
  // Draft mode compares an unapplied draft with the model; base mode compares the
  // current documents (a direct edit) with a git revision.
  let before = current.index;
  let documents;
  let base = null;
  if (opts.draft) documents = draftDocuments(opts.draft, opts.ontologyDir);
  else {
    const at = revision(opts.base, opts.ontologyDir);
    if (at.parsed.some((p) => p.errors.length))
      return fail(`the model at ${opts.base} cannot be parsed`);
    before = indexGraph(at.triples);
    base = at.commit;
    documents = current.docs.map((d) => ({ doc: rel(d.file), text: d.text }));
  }
  const { mapping, finding: mappingError } = loadMapping(opts.adrDir);
  // apply refuses an unreadable index, so the summary says so first.
  if (mappingError)
    return fail(
      `[${mappingError.code}] ${mappingError.where}: fix the ADR index before a change approval`,
    );
  const mappingDraft = draftText(opts.mappingFile, "--mapping");
  const glossaryDraft = draftText(opts.glossaryFile, "--glossary");
  let draftIndex = null;
  try {
    draftIndex = mappingDraft === null ? null : JSON.parse(mappingDraft);
  } catch (error) {
    usage(`--mapping ${opts.mappingFile} is not JSON (${error.message})`);
  }
  // The gates count a realizing feature's ADR records and the approval binds their
  // files, so a record the level cannot count stops the summary.
  const misrecorded = [mapping, draftIndex].flatMap((m) =>
    Object.entries(m?.categories ?? {})
      .filter(([, e]) => Array.isArray(e?.realizes) && e.realizes.length)
      .flatMap(
        ([key, e]) =>
          recordedAdrFiles(key, e, {
            at: (p) => path.resolve(p),
            folder: path.resolve(opts.adrDir, ...key.split("/")),
            join: path.join,
          }).problems,
      ),
  );
  if (misrecorded.length)
    return fail(
      `[ontology-adr-record-invalid] ${[...new Set(misrecorded.map((p) => p.why))].join("; ")}; fix the ADR index${draftIndex ? " or its draft" : ""} before a change approval`,
    );
  // apply refuses link records that are not lists of step ids, so the summary says so first.
  const shapes = [
    ...checkRealizes(mapping, before, rel(mappingPathOf(opts))),
    ...(draftIndex ? checkRealizes(draftIndex, before, opts.mappingFile) : []),
  ].filter((f) => f.code === "ontology-link-shape");
  if (shapes.length)
    return fail(
      `${shapes.map((f) => `[${f.code}] ${f.where}: ${f.msg}`).join("; ")}; fix the ADR index before a change approval`,
    );
  const relink = relinked(mapping, draftIndex);
  const check = validateModelChange(documents, before, mapping, opts);
  if (
    opts.process &&
    before.typeOf(elementIri(opts.process)) !== "Process" &&
    check.index?.typeOf(elementIri(opts.process)) !== "Process"
  )
    return fail(`no process "${opts.process}" in either model`);
  // apply refuses an index draft that does not resolve against the model it saves, so the
  // summary says so first.
  const unresolved =
    draftIndex && check.index
      ? checkRealizes(draftIndex, check.index, opts.mappingFile).filter((f) => f.level === "error")
      : [];
  if (unresolved.length)
    return fail(
      `${unresolved.map((f) => `[${f.code}] ${f.where}: ${f.msg}`).join("; ")}; fix the index draft before a change approval`,
    );
  // The summary judges links as the index will be after the save: the draft when there is one.
  const over = check.index
    ? summaryOverBases(opts, before, check.index, {
        mapping: draftIndex ?? mapping,
        glossary: readText(path.join(opts.adrDir, "glossary.md")),
        scope: opts.process,
      })
    : { summary: null };
  if (over.error) return fail(over.error);
  const { summary } = over;
  const rewritten =
    opts.draft && check.index ? documentsToWrite(current, check.parsed, documents) : [];
  const commented = rewritten
    .filter((w) => w.current?.parsed.comments.length)
    .map((w) => rel(w.current.file));
  const out = {
    baseHash: baseHash(opts, {
      drafts: opts.draft ? documents : [],
      adrs: [...(summary?.affectedAdrs ?? []), ...relink.adrs],
      sameMeaning: opts.sameMeaning,
      scope: opts.process,
      mappingDraft,
      glossaryDraft,
      base,
      alsoBases: over.alsoBases ?? [],
    }),
    draftValid: check.ok,
    findings: check.findings,
    commentsDroppedOnRewrite: commented,
    sameMeaning: [...opts.sameMeaning].sort(),
    ...(summary ?? {}),
    ...(summary
      ? {
          affectedAdrs: [...new Set([...summary.affectedAdrs, ...relink.adrs])].sort(),
          affectedAdrReasons: affectedAdrReasons(summary, draftIndex ?? mapping, relink),
          relinkedCategories: relink.categories,
        }
      : {}),
  };
  if (opts.json) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else {
    for (const f of check.findings)
      process.stdout.write(
        `${f.level === "error" ? "✗" : "⚠"} [${f.code}] ${f.where}\n    ${f.msg}\n`,
      );
    if (summary) {
      const say = (s) => process.stdout.write(`${s}\n`);
      // A short list stays on its line; a long one takes a line per item, so no line runs on.
      const show = (label, xs) => {
        if (xs.length <= SHORT_LIST && xs.join(", ").length <= 200)
          say(`${label}: ${xs.join(", ") || "none"}`);
        else {
          say(`${label} (${xs.length}):`);
          for (const x of xs) say(`  ${x}`);
        }
      };
      // "added 3 Step, 1 Policy; changed 2 Step": counts of a list by change, then by `key`.
      // An element whose type the model does not settle counts as "?", as `diff` shows it.
      const tally = (items, key) =>
        [...Map.groupBy(items, (x) => x.change)]
          .map(
            ([change, group]) =>
              `${change} ${[...Map.groupBy(group, key)]
                .map(([k, v]) => [k, v.length])
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .map(([k, n]) => `${n} ${k}`)
                .join(", ")}`,
          )
          .join("; ");
      if (summary.scope) say(`scope: process ${summary.scope}`);
      say(
        `semantic change: ${summary.same ? "none" : `${summary.diff.length} element(s) — ${tally(summary.diff, (e) => e.type ?? "?")}`}`,
      );
      if (out.sameMeaning.length) show("confirmed same-meaning wording", out.sameMeaning);
      show("processes that become Proposed", summary.processesToPropose);
      show("directly affected features", summary.directlyAffectedCategories);
      show("features of processes that become Proposed", summary.categoriesOfProposedProcesses);
      show("features whose index links change", out.relinkedCategories);
      show("affected ADRs", out.affectedAdrs);
      // Reasons only when they tell more than "every ADR is bound for one reason".
      const reasonKinds = new Set(Object.values(out.affectedAdrReasons).flat());
      if (reasonKinds.size > 1)
        show(
          "affected ADR reasons",
          Object.entries(out.affectedAdrReasons).map(([p, r]) => `${p} (${r.join(", ")})`),
        );
      show(
        "index links to remove or move",
        summary.linkChanges.map((l) => `${l.category} → ${l.step} (${l.reason})`),
      );
      show("system steps without a realizing feature", summary.unrealizedSystemSteps);
      show(
        "glossary entries the model would own",
        summary.glossaryCleanup.filter((g) => !g.possible).map((g) => g.term),
      );
      show(
        "glossary table cells that may define a term the model would own (ask the user)",
        summary.glossaryCleanup.filter((g) => g.possible).map((g) => g.term),
      );
      // A first build or a large edit lists every added element as a candidate: counted by
      // bounded context here, listed in full by --json.
      const candidates = summary.majorChangeCandidates;
      if (candidates.length <= SHORT_LIST)
        show(
          "change-log candidates",
          candidates.map((c) => `${c.id} (${c.change})`),
        );
      else {
        say(`change-log candidates (${candidates.length}; each one is listed by --json):`);
        for (const [context, group] of [...Map.groupBy(candidates, (c) => c.id.split(".")[0])].sort(
          ([a], [b]) => a.localeCompare(b),
        ))
          say(`  ${context}: ${tally(group, (c) => c.type ?? "?")}`);
      }
    }
    if (commented.length)
      process.stdout.write(
        `Turtle comments would be dropped on rewrite: ${commented.join(", ")}\n`,
      );
    process.stdout.write(`base hash: ${out.baseHash}\n`);
  }
  return check.ok ? 0 : 1;
}

/**
 * The model the documents leave after a save: every remaining name reads its real
 * file, so a write through one name of a file is what its other names read too.
 *
 * @returns {{triples: object[], dangling: {name: string, removed: string}[], aliases: string[]}}
 */
function savedModel(current, writes) {
  const textOf = new Map(current.docs.map((d) => [realName(d.file), d.text]));
  const names = new Map(current.docs.map((d) => [path.resolve(d.file), realName(d.file)]));
  const removedFile = new Map();
  for (const w of writes) {
    const name = path.resolve(w.file);
    if (w.text !== null) {
      const real = names.get(name) ?? realName(name);
      names.set(name, real);
      textOf.set(real, w.text);
    } else {
      // Removing a link removes that name; removing a file removes it for every name.
      if (!isLink(name)) removedFile.set(names.get(name), rel(w.file));
      names.delete(name);
    }
  }
  const dangling = [...names]
    .filter(([, real]) => removedFile.has(real))
    .map(([name, real]) => ({ name: rel(name), removed: removedFile.get(real) }));
  const byReal = Map.groupBy([...names], ([, real]) => real);
  const aliases = [...byReal.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.map(([name]) => rel(name)).join(" and "));
  const parsed = [...names].map(([name, real]) => parseTurtle(textOf.get(real) ?? "", rel(name)));
  return { triples: unionGraph(parsed), dangling, aliases };
}

/**
 * The draft documents whose graph differs from the current document they name,
 * and the current documents the draft no longer has. A draft document names the
 * current document at the same path, or — on a volume that folds letter case or
 * Unicode form — the same directory entry under another spelling, which is then
 * rewritten under its own name. A document whose graph did not change keeps its
 * text.
 */
function documentsToWrite(current, parsedDraft, documents, statusOverride = () => null) {
  const byPath = new Map(current.docs.map((d) => [rel(d.file), d]));
  const byEntry = new Map(current.docs.map((d) => [entryOf(d.file), d]));
  byEntry.delete(null);
  const key = (triples) =>
    triples
      .map((t) => `${t.s}\0${t.p}\0${termKey(t.o)}`)
      .sort()
      .join("\n");
  const out = [];
  const kept = new Set();
  parsedDraft.forEach((pd, i) => {
    const named = rel(path.join(current.dir, documents[i].doc));
    const existing = byPath.get(named) ?? byEntry.get(entryOf(named));
    const target = existing ? rel(existing.file) : named;
    const triples = pd.triples.map((t) => statusOverride(t) ?? t);
    kept.add(target);
    if (existing && key(existing.parsed.triples) === key(triples)) return;
    out.push({ file: target, text: serializeTurtle(triples), current: existing ?? null });
  });
  for (const [p, d] of byPath) if (!kept.has(p)) out.push({ file: p, text: null, current: d });
  return out;
}

/**
 * Write a change unit completely or not at all: stage every file as a temporary
 * sibling, then move them into place in the given order; if any step fails,
 * restore every file already touched. A symlinked file is written through to its
 * target, as `format` does, but removing one removes the link, never its target;
 * a document reached through a linked directory is never removed, and a unit that
 * would write one file under two names is refused.
 *
 * @param {{file: string, text: string|null}[]} ops in write order; `text: null` deletes.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
function writeUnit(ops, { modelDir = null } = {}) {
  const staged = [];
  // Where a model document is really kept: the model directory itself may be a link.
  const modelReal = modelDir ? realName(modelDir) : null;
  const ownDir = (dir) =>
    modelReal &&
    (dir === path.resolve(modelDir) || dir.startsWith(path.resolve(modelDir) + path.sep))
      ? path.join(modelReal, path.relative(path.resolve(modelDir), dir))
      : dir;
  // The index is written twice on purpose; two names of one file are not.
  const names = Map.groupBy(
    ops.filter((op) => op.text !== null),
    (op) => realName(op.file),
  );
  for (const [real, same] of names) {
    const distinct = [...new Set(same.map((op) => path.resolve(op.file)))];
    if (distinct.length > 1)
      return {
        ok: false,
        error: `${distinct.map(rel).join(" and ")} are one file (${rel(real)}); keep one of them; nothing was written`,
      };
  }
  ops = ops.map((op) =>
    op.text !== null && isLink(op.file) ? { ...op, file: realOf(op.file) ?? op.file } : op,
  );
  for (const op of ops) {
    const dir = path.dirname(path.resolve(op.file));
    if (op.text === null && !isLink(op.file) && realOf(dir) !== null && realOf(dir) !== ownDir(dir))
      return {
        ok: false,
        error: `${rel(op.file)} lives in a linked directory (${rel(realOf(dir))}); remove it there, not through the model; nothing was written`,
      };
  }
  try {
    for (const op of ops) {
      if (op.text === null) continue;
      mkdirSync(path.dirname(op.file), { recursive: true });
      const tmp = `${op.file}.tmp-${process.pid}-${staged.length}`;
      writeFileSync(tmp, op.text);
      staged.push({ op, tmp });
    }
  } catch (error) {
    for (const s of staged) rmSync(s.tmp, { force: true });
    return {
      ok: false,
      error: `staging failed (${error.code ?? error.message}); nothing was written`,
    };
  }
  const done = [];
  const tmpOf = new Map(staged.map((s) => [s.op, s.tmp]));
  try {
    for (const op of ops) {
      // A removed link is restored as the link it was.
      const original = isLink(op.file)
        ? { link: readlinkSync(op.file) }
        : existsSync(op.file)
          ? { bytes: readFileSync(op.file) }
          : null;
      if (op.text === null) {
        if (original?.link !== undefined) unlinkSync(op.file);
        else rmSync(op.file, { force: true });
      } else renameSync(tmpOf.get(op), op.file);
      done.push({ file: op.file, original });
    }
    return { ok: true };
  } catch (error) {
    const unrestored = [];
    for (const d of done.reverse()) {
      try {
        if (d.original === null) rmSync(d.file, { force: true });
        else if (d.original.link !== undefined) {
          rmSync(d.file, { force: true });
          symlinkSync(d.original.link, d.file);
        } else writeFileSync(d.file, d.original.bytes);
      } catch {
        unrestored.push(d.file); // keep restoring the others; the report names this one
      }
    }
    for (const s of staged) rmSync(s.tmp, { force: true });
    return {
      ok: false,
      error: unrestored.length
        ? `writing failed (${error.code ?? error.message}) and these files could not be restored: ${unrestored.join(", ")}`
        : `writing failed (${error.code ?? error.message}); every file already written was restored`,
    };
  }
}

function changeLogText(ontologyDir, lines, date) {
  const existing = readText(path.join(ontologyDir, CHANGE_LOG)) ?? CHANGE_LOG_HEAD;
  const at = existing.indexOf("\n- ");
  const entries = lines.map((l) => `- ${date} — ${l}\n`).join("");
  return at === -1
    ? `${existing.replace(/\n*$/, "\n\n")}${entries}`
    : `${existing.slice(0, at + 1)}${entries}${existing.slice(at + 1)}`;
}

/** Today's local calendar date as YYYY-MM-DD, whatever locale data the runtime carries. */
const today = () => {
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
};

function refuse(lines) {
  for (const l of lines) process.stdout.write(`✗ ${l}\n`);
  return 1;
}

function apply(opts) {
  // Every input is read and checked before the first write. With --base the
  // approved change is a direct edit already in the documents: the model is not
  // rewritten, and only the index, glossary and change-log changes are saved.
  const current = loadModel(opts.ontologyDir);
  if (!current) return refuse(["nothing was written: the current model cannot be parsed"]);
  const direct = !opts.draft;
  const documents = direct
    ? current.docs.map((d) => ({ doc: rel(d.file), text: d.text }))
    : draftDocuments(opts.draft, opts.ontologyDir);
  let before = current.index;
  let base = null;
  if (direct) {
    const at = revision(opts.base, opts.ontologyDir);
    if (at.parsed.some((x) => x.errors.length))
      return refuse([`nothing was written: the model at ${opts.base} cannot be parsed`]);
    before = indexGraph(at.triples);
    base = at.commit;
  }
  const mappingPath = path.join(opts.adrDir, ".mapping.json");
  const { mapping: currentMapping, finding: mappingError } = loadMapping(opts.adrDir);
  if (mappingError)
    return refuse([
      `[${mappingError.code}] ${mappingError.where}`,
      "nothing was written: fix the ADR index first",
    ]);
  let mappingText = null;
  let mapping = currentMapping;
  if (opts.mappingFile) {
    mappingText = readText(opts.mappingFile);
    if (mappingText === null)
      return refuse([`nothing was written: cannot read --mapping ${opts.mappingFile}`]);
    try {
      mapping = JSON.parse(mappingText);
    } catch (error) {
      return refuse([
        `nothing was written: --mapping ${opts.mappingFile} is not JSON (${error.message})`,
      ]);
    }
    const shape = validateMappingShape(mapping).filter((i) => i.level === "error");
    if (shape.length)
      return refuse([
        ...shape.map((i) => `[map-${i.code}] ${i.msg}`),
        "nothing was written: the index draft is invalid",
      ]);
  }
  let glossaryText = null;
  if (opts.glossaryFile) {
    glossaryText = readText(opts.glossaryFile);
    if (glossaryText === null)
      return refuse([`nothing was written: cannot read --glossary ${opts.glossaryFile}`]);
  }

  const check = validateModelChange(documents, before, mapping, opts);
  const modelErrors = check.findings.filter((f) => f.level === "error");
  if (modelErrors.length)
    return refuse([
      ...modelErrors.map((f) => `[${f.code}] ${f.where}\n    ${f.msg}`),
      "nothing was written: the approved change must leave a valid model",
    ]);
  const currentGlossary = readText(path.join(opts.adrDir, "glossary.md"));
  const over = summaryOverBases(opts, before, check.index, {
    mapping,
    glossary: currentGlossary,
    scope: direct ? opts.process : null,
  });
  if (over.error) return refuse([`nothing was written: ${over.error}`]);
  const { summary } = over;
  const hash = baseHash(opts, {
    drafts: direct ? [] : documents,
    adrs: [
      ...summary.affectedAdrs,
      ...relinked(currentMapping, opts.mappingFile ? mapping : null).adrs,
    ],
    sameMeaning: opts.sameMeaning,
    scope: direct ? opts.process : null,
    mappingDraft: mappingText,
    glossaryDraft: glossaryText,
    base,
    alsoBases: over.alsoBases,
  });
  if (hash !== opts.baseHash)
    return refuse([
      "the model, index, glossary, change log, a draft, the compared revision, an affected ADR or the same-meaning confirmations changed after the approval summary; nothing was written. Rerun impact, keep the newer edits and present only the changed range again",
    ]);

  // An approved semantic change makes every process whose business composition
  // changed Proposed; a direct edit's Status is marked by transition instead.
  const propose = new Set(direct ? [] : summary.processesToPropose);
  const proposedOverride = (t) =>
    t.p === `${ONTO}status` && propose.has(elementId(t.s)) && t.o.value !== "Proposed"
      ? { ...t, o: { ...t.o, value: "Proposed" } }
      : null;
  const proposedResult = indexGraph(
    unionGraph([
      { triples: check.parsed.flatMap((pd) => pd.triples.map((t) => proposedOverride(t) ?? t)) },
    ]),
  );
  // One history read serves the renewals and the lifecycle check below.
  const lifecycleHistory = readModelHistory(opts.ontologyDir, { mappingPath });
  // A confirmed change that keeps an Accepted process's business composition —
  // same-meaning wording or open scope only — renews its Accepted date by the rule
  // ontology sync's confirmation follows, so the confirmation is the next baseline.
  const renewed = new Set();
  const notRenewed = new Map();
  const renewedOn = `Accepted (${today()})`;
  // The renewal audit, when one runs, also carries the level the lifecycle check reuses.
  let audit = null;
  if (!direct) {
    const sameMeaning = confirmations(opts, before, check.index);
    for (const p of current.index.ofType("Process")) {
      const id = elementId(p);
      if (propose.has(id) || proposedResult.typeOf(p) !== "Process") continue;
      if (!isAccepted(proposedResult, p)) continue;
      if (processStatus(proposedResult, p) !== processStatus(current.index, p)) continue;
      if (
        sameKeys(
          compositionAndOpenScope(current.index, p),
          compositionAndOpenScope(proposedResult, p),
        )
      )
        continue;
      audit ??= renewalInputs(
        opts,
        current.index,
        [...check.findings, ...checkRealizes(mapping, proposedResult, rel(mappingPath))],
        lifecycleHistory,
      );
      const why = renewalRefusal(audit, {
        iri: p,
        from: current.index,
        to: proposedResult,
        sameMeaning,
        mapping,
        value: renewedOn,
      });
      if (why) notRenewed.set(id, why);
      else renewed.add(id);
    }
  }
  const statusOverride = (t) =>
    proposedOverride(t) ??
    (t.p === `${ONTO}status` && renewed.has(elementId(t.s))
      ? { ...t, o: { ...t.o, value: renewedOn } }
      : null);
  const finalTriples = check.parsed.flatMap((pd) => pd.triples.map((t) => statusOverride(t) ?? t));
  const result = indexGraph(unionGraph([{ triples: finalTriples }]));

  const problems = [];
  // The index that results must resolve, and keep no link to a retired process's steps.
  for (const f of checkRealizes(mapping, result, rel(mappingPath)))
    problems.push(`[${f.code}] ${f.where}\n    ${f.msg}`);
  // A concept or context the change adds or renames is never defined twice.
  const resultingGlossary = glossaryText ?? currentGlossary;
  const owned = new Set(
    summary.diff
      .filter(
        (e) =>
          (e.type === "BusinessConcept" || e.type === "BoundedContext") &&
          (e.change === "added" ||
            e.properties.some(
              (p) => p.property === "rdfs:label" || p.property === "onto:definition",
            )),
      )
      .map((e) => e.id),
  );
  // A name in a table column that may hold other content is a question for the user,
  // never a refusal: only an entry stops the save.
  const entriesOf = (text) => glossaryOverlap(text, result).filter((g) => !g.possible);
  const coexisting = new Set(entriesOf(currentGlossary).map((g) => g.id));
  for (const g of entriesOf(resultingGlossary))
    if (owned.has(g.id) || !coexisting.has(g.id))
      problems.push(
        `[ontology-glossary-overlap] the glossary would still define "${g.term}", which this change saves as ${g.type} ${g.id}; include the approved glossary cleanup (--glossary) or leave the element out`,
      );
  // Any other lifecycle change must be one Ontology Writer's transitions explain;
  // only a passing alignment review makes a process Accepted, so apply never does.
  // A direct edit that changed lifecycle attributes by hand is a lifecycle edit to
  // report, never one this save explains with its own change-log lines; ontology
  // sync's own transitions and committed reviews are judged as `lifecycle` does.
  // Whatever its scope, no save goes in with an uncommitted lifecycle edit made by
  // hand: its change-log line or index change would make that edit look approved
  // once committed. A direct-edit save also meets the committed ones history reports
  // for the processes it covers.
  // That audit compares with HEAD's model: where the repository has the model's history
  // but HEAD's model cannot be read, a hand edit cannot be told from an approved one.
  const unaudited = lifecycleUnaudited(lifecycleHistory);
  if (unaudited)
    problems.push(
      `lifecycle edits in the working tree cannot be told from approved ones: ${unaudited}; ${readableRemedy(unaudited)}, then run ontology sync before saving`,
    );
  const reported = [
    ...lifecycleEditsOf(opts, current.index, lifecycleHistory, {
      retirements: true,
      committed: false,
      level: audit?.level ?? null,
    }),
    ...(direct && lifecycleHistory.available
      ? lifecycleHistoryFindings(lifecycleHistory, (input) => alignmentPlan(input)).filter(
          (f) => !opts.process || f.element === opts.process,
        )
      : []),
  ];
  for (const f of reported)
    problems.push(
      f.code === "ontology-lifecycle-needs-approval"
        ? `[${f.code}] ${f.element}: ${f.msg} — no save includes a retirement it did not approve: commit the approved one first, or report it as a lifecycle edit made by hand`
        : `[${f.code}] ${f.element}: ${f.msg} — a lifecycle edit made by hand; report it instead of saving`,
    );
  if (!direct)
    for (const f of lifecycleFindings(current.index, result, {
      modelDir: rel(opts.ontologyDir),
      changeLogAdded: opts.logs.join("\n"),
      promotion: (q) => (renewed.has(elementId(q)) ? "holds" : undefined),
    }))
      // The renewal and an approved retirement are this save's own transitions.
      if (
        !(f.code === "ontology-lifecycle-needs-alignment" && renewed.has(f.element)) &&
        f.code !== "ontology-lifecycle-needs-approval"
      )
        problems.push(`[${f.code}] ${f.element}: ${f.msg}`);
  const writes = direct ? [] : documentsToWrite(current, check.parsed, documents, statusOverride);
  const commented = writes.filter((w) => w.current?.parsed.comments.length);
  if (commented.length && !opts.allowCommentRemoval)
    problems.push(
      `Turtle comments would be dropped (${commented.map((w) => w.file).join(", ")}); show the removal in the approval summary, then rerun with --allow-comment-removal`,
    );
  // Two names of one file hold one text, so the documents the save leaves must make
  // exactly the approved model: no kept name may lose its file, and no two names of
  // one file may be given different contents.
  if (!direct) {
    const left = savedModel(current, writes);
    if (left.dangling.length)
      problems.push(
        `removing ${left.dangling.map((d) => d.removed).join(", ")} would also remove ${left.dangling.map((d) => d.name).join(", ")}, another name of the same file; keep ${left.dangling.map((d) => d.removed).join(", ")}, the file itself, in the draft — dropping a link removes only that name`,
      );
    else if (!diffGraphs(result.triples, left.triples).same)
      problems.push(
        `the documents this save leaves would not make the approved model${left.aliases.length ? ` (${left.aliases.join("; ")} are one file each)` : ""}; give each file one name in the draft`,
      );
  }
  if (problems.length) return refuse([...problems, "nothing was written"]);

  // Write order keeps every intermediate state consistent: links first reduced to
  // steps that exist before and after, the glossary before the model, the final
  // index after it, and the change log last.
  const ops = [];
  if (opts.mappingFile) {
    const bridge = structuredClone(mapping);
    for (const entry of Object.values(bridge.categories ?? {}))
      if (Array.isArray(entry?.realizes))
        entry.realizes = entry.realizes.filter(
          (id) =>
            current.index.typeOf(elementIri(id)) === "Step" &&
            result.typeOf(elementIri(id)) === "Step",
        );
    ops.push({ file: mappingPath, text: JSON.stringify(bridge, null, 2) + "\n" });
  }
  if (opts.glossaryFile)
    ops.push({
      file: path.join(opts.adrDir, "glossary.md"),
      text: glossaryText.trim() ? glossaryText : null,
    });
  for (const w of writes.filter((x) => x.text !== null)) ops.push({ file: w.file, text: w.text });
  for (const w of writes.filter((x) => x.text === null)) ops.push({ file: w.file, text: null });
  if (opts.mappingFile) ops.push({ file: mappingPath, text: mappingText });
  if (opts.logs.length)
    ops.push({
      file: path.join(opts.ontologyDir, CHANGE_LOG),
      text: changeLogText(opts.ontologyDir, opts.logs, today()),
    });
  const written = writeUnit(ops, { modelDir: opts.ontologyDir });
  if (!written.ok) return refuse([written.error]);
  process.stdout.write(
    `✓ applied; processes this save marked Proposed: ${[...propose].sort().join(", ") || "none"}${renewed.size ? `; Accepted renewed: ${[...renewed].sort().join(", ")}` : ""}\n`,
  );
  for (const [id, why] of [...notRenewed].sort())
    process.stdout.write(`⚠ Accepted date of ${id} not renewed: ${why}\n`);
  if (!lifecycleHistory.available && lifecycleHistory.noHistory)
    process.stdout.write(
      `note: lifecycle edits in the working tree were not audited against history: ${lifecycleHistory.reason}\n`,
    );
  return 0;
}

/**
 * Why a process cannot become, or be renewed as, Accepted on `index`, or null:
 * the mechanical gates of the alignment review must hold on a valid model and
 * index, and a process whose lifecycle was edited by hand is synced first.
 *
 * @param {{index: object, mapping: object|null, id: string, errors: object[], edits: () => object[]}} input
 *   `edits` lists the lifecycle edits Ontology Writer's transitions do not explain; it is
 *   read only once the gates hold.
 */
function promotionRefusal({ index, mapping, id, errors, edits }) {
  const plan = alignmentPlan({ index, mapping, processId: id, errors });
  if (plan.blocking.length)
    return `alignment gates do not hold:\n  - ${plan.blocking.join("\n  - ")}`;
  const own = edits().filter((f) => f.element === id);
  if (own.length)
    return `"${id}" has lifecycle edits Ontology Writer's transitions do not explain; run ontology sync first:\n  - ${own.map((f) => f.msg).join("\n  - ")}`;
  return null;
}

/**
 * What both renewal paths judge against: the history (for the baseline where each
 * process last became Accepted), the validation errors of the level — for a save,
 * of the model and links it saves, with the realizing ADRs as they are — and the
 * lifecycle edits Ontology Writer's transitions do not explain.
 */
function renewalInputs(
  opts,
  workingIndex,
  savedFindings = null,
  history = readModelHistory(opts.ontologyDir, { mappingPath: mappingPathOf(opts) }),
) {
  // One read of the level serves the promotion errors and the lifecycle audit.
  const read = levelFindings(opts);
  const { findings, mapping } = read;
  const level = savedFindings
    ? [...savedFindings, ...findings.filter((f) => f.code.startsWith("ontology-adr-"))]
    : findings;
  return {
    history,
    mapping,
    level: read,
    baselines: acceptedBaselines(history),
    errors: level.filter((f) => f.level === "error"),
    edits: lifecycleEditsOf(opts, workingIndex, history, { level: read }),
  };
}

/**
 * Why an Accepted process's date cannot be renewed for a confirmed change that
 * keeps its business composition, or null when it can. The confirmation must
 * cover every change since the process last became Accepted, keep the business
 * composition under the confirmed same-meaning wording, leave the alignment gates
 * holding on a valid model and index, and meet no lifecycle edit; a confirmation
 * on the day of the current Accepted date cannot be recorded at all, nor one a
 * calendar dates before it.
 *
 * The Status may have last appeared elsewhere — on another branch, or right after
 * commits history cannot read, where a promotion or renewal may hide — so each such
 * commit is a baseline as possible as where it first appeared: ontology sync's
 * confirmation keeps the business composition against all of them, and an approved
 * save starts from a model equal to all of them.
 *
 * @param {object} inputs From `renewalInputs`.
 * @param {{iri: string, from?: object, to: object, sameMeaning: Set<string>, mapping: object|null, value: string}} change
 *   The process, the model before the save for an approved save (omitted for ontology
 *   sync, whose confirmation starts where the process became Accepted), the confirmed
 *   result, the confirmed same-meaning keys and the renewed Status value.
 */
function renewalRefusal(
  inputs,
  { iri, from, to, sameMeaning, mapping, value, unreadUnchanged = false },
) {
  const { history, baselines, errors, edits } = inputs;
  const id = elementId(iri);
  const base = baselines.get(iri);
  if (!base) {
    const reason =
      lifecycleUnaudited(history) ??
      (!history.available
        ? history.reason
        : !history.history.available
          ? history.history.reason
          : history.boundary.size
            ? "the clone is shallow; fetch more history to see edits since it became Accepted"
            : "where its Accepted Status first appeared is not in the readable history");
    return `cannot tell what changed since "${id}" became Accepted: ${reason}`;
  }
  // The user's confirmation that commits history cannot read in a row changed nothing
  // in its business composition sets their unseen composition aside.
  const confirmsRun = unreadUnchanged && (base.alternatives ?? []).some((alt) => alt.unseen);
  const hidden = (base.alternatives ?? []).filter((alt) => !(alt.unseen && confirmsRun));
  // A composition nobody can see equals no model.
  const same = (a, b) =>
    Boolean(a && b) && sameKeys(compositionAndOpenScope(a, iri), compositionAndOpenScope(b, iri));
  // A Status the working tree changed and HEAD does not hold is a confirmation or
  // review not committed yet; it becomes the baseline only once committed.
  const committed = history.head ? history.graphAt(history.head) : null;
  if (from && !same(base.graph, from))
    return committed !== null && processStatus(committed, iri) !== processStatus(from, iri)
      ? `"${id}" has edits since it became Accepted that this confirmation does not cover, and its Status changed in the working tree; commit what was already confirmed, then confirm this change`
      : `"${id}" has edits since it became Accepted that this confirmation does not cover; run ontology sync`;
  const uncovered = from && hidden.find((alt) => !same(alt.graph, from));
  if (uncovered)
    return uncovered.unseen
      ? `"${id}" may have become Accepted again inside two or more commits in a row that history cannot read, on a composition nobody can see; run ontology sync, which asks the user whether those commits changed it`
      : uncovered.gap
        ? `"${id}" may have become Accepted again behind commits history cannot read, with edits since then that this confirmation does not cover; run ontology sync`
        : `"${id}" became Accepted on more than one branch, with edits since the other acceptance that this confirmation does not cover; run ontology sync`;
  const start = from ?? base.graph;
  if (!confirmsRun && [start, ...hidden.map((alt) => alt.graph)].every((g) => same(g, to)))
    return `"${id}" has no change since it became Accepted; there is nothing to confirm`;
  const composition = (g) => businessComposition(g, iri, { sameMeaning });
  if (!sameKeys(composition(start), composition(to)))
    return `"${id}" changed its business composition since it became Accepted; confirm only open scope or same-meaning wording, or mark it Proposed`;
  const recomposed = hidden.find(
    (alt) => alt.unseen || !sameKeys(composition(alt.graph), composition(to)),
  );
  if (recomposed)
    return recomposed.unseen
      ? `"${id}" may have become Accepted again inside two or more commits in a row that history cannot read, on a composition nobody can see; if the user confirms those commits changed nothing in its business composition, renew with --unread-unchanged, or mark it Proposed for an alignment review`
      : recomposed.gap
        ? `"${id}" may have become Accepted again behind commits history cannot read, on a business composition this result changes; mark it Proposed for an alignment review`
        : `"${id}" became Accepted on more than one branch, and against the other acceptance this result changes its business composition; mark it Proposed for an alignment review`;
  const stopped = promotionRefusal({ index: to, mapping, id, errors, edits: () => edits });
  if (stopped) return stopped;
  // A calendar a day behind the one that wrote the Accepted date cannot renew it.
  const current = classifyProcessStatus(processStatus(from ?? to, iri) ?? "");
  const renewed = classifyProcessStatus(value);
  if (current.ok && renewed.ok && renewed.date < current.date)
    return `"${id}" is Accepted (${current.date}), a later day than this confirmation's ${renewed.date}; confirm it again on a later day`;
  if (processStatus(to, iri) === value)
    return committed !== null && processStatus(committed, iri) !== value
      ? `"${id}" is already ${value} in the working tree, from a confirmation not committed yet; commit it together with this edit, and the confirmation becomes the baseline`
      : `"${id}" is already ${value}; a confirmation on the day of its Accepted date cannot be recorded, so the edit stays flagged until it is confirmed again on a later day`;
  return null;
}

function transition(opts) {
  const current = loadModel(opts.ontologyDir);
  if (!current) return 1;
  const iri = elementIri(opts.process);
  if (current.index.typeOf(iri) !== "Process")
    return fail(`no process "${opts.process}" in the model`);
  const from = classifyProcessStatus(processStatus(current.index, iri));
  if (!from.ok)
    return fail(`the current Status of "${opts.process}" is invalid; fix it before a transition`);
  const to = opts.to;
  // Retirement removes or moves index links in the same change unit, so it goes
  // through an approved draft and `apply`; this command only promotes after an
  // alignment review and marks a directly edited Accepted process Proposed.
  if (to === "Deprecated" || to === "Superseded")
    return fail(
      `${to} is applied with its index-link changes and change-log line through \`apply\``,
    );
  if (to !== "Accepted" && to !== "Proposed") return fail("--to must be Accepted or Proposed");
  const renew = from.state === "Accepted" && to === "Accepted";
  if (!renew && !TRANSITIONS[from.state]?.includes(to))
    return fail(`${from.state} → ${to} is not an allowed transition`);
  const date = opts.date ?? today();
  const value = to === "Accepted" ? `Accepted (${date})` : "Proposed";
  if (!classifyProcessStatus(value).ok) return fail(`invalid date ${date}; use YYYY-MM-DD`);
  // Accepted records the day of the review or the confirmation, never a later one,
  // and a renewal never dates its confirmation before the Accepted date it renews.
  if (to === "Accepted" && date > today())
    return fail(
      `--date ${date} is later than today; Accepted records the day of its review or confirmation`,
    );
  if (renew && date < from.date)
    return fail(
      `--date ${date} is before the current Accepted date ${from.date}; a renewal records a later confirmation`,
    );
  if (renew) {
    // A confirmed edit that keeps the business composition — open scope only, or
    // wording the user confirmed keeps its meaning — renews the Accepted date.
    const inputs = renewalInputs(opts, current.index);
    const base = inputs.baselines.get(iri);
    const confirmed = base
      ? renewalConfirmations(
          opts,
          [base, ...base.alternatives].filter((c) => c.graph),
          current.index,
        )
      : { keys: new Set() };
    if (confirmed.ambiguous)
      return fail(
        `--same-meaning ${confirmed.ambiguous}: the commits where "${opts.process}" may have last become Accepted hold different texts there, so one confirmation cannot keep the meaning of each; mark it Proposed for an alignment review`,
      );
    if (opts.unreadUnchanged && !base?.alternatives?.some((alt) => alt.unseen))
      return fail(
        `--unread-unchanged confirms two or more commits in a row that history cannot read, and none lie on the way to where "${opts.process}" became Accepted`,
      );
    const why = renewalRefusal(inputs, {
      iri,
      to: current.index,
      sameMeaning: confirmed.keys,
      mapping: inputs.mapping,
      value,
      unreadUnchanged: opts.unreadUnchanged,
    });
    if (why) return fail(why);
  } else if (to === "Accepted") {
    // The caller has run the rest of the alignment review. A lifecycle edit pending
    // in the working tree stops it, and where HEAD's model cannot be read, one
    // cannot be ruled out.
    const history = readModelHistory(opts.ontologyDir, { mappingPath: mappingPathOf(opts) });
    const unaudited = lifecycleUnaudited(history);
    if (unaudited)
      return fail(
        `cannot tell whether "${opts.process}" has lifecycle edits Ontology Writer's transitions do not explain: ${unaudited}; ${readableRemedy(unaudited)} first`,
      );
    const level = levelFindings(opts);
    const { findings, mapping } = level;
    const why = promotionRefusal({
      index: current.index,
      mapping,
      id: opts.process,
      errors: findings.filter((f) => f.level === "error"),
      edits: () => lifecycleEditsOf(opts, current.index, history, { level }),
    });
    if (why) return fail(why);
    // Over a demotion not committed yet — an approved change, since a hand edit stopped
    // above — a promotion dated on or before the Accepted date HEAD holds would read,
    // once committed, as the same acceptance or a hand re-date.
    const committed = history.head ? history.graphAt(history.head) : null;
    const was = classifyProcessStatus(committed ? (processStatus(committed, iri) ?? "") : "");
    if (was.ok && was.state === "Accepted" && date <= was.date)
      return fail(
        `"${opts.process}" is Accepted (${was.date}) at HEAD and Proposed only in the working tree, so a promotion dated ${date} would not read as a new acceptance once committed; commit the approved change first, then promote`,
      );
  } else {
    // A detected direct edit: the business composition — open scope excluded —
    // differs from the last committed model or changed since the process was last Accepted.
    // One history read serves the comparison with HEAD and the change flags.
    const history = readModelHistory(opts.ontologyDir, { mappingPath: mappingPathOf(opts) });
    let changed = false;
    try {
      const head = headRevision(history) ?? graphAt("HEAD", opts.ontologyDir);
      if (!head.parsed.some((x) => x.errors.length))
        changed = !sameKeys(
          businessComposition(indexGraph(head.triples), iri),
          businessComposition(current.index, iri),
        );
    } catch {
      changed = false;
    }
    const flags = changeFlags(opts.ontologyDir, current.index, {
      mappingPath: mappingPathOf(opts),
      history,
    });
    // After commits history cannot read in a row that the user does not confirm changed
    // nothing, the process goes to an alignment review.
    if (
      !changed &&
      !(
        flags.available &&
        (flags.compositionChanged.has(opts.process) || flags.unseenRun.has(opts.process))
      )
    ) {
      // What history cannot show is unknown, never "no change".
      const unknown = !flags.available
        ? flags.reason
        : (flags.uncertain.get(opts.process) ??
          (flags.history.available ? null : flags.history.reason));
      return fail(
        unknown
          ? `cannot tell whether "${opts.process}" changed its business composition since it became Accepted: ${unknown}`
          : `"${opts.process}" has no business-composition change since it was last committed or Accepted (an open-scope edit alone changes no Status)`,
      );
    }
  }

  // Edit only the Status line so formatting and comments survive the automatic
  // transition — in every document that states it, and once for a file with two names.
  const literal = JSON.stringify(processStatus(current.index, iri));
  const stating = [
    ...new Map(
      current.docs
        .filter((d) => d.parsed.triples.some((t) => t.s === iri && t.p === `${ONTO}status`))
        .map((d) => [realName(d.file), d]),
    ).values(),
  ];
  const ops = [];
  const rewritten = new Map();
  for (const doc of stating) {
    const lines = doc.text.split("\n");
    // A Status stated twice is one fact, so every statement of it changes.
    const used = new Set();
    for (const t of doc.parsed.triples.filter((x) => x.s === iri && x.p === `${ONTO}status`)) {
      const statusAt = lines.findIndex(
        (l, i) => i >= t.line - 1 && !used.has(i) && l.includes(`onto:status ${literal}`),
      );
      if (statusAt === -1)
        return fail(
          `cannot locate the Status of "${opts.process}" in ${rel(doc.file)}; run format first`,
        );
      used.add(statusAt);
      lines[statusAt] = lines[statusAt].replace(
        `onto:status ${literal}`,
        `onto:status ${JSON.stringify(value)}`,
      );
    }
    const text = lines.join("\n");
    const reparsed = parseTurtle(text, doc.parsed.doc);
    const delta = diffGraphs(doc.parsed.triples, reparsed.triples);
    if (
      reparsed.errors.length ||
      delta.elements.length !== 1 ||
      delta.elements[0].properties.length !== 1 ||
      delta.elements[0].properties[0].property !== "onto:status"
    )
      return fail(`refusing to write: the edit changed more than the Status of "${opts.process}"`);
    rewritten.set(realName(doc.file), reparsed);
    ops.push({ file: doc.file, text });
  }
  // The documents the transition leaves state exactly the new Status and nothing else new.
  const left = indexGraph(
    unionGraph(current.docs.map((d) => rewritten.get(realName(d.file)) ?? d.parsed)),
  );
  const change = diffGraphs(current.index.triples, left.triples);
  if (
    left.literal(iri, "status").length !== 1 ||
    processStatus(left, iri) !== value ||
    change.elements.length !== 1 ||
    change.elements[0].properties.some((x) => x.property !== "onto:status")
  )
    return fail(
      `refusing to write: the model would not state exactly the Status ${JSON.stringify(value)} of "${opts.process}"`,
    );
  const written = writeUnit(ops);
  if (!written.ok) return fail(written.error);
  process.stdout.write(`✓ ${opts.process}: ${from.state} → ${value}\n`);
  return 0;
}

/**
 * Lifecycle changes of the working tree against a base model, plus — when the
 * history is given — the audit of the change that produced each committed
 * process's lifecycle state. A promotion or renewal in the working tree is judged
 * by the gates on the model it produced; one whose gates hold is the warning a
 * promotion always is.
 *
 * @param {object} opts CLI options.
 * @param {object} workingIndex The working-tree model.
 * @param {object} before The base model.
 * @param {string} baseLog The change log at the base.
 * @param {object|null} history From `readModelHistory`, for the audit against HEAD.
 * @param {{committed?: boolean, historyAudit?: object|null, level?: object|null}} [options]
 *   `committed: false` leaves the history audit out; `historyAudit` is one
 *   `lifecycleHistoryAudit` already run; `level` is `levelFindings` already read in this
 *   command, with nothing written since.
 */
function lifecycleAudit(
  opts,
  workingIndex,
  before,
  baseLog,
  history,
  { committed = true, historyAudit = null, level: known = null } = {},
) {
  const added = addedLines(readText(path.join(opts.ontologyDir, CHANGE_LOG)) ?? "", baseLog);
  const { findings: level, mapping } = known ?? levelFindings(opts);
  const errors = level.filter((f) => f.level === "error");
  const promotion = (p) =>
    alignmentPlan({ index: workingIndex, mapping, processId: elementId(p), errors }).blocking
      ?.length
      ? "fails"
      : "holds";
  return [
    ...lifecycleFindings(before, workingIndex, {
      modelDir: rel(opts.ontologyDir),
      changeLogAdded: added,
      acceptedBaseline: history?.available ? acceptedBaselines(history) : null,
      promotion,
    }),
    ...(committed && history?.available
      ? (historyAudit?.findings ??
        lifecycleHistoryFindings(history, (input) => alignmentPlan(input)))
      : []),
  ];
}

/**
 * The lifecycle errors Ontology Writer's transitions do not explain, as `lifecycle`
 * reports them against HEAD: committed history and the uncommitted change.
 */
function lifecycleEditsOf(
  opts,
  workingIndex,
  history = readModelHistory(opts.ontologyDir, { mappingPath: mappingPathOf(opts) }),
  { retirements = false, committed = true, level = null } = {},
) {
  if (!history.available) return [];
  const head = history.head ? history.graphAt(history.head) : indexGraph([]);
  if (!head) return [];
  const baseLog = history.head ? history.changeLogAt(history.head) : "";
  // With `retirements`, an uncommitted retirement no approved save is known to have made
  // too; with `committed: false`, only the uncommitted change against HEAD.
  return lifecycleAudit(opts, workingIndex, head, baseLog, history, { committed, level }).filter(
    (f) => f.level === "error" || (retirements && f.code === "ontology-lifecycle-needs-approval"),
  );
}

/** What makes HEAD's model readable to history again, for the reason it is not. */
function readableRemedy(reason) {
  if (/not available locally/.test(reason)) return "fetch the missing objects (git fetch)";
  if (
    /links outside the repository|submodule|links to .* which the commit does not hold/.test(reason)
  )
    return "keep the model's documents and its change log in this repository, committed — no link out of it or to an untracked or ignored file, no submodule";
  return "commit a model whose documents parse";
}

/**
 * Why the working tree's lifecycle edits cannot be audited against HEAD, or null.
 * A model the repository holds no history of has nothing to compare with.
 */
function lifecycleUnaudited(history) {
  if (!history.available) return history.noHistory ? null : history.reason;
  if (!history.head || history.graphAt(history.head)) return null;
  return history.headSkipped.length
    ? history.headSkipped.map((s) => s.reason).join("; ")
    : "the committed model cannot be parsed";
}

function fail(msg) {
  process.stdout.write(`✗ ${msg}\n`);
  return 1;
}

function changes(opts) {
  const current = loadModel(opts.ontologyDir);
  if (!current) return 1;
  const flags = changeFlags(opts.ontologyDir, current.index, { mappingPath: mappingPathOf(opts) });
  const out = flags.available
    ? {
        available: true,
        uncommitted: [...flags.uncommitted].sort(),
        uncommittedChanges: [...flags.uncommitted]
          .sort()
          .map((id) => ({ id, change: flags.uncommittedKinds.get(id) })),
        ...(flags.history.available ? {} : { committedUnavailable: flags.history.reason }),
        ...(flags.uncommittedDocuments ? { uncommittedDocuments: flags.uncommittedDocuments } : {}),
        unsyncedUnknown: [...flags.uncertain.entries()]
          .sort()
          .map(([p, reason]) => ({ process: p, reason })),
        lifecycleEdits: [...flags.lifecycleEdits.entries()]
          .sort()
          .map(([p, list]) => ({ process: p, findings: list.map((f) => f.msg) })),
        unsyncedAccepted: [...flags.unsynced.entries()].sort().map(([p, changed]) => ({
          process: p,
          since: flags.since.get(p),
          ...(flags.alsoSince.has(p) ? { alsoSince: flags.alsoSince.get(p) } : {}),
          ...(flags.sinceUncertain.has(p)
            ? { lastAcceptedUncertain: flags.sinceUncertain.get(p) }
            : {}),
          compositionChanged: flags.compositionChanged.has(p),
          elements: [...changed].sort(),
          changes: [...changed]
            .sort()
            .map((id) => ({ id, change: flags.unsyncedKinds.get(p)?.get(id) })),
        })),
      }
    : { available: false, reason: flags.reason };
  if (opts.json) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else if (!out.available) process.stdout.write(`change flags unavailable: ${out.reason}\n`);
  else {
    if (out.uncommittedDocuments)
      process.stdout.write(
        `uncommitted model documents differ from HEAD: ${out.uncommittedDocuments.join(", ") || "none"}\n`,
      );
    else
      process.stdout.write(
        `uncommitted model edits: ${out.uncommittedChanges.map((c) => `${c.id} (${c.change})`).join(", ") || "none"}\n`,
      );
    for (const u of out.unsyncedAccepted)
      process.stdout.write(
        `Accepted process ${u.process} edited since ${u.since.slice(0, 12)} (${flags.sinceAfterUnread.has(u.process) ? "right after commits history cannot read, where its Status may have appeared" : "where its Status appeared"})${u.alsoSince ? `, and since ${u.alsoSince.map((c) => c.slice(0, 12)).join(", ")}, where it may have last appeared too` : ""}${u.compositionChanged ? "" : " — open scope only"}: ${u.changes.map((c) => `${c.id} (${c.change})`).join(", ")}\n`,
      );
    if (out.committedUnavailable)
      process.stdout.write(`committed-edit flags unavailable: ${out.committedUnavailable}\n`);
    for (const u of out.unsyncedUnknown)
      process.stdout.write(
        `edits of Accepted process ${u.process} since it became Accepted are unknown: ${u.reason}\n`,
      );
    if (!out.unsyncedAccepted.length && !out.unsyncedUnknown.length && !out.committedUnavailable)
      process.stdout.write("no unsynced direct edits of Accepted processes\n");
    for (const l of out.lifecycleEdits)
      process.stdout.write(`lifecycle edit of ${l.process}: ${l.findings.join(" | ")}\n`);
  }
  // Clean only when every flag could be judged and none is set.
  return !out.available ||
    out.uncommitted.length ||
    out.uncommittedDocuments?.length ||
    out.unsyncedAccepted.length ||
    out.lifecycleEdits.length ||
    out.unsyncedUnknown.length ||
    out.committedUnavailable
    ? 1
    : 0;
}

function align(opts) {
  const current = loadModel(opts.ontologyDir);
  if (!current) return 1;
  const { findings, mapping } = levelFindings(opts);
  const plan = alignmentPlan({
    index: current.index,
    mapping,
    processId: opts.process,
    together: opts.together,
    errors: findings.filter((f) => f.level === "error"),
  });
  if (plan.error) return fail(plan.error);
  if (opts.json) process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
  else {
    process.stdout.write(`Alignment plan — ${plan.process.id} [${plan.process.status}]\n`);
    for (const b of plan.blocking) process.stdout.write(`✗ ${b}\n`);
    for (const c of plan.compliance)
      process.stdout.write(
        `compliance ${c.kind} ${c.event ?? c.policy ?? c.rule}: look in ${c.categories.join(", ") || "(no realizing feature)"}\n`,
      );
    for (const c of plan.criteria)
      process.stdout.write(
        `criterion ${c.criterion}: run ${[...c.processSystemSteps, ...c.run].map((s) => s.step).join(", ") || "—"}; deferred ${c.deferred.map((s) => s.step).join(", ") || "—"}; inputs for outside-system ${c.outsideSystem.map((s) => s.step).join(", ") || "—"}${c.executesNoSystemStep ? " — executes no system step: unverifiable" : ""}\n`,
      );
    for (const h of plan.handoffs)
      process.stdout.write(
        `hand-off ${h.event} ${h.from} → ${h.to}: ${h.execute ? "execute now" : `deferred until ${h.counterpart} is verified`} (criteria ${h.criteria.join(", ") || "none"})\n`,
      );
  }
  return plan.blocking.length ? 1 : 0;
}

function lifecycle(opts) {
  const current = loadModel(opts.ontologyDir);
  if (!current) return 1;
  // With the default base, history also shows the change that produced each
  // committed process's lifecycle state, and where its Accepted Status appeared; its
  // read of HEAD is the base wherever it read all of HEAD.
  const audit = opts.base === "HEAD";
  const history = audit
    ? readModelHistory(opts.ontologyDir, { mappingPath: mappingPathOf(opts) })
    : null;
  const before = headRevision(history) ?? revision(opts.base, opts.ontologyDir);
  if (before.parsed.some((p) => p.errors.length))
    return fail(`the model at ${opts.base} cannot be parsed`);
  // The base's change log, read through the model directory's links as its documents are.
  const baseLog = before.changeLog;
  // One audit of history serves the findings and the note on what it could not judge.
  const historyAudit = history?.available
    ? lifecycleHistoryAudit(history, (input) => alignmentPlan(input))
    : null;
  const findings = lifecycleAudit(
    opts,
    current.index,
    indexGraph(before.triples),
    baseLog,
    history,
    { historyAudit },
  );
  // What the history audit could not judge is said, never read as clean.
  const note = !audit
    ? null
    : !history.available
      ? history.reason
      : !history.history.available
        ? history.history.reason
        : null;
  // What the audit could not judge is named per process.
  const limits = [];
  if (audit && !note) {
    if (history.boundary.size)
      limits.push("the clone is shallow; lifecycle changes before its first commit are not judged");
    for (const u of historyAudit?.unjudged ?? []) limits.push(`${u.process}: ${u.reason}`);
  }
  const limited = limits.length ? [...new Set(limits)].join("; ") : null;
  if (opts.json)
    process.stdout.write(
      JSON.stringify(
        {
          base: opts.base,
          findings,
          ...(note ? { historyUnavailable: note } : {}),
          ...(limited ? { historyLimited: limited } : {}),
        },
        null,
        2,
      ) + "\n",
    );
  else {
    if (note) process.stdout.write(`history not audited: ${note}\n`);
    if (limited) process.stdout.write(`history audit limited: ${limited}\n`);
    if (!findings.length)
      process.stdout.write(
        `✓ no unexplained lifecycle change against ${opts.base}${limited ? " among the changes history could judge" : ""}\n`,
      );
    for (const f of findings)
      process.stdout.write(
        `${f.level === "error" ? "✗" : "⚠"} [${f.code}] ${f.where} ${f.element}\n    ${f.msg}\n`,
      );
  }
  return findings.some((f) => f.level === "error") ? 1 : 0;
}

function view(opts) {
  const { model, findings, index, mapping } = levelFindings(opts);
  if (!model) {
    process.stdout.write(`no ontology in ${opts.ontologyDir}; no view was created\n`);
    return 1;
  }
  const html = renderView({
    index,
    mapping,
    findings,
    changes: index
      ? changeFlags(opts.ontologyDir, index, { mappingPath: mappingPathOf(opts) })
      : null,
    includeRetired: opts.includeRetired,
    lang: opts.lang === "ko" ? "ko" : "en",
  });
  const run = allocateRunDirectory(process.cwd(), "ontology-view");
  const file = path.resolve(run.dir, "ontology-view.html");
  writeFileSync(file, html);
  if (run.note) process.stdout.write(`note: ${run.note}\n`);
  if (!opts.open) {
    process.stdout.write(`NOT_OPENED ${file} — opening was not requested\n`);
    return 0;
  }
  const result = openReviewReport(file, { browser: opts.browser });
  process.stdout.write(
    result.opened ? `OPENED ${file}\n` : `NOT_OPENED ${file} — ${result.reason}\n`,
  );
  return 0;
}

const opts = parseArgs(process.argv.slice(2));
// The exit code, not an exit: a pipe still receiving the output would be cut off.
process.exitCode = {
  validate,
  format,
  diff,
  query,
  impact,
  changes,
  apply,
  transition,
  align,
  lifecycle,
  view,
  help: () => {
    process.stdout.write(usageText());
    return 0;
  },
}[opts.command](opts);
