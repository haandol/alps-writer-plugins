// When a Full ALPS document completes, the author asks once about the optional
// deep-research review and starts no research on the invitation alone.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/booking.alps.xml (Full ALPS)

방금 Section 9 Out of Scope를 승인받아 저장했고 alps_export(doc_path)도 끝났다.
alps_document(action: 'status', doc_path) 결과: Sections 1-9 모두 ✅ Written, Completion: ✅ Complete.
Section 7 뒤의 /feature-to-adr 인계 질문에는 사용자가 이미 "나중에"라고 답했다.
이 대화에서 사용자는 근거 검토에 대해 아무 말도 하지 않았다.
정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export const obligations = [
  {
    id: "invites-once",
    text: "The reply reports the Full document as complete and asks exactly once whether the user wants the optional deep-research review of its evidence and errors.",
  },
  {
    id: "no-research-started",
    text: "The reply starts no research and claims no findings; declining or deferring is said or implied to leave the document complete.",
  },
  {
    id: "no-repeat-handoff",
    text: "The reply does not ask the /feature-to-adr handoff question again, since the user already answered it.",
  },
];

export default {
  name: "alps-research-offers-once-after-full-completion",
  description:
    "On Full completion the author asks once about the optional deep-research review and starts no research on the invitation alone. It also checks the alps-init rule that the answered /feature-to-adr handoff question is not asked again.",
  bugReport: "Full 작성을 끝냈는데 근거 검토 안내가 없었다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
