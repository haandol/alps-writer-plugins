#!/usr/bin/env bun
// Each independently installed plugin carries the same local search implementation.
import { syncFiles } from "./lib/sync-files.mjs";

syncFiles(
  [
    {
      source: "shared/search/search-text.mjs",
      targets: ["adr-writer", "ontology-writer"].map(
        (plugin) => `plugins/${plugin}/scripts/search/search-text.mjs`,
      ),
    },
  ],
  {
    script: "sync-search.mjs",
    drift: "Shared search drift",
    fix: "bun run search:sync",
    done: (check) => (check ? "Verified" : "Synchronized") + " local search in both plugins.",
  },
);
