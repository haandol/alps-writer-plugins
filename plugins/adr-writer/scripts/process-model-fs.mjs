// process-model-fs.mjs — filesystem side of the business process model level:
// find the model documents, read them, and collect the model and ADR-index
// findings that adr-structure-lint and the process-model CLI report. The pure
// checks live in process-model-lib.mjs.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { bodyStatus, isAdrFile } from "./adr-lint-lib.mjs";
import { alignmentPlan } from "./process-model-align.mjs";
import {
  addedLines,
  businessComposition,
  checkRealizes,
  compositionAndOpenScope,
  diffGraphs,
  elementId,
  elementIri,
  glossaryOverlap,
  indexGraph,
  isAccepted,
  isRetired,
  lifecycleFindings,
  modelReferenceHits,
  openScopeKeys,
  parseDocument,
  parseTurtle,
  processStatus,
  sameKeys,
  unionGraph,
  validateModel,
} from "./process-model-lib.mjs";

/**
 * List the Turtle documents of a model directory, recursively and sorted.
 * Symbolic links are followed (a directory link once), and a dangling `.ttl`
 * link is listed so that reading it reports the failure. Other files (a
 * change log, notes) are not part of the model.
 *
 * @param {string} processDir Model directory, usually docs/process.
 * @returns {string[]} absolute paths; empty when the directory is absent.
 */
export function findModelDocuments(processDir) {
  const out = [];
  const seen = new Set();
  const walk = (dir) => {
    try {
      const real = realpathSync(dir);
      if (seen.has(real)) return;
      seen.add(real);
    } catch {
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      let kind = e.isDirectory() ? "dir" : e.isFile() ? "file" : null;
      if (e.isSymbolicLink()) {
        try {
          const target = statSync(full);
          kind = target.isDirectory() ? "dir" : target.isFile() ? "file" : null;
        } catch {
          kind = "file"; // dangling: reading it reports the failure
        }
      }
      if (kind === "dir") walk(full);
      else if (kind === "file" && e.name.endsWith(".ttl")) out.push(full);
    }
  };
  walk(processDir);
  return out.sort();
}

/** True when the repository has a business process model: one or more Turtle documents. */
export function hasModel(processDir) {
  return findModelDocuments(processDir).length > 0;
}

/**
 * Read one model document as strict UTF-8. A document that cannot be read or
 * decoded comes back with `unreadable` and the position of the failure, so
 * validation reports it instead of judging a lossy decoding.
 *
 * @returns {{text: string, unreadable?: {line: number, col: number, message: string}}}
 */
export function readDocument(file) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch (error) {
    return {
      text: "",
      unreadable: {
        line: 1,
        col: 1,
        message: `cannot read the document: ${error.code ?? error.message}`,
      },
    };
  }
  return decodeDocument(bytes);
}

/** A document's bytes as strict UTF-8; an invalid byte is located exactly. */
function decodeDocument(bytes) {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    const before = new TextDecoder("utf-8")
      .decode(bytes.subarray(0, firstInvalidUtf8(bytes)))
      .split("\n");
    return {
      text: "",
      unreadable: {
        line: before.length,
        col: before.at(-1).length + 1,
        message: "the document is not valid UTF-8",
      },
    };
  }
}

/** Offset of the first byte that does not start or continue a valid UTF-8 sequence. */
function firstInvalidUtf8(bytes) {
  const strict = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const len =
      b < 0x80
        ? 1
        : b >= 0xc2 && b < 0xe0
          ? 2
          : b >= 0xe0 && b < 0xf0
            ? 3
            : b >= 0xf0 && b < 0xf5
              ? 4
              : 0;
    if (!len || i + len > bytes.length) return i;
    try {
      strict.decode(bytes.subarray(i, i + len));
    } catch {
      return i;
    }
    i += len;
  }
  return bytes.length;
}

/**
 * Read every model document as `{doc, text}` with a repository-relative label.
 *
 * @param {string} processDir Model directory.
 * @param {(p: string) => string} rel Converts an absolute path to the label used in findings.
 */
export function readModelDocuments(processDir, rel) {
  return findModelDocuments(processDir).map((file) => ({
    doc: rel(file),
    ...readDocument(file),
  }));
}

/**
 * The ADR files a realizing feature's index records name, and why the alignment
 * gates cannot count a record: no list of records, a record without a path, or a
 * path that is not an ADR file (`NNNN-*.md`) of the feature's own folder. The one
 * statement of that rule, for the level's findings, history and the change approval
 * that binds those files.
 *
 * @param {string} key The feature's category key.
 * @param {object} entry Its index entry.
 * @param {{at: (p: string) => string, folder: string, join: (dir: string, name: string) => string}} where
 *   The location of a path the index records, the feature's folder, and how a folder
 *   and a name make a location.
 * @returns {{files: {record: object, file: string}[], problems: {where: string, why: string}[]}}
 */
export function recordedAdrFiles(key, entry, { at, folder, join }) {
  if (!Array.isArray(entry?.adrs))
    return {
      files: [],
      problems: [
        {
          where: key,
          why:
            entry?.adrs === undefined
              ? `realizing feature "${key}" has no ADR records`
              : `the ADR records of realizing feature "${key}" are not a list`,
        },
      ],
    };
  const files = [];
  const problems = [];
  for (const record of entry.adrs) {
    if (typeof record?.path !== "string" || !record.path) {
      problems.push({
        where: key,
        why: `realizing feature "${key}" has an ADR record without a path`,
      });
      continue;
    }
    const file = at(record.path);
    if (join(folder, path.basename(file)) === file && isAdrFile(path.basename(file)))
      files.push({ record, file });
    else
      problems.push({
        where: record.path,
        why: `the index records "${record.path}" for realizing feature "${key}", which is not an ADR file of its folder`,
      });
  }
  return { files, problems };
}

/**
 * Findings about the ADR records of realizing features, which the alignment gates
 * count. A record counts only when it names an ADR file (`NNNN-*.md`) of its
 * feature's own folder that can be read, whose body states the record's Status and
 * cites no model element; every ADR file of that folder needs a record of the
 * feature itself. The same
 * rules hold in the working tree and at a commit history judges, through the
 * location and file readers given.
 *
 * @param {object} input
 * @param {Record<string, object>} input.categories The index categories.
 * @param {object} input.index The model whose element identifiers an ADR must not cite.
 * @param {(key: string) => boolean} input.inScope
 * @param {(p: string) => string} input.at The location of a path the index records.
 * @param {(key: string) => string} input.folderOf The location of a feature's folder.
 * @param {(dir: string, name: string) => string} input.join
 * @param {(file: string) => string|null} input.read A file's text, or null when it cannot be read.
 * @param {(dir: string) => string[]} input.list The entry names of a folder.
 * @param {(location: string) => string} input.label How a finding names a location.
 * @param {(file: string, target: string) => boolean} input.inModel Whether a relative
 *   link in an ADR file leads into the model directory.
 */
export function adrRecordFindings({
  categories,
  index,
  inScope,
  at,
  folderOf,
  join,
  read,
  list,
  label,
  inModel,
}) {
  const findings = [];
  for (const [key, entry] of Object.entries(categories)) {
    if (!Array.isArray(entry?.realizes) || !entry.realizes.length || !inScope(key)) continue;
    const folder = folderOf(key);
    const { files, problems } = recordedAdrFiles(key, entry, { at, folder, join });
    for (const { where, why } of problems)
      findings.push({
        level: "error",
        code: "process-adr-record-invalid",
        where,
        element: null,
        category: key,
        msg: `${why}; the alignment gates count only records that name an ADR file of the feature's own folder`,
      });
    if (!Array.isArray(entry.adrs)) continue;
    // The gates count index records; a record without its file, or a file of the
    // feature without a record, makes that count untrustworthy.
    for (const { record: rec, file } of files) {
      const body = read(file);
      if (body === null) {
        findings.push({
          level: "error",
          code: "process-adr-missing",
          where: rec.path,
          element: null,
          category: key,
          msg: `the index lists realizing ADR "${rec.path}", which cannot be read; the alignment gates cannot trust the index until it lists the feature's ADR files`,
        });
        continue;
      }
      for (const hit of modelReferenceHits(body, index, {
        inModel: (target) => inModel(file, target),
      }))
        findings.push({
          level: "error",
          code: "process-adr-identifier",
          where: `${rec.path}:${hit.line}`,
          element: null,
          msg: `realizing ADR body cites the process model (${hit.text}); write the business meaning in the ADR and keep the step link in .mapping.json "realizes"`,
        });
      // The alignment gates read the index; a body that says otherwise makes it untrustworthy.
      const stated = bodyStatus(body).value;
      if (stated !== String(rec.status ?? "").trim())
        findings.push({
          level: "error",
          code: "process-adr-status-mismatch",
          where: rec.path,
          element: null,
          category: key,
          msg: `realizing ADR's Status "${stated ?? ""}" differs from its index record "${rec.status ?? ""}"; the alignment gates cannot trust either until they agree (change Status only with adr-status-transition.mjs)`,
        });
    }
    // The gates count this feature's records, so each ADR file of its folder needs one.
    const listed = new Set(
      entry.adrs.filter((r) => typeof r?.path === "string").map((r) => at(r.path)),
    );
    for (const name of list(folder).filter(isAdrFile).sort())
      if (!listed.has(join(folder, name)))
        findings.push({
          level: "error",
          code: "process-adr-unindexed",
          where: label(join(folder, name)),
          element: null,
          category: key,
          msg: `ADR file ${label(join(folder, name))} of realizing feature "${key}" is not in the index; the alignment gates cannot count its Status until it is registered`,
        });
  }
  return findings;
}

/**
 * Collect the process-level findings for a repository: model validation, index
 * links, model references inside realizing ADR bodies and glossary terms the
 * model owns. Returns no findings at all when the repository has neither model
 * documents nor `realizes` links, so a repository without a model is untouched.
 *
 * @param {object} options
 * @param {string} options.processDir Model directory.
 * @param {string} options.adrRoot ADR root directory.
 * @param {object|null} options.mapping Parsed .mapping.json, if any.
 * @param {string} options.mappingPath Label for index findings.
 * @param {(p: string) => string} options.rel Absolute path → repository-relative label.
 * @param {(key: string) => boolean} [options.inScope] Category filter for index findings.
 * @param {string} [options.cwd] Repository directory ADR paths are relative to (default: the process cwd).
 * @returns {{model: boolean, findings: object[], index: object|null}}
 */
export function processLevelFindings({
  processDir,
  adrRoot,
  mapping,
  mappingPath,
  rel,
  inScope = () => true,
  cwd = process.cwd(),
}) {
  const documents = readModelDocuments(processDir, rel);
  const categories = mapping?.categories ?? {};
  const linked = Object.entries(categories).filter(
    ([, e]) => Array.isArray(e?.realizes) && e.realizes.length,
  );
  if (!documents.length && !linked.length) return { model: false, findings: [], index: null };

  const findings = [];
  let index = null;
  if (documents.length) {
    const result = validateModel(documents, { categoryKeys: Object.keys(categories) });
    findings.push(...result.findings);
    index = result.index;
  }
  // Index links are judged only against a model that parsed; a parse failure
  // already fails above and would turn every link into noise.
  if (!documents.length || index) {
    const scoped = {
      categories: Object.fromEntries(Object.entries(categories).filter(([k]) => inScope(k))),
    };
    findings.push(...checkRealizes(scoped, index, mappingPath));
  }
  if (index) {
    findings.push(
      ...adrRecordFindings({
        categories,
        index,
        inScope,
        at: (p) => path.resolve(cwd, p),
        folderOf: (key) => path.resolve(cwd, adrRoot, ...key.split("/")),
        join: path.join,
        read: (file) => {
          try {
            return readFileSync(file, "utf8");
          } catch {
            return null;
          }
        },
        list: (dir) => {
          try {
            return readdirSync(dir);
          } catch {
            return [];
          }
        },
        label: rel,
        inModel: (file, target) =>
          linksInto(path.resolve(path.dirname(file), target), path.resolve(cwd, processDir), {
            fold: foldsAt(path.resolve(cwd, processDir)),
            sep: path.sep,
          }),
      }),
    );
    let glossary = null;
    try {
      if (statSync(path.join(adrRoot, "glossary.md")).isFile())
        glossary = readFileSync(path.join(adrRoot, "glossary.md"), "utf8");
    } catch {
      glossary = null;
    }
    for (const o of glossaryOverlap(glossary, index))
      findings.push(
        o.possible
          ? {
              level: "warn",
              code: "process-glossary-mention",
              where: rel(path.join(adrRoot, "glossary.md")),
              element: o.id,
              msg: `the glossary names the business term "${o.term}" (${o.type}) in a table column that may hold other content; ask the user whether it defines the term there, and if it does, clean it up through the model's change approval`,
            }
          : {
              level: "warn",
              code: "process-glossary-overlap",
              where: rel(path.join(adrRoot, "glossary.md")),
              element: o.id,
              msg: `the process model owns the business term "${o.term}" (${o.type}); remove the glossary entry — or reword it where it only groups or details other terms — through the model's change approval`,
            },
      );
  }
  return { model: documents.length > 0, findings, index };
}

// ── repository history: uncommitted edits, unsynced Accepted processes and ──
// ── the lifecycle changes that produced the current Status ─────────────────
// A query runs on every change, so history is read with a bounded number of git
// processes: a log of the commits that changed the model, the ADR index or what
// their links pass through and lead to (merges included, simplified by git to the
// commits that explain the current content; repeated only while links reveal new
// paths), a log of the links on the way to the model directory and the index, and
// batched object reads — plus a few reads for each commit whose promotion it judges,
// to see that commit's realizing ADR files. Lazy fetching is
// disabled, and every transport is refused through configuration that git has
// honored since before partial clones existed, so a partial clone with missing
// objects reports the history as unavailable instead of reaching the network,
// whatever the git version.

const NO_NETWORK = ["", ".file", ".git", ".http", ".https", ".ssh", ".ext"].map(
  (p) => `'protocol${p}.allow=never'`,
);
// Settings that change what git prints: a signature check before each commit of a
// log, and quoted non-ASCII paths in a raw log. (Submodule lines a raw log leaves out
// are the layout log's `--ignore-submodules=none`, which also overrides a submodule's
// own ignore setting.)
const PLAIN_OUTPUT = ["'log.showSignature=false'", "'core.quotePath=false'"];
export const GIT_ENV = {
  // An inherited pathspec mode would change what every path history asks for matches.
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^GIT_(LITERAL|GLOB|NOGLOB|ICASE)_PATHSPECS$/.test(key),
    ),
  ),
  GIT_NO_LAZY_FETCH: "1",
  GIT_TERMINAL_PROMPT: "0",
  // An inherited allow list would override the refusal below; an empty one allows nothing.
  GIT_ALLOW_PROTOCOL: "",
  GIT_CONFIG_PARAMETERS: [process.env.GIT_CONFIG_PARAMETERS, ...NO_NETWORK, ...PLAIN_OUTPUT]
    .filter(Boolean)
    .join(" "),
};
const GIT_BUFFER = 256 * 1024 * 1024;

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: GIT_ENV,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: GIT_BUFFER,
  });
}

/** The blob ids of the ADR index as each read commit resolves it. */
function indexIdsOf(indexOf) {
  return [...indexOf.values()]
    .filter((r) => r?.entry && r.entry.mode !== "40000")
    .map((r) => r.entry.id);
}

/**
 * Read objects named by `<rev>:<path>` or object id in one `git cat-file --batch`; missing
 * ones are null. With `exact`, every spec must be an object id answered by itself and the
 * answers must fill the output exactly; otherwise it throws, as when git fails.
 */
function catObjects(specs, cwd, { exact = false } = {}) {
  const out = new Map();
  const unique = [...new Set(specs)];
  if (!unique.length) return out;
  const raw = execFileSync("git", ["cat-file", "--batch"], {
    cwd,
    input: unique.join("\n") + "\n",
    env: GIT_ENV,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: GIT_BUFFER,
  });
  let at = 0;
  for (const spec of unique) {
    const nl = raw.indexOf(10, at);
    const header = raw.subarray(at, nl).toString("utf8");
    at = nl + 1;
    const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(header);
    if (!m) {
      out.set(spec, null); // "<spec> missing": absent path or an object not available locally
      continue;
    }
    const size = Number(m[3]);
    if (exact && m[1] !== spec) throw new Error("git cat-file answered another object");
    out.set(spec, { id: m[1], type: m[2], data: raw.subarray(at, at + size) });
    at += size + 1;
  }
  // An object shorter than its header says shifts every later answer.
  if (exact && at !== raw.length) throw new Error("git cat-file output did not match its sizes");
  return out;
}

/** Entries of a raw git tree object. */
function treeEntries(data, idBytes) {
  const entries = [];
  for (let i = 0; i < data.length; ) {
    const space = data.indexOf(32, i);
    const nul = data.indexOf(0, space);
    entries.push({
      mode: data.subarray(i, space).toString("utf8"),
      name: data.subarray(space + 1, nul).toString("utf8"),
      id: data.subarray(nul + 1, nul + 1 + idBytes).toString("hex"),
    });
    i = nul + 1 + idBytes;
  }
  return entries;
}

/**
 * A symbolic link's absolute target as a repository path, or null when it lies
 * outside the repository. The longest existing part of the target is resolved, so
 * a link written through another name of the same directory still counts.
 */
function repositoryPath(target, top) {
  const tail = [];
  for (let probe = path.resolve(target); ; probe = path.dirname(probe)) {
    let real = null;
    try {
      real = realpathSync(probe);
    } catch {
      real = null;
    }
    if (real !== null) {
      const inside = path.relative(top, path.join(real, ...tail));
      return !inside || inside.startsWith("..") || path.isAbsolute(inside)
        ? null
        : inside.split(path.sep).join("/");
    }
    if (path.dirname(probe) === probe) return null;
    tail.unshift(path.basename(probe));
  }
}

const folding = new Map();
/** Whether the volume holding the work tree reads two spellings of a name as one entry. */
function foldsNames(top) {
  if (!folding.has(top))
    folding.set(top, existsSync(path.join(top, ".git")) && existsSync(path.join(top, ".GIT")));
  return folding.get(top);
}

/**
 * Whether the volume holding a path reads two spellings of a name as one entry, asked
 * of its nearest folder that exists; false where no folder name has a letter to flip.
 */
function foldsAt(p) {
  for (let at = path.resolve(p); path.dirname(at) !== at; at = path.dirname(at)) {
    if (!existsSync(at)) continue;
    const name = path.basename(at);
    const other = name === name.toUpperCase() ? name.toLowerCase() : name.toUpperCase();
    if (other !== name) return existsSync(path.join(path.dirname(at), other));
  }
  return false;
}

/**
 * Whether a link's resolved path leads into the model directory, by path — the one
 * rule the working tree and history apply to a realizing ADR's links. On a volume
 * that folds names, letter case and Unicode form do not matter.
 */
function linksInto(to, dir, { fold, sep }) {
  const name = (p) => (fold ? p.normalize("NFC").toLowerCase() : p);
  return name(to) === name(dir) || name(to).startsWith(`${name(dir)}${sep}`);
}

/**
 * Resolve repository paths inside commits the way a work tree's file system does:
 * every component that is a symbolic link is followed from the directory that
 * really holds it (an absolute link into the repository is a repository path), at
 * most 40 links per path. Trees and link texts are read in batches every request
 * shares.
 *
 * @param {string} top Repository top level.
 * @param {{commit: string, path: string}[]} requests Repository paths without `..`.
 * @param {{trees: Map<string, object[]>, idBytes: number, fold?: boolean}} cache Tree
 *   entries by id, and whether names match as the volume matches them (`foldsNames`).
 * @returns {{entry: {mode: string, id: string}|null, path: string, via: string[], reason?: string, kind?: "outside"|"unreadable"|"submodule", dangling?: boolean}[]}
 *   per request, in order: the tree entry the path leads to (null when the commit
 *   does not hold it), its resolved path and the links passed on the way; `reason`
 *   and `kind` when it leads where history cannot read (out of the repository, into a
 *   submodule) or nobody can (`unreadable`: round a loop of links, or through a file);
 *   `dangling` when a link on the way leads to a path
 *   the commit does not hold (an untracked or ignored file the work tree may have).
 */
function resolveInTrees(top, requests, cache) {
  const { trees, idBytes, fold = false } = cache;
  // On a volume that folds letter case and Unicode form, a link names an entry the
  // way the file system matches it, not the way git stores it.
  const same = (a, b) =>
    a === b || (fold && a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase());
  // Root trees and link texts, like trees, never change for an object id: a cache the
  // caller keeps across reads serves them again.
  const roots = (cache.roots ??= new Map());
  const texts = (cache.texts ??= new Map());
  const split = (p) => p.split("/").filter((x) => x && x !== ".");
  const commits = [...new Set(requests.map((r) => r.commit))].filter((c) => !roots.has(c));
  // The trees on the way to each path of a commit read for the first time ride along with
  // its root tree, shallowest first as the walk below reads them, so a path costs one
  // batch instead of one per level. Git names them without following links; a name it
  // cannot resolve that way is missing and is walked below, as is a name holding a line
  // break, which the batch's one name per line cannot carry. A tree is the same object
  // whichever name read it.
  const fresh = new Set(commits);
  const ways = requests
    .filter((r) => fresh.has(r.commit))
    .map((r) => ({ commit: r.commit, parts: split(r.path) }))
    .filter((w) => !w.parts.some((x) => /[\r\n]/.test(x)));
  const onTheWay = [];
  for (let depth = 1; ways.some((w) => w.parts.length >= depth); depth++)
    for (const w of ways)
      if (w.parts.length >= depth)
        onTheWay.push(`${w.commit}:${w.parts.slice(0, depth).join("/")}`);
  const rootObjects = catObjects([...commits.map((c) => `${c}^{tree}`), ...onTheWay], top);
  for (const c of commits) {
    const obj = rootObjects.get(`${c}^{tree}`);
    if (!obj || obj.type !== "tree") throw new MissingObjects();
    trees.set(obj.id, treeEntries(obj.data, idBytes));
    roots.set(c, obj.id);
  }
  for (const spec of onTheWay) {
    const obj = rootObjects.get(spec);
    if (obj?.type === "tree" && !trees.has(obj.id))
      trees.set(obj.id, treeEntries(obj.data, idBytes));
  }
  const states = requests.map((r) => ({
    commit: r.commit,
    parts: split(r.path),
    cur: [],
    tree: roots.get(r.commit),
    hops: 0,
    via: [],
    // Components of the last link's target still to walk: a missing one is a link the
    // commit cannot follow, not a path it simply does not hold.
    linkLeft: 0,
    done: null,
  }));
  const end = (s, entry, at, reason, kind) => {
    s.done = { entry, path: at, via: s.via, ...(reason ? { reason, kind } : {}) };
  };
  for (;;) {
    const active = states.filter((s) => !s.done);
    if (!active.length) break;
    const want = [...new Set(active.map((s) => s.tree))].filter((id) => !trees.has(id));
    for (const [id, obj] of want.length ? catObjects(want, top) : []) {
      if (!obj || obj.type !== "tree") throw new MissingObjects();
      trees.set(id, treeEntries(obj.data, idBytes));
    }
    const linkIds = [];
    for (const s of active) {
      while (!s.done && trees.has(s.tree)) {
        if (!s.parts.length) {
          end(s, { mode: "40000", id: s.tree }, s.cur.join("/"));
          break;
        }
        const name = s.parts[0];
        const here = [...s.cur, name].join("/");
        const entries = trees.get(s.tree);
        const e = entries.find((x) => x.name === name) ?? entries.find((x) => same(x.name, name));
        if (!e) {
          end(s, null, [...s.cur, ...s.parts].join("/"));
          if (s.linkLeft > 0) s.done.dangling = true;
        } else if (e.mode === "40000") {
          s.cur.push(name);
          s.parts.shift();
          if (s.linkLeft > 0) s.linkLeft--;
          s.tree = e.id;
        } else if (e.mode === "120000") {
          if (!texts.has(e.id)) {
            linkIds.push(e.id);
            break;
          }
          s.via.push(here);
          const text = texts.get(e.id);
          const target = path.posix.isAbsolute(text)
            ? repositoryPath(text, top)
            : path.posix.normalize(path.posix.join(s.cur.join("/") || ".", text));
          if (++s.hops > 40) end(s, null, here, `${here} is part of a loop of links`, "unreadable");
          else if (target === null || target === ".." || target.startsWith("../"))
            end(s, null, here, `${here} links outside the repository (${text})`, "outside");
          else {
            // Components an earlier link's target still holds after this one count too.
            s.parts = [...split(target), ...s.parts.slice(1)];
            s.linkLeft = split(target).length + Math.max(0, s.linkLeft - 1);
            s.cur = [];
            s.tree = roots.get(s.commit);
          }
        } else if (e.mode === "160000")
          end(
            s,
            null,
            here,
            `${here} is a git submodule; its documents have no history in this repository`,
            "submodule",
          );
        // A file ends the path; as a middle component it is not a directory, and a link
        // whose target passes through it leads nowhere for anyone, as a loop does.
        else if (s.parts.length === 1) end(s, e, here);
        else if (s.linkLeft > 0)
          end(
            s,
            null,
            here,
            `${s.via.at(-1)} links through ${here}, which is a file`,
            "unreadable",
          );
        else end(s, null, [...s.cur, ...s.parts].join("/"));
      }
    }
    if (linkIds.length)
      for (const [id, obj] of catObjects(linkIds, top)) {
        if (!obj) throw new MissingObjects();
        texts.set(id, obj.data.toString("utf8").trim());
      }
  }
  return states.map((s) => s.done);
}

/** The change log's file name in the model directory, for the writer and history alike. */
export const CHANGE_LOG = "change-log.md";

/** A cache of the git objects history reads, keyed by object id (`resolveInTrees`). */
const treeCacheFor = (top, idBytes) => ({ trees: new Map(), idBytes, fold: foldsNames(top) });

/**
 * The model documents of each commit as `repository path → blob id`, named as the
 * working tree names them and read the way the working-tree reader reads them:
 * the model directory and every link are resolved in that commit's tree as the
 * file system resolves them (`resolveInTrees`), each real directory is walked
 * once, dot-entries are skipped, and `.ttl` documents and the change log are
 * kept. What history cannot read — a link out of the repository, a link to a path
 * the commit does not hold, a submodule — is listed in `skipped` with the reason,
 * and that commit's model is incomplete; a change log behind a link to a path the
 * commit does not hold is `logUnseen` instead, leaving only the change log unknown.
 *
 * @param {string[]} [also] More repository paths to resolve in each commit (the ADR index).
 * @param {object} [cache] Git objects already read (`treeCacheFor`), shared by the reads
 *   of one history.
 * @returns {Map<string, {files: Map<string, string>, skipped: {file: string, reason: string, kind?: string, root?: boolean}[], logUnseen: string|null, targets: Set<string>, resolved: Map<string, object>}>}
 *   `skipped[].kind`: `resolveInTrees`' kind of an unfollowable link (`unreadable` for one
 *   nobody can follow); `skipped[].root`: the model directory itself; `targets`: the
 *   repository paths the commit's links pass through and lead to; `resolved`: each path
 *   of `also` as `resolveInTrees` gives it.
 */
function readTreeFiles(
  top,
  commits,
  dir,
  logRel,
  idBytes,
  also = [],
  cache = treeCacheFor(top, idBytes),
) {
  // A folder of model documents in the working tree at a repository path.
  const folderHere = (file) => {
    try {
      const at = path.join(top, file);
      return statSync(at).isDirectory() && findModelDocuments(at).length > 0;
    } catch {
      return false;
    }
  };
  const { trees } = cache;
  const load = (ids) => {
    const want = [...new Set(ids)].filter((id) => !trees.has(id));
    if (!want.length) return;
    for (const [id, obj] of catObjects(want, top)) {
      if (!obj || obj.type !== "tree") throw new MissingObjects();
      trees.set(id, treeEntries(obj.data, idBytes));
    }
  };
  const states = new Map();
  const starts = resolveInTrees(
    top,
    commits.flatMap((commit) => [dir, ...also].map((p) => ({ commit, path: p }))),
    cache,
  );
  commits.forEach((c, i) => {
    const st = {
      files: new Map(),
      pending: [],
      links: [],
      skipped: [],
      targets: new Set(),
      walked: new Set(),
      resolved: new Map(),
    };
    const [root, ...extra] = starts.slice(i * (1 + also.length), (i + 1) * (1 + also.length));
    for (const r of [root, ...extra]) for (const v of r.via) st.targets.add(v);
    also.forEach((p, k) => {
      st.resolved.set(p, extra[k]);
      if (extra[k].path !== p) st.targets.add(extra[k].path);
    });
    if (root.reason)
      st.skipped.push({ file: dir, reason: root.reason, root: true, kind: root.kind });
    else if (root.dangling)
      st.skipped.push({
        file: dir,
        reason: `${dir} links to ${root.path}, which the commit does not hold (an untracked or ignored folder, or nothing)`,
        root: true,
      });
    else if (root.entry?.mode === "40000") {
      if (root.path !== dir) st.targets.add(root.path);
      st.pending.push([root.entry.id, dir, root.path]);
    }
    states.set(c, st);
  });
  // A real directory is walked once, under the first name that reaches it.
  const under = (at, name) => (at ? `${at}/${name}` : name);
  for (let round = 0; round < 16; round++) {
    for (;;) {
      load([...states.values()].flatMap((st) => st.pending.map(([id]) => id)));
      let more = false;
      for (const st of states.values()) {
        const pending = st.pending;
        st.pending = [];
        for (const [id, prefix, at] of pending) {
          if (st.walked.has(at)) continue;
          st.walked.add(at);
          for (const e of trees.get(id) ?? []) {
            if (e.name.startsWith(".")) continue;
            const file = `${prefix}/${e.name}`;
            if (e.mode === "40000") {
              st.pending.push([e.id, file, under(at, e.name)]);
              more = true;
            } else if (e.mode === "120000") st.links.push({ file, at: under(at, e.name) });
            else if (e.mode === "160000")
              st.skipped.push({
                file,
                reason: `${file} is a git submodule; its documents have no history in this repository`,
              });
            else if (e.name.endsWith(".ttl") || file === logRel) st.files.set(file, e.id);
          }
        }
      }
      if (!more) break;
    }
    const links = [...states.entries()].flatMap(([c, st]) => st.links.map((l) => ({ c, ...l })));
    for (const st of states.values()) st.links = [];
    if (!links.length) break;
    const ends = resolveInTrees(
      top,
      links.map((l) => ({ commit: l.c, path: l.at })),
      cache,
    );
    links.forEach((l, i) => {
      const st = states.get(l.c);
      const r = ends[i];
      for (const v of r.via) st.targets.add(v);
      // The working tree reads a link only as a `.ttl` document, a directory or the
      // change log. One to a path the commit does not hold may have led, that day, to a
      // folder of model documents or to the change log — content history cannot see, as
      // where the working tree reads such a folder there now; under another name it
      // leads nowhere the model reads, as does a link nobody can follow.
      const unseen = !r.entry && !r.reason && (l.file === logRel || folderHere(l.file));
      if (!r.entry && (!r.reason || r.kind === "unreadable") && !l.file.endsWith(".ttl") && !unseen)
        return;
      const dangling = `${l.file} links to ${r.path}, which the commit does not hold (an untracked or ignored file or folder, or nothing)`;
      // A change log history cannot see leaves only the change log unknown: the model
      // documents beside it are read as they are.
      if (!r.entry && !r.reason && l.file === logRel) st.logUnseen = dangling;
      else if (r.reason) st.skipped.push({ file: l.file, reason: r.reason, kind: r.kind });
      else if (!r.entry) st.skipped.push({ file: l.file, reason: dangling });
      else {
        st.targets.add(r.path);
        if (r.entry.mode === "40000") st.pending.push([r.entry.id, l.file, r.path]);
        else if (l.file.endsWith(".ttl") || l.file === logRel) st.files.set(l.file, r.entry.id);
      }
    });
  }
  for (const st of states.values())
    if (st.pending.length)
      st.skipped.push({
        file: dir,
        reason: `the links under ${dir} are nested too deeply to follow`,
      });
  return new Map(
    [...states].map(([c, st]) => [
      c,
      {
        files: st.files,
        skipped: st.skipped,
        logUnseen: st.logUnseen ?? null,
        targets: st.targets,
        resolved: st.resolved,
      },
    ]),
  );
}

/**
 * The top level, HEAD and the shallow state from one `rev-parse`, or null. Only a work tree
 * with a commit whose shallow state git can read answers all four lines; anything else is
 * asked for one at a time, as before, so its failure is decided where it always was.
 */
function repositoryFacts(cwd) {
  let out;
  try {
    out = git(
      [
        "rev-parse",
        "--show-toplevel",
        "--is-shallow-repository",
        "--git-path",
        "shallow",
        "--verify",
        "-q",
        "HEAD",
      ],
      cwd,
    );
  } catch {
    return null;
  }
  const lines = out.replace(/\n$/, "").split("\n");
  if (
    lines.length !== 4 ||
    !/^(true|false)$/.test(lines[1]) ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(lines[3])
  )
    return null;
  const top = lines[0].trim();
  // The shallow file's path is relative to where it was asked. It is the separate read's
  // only when asked from the top level itself; elsewhere that read is still made.
  let here = null;
  try {
    here = realpathSync(cwd);
  } catch {
    // the separate read decides
  }
  return { top, head: lines[3], shallow: here === top ? [lines[1], lines[2].trimEnd()] : null };
}

/**
 * Read the history of the model directory and the ADR index. HEAD is read first:
 * its model and the comparison with the working tree stay available when older
 * history is not (a partial or shallow clone, a git failure).
 *
 * @param {string} processDir Model directory, relative to `cwd`.
 * @param {{cwd?: string, mappingPath?: string|null}} [options]
 * @returns {object} `{available: false, reason, noHistory?}` when HEAD cannot be read —
 *   `noHistory` when the repository holds no history of the model at all (no git, or a
 *   model directory outside the repository); otherwise
 *   `head` (the HEAD commit or null), `history: {available, reason?}`, `tip` (the
 *   simplified-history commit whose model and index HEAD has), `nodes` (commit →
 *   simplified parents), `boundary` (commits a shallow clone cut off), `headFiles`
 *   (`repository path → text` of HEAD's documents history could read), `headSkipped`
 *   (`{file, reason}` of what it could not: then HEAD's model, and so the history,
 *   is unavailable), `headDocuments()` (HEAD's documents as `modelDocumentsAt` reads
 *   them), and readers `graphAt(commit)` (null when that model cannot be
 *   read), `visibleGraphAt(commit)` (what the documents that parse show where others
 *   do not), `unreachableAt(commit)` (history cannot reach its documents, rather than
 *   failing to parse them or finding links nobody can follow), `mappingAt(commit)` and
 *   `changeLogAt(commit)` (undefined where history cannot see the change log).
 */
export function readModelHistory(processDir, { cwd = process.cwd(), mappingPath = null } = {}) {
  const facts = repositoryFacts(cwd);
  let top = facts?.top;
  if (!facts) {
    try {
      top = git(["rev-parse", "--show-toplevel"], cwd).trim();
    } catch {
      return { available: false, reason: "not a git work tree", noHistory: true };
    }
  }
  const dir = repositoryName(top, cwd, processDir);
  if (dir === null)
    return {
      available: false,
      reason:
        "the model directory lies outside the repository, so its documents have no history here",
      noHistory: true,
    };
  // An index outside the repository has no history: the gates stay unknown.
  const mapRel = mappingPath ? repositoryName(top, cwd, mappingPath) : null;
  const also = mapRel ? [mapRel] : [];
  const logRel = `${dir}/${CHANGE_LOG}`;
  let head = facts?.head ?? null;
  if (!facts) {
    try {
      head = git(["rev-parse", "--verify", "-q", "HEAD"], top).trim();
    } catch {
      head = null; // no commit yet: every model element is uncommitted
    }
  }
  const none = () => null;
  if (!head)
    return {
      available: true,
      top,
      dir,
      head: null,
      history: { available: true },
      tip: null,
      nodes: new Map(),
      boundary: new Set(),
      headFiles: new Map(),
      headSkipped: [],
      headDocuments: () => [],
      graphAt: none,
      visibleGraphAt: none,
      unreachableAt: () => true,
      errorsAt: none,
      mappingAt: none,
      changeLogAt: () => "",
      tracksMapping: Boolean(mapRel),
    };
  const idBytes = head.length / 2;
  // One cache of git objects for the whole read: HEAD, every pass over the log and the
  // gates' record reads ask for many of the same trees.
  const objects = treeCacheFor(top, idBytes);
  let headFiles;
  let headSkipped;
  let headLogUnseen;
  let headTargets;
  let headResolved;
  let blobs;
  try {
    ({
      files: headFiles,
      skipped: headSkipped,
      logUnseen: headLogUnseen,
      targets: headTargets,
      resolved: headResolved,
    } = readTreeFiles(top, [head], dir, logRel, idBytes, also, objects).get(head));
    // HEAD's change log is what an uncommitted retirement and an approved save are judged
    // against, so while history cannot see it HEAD stays unread, with its reason.
    if (headLogUnseen) headSkipped = [...headSkipped, { file: logRel, reason: headLogUnseen }];
    const outside = headSkipped.find((s) => s.root);
    if (outside)
      return {
        available: false,
        reason: `${outside.reason}, so the model's documents have no history here`,
        noHistory: true,
      };
    blobs = catObjects([...headFiles.values()], top);
    for (const obj of blobs.values()) if (!obj) throw new MissingObjects();
  } catch (error) {
    const detail = missingLocally(error)
      ? "the committed model documents are not available locally"
      : firstLine(error);
    return { available: false, reason: `git could not read HEAD's model: ${detail}` };
  }

  const nodes = new Map();
  const order = [];
  // A commit whose documents history cannot all read has no model: graphAt is null.
  const complete = (at) => (at.skipped.length ? null : at.files);
  // A commit whose only unread documents are links nobody can follow (round a loop, or
  // through a file) holds no hidden content: the working tree cannot read them either.
  const loopsOnly = (at) =>
    at.skipped.length > 0 && at.skipped.every((x) => x.kind === "unreadable");
  let unreadable = new Set();
  // Commits whose change log history cannot see, though their model documents it can.
  let logUnknown = new Set();
  let filesOf = new Map([[head, headSkipped.length ? null : headFiles]]);
  let indexOf = new Map(mapRel ? [[head, headResolved.get(mapRel)]] : []);
  let history = headSkipped.length
    ? {
        available: false,
        reason: `${headSkipped.map((s) => s.reason).join("; ")}; edits of those documents, committed or not, cannot be flagged`,
      }
    : { available: true };
  let boundary = new Set();
  // Index blobs already read with the model's, keyed like `catObjects` (null when missing).
  let indexRead = null;
  if (history.available) {
    try {
      const [shallow, shallowFile] =
        facts?.shallow ??
        git(["rev-parse", "--is-shallow-repository", "--git-path", "shallow"], top)
          .trim()
          .split("\n");
      if (shallow === "true")
        boundary = new Set(
          readFileSync(path.resolve(top, shallowFile), "utf8").split("\n").filter(Boolean),
        );
      // A commit that changes only what a model link passes through or leads to changes
      // the model too, and a link may have led elsewhere before: the paths every listed
      // commit's links reach are added until no new one appears.
      const targets = new Set(headTargets);
      // A link on the way to the model directory or the index that HEAD no longer
      // has: the commits that add, change or remove one, and their parents, show where
      // it led, so the paths it led to join the log too.
      const ancestors = new Set(
        [dir, ...also].flatMap((p) =>
          p
            .split("/")
            .slice(0, -1)
            .map((_, i, parts) => parts.slice(0, i + 1).join("/")),
        ),
      );
      // On a volume that folds letter case, git still matches paths by the stored
      // spelling, so every path is asked for whatever its case.
      const fold = foldsNames(top);
      const spec = (p) => (fold ? `:(icase)${p}` : p);
      const same = (a, b) => a === b || (fold && a.toLowerCase() === b.toLowerCase());
      const layout = new Set();
      if (ancestors.size) {
        const raw = git(
          [
            "log",
            "--format=%x01%H %P",
            "--raw",
            "--no-abbrev",
            "--no-renames",
            // Whatever the user's, the repository's or a submodule's own configuration
            // leaves out of a diff, the submodule lines are printed.
            "--ignore-submodules=none",
            "--",
            ...[...ancestors].map(spec),
          ],
          top,
        );
        let commit = [];
        // A link or a submodule added, changed or removed on the way.
        const special = (mode) => mode === "120000" || mode === "160000";
        for (const line of raw.split("\n")) {
          if (line.startsWith("\x01")) commit = line.slice(1).trim().split(" ").filter(Boolean);
          else {
            const m = /^:(\d{6}) (\d{6}) \S+ \S+ \S+\t(.*)$/.exec(line);
            if (m && [...ancestors].some((a) => same(a, m[3])) && (special(m[1]) || special(m[2])))
              for (const c of commit) layout.add(c);
          }
        }
      }
      let reads = new Map();
      let stable = false;
      for (let pass = 0; pass < 8 && !stable; pass++) {
        nodes.clear();
        order.length = 0;
        const log = git(
          [
            "log",
            "--topo-order",
            "--parents",
            "--format=%H %P",
            "--",
            ...[dir, ...also, ...targets].map(spec),
          ],
          top,
        );
        for (const line of log.split("\n").filter(Boolean)) {
          // Only commit lines: anything else is output history cannot read.
          if (!/^[0-9a-f]{40,64}(?: [0-9a-f]{40,64})*\s*$/.test(line))
            throw new Error(`unexpected git log output: ${line.trim()}`);
          const [sha, ...parents] = line.trim().split(" ");
          nodes.set(sha, { parents });
          order.push(sha);
        }
        reads = readTreeFiles(
          top,
          [...new Set([...order, ...layout])],
          dir,
          logRel,
          idBytes,
          also,
          objects,
        );
        const added = [...reads.values()]
          .flatMap((at) => [...at.targets])
          .filter((t) => !targets.has(t));
        stable = !added.length;
        for (const t of added) targets.add(t);
      }
      if (!stable)
        throw new Error("the model's links led to new paths in every pass through its history");
      filesOf = new Map([...[...reads].map(([c, at]) => [c, complete(at)]), [head, headFiles]]);
      unreadable = new Set([...reads].filter(([, at]) => loopsOnly(at)).map(([c]) => c));
      logUnknown = new Set([...reads].filter(([, at]) => at.logUnseen).map(([c]) => c));
      if (mapRel)
        indexOf = new Map([
          ...[...reads].map(([c, at]) => [c, at.resolved.get(mapRel)]),
          [head, headResolved.get(mapRel)],
        ]);
      const modelIds = [
        ...new Set([...filesOf.values()].flatMap((f) => (f ? [...f.values()] : []))),
      ].filter((id) => !blobs.has(id));
      // The index blobs ride along in the same batch. When that batch fails or its answers
      // do not line up, the model's blobs and then the index's are read apart, so a failure
      // keeps its old scope.
      try {
        indexRead = catObjects([...modelIds, ...indexIdsOf(indexOf)], top, { exact: true });
      } catch {
        indexRead = null;
      }
      const more = indexRead ?? catObjects(modelIds, top);
      for (const id of modelIds) {
        const obj = more.get(id);
        if (!obj) throw new MissingObjects();
        blobs.set(id, obj);
      }
    } catch (error) {
      nodes.clear();
      order.length = 0;
      filesOf = new Map([[head, headFiles]]);
      if (mapRel) indexOf = new Map([[head, headResolved.get(mapRel)]]);
      history = {
        available: false,
        reason: missingLocally(error)
          ? "some model history objects are not available locally (partial clone); fetch them to see committed-edit flags"
          : `git could not read the model history: ${firstLine(error)}`,
      };
    }
  }
  // The index as each read commit resolves it; what cannot be read stays unknown.
  const indexBlobs = new Map();
  const indexIds = indexIdsOf(indexOf);
  for (const id of indexIds) if (indexRead?.get(id)) indexBlobs.set(id, indexRead.get(id));
  try {
    const unread = indexIds.filter((id) => !indexRead?.has(id));
    for (const [id, obj] of catObjects(unread, top)) if (obj) indexBlobs.set(id, obj);
  } catch {
    // unreadable index objects: the gates of those commits stay unknown
  }
  const text = (id) => blobs.get(id)?.data.toString("utf8") ?? "";
  const parsedBlob = new Map();
  // A commit's documents, each parsed as strictly as the working tree reads it; null
  // where history cannot reach them all.
  const parsedAt = (c) => {
    const files = filesOf.get(c);
    if (!files) return null;
    return [...files.entries()]
      .filter(([file]) => file.endsWith(".ttl"))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([file, id]) => {
        if (!parsedBlob.has(id))
          parsedBlob.set(
            id,
            parseDocument({
              doc: file,
              ...decodeDocument(blobs.get(id)?.data ?? Buffer.alloc(0)),
            }),
          );
        return parsedBlob.get(id);
      });
  };
  const graphs = new Map();
  const graphAt = (c) => {
    if (graphs.has(c)) return graphs.get(c);
    const parsed = parsedAt(c);
    const graph =
      !parsed || parsed.some((x) => x.errors.length) ? null : indexGraph(unionGraph(parsed));
    graphs.set(c, graph);
    return graph;
  };
  // What a commit whose documents do not all parse still shows: the union of those that
  // do. Null where history cannot reach every document of the commit.
  const visible = new Map();
  const visibleGraphAt = (c) => {
    const graph = graphAt(c);
    if (graph || visible.has(c)) return graph ?? visible.get(c);
    const parsed = parsedAt(c);
    const shown = parsed ? indexGraph(unionGraph(parsed.filter((x) => !x.errors.length))) : null;
    visible.set(c, shown);
    return shown;
  };
  // The realizing features' ADR records at a commit, read from its tree as the
  // working tree reads them from disk.
  const adrRoot = mappingPath ? path.dirname(mappingPath) : null;
  const treeCache = objects;
  const recordFindingsAt = (c, mapping, index) => {
    const categories = mapping?.categories ?? {};
    const linkedKeys = Object.keys(categories).filter(
      (k) => Array.isArray(categories[k]?.realizes) && categories[k].realizes.length,
    );
    if (!adrRoot || !linkedKeys.length) return { findings: [], unread: false };
    const name = (p) => repositoryName(top, cwd, p) ?? `\0outside:${p}`;
    const folderOf = (key) => name(path.join(adrRoot, ...key.split("/")));
    const wanted = new Set();
    for (const k of linkedKeys) {
      wanted.add(folderOf(k));
      for (const r of Array.isArray(categories[k].adrs) ? categories[k].adrs : [])
        if (typeof r?.path === "string") wanted.add(name(r.path));
    }
    const locations = [...wanted].filter((w) => !w.startsWith("\0"));
    const ends = resolveInTrees(
      top,
      locations.map((p) => ({ commit: c, path: p })),
      treeCache,
    );
    // A realizing ADR history cannot reach (outside the repository, a submodule, a link
    // to a path the commit does not hold) is unknown, never missing; a link nobody can
    // follow is a file that cannot be read, as on disk.
    const unreachable = new Set([
      ...locations.filter(
        (p, i) => (ends[i].reason && ends[i].kind !== "unreadable") || ends[i].dangling,
      ),
      ...[...wanted].filter((w) => w.startsWith("\0")),
    ]);
    const entryAt = new Map(locations.map((p, i) => [p, ends[i]]));
    const fileIds = ends.filter((r) => r.entry && r.entry.mode !== "40000").map((r) => r.entry.id);
    const texts = catObjects(fileIds, top);
    const findings = adrRecordFindings({
      categories,
      index,
      inScope: () => true,
      at: name,
      folderOf,
      join: path.posix.join,
      read: (file) => {
        const r = entryAt.get(file);
        if (!r?.entry || r.entry.mode === "40000") return null;
        return texts.get(r.entry.id)?.data.toString("utf8") ?? null;
      },
      list: (dir) => {
        const r = entryAt.get(dir);
        return r?.entry?.mode === "40000"
          ? (treeCache.trees.get(r.entry.id) ?? []).map((e) => e.name)
          : [];
      },
      label: (file) => file,
      inModel: (file, target) =>
        linksInto(path.posix.normalize(path.posix.join(path.posix.dirname(file), target)), dir, {
          fold: treeCache.fold,
          sep: "/",
        }),
    });
    // What history could not reach is no finding, only a gate it cannot judge.
    const known = findings.filter(
      (f) => !(f.code === "process-adr-missing" && unreachable.has(name(f.where))),
    );
    return { findings: known, unread: unreachable.size > 0 };
  };
  // Validation errors of a commit's model, index links and realizing ADR records — the
  // gate inputs ADR Writer uses — and whether some of those inputs history cannot read.
  const errorsKnown = new Map();
  const errorsAt = (c, mapping) => {
    if (errorsKnown.has(c)) return errorsKnown.get(c);
    const files = filesOf.get(c);
    let errors = null;
    if (files) {
      const docs = [...files]
        .filter(([file]) => file.endsWith(".ttl"))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([file, id]) => ({
          doc: file,
          ...decodeDocument(blobs.get(id)?.data ?? Buffer.alloc(0)),
        }));
      const v = validateModel(docs, { categoryKeys: Object.keys(mapping?.categories ?? {}) });
      const records = v.index && mapping ? recordFindingsAt(c, mapping, v.index) : null;
      errors = {
        errors: [
          ...v.findings,
          ...(v.index && mapping ? checkRealizes(mapping, v.index) : []),
          ...(records?.findings ?? []),
        ].filter((f) => f.level === "error"),
        unread: Boolean(records?.unread),
      };
    }
    errorsKnown.set(c, errors);
    return errors;
  };
  const sameContent = (a, b) => {
    const key = (f) => (f ? [...f.entries()].sort().join() : "?");
    const map = (c) => {
      const r = indexOf.get(c);
      return r?.reason ? "?" : (r?.entry?.id ?? "");
    };
    return key(filesOf.get(a)) === key(filesOf.get(b)) && map(a) === map(b);
  };
  const tip = nodes.has(head)
    ? head
    : (order.find((c) => sameContent(c, head)) ?? order[0] ?? null);
  return {
    available: true,
    top,
    dir,
    head,
    history,
    tip,
    nodes,
    boundary,
    headFiles: new Map(
      [...headFiles].filter(([f]) => f.endsWith(".ttl")).map(([f, id]) => [f, text(id)]),
    ),
    headSkipped,
    // HEAD's documents as `modelDocumentsAt` reads them — in path order, decoded strictly —
    // for a command that compares the working tree with HEAD; all of them only where
    // `headSkipped` is empty.
    headDocuments: () =>
      [...headFiles]
        .filter(([f]) => f.endsWith(".ttl"))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([file, id]) => ({
          file,
          ...decodeDocument(blobs.get(id)?.data ?? Buffer.alloc(0)),
        })),
    graphAt,
    visibleGraphAt,
    // Whether history cannot reach a commit's model at all (a document linked out of
    // the repository, a submodule), as opposed to documents nobody can read — that do
    // not parse, or links nobody can follow.
    unreachableAt: (c) => !filesOf.get(c) && !unreadable.has(c),
    errorsAt,
    tracksMapping: Boolean(mapRel),
    // The index text at a commit, null where it has none — a link nobody can follow or a
    // directory is none, as the working tree finds none —, undefined where it cannot be
    // read (outside the repository, a submodule, a link to a path the commit lacks).
    mappingAt: (c) => {
      const r = indexOf.get(c);
      if (r?.kind === "unreadable" || r?.entry?.mode === "40000") return null;
      if (!r || r.reason || r.dangling) return undefined;
      return r.entry ? indexBlobs.get(r.entry.id)?.data.toString("utf8") : null;
    },
    // The change log at a commit; "" where it has none, undefined where history cannot
    // see it (a link to a path the commit does not hold).
    changeLogAt: (c) => {
      if (logUnknown.has(c)) return undefined;
      const id = filesOf.get(c)?.get(logRel);
      return id ? text(id) : "";
    },
  };
}

class MissingObjects extends Error {}

/**
 * A path as the repository names it: lexically from the physical working
 * directory, so the links on the way stay names that history resolves in each
 * commit as the file system does; a path that only links bring into the
 * repository is named by its real location. Null when it lies outside.
 */
function repositoryName(top, cwd, p) {
  const inside = (r) => !(r === ".." || r.startsWith(`..${path.sep}`) || path.isAbsolute(r));
  const name = (r) => r.split(path.sep).join("/") || ".";
  const lexical = path.resolve(realpathSync(cwd), p);
  if (inside(path.relative(top, lexical))) return name(path.relative(top, lexical));
  try {
    const real = path.relative(top, realpathSync(lexical));
    return inside(real) ? name(real) : null;
  } catch {
    return null;
  }
}

/**
 * Whether git failed because objects of a partial clone are not here: reported
 * missing, or — by a git that ignores the lazy-fetch switch — not fetched because
 * every transport is refused.
 */
const missingLocally = (error) =>
  error instanceof MissingObjects ||
  /promisor remote|transport '[^']*' not allowed/.test(String(error?.stderr ?? ""));
const firstLine = (error) =>
  String(error?.stderr || error?.message || error)
    .trim()
    .split("\n")[0];

/**
 * The model documents of a revision and its change log, read the way the working
 * tree reads them, through the model directory's links. Throws when git cannot read
 * the revision or history cannot read one of its documents or its change log (a link
 * out of the repository, a submodule).
 *
 * @param {string} ref A git revision.
 * @param {string} processDir Model directory, relative to `cwd`.
 * @returns {{docs: {file: string, text: string, unreadable?: object}[], changeLog: string}}
 *   repository paths, sorted, and the change log ("" when the revision has none).
 */
export function modelDocumentsAt(ref, processDir, { cwd = process.cwd() } = {}) {
  const top = git(["rev-parse", "--show-toplevel"], cwd).trim();
  const dir = repositoryName(top, cwd, processDir);
  if (dir === null) throw new Error("the model directory lies outside the repository");
  const sha = git(["rev-parse", "--verify", "-q", `${ref}^{commit}`], top).trim();
  const logRel = `${dir}/${CHANGE_LOG}`;
  const reads = readTreeFiles(top, [sha], dir, logRel, sha.length / 2);
  const { files, skipped, logUnseen } = reads.get(sha);
  // A comparison with the revision also reads its change log.
  const unread = [...skipped.map((s) => s.reason), ...(logUnseen ? [logUnseen] : [])];
  if (unread.length) throw new Error(unread.join("; "));
  const ttl = [...files]
    .filter(([f]) => f.endsWith(".ttl"))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const logId = files.get(logRel);
  const blobs = catObjects([...ttl.map(([, id]) => id), ...(logId ? [logId] : [])], top);
  const docs = ttl.map(([file, id]) => {
    const obj = blobs.get(id);
    if (!obj) throw new Error(`${file} is not available locally`);
    return { file, ...decodeDocument(obj.data) };
  });
  return { docs, changeLog: logId ? (blobs.get(logId)?.data.toString("utf8") ?? "") : "" };
}

/**
 * The readable commits a commit builds on: an unreadable parent is looked through
 * to its own parents. `walk.cut(c)` tells whether looking through reached a commit
 * where a shallow clone cut the history off, so what lies before it is unknown,
 * `walk.unread(c)` whether it passed a commit whose model history cannot read,
 * `walk.unreached(c)` whether one of those lies where history cannot reach the model
 * rather than holding documents that do not parse, and `walk.run(c)` whether two of
 * them in a row may hide a value leaving and coming back: one where it may have come
 * back after one where it may have left.
 *
 * @param {object} history From `readModelHistory`.
 * @param {(commit: string) => boolean} readable Whether a commit counts as readable.
 * @param {(commit: string) => boolean|null} [seen] Whether the documents of an unreadable
 *   commit that do parse show the value walked (true), another one (false) or none (null).
 */
function readableParentsOf(history, readable, seen = () => null) {
  const known = new Map();
  const expand = (start) => {
    // Iterative, so a long run of unreadable commits cannot exhaust the stack.
    const stack = [start];
    while (stack.length) {
      const c = stack.at(-1);
      if (known.has(c)) {
        stack.pop();
        continue;
      }
      const parents = history.nodes.get(c)?.parents ?? [];
      const deeper = parents.filter((q) => !readable(q) && !known.has(q));
      if (deeper.length) {
        stack.push(...deeper);
        continue;
      }
      const entry = {
        parents: new Set(),
        cut: false,
        unread: false,
        unreached: false,
        run: false,
        leaves: false,
      };
      for (const q of parents) {
        if (readable(q)) {
          entry.parents.add(q);
          continue;
        }
        if (history.boundary.has(q)) entry.cut = true;
        const unread = history.graphAt(q) === null;
        if (unread) {
          entry.unread = true;
          if (history.unreachableAt(q)) entry.unreached = true;
        }
        const through = known.get(q);
        for (const r of through.parents) entry.parents.add(r);
        if (through.cut) entry.cut = true;
        if (through.unread) entry.unread = true;
        if (through.unreached) entry.unreached = true;
        // Two or more unreadable commits in a row: a value may leave and come back there,
        // unless what does parse in them shows it stayed.
        if (through.run || (unread && seen(q) !== false && through.leaves)) entry.run = true;
        if (through.leaves || (unread && seen(q) !== true)) entry.leaves = true;
      }
      known.set(c, entry);
      stack.pop();
    }
    return known.get(start);
  };
  const walk = (c) => [...expand(c).parents];
  walk.cut = (c) => expand(c).cut;
  walk.unread = (c) => expand(c).unread;
  walk.unreached = (c) => expand(c).unreached;
  walk.run = (c) => expand(c).run;
  return walk;
}

/**
 * The commits where a process's current lifecycle value appeared: walking the
 * simplified history back from the tip through commits that hold `value`, a
 * commit whose readable parents do not hold it. A commit whose model cannot be
 * read, or that has no such process, never ends the walk; it is looked through
 * to its parents, so a process removed and added again keeps its earlier history.
 *
 * @param {object} history From `readModelHistory`.
 * @param {(graph: object) => string|null} valueOf The lifecycle value in a model;
 *   null when the model has no such process.
 * @param {string} value The current value.
 * @param {string|null} [from] The commit to walk back from (default: the tip).
 * @returns {{commits: string[], cut: boolean, unreadAt: Set<string>, afterGap: Set<string>, afterRun: Set<string>, unreached: boolean}}
 *   commits, newest first, whether a shallow clone cut the walk off, the appearances
 *   that follow commits whose model history cannot read — the value may have
 *   appeared earlier —, every commit of the walk that follows such commits
 *   (`afterGap`) and those that follow two or more of them in a row where the value
 *   may have left and come back unseen (`afterRun`: not where the documents that
 *   parse there show it throughout), and whether one of those commits lies where
 *   history cannot reach the model at all.
 */
export function appearancesOf(history, valueOf, value, from = history.tip) {
  if (!from)
    return {
      commits: [],
      cut: false,
      unreadAt: new Set(),
      afterGap: new Set(),
      afterRun: new Set(),
      unreached: false,
    };
  const holds = (c) => {
    const g = history.graphAt(c);
    const v = g === null ? null : valueOf(g);
    return v === null ? null : v === value;
  };
  // In a commit whose model does not parse, the documents that do may still state the
  // value: a broken document beside them changes nothing about it.
  const seen = (c) => {
    const g = history.visibleGraphAt?.(c);
    const v = g ? valueOf(g) : null;
    return v === null ? null : v === value;
  };
  const parentsOf = readableParentsOf(history, (q) => holds(q) !== null, seen);
  const found = [];
  let cut = false;
  const unreadAt = new Set();
  const afterGap = new Set();
  const afterRun = new Set();
  let unreached = false;
  const visited = new Set();
  const stack = holds(from) === null ? parentsOf(from) : [from];
  while (stack.length) {
    const c = stack.pop();
    if (visited.has(c) || !holds(c)) continue;
    visited.add(c);
    if (history.boundary.has(c) || parentsOf.cut(c)) cut = true;
    if (parentsOf.unread(c)) afterGap.add(c);
    if (parentsOf.run(c)) afterRun.add(c);
    const parents = parentsOf(c).filter((q) => holds(q));
    if (!parents.length) {
      found.push(c);
      if (parentsOf.unread(c)) unreadAt.add(c);
      if (parentsOf.unreached(c)) unreached = true;
    }
    stack.push(...parents);
  }
  const rank = new Map([...history.nodes.keys()].map((c, i) => [c, i]));
  return {
    commits: found.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)),
    cut,
    unreadAt,
    afterGap,
    afterRun,
    unreached,
  };
}

/** The indexed union of parsed documents, or null when one of them does not parse. */
const graphOf = (parsed) =>
  parsed.some((x) => x.errors.length) ? null : indexGraph(unionGraph(parsed));

const lifecycleValue = (p) => (g) =>
  g.typeOf(p) === "Process" ? `${processStatus(g, p)}\u0000${g.out(p, "replacedBy").join()}` : null;

/**
 * Change flags for business-context queries: elements edited in the working tree
 * against HEAD, and Accepted processes whose business composition or open scope
 * changed in committed history since they last became Accepted. Computed from
 * repository files and git objects only; nothing is cached on disk. A squash
 * merge keeps no intermediate history, so an edit squashed together with the
 * acceptance is not visible.
 *
 * @param {string} processDir Model directory, relative to `cwd`.
 * @param {object|null} workingIndex Indexed working-tree model.
 * @param {{cwd?: string, mappingPath?: string|null, history?: object|null}} [options] Directory
 *   inside the repository (default: the process cwd), the ADR index, whose history lets the
 *   lifecycle audit judge promotions by their alignment gates, and a history already read.
 * @returns {object} `{available: false, reason}` or `{available: true, head, history,
 *   uncommitted, uncommittedKinds, uncommittedDocuments, unsynced, unsyncedKinds,
 *   compositionChanged, since, baseline, uncertain, lifecycleEdits}`: `head` is the
 *   committed model (null when it cannot be parsed), `history` whether committed
 *   edits could be judged and why not, `uncommitted` the edited element ids with
 *   their kind (added, changed, removed) in `uncommittedKinds` — or, when the
 *   committed model cannot be compared by element, `uncommittedDocuments` —,
 *   `unsynced` the Accepted processes edited since their Accepted Status appeared
 *   (with the changed elements and kinds), `compositionChanged` those whose business
 *   composition changed — not only open scope —, `since` and `baseline` the commit
 *   and model the edits count from (where that Status appeared, or a commit right after
 *   unreadable ones where it may have: `sinceAfterUnread`; why it is only possibly the
 *   last acceptance: `sinceUncertain`), `alsoSince` and `alsoBaselines`
 *   the other commits where it may have last appeared that HEAD differs from, and their
 *   models, `uncertain` the Accepted processes whose edits since then history cannot
 *   show (`unseenRun` those whose Status two or more commits in a row history cannot
 *   read may hide leaving and coming back), and `lifecycleEdits` the committed
 *   lifecycle edits per process.
 */
export function changeFlags(
  processDir,
  workingIndex,
  { cwd = process.cwd(), mappingPath = null, history = null } = {},
) {
  const h = history ?? readModelHistory(processDir, { cwd, mappingPath });
  if (!h.available) return { available: false, reason: h.reason };
  // What history cannot read is compared on neither side.
  const hidden = (f) => h.headSkipped.some((x) => f === x.file || f.startsWith(`${x.file}/`));
  const committedDocs = () => [...h.headFiles].map(([f, text]) => parseTurtle(text, f));
  let head = !h.head
    ? indexGraph([])
    : h.headSkipped.length
      ? graphOf(committedDocs())
      : h.graphAt(h.head);
  const flags = {
    available: true,
    head,
    history: h.history,
    uncommitted: new Set(),
    uncommittedKinds: new Map(),
    uncommittedDocuments: null,
    unsynced: new Map(),
    unsyncedKinds: new Map(),
    compositionChanged: new Set(),
    since: new Map(),
    sinceAfterUnread: new Set(),
    sinceUncertain: new Map(),
    unseenRun: new Set(),
    alsoSince: new Map(),
    alsoBaselines: new Map(),
    baseline: new Map(),
    uncertain: new Map(),
    lifecycleEdits: new Map(),
  };
  let working = workingIndex;
  if (head === null || h.headSkipped.length) {
    // Named as history names HEAD's documents: under the model directory's own name.
    const modelDir = path.resolve(cwd, processDir);
    const docs = new Map(
      findModelDocuments(modelDir)
        .map((f) => [
          `${h.dir}/${path.relative(modelDir, f).split(path.sep).join("/")}`,
          readDocument(f).text,
        ])
        .filter(([f]) => !hidden(f)),
    );
    if (head !== null) working = graphOf([...docs].map(([f, text]) => parseTurtle(text, f)));
    if (head === null || working === null) {
      // The committed model does not parse: compare the documents instead of elements.
      head = null;
      flags.head = null;
      flags.uncommittedDocuments = [...new Set([...docs.keys(), ...h.headFiles.keys()])]
        .filter((f) => docs.get(f) !== h.headFiles.get(f))
        .sort();
      flags.history = {
        available: false,
        reason: h.headSkipped.length ? h.history.reason : "the committed model cannot be parsed",
      };
      return flags;
    }
  }

  const kinds = (before, after, ids) => {
    const out = new Map();
    for (const id of ids) {
      const iri = elementIri(id);
      out.set(
        id,
        !before.subjects.has(iri) ? "added" : !after.subjects.has(iri) ? "removed" : "changed",
      );
    }
    return out;
  };
  if (working) {
    for (const e of diffGraphs(head.triples, working.triples).elements) flags.uncommitted.add(e.id);
    flags.uncommittedKinds = kinds(head, working, flags.uncommitted);
  }
  if (!h.history.available) return flags;

  for (const p of head.ofType("Process")) {
    if (!isAccepted(head, p)) continue;
    const id = elementId(p);
    // An appearance that only undoes a hand edit is no baseline; the earlier one is.
    const settled = processAudit(h, p, (input) => alignmentPlan(input)).settled();
    const { commits: appearances, cut, unread } = settled;
    // A shallow clone cut the history off where the Status may have appeared earlier.
    if (cut) {
      flags.uncertain.set(
        id,
        "the clone is shallow; fetch more history to see edits since it became Accepted",
      );
      continue;
    }
    if (!appearances.length || unread) {
      flags.uncertain.set(
        id,
        "where its Accepted Status first appeared is not in the readable history",
      );
      continue;
    }
    const now = compositionAndOpenScope(head, p);
    const differs = (c) => !sameKeys(compositionAndOpenScope(h.graphAt(c), p), now);
    const composed = (c) =>
      !sameKeys(businessComposition(h.graphAt(c), p), businessComposition(head, p));
    // Every settled appearance — two branches may each have accepted the process — and
    // every commit right after unreadable ones, where a promotion or renewal may hide,
    // may be where the Status last appeared, so HEAD is compared with each: edits
    // count from the first whose business composition HEAD changes, or else from the
    // first whose open scope it changes, and every element changed since any of them
    // is flagged.
    const gaps = gapCommits(h, settled.gaps);
    const differing = [...appearances, ...gaps].filter(differs);
    // After two or more unreadable commits in a row, the Status may have come back on a
    // composition nobody can see: unknown until the user confirms those commits changed
    // nothing in it (a renewal) or the process is reviewed again.
    if (settled.runs.size) {
      flags.uncertain.set(id, UNSEEN_RUN);
      flags.unseenRun.add(id);
    }
    const at = differing.find(composed) ?? differing[0];
    if (!at) continue;
    const changed = new Map();
    for (const c of differing) {
      const before = compositionAndOpenScope(h.graphAt(c), p);
      const ids = new Set();
      for (const k of before) if (!now.has(k)) ids.add(subjectId(k));
      for (const k of now) if (!before.has(k)) ids.add(subjectId(k));
      for (const [e, kind] of kinds(h.graphAt(c), head, ids))
        if (!changed.has(e)) changed.set(e, kind);
    }
    flags.unsynced.set(id, new Set(changed.keys()));
    flags.unsyncedKinds.set(id, changed);
    if (composed(at)) flags.compositionChanged.add(id);
    flags.since.set(id, at);
    if (gaps.includes(at)) flags.sinceAfterUnread.add(id);
    // Why the commit the edits count from is only possibly the last acceptance.
    if ([at, ...differing].some((c) => gaps.includes(c)))
      flags.sinceUncertain.set(
        id,
        "commits history cannot read may hide where its Status last appeared",
      );
    else if (differing.length > 1)
      flags.sinceUncertain.set(id, "it became Accepted on more than one branch");
    const others = differing.filter((c) => c !== at);
    if (others.length) {
      flags.alsoSince.set(id, others);
      flags.alsoBaselines.set(
        id,
        others.map((c) => h.graphAt(c)),
      );
    }
    flags.baseline.set(id, h.graphAt(at));
  }
  // Committed lifecycle edits ADR Writer's transitions do not explain, per process.
  flags.lifecycleEdits = Map.groupBy(
    lifecycleHistoryFindings(h, (input) => alignmentPlan(input)),
    (f) => f.element,
  );
  return flags;
}

const subjectId = (tripleKeyText) => elementId(tripleKeyText.split("\u0000")[0]) ?? tripleKeyText;

const UNSEEN_RUN =
  "two or more commits in a row that history cannot read may hide where its Status last appeared, on a composition nobody can see";

/** The commits right after unreadable ones that a walk reached, newest first. */
function gapCommits(history, gaps) {
  const rank = new Map([...history.nodes.keys()].map((c, i) => [c, i]));
  return [...gaps].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

/**
 * The baseline a process's Accepted Status is judged against, from that Status's
 * settled appearances: the business composition, open scope and model where it first
 * appeared, with those of every other place it may have last appeared
 * (`alternatives`): another settled appearance — two branches may each have accepted
 * it — or a commit right after unreadable ones the walk reached (`gap`), where a
 * promotion or renewal may hide behind commits nobody can read, and, inside two or
 * more of them in a row, one whose composition nobody can see (`unseen`, no model).
 * Null where history cannot show where it appeared.
 */
function acceptedBaselineOf(history, p, { commits, cut, unread, gaps, runs }) {
  const at = commits.at(-1);
  if (!at || cut || unread) return null;
  const of = (c, gap) => ({
    composition: businessComposition(history.graphAt(c), p),
    openScope: openScopeKeys(history.graphAt(c), p),
    graph: history.graphAt(c),
    gap,
  });
  return {
    ...of(at, false),
    alternatives: [
      ...commits.slice(0, -1).map((c) => of(c, false)),
      ...gapCommits(history, gaps).map((c) => of(c, true)),
      // Inside two or more unreadable commits in a row, a composition nobody can see.
      ...(runs?.size ? [{ gap: true, unseen: true }] : []),
    ],
  };
}

/**
 * Per Accepted process of HEAD, its baseline where its current Accepted Status
 * appeared (`acceptedBaselineOf`) — what an Accepted→Proposed change and a renewal
 * are judged against.
 */
export function acceptedBaselines(history) {
  const out = new Map();
  if (!history.available || !history.history?.available || !history.head) return out;
  const head = history.graphAt(history.head);
  if (!head) return out;
  for (const p of head.ofType("Process")) {
    if (!isAccepted(head, p)) continue;
    const baseline = acceptedBaselineOf(
      history,
      p,
      processAudit(history, p, (input) => alignmentPlan(input)).settled(),
    );
    if (baseline) out.set(p, baseline);
  }
  return out;
}

const INVALID = Symbol("index that does not parse");

/**
 * How history judges one process's lifecycle. `errorsOf(at, from)` lists the
 * errors of the change from commit `from` (null: none) to `at`, as `lifecycle`
 * judges them, with the gates and validation errors at `at`, and whether those
 * gates could not be judged (`unknownGates`), or the change-log line of a retirement
 * there, behind a change log history cannot see (`unknownLog`). `settled()` gives the
 * appearances of the current lifecycle value, where one that only undoes an
 * unexplained lifecycle edit is looked through to where the value held before that
 * edit appeared, so an undone hand edit ends its report and moves no baseline; every
 * change `errorsOf` judges meets the same settled baseline. Its `unread` and
 * `unreached` say, as `appearancesOf` does, whether that value first shows right
 * after commits history cannot read, and whether one of them it cannot reach.
 */
function processAudit(history, p, gates) {
  const id = elementId(p);
  const value = lifecycleValue(p);
  const readableParents = readableParentsOf(history, (q) => Boolean(history.graphAt(q)));
  // A commit without the process is looked through, so a removal and a re-add are one change.
  const holding = readableParentsOf(history, (q) => history.graphAt(q)?.typeOf(p) === "Process");
  const parentOf = (at) => holding(at)[0] ?? null;
  // The index at a commit; undefined where history cannot read it (gates unknown),
  // INVALID where it does not parse, which no gate holds on.
  const mappingAt = (c) => {
    if (!history.tracksMapping) return undefined;
    const text = history.mappingAt(c);
    if (text === undefined) return undefined;
    try {
      return JSON.parse(text ?? "null");
    } catch {
      return INVALID;
    }
  };
  const known = new Map();
  const errorsOf = (at, from) => {
    const key = `${at}\u0000${from}`;
    if (known.has(key)) return known.get(key);
    const after = history.graphAt(at);
    const logParent = readableParents(at)[0] ?? null;
    const before = history.graphAt(from ?? logParent) ?? indexGraph([]);
    const log = (c) => (c ? history.changeLogAt(c) : "");
    // Where history cannot see the change log on either side, the lines a retirement
    // there added are unknown: that retirement is unjudged, never an error.
    const unknownLog =
      (log(at) === undefined || log(logParent) === undefined) &&
      after?.typeOf(p) === "Process" &&
      isRetired(after, p) &&
      !(before.typeOf(p) === "Process" && isRetired(before, p));
    const added = unknownLog ? null : addedLines(log(at) ?? "", log(logParent) ?? "");
    // Accepted → Proposed is judged against the composition where the earlier Accepted
    // appeared — settled, as the change flags and the working-tree check judge it.
    const acceptedBaseline = new Map();
    if (from && isAccepted(before, p)) {
      const earlier = acceptedBaselineOf(history, p, settledFrom(from, value(before)));
      if (earlier) acceptedBaseline.set(p, earlier);
    }
    // A promotion or re-dating in this change is judged by the gates at its commit:
    // unknown where history cannot read one of their inputs, failed where the index
    // does not parse (ADR Writer's own gate refuses such an index).
    let plan;
    let unknownGates = false;
    const promotion = (q) => {
      if (q !== p) return undefined;
      const mapping = mappingAt(at);
      if (mapping === INVALID) {
        plan = { blocking: ["the ADR index does not parse at that commit"] };
        return "fails";
      }
      // What history can read is judged first: a known failure fails the gates whatever
      // else it cannot read, and only the rest leaves them unknown. Without a readable
      // index, the gates the model alone decides are still judged.
      const read = history.errorsAt(at, mapping ?? null) ?? { errors: [], unread: true };
      plan ??= gates({
        index: after,
        mapping: mapping ?? null,
        processId: id,
        errors: read.errors,
        modelOnly: mapping === undefined,
      });
      if (plan.blocking?.length) return "fails";
      if (mapping === undefined || read.unread) {
        unknownGates = true;
        return "unknown";
      }
      return "holds";
    };
    // A promotion whose gates held cannot be told from a reviewed one.
    const errors = lifecycleFindings(before, after, {
      changeLogAdded: added,
      acceptedBaseline,
      promotion,
    }).filter((f) => f.element === id && f.level === "error");
    const out = { errors, plan, unknownGates, unknownLog };
    known.set(key, out);
    return out;
  };
  /**
   * The commit before the unexplained edit `at` undoes (null when it undoes none),
   * and whether that cannot be told: a shallow clone cut off where the value it
   * replaces appeared (`cut`), or that value first shows right after commits history
   * cannot reach, where the edit may hide, while the readable commit before them holds
   * the value `at` restores (`unreached`). A commit whose documents do not parse is
   * looked through: a change made there met a model that fails every gate.
   */
  const undoneKnown = new Map();
  const undone = (at) => {
    if (undoneKnown.has(at)) return undoneKnown.get(at);
    const parent = parentOf(at);
    const out = { before: null, cut: false, unreached: false };
    if (parent) {
      const prior = appearancesOf(history, value, value(history.graphAt(parent)), parent);
      const edit = prior.cut ? null : prior.commits.at(-1);
      const before = edit ? parentOf(edit) : null;
      out.cut = prior.cut;
      if (before && value(history.graphAt(before)) === value(history.graphAt(at))) {
        if (prior.unreached) out.unreached = true;
        else if (errorsOf(edit, before).errors.length) out.before = before;
      }
    }
    undoneKnown.set(at, out);
    return out;
  };
  /** The settled appearances of lifecycle value `now`, walking back from commit `from`. */
  const settledKnown = new Map();
  const settledFrom = (from, now) => {
    const key = `${from}\u0000${now}`;
    if (settledKnown.has(key)) return settledKnown.get(key);
    let { commits, cut, unreadAt, afterGap, afterRun, unreached } = appearancesOf(
      history,
      value,
      now,
      from,
    );
    const gaps = new Set(afterGap);
    const runs = new Set(afterRun);
    // Only an appearance that stays settled says its value follows unreadable commits;
    // one looked through as an undo leaves that to the appearances before it. Where
    // history cannot reach a commit, what lies there stays unknown either way.
    let unread = false;
    const unreadOf = new Set(unreadAt);
    const out = [];
    const seen = new Set();
    const stack = [...commits];
    while (stack.length) {
      const at = stack.pop();
      if (seen.has(at)) continue;
      seen.add(at);
      const undoes = undone(at);
      if (undoes.cut) cut = true;
      if (undoes.unreached) unreached = true;
      if (undoes.before === null) {
        out.push(at);
        if (unreadOf.has(at)) unread = true;
        continue;
      }
      const earlier = appearancesOf(history, value, now, undoes.before);
      if (earlier.cut) cut = true;
      for (const c of earlier.unreadAt) unreadOf.add(c);
      for (const c of earlier.afterGap) gaps.add(c);
      for (const c of earlier.afterRun) runs.add(c);
      if (earlier.unreached) unreached = true;
      stack.push(...earlier.commits);
    }
    if (unreached) unread = true;
    const rank = new Map([...history.nodes.keys()].map((c, i) => [c, i]));
    const result = {
      commits: out.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)),
      cut,
      unread,
      unreached,
      gaps,
      runs,
    };
    settledKnown.set(key, result);
    return result;
  };
  const settled = () => settledFrom(history.tip, value(history.graphAt(history.head)));
  return { errorsOf, parentOf, settled };
}

/**
 * Audit, from repository history, the change that produced each committed
 * process's current lifecycle state, and processes that disappeared. Errors: a
 * process added with a Status other than Proposed, any change after a retired
 * state, a transition outside the allowed set, a retirement without its
 * change-log line, Accepted→Proposed without a composition change, a removed
 * process, and a promotion to Accepted whose mechanical alignment gates did not
 * hold at that commit. A promotion whose gates held is indistinguishable from a
 * reviewed one and is not reported.
 *
 * @param {object} history From `readModelHistory` with the mapping path.
 * @param {(input: {index: object, mapping: object|null, processId: string, errors: object[], modelOnly: boolean}) => {blocking: string[]}} gates
 *   The alignment plan used to judge a promotion at its commit (`modelOnly` where
 *   history cannot read the index there).
 * @returns {object[]} findings `{level, code, where, element, msg}`.
 */
export function lifecycleHistoryFindings(history, gates) {
  return lifecycleHistoryAudit(history, gates).findings;
}

/**
 * `lifecycleHistoryFindings` with what history could not judge: per process, a
 * shallow clone that cut off where its current lifecycle value appeared, a value
 * that appeared where history cannot reach the model — or, with no error found,
 * right after documents that do not parse —, a promotion or re-dating whose
 * alignment gates history cannot read, or a retirement whose change-log line it
 * cannot see.
 *
 * @returns {{findings: object[], unjudged: {process: string, reason: string}[]}}
 */
export function lifecycleHistoryAudit(history, gates) {
  const findings = [];
  const unjudged = [];
  if (!history.available || !history.history?.available || !history.head)
    return { findings, unjudged };
  const head = history.graphAt(history.head);
  if (!head) return { findings, unjudged };
  const short = (c) => c.slice(0, 12);
  for (const p of head.ofType("Process")) {
    const id = elementId(p);
    const audit = processAudit(history, p, gates);
    const { commits, cut, unread, unreached, gaps, runs } = audit.settled();
    // Where a shallow clone cut the history off, or history cannot reach the model, what
    // came before is unknown. Right after documents that do not parse, the change is
    // judged from the readable commit before them.
    if (cut)
      unjudged.push({
        process: id,
        reason: "the clone is shallow and cuts off where its current lifecycle value appeared",
      });
    else if (unreached)
      unjudged.push({
        process: id,
        reason: "its current lifecycle value appeared where history cannot read the model",
      });
    for (const at of cut || unreached ? [] : commits) {
      const { errors, plan, unknownGates, unknownLog } = audit.errorsOf(at, audit.parentOf(at));
      if (unknownGates)
        unjudged.push({
          process: id,
          reason: `the alignment gates of its change at commit ${short(at)} cannot be read from history`,
        });
      if (unknownLog)
        unjudged.push({
          process: id,
          reason: `the change log at commit ${short(at)} or the commit before it lies behind a link history cannot follow, so its retirement's change-log line cannot be checked`,
        });
      for (const f of errors)
        findings.push({
          ...f,
          where: `commit ${short(at)}`,
          msg: `${f.msg}${plan?.blocking?.length && /alignment gates/.test(f.msg) ? `: ${plan.blocking.join("; ")}` : ""} (commit ${short(at)})`,
        });
    }
    // With nothing found, the value may have changed inside the documents that do not parse.
    if (!cut && !unreached && unread && !findings.some((f) => f.element === id))
      unjudged.push({
        process: id,
        reason:
          "its current lifecycle value appeared right after a commit whose model does not parse",
      });
    // A commit right after unreadable ones that HEAD differs from may follow a lifecycle
    // change hidden there, as the change flags count it.
    else if (
      !cut &&
      !unreached &&
      (runs.size > 0 ||
        [...gaps].some(
          (g) =>
            !sameKeys(
              compositionAndOpenScope(history.graphAt(g), p),
              compositionAndOpenScope(head, p),
            ),
        ))
    )
      unjudged.push({
        process: id,
        reason: "commits history cannot read may hide a lifecycle change before an edit since then",
      });
    // A retired process never comes back, however many commits the revival takes.
    if (!isRetired(head, p))
      for (const c of history.nodes.keys()) {
        const g = history.graphAt(c);
        if (g?.typeOf(p) === "Process" && isRetired(g, p)) {
          findings.push({
            level: "error",
            code: "process-lifecycle",
            where: `commit ${short(c)}`,
            element: id,
            msg: `the process was ${processStatus(g, p)} in commit ${short(c)} and is ${processStatus(head, p)} now; a retired process never becomes Proposed or Accepted again`,
          });
          break;
        }
      }
  }
  // A process that existed in history and is gone now was removed. One that is back
  // is judged above as one change, from its last state before the removal.
  const gone = new Map();
  for (const c of history.nodes.keys()) {
    const g = history.graphAt(c);
    if (!g) continue;
    for (const p of g.ofType("Process"))
      if (head.typeOf(p) !== "Process" && !gone.has(p)) gone.set(p, c);
  }
  for (const [p, c] of gone)
    findings.push({
      level: "error",
      code: "process-lifecycle",
      where: `commit ${short(c)}`,
      element: elementId(p),
      msg: `the process was removed after commit ${short(c)}; a process is retired (Deprecated or Superseded) and stays in the model`,
    });
  return { findings, unjudged };
}

// ── disposable output location ────────────────────────────────────────────

/**
 * Allocate a fresh run directory for a disposable artifact (a view or a review)
 * under `.adr-review/` in the repository, with its Git exclusion verified. When
 * the exclusion cannot be ensured, fall back to the system temporary directory
 * and say why.
 *
 * @param {string} root Repository directory.
 * @param {string} kind Short artifact kind, e.g. "process-view".
 * @returns {{dir: string, ignored: boolean, note?: string}}
 */
export function allocateRunDirectory(root, kind) {
  const base = path.join(root, ".adr-review");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  try {
    mkdirSync(base, { recursive: true });
    let ignored = true;
    try {
      git(["rev-parse", "--is-inside-work-tree"], root);
      const probe = path.join(base, `${stamp}-${kind}-probe`, "x.html");
      const check = (p) => {
        try {
          git(["check-ignore", "-q", p], root);
          return true;
        } catch {
          return false;
        }
      };
      if (!check(probe)) {
        const local = path.join(base, ".gitignore");
        if (!existsSync(local)) writeFileSync(local, "*\n");
        ignored = check(probe);
      }
      if (ignored && git(["ls-files", "--", ".adr-review"], root).trim()) ignored = false;
    } catch {
      if (!existsSync(path.join(base, ".gitignore")))
        writeFileSync(path.join(base, ".gitignore"), "*\n");
    }
    if (!ignored) throw new Error(".adr-review/ is not fully ignored by Git");
    return { dir: mkdtempSync(path.join(base, `${stamp}-${kind}-`)), ignored: true };
  } catch (error) {
    return {
      dir: mkdtempSync(path.join(tmpdir(), `${kind}-`)),
      ignored: false,
      note: `wrote outside the repository: ${error.message}`,
    };
  }
}
