import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join("/");

/**
 * A path's real location as the volume stores it, or null when it cannot be
 * resolved. The native call returns the stored spelling, so on a volume that folds
 * letter case or Unicode form two spellings of one file are one real location.
 */
export const realOf = (f) => {
  try {
    return realpathSync.native(f);
  } catch {
    return null;
  }
};

/** Where a file is really kept, or its absolute path when that cannot be resolved. */
export const realName = (f) => realOf(f) ?? path.resolve(f);

/** Whether a path names a symbolic link; false when nothing is there. */
export const isLink = (f) => {
  try {
    return lstatSync(f).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * Write a change unit completely or not at all: stage every file as a temporary
 * sibling, then move them into place in the given order; if any step fails,
 * restore files still holding this unit's writes, preserving concurrent edits.
 * A symlinked file is written through to its
 * target, as `format` does, but removing one removes the link, never its target;
 * a document reached through a linked directory is never removed, and a unit that
 * would write one file under two names is refused.
 *
 * @param {{file: string, text: string|null}[]} ops in write order; `text: null` deletes.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function writeUnit(ops, { modelDir = null, checkApproval } = {}) {
  const staged = [];
  // Where a model document is really kept: the model directory itself may be a link.
  const modelReal = modelDir ? realName(modelDir) : null;
  const ownDir = (dir) =>
    modelReal &&
    (dir === path.resolve(modelDir) || dir.startsWith(path.resolve(modelDir) + path.sep))
      ? path.join(modelReal, path.relative(path.resolve(modelDir), dir))
      : dir;
  // An intermediate and a final version may target one name, never two aliases.
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
  const expected = new Map();
  try {
    for (const op of ops) {
      if (!expected.has(op.file)) expected.set(op.file, entryContents(op.file));
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
  const changed = (file) =>
    new Error(
      `${rel(file)} changed during the save; rerun impact and present the changed range again`,
    );
  try {
    if (checkApproval && !checkApproval())
      throw new Error(
        "the inputs changed after the approval summary; rerun impact and present the changed range again",
      );
    for (const op of ops) {
      // A removed link is restored as the link it was.
      const original = entryContents(op.file);
      if (!sameContents(original, expected.get(op.file))) throw changed(op.file);
      if (original === NON_FILE) throw new Error(`${rel(op.file)} is not a file`);
      if (op.text === null) {
        if (typeof original === "string") unlinkSync(op.file);
        else rmSync(op.file, { force: true });
      } else if (op.create) linkSync(tmpOf.get(op), op.file);
      else renameSync(tmpOf.get(op), op.file);
      const written = op.text === null ? null : Buffer.from(op.text);
      expected.set(op.file, written);
      done.push({ file: op.file, original, written });
      if (op.create) unlinkSync(tmpOf.get(op));
    }
    for (const [file, written] of expected)
      if (!sameContents(entryContents(file), written)) throw changed(file);
    return { ok: true };
  } catch (error) {
    const unrestored = [];
    const preserved = new Set();
    for (const d of done.reverse()) {
      try {
        if (preserved.has(d.file)) continue;
        if (!sameContents(entryContents(d.file), d.written)) {
          preserved.add(d.file);
          continue;
        }
        if (d.original === null) rmSync(d.file, { force: true });
        else if (typeof d.original === "string") {
          rmSync(d.file, { force: true });
          symlinkSync(d.original, d.file);
        } else writeFileSync(d.file, d.original);
      } catch {
        unrestored.push(d.file); // keep restoring the others; the report names this one
      }
    }
    for (const s of staged) rmSync(s.tmp, { force: true });
    let message = `writing failed (${error.code ?? error.message})`;
    if (unrestored.length)
      message += ` and these files could not be restored: ${unrestored.join(", ")}`;
    else if (!done.length) message += "; nothing was written";
    else if (!preserved.size) message += "; every file already written was restored";
    if (preserved.size)
      message += `; newer edits were preserved in ${[...preserved].map(rel).join(", ")}`;
    return { ok: false, error: message };
  }
}

const NON_FILE = Symbol("non-file entry");

/** Snapshot an entry without following a user-replaced link or reading a device. */
function entryContents(file) {
  const stat = lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (stat.isSymbolicLink()) return readlinkSync(file);
  return stat.isFile() ? readFileSync(file) : NON_FILE;
}

const sameContents = (a, b) => a === b || (Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.equals(b));
