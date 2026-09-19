import { readFileSync } from "node:fs";

export const sourceProvenance = JSON.parse(
  readFileSync(new URL("./provenance.json", import.meta.url), "utf8"),
);

export function snapshotsFor(sources) {
  return sources.map((source) => {
    const key = source.replace(/ \(.+\)$/, "");
    const snapshot = sourceProvenance.snapshots.find((entry) => entry.source === key);
    if (!snapshot) throw new Error(`Missing pinned golden-set source: ${key}`);
    return structuredClone(snapshot);
  });
}
