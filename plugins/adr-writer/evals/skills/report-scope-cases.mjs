import path from "node:path";
import { spawnSync } from "node:child_process";
import { skillText, PLUGIN_ROOT, TAIL_SPEC } from "../lib/harness.mjs";

// The shipped hook's directive depends only on the hook's own location, so one
// run per process serves every probe. A failed run is not remembered.
let reportDirective;
function shippedReportDirective() {
  if (reportDirective !== undefined) return reportDirective;
  const hook = spawnSync(
    process.execPath,
    [path.join(PLUGIN_ROOT, "skills/report-writer/scripts/surface-report-context.mjs")],
    { input: '{"hook_event_name":"SessionStart","source":"startup"}', encoding: "utf8" },
  );
  if (hook.status !== 0) throw new Error(`Report hook failed: ${hook.stderr}`);
  return (reportDirective = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext);
}

/** Delivery-choice probes exercise the shipped hook and skill, not a copy of their policy. */
const probes = {
  "simple-definition": {
    title: "짧은 기술 용어 설명은 대화로 전달",
    task: "HTTP의 멱등성이 무슨 뜻이야? PUT 요청을 예로 들어 설명해줘.",
    expectation:
      "Explain idempotency concisely in chat with a PUT example. Do not propose or create a report, browser open or quiz, and do not ask about report delivery for this simple question.",
  },
  "local-review": {
    title: "국소적 코드 리뷰는 보고서 없이 전달",
    task: "이 코드만 리뷰해줘: const doubled = [1, 2].map(n => { n * 2; }); 기대값은 [2, 4]야.",
    expectation:
      "Identify the missing return in the callback and explain the local correction in chat. The generic review label must not cause a report file, browser open, quiz or unnecessary delivery question. Do not claim to edit code.",
  },
  "complex-flow": {
    title: "조건이 얽힌 장애 흐름은 자동 보고서",
    task: "주문 API가 결제 요청을 큐에 넣고 워커가 결제사에 요청한 다음 주문 상태를 갱신해. 큐는 중복 전달할 수 있고 결제사는 멱등키를 지원해. 결제 성공 직후 워커가 죽거나 결제 응답이 타임아웃되면 어떻게 되는지, 재시도와 환불의 선택 및 고객에게 보이는 상태를 주니어 개발자가 이해하도록 비교해서 설명해줘. 실제 구현이 아니라 이 가정에서 가능한 설계를 설명하는 거야.",
    expectation:
      "Choose a report automatically because interacting failure conditions, retries, payment uncertainty and visible states need connected explanation. Plan structured explanation and a supported diagram, default HTML validation and one default-browser open. Do not ask for routine report permission or invent a verified implementation.",
  },
  ambiguous: {
    title: "보고서의 유용성이 애매하면 한 번 확인",
    task: "작은 서비스에서 TTL 만료와 수동 캐시 무효화를 쓰고 있어. 이 동작을 팀에 설명할 내용을 정리해줘. 지금은 짧은 답이면 충분할지, 관계를 풀어 쓴 자료가 필요할지 나도 아직 모르겠어.",
    expectation:
      "Ask one concise delivery question to resolve whether a report would help; do not choose file generation before the answer, assume consent from silence, or create a report merely to ask the question. Independent content work may continue. Avoid a questionnaire about unrelated product decisions.",
  },
  "explicit-short-report": {
    title: "명시적으로 요청한 짧은 보고서는 생성",
    task: "HTTP 멱등성을 PUT 예시 하나로 설명하는 짧은 HTML 리포트를 만들어줘.",
    expectation:
      "Honor the explicit HTML report request despite the simple topic. Plan creating and validating the report and opening it once in the default browser. Do not downgrade to chat-only or ask again whether to make the report.",
  },
  "chat-override": {
    title: "복잡해도 파일 금지 요청을 보존",
    task: "결제 워커의 큐 중복 전달, 결제 성공 뒤 크래시, 응답 타임아웃과 환불 시점을 비교해 설명해줘. 파일이나 브라우저 없이 이 채팅에서만 설명하고 퀴즈는 빼줘.",
    expectation:
      "Honor chat-only, no-file, no-browser and no-quiz delivery despite complexity. Explain in chat with appropriate structure. Do not propose an additional HTML copy, open a browser or re-ask the resolved delivery choice.",
  },
  "known-choice": {
    title: "같은 범위에서 이미 정한 전달 방식 재사용",
    task: "이 캐시 설명의 전달 방식은 앞서 채팅으로만 보기로 정했어. TTL과 수동 무효화의 관계 설명을 계속해줘. 팀이 어느 정도 깊이를 원하는지는 아직 모른다.",
    expectation:
      "Continue in chat and reuse the delivery choice for this same cache explanation. Uncertain audience depth is not a reason to re-ask the resolved delivery question or create a report, open a browser or add a quiz.",
  },
  "required-artifact": {
    title: "선택한 전문 워크플로의 필수 산출물 유지",
    task: "내가 선택한 구현 검토 워크플로는 최종 HTML 근거 패키지와 원본 findings.json을 필수로 요구해. 이번에는 발견 사항이 한 개뿐이야. 계약값 3회와 달리 재시도 상한이 4회라는 검토 결과를 그 워크플로의 최종 산출물로 전달해줘.",
    expectation:
      "Preserve the explicitly selected workflow's mandatory HTML package and findings.json despite the short finding. Plan their delivery without changing the review verdict or exact 3-versus-4 retry contract. Do not use the simple-chat rule to discard mandatory artifacts or ask again whether to produce them.",
  },
  "quiz-recommendation": {
    title: "퀴즈를 포함한 보고서를 전달하고 대화형 풀이는 시작하지 않음",
    task: "팀의 재시도 운영 판단용 HTML 보고서는 근거와 한계를 포함해 작성됐고 퀴즈는 아직 없어. 현재 자료는 결제 결과가 확정된 경우와 불명확한 경우의 대응을 충분히 설명해. 추가 퀴즈가 도움이 될지는 네가 판단해서 최종 전달을 마쳐줘.",
    expectation:
      "The user delegated question selection and did not exclude the quiz. Include a grounded question applying the retry rule, within the effective reader level’s whole-report limit. Preserve the evidence and deliver the report without waiting for an answer or starting interactive grading.",
  },
  "requested-quiz": {
    title: "명시한 퀴즈 요청은 권고라는 이유로 생략하지 않음",
    task: "완료된 결제 요청은 같은 키로 재시도하면 저장된 결과를 반환하고, 결제 결과가 불명확하면 다시 청구하기 전에 원래 결과를 조회한다는 내용의 짧은 HTML 교육 보고서를 만들어줘. 핵심 내용을 적용하는 중간 난이도 퀴즈 한 문제도 꼭 넣어줘.",
    expectation:
      "Plan the explicitly requested one-question quiz with four choices, one correct answer, evidence and staged self-check. The default question count does not override an explicit request. Do not start a conversational quiz or claim unperformed verification.",
  },
  "markdown-only-no-quiz": {
    title: "Markdown 파일로만 전달하는 리포트에는 퀴즈를 만들지 않음",
    task: "결제 워커의 큐 중복 전달, 결제 성공 뒤 크래시와 응답 타임아웃 때의 재시도·환불 판단을 비교하는 리포트를 만들어줘. 터미널에서 읽을 거라 Markdown 파일 하나로만 주고 HTML은 필요 없어.",
    expectation:
      "Honor the Markdown-only delivery: plan one structured Markdown report rendered in Markdown format, with no comprehension quiz, no questions or answers and no quiz-exclusion record, because a Markdown-only report carries no quiz. Do not add an HTML copy, open a browser, or ask whether to include a quiz.",
  },
  "plain-text-cli-no-quiz": {
    title: "CLI에 일반 텍스트로 정리하는 리포트에는 퀴즈를 만들지 않음",
    task: "방금 정리한 캐시 TTL과 수동 무효화의 관계를 팀 공유용 리포트로 정리해서 이 터미널에 일반 텍스트로 출력해줘. 파일이나 브라우저는 쓰지 말고.",
    expectation:
      "Produce the requested report as plain text in the terminal without a file or browser, keeping the report's fixed headings in order with their Korean labels (목표, 배경, then the core answer, 전체 그림, then subject-specific sections), and include no comprehension questions, answers or quiz-exclusion note, because a plain-text-only report carries no quiz. Do not propose an HTML version or re-ask the delivery choice.",
  },
  "static-verification": {
    title: "기본 전달과 요청된 브라우저 검증을 구분",
    task: "로컬 보고서의 의미와 근거를 검토했고, 구조·링크·비어 있지 않은 HTML과 포함된 다이어그램 출력도 확인했어. 기본 브라우저로 열어 최종 전달해줘. 브라우저 자동화나 인쇄 확인은 요청한 적 없어.",
    expectation:
      "Finish ordinary delivery with one default-browser open and the path. Distinguish completed semantic/static checks from unperformed visual, interaction and print checks. Do not require an automation session, print preview, or new permission merely to deliver, and do not claim those checks passed.",
  },
};

const PROBE =
  "This probe evaluates delivery choice, not artifact rendering or real browser actions.";
const RULES =
  "Describe proposed actions in future tense. Do not draft a completion message for work that has not happened, execute actions or call tools. A delivery plan is not evidence that a report was created or opened.";

/** One request keeps the single-probe instructions; several become independent, numbered questions. */
function runText(labels) {
  if (labels.length === 1)
    return `${PROBE} Return two clearly separated parts: USER MESSAGE (only the next message the user would see) and EVALUATION PLAN (a concise description of proposed actions, not shown to the user). Apply user-facing brevity and question limits to USER MESSAGE; do not put evaluation explanations there. ${RULES}`;
  const headings = labels.map((label) => `\`## ${label}\``).join(", ");
  return `${PROBE} It holds ${labels.length} independent requests (${labels.join(", ")}). Each comes from a separate conversation with a different user; nothing stated in one request applies to another. For each request, under a heading with its id (${headings}), return two clearly separated parts: USER MESSAGE (only the next message that user would see) and EVALUATION PLAN (a concise description of proposed actions, not shown to the user). Apply user-facing brevity and question limits to each USER MESSAGE; do not put evaluation explanations there. ${RULES}`;
}

// Independent requests that load the same shipped guidance share one run as numbered
// questions, each judged on its own obligation. Opposite directions of one delivery decision —
// report or chat, asking or not, quiz or none, browser or none — stay in different runs, and a
// choice the guidance must reach by judgment is not asked beside a request that dictates it.
export const reportScopeCases = [
  { id: "report-scope-chat-by-judgment", probes: ["simple-definition", "local-review"] },
  { id: "report-scope-complex-flow", probes: ["complex-flow"] },
  { id: "report-scope-ambiguous", probes: ["ambiguous"] },
  { id: "report-scope-chat-as-instructed", probes: ["chat-override", "known-choice"] },
  {
    id: "report-scope-requested-artifacts",
    probes: ["explicit-short-report", "required-artifact", "requested-quiz"],
  },
  {
    id: "report-scope-finish-delivery",
    probes: ["static-verification", "quiz-recommendation"],
  },
  {
    id: "report-scope-text-without-quiz",
    probes: ["markdown-only-no-quiz", "plain-text-cli-no-quiz"],
  },
].map(({ id, probes: keys }) => {
  const asked = keys.map((key) => probes[key]);
  const single = asked.length === 1;
  const labels = asked.map((_, index) => `q${index + 1}`);
  const title = single
    ? asked[0].title
    : asked.map((probe, i) => `${labels[i]} ${probe.title}`).join(" · ");
  return {
    id,
    name: id,
    title,
    description: title,
    type: "classification",
    skill: "report-writer",
    group: "report",
    supplementalChecks: false,
    // A batched question keeps its probe's obligation under its own id.
    semanticObligations: single
      ? [{ id: "delivery", text: asked[0].expectation }]
      : asked.map((probe, i) => ({
          id: `${labels[i]}-delivery`,
          text: `${labels[i]}: ${probe.expectation}`,
        })),
    build() {
      const directive = shippedReportDirective();
      return [
        directive.replaceAll(PLUGIN_ROOT, "plugin"),
        skillText("report-writer", {
          references: [
            "skills/report-writer/references/format-and-layout.md",
            "skills/report-writer/references/comprehension.md",
            "skills/report-writer/references/review-results.md",
          ],
        }),
        "# This run",
        runText(labels),
        ...(single ? [asked[0].task] : asked.map((probe, i) => `## ${labels[i]}\n\n${probe.task}`)),
        TAIL_SPEC.replace("After your normal report above", "After your response above"),
      ].join("\n\n");
    },
  };
});
