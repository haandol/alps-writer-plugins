import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { drilldownCases } from "./report-drilldown-cases.mjs";
import { abstractionCases } from "./report-abstraction-cases.mjs";

const source = `Recorded evaluation evidence:
10 requested runs: 6 successful tasks, 2 failed tasks, 2 provider errors.
All 8 completed tasks used a local fixture. No deployed system was inspected.
Total provider-reported cost: USD 0.48. There was no without-skill comparison.
These are supplied fixture facts, not results of this evaluation run.`;

/** Paired writing/review probes keep numerical and evidence claims independently judgeable. */
export const reportCases = [
  {
    id: "report-preserves-evaluation-evidence",
    title: "보고서가 원본 수치와 검증 한계를 보존",
    task: "Write a short Korean report from the supplied evidence. Explain the task success rate with its denominator, errors, cost and verification limits. Do not write files or invoke tools. The user explicitly requests no quiz for this short report.",
    semanticObligations: [
      {
        id: "counts",
        text: "The visible report preserves 10 requested runs, 8 completed, 6 successes, 2 task failures and 2 provider errors. It explains 6/8 = 75% success among completed tasks without hiding the errors or calling that 75% of all requests.",
      },
      {
        id: "limits",
        text: "The report preserves the USD 0.48 cost and explains that only local fixtures were checked. It makes no deployed-system verification, without-skill improvement or statistical reliability claim.",
      },
      {
        id: "presentation",
        text: "The opening explains what was evaluated, the supported result and the limitation that affects the conclusion. The report is coherent Korean prose, does not include the user-excluded quiz, and does not invent facts.",
      },
    ],
  },
  {
    id: "report-rejects-unsupported-success",
    title: "보고서 검토가 오류를 숨긴 성공 주장을 발견",
    task: `Review only the following report against the evidence. Do not rewrite it or change files. Explain each material mismatch, its reader impact and a correction. The user explicitly requests no quiz.
Report under review: "모든 10회 요청이 성공해 성공률은 100%다. 운영 환경에서도 검증을 마쳤고 비용은 발생하지 않았다. 스킬을 쓰니 작업 성능이 25%p 개선됐다."`,
    semanticObligations: [
      {
        id: "counts",
        text: "The review identifies the false 10/10 success claim and the hidden task failures and provider errors. It proposes 6/8 = 75% among completed tasks, reporting 10 requested and 2 errors separately.",
      },
      {
        id: "unsupported",
        text: "The review identifies all three unsupported claims: deployed verification, zero cost despite USD 0.48, and +25 percentage-point improvement without any no-skill comparison. It explains their effect on the reader's conclusion using the supplied evidence.",
      },
      {
        id: "scope",
        text: "The response delivers review findings and correction suggestions without claiming to have rewritten or executed the report. No file mutation occurs, and the user-excluded quiz is omitted. Read-only evidence lookup is allowed by this review-only task.",
      },
    ],
  },
  ...drilldownCases,
  ...abstractionCases,
].map(({ task, source: caseSource = source, ...item }) => ({
  ...item,
  name: item.id,
  description: item.title,
  type: "classification",
  skill: "report-writer",
  group: "report",
  supplementalChecks: false,
  build() {
    return [
      skillText("report-writer", {
        references: [
          "skills/report-writer/references/editorial-review.md",
          "skills/report-writer/references/abstraction-and-analogy.md",
          "skills/report-writer/references/format-and-layout.md",
          "skills/report-writer/references/review-results.md",
        ],
      }),
      "# This run",
      caseSource,
      task,
      TAIL_SPEC,
    ].join("\n\n");
  },
}));
