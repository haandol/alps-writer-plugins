#!/usr/bin/env bun
// Copy the ADR Writer scripts that Ontology Writer also runs: reading and checking
// the ADR index and ADR Status, recording a Status transition, and opening a report.
// ADR Writer's file stays the one to edit, and --check reports a stale copy.
import { syncFiles } from "./lib/sync-files.mjs";

const FILES = ["adr-lint-lib.mjs", "adr-status-transition.mjs", "adr-impl-review-open.mjs"];

syncFiles(
  FILES.map((name) => ({
    source: `plugins/adr-writer/scripts/${name}`,
    targets: [`plugins/ontology-writer/scripts/${name}`],
  })),
  {
    script: "sync-shared-scripts.mjs",
    drift: "Shared script drift",
    fix: "bun run shared-scripts:sync",
    done: (check) =>
      `${check ? "Verified" : "Synchronized"} ${FILES.length} ADR Writer scripts in Ontology Writer.`,
  },
);
