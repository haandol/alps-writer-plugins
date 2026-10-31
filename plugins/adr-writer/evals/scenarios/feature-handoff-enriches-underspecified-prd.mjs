import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "questions",
    text: "Ask targeted questions for the invitation expiry period and policy basis, active duplicate-invitation behavior, and delivery-failure guarantee for the user and invitation state. Do not treat unspecified values as approved. A clearly labeled example inside a clarification question is not an adopted requirement.",
  },
  {
    id: "boundary",
    text: "Keep the replaceable email SDK/provider in implementation discretion without asking the user to choose it. Return ASK rather than final BLOCKED, do not draft an ADR or declare handoff complete, and preserve the admin-only invitation permission.",
  },
];

/** Exact output/scope checks supplement the semantic obligations. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    { IMPLEMENTATION_DISCRETION: [], NOT_TRANSFERRED: [] },
    { noTools: false },
  );
}

import { alpsSkillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

const BRIEF = `
F1: 워크스페이스 멤버 초대
- 관리자만 이메일 주소로 멤버를 초대할 수 있다.
- 초대는 짧은 기간 뒤 만료되어야 하지만 기간과 정책 근거는 정하지 않았다.
- 같은 워크스페이스와 이메일에 활성 초대가 있으면 적절히 처리한다.
- 이메일 전달이 실패했을 때 사용자와 초대 상태에 무엇을 보장할지는 정하지 않았다.
- 이메일 SDK나 provider는 아직 선택하지 않았고 같은 계약을 지키면 교체 가능하다.
- 미정인 기간과 실패 정책에 사용자는 "whatever seems right, 알아서 제안해주세요"라고 답했지만 구체적인 계약값은 승인하지 않았다.
`;

export default {
  name: "feature-handoff-enriches-underspecified-prd",
  description:
    "/feature-to-adr must ask targeted contract questions for an underspecified PRD without inventing values, questioning replaceable SDKs, or declaring transfer complete.",
  bugReport:
    "PRD가 ADR보다 덜 구체적인데 feature-to-adr가 보완 질문에 도달하기 전에 Unresolved로 막힌다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("feature-to-adr"),
      `\n---\n\n# This run`,
      `Analyze the following ALPS Feature on the first non-interactive turn.`,
      `Do not answer the gaps, write files, or draft an ADR. Show exactly what the`,
      `skill would ask before final classification. Do not turn replaceable SDK or`,
      `provider selection into a question.`,
      BRIEF,
      `Use ENRICHMENT_QUESTION for each required user answer,`,
      `IMPLEMENTATION_DISCRETION for the replaceable email client choice, and`,
      `NOT_TRANSFERRED to state that handoff has not completed. Use ADR_CANDIDATE`,
      `only if the source is already complete enough to draft, which it is not.`,
      `Put each tag exactly to the left of the | separator.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
