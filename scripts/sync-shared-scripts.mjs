#!/usr/bin/env bun
// Copy the ADR Writer scripts that Ontology Writer also runs: reading and checking
// the ADR index and ADR Status, recording a Status transition, and opening a report.
// Ontology Writer owns the model file discovery used by both session hooks.
import { syncFiles } from "./lib/sync-files.mjs";

const FILES = ["adr-lint-lib.mjs", "adr-status-transition.mjs", "adr-impl-review-open.mjs"];

syncFiles(
  [
    ...FILES.map((name) => ({
      source: `plugins/adr-writer/scripts/${name}`,
      targets: [`plugins/ontology-writer/scripts/${name}`],
    })),
    {
      source: "plugins/ontology-writer/scripts/model-documents.mjs",
      targets: ["plugins/adr-writer/scripts/model-documents.mjs"],
    },
  ],
  {
    script: "sync-shared-scripts.mjs",
    drift: "Shared script drift",
    fix: "bun run shared-scripts:sync",
    done: (check) =>
      `${check ? "Verified" : "Synchronized"} shared scripts in the standalone plugins.`,
  },
);
