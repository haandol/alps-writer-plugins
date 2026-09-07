#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATEGORY_NAMES, VERDICT_NAMES } from "./adr-impl-review-categories.mjs";

const ALLOWED_VERDICTS = VERDICT_NAMES;
const ALLOWED_CATEGORIES = CATEGORY_NAMES;
const ALLOWED_MODES = new Set(["standard", "full"]);
const ALLOWED_PERSPECTIVES = new Set(["necessity", "sufficiency", "both"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);
const ALLOWED_COVERAGE_STATUSES = new Set(["PROVEN", "VIOLATED", "UNVERIFIED", "CONTRADICTED"]);
const ALLOWED_DIAGRAM_TYPES = new Set([
  "flowchart",
  "sequenceDiagram",
  "stateDiagram-v2",
  "erDiagram",
]);
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
const REQUIRED_REPORT_TEXT = [
  "# ADR implementation review",
  "## At a glance",
  "## Review mode",
  "## Scope",
  "## ADR intent",
  "## Findings",
  "## ADR contract coverage",
  "## Notable implementation choices",
  "## Tests",
  "## Residual risks",
  "## Comprehension check",
];
const REQUIRED_EXPLANATION_FIRST_HEADING = "## ADR intent";
const REQUIRED_REPAIR_TEXT = [
  "## Repair guide",
  "Files and symbols to change:",
  "Scope not to touch:",
  "Completion criteria:",
  "Needs confirmation:",
];
const PASS_ADVISORY_CATEGORIES = new Set(["Refactor"]);

function usage(message) {
  if (message) process.stderr.write(`adr-impl-review-validate: ${message}\n`);
  process.stderr.write("Usage: node adr-impl-review-validate.mjs <artifact-dir>\n");
  process.exit(2);
}

function readJson(file, errors) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${path.basename(file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function resolveArtifact(baseDir, value) {
  if (!value || typeof value !== "string") return null;
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function stripFencedBlocks(source) {
  return source.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
}

/**
 * Escape authored headings before using them in section-boundary expressions.
 * Subject-specific headings stay flexible without letting punctuation alter validation.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Read human-facing section order while ignoring headings inside fenced examples.
 * The validator uses this order to keep ADR intent before narrative and evidence.
 */
function topLevelHeadings(source) {
  return stripFencedBlocks(source).match(/^## .+$/gm) ?? [];
}

function sectionBody(source, headingPattern, stopPattern) {
  const lines = stripFencedBlocks(source).split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return "";
  const body = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (stopPattern.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join("\n").trim();
}

function rawNarrativeBody(source) {
  const lines = String(source ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## ADR intent");
  if (start < 0) return "";
  const body = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].trim() === "## Findings") break;
    body.push(lines[index]);
  }
  return body.join("\n").trim();
}

function topLevelBullets(source) {
  const bullets = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (current) bullets.push(current);
      current = bullet[1].trim();
      continue;
    }
    if (current && /^\s{2,}\S/.test(line)) {
      current += ` ${line.trim()}`;
      continue;
    }
    if (current && line.trim()) {
      bullets.push(current);
      current = null;
    }
  }
  if (current) bullets.push(current);
  return bullets;
}

function resolveAdrPath(artifactDir, value) {
  if (!value || typeof value !== "string") return null;
  if (path.isAbsolute(value)) return value;
  const cwdPath = path.resolve(process.cwd(), value);
  if (existsSync(cwdPath)) return cwdPath;
  return path.resolve(artifactDir, value);
}

function expectedContractRows(artifactDir, adrValue, errors) {
  const adrPath = resolveAdrPath(artifactDir, adrValue);
  if (!adrPath || !existsSync(adrPath)) {
    errors.push(
      `findings.json adr does not resolve to an existing file: ${adrValue ?? "(missing)"}`,
    );
    return [];
  }

  const source = readFileSync(adrPath, "utf8");
  const decision = sectionBody(source, /^## Decision\s*$/i, /^##\s+/);
  const decisionCore = decision.split(/^###\s+/m)[0].trim();
  if (!decisionCore) {
    errors.push("ADR Decision section must contain reviewable text");
    return [];
  }

  const requirementContract = sectionBody(
    source,
    /^### Requirement contract\s*$/i,
    /^### (?!#)|^##\s+/,
  );
  return [
    { contractId: "D0", adrBasis: "Decision" },
    ...topLevelBullets(requirementContract).map((adrBasis, index) => ({
      contractId: `R${index + 1}`,
      adrBasis,
    })),
  ];
}

function validateFinding(finding, index, errors) {
  const label = `findings[${index}]`;
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of [
    "category",
    "perspective",
    "summary",
    "confidence",
    "whyItMatters",
    "expectedBehavior",
    "observedBehavior",
    "requestedChange",
    "editTargets",
    "completionCriteria",
    "code",
    "evidence",
    "test",
    "testResult",
  ]) {
    if (typeof finding[field] !== "string" || !finding[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string`);
    }
  }

  if (finding.category && !ALLOWED_CATEGORIES.has(finding.category)) {
    errors.push(`${label}.category is not recognized: ${finding.category}`);
  }
  if (finding.perspective && !ALLOWED_PERSPECTIVES.has(finding.perspective)) {
    errors.push(`${label}.perspective must be necessity, sufficiency, or both`);
  }
  if (finding.confidence && !ALLOWED_CONFIDENCE.has(finding.confidence)) {
    errors.push(`${label}.confidence must be high, medium, or low`);
  }
  if (!Array.isArray(finding.contractIds)) {
    errors.push(`${label}.contractIds must be an array`);
  } else {
    finding.contractIds.forEach((contractId, contractIndex) => {
      if (typeof contractId !== "string" || !contractId.trim()) {
        errors.push(`${label}.contractIds[${contractIndex}] must be a non-empty string`);
      }
    });
  }
}

function validateAtAGlance(atAGlance, errors) {
  if (!atAGlance || typeof atAGlance !== "object" || Array.isArray(atAGlance)) {
    errors.push("findings.json atAGlance must be an object");
    return;
  }

  for (const field of ["impact", "action", "risk"]) {
    if (typeof atAGlance[field] !== "string" || !atAGlance[field].trim()) {
      errors.push(`findings.json atAGlance.${field} must be a non-empty string`);
    }
  }
}

function validateVisualization(visualization, errors) {
  if (!visualization || typeof visualization !== "object" || Array.isArray(visualization)) {
    errors.push("findings.json visualization must be an object");
    return;
  }

  if (typeof visualization.required !== "boolean") {
    errors.push("findings.json visualization.required must be a boolean");
  }
  if (typeof visualization.reason !== "string" || !visualization.reason.trim()) {
    errors.push("findings.json visualization.reason must be a non-empty string");
  }
  if (
    visualization.diagramType !== undefined &&
    !ALLOWED_DIAGRAM_TYPES.has(visualization.diagramType)
  ) {
    errors.push(
      "findings.json visualization.diagramType must be flowchart, sequenceDiagram, stateDiagram-v2, or erDiagram",
    );
  }
  if (visualization.required && !ALLOWED_DIAGRAM_TYPES.has(visualization.diagramType)) {
    errors.push(
      "findings.json visualization.diagramType is required when visualization is required",
    );
  }
}

function validateScopes(data, errors) {
  for (const field of ["scope", "changeScope"]) {
    if (!Array.isArray(data[field])) {
      errors.push(`findings.json ${field} must be an array`);
      continue;
    }
    data[field].forEach((value, index) => {
      if (typeof value !== "string" || !value.trim()) {
        errors.push(`findings.json ${field}[${index}] must be a non-empty string`);
      }
    });
  }

  if (data.verdict === "PASS" && Array.isArray(data.scope) && data.scope.length === 0) {
    errors.push("PASS requires a non-empty complete implementation scope");
  }
}

function validateImplementationChoice(choice, index, errors) {
  const label = `implementationChoices[${index}]`;
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of ["choice", "evidence", "intentFit", "whyItMatters"]) {
    if (typeof choice[field] !== "string" || !choice[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string`);
    }
  }
}

function validateContractCoverage(row, index, errors) {
  const label = `contractCoverage[${index}]`;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of [
    "contractId",
    "requirement",
    "status",
    "adrBasis",
    "implementation",
    "evidence",
    "tests",
  ]) {
    if (typeof row[field] !== "string" || !row[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string`);
    }
  }

  if (row.status && !ALLOWED_COVERAGE_STATUSES.has(row.status)) {
    errors.push(`${label}.status must be PROVEN, VIOLATED, UNVERIFIED, or CONTRADICTED`);
  }
}

function validateComprehensionCheck(check, errors) {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    errors.push("findings.json comprehensionCheck must be an object");
    return;
  }

  if (typeof check.prGuidance !== "string" || !check.prGuidance.trim()) {
    errors.push("findings.json comprehensionCheck.prGuidance must be a non-empty string");
  }

  if (!Array.isArray(check.questions)) {
    errors.push("findings.json comprehensionCheck.questions must be an array");
    return;
  }
  if (check.questions.length < 1 || check.questions.length > 5) {
    errors.push("findings.json comprehensionCheck.questions must contain 1 to 5 questions");
  }

  const seen = new Set();
  for (const [index, question] of check.questions.entries()) {
    const label = `comprehensionCheck.questions[${index}]`;
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    for (const field of ["id", "question", "answerCriteria", "evidence"]) {
      if (typeof question[field] !== "string" || !question[field].trim()) {
        errors.push(`${label}.${field} must be a non-empty string`);
      }
    }
    const expectedId = `Q${index + 1}`;
    if (question.id !== expectedId) {
      errors.push(`${label}.id must be ${expectedId}`);
    }
    if (seen.has(question.id)) {
      errors.push(`comprehensionCheck contains duplicate question id: ${question.id}`);
    }
    seen.add(question.id);
  }
}

function validateContractCompleteness(rows, expectedRows, errors) {
  const expected = new Map(expectedRows.map((row) => [row.contractId, row]));
  const seen = new Set();

  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object") continue;
    const contractId = row.contractId;
    if (seen.has(contractId)) {
      errors.push(`contractCoverage contains duplicate contractId: ${contractId}`);
      continue;
    }
    seen.add(contractId);

    const expectedRow = expected.get(contractId);
    if (!expectedRow) {
      errors.push(`contractCoverage[${index}].contractId is not present in the ADR: ${contractId}`);
      continue;
    }
    if (row.adrBasis !== expectedRow.adrBasis) {
      errors.push(
        `contractCoverage[${index}].adrBasis must exactly match ${contractId}'s ADR source row`,
      );
    }
  }

  for (const contractId of expected.keys()) {
    if (!seen.has(contractId)) {
      errors.push(`contractCoverage is missing ADR contract row: ${contractId}`);
    }
  }
}

function validateFindingContractLinks(findings, coverageRows, errors) {
  const validIds = new Set(coverageRows.map((row) => row?.contractId).filter(Boolean));
  for (const [findingIndex, finding] of findings.entries()) {
    if (!Array.isArray(finding?.contractIds)) continue;
    for (const contractId of finding.contractIds) {
      if (!validIds.has(contractId)) {
        errors.push(
          `findings[${findingIndex}].contractIds references unknown contract row: ${contractId}`,
        );
      }
    }
  }
}

function validatePass(data, errors) {
  if (data.verdict !== "PASS") return;

  if (data.contractCoverage.some((row) => row?.status !== "PROVEN")) {
    errors.push("PASS requires every contractCoverage row to be PROVEN");
  }
  if (
    data.contractCoverage.some((row) =>
      /\b(?:NOT RUN|FAIL(?:ED)?)\b|미실행|실행하지 못/i.test(row?.tests ?? ""),
    )
  ) {
    errors.push("PASS contractCoverage tests must not contain failed or unexecuted results");
  }
  if (!Number.isInteger(data.metrics?.testCommandCount) || data.metrics.testCommandCount < 1) {
    errors.push("PASS requires at least one executed test or reproduction command");
  }
  if (data.metrics?.unverifiedRiskCount > 0) {
    errors.push("PASS cannot contain an Unverified risk");
  }

  const blocking = data.findings.filter(
    (finding) =>
      finding &&
      !PASS_ADVISORY_CATEGORIES.has(finding.category) &&
      !(finding.category === "Best practice" && finding.weight === "next-cycle"),
  );
  if (blocking.length > 0) {
    errors.push(`PASS cannot contain unresolved blocking findings: ${blocking.length}`);
  }
}

function tableRows(report, heading, nextHeading) {
  const section = sectionBody(
    report,
    new RegExp(`^## ${heading}\\s*$`, "i"),
    new RegExp(`^## ${nextHeading}\\s*$`, "i"),
  );
  const rows = section
    .split(/\r?\n/)
    .filter((line) => /^\s*\|.*\|\s*$/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`([^`]*)`$/, "$1")),
    );
  const separator = rows.findIndex(
    (cells) => cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)),
  );
  return separator >= 0 ? rows.slice(separator + 1) : [];
}

function validateMetrics(metrics, findings, errors) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    errors.push("findings.json metrics must be an object");
    return;
  }

  for (const field of ["startedAt", "completedAt"]) {
    if (typeof metrics[field] !== "string" || !metrics[field].trim()) {
      errors.push(`findings.json metrics.${field} must be a non-empty string`);
    } else if (Number.isNaN(Date.parse(metrics[field]))) {
      errors.push(`findings.json metrics.${field} must be an ISO date-time`);
    }
  }

  for (const field of [
    "elapsedSeconds",
    "necessityFindingCount",
    "sufficiencyFindingCount",
    "unverifiedRiskCount",
    "testCommandCount",
  ]) {
    if (!Number.isInteger(metrics[field]) || metrics[field] < 0) {
      errors.push(`findings.json metrics.${field} must be a non-negative integer`);
    }
  }

  const unverifiedRiskCount = findings.filter(
    (finding) => finding?.category === "Unverified risk",
  ).length;
  if (
    Number.isInteger(metrics.unverifiedRiskCount) &&
    metrics.unverifiedRiskCount !== unverifiedRiskCount
  ) {
    errors.push(
      `findings.json metrics.unverifiedRiskCount is ${metrics.unverifiedRiskCount}, expected ${unverifiedRiskCount}`,
    );
  }
}

function validateHeadingOrder(source, headings, label, errors) {
  let previous = -1;
  for (const heading of headings) {
    const index = source.indexOf(heading);
    if (index < 0) continue;
    if (index <= previous) {
      errors.push(`${label} headings must keep this order: ${headings.join(" → ")}`);
      return;
    }
    previous = index;
  }
}

function validateExplanation(explanation, errors) {
  const actualHeadings = topLevelHeadings(explanation);
  if (actualHeadings[0] !== REQUIRED_EXPLANATION_FIRST_HEADING) {
    errors.push(`explanation.md must start with ${REQUIRED_EXPLANATION_FIRST_HEADING}`);
  }
  if (actualHeadings.length < 2) {
    errors.push(
      "explanation.md must include at least one subject-specific heading after ## ADR intent",
    );
  }

  for (let index = 0; index < actualHeadings.length; index++) {
    const heading = actualHeadings[index];
    const body = sectionBody(
      explanation,
      new RegExp(`^${escapeRegExp(heading)}\\s*$`, "i"),
      /^##\s+/,
    );
    if (!body) errors.push(`explanation.md ${heading} must not be empty`);
  }
}

function validateReport(report, data, errors) {
  for (const text of REQUIRED_REPORT_TEXT) {
    if (!report.includes(text)) errors.push(`implementation-review.md missing: ${text}`);
  }
  validateHeadingOrder(
    report,
    [
      "## At a glance",
      "## Review mode",
      "## Scope",
      "## ADR intent",
      "## Findings",
      "## ADR contract coverage",
      "## Notable implementation choices",
      "## Tests",
      "## Residual risks",
      "## Comprehension check",
    ],
    "implementation-review.md",
    errors,
  );

  const reportHeadings = topLevelHeadings(report);
  const intentIndex = reportHeadings.indexOf("## ADR intent");
  const findingsIndex = reportHeadings.indexOf("## Findings");
  const narrativeHeadings =
    intentIndex >= 0 && findingsIndex > intentIndex
      ? reportHeadings
          .slice(intentIndex + 1, findingsIndex)
          .filter((heading) => heading !== "## Visual map")
      : [];
  if (narrativeHeadings.length < 1) {
    errors.push(
      "implementation-review.md must include at least one subject-specific narrative heading between ## ADR intent and ## Findings",
    );
  }

  for (const heading of ["## ADR intent", ...narrativeHeadings]) {
    const body = sectionBody(report, new RegExp(`^${escapeRegExp(heading)}\\s*$`, "i"), /^##\s+/);
    if (!body) errors.push(`implementation-review.md ${heading} must not be empty`);
  }

  const narrativeBody = rawNarrativeBody(report);
  if (data.visualization?.required) {
    const diagrams = [...narrativeBody.matchAll(/```mermaid\s*\n\s*([A-Za-z][^\s]*)[\s\S]*?```/gi)];
    if (diagrams.length === 0) {
      errors.push("implementation-review.md narrative must contain at least one Mermaid fence");
    }
    if ((narrativeBody.match(/^Notice:\s+\S+/gm) ?? []).length < diagrams.length) {
      errors.push(
        "implementation-review.md must contain one non-empty Notice: per Mermaid diagram",
      );
    }
    const diagramType = data.visualization.diagramType;
    if (diagramType && !diagrams.some((diagram) => diagram[1] === diagramType)) {
      errors.push(
        `implementation-review.md narrative must contain the declared ${diagramType} diagram`,
      );
    }
  }

  const atAGlanceBody = sectionBody(report, /^## At a glance\s*$/i, /^##\s+/);
  if (data.verdict && !atAGlanceBody.includes(data.verdict)) {
    errors.push("implementation-review.md At a glance is missing the verdict");
  }
  for (const [field, value] of Object.entries(data.atAGlance ?? {})) {
    if (typeof value === "string" && value.trim() && !atAGlanceBody.includes(value)) {
      errors.push(`implementation-review.md missing atAGlance.${field}`);
    }
  }

  const coverageRows = tableRows(report, "ADR contract coverage", "Notable implementation choices");
  const coverageById = new Map(coverageRows.map((cells) => [cells[0], cells]));
  const language = String(data.language || "")
    .toLowerCase()
    .startsWith("ko")
    ? "ko"
    : "en";
  for (const [index, row] of (data.contractCoverage ?? []).entries()) {
    const cells = coverageById.get(row.contractId);
    if (!cells) {
      errors.push(`implementation-review.md missing contractCoverage[${index}] table row`);
    } else if (cells.length < 4 || cells.some((cell) => !cell)) {
      errors.push(
        `implementation-review.md contractCoverage[${index}] must have four non-empty summary columns`,
      );
    } else if (cells[1] !== COVERAGE_STATUS_LABELS[language][row.status]) {
      errors.push(`implementation-review.md contractCoverage[${index}] status does not match JSON`);
    }
  }

  const choiceRows = tableRows(report, "Notable implementation choices", "Tests");
  if (choiceRows.length < (data.implementationChoices ?? []).length) {
    errors.push(
      `implementation-review.md has ${choiceRows.length} complete implementation-choice rows for ${data.implementationChoices.length} choices`,
    );
  }
  for (const [index, cells] of choiceRows.entries()) {
    if (cells.length < 4 || cells.some((cell) => !cell)) {
      errors.push(
        `implementation-review.md implementationChoices[${index}] must have four non-empty columns`,
      );
    }
  }

  const comprehensionBody = sectionBody(report, /^## Comprehension check\s*$/i, /^##\s+/);
  const check = data.comprehensionCheck;
  if (check?.prGuidance && !comprehensionBody.includes(check.prGuidance)) {
    errors.push("implementation-review.md missing comprehensionCheck.prGuidance");
  }
  for (const [index, question] of (check?.questions ?? []).entries()) {
    if (
      !comprehensionBody.includes(question.id) ||
      !comprehensionBody.includes(question.question)
    ) {
      errors.push(`implementation-review.md missing comprehensionCheck.questions[${index}] prompt`);
    }
    for (const hiddenField of ["answerCriteria", "evidence"]) {
      const hiddenValue = question[hiddenField];
      if (
        typeof hiddenValue === "string" &&
        hiddenValue.trim() &&
        comprehensionBody.includes(hiddenValue.trim())
      ) {
        errors.push(
          `implementation-review.md exposes comprehensionCheck.questions[${index}].${hiddenField}`,
        );
      }
    }
  }

  if (["FIX_REQUIRED", "BLOCK"].includes(data.verdict)) {
    for (const text of REQUIRED_REPAIR_TEXT) {
      if (!report.includes(text)) errors.push(`implementation-review.md missing: ${text}`);
    }
    const findingSections = report.match(/^### F\d+\.\s+/gm) ?? [];
    if (findingSections.length < data.findings.length) {
      errors.push(
        `implementation-review.md has ${findingSections.length} finding sections for ${data.findings.length} findings`,
      );
    }
  }
}

function main() {
  const artifactDirArg = process.argv[2];
  if (!artifactDirArg || process.argv.length !== 3) usage();

  const artifactDir = path.resolve(artifactDirArg);
  const findingsPath = path.join(artifactDir, "findings.json");
  const expectedReport = path.join(artifactDir, "implementation-review.md");
  const errors = [];

  if (!existsSync(findingsPath)) errors.push("missing findings.json");
  if (!existsSync(expectedReport)) errors.push("missing implementation-review.md");
  if (errors.length) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exit(1);
  }

  const data = readJson(findingsPath, errors);
  if (data) {
    if (typeof data.language !== "string" || !data.language.trim()) {
      errors.push("findings.json language must be a non-empty string");
    }
    if (!ALLOWED_MODES.has(data.reviewMode)) {
      errors.push("findings.json reviewMode must be standard or full");
    }
    validateAtAGlance(data.atAGlance, errors);
    validateVisualization(data.visualization, errors);
    if (typeof data.adr !== "string" || !data.adr.trim()) errors.push("findings.json missing adr");
    if (!ALLOWED_VERDICTS.has(data.verdict)) {
      errors.push(`findings.json verdict is invalid: ${data.verdict ?? "(missing)"}`);
    }
    validateScopes(data, errors);

    if (!Array.isArray(data.findings)) {
      errors.push("findings.json findings must be an array");
    } else {
      data.findings.forEach((finding, index) => validateFinding(finding, index, errors));
      validateMetrics(data.metrics, data.findings, errors);
      if (
        data.reviewMode === "standard" &&
        Number.isInteger(data.metrics?.necessityFindingCount) &&
        data.metrics.necessityFindingCount !== 0
      ) {
        errors.push("standard review metrics.necessityFindingCount must be 0");
      }
      if (
        data.reviewMode === "standard" &&
        data.findings.some((finding) => ["necessity", "both"].includes(finding?.perspective))
      ) {
        errors.push("standard review findings must use the sufficiency perspective");
      }
    }

    if (!Array.isArray(data.implementationChoices)) {
      errors.push("findings.json implementationChoices must be an array");
    } else {
      data.implementationChoices.forEach((choice, index) =>
        validateImplementationChoice(choice, index, errors),
      );
    }

    validateComprehensionCheck(data.comprehensionCheck, errors);

    if (!Array.isArray(data.contractCoverage) || data.contractCoverage.length === 0) {
      errors.push("findings.json contractCoverage must be a non-empty array");
    } else {
      data.contractCoverage.forEach((row, index) => validateContractCoverage(row, index, errors));
      validateContractCompleteness(
        data.contractCoverage,
        expectedContractRows(artifactDir, data.adr, errors),
        errors,
      );
      validateFindingContractLinks(data.findings ?? [], data.contractCoverage, errors);
      validatePass(data, errors);
    }

    const reportPath = resolveArtifact(artifactDir, data.report);
    if (!reportPath || path.resolve(reportPath) !== path.resolve(expectedReport)) {
      errors.push("findings.json report must point to implementation-review.md");
    }
    const explanationPath = resolveArtifact(artifactDir, data.explanation);
    if (!explanationPath || !existsSync(explanationPath)) {
      errors.push("review explanation must point to an existing file");
    } else {
      validateExplanation(readFileSync(explanationPath, "utf8"), errors);
    }

    if (existsSync(expectedReport)) {
      validateReport(readFileSync(expectedReport, "utf8"), data, errors);
    }
  }

  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exit(1);
  }

  process.stdout.write("ADR implementation review artifacts are valid\n");
}

main();
