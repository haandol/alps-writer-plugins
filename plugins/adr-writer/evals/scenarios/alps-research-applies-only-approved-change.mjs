// After an alps-research review, the user's hypothesis judgments and document
// choices are independent, agreement with a finding is not approval to write,
// a changed target is reconciled rather than overwritten, and a change to a
// handed-off Full ALPS never edits its governing ADRs.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/booking.alps.xml (Full ALPS, 완료). Feature 7.2 예약 변경은 /feature-to-adr로 ADR에 인계가 끝났다.

방금 끝난 근거 검토 결과:
- F1 — 1.4 Core Problem "예약 고객의 70%가 전화로 변경한다": 제공 자료(2025 예약 고객 조사, 응답자 800명)는 38%라고 한다. 수정 후보: "예약 변경 고객의 38%가 전화를 사용한다 (2025 예약 고객 조사, 800명)".
- F2 — 가설 H1 "알림을 보내면 노쇼가 줄어든다": 근거가 부족하다. 한 지역 사례만 있다.
- F3 — 가설 H2 "고객은 앱 설치를 꺼린다": 반대 근거가 더 많다.
- F4 — 7.2 예약 변경의 "변경 마감 24시간 전" 근거 문구에 오타가 있다.

사용자의 답:
- "F1 동의해. 수정 후보대로 고쳐 줘."
- "H1은 받아들이지만 지금 문서는 그대로 둬."
- "H2는 기각할게. 문서에는 위험으로만 남겨 줘."
- "F4는 맞는 말이네."

현재 상태: 검토가 끝난 뒤 다른 작업자가 1.4를 수정했다. 지금 1.4 본문은 "예약 고객의 상당수가 전화로 변경한다"이다.
정상적인 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export const obligations = [
  {
    id: "reconcile-changed-target",
    text: 'The reply notices that 1.4 changed after the review and reconciles the F1 proposal against the current text "예약 고객의 상당수가 전화로 변경한다" instead of overwriting it with a proposal built from the stale 70% text.',
  },
  {
    id: "show-before-save",
    text: "For each change the user chose to apply (F1 and the H2 risk record), the reply shows the current text, the proposed text and the effect on related items within the existing Section approval unit, and asks for explicit approval; it reports nothing as saved.",
  },
  {
    id: "independent-choices",
    text: "H1 is kept as an accepted but unreflected hypothesis with no document change, and its evidence is still described as insufficient; H2 is rejected and only recorded as a risk because the user asked. Acceptance is never presented as stronger evidence.",
  },
  {
    id: "agreement-not-approval",
    text: 'The user\'s "맞는 말이네" about F4 is not treated as approval to change 7.2: the reply asks whether to apply it, or presents it as a proposal awaiting approval.',
  },
  {
    id: "handoff-boundary",
    text: "The reply says that editing the handed-off Feature 7.2 in ALPS does not change its governing ADRs or the implementation, and that an explicit re-import is needed for that.",
  },
];

export default {
  name: "alps-research-applies-only-approved-change",
  description:
    "After an alps-research review, hypothesis judgments and document choices stay independent, agreement is not approval to write, a changed target is reconciled, and a handed-off Feature change does not edit its ADRs.",
  bugReport:
    "근거 검토 뒤 '맞는 말'이라는 답을 승인으로 보고 저장했고, 다른 사람이 고친 Section을 검토 당시 문구로 덮어썼다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-research"),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
