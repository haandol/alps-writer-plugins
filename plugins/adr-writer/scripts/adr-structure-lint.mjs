#!/usr/bin/env node
// adr-structure-lint.mjs — deterministic self-test for ADR well-formedness.
//
// The companion to scripts/adr-invariants.sh. That script is the repo-wide
// one-way-dependency oracle (code→ADR, ADR→PRD reverse references, rollup
// stale citations). THIS harness is the per-ADR + mapping index structure
// checker: it parses each ADR body and docs/adr/.mapping.json (the single ADR
// index — the README carries no ADR list) and asserts the shape rules the LLM
// adr-reviewer would otherwise eyeball — the deterministic half of
// R1/R5a/R8/R10/R13/R14/R16 plus filename, path-depth, required-section, and
// mapping-status↔body checks, and R18's constant-identifier form. Judgment-only
// rules (R4 requirement gate + two-stage filter, R12 gray-zone fidelity, R14
// strawman nuance, R3 impl-detail, and R18's requirement-value-vs-tuning-value
// call) are NOT attempted here — they stay with the reviewer. In particular the
// harness never flags a bare number: deleting a requirement value is the failure
// mode this plugin cares most about, so only an LLM judges which numbers stay.
//
// It shells out to adr-invariants.sh (unless --no-invariants) so a single run
// covers reverse references too, folding that exit code into the aggregate.
//
// Usage:
//   node adr-structure-lint.mjs [--adr-dir docs/adr] [category] [--json]
//                               [--no-invariants | --documents-only] [--warn-as-error]
//
//   [category]        limit to one category key (e.g. identity/login)
//   --adr-dir DIR     ADR root (default: docs/adr)
//   --json            emit machine-readable JSON instead of the text report
//   --no-invariants   skip the adr-invariants.sh (a)/(b) sub-run
//   --documents-only  keep document checks, including ADR→PRD, without scanning code
//   --warn-as-error   treat warnings as failures (exit 1 on any warn)
//
// Exit: 0 = clean, 1 = at least one error (or warn with --warn-as-error),
//       2 = usage / environment error.
//
// Dependency-free: Node built-ins only, mirroring the plugin's zero-dep stance.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  ANTIPATTERN_SEGMENTS,
  SEEDED_RULE_DOCS,
  classifyStatus,
  checkFilename,
  categoryDepth,
  checkSections,
  countDrivers,
  countAlternatives,
  relatedLinkTargets,
  decisionLogLinkTargets,
  codeRefHits,
  constantAssignmentHits,
  validateMappingShape,
  sectionRange,
  numberingGaps,
  rulesVersion,
  compareVersions,
} from "./adr-lint-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── arg parse ─────────────────────────────────────────────────────────────
/** Select the requested evidence boundary; contradictory scan modes fail before reading files. */
function parseArgs(argv) {
  const opts = {
    adrDir: "docs/adr",
    category: null,
    json: false,
    invariants: true,
    documentsOnly: false,
    warnAsError: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--adr-dir") {
      const v = argv[++i];
      if (!v) usage(`--adr-dir requires a value`);
      opts.adrDir = v.replace(/\/+$/, "");
    } else if (a === "--json") opts.json = true;
    else if (a === "--no-invariants") opts.invariants = false;
    else if (a === "--documents-only") opts.documentsOnly = true;
    else if (a === "--warn-as-error") opts.warnAsError = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("--")) usage(`unknown flag: ${a}`);
    else if (!opts.category) opts.category = a;
    else usage(`unexpected argument: ${a}`);
  }
  if (opts.documentsOnly && !opts.invariants)
    usage("--documents-only cannot be combined with --no-invariants");
  return opts;
}

function usage(msg) {
  process.stderr.write(`adr-structure-lint: ${msg}\n`);
  process.exit(2);
}

function printHelp() {
  process.stdout.write(
    `adr-structure-lint — deterministic ADR structure checker\n\n` +
      `Usage: node adr-structure-lint.mjs [--adr-dir docs/adr] [category] [--json] [--no-invariants | --documents-only] [--warn-as-error]\n`,
  );
}

// ── finding collector ───────────────────────────────────────────────────
class Report {
  constructor() {
    this.items = [];
  }
  add(level, rule, where, msg) {
    this.items.push({ level, rule, where, msg });
  }
  error(rule, where, msg) {
    this.add("error", rule, where, msg);
  }
  warn(rule, where, msg) {
    this.add("warn", rule, where, msg);
  }
  get errors() {
    return this.items.filter((i) => i.level === "error");
  }
  get warns() {
    return this.items.filter((i) => i.level === "warn");
  }
}

// ── file discovery (recursive, capped at the ≤2-segment key depth) ────────
// Recursive so 2-segment feature sub-folder ADRs (identity/login/0001.md) are
// found — the flat glob docs/adr/*/*.md would miss them. An unreadable directory
// is skipped rather than fatal: a permission error on one sub-tree should not
// abort a whole-repo lint.
function findFiles(root, matches) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && matches(e.name)) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

// docs/adr/**/NNNN-*.md — the ADRs themselves.
const isAdrFile = (name) => /^[0-9]{4}-.*\.md$/.test(name);

// The per-category decision-log.md. Matched separately from an ADR so the log is
// never treated as one (it stays out of the index, numbering, orphan and per-ADR
// section checks) — the only thing checked is that its ADR pointers still
// resolve. The seed at the ADR root (decision-log.template.md) does not match
// this name, so scaffolding is excluded for free.
const isDecisionLog = (name) => name === "decision-log.md";

function readSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

// ── main ──────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rep = new Report();

  const adrRoot = opts.adrDir;
  if (!existsSync(adrRoot) || !statSync(adrRoot).isDirectory()) {
    // No ADR tree → nothing to lint. Not an error (a fresh repo hasn't run
    // /adr-new yet); say so and exit clean.
    finish(rep, opts, `no ADR directory: ${adrRoot} (no ADRs yet)`);
    return;
  }

  // ── load mapping ─────────────────────────────────────────────────────
  const mappingPath = path.join(adrRoot, ".mapping.json");
  let mapping = null;
  let mappingRaw = null;
  if (existsSync(mappingPath)) {
    mappingRaw = readSafe(mappingPath);
    try {
      mapping = JSON.parse(mappingRaw);
    } catch (e) {
      rep.error("mapping-parse", mappingPath, `failed to parse JSON: ${e.message}`);
    }
  } else {
    rep.warn(
      "mapping-missing",
      mappingPath,
      "mapping file is absent (proceeding from the ADR directories on disk)",
    );
  }

  // ── mapping shape (R16 + schema subset) ──────────────────────────────
  if (mapping) {
    for (const iss of validateMappingShape(mapping)) {
      if (iss.level === "error") rep.error(`map-${iss.code}`, mappingPath, iss.msg);
      else rep.warn(`map-${iss.code}`, mappingPath, iss.msg);
    }
  }

  // ── discover ADR files on disk ────────────────────────────────────────
  const files = findFiles(adrRoot, isAdrFile);
  // paths relative to repo root (docs/adr/...), forward-slashed for matching
  const relFromRepo = (p) => path.relative(process.cwd(), p).split(path.sep).join("/");
  const diskAdrs = new Set(files.map(relFromRepo));

  // mapping's declared ADR set + the Status it records per path. The adrs[]
  // records are the ADR index (path + Status + summary); the README carries no
  // separate list, so the harness reconciles disk ↔ mapping only, and cross-
  // checks each record's status against the ADR body below.
  const mappedAdrs = new Set();
  const mappedStatusByPath = new Map();
  if (mapping?.categories) {
    for (const entry of Object.values(mapping.categories))
      for (const rec of entry?.adrs || []) {
        const p = rec && typeof rec === "object" ? rec.path : rec;
        if (typeof p === "string" && p) {
          mappedAdrs.add(p);
          if (rec && typeof rec === "object" && "status" in rec)
            mappedStatusByPath.set(p, rec.status);
        }
      }
  }

  // ── category filter ───────────────────────────────────────────────────
  const inScope = (relPath) => {
    if (!opts.category) return true;
    const rel = relPath.replace(new RegExp(`^${escapeRe(adrRoot)}/`), "");
    const dir = rel.split("/").slice(0, -1).join("/");
    // a category is either the full dir (context/feature or flat context)
    return dir === opts.category || dir.startsWith(opts.category + "/");
  };

  // ── per-ADR checks ────────────────────────────────────────────────────
  // (Anti-pattern segments on mapping KEYS are covered by validateMappingShape;
  // the per-ADR loop below independently checks the on-disk DIRECTORY path so a
  // mapping-less repo is still linted.)
  for (const file of files) {
    const rel = relFromRepo(file);
    if (!inScope(rel)) continue;
    const relFromAdr = path.relative(adrRoot, file).split(path.sep).join("/");
    const where = rel;
    const base = path.basename(file);

    // filename canonicality
    const fn = checkFilename(base);
    if (!fn.ok) rep.error("filename", where, filenameMsg(fn));

    // path depth ≤2 category segments
    const depth = categoryDepth(relFromAdr);
    if (depth > 2)
      rep.error(
        "path-depth",
        where,
        `category is ${depth} segments deep (max 2 — 3-segment nesting is forbidden)`,
      );

    // R5a: anti-pattern segment on the directory path (works without mapping)
    const dirSegs = relFromAdr.split("/").slice(0, -1);
    for (const seg of dirSegs)
      if (ANTIPATTERN_SEGMENTS.has(seg))
        rep.error(
          "anti-pattern-dir",
          where,
          `directory segment "${seg}" is a technical layer name (forbidden)`,
        );

    const body = readSafe(file);
    if (body == null) {
      rep.error("read", where, "cannot read the file");
      continue;
    }

    // title header number == filename number
    const numFromName = base.slice(0, 4);
    const titleMatch = body.match(/^#\s+ADR\s+0*(\d+)\s*[:.]/m) || body.match(/^#\s+0*(\d+)[.:]/m);
    if (titleMatch) {
      const titleNum = String(titleMatch[1]).padStart(4, "0");
      if (titleNum !== numFromName)
        rep.error(
          "title-number",
          where,
          `title number (${titleNum}) does not match the filename number (${numFromName})`,
        );
    }

    // R1: Status enum/format + mapping-index agreement. The adrs[] record's
    // status is the single ADR-status index (README has none), so it must
    // mirror the body's ## Status line — adr-impl/adr-sync update both in
    // lockstep. A mismatch means the index went stale.
    const statusSec = sectionRange(body, (h) => h.text.trim() === "Status");
    if (!statusSec) rep.error("status-missing", where, "no ## Status section");
    else {
      const val = firstNonEmpty(statusSec.lines, statusSec.start + 1, statusSec.end);
      const st = classifyStatus(val);
      if (!st.ok)
        rep.error("status-enum", where, `Status "${val ?? ""}" — ${statusReason(st.reason)}`);
      else if (mapping?.categories && mappedStatusByPath.has(rel)) {
        const mapped = String(mappedStatusByPath.get(rel) || "").trim();
        if (mapped !== val)
          rep.error(
            "status-index-mismatch",
            where,
            `.mapping.json status "${mapped}" does not match the body's ## Status "${val}"`,
          );
      }
    }

    // required sections
    const secs = checkSections(body);
    for (const m of secs.missingHard)
      rep.error("section-missing", where, `missing required section: ## ${m}`);
    if (!secs.hasAlternatives)
      rep.warn("alternatives-missing", where, "no alternatives section (recommended)");
    if (!secs.hasDrivers)
      rep.warn("drivers-missing", where, "no Decision Drivers section (recommended)");

    // R13: Decision Drivers count 3-5
    const dr = countDrivers(body);
    if (dr.present && (dr.count < 3 || dr.count > 5))
      rep.warn("drivers-count", where, `${dr.count} Decision Drivers (3-5 recommended)`);

    // R14: alternatives ≥2 (count only; strawman is LLM)
    const alt = countAlternatives(body);
    if (alt.present && alt.count < 2)
      rep.error("alternatives-count", where, `${alt.count} alternative(s) (at least 2 required)`);

    // R10: Related-link targets resolve on disk
    for (const target of relatedLinkTargets(body)) {
      const resolved = path.resolve(path.dirname(file), target);
      if (!existsSync(resolved))
        rep.error("related-broken", where, `Related link target does not exist: ${target}`);
    }

    // R2: code-reference depth (advisory)
    for (const hit of codeRefHits(body))
      rep.warn(
        "code-ref-depth",
        `${where}:${hit.line}`,
        `suspected file-level code reference: ${hit.text}`,
      );

    // R18 (form half): a value written as a code constant. The value itself may
    // well belong here — requirement values must stay — but the identifier that
    // holds it does not. Advisory: the reviewer decides requirement vs tuning.
    for (const hit of constantAssignmentHits(body))
      rep.warn(
        "value-as-constant",
        `${where}:${hit.line}`,
        `value written in code-constant form: ${hit.text} — if it is a requirement value, rewrite it as a domain sentence (e.g. "a chat session is capped at 20 turns — pricing policy"); if it is an implementation tuning value, move it to the code`,
      );

    // R8 (disk→mapping): this file must be listed in .mapping.json adrs[].
    // .mapping.json is the single ADR index (README has no ADR list), so an
    // on-disk ADR missing from it is a hard orphan.
    if (mapping?.categories && !mappedAdrs.has(rel))
      rep.error("index-orphan-mapping", where, "absent from every adrs[] in .mapping.json");
  }

  // ── mapping→disk: every adrs[] path exists ────────────────────────────
  if (mapping?.categories) {
    for (const [key, entry] of Object.entries(mapping.categories)) {
      for (const rec of entry?.adrs || []) {
        const a = rec && typeof rec === "object" ? rec.path : rec;
        if (typeof a !== "string" || !a) continue; // shape errors already reported
        if (opts.category && !(key === opts.category || key.startsWith(opts.category + "/")))
          continue;
        if (!diskAdrs.has(a))
          rep.error(
            "mapping-dangling-adr",
            mappingPath,
            `adrs path for category "${key}" does not exist on disk: ${a}`,
          );
      }
    }
  }

  // ── numbering gaps (rollup advisory, warning-only) ────────────────────
  // Group in-scope on-disk ADRs by category (directory under the ADR root) and
  // flag any category whose NNNN sequence has a hole. This is NOT an error:
  // split/adr-sync intentionally keep gaps ("keep gaps"). It's a heads-up that
  // if adr-rollup just deleted a chain member, its step 7 renumber may be
  // pending — the rollup skill reads this warning and asks the user whether to
  // fill the gap. Skipped when --category narrows to one leaf with no siblings.
  {
    const byCategory = new Map();
    for (const file of files) {
      const rel = relFromRepo(file);
      if (!inScope(rel)) continue;
      const relFromAdr = path.relative(adrRoot, file).split(path.sep).join("/");
      const cat = relFromAdr.split("/").slice(0, -1).join("/") || "(root)";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(path.basename(file));
    }
    for (const g of numberingGaps(byCategory))
      rep.warn(
        "numbering-gap",
        `docs/adr/${g.category}`,
        `numbering gap: ${g.missing.map((n) => String(n).padStart(4, "0")).join(", ")} missing ` +
          `(present: ${g.present.map((n) => String(n).padStart(4, "0")).join(", ")}). ` +
          `If you just ran adr-rollup, its step-7 renumber may still be pending — ask the user whether to close the gap. ` +
          `(A gap left by split or adr-sync is normal; leave it alone.)`,
      );
  }

  // ── decision-log ADR pointers resolve on disk ─────────────────────────
  // The log is a convention file (no NNNN- name, absent from .mapping.json), so
  // no per-ADR check reads it — yet adr-rollup's step 7 renumber moves the very
  // ADR its "current ADR" pointer names. A missed repoint left a log pointing at a
  // deleted path with a clean harness: the stale-citation finder matches the
  // "<cat>/NNNN" token form while the log links relatively ("./0001-x.md"), and
  // R10 only reads NNNN-*.md bodies. Error, not warning: a log whose pointer is
  // dead has lost the one reference that makes the entry traceable.
  for (const logFile of findFiles(adrRoot, isDecisionLog)) {
    const rel = relFromRepo(logFile);
    if (!inScope(rel)) continue;
    const body = readSafe(logFile);
    if (body === null) continue;
    for (const target of decisionLogLinkTargets(body)) {
      if (!existsSync(path.resolve(path.dirname(logFile), target))) {
        rep.error(
          "decision-log-link-broken",
          rel,
          `decision-log link target does not exist: ${target} (after a rollup renumber, repoint the "current ADR" pointer to the new path)`,
        );
      }
    }
  }

  // ── seeded rule docs trail the installed plugin ───────────────────────
  // /adr-new seeds these only when absent, so a repo seeded once keeps the rule
  // set it got that day forever. Every rule added upstream then stops existing
  // for that repo — and because the docs ARE the source of truth every reviewer
  // reads, the axis does not fail loudly, it just goes unjudged. Warning rather
  // than error: stale rules do not make an ADR wrong, and a repo may deliberately
  // pin or hand-edit its copy. Reported once for the doc set, not per ADR.
  {
    const installed = readSafe(path.join(HERE, "..", ".claude-plugin", "plugin.json"));
    let pluginVersion = null;
    if (installed !== null) {
      try {
        pluginVersion = JSON.parse(installed).version ?? null;
      } catch {
        pluginVersion = null; // an unreadable manifest is not the linted repo's fault
      }
    }
    if (pluginVersion) {
      const stale = [];
      let present = 0;
      let stamped = 0;
      for (const doc of SEEDED_RULE_DOCS) {
        const body = readSafe(path.join(adrRoot, doc));
        if (body === null) continue; // absent docs are /adr-new's seeding step, not this check
        present++;
        const seeded = rulesVersion(body);
        if (seeded === null) continue; // hand-written or pre-stamp copy — nothing to compare
        stamped++;
        if (compareVersions(seeded, pluginVersion) < 0) stale.push(`${doc} (${seeded})`);
      }
      if (stale.length) {
        rep.warn(
          "rules-doc-stale",
          `docs/adr`,
          `seeded rule docs trail the installed plugin (${pluginVersion}): ${stale.join(", ")}. ` +
            `Rules added upstream since then are absent from this repo, so reviewers cannot judge those axes ` +
            `against its own source of truth. Re-seed from \${CLAUDE_PLUGIN_ROOT}/templates/adr/, keeping any ` +
            `local edits you meant to keep.`,
        );
      } else if (present > 0 && stamped === 0) {
        rep.warn(
          "rules-doc-unstamped",
          `docs/adr`,
          `no rule doc carries an adr-writer:rules-version stamp, so staleness cannot be detected. ` +
            `These docs predate the stamp — re-seed from \${CLAUDE_PLUGIN_ROOT}/templates/adr/ to pick it up.`,
        );
      }
    }

    // 0.5.0 split the seeded docs by role: README.md is the directory index,
    // concepts.md is the working model (the abstraction ladder, the gray zone,
    // the dependency model, Status transitions). A repo seeded before that has
    // all of it inside README.md and no concepts.md at all.
    //
    // The stale-stamp check above cannot catch this: it only compares docs that
    // are PRESENT, and skips an absent one as "/adr-new's seeding job". So the
    // one doc a reader is told to open first would go unreported precisely when
    // it does not exist. Call it out by name instead — reviewers cite concepts.md
    // sections, and against the old layout every one of those citations misses.
    const readmeBody = readSafe(path.join(adrRoot, "README.md"));
    if (readmeBody !== null) {
      const conceptsBody = readSafe(path.join(adrRoot, "concepts.md"));
      // Headings that moved to concepts.md in 0.5.0. Matched at heading position
      // so a passing mention in prose ("see the gray zone") is not a hit.
      const MOVED = [
        [/^#{2,3}\s+.*gray zone/im, "the gray zone"],
        [/^#{2,3}\s+.*[Dd]ependencies run one way/m, "the dependency model"],
        [/^#{2,3}\s+Status\s*$/m, "Status + automatic transitions"],
        [/^#{2,3}\s+.*regeneration test/im, "the regeneration test"],
      ];
      // Strip fenced blocks first: README legitimately keeps the ADR template,
      // and that fence contains a literal "## Status" heading for authors to
      // copy. Matching it would flag the correct layout as duplicated.
      const readmeProse = readmeBody.replace(/^```[\s\S]*?^```/gm, "");
      const leftover = MOVED.filter(([re]) => re.test(readmeProse)).map(([, name]) => name);
      if (conceptsBody === null) {
        rep.warn(
          "rules-doc-layout-legacy",
          `docs/adr`,
          `concepts.md is missing: this repo predates the README/concepts split. The working model ` +
            `(abstraction ladder, gray zone, dependency model, Status transitions) now lives in ` +
            `docs/adr/concepts.md while README.md is the index — so prompts citing "concepts.md <section>" ` +
            `find nothing here. Run /adr-new to seed concepts.md and shrink README.md to the index, ` +
            `carrying over any hand-edits in the moved sections. Until then every reader falls back ` +
            `to README.md, so nothing breaks.`,
        );
      } else if (leftover.length) {
        // Both files exist but README still holds sections concepts.md now owns.
        // This is worse than the not-yet-migrated case: two copies of the same
        // rule can disagree, and a reader has no way to tell which went stale —
        // the exact duplication the abstraction ladder forbids.
        rep.warn(
          "rules-doc-layout-duplicated",
          `docs/adr`,
          `README.md still holds sections that concepts.md now owns (${leftover.join(", ")}). ` +
            `Two copies of one rule can drift apart with no way to tell which is current. ` +
            `Delete them from README.md — keep it as the index (what an ADR is, the template, ` +
            `where the ADR list lives) — after checking concepts.md carries any edits you made here.`,
        );
      }
    }
  }

  // ── adr-invariants.sh (a)/(b) sub-run ─────────────────────────────────
  let invExit = 0;
  if (opts.invariants) {
    const invScript = path.join(HERE, "adr-invariants.sh");
    const invariantArgs = [invScript, "--adr-dir", adrRoot];
    if (opts.documentsOnly) invariantArgs.push("--prd-only");
    const r = spawnSync("bash", invariantArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    invExit = r.status ?? -1;
    if (invExit === 2) {
      rep.error(
        "invariants-env",
        invScript,
        `adr-invariants.sh environment error (exit 2): ${(r.stderr || "").trim()}`,
      );
    } else if (invExit === 1) {
      // fold each reported reverse-ref line as an error
      for (const line of (r.stdout || "").split("\n")) {
        const t = line.trim();
        if (t && !t.startsWith("✓")) rep.error("invariants", invScript, t);
      }
    } else if (invExit < 0) {
      rep.error(
        "invariants-spawn",
        invScript,
        "failed to run adr-invariants.sh (check bash and the script)",
      );
    }
  }

  finish(rep, opts, files.length === 0 ? "no ADR files to check" : null);
}

// ── helpers ────────────────────────────────────────────────────────────────
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstNonEmpty(lines, start, end) {
  for (let i = start; i < end; i++) {
    const t = lines[i].trim();
    if (t) return t;
  }
  return null;
}

function filenameMsg(fn) {
  const map = {
    "stale-fN-prefix":
      "stale fN- prefix in the filename (Feature IDs never go in filenames or category keys — canonical is NNNN-kebab-title.md)",
    uppercase: "uppercase in the filename (kebab-case only)",
    "not-canonical": "not canonical form (NNNN-kebab-case-title.md)",
  };
  return `${fn.basename} — ${map[fn.reason] || fn.reason}`;
}

function statusReason(reason) {
  return (
    {
      empty: "value is empty",
      "informal-status": "informal status (Implemented/Done/Completed are forbidden)",
      "proposed-should-not-carry-date": "Proposed carries no date",
      "missing-date": "missing date (Accepted/Deprecated require (YYYY-MM-DD))",
      "date-only":
        "parentheses carry the date only (Accepted/Deprecated (YYYY-MM-DD) — no trailing references, explanations, or feature IDs)",
      "superseded-needs-adr-link":
        "Superseded requires a link to the successor ADR (Superseded by [ADR ...](link))",
      unrecognized: "not an allowed Status value (Proposed/Accepted/Deprecated/Superseded)",
    }[reason] || reason
  );
}

function finish(rep, opts, note) {
  const failed = rep.errors.length > 0 || (opts.warnAsError && rep.warns.length > 0);
  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        { ok: !failed, errors: rep.errors, warnings: rep.warns, note: note || undefined },
        null,
        2,
      ) + "\n",
    );
  } else {
    const lines = [];
    lines.push(`## ADR Structure Lint`);
    if (note) lines.push(`- ${note}`);
    if (rep.errors.length) {
      lines.push(`\n### ✗ Errors (${rep.errors.length})`);
      for (const e of rep.errors) lines.push(`- [${e.rule}] ${e.where}\n    ${e.msg}`);
    }
    if (rep.warns.length) {
      lines.push(`\n### ⚠ Warnings (${rep.warns.length})`);
      for (const w of rep.warns) lines.push(`- [${w.rule}] ${w.where}\n    ${w.msg}`);
    }
    if (!rep.errors.length && !rep.warns.length) lines.push(`\n✓ ADR structure clean`);
    else if (!rep.errors.length)
      lines.push(`\n✓ no errors${rep.warns.length ? ` (${rep.warns.length} warning(s))` : ""}`);
    process.stdout.write(lines.join("\n") + "\n");
  }
  process.exit(failed ? 1 : 0);
}

main();
