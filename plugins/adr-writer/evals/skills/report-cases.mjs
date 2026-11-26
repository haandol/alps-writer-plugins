import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { drilldownCases } from "./report-drilldown-cases.mjs";
import { abstractionCases } from "./report-abstraction-cases.mjs";
import { overviewCases } from "./report-overview-cases.mjs";
import { reportPathCases } from "./report-path-cases.mjs";
import { reportRegressionCases } from "./report-regression-cases.mjs";

const REFERENCE_DIR = "skills/report-writer/references";
/** SKILL.md's common writing/review modules; every inline report probe writes or reviews prose. */
const COMMON_REFERENCES = ["explanation-design", "editorial-review", "format-and-layout"];
/** Stable prompt order, so dropping a module never reorders the ones a case keeps. */
const REFERENCE_ORDER = [
  "explanation-design",
  "editorial-review",
  "writing-style",
  "abstraction-and-analogy",
  "diagrams",
  "quantitative-claims",
  "format-and-layout",
  "html-layout",
  "review-results",
];

/** Resolve a case's declared content modules to the reference paths its prompt inlines. */
export function reportReferences(declared) {
  // Every case names the modules its obligations use, so none silently loads them all.
  if (!Array.isArray(declared)) throw new Error("A report case must declare its references");
  const unknown = declared.filter((name) => !REFERENCE_ORDER.includes(name));
  if (unknown.length) throw new Error(`Unknown report-writer reference: ${unknown.join(", ")}`);
  const wanted = new Set([...COMMON_REFERENCES, ...declared]);
  return REFERENCE_ORDER.filter((name) => wanted.has(name)).map(
    (name) => `${REFERENCE_DIR}/${name}.md`,
  );
}

const source = `Recorded evaluation evidence:
10 requested runs: 6 successful tasks, 2 failed tasks, 2 provider errors.
All 8 completed tasks used a local fixture. No deployed system was inspected.
Total provider-reported cost: USD 0.48. There was no without-skill comparison.
These are supplied fixture facts, not results of this evaluation run.`;

/** Paired writing/review probes keep numerical and evidence claims independently judgeable. */
// Each `references` lists only the content modules its obligations use; the builder adds the common ones.
export const reportCases = [
  {
    id: "report-preserves-evaluation-evidence",
    title: "보고서가 원본 수치와 검증 한계를 보존",
    // counts: the 6/8 = 75% denominator and USD 0.48 cost are quantitative claims.
    references: ["quantitative-claims"],
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
    // Review-only findings on false rates, zero cost and an unsupported +25%p lift.
    references: ["quantitative-claims", "review-results"],
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
  {
    id: "report-slop-rewrites-obscured-meaning",
    title: "퇴고가 행위자·지시 대상·결과를 드러내고 빈 문장을 걷어냄",
    // Slop rewrite owns writing-style; emphasis/evidence keep the 3/3 local-scope claim.
    references: ["writing-style", "quantitative-claims"],
    source: [
      "Fixture A: After a gateway timeout, the scheduler retries the request once. The gateway can still reject the retry.",
      "Fixture B: The worker checks that the invoice exists before publishing its payment event. If the invoice is missing, the worker publishes nothing and records the error.",
      "Fixture C: All three local duplicate-payment tests returned the original receipt. Production was not checked.",
    ].join("\n"),
    task: [
      "Rewrite these three Korean report excerpts in chat, each against its fixture, without tools or a quiz:",
      'A: "게이트웨이 시간 초과 후 요청 재시도의 수행이 이루어진다. 재시도 요청에 대한 거부 가능성이 존재한다."',
      'B: "이것의 선행 존재성 검사 경계가 이벤트 발행 흐름에 위치한다. 없으면 이를 남긴다."',
      'C (the opening answer of a report): "검증 결과의 의미를 먼저 짚어 볼 필요가 있다. 이번 결과는 중요한 시사점을 준다. 운영 환경에 대해서는 별도로 고려해야 할 부분이 있다. 로컬 세 건에서는 모두 기존 영수증을 반환했다."',
    ].join("\n"),
    semanticObligations: [
      {
        id: "actors",
        text: "Rewrite A names the scheduler as the retrying actor and the gateway as the possible rejecting actor, using direct verbs instead of action nouns.",
      },
      {
        id: "conditions",
        text: "Rewrite A preserves the timeout trigger, exactly one retry, and the possibility of rejection without claiming rejection was observed.",
      },
      {
        id: "referents",
        text: "Rewrite B identifies the invoice, payment event, and error explicitly and describes how the worker handles them without ambiguous pronouns or invented compound labels.",
      },
      {
        id: "order",
        text: "In rewrite B the invoice check precedes publication, and a missing invoice suppresses publication and causes the worker to record the error.",
      },
      {
        id: "emphasis",
        text: "Rewrite C opens with the observed result and its 3/3 local scope, with the production verification limit immediately after it; empty lead-ins and judgments are removed.",
      },
      {
        id: "evidence",
        text: "Rewrite C preserves which receipt was returned and does not infer production behavior, guaranteed duplicate prevention, or wider coverage.",
      },
    ],
  },
  ...drilldownCases,
  ...abstractionCases,
  ...overviewCases,
  ...reportPathCases,
  ...reportRegressionCases,
].map(({ task, source: caseSource = source, references: declared, ...item }) => {
  const references = reportReferences(declared);
  return {
    ...item,
    name: item.id,
    description: item.title,
    type: "classification",
    skill: "report-writer",
    group: "report",
    supplementalChecks: false,
    references,
    build() {
      return [
        skillText("report-writer", { references }),
        "# This run",
        caseSource,
        task,
        TAIL_SPEC,
      ].join("\n\n");
    },
  };
});
