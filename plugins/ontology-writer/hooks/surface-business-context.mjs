#!/usr/bin/env bun
// Ask about initial setup on startup. Restore the business-context directive whenever
// the host creates or replaces session context in a project with a linked index.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { hasModel } from "../scripts/model-documents.mjs";
import { setupPreference } from "../scripts/ontology-preferences.mjs";

const QUERY_CLI = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "scripts",
  "ontology.mjs",
);

// The same setting ADR Writer's hook reads, so both find the same index.
const MAPPING_PATH = process.env.ALPS_ADR_MAPPING || "docs/adr/.mapping.json";

const quote = (value) => `"${value.replace(/[\\"$`]/g, "\\$&")}"`;

function sessionEvent() {
  try {
    return JSON.parse(readFileSync(0, "utf8")) ?? {};
  } catch {
    return {};
  }
}

function main() {
  const event = sessionEvent();
  const eventCwd = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const mappingFile = path.resolve(eventCwd, MAPPING_PATH);
  let mapping;
  try {
    mapping = JSON.parse(readFileSync(mappingFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") return;
  }
  const ontologyDir = path.join(path.dirname(path.dirname(mappingFile)), "ontology");
  let unreadable = false;
  const present = hasModel(ontologyDir, () => {
    unreadable = true;
  });
  if (!present) {
    // The question is for a new session only; a resumed or compacted one keeps the earlier
    // answer. An unreadable model folder is not a missing model: its scope is unknown.
    if (event.source !== "startup" || unreadable) return;
    // Realization links without a model point at a lost or moved model to repair, not a first build.
    if (Object.values(mapping?.categories ?? {}).some((category) => category?.realizes?.length)) {
      return;
    }
    const preferencesCli = path.join(path.dirname(QUERY_CLI), "ontology-preferences.mjs");
    try {
      if (setupPreference(eventCwd)) return;
    } catch {
      return "Ontology Writer could not read this project's setup preference. Skip the automatic first-model question. If asked, inspect or reset the setup preference through /ontology-build preferences.";
    }
    return [
      "Ontology Writer is installed and this project has no saved business ontology.",
      'If the user has not already chosen, ask once in their language in your first user-facing response: "Would you like to create a business ontology for this project now?"',
      "In that same response, name the /ontology-build command and one input example: a document or folder, or one workflow such as who submits and approves a quote.",
      `After an explicit yes, no or later, run bun ${quote(preferencesCli)} set setup <choice> in the project directory with build, skip or later respectively. With no answer or a one-time choice, write nothing.`,
      "On yes or an existing request to build, start /ontology-build with their input. Its first-build flow asks about reviewing existing ADRs before drafting.",
      "On no, later, or no answer, continue their request without starting setup or asking again in this conversation. Saving the draft requires separate approval.",
    ].join(" ");
  }
  if (!mapping) return;
  const adrDir = path.dirname(MAPPING_PATH);
  const where =
    path.basename(MAPPING_PATH) !== ".mapping.json"
      ? ` --index ${quote(MAPPING_PATH)}`
      : path.normalize(adrDir) === path.normalize("docs/adr")
        ? ""
        : ` --adr-dir ${quote(adrDir)}`;
  return [
    `[Business-context directive] Ontology: before creating or changing an ADR decision or contract, first check the feature's business context (bun "${QUERY_CLI}" query --step <id>${where}).`,
    "Before changing code of a feature linked to a process step, query its business context; use it to catch contradictions, never as new obligations.",
    "For ontology status, give one concrete next action.",
    "Find: --overview then --context <id> --search <text>. Known: --step/--process; feature: --category.",
  ].join("\n");
}

const additionalContext = main();
const output = additionalContext
  ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }
  : {};
process.stdout.write(JSON.stringify(output) + "\n");
