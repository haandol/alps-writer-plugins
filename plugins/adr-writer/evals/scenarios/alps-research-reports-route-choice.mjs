// alps-research must pick its research route from the capabilities an agent
// actually exposes: built-in deep research first without a duplicate search,
// web search while it works, and DuckDuckGo MCP only after web search fails,
// disclosing that fallback. A planning probe: the three environments are
// described, not simulated.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";

const SOURCE = `
대상: docs/support.lite.alps.xml 의 NFR-1 "개인정보 관련 법은 상담 녹취를 3년 보관하도록 요구한다" 하나를 근거 검토한다.

아래 세 환경 각각에서 어떤 조사 경로를 먼저 쓰고, 실패하면 어떻게 하며, 최종 결과에 무엇을 밝힐지 설명하라.
실제 조사는 하지 말고 도구도 호출하지 마라. 조사 결과나 법령 내용을 지어내지 마라.

- 환경 A: 에이전트가 비동기 내장 딥리서치 기능(deep_research)을 노출한다. 일반 web_search와 DuckDuckGo MCP 도구(duckduckgo_search, duckduckgo_fetch)도 연결되어 있다.
- 환경 B: 내장 딥리서치는 없다. web_search와 페이지 읽기 도구가 정상 동작한다. 찾은 자료 하나가 NFR-1과 다른 내용을 말한다. DuckDuckGo MCP도 연결되어 있다.
- 환경 C: 내장 딥리서치는 없다. web_search는 모든 질의에 503 오류를 돌려준다. DuckDuckGo MCP 도구가 연결되어 있다.
`;

export const obligations = [
  {
    id: "env-a",
    text: "For environment A the reply uses the built-in deep research first, waits for it to finish or fail, inspects its sources and coverage, and does not run a duplicate general web or DuckDuckGo investigation alongside it; it would follow up only on evidence gaps.",
  },
  {
    id: "env-b",
    text: "For environment B the reply researches with web search and source reading and does not switch to DuckDuckGo MCP merely because a found source disagrees with NFR-1.",
  },
  {
    id: "env-c",
    text: "For environment C the reply switches to DuckDuckGo MCP after web search fails and says that it will state in the final result that DuckDuckGo MCP was used and why.",
  },
  {
    id: "no-fabrication",
    text: "The reply reports no research findings, statute, article or source for NFR-1 and does not claim research was performed.",
  },
];

export default {
  name: "alps-research-reports-route-choice",
  description:
    "alps-research must choose the exposed built-in deep research first without duplicate search, keep a working web search, and fall back to DuckDuckGo MCP only after web search fails, disclosing the fallback.",
  bugReport:
    "웹 검색이 되는데도 DuckDuckGo로 넘어갔고, 내장 딥리서치와 일반 검색을 중복으로 돌렸다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-research"),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
