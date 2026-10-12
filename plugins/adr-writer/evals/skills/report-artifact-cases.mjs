import { writeFileSync } from "node:fs";
import path from "node:path";
import { TAIL_SPEC } from "../lib/harness.mjs";
import { REPORT_OUTPUT, scoreReportArtifact } from "./report-artifact-checks.mjs";
import { reportProcessFixtures } from "./report-process-fixtures.mjs";

import {
  REPORT_EVALUATION,
  REPORT_SOURCE_RULE,
  REPORT_DIAGRAM_RULE,
  FINAL_REPORT_INSTRUCTION,
} from "./report-evaluation.mjs";

/** Final-report probes reuse the fixed process corpus and confined MCP. */
export const reportArtifactCases = reportProcessFixtures.map((item) => ({
  id: `report-artifact-${item.id}`,
  name: `report-artifact-${item.id}`,
  title: `실제 보고서 저장 · ${item.title}`,
  description: item.title,
  type: "classification",
  skill: "report-writer",
  group: "report",
  artifactPaths: [REPORT_OUTPUT],
  reportEvaluation: REPORT_EVALUATION,
  supplementalChecks: true,
  semanticObligations: [
    ...item.obligations.map((o) => ({
      ...o,
      axis: o.id === "complete" ? "source" : "delivery",
      text:
        o.id === "complete"
          ? `Explain all material source responsibilities, exact rules and limits in the final prose. ${REPORT_SOURCE_RULE}`
          : `${o.text} Assess presentation and explanatory coverage here; judge factual claims and permitted diagram paths under source and diagrams, not this obligation.`,
    })),
    ...(item.id === "limited-evidence"
      ? []
      : [{ id: "diagram-fidelity", axis: "diagrams", text: REPORT_DIAGRAM_RULE }]),
    ...(item.id === "evaluation-pipeline"
      ? [
          {
            id: "repair-path-scope",
            axis: "source",
            text: "In the final prose, captions and tables, preserve the one citation-format repair permission with identical criteria and evidence. Do not claim the source authorizes malformed-JSON repair. Account for both error types without turning absent permission into a universal prohibition on unspecified systems. Preserve real FAIL/UNVERIFIED results and both attempts when repair is performed. Figure paths are judged under diagram-fidelity.",
          },
          {
            id: "attempt-provenance",
            axis: "source",
            text: "In the final prose, captions and tables, two judge attempts exist only when the permitted repair is actually performed. A no-repair path must not claim a second attempt or its record exists. Preserve all actual attempts. Figure paths and their outcome labels are judged under diagram-fidelity.",
          },
        ]
      : []),
    ...(item.id === "limited-evidence"
      ? [
          {
            id: "unknown-is-not-forbidden",
            axis: "source",
            text: "The source says download is available when the query returns available. Do not strengthen that sufficient condition into a necessary or exclusive condition without evidence. Unknown internals, retries and ordering remain unspecified rather than asserted absent, impossible or prohibited. Honor prose-only delivery without fabricated internal stages.",
          },
        ]
      : []),
    {
      id: "artifact-and-verification-scope",
      axis: "delivery",
      text: "Judge the actual saved report, not a reply promising it. Report self-review honestly; the target has no renderer, browser, deployment or reader-study tools and must not claim those checks ran. Host-side format validation is not semantic correctness or measured reader understanding. No quiz was requested in this task.",
    },
  ],
  build(dir) {
    writeFileSync(path.join(dir, "source.md"), item.facts);
    return [
      item.request,
      "Read source.md and plugin/skills/report-writer/SKILL.md with the fixture tools; read the necessary references including references/report-document.md under that skill directory. Use source.md as the authority for system facts; ordinary definitions and clearly illustrative examples may explain them without adding new system guarantees.",
      `Actually save a Korean report as JSON at ${REPORT_OUTPUT}, using the existing report-document schema. Only this file is writable; do not change the source or instructions or create plan files. Use relative local evidence links: the host renders the document to .adr-review/report.html beside your JSON after capture. Keep section descriptions in labels, not in file targets. Include the original source as evidence.`,
      "No quiz. There is no shell or browser. Your final reply can be short; actual document content belongs in the saved file.",
      FINAL_REPORT_INSTRUCTION,
      TAIL_SPEC,
    ].join("\n\n");
  },
  score(context) {
    return scoreReportArtifact(context, item.facts);
  },
}));
