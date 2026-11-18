#!/usr/bin/env bun
import { syncFiles } from "./lib/sync-files.mjs";

// Guidance owned by adr-writer, copied into each plugin that installs alone and reads it.
const copies = {
  "alps-writer": [
    "requirement-delegation.md",
    "comprehension-load.md",
    "feature-boundaries.md",
    "outcome-evaluation.md",
  ],
  "ontology-writer": ["execution-boundary.md"],
};
syncFiles(
  Object.entries(copies).flatMap(([plugin, names]) =>
    names.map((name) => ({
      source: `plugins/adr-writer/references/${name}`,
      targets: [`plugins/${plugin}/references/${name}`],
    })),
  ),
  {
    script: "sync-authoring-guidance.mjs",
    usageExitCode: 2,
    drift: "Authoring guidance drift",
    fix: "bun run authoring-guidance:sync",
    done: (check) => `${check ? "Verified" : "Synchronized"} shared authoring guidance.`,
  },
);
