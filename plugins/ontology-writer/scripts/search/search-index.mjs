// Disposable SQLite posting index. Source units, never cached responses or
// approval state, define the result of each invocation.
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import {
  parseSearchQuery,
  prepareSearchUnit,
  rankSearchUnits,
  searchTermMatches,
} from "./search-text.mjs";

const FORMAT = 1;
const hash = (text) => createHash("sha256").update(text).digest("hex");

/** Worktrees and document roots have separate caches even under one cache directory. */
export function searchCachePath({ root, namespace, cacheDir } = {}) {
  const canonical = realpathSync(root ?? process.cwd());
  const base =
    cacheDir ??
    process.env.WRITER_SEARCH_CACHE_DIR ??
    path.join(homedir() || tmpdir(), ".cache", "alps-writer", "search");
  return path.join(
    path.resolve(base),
    "v" + FORMAT + "-" + hash(canonical + "\0" + namespace) + ".sqlite",
  );
}

async function databaseConstructor() {
  if (process.versions.bun) return (await import("bun:sqlite")).Database;
  return (await import("node:sqlite")).DatabaseSync;
}

function prepare(db, sql) {
  return typeof db.query === "function" ? db.query(sql) : db.prepare(sql);
}

function close(db) {
  if (process.versions.bun) db.close(true);
  else db.close();
}

function ensureCacheDirectory(file) {
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const parent = lstatSync(dir);
  if (!parent.isDirectory() || parent.isSymbolicLink())
    throw new Error("search cache directory is not a regular directory");
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("search cache is not a regular file");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function schema(db) {
  db.exec(`
    PRAGMA busy_timeout = 150;
    CREATE TABLE IF NOT EXISTS search_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS search_units(
      id INTEGER PRIMARY KEY, unit_key TEXT UNIQUE NOT NULL,
      fingerprint TEXT NOT NULL, text TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
      text, content='search_units', content_rowid='id', tokenize='trigram case_sensitive 1'
    );
    CREATE TRIGGER IF NOT EXISTS search_units_insert AFTER INSERT ON search_units BEGIN
      INSERT INTO search_fts(rowid,text) VALUES(new.id,new.text);
    END;
    CREATE TRIGGER IF NOT EXISTS search_units_delete AFTER DELETE ON search_units BEGIN
      INSERT INTO search_fts(search_fts,rowid,text) VALUES('delete',old.id,old.text);
    END;
    CREATE TRIGGER IF NOT EXISTS search_units_update AFTER UPDATE ON search_units BEGIN
      INSERT INTO search_fts(search_fts,rowid,text) VALUES('delete',old.id,old.text);
      INSERT INTO search_fts(rowid,text) VALUES(new.id,new.text);
    END;
  `);
  prepare(db, "INSERT OR IGNORE INTO search_meta(id,version) VALUES(1,?)").run(FORMAT);
  const version = prepare(db, "SELECT version FROM search_meta").all();
  if (version.length !== 1 || version[0].version !== FORMAT)
    throw new Error("unsupported search cache format");
}

/** One snapshot update and its reads share a write transaction; no partial index escapes. */
function querySnapshot(db, units, terms) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = new Map(
      prepare(db, "SELECT unit_key,fingerprint,text FROM search_units")
        .all()
        .map((row) => [row.unit_key, row]),
    );
    const write = prepare(
      db,
      `INSERT INTO search_units(unit_key,fingerprint,text) VALUES(?,?,?)
      ON CONFLICT(unit_key) DO UPDATE SET fingerprint=excluded.fingerprint,text=excluded.text`,
    );
    for (const unit of units) {
      // SQLite text tokenization stops at NUL. A replacement in this candidate
      // projection preserves later text; exact checks still use original fields.
      const text = unit.fields.map((field) => field.text.replaceAll("\0", "\uFFFD")).join("\n");
      const fingerprint = hash(JSON.stringify(unit));
      const cached = existing.get(unit.id);
      if (cached?.fingerprint !== fingerprint || cached.text !== text)
        write.run(unit.id, fingerprint, text);
      existing.delete(unit.id);
    }
    const remove = prepare(db, "DELETE FROM search_units WHERE unit_key=?");
    for (const key of existing.keys()) remove.run(key);
    // A readable database can still have a damaged posting index. Verify it
    // against the current source text before accepting a potentially empty hit set.
    db.exec("INSERT INTO search_fts(search_fts,rank) VALUES('integrity-check',1)");
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const fullText = prepare(
      db,
      `SELECT u.unit_key FROM search_fts f
      JOIN search_units u ON u.id=f.rowid WHERE search_fts MATCH ?`,
    );
    const shortText = prepare(db, "SELECT unit_key FROM search_units WHERE instr(text,?)>0");
    const postings = terms.map((term) => {
      // FTS5's trigram tokenizer cannot match fewer than three Unicode scalars.
      // Exact field checks also prevent a phrase from crossing field boundaries.
      const rows =
        [...term].length >= 3
          ? fullText.all('"' + term.replaceAll('"', '""') + '"')
          : shortText.all(term);
      return new Set(
        rows
          .map((row) => row.unit_key)
          .filter((id) => byId.has(id) && searchTermMatches(byId.get(id), term)),
      );
    });
    const hits = rankSearchUnits(units, terms, postings);
    db.exec("COMMIT");
    return hits;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}

/**
 * Search current source units with a rebuildable SQLite cache. Unwritable,
 * corrupt or busy caches fall back to an in-memory SQLite snapshot, preserving
 * matching, ranking and evidence. Programming/input errors are never hidden.
 * The caller still owns source validation and completeness diagnostics.
 */
export async function searchWithSqlite(rawUnits, query, options = {}) {
  const terms = parseSearchQuery(query);
  const units = rawUnits.map(prepareSearchUnit);
  if (new Set(units.map((unit) => unit.id)).size !== units.length)
    throw new TypeError("search unit ids must be unique");
  if (!terms.length) return [];
  const Database = await databaseConstructor();
  let cached = null;
  try {
    const file = searchCachePath(options);
    ensureCacheDirectory(file);
    cached = new Database(file);
    chmodSync(file, 0o600);
    cached.exec("PRAGMA busy_timeout=150; PRAGMA journal_mode=WAL;");
    schema(cached);
    return querySnapshot(cached, units, terms);
  } catch (error) {
    // Cache access is optional. The fresh in-memory execution below must
    // succeed independently or expose its error to the caller.
    options.onCacheUnavailable?.(error);
  } finally {
    if (cached) {
      try {
        close(cached);
      } catch {}
    }
  }
  const memory = new Database(":memory:");
  try {
    schema(memory);
    return querySnapshot(memory, units, terms);
  } finally {
    close(memory);
  }
}
