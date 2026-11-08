#!/usr/bin/env bun
// Find registered decision documents, then follow their original contracts.
// Usage: bun adr-search.mjs --query TEXT [--category KEY] [--root DIR]
//        [--adr-dir DIR] [--limit N] [--offset N] [--json]
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bodyStatus,
  classifyStatus,
  isAdrFile,
  parseHeadings,
  validateMappingShape,
} from "./adr-lint-lib.mjs";
import { parseSearchQuery, SearchInputError, searchUnits } from "./search/search-text.mjs";

const NOTE =
  "Navigation only: search hits are not a complete requirement contract. Read the full index and plausible decision documents before changing a decision. Relevance is not approval or implementation status.";
const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
const inside = (root, file) => {
  const rel = path.relative(root, file);
  return rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
};

function readText(file) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file));
  if (text.includes("\0")) throw new Error("document contains NUL characters");
  return text;
}

/** Preserve original section ranges, including fenced samples and child sections. */
function sections(body) {
  const { heads, lines } = parseHeadings(body);
  const found = heads.filter((h) => h.level >= 2);
  const parts = [];
  for (const [i, heading] of found.entries()) {
    const end =
      found.slice(i + 1).find((next) => next.level <= heading.level)?.line ?? lines.length;
    parts.push({
      title: heading.text,
      lineStart: heading.line + 1,
      lineEnd: end,
      body: lines.slice(heading.line, end).join("\n"),
    });
  }
  if (!parts.length)
    parts.push({ title: heads[0]?.text ?? "Document", lineStart: 1, lineEnd: lines.length, body });
  const title = heads.find((h) => h.level === 1);
  return { title: title?.text, titleLine: (title?.line ?? 0) + 1, parts };
}

/**
 * Read only registered files under the selected document root. Invalid source
 * state stays diagnostic evidence; a search hit never makes it a valid decision.
 */
function readCorpus({ root, adrDir, category }) {
  const indexPath = path.resolve(root, adrDir, ".mapping.json");
  const label = (file) => relative(root, file);
  const diagnostics = [];
  const add = (code, where, message) => diagnostics.push({ code, where, message });
  let mapping;
  try {
    mapping = JSON.parse(readText(indexPath));
  } catch (error) {
    add("index-unreadable", label(indexPath), error.message);
    return { units: [], diagnostics, found: null };
  }
  const issues = validateMappingShape(mapping).filter((i) => i.level === "error");
  for (const issue of issues) add("index-" + issue.code, label(indexPath), issue.msg);
  if (issues.length) return { units: [], diagnostics, found: null };
  const entries = Object.entries(mapping.categories).filter(
    ([key]) => !category || key === category || key.startsWith(category + "/"),
  );
  if (!entries.length && category) {
    add("category-not-found", label(indexPath), "no matching category: " + category);
    return { units: [], diagnostics, found: false };
  }
  const adrRoot = path.resolve(root, adrDir);
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(adrRoot);
  } catch (error) {
    add("document-root-unreadable", label(adrRoot), error.message);
    return { units: [], diagnostics, found: null };
  }
  const units = [],
    seen = new Set();
  for (const [key, entry] of entries) {
    for (const record of entry.adrs) {
      const file = path.resolve(root, record.path);
      if (path.dirname(file) !== path.join(adrRoot, key) || !isAdrFile(path.basename(file))) {
        add(
          "document-path-invalid",
          record.path,
          "the indexed file is not a decision document of its category",
        );
        continue;
      }
      let body;
      try {
        const canonical = realpathSync(file);
        if (!inside(canonicalRoot, canonical))
          throw new Error("document resolves outside the selected decision root");
        if (seen.has(canonical))
          throw new Error("the same document is registered through multiple paths");
        seen.add(canonical);
        body = readText(file);
      } catch (error) {
        add("document-unreadable", record.path, error.message);
        continue;
      }
      const status = bodyStatus(body).value;
      const trusted = classifyStatus(status).ok && status === record.status;
      if (!trusted)
        add(
          "status-mismatch",
          record.path,
          "body Status " +
            JSON.stringify(status) +
            " does not agree with indexed Status " +
            JSON.stringify(record.status),
        );
      const parsed = sections(body);
      const title = parsed.title ?? path.basename(file);
      const documentSource = {
        path: record.path,
        lineStart: parsed.titleLine,
        lineEnd: parsed.titleLine,
      };
      const common = {
        path: record.path,
        category: key,
        title,
        status,
        indexedStatus: record.status,
        trusted,
      };
      for (const part of parsed.parts) {
        const source = { path: record.path, lineStart: part.lineStart, lineEnd: part.lineEnd };
        units.push({
          id: record.path + "#" + part.lineStart,
          identifier: record.path,
          title,
          source,
          titleSource: documentSource,
          fields: [
            { name: "heading", value: part.title, source },
            {
              name: "summary",
              value: record.summary ?? "",
              source: { path: label(indexPath), category: key },
            },
            { name: "body", value: part.body, source },
          ],
          result: { ...common, section: part.title, source },
        });
      }
    }
  }
  return { units, diagnostics, found: true };
}

/** Return one representative section per document, with a bounded, stable continuation. */
export function searchAdrs(input) {
  const options = {
    root: process.cwd(),
    adrDir: "docs/adr",
    category: null,
    limit: 10,
    offset: 0,
    ...input,
  };
  options.root = path.resolve(options.root);
  const terms = parseSearchQuery(options.query);
  if (!terms.length) throw new SearchInputError("--query requires nonempty text");
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100)
    throw new SearchInputError("--limit must be an integer from 1 to 100");
  if (!Number.isSafeInteger(options.offset) || options.offset < 0)
    throw new SearchInputError("--offset must be a non-negative integer");
  const corpus = readCorpus(options);
  const byId = new Map(corpus.units.map((unit) => [unit.id, unit]));
  const hits = searchUnits(corpus.units, options.query);
  const documents = new Map();
  for (const hit of hits) {
    const unit = byId.get(hit.id);
    // Every unit also carries the document title and index summary, so a section
    // matches only when its own heading and body hold every term.
    const own = new Set(
      hit.matches
        .filter((match) => match.field === "body" || match.field === "heading")
        .flatMap((match) => match.terms),
    );
    const sectionMatch = terms.every((term) => own.has(term));
    if (!documents.has(unit.result.path)) {
      documents.set(unit.result.path, {
        ...unit.result,
        ...(hit.tier > 0 || !sectionMatch
          ? { section: "Document metadata", source: unit.titleSource }
          : {}),
        relevance: { score: hit.score, kind: hit.kind },
        matches: hit.matches,
        matchingSections: sectionMatch ? 1 : 0,
      });
    } else if (sectionMatch) documents.get(unit.result.path).matchingSections++;
  }
  const all = [...documents.values()];
  const results = all.slice(options.offset, options.offset + options.limit);
  const nextOffset =
    options.offset + results.length < all.length ? options.offset + results.length : null;
  const scope = { root: options.root, adrDir: options.adrDir, category: options.category };
  return {
    query: options.query,
    scope,
    found: corpus.found,
    complete: corpus.diagnostics.length === 0,
    navigationOnly: true,
    note: NOTE,
    diagnostics: corpus.diagnostics,
    page: {
      offset: options.offset,
      limit: options.limit,
      returned: results.length,
      total: all.length,
      nextOffset,
    },
    next:
      nextOffset === null
        ? null
        : { query: options.query, ...scope, limit: options.limit, offset: nextOffset },
    results,
  };
}

export function renderAdrSearch(result) {
  const lines = [
    NOTE,
    "Search: " + result.query,
    "Scope: " + (result.scope.category ?? "all registered decisions"),
    "Completeness: " +
      (result.complete
        ? "current readable sources checked"
        : "INCOMPLETE — inspect source diagnostics"),
  ];
  for (const d of result.diagnostics) lines.push("[" + d.code + "] " + d.where + ": " + d.message);
  lines.push(
    "Page: " +
      result.page.offset +
      ", returned " +
      result.page.returned +
      " of " +
      result.page.total,
  );
  for (const row of result.results) {
    lines.push(
      row.path +
        ":" +
        row.source.lineStart +
        "-" +
        row.source.lineEnd +
        " [" +
        (row.status ?? "unknown") +
        "]",
    );
    lines.push("  " + row.title + " / " + row.section);
    lines.push(
      "  Match: " +
        row.relevance.kind +
        "; " +
        row.matches.map((m) => m.field + " = " + m.terms.join(", ")).join("; "),
    );
    lines.push(
      "  Matching sections: " + row.matchingSections + (row.trusted ? "" : "; Status is untrusted"),
    );
  }
  if (result.next) lines.push("Next: " + JSON.stringify(result.next));
  return lines.join("\n") + "\n";
}

const USAGE =
  "Usage: bun adr-search.mjs --query TEXT [--category KEY] [--root DIR] [--adr-dir DIR] [--limit N] [--offset N] [--json]";
function main(args) {
  const options = {},
    names = {
      "--query": "query",
      "--category": "category",
      "--root": "root",
      "--adr-dir": "adrDir",
      "--limit": "limit",
      "--offset": "offset",
    };
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(USAGE + "\n");
      return 0;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    const name = names[arg];
    if (!name) throw new SearchInputError("unknown argument: " + arg);
    const value = args[++i];
    if (value === undefined) throw new SearchInputError(arg + " requires a value");
    if (name === "limit" || name === "offset") {
      if (!/^\d+$/.test(value)) throw new SearchInputError(arg + " requires an integer");
      options[name] = Number(value);
    } else options[name] = value;
  }
  const result = searchAdrs(options);
  process.stdout.write(json ? JSON.stringify(result, null, 2) + "\n" : renderAdrSearch(result));
  return result.complete && result.found ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      "adr-search: " +
        error.message +
        "\n" +
        (error instanceof SearchInputError ? USAGE + "\n" : ""),
    );
    process.exitCode = error instanceof SearchInputError ? 2 : 1;
  }
}
