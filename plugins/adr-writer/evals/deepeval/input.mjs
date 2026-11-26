import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceSources } from "../regression/judge.mjs";
import { reportJudgingEvidence, finalReportSources } from "../skills/report-evaluation.mjs";

const PLUGINS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const GUIDANCE_DIRS = {
  "adr-writer": ["skills", "references", "agents", "templates"],
  "alps-writer": ["skills", "references", "src/guides", "src/templates"],
  "ontology-writer": ["skills", "references", "agents", "templates"],
};
let guidance;

/** Shipped guidance bodies long enough to identify, longest first, with a stable label. */
function shippedGuidance() {
  if (guidance) return guidance;
  const found = new Map();
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(md|xml)$/.test(name)) {
        const text = readFileSync(full, "utf8");
        for (const body of [text, text.replace(/^---\n[\s\S]*?\n---\n/, "")])
          if (body.trim().length >= 400) found.set(body, path.relative(PLUGINS, full));
      }
    }
  };
  for (const [plugin, dirs] of Object.entries(GUIDANCE_DIRS))
    for (const dir of dirs) walk(path.join(PLUGINS, plugin, dir));
  guidance = [...found].sort((a, b) => b[0].length - a[0].length);
  return guidance;
}

/**
 * The judge reads the task, not the instructions the target was given: each
 * shipped guidance body embedded verbatim in a user turn is replaced by its
 * path and hash. Obligations are self-contained, so the judgment needs the
 * request, the replies and the observed files and actions, not the guidance.
 */
export function judgingTurn(turn) {
  let text = turn;
  for (const [body, file] of shippedGuidance())
    if (text.includes(body))
      text = text
        .split(body)
        .join(
          `[shipped guidance omitted from judging: ${file} sha256 ${createHash("sha256").update(body).digest("hex").slice(0, 12)}]`,
        );
  return text;
}

/** Encode captured evidence without loading provider SDKs or invoking a judge. */
export function deepEvalInput(item, evidence) {
  if (
    !Array.isArray(item?.obligations) ||
    !item.obligations.length ||
    item.obligations.some((o) => !o.id || typeof o.text !== "string" || !o.text.trim()) ||
    new Set(item.obligations.map((o) => o.id)).size !== item.obligations.length
  ) {
    throw new Error("expected obligations must be nonempty and uniquely identified");
  }
  if (
    !evidence?.before ||
    !evidence?.after ||
    !Array.isArray(evidence.events) ||
    !Array.isArray(evidence.replies) ||
    !Array.isArray(evidence.turns) ||
    evidence.replies.length !== item.turns.length ||
    evidence.turns.length !== item.turns.length
  ) {
    throw new Error("incomplete target execution evidence");
  }
  evidence = reportJudgingEvidence(item, evidence);
  const sources = evidenceSources(evidence);
  // Lifecycle evaluations retain full transient writes. Final-report evaluations
  // omit only report revision bodies from the judging view; action metadata and
  // source mutations remain visible, and the runner archives the complete trace.
  // Each command output appears once: under checkOutput, where a repeat of an
  // earlier identical output names that output instead. The events point there.
  const checkOutput = {};
  const firstKey = new Map();
  for (const [key, text] of Object.entries(sources)) {
    if (!/^event:\d+:(stdout|stderr)$/.test(key)) continue;
    checkOutput[key] = firstKey.has(text)
      ? `[identical to checkOutput ${firstKey.get(text)}]`
      : text;
    if (!firstKey.has(text)) firstKey.set(text, key);
  }
  const events = evidence.events.map((event) => {
    const streams = ["stdout", "stderr"].filter(
      (stream) => `event:${event.seq}:${stream}` in checkOutput,
    );
    if (!streams.length) return event;
    const result = { ...event.result };
    for (const stream of streams) result[stream] = `[see checkOutput event:${event.seq}:${stream}]`;
    return { ...event, result };
  });
  return {
    input: JSON.stringify({
      skill: item.skill,
      userTurns: item.judgeGuidance ? evidence.turns : evidence.turns.map(judgingTurn),
      referenceDate: evidence.referenceDate,
      originalFiles: evidence.before,
    }),
    actualOutput: JSON.stringify({
      // Unchanged files are already in originalFiles; only changes are repeated.
      resultingFiles: Object.fromEntries(
        Object.entries(evidence.after).filter(([file, text]) => evidence.before[file] !== text),
      ),
      unchangedFiles: Object.keys(evidence.after).filter(
        (file) => evidence.before[file] === evidence.after[file],
      ),
      deletedFiles: Object.keys(evidence.before).filter((file) => !(file in evidence.after)),
      replies: evidence.replies,
      events,
      checkOutput,
      execution: sources.execution,
      ...(item.reportEvaluation ? { finalReportFields: finalReportSources(item, evidence) } : {}),
    }),
    expectedOutput: JSON.stringify({
      obligations: item.obligations,
      ...(item.reportEvaluation ? { evaluationScope: item.reportEvaluation } : {}),
    }),
  };
}
