import { alpsLiteResumeText } from "../lib/alps-mcp-surfaces.mjs";
import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const PROBLEM =
  "비회원으로 상품을 담던 쇼핑객은 결제를 위해 로그인하면 담아 둔 장바구니가 사라져 다시 담거나 구매를 포기한다.";
const OUTCOME =
  "쇼핑객이 로그인해도 비회원 때 담은 상품을 그대로 이어서 구매해, 로그인 단계에서 포기되던 구매를 회복한다.";
const SAVED = [
  { section: 1, subsection_id: "1", title: "Target User and Core Problem", content: PROBLEM },
  { section: 1, subsection_id: "2", title: "Intent and Desired Outcome", content: OUTCOME },
];

const SECTION_ONE = `
Section 1 Business Context는 승인되어 저장되었다.

1.1 Target User and Core Problem:
${PROBLEM}

1.2 Intent and Desired Outcome:
${OUTCOME}

같은 상품의 수량은 합산한다고 사용자가 정했다. 금전, 권한, 개인정보, 안전, 외부 약속과
관련해 사용자가 더 정해야 할 정책은 없다.
`;

export default {
  name: "lite-alps-resume-preserves-proposal-first",
  description:
    "Resuming a Lite document must preserve proposal-first Sections 2-6 and 8 instead of applying Full ALPS's blanket no-auto-generation guidance.",
  bugReport:
    "Lite 문서를 load하면 공통 resume banner가 DO NOT auto-generate content라고 지시해 Section 2와 4의 working-backwards 제안을 막았다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    const resume = alpsLiteResumeText(dir, SAVED);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      `\n---\n\n# Actual alps_document load response`,
      resume,
      `\n---\n\n# Approved document context`,
      SECTION_ONE,
      `Continue at the first incomplete required Section. Write the normal next response in Korean.`,
      `Do not call tools or save content.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
