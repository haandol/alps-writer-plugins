import path from "node:path";

export const REPORT_OUTPUT = ".adr-review/report.json";
export const REPORT_EVALUATION = Object.freeze({ version: "final-report-v1", path: REPORT_OUTPUT });
export const REPORT_AXES = Object.freeze({
  terminology: "용어 일관성",
  source: "출처 충실성",
  diagrams: "도표 정확성",
  delivery: "구성과 전달",
});

export const REPORT_SOURCE_RULE =
  "Judge prose, captions and tables against the source's system facts. Accept accurate ordinary definitions, faithful paraphrases and clearly illustrative examples that do not add system-specific guarantees or contradict the source. Explaining literal values with strings/numbers or a class instance as an entity is not by itself an invented system fact. Assess the claim in its surrounding passage, not verb strength or word overlap. Before FAIL, identify the specific new observable behavior, constraint or mechanism asserted beyond the source; equivalent wording alone is not a violation. If a material interpretation cannot be established, use UNVERIFIED and name the missing context rather than declaring a contradiction. Distinguish a logical management scope from a claimed runtime/security boundary. Reject unsupported timing, ordering, permissions, exclusivity, state restrictions, measurements or implemented mechanisms. Unknown details remain unknown; a sufficient condition does not establish a necessary condition. Judge diagram paths separately under the diagrams axis.";

export const REPORT_DIAGRAM_RULE =
  "Judge the actual figures against the source, independently of correct prose. Every path to an action or result must preserve required conditions, permissions, ordering and failure guarantees. Unspecified order between checks does not allow bypassing either required check: sequential checks or parallel checks joined before the action can both be valid. Trace feasible paths under their decision predicates: the Yes branch of P AND Q requires both to hold; merely reaching that decision is not unconditional permission. A caption cannot repair an unsupported arrow. Preserve source scope without inventing missing actors, recovery paths or extra attempt records.";

export const FINAL_REPORT_INSTRUCTION =
  "You may revise the declared report during this invocation. After it ends, the host validates and judges the final saved document; no external validator feedback or extra repair turn is provided. Earlier drafts are not the delivered report. All tool actions remain recorded and unauthorized actions still count even if later undone. Do not claim to have run the host's renderer or browser.";

export const REPORT_JUDGING_STEPS = [
  "For this report evaluation, judge terminology, source fidelity and diagrams ONLY in the final document named by evaluationScope. Cite after:<path> or the exact after:<path>#/JSON/pointer field IDs provided in finalReportFields. Field values are decoded verbatim, so prefer field citations for diagrams or prose containing quotes and newlines. Use original source facts and the request as supporting context. Earlier drafts and replies describing superseded mistakes are not current content defects. Missing final content remains unverified; do not replace it with a draft or completion claim.",
  "Use the complete action metadata, source-file mutations and replies to judge permissions and verification claims under delivery. Harness-only EVAL reply markers belong to the final reply, not the saved report; the runner checks them separately. Never require those markers inside report JSON. Unauthorized actions remain violations after restoration. Authorized editing of the report before completion is allowed. Report draft bodies are omitted only from this judging view; the complete raw trace remains archived.",
  "Keep the authored axes separate. A factual system overclaim belongs to source fidelity, not terminology when the terms and their relationships are correct. Grade figure paths under diagrams. Ordinary definitions and source-compatible examples are allowed; unsupported system guarantees are not. Overall PASS still requires every obligation and every mandatory local check to pass.",
];

export function validateReportEvaluation(item) {
  if (!item.reportEvaluation) return;
  const policy = item.reportEvaluation;
  if (policy.version !== REPORT_EVALUATION.version || policy.path !== REPORT_OUTPUT)
    throw new Error("Unknown report evaluation scope");
  const obligations = item.obligations ?? item.semanticObligations;
  if (
    !Array.isArray(obligations) ||
    !obligations.length ||
    obligations.some((o) => !Object.hasOwn(REPORT_AXES, o.axis))
  )
    throw new Error("Report obligations must identify a known evaluation axis");
}

/** Keep raw capture intact; only authorized report-body history is outside content grading. */
export function reportJudgingEvidence(item, evidence) {
  if (!item.reportEvaluation) return evidence;
  validateReportEvaluation(item);
  const requests = new Map(
    evidence.events.filter((e) => e.kind === "request").map((e) => [e.seq, e]),
  );
  const allowedWrite = (request) =>
    request?.tool === "write_file" &&
    typeof request.arguments?.path === "string" &&
    path.posix.normalize(request.arguments.path) === item.reportEvaluation.path;
  const withoutBody = (value) => {
    if (!value || typeof value !== "object") return value;
    const { content, before, after, ...metadata } = value;
    return metadata;
  };
  return {
    ...evidence,
    events: evidence.events.map((event) => {
      const request = event.kind === "request" ? event : requests.get(event.request);
      if (!allowedWrite(request)) return event;
      return {
        ...event,
        ...(event.arguments ? { arguments: withoutBody(event.arguments) } : {}),
        ...(event.result ? { result: withoutBody(event.result) } : {}),
        reportBody: "Use final resultingFiles; raw report revisions are retained in evidence.json.",
      };
    }),
  };
}

/** Exact decoded field text with JSON-pointer provenance; never paraphrase or repair the artifact. */
export function finalReportSources(item, evidence) {
  if (!item.reportEvaluation) return {};
  let document;
  try {
    document = JSON.parse(evidence.after[item.reportEvaluation.path]);
  } catch {
    return {};
  }
  const sources = {};
  const walk = (value, pointer) => {
    if (typeof value === "string")
      sources[`after:${item.reportEvaluation.path}#${pointer}`] = value;
    else if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value))
        walk(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  };
  walk(document, "");
  return sources;
}

/** Content verdicts must cite the final artifact, not the author's self-assessment or drafts. */
export function validateReportJudgment(item, judgment) {
  if (!item.reportEvaluation) return;
  const final = `after:${item.reportEvaluation.path}`;
  const isFinal = (source) => source === final || source.startsWith(`${final}#/`);
  const axes = new Map(item.obligations.map((o) => [o.id, o.axis]));
  for (const obligation of judgment.obligations) {
    if (axes.get(obligation.id) === "delivery" || obligation.verdict === "UNVERIFIED") continue;
    if (
      !obligation.evidence.some((e) => isFinal(e.source)) ||
      obligation.evidence.some((e) => !isFinal(e.source) && !/^(before:|user:)/.test(e.source))
    ) {
      const error = new Error(
        `Report content judgment must cite the final document: ${obligation.id}`,
      );
      error.code = "UNSUPPORTED_EVIDENCE";
      throw error;
    }
  }
}

/** Diagnostic per-axis results never replace or average away the overall verdict. */
export function summarizeReportAxes(item, runs) {
  if (!item.reportEvaluation) return [];
  const obligations = item.semanticObligations ?? item.obligations;
  return Object.entries(REPORT_AXES).flatMap(([axis, label]) => {
    const ids = obligations.filter((o) => o.axis === axis).map((o) => o.id);
    if (!ids.length) return [];
    const counts = { PASS: 0, FAIL: 0, UNVERIFIED: 0, ERROR: 0, NOT_RUN: 0, MISSING: 0 };
    for (const run of runs) {
      if (["ERROR", "NOT_RUN"].includes(run.verdict)) {
        counts[run.verdict]++;
        continue;
      }
      const judgments = ids.map((id) => run.obligationJudgments?.filter((o) => o.id === id));
      if (
        judgments.some(
          (matches) =>
            matches?.length !== 1 || !["PASS", "FAIL", "UNVERIFIED"].includes(matches[0].verdict),
        )
      ) {
        counts.MISSING++;
        continue;
      }
      const verdict = judgments.some(([o]) => o.verdict === "FAIL")
        ? "FAIL"
        : judgments.some(([o]) => o.verdict === "UNVERIFIED")
          ? "UNVERIFIED"
          : "PASS";
      counts[verdict]++;
    }
    return [{ axis, label, counts }];
  });
}
