// After one of two approved research changes fails to save, the reply reports
// the saved and pending units separately and resumes without applying twice.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/booking.alps.xml (Full ALPS, 완료).

근거 검토 뒤 사용자는 두 변경을 승인했다:
- A: 1.4 Core Problem 문구 수정
- B: 2.2 KPI 표에 "노쇼 감소 가설은 근거 부족" 위험 문구 추가

당신은 두 저장을 시도했고 도구 결과는 다음과 같았다:
- alps_section(action: 'save', doc_path, section: 1, subsection_id: '1.4', ...) → 성공
- alps_section(action: 'save', doc_path, section: 2, subsection_id: '2.2', ...) → 오류: "write failed: subsection 2.2 changed on disk since it was read"

사용자: "어떻게 됐어? 나머지도 이어서 해 줘."
정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export const obligations = [
  {
    id: "reports-units",
    text: "The reply reports that A (1.4) was saved and B (2.2) was not saved, with the failure reason, and does not claim that all approved changes were applied.",
  },
  {
    id: "resumes-from-current",
    text: "To continue, the reply re-reads the current 2.2 before retrying and reconciles B against it if it changed, asking for confirmation when the approved wording no longer fits.",
  },
  {
    id: "no-double-apply",
    text: "The reply does not re-apply A, which is already saved.",
  },
];

export default {
  name: "alps-research-applies-partial-save",
  description:
    "After one of two approved research changes fails to save, the reply reports the saved and pending units separately, resumes from current content and does not apply the saved change twice.",
  bugReport:
    "두 변경 중 하나만 저장됐는데 모두 반영됐다고 했고, 이어서 할 때 이미 저장한 변경을 다시 적용했다.",

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
