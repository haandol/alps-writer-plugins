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
  "[Report-writing directive] First decide whether a report helps the reader. For explicit report requests or selected reports, read and apply the report-writer skill at " +
    skill +
    ". Reuse it if already loaded in this context.",
  "Honor explicit report requests and delivery constraints. For other explanations, reviews, audits, evaluations, sync and rollup results: automatically create a report when connecting conditions, relationships, comparisons or evidence needs structured depth; answer short, simple content in chat without report files, browser opening or quizzes; if report usefulness is unclear, ask once before generating it. Reuse the user's delivery choice for the same scope, continue independent work while waiting, and do not treat silence as permission. Technical topics, task names and length alone do not require reports.",
  "Apply delivery criteria without narrating skill routing. For unclear usefulness, ask one short delivery question with only necessary context; do not repeat the question or turn the clarification into a report outline.",
  "The owning review workflow determines inspection scope, findings, severity, verdict and edit authorization. Use this skill to present those results clearly; it does not replace the review.",
  "Preserve report/audit artifacts explicitly required by a specialized workflow the user selected; do not infer that requirement from a review label. Only after a report is selected, default to standalone HTML, validate the final file, open it once in the operating system's default browser and return its absolute path. Explicit delivery constraints take precedence. Keep required Markdown/JSON as supporting artifacts. Preserve the HTML and report the actual reason if opening fails. The following presentation rules apply only to selected reports.",
  "Below the title, use a standalone localized Background and goals heading and briefly explain why the report is being written and what the user wants to understand, decide, or achieve, using confirmed request context. Immediately follow in a distinct display area with the answer and material limitations, then drill down by evidenced domain or bounded context with at most four child explanation branches; supporting sources and quizzes do not consume that allowance. Choose subsequent headings for the report's subject, without a fixed outline. Preserve all contracts and evidence.",
  "Generate one to five medium-difficulty quiz questions on the report's core content to support understanding and reduce cognitive load; follow the skill's omission and self-check rules. Do not automatically start a conversational quiz.",
  "Use Mermaid sequence diagrams for meaningful requests, responses, and timing. Review reader context, worked calculations, paragraph breaks, wrapping, and unsupported or repetitive prose.",
  "Keep native schemas and the caller's permissions and verdict intact. For editorial issues, distinguish High/Medium/Low from system findings and recheck the latest whole report after supported edits. Review-only requests remain report-only.",
].join("\n");
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: directive },
  }) + "\n",
);
