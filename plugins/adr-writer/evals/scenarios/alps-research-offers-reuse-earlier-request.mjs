// An explicit research request made earlier in the conversation is reused at
// completion instead of asking for permission again.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/booking.alps.xml (Full ALPS)

이 대화를 시작할 때 사용자는 "다 쓰고 나면 근거 검토까지 해 줘."라고 요청했다.
방금 Section 9를 승인받아 저장했고 alps_export(doc_path)도 끝났다.
alps_document(action: 'status', doc_path) 결과: Sections 1-9 모두 ✅ Written, Completion: ✅ Complete.
정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export const obligations = [
  {
    id: "reuses-request",
    text: "The reply does not ask again whether to run the research review; it treats the user's earlier explicit request as the go-ahead.",
  },
  {
    id: "starts-review",
    text: "The reply proceeds into the alps-research review of this document (for example by stating the document and scope it will review and the research route it will use) without inventing findings.",
  },
  {
    id: "completion-kept",
    text: "The reply keeps the document reported as complete; the research does not change completion.",
  },
];

export default {
  name: "alps-research-offers-reuse-earlier-request",
  description:
    "At Full completion an explicit research request made earlier in the conversation is reused without asking again.",
  bugReport: "처음에 근거 검토를 해 달라고 했는데 완료 뒤 다시 할지 물었다.",

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
