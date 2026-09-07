#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function usage(message) {
  if (message) process.stderr.write(`adr-impl-review-materialize: ${message}\n`);
  process.stderr.write("Usage: node adr-impl-review-materialize.mjs <artifact-dir>\n");
  process.exit(2);
}

function tableCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function replaceSection(source, heading, nextHeading, body) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) usage(`implementation-review.md missing: ## ${heading}`);

  const end = nextHeading
    ? lines.findIndex((line, index) => index > start && line.trim() === `## ${nextHeading}`)
    : lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  if (nextHeading && end < 0) {
    usage(`implementation-review.md missing section after ## ${heading}: ## ${nextHeading}`);
  }

  const stop = end < 0 ? lines.length : end;
  return [
    ...lines.slice(0, start + 1),
    "",
    ...String(body).trim().split(/\r?\n/),
    "",
    ...lines.slice(stop),
  ].join("\n");
}

const COVERAGE_STATUS_LABELS = {
  en: {
    PROVEN: "Met",
    VIOLATED: "Fix required",
    UNVERIFIED: "Verification required",
    CONTRADICTED: "Conflicting evidence",
  },
  ko: {
    PROVEN: "충족됨",
    VIOLATED: "수정 필요",
    UNVERIFIED: "검증 필요",
    CONTRADICTED: "근거 충돌",
  },
};

function reportLanguage(data) {
  return String(data.language || "")
    .toLowerCase()
    .startsWith("ko")
    ? "ko"
    : "en";
}

/**
 * Materialize the complete ledger as a concise human summary.
 * The seven audit fields remain authoritative in findings.json.
 */
function coverageTable(rows, language) {
  const headers =
    language === "ko"
      ? ["계약", "상태", "요구사항", "검토 결과"]
      : ["Contract", "Status", "Requirement", "Review result"];
  return [
    `| ${headers.join(" | ")} |`,
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${tableCell(row.contractId)} | ${tableCell(COVERAGE_STATUS_LABELS[language][row.status] || row.status)} | ${tableCell(row.requirement)} | ${tableCell(row.implementation)} |`,
    ),
  ].join("\n");
}

function choicesTable(choices) {
  if (choices.length === 0) return "None found.";
  return [
    "| Selected value or behavior | Code evidence | Why it fits the ADR intent | Why it matters |",
    "| --- | --- | --- | --- |",
    ...choices.map(
      (choice) =>
        `| ${tableCell(choice.choice)} | ${tableCell(choice.evidence)} | ${tableCell(choice.intentFit)} | ${tableCell(choice.whyItMatters)} |`,
    ),
  ].join("\n");
}

function comprehensionSection(check) {
  return [
    check.prGuidance,
    "",
    ...check.questions.map(
      (question, index) => `${index + 1}. ${question.id} — ${question.question}`,
    ),
  ].join("\n");
}

function main() {
  const artifactDirArg = process.argv[2];
  if (!artifactDirArg || process.argv.length !== 3) usage();

  const artifactDir = path.resolve(artifactDirArg);
  const reportPath = path.join(artifactDir, "implementation-review.md");
  const findingsPath = path.join(artifactDir, "findings.json");

  let report;
  let data;
  try {
    report = readFileSync(reportPath, "utf8");
  } catch (error) {
    usage(`cannot read ${reportPath}: ${error.message}`);
  }
  try {
    data = JSON.parse(readFileSync(findingsPath, "utf8"));
  } catch (error) {
    usage(`cannot read findings.json: ${error.message}`);
  }

  if (!data?.atAGlance || typeof data.atAGlance !== "object") {
    usage("findings.json atAGlance must be an object");
  }
  if (!Array.isArray(data.contractCoverage)) {
    usage("findings.json contractCoverage must be an array");
  }
  if (!Array.isArray(data.implementationChoices)) {
    usage("findings.json implementationChoices must be an array");
  }
  if (data.comprehensionCheck !== undefined && !Array.isArray(data.comprehensionCheck?.questions)) {
    usage("findings.json comprehensionCheck.questions must be an array");
  }

  const atAGlance = [
    `- Verdict: ${data.verdict}`,
    `- Impact: ${data.atAGlance.impact}`,
    `- Action: ${data.atAGlance.action}`,
    `- Risk: ${data.atAGlance.risk}`,
  ].join("\n");

  report = replaceSection(report, "At a glance", "Review mode", atAGlance);
  report = replaceSection(
    report,
    "ADR contract coverage",
    "Notable implementation choices",
    coverageTable(data.contractCoverage, reportLanguage(data)),
  );
  report = replaceSection(
    report,
    "Notable implementation choices",
    "Tests",
    choicesTable(data.implementationChoices),
  );
  if (data.comprehensionCheck?.questions?.length) {
    report = replaceSection(
      report,
      "Comprehension check",
      null,
      comprehensionSection(data.comprehensionCheck),
    );
  }

  writeFileSync(reportPath, `${report.trim()}\n`);
  process.stdout.write(`materialized ${reportPath}\n`);
}

main();
