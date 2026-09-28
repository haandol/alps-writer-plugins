// adr-lint-lib.mjs — pure, dependency-free checkers shared by the
// adr-structure-lint CLI and the node:test suite. Nothing here touches the
// filesystem or process; every function takes strings/objects and returns
// plain data, so the same logic is exercised by tests (against fixtures) and
// by the harness (against a project's real docs/adr).
//
// The deterministic checks here are the ones the LLM adr-reviewer can OFFLOAD
// (R1 Status enum, R5a anti-pattern key, R8 index/mapping presence, R10
// Related-link existence, R13/R14 counts, R16 dependsOn integrity, R18's
// constant-identifier form, plus filename / path-depth / required-section
// shape). Judgment-only rules (R4 requirement gate + two-stage filter, R12
// gray-zone fidelity, R14 strawman nuance, R3, and R18's requirement-vs-tuning
// call) stay with the reviewer — see agents/adr-reviewer.md.

// ── category-key shape ───────────────────────────────────────────────────
// ≤2 lowercase-kebab segments (context or context/feature). Stricter than a
// bare [a-z0-9-]+ : rejects leading/trailing hyphens and empty segments, and
// caps depth at two. Matches the pattern seeded into mapping.schema.json
// (propertyNames.pattern). Feature-ID fallback keys (f1, f-auth-01) pass.
export const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)?$/;

// Technical-layer / work-type names banned as EITHER category segment
// (structure.md "Anti-pattern categories"). vertical-slice tracing breaks when a
// feature's decision is split along these.
export const ANTIPATTERN_SEGMENTS = new Set([
  "frontend",
  "backend",
  "mobile",
  "web",
  "api",
  "ui",
  "db",
  "cache",
  "controllers",
  "services",
  "repositories",
  "bugfix",
  "refactor",
]);

// Recognized entry field names (mapping.schema.json). Unknown keys are typos
// that silently drop dependsOn/subdomainType, so the harness flags them (the
// schema also sets additionalProperties:false). adr-writer is standalone —
// there is no ALPS/PRD field here (an imported feature's name lives in
// `feature`, treated as a plain label, never a PRD back-reference).
export const KNOWN_ENTRY_FIELDS = new Set([
  "feature",
  "subdomainType",
  "adrs",
  "dependsOn",
  "tableDocs",
]);

// Recognized fields on an adrs[] index record (mapping.schema.json adrs.items).
// Each record indexes one ADR: its path, its Status (mirrors the ADR body), and
// an optional one-line Key Decision summary.
export const KNOWN_ADR_ITEM_FIELDS = new Set(["path", "status", "summary"]);

export const SUBDOMAIN_TYPES = new Set(["core", "supporting", "generic"]);

// ── the seeded rule-doc set ───────────────────────────────────────────────
// The docs /adr-new copies into a project's docs/adr/. These are what the
// staleness check below compares against the installed plugin version, and what
// a test/eval fixture must seed to be judged by the rules a real repo holds.
// One list, because four copies of it drifted in ordering already and a repo
// linted against a shorter set has axes that simply go unjudged.
export const SEEDED_RULE_DOCS = ["README.md", "concepts.md", "authoring-rules.md", "structure.md"];

// The docs that carry a rules-version stamp — the seeded set PLUS the decision
// log template. The log template is stamped (bump-version rewrites it) but is
// NOT part of the staleness comparison: it is scaffolding a category copies and
// edits, so a project's copy is expected to diverge from the plugin's.
export const STAMPED_RULE_DOCS = [...SEEDED_RULE_DOCS, "decision-log.template.md"];
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

// Sections the README ADR template marks as the load-bearing spine. HARD =
// must be present (structural well-formedness). SOFT = expected but their
// absence is advisory (Decision Drivers / alternatives / Related — their deeper quality
// is an LLM call, so only presence is checked, and only as a warning).
export const HARD_SECTIONS = ["Status", "Purpose", "Decision", "Consequences"];

// ── dependsOn graph integrity (R16) ──────────────────────────────────────
// These three lived only inside tests/mapping.test.mjs; promoted here so the
// harness runs the SAME logic over a project's real .mapping.json.

// keys referenced in some dependsOn that do not exist as a category key.
export function dependsOnDangling(mapping) {
  const cats = mapping?.categories || {};
  const keys = new Set(Object.keys(cats));
  const bad = [];
  for (const [k, e] of Object.entries(cats))
    for (const d of e?.dependsOn || []) if (!keys.has(d)) bad.push(`${k}→${d}`);
  return bad;
}

// entries that list themselves in dependsOn (self-edge — schema: "no self-edge").
// Reported separately from a multi-node cycle because the fix differs.
export function selfEdges(mapping) {
  const cats = mapping?.categories || {};
  const bad = [];
  for (const [k, e] of Object.entries(cats)) if ((e?.dependsOn || []).includes(k)) bad.push(k);
  return bad;
}

// true when the dependsOn digraph has any cycle (self-loop or longer back-edge).
// DFS with on-stack (state 1) coloring. Mirrors the checker adr-sync step 6 and
// feature-to-adr step 1 promise to run.
export function hasCycle(mapping) {
  const g = mapping?.categories || {};
  const state = {}; // 0/undef = unvisited, 1 = on-stack, 2 = done
  let cyclic = false;
  const dfs = (n) => {
    if (!g[n]) return;
    state[n] = 1;
    for (const m of g[n].dependsOn || []) {
      if (state[m] === 1) cyclic = true;
      else if (!state[m]) dfs(m);
    }
    state[n] = 2;
  };
  for (const n of Object.keys(g)) if (!state[n]) dfs(n);
  return cyclic;
}

// ── Status line (R1 enum/format half) ────────────────────────────────────
// The code-reality half of R1 ("does the described behavior exist in code?")
// is LLM/adr-sync territory; only the closed vocabulary + date convention is
// deterministic here. README "Status" + "Automatic transition rules":
//   Proposed                                (never dated)
//   Accepted (YYYY-MM-DD)                    (parentheses hold ONLY the date)
//   Deprecated (YYYY-MM-DD)                  (parentheses hold ONLY the date)
//   Superseded by [ADR ...](...)            (successor link, not a date)
// Informal states (Implemented/Done/Completed) are explicitly banned. The
// Accepted/Deprecated parentheses carry the transition DATE ONLY — no extra
// reference, feature id, or note (e.g. "Accepted (2026-07-09, F1)"): the anchors
// on the matchers reject anything after the date, and the near-miss branch below
// diagnoses it as "date-only" so the report says exactly what to strip.
const STATUS_MATCHERS = [
  /^Proposed$/,
  /^Accepted \(\d{4}-\d{2}-\d{2}\)$/,
  /^Deprecated \(\d{4}-\d{2}-\d{2}\)$/,
  /^Superseded by \[ADR [^\]]+\]\([^)]+\)$/,
];

export function classifyStatus(statusValue) {
  // Coerce defensively: .mapping.json is hand/LLM-edited, so a forgotten-quotes
  // status ("status": 2026) or a boolean arrives as a non-string. A bare
  // (statusValue || "").trim() would throw on any truthy non-string and abort
  // the whole harness; instead stringify so it falls through to a reportable
  // enum error (validateMappingShape → adrs-item-status-enum). null/undefined
  // → "" (empty). The body-Status call site only ever passes string|null.
  const v = (
    typeof statusValue === "string" ? statusValue : statusValue == null ? "" : String(statusValue)
  ).trim();
  if (!v) return { ok: false, reason: "empty" };
  if (STATUS_MATCHERS.some((re) => re.test(v))) return { ok: true, value: v };
  // Diagnose the common near-misses so the report is actionable.
  if (/^(Implemented|Done|Completed)\b/i.test(v))
    return { ok: false, reason: "informal-status", value: v };
  if (/^Proposed\s*\(/.test(v))
    return { ok: false, reason: "proposed-should-not-carry-date", value: v };
  if (/^Accepted$/.test(v) || /^Deprecated$/.test(v))
    return { ok: false, reason: "missing-date", value: v };
  // Accepted/Deprecated with a parenthetical that is NOT exactly (YYYY-MM-DD):
  // a mis-formatted date, or — the common offender — the date followed by extra
  // text/reference ("Accepted (2026-07-09) — F1", "Accepted (2026-07-09, ref)").
  // The parentheses must hold the date and nothing else.
  if (/^(Accepted|Deprecated)\b/.test(v)) return { ok: false, reason: "date-only", value: v };
  if (/^Superseded\b/.test(v)) return { ok: false, reason: "superseded-needs-adr-link", value: v };
  return { ok: false, reason: "unrecognized", value: v };
}

// ── filename canonicality ─────────────────────────────────────────────────
// authoring-rules "Conventions": NNNN-kebab-case-title.md, and NO Feature ID in
// the filename (the stale fN- prefix adr-sync 3.7 case (1) fixes).
export function checkFilename(basename) {
  const canonical = /^[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$/;
  const staleFn = /^[0-9]{4}-f[0-9]+-/i;
  if (staleFn.test(basename)) return { ok: false, reason: "stale-fN-prefix", basename };
  if (!canonical.test(basename)) {
    if (/[A-Z]/.test(basename)) return { ok: false, reason: "uppercase", basename };
    return { ok: false, reason: "not-canonical", basename };
  }
  return { ok: true, basename };
}

// ── numbering gaps (rollup advisory) ──────────────────────────────────────
// Given ADR file basenames grouped per category, report categories whose NNNN
// sequence is non-contiguous (a gap or a missing 0001). This is ADVISORY only:
// split/adr-sync legitimately leave gaps ("keep gaps, never renumber"), so a gap
// is NOT an error — it's a signal that, if we just ran adr-rollup, step 7
// (renumber) may have been skipped. The lint surfaces it as a warning and the
// rollup skill asks the user whether to fill it.
//   filesByCategory: Map<categoryKey, string[] basenames> (or plain object).
// Returns [{ category, present:[nums], missing:[nums], expectedMax }] for each
// category with a gap; empty when every category is contiguous from 0001.
export function numberingGaps(filesByCategory) {
  const entries =
    filesByCategory instanceof Map
      ? [...filesByCategory.entries()]
      : Object.entries(filesByCategory || {});
  const out = [];
  for (const [category, basenames] of entries) {
    const nums = [];
    for (const b of basenames || []) {
      const m = /^(\d{4})-/.exec(b);
      if (m) nums.push(parseInt(m[1], 10));
    }
    if (nums.length === 0) continue;
    const uniq = [...new Set(nums)].sort((a, b) => a - b);
    const max = uniq[uniq.length - 1];
    const missing = [];
    for (let n = 1; n <= max; n++) if (!uniq.includes(n)) missing.push(n);
    if (missing.length > 0) out.push({ category, present: uniq, missing, expectedMax: max });
  }
  return out;
}

// ── path depth ────────────────────────────────────────────────────────────
// structure.md: at most 2 category segments → at most 2 DIRECTORY levels
// between the ADR root and the file. e.g. identity/login/0001.md = 2 (ok);
// identity/login/social/0001.md = 3 (fail — "at most one level deep" for sub-folders).
// relPath is the ADR path relative to the ADR root (no leading docs/adr/).
export function categoryDepth(relPath) {
  const parts = relPath.split("/").filter(Boolean);
  return Math.max(0, parts.length - 1); // drop the filename
}

// ── anti-pattern segment check (R5a) ──────────────────────────────────────
// A key (or a docs/adr directory path relative to root) must be ≤2 kebab
// segments with no technical-layer segment. Slice-coherence (R5b/c) is LLM.
export function checkCategoryKey(key) {
  const issues = [];
  if (!KEY_RE.test(key)) issues.push({ reason: "bad-shape", key });
  const segs = key.split("/");
  if (segs.length > 2) issues.push({ reason: "too-deep", key });
  for (const s of segs)
    if (ANTIPATTERN_SEGMENTS.has(s))
      issues.push({ reason: "anti-pattern-segment", key, segment: s });
  return issues;
}

// ── markdown heading model ────────────────────────────────────────────────
// Parse ATX headings, ignoring lines inside fenced code blocks (``` or ~~~) so
// a "## foo" inside a code sample isn't mistaken for a section.
export function parseHeadings(body) {
  const lines = body.split(/\r?\n/);
  const heads = [];
  let fence = null; // current fence marker when inside a code block
  lines.forEach((line, i) => {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) {
      if (fence && line.trim().startsWith(fence)) fence = null;
      else if (!fence) fence = f[1];
      return;
    }
    if (fence) return;
    const m = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (m) heads.push({ level: m[1].length, text: m[2], line: i });
  });
  return { lines, heads };
}

// Return the line range [start, end) of the section whose heading matches
// `pred`, ending at the next heading of the SAME-or-higher level. null if none.
export function sectionRange(body, pred) {
  const { lines, heads } = parseHeadings(body);
  const idx = heads.findIndex((h) => pred(h));
  if (idx === -1) return null;
  const start = heads[idx].line;
  const level = heads[idx].level;
  let end = lines.length;
  for (let j = idx + 1; j < heads.length; j++) {
    if (heads[j].level <= level) {
      end = heads[j].line;
      break;
    }
  }
  return { start, end, lines, heading: heads[idx] };
}

// The alternatives heading, in either language. Harness prompts and rule docs
// are English, but an ADR body follows the language the user writes in
// (authoring-rules "Conventions"), so a Korean-authored ADR titles this section
// "대안 검토" and an English-authored one "Alternatives". Matching only one
// spelling would report `alternatives-missing` on a perfectly good ADR and let
// R14's count check silently skip it.
const ALTERNATIVES_HEADING = /^(?:대안\s*검토|alternatives(?:\s*[-—:].*)?)$/i;

/** Check the document spine while accepting Context as the legacy Purpose heading. */
export function checkSections(body) {
  const { heads } = parseHeadings(body);
  const h2 = new Set(heads.filter((h) => h.level === 2).map((h) => h.text.trim()));
  if (h2.has("Context")) h2.add("Purpose");
  const missingHard = HARD_SECTIONS.filter((s) => !h2.has(s));
  const hasDrivers = h2.has("Decision Drivers");
  // The alternatives section is authored at ## or ### depending on the template variant.
  const hasAlternatives = heads.some(
    (h) => h.level >= 2 && h.level <= 4 && ALTERNATIVES_HEADING.test(h.text.trim()),
  );
  const hasRelated = h2.has("Related");
  return { missingHard, hasDrivers, hasAlternatives, hasRelated };
}

// ── Decision Drivers count (R13 numeric envelope) ─────────────────────────
export function countDrivers(body) {
  const sec = sectionRange(body, (h) => h.text.trim() === "Decision Drivers");
  if (!sec) return { present: false, count: 0 };
  let count = 0;
  for (let i = sec.start + 1; i < sec.end; i++) if (/^\s*[-*]\s+\S/.test(sec.lines[i])) count++;
  return { present: true, count };
}

// ── alternatives count (R14 — count only; strawman detection is LLM) ──────
// Alternatives are authored as a table, a bullet list, or #### option blocks.
// Take the strongest structural signal available so a table-based ADR and a
// bullet-based one both yield a sensible count.
export function countAlternatives(body) {
  const sec = sectionRange(body, (h) => ALTERNATIVES_HEADING.test(h.text.trim()));
  if (!sec) return { present: false, count: 0 };
  let bullets = 0;
  let subheads = 0;
  let tableRows = 0;
  let tableSeen = false;
  for (let i = sec.start + 1; i < sec.end; i++) {
    const l = sec.lines[i];
    if (/^\s*[-*]\s+\S/.test(l)) bullets++;
    if (/^#{4}\s+\S/.test(l)) subheads++;
    if (/^\s*\|.*\|\s*$/.test(l)) {
      // skip the header separator row (|---|---|)
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) tableSeen = true;
      else tableRows++;
    }
  }
  // In a table, the first non-separator row is the header → subtract it.
  const tableCount = tableSeen ? Math.max(0, tableRows - 1) : 0;
  const count = Math.max(bullets, subheads, tableCount);
  return { present: true, count };
}

// ── local markdown link targets ───────────────────────────────────────────
// Every markdown link in `text` that points at something on disk: external and
// in-page targets are skipped and anchors stripped, leaving a path the CLI can
// resolve. Shared by the two link checks below (R10's Related section and the
// decision log), which differ only in what they scan and what they exclude.
function localLinkTargets(text) {
  const out = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#)/i.test(target)) continue; // external / in-page
    target = target.split("#")[0].trim(); // drop anchor
    if (target) out.push(target);
  }
  return out;
}

// ── Related-link targets (R10) ────────────────────────────────────────────
// markdown links inside the ## Related section only — a link elsewhere in the
// body is not an R10 subject.
export function relatedLinkTargets(body) {
  const sec = sectionRange(body, (h) => h.text.trim() === "Related");
  if (!sec) return [];
  return localLinkTargets(sec.lines.slice(sec.start + 1, sec.end).join("\n"));
}

// ── code-reference depth (R2 — advisory heuristic) ────────────────────────
// authoring-rules "Code references — folder level only": no file-level path or
// file:line citation. FP-prone (must not flag .md Related/table links), so the
// CLI emits these as WARN, not ERROR — the reviewer confirms true violations.
const SRC_EXT = "tsx?|jsx?|go|py|java|rb|rs|c|cc|cpp|h|hpp|cs|kt|swift|php|scala|sql|sh|ya?ml|toml";
export function codeRefHits(body) {
  const all = body.split(/\r?\n/);
  const hits = [];
  const pathRe = new RegExp(`[\\w./-]+\\.(?:${SRC_EXT})\\b`);
  const lineCiteRe = /[\w./-]+\.[a-z0-9]+:[0-9]+/;
  all.forEach((line, i) => {
    // Skip markdown-link targets pointing at .md (Related/table docs are allowed).
    const stripped = line.replace(/\([^)]*\.md[^)]*\)/g, "");
    if (pathRe.test(stripped) || lineCiteRe.test(stripped))
      hits.push({ line: i + 1, text: line.trim().slice(0, 120) });
  });
  return hits;
}

// ── requirement value expressed as a code constant (R18 — advisory) ───────
// authoring-rules "Concrete numbers": a requirement value BELONGS in the ADR, but
// written as a domain sentence ("a chat session is capped at 20 turns — pricing policy"), never
// as the code identifier that happens to hold it today. The identifier is the
// code's to name and rename; the requirement is not.
//
// Only the identifier FORM is deterministic. Whether a number is a requirement
// value (keep) or an implementation tuning value (drop) is a judgment call that
// stays with the reviewer (R18 in agents/adr-reviewer.md) — the harness never
// flags a bare number, so it cannot push an author into deleting a requirement.
// WARN, not ERROR: an API/enum table may legitimately carry SCREAMING_SNAKE
// tokens (error codes, enum members), which the reviewer distinguishes.
//
// Two forms, deliberately asymmetric. A SCREAMING_SNAKE identifier is unambiguous
// enough to flag under either `=` or `:`. A single all-caps word only counts under
// `=`, because the colon form is how requirement prose legitimately labels a value
// ("SLA: 99.9%", "TTL: 7 days") and flagging that would push authors to delete it.
const CONST_ASSIGN_RE =
  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b\s*[:=]\s*[{[]?\s*-?\d|\b[A-Z][A-Z0-9_]{2,}\b\s*=\s*[{[]?\s*-?\d/;
export function constantAssignmentHits(body) {
  const hits = [];
  let inFence = false;
  body.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return; // fenced blocks are caught by the impl-detail rule (R3)
    if (CONST_ASSIGN_RE.test(line)) hits.push({ line: i + 1, text: line.trim().slice(0, 120) });
  });
  return hits;
}

// ── mapping.json shape (subset of mapping.schema.json, hand-rolled) ───────
// No JSON-schema lib is vendored. Assert the load-bearing shape the skills and
// hook depend on. Returns an array of {level, code, msg}.
export function validateMappingShape(mapping) {
  const issues = [];
  const err = (code, msg) => issues.push({ level: "error", code, msg });
  const warn = (code, msg) => issues.push({ level: "warn", code, msg });

  if (mapping == null || typeof mapping !== "object") {
    err("not-object", ".mapping.json is not a JSON object");
    return issues;
  }
  const cats = mapping.categories;
  if (cats == null || typeof cats !== "object" || Array.isArray(cats)) {
    err("no-categories", "missing or non-object `categories`");
    return issues;
  }
  // Only $schema + categories are allowed at the top level (schema:
  // additionalProperties:false). Flag a leftover ALPS/PRD field — the common
  // case is a legacy mapping that still carries top-level `alpsDocument`, which
  // must not silently survive migration to the standalone (no-PRD-link) shape.
  for (const k of Object.keys(mapping))
    if (k !== "$schema" && k !== "categories")
      err(
        "unknown-top-level-field",
        `unknown top-level field "${k}" (only $schema + categories allowed)`,
      );

  const seenAdrs = new Map(); // path → keys, to detect a file indexed twice
  for (const [key, entry] of Object.entries(cats)) {
    for (const iss of checkCategoryKey(key))
      err(
        `key-${iss.reason}`,
        `category key "${key}": ${iss.reason}${iss.segment ? ` (${iss.segment})` : ""}`,
      );
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      err("entry-not-object", `category "${key}" entry is not an object`);
      continue;
    }
    if ("feature" in entry) {
      if (typeof entry.feature !== "string")
        err("feature-type", `category "${key}": feature must be a string`);
      else if (entry.feature.length > 240 || CONTROL_CHAR_RE.test(entry.feature))
        err(
          "feature-unsafe",
          `category "${key}": feature must be one line and at most 240 characters`,
        );
    }
    // adrs: required (key present), array of index records, unique. Empty
    // allowed — a context-grouping entry may hold no context-direct ADR (its
    // ADRs live in feature sub-folder entries). Each record is an object with a
    // required path + Status and an optional one-line summary (the array IS the
    // ADR index; the README carries no separate list). See mapping.schema.json.
    if (!("adrs" in entry)) err("adrs-missing", `category "${key}": required "adrs" field absent`);
    else if (!Array.isArray(entry.adrs))
      err("adrs-not-array", `category "${key}": "adrs" is not an array`);
    else {
      for (const rec of entry.adrs) {
        if (rec == null || typeof rec !== "object" || Array.isArray(rec)) {
          err("adrs-item-type", `category "${key}": adrs item is not an object {path,status,...}`);
          continue;
        }
        if (typeof rec.path !== "string" || !rec.path) {
          err("adrs-item-path", `category "${key}": adrs item missing string "path"`);
          continue;
        }
        if (
          rec.path.length > 320 ||
          CONTROL_CHAR_RE.test(rec.path) ||
          pathIsAbsoluteOrTraverses(rec.path)
        ) {
          err(
            "adrs-item-path-unsafe",
            `category "${key}": adrs path must be a project-relative, single-line path`,
          );
        }
        if (!("status" in rec)) {
          err("adrs-item-status-missing", `category "${key}": adrs "${rec.path}" missing "status"`);
        } else if (typeof rec.status !== "string") {
          // A non-string status (forgotten quotes: 2026, true, an array/object)
          // is a shape violation — flag it directly rather than relying on
          // classifyStatus coercion, which could e.g. stringify ["Proposed"] to
          // a valid-looking value and let it slip through. classifyStatus is
          // still hardened against non-strings as defense-in-depth.
          err(
            "adrs-item-status-enum",
            `category "${key}": adrs "${rec.path}" status must be a string (got ${typeof rec.status})`,
          );
        } else {
          const st = classifyStatus(rec.status);
          if (!st.ok)
            err(
              "adrs-item-status-enum",
              `category "${key}": adrs "${rec.path}" status "${rec.status}" is not a valid Status`,
            );
          if (rec.status.length > 100 || CONTROL_CHAR_RE.test(rec.status))
            err(
              "adrs-item-status-unsafe",
              `category "${key}": adrs "${rec.path}" status must be one line and at most 100 characters`,
            );
        }
        if (!("summary" in rec) || !String(rec.summary || "").trim())
          warn("adrs-item-summary-missing", `category "${key}": adrs "${rec.path}" has no summary`);
        else if (
          typeof rec.summary !== "string" ||
          rec.summary.length > 240 ||
          CONTROL_CHAR_RE.test(rec.summary)
        )
          err(
            "adrs-item-summary-unsafe",
            `category "${key}": adrs "${rec.path}" summary must be a one-line string of at most 240 characters`,
          );
        for (const f of Object.keys(rec))
          if (!KNOWN_ADR_ITEM_FIELDS.has(f))
            warn(
              "adrs-item-unknown-field",
              `category "${key}": adrs "${rec.path}" unknown field "${f}" (typo?)`,
            );
        const keys = seenAdrs.get(rec.path) || [];
        keys.push(key);
        seenAdrs.set(rec.path, keys);
      }
    }
    if ("subdomainType" in entry && !SUBDOMAIN_TYPES.has(entry.subdomainType))
      err(
        "subdomaintype-enum",
        `category "${key}": subdomainType "${entry.subdomainType}" not in core|supporting|generic`,
      );
    if ("dependsOn" in entry) {
      if (!Array.isArray(entry.dependsOn))
        err("dependson-not-array", `category "${key}": "dependsOn" is not an array`);
      else if (new Set(entry.dependsOn).size !== entry.dependsOn.length)
        err("dependson-dup", `category "${key}": duplicate dependsOn entries`);
    }
    if ("tableDocs" in entry && !Array.isArray(entry.tableDocs))
      err("tabledocs-not-array", `category "${key}": "tableDocs" is not an array`);
    for (const f of Object.keys(entry))
      if (!KNOWN_ENTRY_FIELDS.has(f))
        warn("unknown-field", `category "${key}": unknown field "${f}" (typo? silently ignored)`);
  }
  // a single ADR path indexed under two category keys
  for (const [p, keys] of seenAdrs)
    if (keys.length > 1)
      err("adr-double-indexed", `ADR "${p}" listed in multiple categories: ${keys.join(", ")}`);

  // dependsOn integrity (R16)
  for (const d of dependsOnDangling(mapping))
    err("dependson-dangling", `dependsOn references a missing category key: ${d}`);
  for (const k of selfEdges(mapping))
    err("dependson-self-edge", `category "${k}" depends on itself`);
  if (hasCycle(mapping)) err("dependson-cycle", "dependsOn graph has a cycle (not a DAG)");

  return issues;
}

function pathIsAbsoluteOrTraverses(value) {
  return (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.split(/[\\/]/).some((segment) => segment === "..")
  );
}

// ── decision-log ADR pointers ─────────────────────────────────────────────
// A category's decision-log.md is a CONVENTION file, not an ADR: it is absent
// from .mapping.json and is never enumerated as an ADR (it has no NNNN- name),
// so none of the per-ADR checks see it. That leaves one hole worth closing
// deterministically — its "current ADR" pointer.
//
// authoring-rules "Decision log": each entry carries exactly one ADR reference, a
// link to the ADR that is currently live. adr-rollup step 7 renumbers files and
// step 9 writes the log, so a rollup that renumbers a survivor must repoint that
// link. Nothing caught a miss: adr-invariants' stale-citation finder matches the
// "<cat>/NNNN" token form, while the log links relatively ("./0001-token.md"),
// and R10 related-broken only reads NNNN-*.md bodies. The result was a log
// pointing at a deleted path with a green harness.
//
// Returns every local link target in the file (anchors stripped, URLs skipped)
// so the CLI can resolve them against disk. Scans the WHOLE body, not one
// section: a log should only ever link to live ADRs, so any dangling local link
// in it is the same defect.
export function decisionLogLinkTargets(body) {
  // Skip the seed's placeholder so an unedited copy of
  // decision-log.template.md does not read as a broken link.
  return localLinkTargets(body).filter((target) => !target.includes("NNNN"));
}

// ── seeded rule-doc version ────────────────────────────────────────────────
// /adr-new copies the rule docs into docs/adr/ only when they are ABSENT, so a
// project seeded once never sees a later rule again. That is not cosmetic: the
// docs are the source of truth every reviewer reads, so a rule added upstream
// (R20 prose style, non-numeric requirements) is simply not enforceable in that
// repo — a reviewer either misses the axis or silently reaches for the plugin's
// own copy, judging by a rule the repo does not contain. The stamp gives the
// harness something to compare, since a rule doc otherwise carries no version.
export const RULES_VERSION_RE = /<!--\s*adr-writer:rules-version\s+([0-9]+\.[0-9]+\.[0-9]+)/;

export function rulesVersion(body) {
  const m = RULES_VERSION_RE.exec(body ?? "");
  return m ? m[1] : null;
}

// Semver compare limited to the numeric triples the stamp regex admits.
// Returns negative when a < b, 0 when equal, positive when a > b.
export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
