// A Full ALPS session that follows only the MCP server instructions and
// overview, without any skill, still flags an unverified external basis in the
// approval digest with an item-scoped research offer.
import { alpsGuideText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";
import { alpsMcpGuidance } from "../lib/alps-mcp-surfaces.mjs";

const SOURCE = `
Section 7 Feature: 결제 재시도 (Full ALPS, docs/payments.alps.xml)

사용자는 카드 결제가 실패하면 자동으로 다시 시도받는다.
- 결제 대행사 API는 가맹점당 초당 100건까지만 받는다고 들었다. 확인한 자료는 없다.
- 재시도는 최대 3번까지 한다. 이것은 우리 회사가 정한 정책이다.
- 3번 모두 실패하면 사용자에게 다른 결제 수단을 고르라고 안내한다.
- Demo checkpoint: 실패한 결제가 재시도 후 성공으로 바뀌어 주문 화면에 보인다.

이 Feature의 approval digest만 작성하라. 도구를 호출하거나 저장하지 마라.
`;

export const obligations = [
  {
    id: "flags-unverified-basis",
    text: "The visible digest marks the payment provider's 100-requests-per-second limit as an unverified basis among the unresolved items and offers to research only that item before approval.",
  },
  {
    id: "no-research-started",
    text: "The reply does not claim to have checked any source, does not present the limit as confirmed, and starts no research.",
  },
  {
    id: "choices-kept",
    text: "The digest still offers approve, revise and defer and makes clear that approving without research keeps the limit unverified.",
  },
  {
    id: "no-offer-for-policy",
    text: "The reply makes no research offer for the company's own three-retry policy.",
  },
];

export default {
  name: "alps-research-inflight-mcp-full",
  description:
    "A Full ALPS session guided only by the MCP server instructions and overview flags an unverified external basis in the digest with an item-scoped offer, keeps approval choices, and makes no offer for a chosen policy.",
  bugReport:
    "/alps-init 없이 'PRD 써 줘'로 시작한 Full 작성에서는 확인되지 않은 외부 수치를 그대로 승인했다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    const { instructions, overview } = alpsMcpGuidance("full");
    return [
      `# alps-writer MCP server instructions\n\n${instructions}`,
      `# alps_template overview (full)\n\n${overview}`,
      alpsGuideText(7),
      `\n---\n\n# This run`,
      `No alps-writer skill is loaded in this session; follow the MCP server guidance above.`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
