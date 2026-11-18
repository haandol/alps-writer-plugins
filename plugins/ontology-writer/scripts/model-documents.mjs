// Filesystem discovery only. Session hooks check presence without reading model content.
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

function* documentsIn(dir, seen, onUnreadable) {
  let real;
  try {
    real = realpathSync(dir);
  } catch (error) {
    // A dangling directory link is evidence of a model location we cannot read.
    if (onUnreadable && (error.code !== "ENOENT" || lstatSync(dir, { throwIfNoEntry: false })))
      onUnreadable(dir, error);
    return;
  }
  if (seen.has(real)) return;
  seen.add(real);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    onUnreadable?.(dir, error);
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const file = path.join(dir, entry.name);
    let target = entry;
    if (entry.isSymbolicLink()) {
      try {
        target = statSync(file);
      } catch {
        // Include an unreadable Turtle link so strict readers can report its error.
        if (entry.name.endsWith(".ttl")) yield file;
        continue;
      }
    }
    if (target.isDirectory()) yield* documentsIn(file, seen, onUnreadable);
    else if (target.isFile() && entry.name.endsWith(".ttl")) yield file;
  }
}

/**
 * List the Turtle documents of a model directory, recursively and sorted.
 * Symbolic links are followed (a directory link once), and a dangling `.ttl`
 * link is listed so that reading it reports the failure. Other files (a
 * change log, notes) are not part of the model.
 *
 * @param {string} ontologyDir Model directory, usually docs/ontology.
 * @param {(directory: string, error: Error) => void} [onUnreadable] Strict readers
 * report inaccessible scopes rather than treating them as an empty model.
 * @returns {string[]} paths under the supplied directory; empty when it is absent.
 */
export function findModelDocuments(ontologyDir, onUnreadable) {
  return [...documentsIn(ontologyDir, new Set(), onUnreadable)].sort();
}

export function hasModel(ontologyDir, onUnreadable) {
  return !documentsIn(ontologyDir, new Set(), onUnreadable).next().done;
}
