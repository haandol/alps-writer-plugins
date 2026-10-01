import { evidenceSources } from "../regression/judge.mjs";

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
  const sources = evidenceSources(evidence);
  // The final files cannot reconstruct a transient contract rewrite. Preserve
  // requests and results, including failed writes and write-then-restore bodies.
  // The context-budget check rejects oversized evidence instead of losing it.
  const events = evidence.events;
  const checkOutput = Object.fromEntries(
    Object.entries(sources).filter(([key]) => /^event:\d+:(stdout|stderr)$/.test(key)),
  );
  return {
    input: JSON.stringify({
      skill: item.skill,
      userTurns: evidence.turns,
      referenceDate: evidence.referenceDate,
      originalFiles: evidence.before,
    }),
    actualOutput: JSON.stringify({
      resultingFiles: evidence.after,
      replies: evidence.replies,
      events,
      checkOutput,
      execution: sources.execution,
    }),
    expectedOutput: JSON.stringify({ obligations: item.obligations }),
  };
}
