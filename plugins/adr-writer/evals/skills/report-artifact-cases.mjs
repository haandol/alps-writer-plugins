import { writeFileSync } from "node:fs";
import path from "node:path";
import { TAIL_SPEC } from "../lib/harness.mjs";
import { REPORT_OUTPUT, scoreReportArtifact } from "./report-artifact-checks.mjs";
import { reportProcessFixtures } from "./report-process-fixtures.mjs";

/** Actual first-save document probes reuse the fixed process corpus and confined MCP. */
export const reportArtifactCases = reportProcessFixtures.map((item) => ({
  id: `report-artifact-${item.id}`,
  name: `report-artifact-${item.id}`,
  title: `실제 보고서 저장 · ${item.title}`,
  description: item.title,
  type: "classification",
  skill: "report-writer",
  group: "report",
  artifactPaths: [REPORT_OUTPUT],
  supplementalChecks: true,
  semanticObligations: [
    ...item.obligations,
    ...(item.id === "evaluation-pipeline"
      ? [
          {
            id: "repair-path-scope",
            text: "Inspect all report prose and diagram paths, not just error labels. The source allows one citation-format repair with identical criteria and evidence. It supplies no malformed-JSON repair permission: do not route malformed JSON, alone or through a shared error node or the false branch of JSON-valid AND citation-valid, into citation repair. Account for both error types. A prose caveat or general PASS cannot repair an unsupported arrow. Do not turn absent permission into a claim that every other possible system universally forbids recovery. A statement explicitly limited to what this supplied source authorizes (for example, that it does not authorize malformed-JSON repair) is not itself a universal prohibition; distinguish it from claiming recovery is impossible or forbidden under unspecified policies. When repair is performed, preserve the original and repair attempts; preserve real FAIL/UNVERIFIED results.",
          },
          {
            id: "attempt-provenance",
            text: "Trace the record-preservation outcome as well as recovery actions in every diagram and paragraph. Two judge attempts exist when the permitted repair is actually performed. A malformed-JSON path with no repair, or a path explicitly declining repair, must not reach an unconditional outcome claiming that two attempts occurred or two attempt records exist. A shared logging node may preserve all actual attempts without inventing a second attempt. Conditional prose does not correct a contradictory unconditional diagram label.",
          },
        ]
      : []),
    ...(item.id === "limited-evidence"
      ? [
          {
            id: "unknown-is-not-forbidden",
            text: "The source says download is available when the query returns available. Do not strengthen that sufficient condition into a necessary or exclusive condition without evidence. Unknown internals, retries and ordering remain unspecified rather than asserted absent, impossible or prohibited. Honor prose-only delivery without fabricated internal stages.",
          },
        ]
      : []),
    {
      id: "artifact-and-verification-scope",
      text: "Judge the actual saved report, not a reply promising it. Preserve source meaning in every paragraph, table and diagram. Report self-review honestly; the target has no renderer, browser, deployment or reader-study tools and must not claim those checks ran. Host-side format validation is not semantic correctness or measured reader understanding. No quiz was requested in this task.",
    },
  ],
  build(dir) {
    writeFileSync(path.join(dir, "source.md"), item.facts);
    return [
      item.request,
      "Read source.md and plugin/skills/report-writer/SKILL.md with the fixture tools; read the necessary references including references/report-document.md under that skill directory. Treat source.md as the only factual source.",
      `Actually save a Korean report as JSON at ${REPORT_OUTPUT}, using the existing report-document schema. Only this file is writable; do not change the source or instructions or create plan files. Use relative local evidence links: the host renders the document to .adr-review/report.html beside your JSON after capture. Keep section descriptions in labels, not in file targets. Include the original source as evidence.`,
      "No quiz. There is no shell or browser; the host validates and renders your first saved final document. Do not claim to have run those tools. No validator feedback or repair turn is provided in this probe. Your final reply can be short; actual document content belongs in the saved file.",
      TAIL_SPEC,
    ].join("\n\n");
  },
  score(context) {
    return scoreReportArtifact(context, item.facts);
  },
}));
