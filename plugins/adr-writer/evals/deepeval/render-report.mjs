#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareCoverageVisuals } from "./coverage-render.mjs";
import { saveDeepEvalReport } from "./report.mjs";

/** Rebuild the matching report format without invoking an agent or changing captured evidence. */
export async function renderSavedReport(directory) {
  const target = path.resolve(directory);
  const report = JSON.parse(readFileSync(path.join(target, "results.json"), "utf8"));
  if (report.framework === "skill-evals") {
    const { saveSkillsReport } = await import("../skills/report.mjs");
    return saveSkillsReport(target, report);
  }
  if (
    report.framework !== "deepeval" ||
    !Array.isArray(report.cases) ||
    !Array.isArray(report.runs)
  )
    throw new Error("Expected an existing DeepEval report directory");
  await prepareCoverageVisuals(report, target);
  saveDeepEvalReport(target, report);
  return path.join(target, "index.html");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    process.stderr.write("Usage: pnpm eval:report <existing-deepeval-report-directory>\n");
    process.exitCode = 1;
  } else {
    try {
      process.stdout.write((await renderSavedReport(process.argv[2])) + "\n");
    } catch (error) {
      process.stderr.write(error.message + "\n");
      process.exitCode = 1;
    }
  }
}
