#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { USER_DECISION_CATEGORIES } from "./adr-impl-review-categories.mjs";
import { renderHtml } from "../skills/report-writer/scripts/render-report.mjs";
import { hillNarrativeParagraphs, reviewCodeGroups } from "./adr-impl-review-prose.mjs";

/** Compose a local standard review directly; unsupported rich interactions retain their existing route. */
export function standardArticle(data, inputPath) {
  if (data.reviewMode !== "standard") throw new Error("Direct article requires standard mode");
  if (
    data.comprehensionCheck?.questions?.length ||
    data.diagramRequirements?.length ||
    data.findings?.some((finding) => USER_DECISION_CATEGORIES.has(finding.category))
  ) {
    throw new Error(
      "Use the rich report composition route for selected diagrams, quizzes or decision controls",
    );
  }
  const hills = data.reviewHike.hills;
  if (hills.length > 4)
    throw new Error("Use rich report composition to group more than four capabilities by domain");
  const ko = data.language.startsWith("ko");
  const input = path.resolve(inputPath);
  const ids = [];
  function evidence(id, label, value) {
    ids.push(id);
    return {
      id,
      label,
      source: input,
      excerpt: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    };
  }
  const context = Object.values(data.reviewHike.context).filter(
    (value) => typeof value === "string" && value.trim(),
  );
  const status = ko
    ? {
        PROVEN: "충족됨",
        VIOLATED: "수정 필요",
        UNVERIFIED: "검증 필요",
        CONTRADICTED: "근거 충돌",
      }
    : {};
  const behavior = hills.map((hill, index) => {
    const rows = hill.contractIds.map((id) =>
      data.contractCoverage.find((row) => row.contractId === id),
    );
    return {
      id: `flow-${index + 1}`,
      title: hill.title,
      domain: hill.title,
      scope: hill.claim,
      paragraphs: [
        ...hillNarrativeParagraphs(hill),
        ...rows.map(
          (row) =>
            `${row.requirement} — ${status[row.status] || row.status}. ${row.implementation} ${row.tests}`,
        ),
      ],
      evidence: [
        ...rows.map((row) => evidence(`contract-${row.contractId}`, row.requirement, row)),
        ...reviewCodeGroups(hill).flatMap((group, groupIndex) =>
          group.codeEvidence.map((code, codeIndex) =>
            evidence(
              `code-${index}-${groupIndex}-${codeIndex}`,
              code.location,
              `${code.content}\n\n${code.explanation}\n${code.tests}`,
            ),
          ),
        ),
      ],
    };
  });
  const findings = data.findings.map(
    (finding) => `${finding.summary}\n${finding.evidence}\n${finding.test}: ${finding.testResult}`,
  );
  const comparison = (data.relatedAdrComparisons || []).map(
    (item) => `${item.title}: ${item.similarity} ${item.difference} ${item.reviewImpact}`,
  );
  return {
    title: data.title || (ko ? "구현 검토" : "Implementation review"),
    language: ko ? "ko" : "en",
    purpose: [
      ko
        ? "검토한 구현이 계약을 지키는지, 어떤 증거가 있고 무엇이 남았는지 판단한다."
        : "Assess whether the reviewed implementation honors its contract, using the recorded evidence and remaining gaps.",
    ],
    background: context,
    summary: [
      `${data.verdict}. ${data.atAGlance.impact}`,
      `${data.atAGlance.action} ${data.atAGlance.risk}`,
    ],
    sections: [
      {
        id: "behavior",
        title: ko ? "동작과 검증" : "Behavior and verification",
        domain: "Implementation",
        scope: "Contract-grounded behavior",
        paragraphs: context.length ? [context[0]] : [],
        children: behavior,
      },
      {
        id: "findings",
        title: ko ? "발견 사항" : "Findings",
        domain: "Implementation",
        scope: "Findings and required action",
        paragraphs: findings.length ? findings : [ko ? "발견 사항 없음." : "No findings."],
        evidence: [
          evidence("findings", ko ? "발견 사항 원문" : "Original findings", data.findings),
        ],
      },
      {
        id: "limits",
        title: ko ? "범위와 근거" : "Scope and evidence",
        domain: "Review",
        scope: "Evidence boundaries",
        paragraphs: [data.atAGlance.risk, ...comparison],
        evidence: [evidence("native", ko ? "전체 검토 원본" : "Complete review source", data)],
      },
    ],
    requiredEvidenceIds: ids,
    review: {
      status: "reviewed",
      basis: ko
        ? "검토자가 제공한 판정과 계약별 근거를 검증된 원본에서 구성했다. 최종 문장·화면 확인은 호출자가 수행한다."
        : "Composed from the reviewer's validated verdict and contract evidence. The caller checks final prose and presentation.",
      limitations: data.atAGlance.risk,
    },
  };
}

function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error("Usage: adr-impl-review-article.mjs <findings.json> <report.html>");
  const source = path.resolve(input);
  const destination = path.resolve(output);
  if (path.basename(source) !== "findings.json")
    throw new Error("Input must be the validated findings.json");
  if (source === destination) throw new Error("Output must not overwrite findings.json");
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("./adr-impl-review-validate.mjs", import.meta.url)),
      path.dirname(source),
    ],
    { stdio: "pipe" },
  );
  const data = JSON.parse(readFileSync(source, "utf8"));
  writeFileSync(destination, renderHtml(standardArticle(data, source)));
  process.stdout.write(`wrote ${destination}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
