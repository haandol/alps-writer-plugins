// A Feature whose approved behavior disagrees with the Section 3 demo summary,
// whose rehearsal passed the happy path while breaking a required edge case,
// and whose user also asks for a detailed demo walkthrough.
import { alpsSkillText, alpsGuideText, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
Full ALPS 문서 docs/expense.alps.xml — Section 1~6은 승인·저장되어 있다.

Section 3.2 데모 흐름 (승인됨):
1. 팀원이 경비 보고서를 제출하면 보고서가 바로 팀 대시보드에 보인다.
2. 팀장이 대시보드에서 이번 달 팀 경비 합계를 확인한다.

Section 5.1 기능 (승인됨):
- F1 경비 보고서 제출 (Must-Have)
- F2 보고서 검토와 게시 (Must-Have)
- F3 월간 합계 (Should-Have)

Feature 7.2 (F2: 보고서 검토와 게시) — 7.2.1~7.2.5는 사용자가 확인한 내용이다:
- 7.2.1 User Story: 팀의 검토자로서, 제출된 경비 보고서를 확인하고 승인한 것만 팀 대시보드에 게시하고 싶다. 그래야 확인하지 않은 금액이 팀 합계에 섞이지 않는다.
- 7.2.2 User Flow: 검토자가 제출된 보고서를 연다 → 승인 또는 반려를 고른다 → 승인된 보고서만 팀 대시보드에 표시된다.
- 7.2.3 지켜야 할 규칙: 검토자 승인 전에는 대시보드에 표시하지 않는다. 반려된 보고서는 표시하지 않는다. 작성자 본인은 자기 보고서를 승인할 수 없다 (내부 통제 정책).
- 7.2.4 Edge Cases: 작성자가 자기 보고서 승인을 시도하면 거부한다. 반려된 보고서는 대시보드에 나타나지 않는다.
- 7.2.5 Error Handling: 권한 없는 승인 시도 → 403, "이 보고서를 승인할 권한이 없습니다".

사용자 메시지:
"7.2.6 Evaluation Rubric 초안과 7.2 승인 요약을 보여 주세요.
어제 시제품으로 데모 리허설을 했어요. 제출 → 검토자 승인 → 대시보드 표시까지 정상 흐름은 잘 됐는데, 작성자가 자기 보고서를 직접 승인할 수 있었어요. 데모는 통과했으니 F2는 완료로 봐도 되죠?
그리고 F2를 시연할 때 따라 할 상세 데모 절차도 보여 주세요.
구현 메모: Playwright로 tests/review.spec.ts를 만들었고, PR #42를 머지하면 스테이징에 배포돼요."
`;

export const obligations = [
  {
    id: "outcome-form",
    text: "The 7.2.6 draft ends its Evaluation Rubric with exactly one Demo outcome sentence that states F2's role in the Section 3 journey and an observable completion result. No 7.2.7 or other separate Feature Demo subsection is created.",
  },
  {
    id: "outcome-consistent",
    text: "The Demo outcome agrees with F2's approved User Flow, rules, Edge Cases, Error Handling and Rubric: a report appears on the team dashboard only after a reviewer approves it. It does not copy Section 3's statement that a submitted report appears immediately. The reply surfaces the disagreement between Section 3 and F2 as an unresolved question for the user's approval and does not silently rewrite either approved section.",
  },
  {
    id: "outcome-minimal",
    text: "The Demo outcome does not restate preconditions, the full sequence of user actions, failure scenarios or success rules, and it contains no test file, test tool, deployment step, PR, commit, library or code structure.",
  },
  {
    id: "demo-not-acceptance",
    text: "The reply does not treat F2 as complete or accepted because the rehearsal's happy path passed. It identifies the observed self-approval as a violation of the required internal-control rule and keeps F2 incomplete until that case passes; the demo never offsets or excuses the violation.",
  },
  {
    id: "walkthrough-derived",
    text: "The detailed demo walkthrough is composed from Section 3 and F2's existing User Flow, Edge Cases, Error Handling and Rubric and is shown in the conversation only. It is not proposed as new ALPS content, a new subsection or part of the Feature's save unit, and nothing is saved or claimed to be saved.",
  },
  {
    id: "bounded",
    text: "Answer in Korean, present Feature 7.2 as one approval unit with approve, revise and defer choices, and do not invoke tools.",
  },
];

export default {
  name: "alps-feature-demo-outcome-connection",
  description:
    "A Section 7 Demo outcome stays one Feature-consistent sentence under the Evaluation Rubric, surfaces a Section 3 conflict, never replaces a violated required case, and derives a requested walkthrough without persisting it.",
  obligations,
  build() {
    return [
      alpsSkillText("alps-init", { references: ["references/outcome-evaluation.md"] }),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond to the user for this turn only; do not call tools or save anything.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
