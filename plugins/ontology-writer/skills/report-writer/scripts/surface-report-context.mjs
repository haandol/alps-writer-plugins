#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

try {
  readFileSync(0);
} catch {
  /* A caller may provide no stdin. */
}
const skill = fileURLToPath(new URL("../SKILL.md", import.meta.url));
const directive = [
  "[Report-writing directive] Use report-writer for explicit reports or when connected conditions, relationships or evidence need structured explanation. Answer short, simple requests in chat without files, browser opening or quizzes; if usefulness is unclear, ask once and continue independent work while waiting. Reuse the user's delivery choice; silence is not permission.",
  "For a selected report, read " +
    skill +
    ". Reuse loaded guidance and follow relevant references only. Honor user delivery constraints and specialized artifact requirements. The owning workflow controls inspection, findings, verdict and edit permissions; review-only remains review-only.",
].join("\n");
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: directive },
  }) + "\n",
);
