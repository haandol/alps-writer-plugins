import { alpsSkillText, alpsGuideText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

export const deterministicScore = (input) => responseChecks(input, {});

export const obligations = [
  {
    id: "every-kpi",
    text: "Without being asked, propose a tension candidate for each of the three supplied KPIs. Each candidate protects the same purpose and names the concrete abuse, shortcut or opposite-failure scenario that would raise that KPI while defeating the hypothesis, for example closing or deflecting conversations without solving them, answering fast but wrongly, or users returning because their problem was not solved. Another KPI may serve as a tension when the response explains that link. A response that omits a candidate for any KPI fails.",
  },
  {
    id: "preserve-kpis",
    text: "Keep the three supplied KPIs and their targets exactly. Do not invent a numeric target for a tension candidate or turn it into a required success condition; present it as monitoring-only unless the user confirms otherwise.",
  },
  {
    id: "user-decides",
    text: "Present the candidates as proposals the user may accept, revise or decline. Do not make their adoption a completion condition, demand an omission rationale, start a separate metrics interview, or add an unrelated metric to fill a slot.",
  },
  {
    id: "bounded",
    text: "Answer in Korean, show the Section 2 draft for approval rather than claiming it was saved, and do not invoke tools in this response-only task.",
  },
];

export default {
  name: "alps-evaluates-outcomes-kpi-tension",
  description:
    "Full ALPS Section 2 always proposes a scenario-backed tension candidate for every user-supplied KPI, leaving adoption to the user.",
  obligations,
  deterministicScore,
  build() {
    return [
      alpsSkillText("alps-init", { references: ["references/outcome-evaluation.md"] }),
      alpsGuideText(2),
      `# This run
Draft Section 2 of a Full ALPS document for approval; do not invoke tools or save anything.
Section 1 is approved: a customer-support chatbot for an online furniture store should reduce the load on human agents while customers still get their problems solved.
The user writes: "가설은 챗봇이 상담원 부담을 줄인다는 거예요. KPI는 챗봇 자체 해결률 60% 이상, 평균 첫 응답 시간 3초 이하, 첫 주 재방문율 40% 이상으로 할게요."
The user mentions nothing else about metrics.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
