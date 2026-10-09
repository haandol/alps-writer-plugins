import path from "node:path";
import { snapshot } from "../regression/workspace.mjs";
import { validateReport, renderHtml } from "../../skills/report-writer/scripts/render-report.mjs";

export const REPORT_OUTPUT = ".adr-review/report.json";

/** Check captured files and paired tool results; prose and branch meaning belong to GEval. */
export function checkReportArtifact({ files, events, source }) {
  const checks = [];
  const check = (label, pass, detail = "") => checks.push({ label, pass, detail });
  const requests = events.filter((e) => e.kind === "request");
  const completed = (tool, file) =>
    requests.some(
      (q) =>
        q.tool === tool &&
        q.arguments?.path === file &&
        events.some((e) => e.kind === "result" && e.request === q.seq && e.ok === true),
    );
  check("original source preserved", files["source.md"] === source);
  check(
    "only declared output exists",
    Object.keys(files).every((file) => file === "source.md" || file === REPORT_OUTPUT),
  );
  check(
    "no out-of-scope mutation attempted",
    requests
      .filter((q) =>
        ["write_file", "delete_file", "move_file", "demote_adr_status"].includes(q.tool),
      )
      .every((q) => q.tool === "write_file" && q.arguments?.path === REPORT_OUTPUT),
  );
  for (const file of [
    "source.md",
    "plugin/skills/report-writer/SKILL.md",
    "plugin/skills/report-writer/references/report-document.md",
  ])
    check(`read completed: ${file}`, completed("read_file", file));
  check("declared report write completed", completed("write_file", REPORT_OUTPUT));
  let doc;
  try {
    doc = JSON.parse(files[REPORT_OUTPUT]);
    check("saved JSON parses", true);
  } catch (error) {
    check("saved JSON parses", false, error.message);
    return checks;
  }
  try {
    const result = validateReport(doc);
    check("native document format", true);
    const html = renderHtml(doc);
    check("native HTML renders", html.length > 0, result.warnings.join("; "));
  } catch (error) {
    check("native document format", false, error.message);
  }
  const evidence = [];
  function walk(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (Array.isArray(node?.evidence)) evidence.push(...node.evidence);
      walk(node?.children);
    }
  }
  walk(doc?.sections);
  // This closed fixture supplies exactly one original, so a self-link or an
  // invented web source cannot stand in for it. Resolve as beside report.json.
  const invalid = evidence.filter((item) => {
    if (typeof item?.source !== "string") return true;
    try {
      const target = decodeURIComponent(item.source);
      return (
        /[:?#\\]/.test(target) ||
        path.posix.isAbsolute(target) ||
        path.posix.normalize(path.posix.join(".adr-review", target)) !== "source.md"
      );
    } catch {
      return true;
    }
  });
  check(
    "evidence resolves to supplied original",
    evidence.length > 0 && invalid.length === 0,
    invalid.map((item) => String(item?.source)).join(", "),
  );
  return checks;
}

export function scoreReportArtifact({ dir, events }, source) {
  return checkReportArtifact({ files: snapshot(dir), events, source });
}
