// A Lite ALPS session that follows only the MCP server instructions and
// overview, without any skill, still flags an unverified external basis in the
// approval digest with an item-scoped research offer.
import { alpsLiteGuideText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";
import { alpsMcpGuidance } from "../lib/alps-mcp-surfaces.mjs";

const SOURCE = `
대상: docs/support.lite.alps.xml. Section 1은 승인되어 저장되었다 (고객센터 상담 녹취·요약 검색).

Section 2를 위해 사용자가 이미 말한 내용:
- 상담 녹취는 개인정보 관련 법 때문에 3년 동안 보관해야 한다고 들었다. 근거 자료는 따로 없다.
- 회원이 탈퇴하면 7일 안에 녹취 요약을 지운다. 이것은 우리 회사가 정한 정책이다.

Section 2의 제안과 approval digest를 보여 주는 정상적인 다음 응답을 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export const obligations = [
  {
    id: "flags-unverified-basis",
    text: "The visible digest marks the three-year retention attributed to a law the user only heard about as an unverified basis among the unresolved items and offers research for that item only.",
  },
  {
    id: "no-research-started",
    text: "The reply does not claim to have verified or cited the law and starts no research.",
  },
  {
    id: "choices-kept",
    text: "The digest still offers approve, revise and defer, and approving without research keeps the basis unverified.",
  },
  {
    id: "no-offer-for-policy",
    text: "The reply makes no research offer for the company's own seven-day deletion policy.",
  },
];

export default {
  name: "alps-research-inflight-mcp-lite",
  description:
    "A Lite ALPS session guided only by the MCP server instructions and overview flags an unverified external basis in the digest with an item-scoped offer, keeps approval choices, and makes no offer for a chosen policy.",
  bugReport:
    "스킬 없이 MCP 안내만 따르는 Lite 작성에서는 근거 없는 법령 주장이 미확인 표시 없이 승인됐다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    const { instructions, overview } = alpsMcpGuidance("lite");
    return [
      `# alps-writer MCP server instructions\n\n${instructions}`,
      `# alps_template overview (lite)\n\n${overview}`,
      alpsLiteGuideText(2),
      `\n---\n\n# This run`,
      `No alps-writer skill is loaded in this session; follow the MCP server guidance above.`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
