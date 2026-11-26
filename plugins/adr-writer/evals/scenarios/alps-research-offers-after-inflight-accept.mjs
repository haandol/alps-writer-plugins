// Accepting an in-authoring research offer for one item is not a request for the
// whole-document review: at completion the author still asks once and starts no
// document-wide research on its own.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/support.lite.alps.xml (Lite ALPS)

Section 4를 작성할 때 approval digest가 NFR-2의 근거("결제 기록은 법적으로 5년 보관해야 한다고 들었다")를 미확인 근거로 표시하고 그 항목만 근거 검토를 제안했다. 사용자는 "그 항목만 조사해 줘."라고 답했다.
alps-research로 NFR-2 하나만 검토했고, 결과(접근 가능한 자료로는 확인하지 못함, 미확인 유지)를 같은 digest에 돌려주었다. 사용자는 NFR-2 근거를 "미확인 — 법무 확인 필요"로 적어 승인했고 4.1을 저장했다.
그 뒤 나머지 Section을 승인받아 저장했고, 방금 Section 8을 저장하고 alps_export(doc_path)도 끝났다.
alps_document(action: 'status', doc_path) 결과: Sections 1-6, 8 ✅ Written, Section 7 not written (optional), Completion: ✅ Complete.
이 대화에서 문서 전체의 근거 검토에 대해서는 아무 말도 없었다.
정상적인 다음 응답을 작성하라. 도구를 호출하지 마라.
`;

export const obligations = [
  {
    id: "invites-once",
    text: "The reply asks exactly once whether the user wants the optional deep-research review of the completed document; the earlier item-scoped research for NFR-2 is neither treated as an answer that skips this invitation nor as a request for the whole-document review.",
  },
  {
    id: "no-document-research",
    text: "The reply does not start or announce a document-wide research review on its own and claims no new findings.",
  },
  {
    id: "basis-unverified",
    text: "If the reply mentions NFR-2, it describes its basis as still unverified pending legal confirmation, not as confirmed.",
  },
];

export default {
  name: "alps-research-offers-after-inflight-accept",
  description:
    "Accepting an in-authoring research offer for one item is not a request for the whole-document review: at completion the author still asks once and starts no document-wide research on its own.",
  bugReport:
    "작성 중 한 항목 조사를 수락했더니, 완료 뒤 묻지도 않고 문서 전체 근거 조사를 시작했다.",

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
