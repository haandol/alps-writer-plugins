// A Full ALPS session that follows only the shipped MCP server surfaces (server
// instructions, overview, the Section 7 guide with its runtime read banner, and
// the Section 7 template), without any skill, drafts one Feature.
import { TAIL_SPEC } from "../lib/harness.mjs";
import { alpsMcpSession } from "../lib/alps-mcp-surfaces.mjs";

const SAVED_SECTIONS = `
Saved Sections of docs/study-cafe.alps.xml, as alps_section(action: 'read', doc_path, section: N) returns them:

Section 2 (MVP Goals and Key Metrics)
- 2.1 가설: 회원이 앱에서 좌석을 쉽게 예약하면 빈 좌석이 줄고 회원이 계속 이용한다.
- 2.2 KPI: 좌석 예약 완료율 70% 이상 (tension: 예약 후 노쇼율, 관찰용).

Section 3 (Demo Scenario)
- 3.2 데모 흐름: 회원이 앱의 좌석 배치도에서 빈 좌석을 골라 2시간 예약한다 → 그 좌석이 배치도에 '사용 중'으로 바뀐다 → 회원이 입실 QR로 체크인한다.

Section 4 (High-Level Architecture)
- 4.1 회원 앱 → 예약 서비스 → 좌석 데이터. 외부 시스템: 출입 게이트.

Section 5 (Requirements Summary)
- 5.1 F1 좌석 예약 (Must-Have), F2 QR 체크인 (Must-Have)
- 5.2 NF1 예약 확정 응답 2초 이내 (p95, 피크 시간대)

Section 6 (Design Specification)
- 6.1 화면: 좌석 배치도, 예약 확인, 내 예약.
`;

const REQUEST = `
사용자 메시지:
"이제 F1 기능 명세를 써 주세요. 회원은 빈 좌석을 골라 한 번에 최대 4시간까지 예약할 수 있고, 한 회원은 동시에 좌석 하나만 예약할 수 있어요 (운영 정책). 이미 예약된 좌석을 고르면 '이미 예약된 좌석입니다'를 보여 주세요."
`;

export const obligations = [
  {
    id: "reads-prerequisites",
    text: "Before drafting, the reply says it reads Section 3 (Demo Scenario) and Section 5 (Requirements Summary), and the draft uses both: the Feature reuses Section 5's F1 ID, name and priority, and its demo connection follows the Section 3 journey. Reading other Sections as well is allowed, but Section 6 never replaces Section 5 as the Feature source.",
  },
  {
    id: "current-names",
    text: "The new Feature's evaluation area is 7.1.6 Evaluation Rubric organized as Ideal Cases, Edge Cases and Automated Evaluation Metrics, and it ends with one Demo outcome sentence. The new Feature has no Acceptance Criteria heading and no Demo checkpoint line.",
  },
  {
    id: "single-outcome",
    text: "The Demo outcome states F1's role in the Section 3 journey and an observable completion result consistent with F1's flow and rules. The 4-hour maximum and the one-active-reservation rule are judged in the Rubric rather than restated in the Demo outcome, and no 7.1.7 or separate Feature Demo subsection exists.",
  },
  {
    id: "approval-unit",
    text: "Feature 7.1 is presented as one approval and save unit with approve, revise and defer choices; the 4-hour maximum and one-active-reservation rule appear with their operating-policy basis. The reply neither saves the Feature nor claims it was saved.",
  },
];

export default {
  name: "alps-feature-rubric-mcp-only",
  description:
    "A skill-less MCP session reads Sections 3 and 5 before Section 7 and writes a Feature's 7.x.6 Evaluation Rubric ending in one Demo outcome, never the legacy Acceptance Criteria or Demo checkpoint names.",

  build() {
    const {
      instructions,
      results: [overview, guide, template],
    } = alpsMcpSession([
      { name: "alps_template", arguments: { action: "overview", profile: "full" } },
      { name: "alps_template", arguments: { action: "guide", profile: "full", section: 7 } },
      { name: "alps_template", arguments: { action: "section", profile: "full", section: 7 } },
    ]);
    return [
      `# alps-writer MCP server instructions\n\n${instructions}`,
      `# alps_template overview (full)\n\n${overview}`,
      `# alps_template guide (full, section 7)\n\n${guide}`,
      `# alps_template section (full, section 7)\n\n${template}`,
      `\n---\n\n# This run`,
      `No alps-writer skill is loaded in this session; follow the MCP server guidance above. The overview, Section 7 guide and Section 7 template above are the results of calls already made in this session. No further tool calls are available in this reply.`,
      SAVED_SECTIONS,
      REQUEST,
      `Respond in Korean. First say which saved Sections you read before drafting and why, then show the drafted 7.1 Feature itself, including its 7.1.6, for approval. Do not save anything.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
