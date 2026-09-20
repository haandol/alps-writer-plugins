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
  "[Report-writing directive] Before writing or revising a human-facing report, read and apply the report-write skill at " +
    skill +
    ". Reuse it if already loaded in this context.",
  "This applies to code, pull request, ADR, architecture and document review results even when the user does not separately request a report, plus evaluations, audits, sync and rollup in every requested format.",
  "The owning review workflow determines inspection scope, findings, severity, verdict and edit authorization. Use this skill to present those results clearly; it does not replace the review.",
  "Lead with the answer, then drill down by evidenced domain or bounded context with at most four peer explanation units. Preserve all contracts and evidence.",
  "Generate one to five medium-difficulty quiz questions on the report's core content to support understanding and reduce cognitive load; follow the skill's omission and self-check rules. Do not automatically start a conversational quiz.",
  "Use Mermaid sequence diagrams for meaningful requests, responses, and timing. Review reader context, worked calculations, paragraph breaks, wrapping, and unsupported or repetitive prose.",
  "Keep native schemas and the caller's permissions and verdict intact. For editorial issues, distinguish High/Medium/Low from system findings and recheck the latest whole report after supported edits. Review-only requests remain report-only.",
].join("\n");
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: directive },
  }) + "\n",
);
