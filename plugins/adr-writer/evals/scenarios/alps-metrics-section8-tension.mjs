import { alpsSkillText, alpsGuideText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "carry-pair",
    text: "Section 8 carries KPI-1 together with its adopted no-show tension: 8.1 gives each a collection method and links the tension to the KPI it protects, so a completion-rate gain is compared with the no-show rate before it counts as an improvement.",
  },
  {
    id: "monitoring-no-target",
    text: "The adopted no-show tension stays monitoring-only: 8.2 gives it no target or threshold and its worsening is not an automatic failure. KPI-1's 70% target, KPI-2's 40% target and NF1's 2-second p95 threshold are carried unchanged.",
  },
  {
    id: "propose-for-uncovered",
    text: "Without being asked, the reply names a concrete abuse, shortcut or opposite-failure scenario that would raise KPI-2 while defeating the hypothesis, for example reminders or discounts that bring members back without real use, and proposes a same-purpose tension candidate with how it would be measured, or explains how an existing metric already guards it. No target is invented for the candidate.",
  },
  {
    id: "user-decides",
    text: "The KPI-2 candidate is a proposal the user may accept, revise or decline. Its adoption is not a condition for approving or saving Section 8, and the reply neither demands an omission reason nor starts a separate metrics interview.",
  },
  {
    id: "bounded",
    text: "Answer in Korean, show the Section 8 draft for approval rather than claiming it was saved, and do not invoke tools in this response-only task.",
  },
];

export default {
  name: "alps-metrics-section8-tension",
  description:
    "Full ALPS Section 8 carries each adopted Section 2 tension with its KPI as monitoring-only and proposes a scenario-backed tension candidate for a KPI that has none, leaving adoption to the user.",
  obligations,
  build() {
    return [
      alpsSkillText("alps-init", { references: ["references/outcome-evaluation.md"] }),
      alpsGuideText(8),
      `# This run
Draft Section 8 of a Full ALPS document for approval; do not invoke tools or save anything.
The referenced Sections were read and are approved:

Section 2 (MVP Goals and Key Metrics)
- 2.1 가설: 스터디 카페 회원이 앱으로 좌석을 쉽게 예약하면 빈 좌석이 줄고 회원이 계속 이용한다.
- KPI-1 좌석 예약 완료율: 좌석 배치도를 연 세션 중 예약을 확정한 세션의 비율, 목표 70% 이상.
  - 채택한 tension (관찰용, 목표값 없음): 예약 후 노쇼율. 예약을 너무 쉽게 만들어 완료율만 올리면 오지 않는 예약이 늘어난다.
- KPI-2 주간 재방문 회원 비율: 지난주 이용한 회원 중 이번 주 다시 예약한 회원의 비율, 목표 40% 이상.
  - 이 KPI는 이전 기획서에서 그대로 옮겨 왔고, tension 후보를 제안하거나 거절한 기록이 없다.

Section 5.2 (Non-Functional Requirements)
- NF1 예약 확정 응답 2초 이내 (p95, 피크 시간대).

The user writes: "Section 8 초안을 보여 주세요."`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
