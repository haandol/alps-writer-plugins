// When an approved Section is revised, an unverified basis keeps its status and
// the declined offer for the same item is not repeated.
import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LITE_OVERVIEW = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../alps-writer/src/templates/lite/overview.md",
  ),
  "utf8",
);

const SOURCE = `
대상: docs/support.lite.alps.xml. Sections 1-2는 승인되어 저장되었다.

Section 2 작성 때 BR-2 "상담 녹취는 3년 보관한다 (근거: 개인정보 관련 법이라고 사용자가 들음, 미확인)"의 근거 검토를 제안했고, 사용자는 조사 없이 승인했다. 2.1은 그대로 저장되었다.
지금 사용자가 말한다: "BR-1의 응답 목표를 영업일 1일에서 영업일 2일로 바꿔 줘. 고객사 계약서가 바뀌었어." (사용자가 바뀐 계약서 문구를 제공했다.)
변경된 Section 2의 approval digest를 보여 주는 정상적인 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export const obligations = [
  {
    id: "change-shown",
    text: "The digest shows BR-1's response target changed from one business day to two business days with the revised customer contract as its basis, and lists later items or demo steps that reference BR-1 when relevant.",
  },
  {
    id: "basis-still-unverified",
    text: "BR-2 remains in the digest with its basis still marked unverified, not as confirmed.",
  },
  {
    id: "no-repeat-offer",
    text: "The reply does not offer research for BR-2 again in this conversation.",
  },
  {
    id: "choices",
    text: "The digest ends with approve, revise and defer choices and nothing is reported as saved.",
  },
];

export default {
  name: "lite-alps-flags-no-repeat-offer",
  description:
    "When an approved Section is revised, an unverified basis keeps its status and the earlier research offer for the same item is not repeated. Its change-shown check also covers the lite-format rule that a revision digest lists the later items that reference the changed one.",
  bugReport:
    "수정할 때마다 같은 항목의 근거 검토를 다시 제안했고, 미확인이던 근거가 확인된 것처럼 바뀌었다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      LITE_OVERVIEW,
      alpsLiteGuideText(2),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
