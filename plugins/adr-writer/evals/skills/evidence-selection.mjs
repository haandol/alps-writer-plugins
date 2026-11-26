// Change selection from what each case actually carries.
//
// The impact map in ../impact-map.mjs is a path heuristic. A classification
// probe also carries every guidance file it embeds in its prompt or fixture, so
// a changed hunk of such a file selects the probe even when no path rule names
// it. Files a run only reads through its tools are known after the first run and
// are compared by the result cache instead (../lib/evaluation-cache.mjs).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const git = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });

/** The comparison base for "new case": the requested base, else the default branch, else HEAD. */
export function defaultBase(requested) {
  if (requested) return requested;
  const remote = git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (remote.status === 0 && remote.stdout.trim()) return remote.stdout.trim();
  return git(["rev-parse", "--verify", "--quiet", "main"]).status === 0 ? "main" : "HEAD";
}

/**
 * Case IDs written as a whole string literal somewhere in the base revision's
 * eval sources. A case absent there is new. A templated ID that never appears
 * literally counts as new, which only adds a confirming run.
 */
export function knownCaseIds(cases, base) {
  const patterns = cases.flatMap(({ id }) =>
    ['"', "'", "`"].flatMap((quote) => ["-e", `${quote}${id}${quote}`]),
  );
  const result = git([
    "grep",
    "-h",
    "-o",
    "-F",
    ...patterns,
    base,
    "--",
    "plugins/adr-writer/evals",
  ]);
  // Without a readable history every case counts as new and gets its confirming run.
  if (result.error || result.status > 1) return new Set();
  return new Set(
    result.stdout
      .split("\n")
      .map((line) => line.slice(1, -1))
      .filter(Boolean),
  );
}

/** Lines long enough to identify carried text rather than a common heading or bullet. */
const significant = (lines) =>
  [...new Set(lines.map((line) => line.trim()))].filter((line) => line.length >= 24);

/**
 * For each changed text file, what reveals whether a prompt carries the change:
 * each hunk's new side as ordered non-empty lines (its added lines with three
 * surrounding lines, or the lines around a pure deletion) and any long changed
 * line on its own. A file new since the base contributes all its lines. The last
 * two segments of its plugin path are kept too, since a prompt or skill body
 * names a file it points the model at (`references/x.md`, `../adr-new/SKILL.md`).
 */
export function changedProbes(base, paths, root = ROOT) {
  const run = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
  const probes = [];
  for (const file of paths) {
    if (!/\.(md|mjs|js|ts|json|txt|xml|ttl|ya?ml)$/.test(file)) continue;
    const full = path.join(root, file);
    const lines = [];
    const blocks = [];
    if (run(["cat-file", "-e", `${base}:${file}`]).status !== 0)
      lines.push(...(existsSync(full) ? readFileSync(full, "utf8").split("\n") : []));
    else
      for (const hunk of run(["diff", "-U3", base, "--", file])
        .stdout.split(/^@@[^\n]*$/m)
        .slice(1)) {
        const rows = hunk.split("\n").filter((r) => r && !r.startsWith("\\"));
        lines.push(...rows.filter((r) => r.startsWith("+")).map((r) => r.slice(1)));
        blocks.push(...hunkBlocks(rows));
      }
    const segments = file.match(/^plugins\/[^/]+\/(.+)$/)?.[1].split("/") ?? [];
    probes.push({
      file,
      lines: significant(lines),
      blocks,
      mention: segments.length > 1 ? segments.slice(-2).join("/") : null,
    });
  }
  return probes;
}

/**
 * Ordered line runs that identify one hunk's new side: the added lines (or the
 * point of a pure deletion) with up to three neighbouring lines on each side.
 * Shorter windows still match when the prompt drops a nearby heading or
 * frontmatter; a deletion window must span the deletion point.
 */
function hunkBlocks(rows) {
  const side = [];
  let deletionAt = null;
  for (const row of rows) {
    if (row.startsWith("-")) deletionAt ??= side.length;
    else if (row.startsWith(" ") || row.startsWith("+")) {
      const text = row.slice(1).trim();
      if (text) side.push({ text, added: row.startsWith("+") });
    }
  }
  const added = side.flatMap((row, index) => (row.added ? [index] : []));
  const [lo, hi] = added.length ? [added[0], added.at(-1) + 1] : [deletionAt, deletionAt];
  if (lo == null) return [];
  const blocks = new Map();
  for (let before = 0; before <= 3; before++)
    for (let after = 0; after <= 3; after++) {
      if (!added.length && (!before || !after)) continue;
      const block = side.slice(Math.max(0, lo - before), hi + after).map((row) => row.text);
      if (block.length > 1 && block.join("").length >= 24) blocks.set(block.join("\n"), block);
    }
  return [...blocks.values()];
}

/** Whether `lines` appear in `text` in order, each close after the previous one. */
function containsInOrder(text, lines, gap = 400) {
  for (let start = text.indexOf(lines[0]); start >= 0; start = text.indexOf(lines[0], start + 1)) {
    let end = start + lines[0].length;
    let found = true;
    for (const line of lines.slice(1)) {
      const at = text.indexOf(line, end);
      if (at < 0 || at - end > gap) {
        found = false;
        break;
      }
      end = at + line.length;
    }
    if (found) return true;
  }
  return false;
}

/** Changed files whose content or path the given prompt and fixture text carries. */
export function carriedChanges(text, probes) {
  return probes
    .filter(
      ({ lines = [], blocks = [], mention }) =>
        blocks.some((block) => containsInOrder(text, block)) ||
        lines.some((line) => text.includes(line)) ||
        (mention && text.includes(mention)),
    )
    .map(({ file }) => file);
}
