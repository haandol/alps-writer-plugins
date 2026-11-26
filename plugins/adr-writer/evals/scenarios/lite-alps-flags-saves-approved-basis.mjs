// Approving a Section without research saves it: the unverified basis is a
// state of the evidence, not an unresolved value or policy that blocks saving.
import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
대상: docs/support.lite.alps.xml. Section 1은 승인되어 저장되었다.

앞 턴에서 Section 2 approval digest를 보여 주었다. 그 digest는 BR-2 "상담 녹취는 3년 보관한다 (근거: 개인정보 관련 법이라고 사용자가 들음)"의 근거를 미확인 근거로 표시하고, 그 항목만 근거 검토를 제안했다. 다른 미해결 질문은 없었다.
사용자는 이렇게 답했다: "조사 없이 그대로 승인할게."
ALPS 도구는 이번 실행에 연결되어 있지 않다. 지금 수행할 저장(section, subsection_id, 저장할 BR-2 근거 문구)을 정확히 밝히고, 그다음 진행을 안내하는 정상적인 응답을 작성하라.
`;

export const obligations = [
  {
    id: "saves",
    text: "The reply proceeds to save subsection 2.1 as approved; it does not refuse or delay the save because BR-2's basis is unverified.",
  },
  {
    id: "basis-stays-unverified",
    text: "The stored BR-2 basis wording still shows that the legal basis is unverified (for example 'heard, not verified'); the reply does not present it as confirmed.",
  },
  {
    id: "no-research",
    text: "The reply starts no research and does not repeat the research offer for BR-2.",
  },
  {
    id: "continues",
    text: "The reply continues to the next Section in order.",
  },
];

export default {
  name: "lite-alps-flags-saves-approved-basis",
  description:
    "Approving a Section without research saves it with its basis still unverified, without treating the unverified basis as an unresolved value that blocks saving or repeating the offer.",
  bugReport: "미확인 근거를 그대로 승인했는데 미해결 항목이 있다며 저장하지 않았다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
