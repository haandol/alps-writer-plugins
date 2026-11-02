#!/usr/bin/env node
// SessionStart — when the repository has both an ADR index and a business ontology,
// ask for the business-context query before ADR decisions or contracts change
// and before code of a feature linked to a process step changes.
//
// startup/resume/clear/compact cover the points where session context is created
// or replaced. Neither the model nor the index content is rendered: the query
// returns what a change needs when it runs.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { hasModel } from "../scripts/ontology-fs.mjs";

const QUERY_CLI = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "scripts",
  "ontology.mjs",
);

// The same setting ADR Writer's hook reads, so both find the same index.
const MAPPING_PATH = process.env.ALPS_ADR_MAPPING || "docs/adr/.mapping.json";

// Drain stdin so Claude Code never sees a broken pipe.
function drainStdin() {
  try {
    readFileSync(0);
  } catch {
    /* ignore */
  }
}

function quiet() {
  process.stdout.write("{}\n");
  process.exit(0);
}

function main() {
  drainStdin();
  const eventCwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const mappingFile = path.isAbsolute(MAPPING_PATH)
    ? MAPPING_PATH
    : path.join(eventCwd, MAPPING_PATH);
  // Without an index there are no ADR changes to precede; an index that does not
  // parse is ADR Writer's to report.
  if (!existsSync(mappingFile)) quiet();
  try {
    JSON.parse(readFileSync(mappingFile, "utf8"));
  } catch {
    quiet();
  }
  // The model lives beside the index found here, wherever that index lives.
  if (!hasModel(path.join(path.dirname(path.dirname(mappingFile)), "ontology"))) quiet();
  const adrDir = path.dirname(MAPPING_PATH);
  const where =
    path.normalize(adrDir) === path.normalize("docs/adr") ? "" : ` --adr-dir "${adrDir}"`;
  const directive = [
    `[Business-context directive] Business ontology present: before creating or changing an ADR decision or contract, first check the feature's business context (node "${QUERY_CLI}" query --category <key>${where}).`,
    "Before changing code of a feature linked to a process step, query its business context; use it to catch contradictions, never as new obligations.",
  ];
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: directive.join("\n"),
      },
    }) + "\n",
  );
  process.exit(0);
}

main();
