// When a Lite ALPS reports completion, the author asks once whether to run the
// optional deep-research review, starts no research on the invitation alone,
// and does not let an unwritten optional Section 7 block either completion or
// the invitation.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/support.lite.alps.xml

방금 Section 8 Demo Scenario를 승인받아 저장했고 alps_export(doc_path)도 끝났다.
alps_document(action: 'status', doc_path) 결과:
- Sections 1-6, 8: ✅ Written
- Section 7 Out of Scope: not written (optional)
- Completion: ✅ Complete

이 대화에서 사용자는 근거 검토에 대해 아무 말도 하지 않았다.
정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export const obligations = [
  {
    id: "invites-once",
    text: "The reply reports the Lite document as complete and asks exactly once whether the user wants the optional deep-research review of its evidence and errors.",
  },
  {
    id: "no-research-started",
    text: "The reply starts no research, claims no findings and calls no research tool; the review waits for the user's answer, and declining it is said or implied to leave the document complete.",
  },
  {
    id: "optional-section",
    text: "The unwritten optional Section 7 is not presented as blocking completion or the invitation, and the reply does not demand that Section 7 be written.",
  },
  {
    id: "derived-full-once",
    text: "The reply mentions once that a completed Lite can be the source of a derived Full ALPS when implementation preparation is needed, without presenting Lite completion as implementation readiness or ADR handoff.",
  },
];

export default {
  name: "alps-research-offers-once-after-lite-completion",
  description:
    "On Lite completion the author asks once about the optional deep-research review, starts no research on the invitation alone, and does not let unwritten optional Section 7 block completion or the invitation. It also checks the lite-format rule that a completed Lite is offered once as a derived-Full source, not as implementation readiness.",
  bugReport:
    "Lite 작성을 끝내자마자 묻지도 않고 근거 조사를 시작했고, 선택 Section 7 때문에 완료가 아니라고 했다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
