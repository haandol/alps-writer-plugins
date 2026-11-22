import path from "node:path";

// Check known disposable workspaces before opening a cited file. A directory
// used to hold the checkout itself does not make its authoritative files scratch.
export function isForeignReviewFile(project, run, file) {
  const absolute = path.resolve(project, file);
  if (run && (absolute === run || absolute.startsWith(run + path.sep))) return false;
  const relative = path.relative(project, absolute);
  const parts = relative.split(path.sep);
  return parts.some(
    (part) =>
      [".adr-review", ".adr-impl-review", ".reports"].includes(part) ||
      /^ontology-build-[0-9a-f]{16}-/.test(part),
  );
}
