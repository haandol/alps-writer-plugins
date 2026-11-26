// After the user declined the completion invitation, a later change that keeps
// the document complete does not repeat the research question.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/support.lite.alps.xml (Lite ALPS)

조금 전 문서가 완료되었을 때 선택적 근거 검토를 안내했고, 사용자는 "근거 검토는 필요 없어."라고 답했다.
그 뒤 사용자가 Section 6의 KPI-1 이름만 "KPI-1 재문의율"로 바꿔 달라고 했고, 승인 digest를 보여 주고 승인을 받아 6.1을 저장했다. alps_export(doc_path)도 끝났다.
alps_document(action: 'status', doc_path) 결과: Completion: ✅ Complete.
정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export const obligations = [
  {
    id: "no-reinvite",
    text: "The reply does not ask again about the optional deep-research review, because the user already declined it in this conversation.",
  },
  {
    id: "reports-saved",
    text: "The reply reports that 6.1 was saved with the renamed KPI and that the document remains complete.",
  },
];

export default {
  name: "alps-research-offers-not-again-after-decline",
  description:
    "After the user declined the completion invitation, a later change that keeps the document complete does not repeat the research question.",
  bugReport: "근거 검토는 필요 없다고 했는데 수정할 때마다 다시 물었다.",

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
