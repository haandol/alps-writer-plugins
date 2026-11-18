// Read disposable new ADRs at their paths relative to the ADR directory.
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { bodyStatus, isAdrFile } from "./adr-lint-lib.mjs";

function resolvedDestination(file) {
  if (lstatSync(file, { throwIfNoEntry: false })) return realpathSync(file);
  return path.join(resolvedDestination(path.dirname(file)), path.basename(file));
}

function within(root, file) {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

/** Only new Proposed ADRs in the proposed realization mapping may be published. */
export function newAdrDrafts(opts, current, mapping) {
  const drafts = new Map();
  if (!opts.adrDrafts) return drafts;
  const root = realpathSync(opts.adrDrafts);
  const liveRoot = resolvedDestination(path.resolve(opts.adrDir));
  if (within(root, liveRoot) || within(liveRoot, root))
    throw new Error("--adr-drafts and the current ADR directory must be separate");
  const registered = new Set(
    Object.values(current?.categories ?? {}).flatMap((entry) =>
      Array.isArray(entry?.adrs)
        ? entry.adrs.filter((r) => typeof r?.path === "string").map((r) => path.resolve(r.path))
        : [],
    ),
  );
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const source = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(source);
        continue;
      }
      if (!isAdrFile(entry.name)) continue;
      if (!entry.isFile())
        throw new Error(`--adr-drafts expects regular NNNN-*.md files: ${source}`);
      const relative = path.relative(root, source);
      const file = path.resolve(opts.adrDir, relative);
      const category = path.dirname(relative).split(path.sep).join("/");
      const feature = mapping?.categories?.[category];
      const record =
        Array.isArray(feature?.adrs) &&
        feature.adrs.find((r) => typeof r?.path === "string" && path.resolve(r.path) === file);
      if (!record || !Array.isArray(feature.realizes) || !feature.realizes.length)
        throw new Error(
          `new ADR "${relative}" needs its own category, record and realization link in --mapping`,
        );
      if (registered.has(file) || lstatSync(file, { throwIfNoEntry: false }))
        throw new Error(
          `new ADR "${relative}" is already indexed or exists; keep its current file and compare the revision again`,
        );
      if (!within(liveRoot, resolvedDestination(path.dirname(file))))
        throw new Error(`new ADR "${relative}" resolves outside the ADR directory`);
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        readFileSync(source),
      );
      if (record.status !== "Proposed" || bodyStatus(text).value !== "Proposed")
        throw new Error(`new ADR "${relative}" must be Proposed in its body and index record`);
      drafts.set(file, text);
    }
  }
  visit(root);
  if (!drafts.size) throw new Error("--adr-drafts contains no new ADR documents");
  return drafts;
}
