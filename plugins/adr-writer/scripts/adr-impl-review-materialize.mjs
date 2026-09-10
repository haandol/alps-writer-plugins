#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { relatedAdrComparisonProse, hillNarrativeParagraphs } from "./adr-impl-review-prose.mjs";
import { proseLines } from "./adr-impl-review-diagrams.mjs";

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
  const prose = new Set(proseLines(source).map((line) => line.index));
  const start = lines.findIndex(
    (line, index) => prose.has(index) && line.trim() === `## ${heading}`,
  );
  if (start < 0) usage(`implementation-review.md missing: ## ${heading}`);

  const end = nextHeading
    ? lines.findIndex(
        (line, index) => index > start && prose.has(index) && line.trim() === `## ${nextHeading}`,
      )
    : lines.findIndex((line, index) => index > start && prose.has(index) && /^##\s+/.test(line));
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

const HILL_EVIDENCE_LABELS = {
  en: {
    implementation: "Implementation",
    evidence: "Evidence",
    tests: "Tests",
  },
  ko: {
    implementation: "구현",
    evidence: "근거",
    tests: "테스트",
  },
};
const COMPONENT_LABELS = {
  en: {
    component: "Component",
    responsibility: "Responsibility",
    implementation: "Detailed implementation",
    verification: "Verification result",
    code: "Code",
    location: "Location",
    explanation: "Why this code matters",
    tests: "Tests",
  },
  ko: {
    component: "Component",
    responsibility: "책임",
    implementation: "상세 구현",
    verification: "검증 결과",
    code: "Code",
    location: "위치",
    explanation: "코드 근거 설명",
    tests: "테스트",
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
 * Materialize the complete ledger as a concise Hiking route summary.
 * The seven audit fields remain authoritative in findings.json and each Hill
 * owns the detailed human-readable evidence for its assigned contracts.
 */
function coverageTable(rows, language, reviewHike) {
  const headers =
    language === "ko"
      ? ["계약", "상태", "Hill", "요구사항"]
      : ["Contract", "Status", "Hill", "Requirement"];
  const hillByContract = new Map(
    reviewHike.hills.flatMap((hill) => hill.contractIds.map((contractId) => [contractId, hill.id])),
  );
  return [
    `| ${headers.join(" | ")} |`,
    "| --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${tableCell(row.contractId)} | ${tableCell(COVERAGE_STATUS_LABELS[language][row.status] || row.status)} | ${tableCell(hillByContract.get(row.contractId))} | ${tableCell(row.requirement)} |`,
    ),
  ].join("\n");
}

function hillEvidence(rows, language) {
  const labels = HILL_EVIDENCE_LABELS[language];
  return rows
    .map((row) => {
      const status = COVERAGE_STATUS_LABELS[language][row.status] || row.status;
      return [
        `### ${tableCell(row.contractId)} · ${tableCell(status)} · ${tableCell(row.requirement)}`,
        "",
        `**${labels.implementation}.** ${tableCell(row.implementation)}`,
        "",
        `**${labels.evidence}.** ${tableCell(row.evidence)}`,
        "",
        `**${labels.tests}.** ${tableCell(row.tests)}`,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Materialize the shared review context and optional ADR analogy paragraphs so
 * Markdown and HTML teach the same evidence-grounded mental model.
 */
function reviewContext(context, comparisons, language) {
  const comparisonProse = comparisons.map((comparison) => {
    const prose = tableCell(relatedAdrComparisonProse(comparison, language));
    if (language === "ko") {
      return `**${tableCell(comparison.title)}** (\`${tableCell(comparison.adr)}\`)와 비교하면 ${prose}`;
    }
    return `Compared with **${tableCell(comparison.title)}** (\`${tableCell(comparison.adr)}\`), ${prose}`;
  });
  return [
    tableCell(context.intent),
    "",
    tableCell(context.preconditions),
    "",
    tableCell(context.contracts),
    "",
    tableCell(context.scopeAndRisk),
    ...(comparisonProse.length
      ? ["", ...comparisonProse.flatMap((paragraph) => [paragraph, ""])]
      : []),
  ].join("\n");
}

/** Keep the generated explanation aligned with HTML without duplicating equal fields. */
function containerZoom(hill) {
  return hillNarrativeParagraphs(hill).map(tableCell).join("\n\n");
}

/** Keep any fences inside quoted evidence literal by enclosing them in a longer fence. */
function evidenceFence(content) {
  const runs = String(content).match(/`+/g) || [];
  return "`".repeat(Math.max(2, ...runs.map((run) => run.length)) + 1);
}

function componentZoom(components, language) {
  const labels = COMPONENT_LABELS[language];
  return components
    .map((component) => {
      const codeBlocks = component.codeEvidence
        .map((codeEvidence, index) =>
          [
            `#### ${labels.code} ${index + 1} · ${tableCell(codeEvidence.kind)} · ${tableCell(codeEvidence.location)}`,
            "",
            `${evidenceFence(codeEvidence.content)}${codeEvidence.kind === "diff" ? "diff" : ""}`,
            String(codeEvidence.content).trim(),
            evidenceFence(codeEvidence.content),
            "",
            `- ${labels.explanation}: ${tableCell(codeEvidence.explanation)}`,
            `- ${labels.tests}: ${tableCell(codeEvidence.tests)}`,
          ].join("\n"),
        )
        .join("\n\n");
      return [
        `### ${labels.component} ${tableCell(component.id)} · ${tableCell(component.name)}`,
        "",
        `**${labels.responsibility}.** ${tableCell(component.responsibility)}`,
        "",
        `**${labels.implementation}.** ${tableCell(component.implementation)}`,
        "",
        `**${labels.verification}.** ${tableCell(component.verification)}`,
        "",
        codeBlocks,
      ].join("\n");
    })
    .join("\n\n");
}

function replaceGeneratedBlock(source, heading, placeholder, generatedStart, generatedEnd, body) {
  const lines = source.split(/\r?\n/);
  const prose = new Set(proseLines(source).map((line) => line.index));
  const start = lines.findIndex((line, index) => prose.has(index) && line.trim() === heading);
  if (start < 0) usage(`implementation-review.md missing heading: ${heading}`);
  const stopCandidate = lines.findIndex(
    (line, index) => index > start && prose.has(index) && /^##\s+/.test(line),
  );
  const stop = stopCandidate < 0 ? lines.length : stopCandidate;
  const placeholderIndex = lines.findIndex(
    (line, index) =>
      index > start && index < stop && prose.has(index) && line.trim() === placeholder,
  );
  const generatedStartIndex = lines.findIndex(
    (line, index) =>
      index > start && index < stop && prose.has(index) && line.trim() === generatedStart,
  );
  const generatedEndIndex =
    generatedStartIndex < 0
      ? -1
      : lines.findIndex(
          (line, index) =>
            index > generatedStartIndex &&
            index < stop &&
            prose.has(index) &&
            line.trim() === generatedEnd,
        );
  const block = [generatedStart, "", body, "", generatedEnd];
  if (placeholderIndex >= 0) {
    return [
      ...lines.slice(0, placeholderIndex),
      ...block,
      ...lines.slice(placeholderIndex + 1),
    ].join("\n");
  }
  if (generatedStartIndex >= 0 && generatedEndIndex > generatedStartIndex) {
    return [
      ...lines.slice(0, generatedStartIndex),
      ...block,
      ...lines.slice(generatedEndIndex + 1),
    ].join("\n");
  }
  usage(`implementation-review.md ${heading} missing generated content marker`);
}

function replaceHillEvidence(source, hill, rows, language) {
  return replaceGeneratedBlock(
    source,
    `## ${hill.title}`,
    "<!-- generated hill evidence from findings.json -->",
    "<!-- generated hill evidence start -->",
    "<!-- generated hill evidence end -->",
    hillEvidence(rows, language),
  );
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
    ...check.questions.map((question, index) =>
      [
        `${index + 1}. ${question.id} — ${question.question}`,
        ...question.options.map((option) => `   - ${option.id}. ${option.text}`),
      ].join("\n"),
    ),
  ].join("\n");
}

function diagnosticsSection(diagnostics, language) {
  const labels =
    language === "ko"
      ? {
          contractCompleteness: "계약과 범위",
          testSufficiency: "자체 검증 결과",
          necessity: "필요성과 과다 변경",
        }
      : {
          contractCompleteness: "Contracts and scope",
          testSufficiency: "Self-validation results",
          necessity: "Necessity and excess scope",
        };
  return ["contractCompleteness", "testSufficiency", "necessity"]
    .map((field) => {
      const item = diagnostics[field];
      return [
        `### ${labels[field]}`,
        "",
        tableCell(item.assessment),
        "",
        tableCell(item.evidence),
      ].join("\n");
    })
    .join("\n\n");
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
  if (!Array.isArray(data.reviewHike?.hills) || data.reviewHike.hills.length === 0) {
    usage("findings.json reviewHike.hills must be a non-empty array");
  }
  if (!Array.isArray(data.implementationChoices)) {
    usage("findings.json implementationChoices must be an array");
  }
  if (!data.reviewDiagnostics || typeof data.reviewDiagnostics !== "object") {
    usage("findings.json reviewDiagnostics must be an object");
  }
  if (data.comprehensionCheck !== undefined && !Array.isArray(data.comprehensionCheck?.questions)) {
    usage("findings.json comprehensionCheck.questions must be an array");
  }

  const atAGlance = [
    data.atAGlance.impact,
    "",
    data.atAGlance.action,
    "",
    data.atAGlance.risk,
    "",
    `${data.verdict}.`,
  ].join("\n");
  const language = reportLanguage(data);

  report = replaceSection(report, "At a glance", "Review mode", atAGlance);
  report = replaceGeneratedBlock(
    report,
    "## Context",
    "<!-- generated review context from findings.json -->",
    "<!-- generated review context start -->",
    "<!-- generated review context end -->",
    reviewContext(
      data.reviewHike.context,
      Array.isArray(data.relatedAdrComparisons) ? data.relatedAdrComparisons : [],
      language,
    ),
  );
  for (const hill of data.reviewHike.hills) {
    report = replaceGeneratedBlock(
      report,
      `## ${hill.title}`,
      "<!-- generated container zoom from findings.json -->",
      "<!-- generated container zoom start -->",
      "<!-- generated container zoom end -->",
      containerZoom(hill),
    );
    report = replaceGeneratedBlock(
      report,
      `## ${hill.title}`,
      "<!-- generated component zoom from findings.json -->",
      "<!-- generated component zoom start -->",
      "<!-- generated component zoom end -->",
      componentZoom(hill.components, language),
    );
    const rows = hill.contractIds.map((contractId) => {
      const row = data.contractCoverage.find((candidate) => candidate.contractId === contractId);
      if (!row) usage(`reviewHike Hill ${hill.id} references unknown contract: ${contractId}`);
      return row;
    });
    report = replaceHillEvidence(report, hill, rows, language);
  }
  report = replaceGeneratedBlock(
    report,
    "## Findings",
    "<!-- generated review diagnostics from findings.json -->",
    "<!-- generated review diagnostics start -->",
    "<!-- generated review diagnostics end -->",
    diagnosticsSection(data.reviewDiagnostics, language),
  );
  report = replaceSection(
    report,
    "ADR contract coverage",
    "Notable implementation choices",
    coverageTable(data.contractCoverage, language, data.reviewHike),
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
