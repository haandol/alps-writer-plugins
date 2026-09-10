import {
  alpsSkillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

const BRIEF = `
F1: 워크스페이스 멤버 초대
- 관리자만 이메일 주소로 멤버를 초대할 수 있다.
- 초대는 짧은 기간 뒤 만료되어야 하지만 기간과 정책 근거는 정하지 않았다.
- 같은 워크스페이스와 이메일에 활성 초대가 있으면 적절히 처리한다.
- 이메일 전달이 실패했을 때 사용자와 초대 상태에 무엇을 보장할지는 정하지 않았다.
- 이메일 SDK나 provider는 아직 선택하지 않았고 같은 계약을 지키면 교체 가능하다.
- 미정인 기간과 실패 정책에 사용자는 "whatever seems right, 알아서 제안해주세요"라고 답했지만 구체적인 계약값은 승인하지 않았다.
`;

function visibleOutput(output) {
  return output.split(/===\s*EVAL-VERDICT:/i)[0];
}

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

  score({ tail, output }) {
    const visible = visibleOutput(output);
    const questions = tail.findings
      .filter((finding) => /ENRICHMENT_QUESTION/i.test(finding.tag))
      .map((finding) => finding.summary)
      .join("\n");
    const discretion = tail.findings
      .filter((finding) => /IMPLEMENTATION_DISCRETION/i.test(finding.tag))
      .map((finding) => finding.summary)
      .join("\n");
    const prematureCandidates = tail.findings.filter((finding) =>
      /ADR_CANDIDATE|TRANSFER_COMPLETE/i.test(finding.tag),
    );

    return [
      expectText(
        questions,
        /만료|기간|expiry|expiration|duration/i,
        "asks for the missing invitation expiry contract and its basis",
      ),
      expectText(
        questions,
        /중복|활성 초대|duplicate|active invitation/i,
        "asks which duplicate-invitation behavior the contract requires",
      ),
      expectText(
        questions,
        /전달|실패|delivery|failure|초대 상태|invitation state/i,
        "asks for the missing delivery-failure guarantee",
      ),
      expectText(
        discretion,
        /SDK|provider|client|클라이언트/i,
        "routes the replaceable email client to Implementation discretion",
      ),
      expectNoText(
        questions,
        /(?:선택|고르|사용할지|정해|choose|select)[\s\S]{0,100}(?:SDK|provider|client|클라이언트)|(?:SDK|provider|client|클라이언트)[\s\S]{0,100}(?:선택|고르|사용할지|정해|choose|select)/i,
        "does not ask the user to choose a replaceable email implementation",
      ),
      expectNoText(
        visible,
        /\d+\s*(?:일|days?|시간|hours?|주|weeks?|개월|months?)(?![가-힣A-Za-z])/i,
        "does not invent a concrete requirement value",
      ),
      {
        pass: /ASK/i.test(tail.verdict ?? "") || /Result:\s*ASK/i.test(visible),
        detail: `verdict=${tail.verdict ?? "none"}; ${visible.match(/Result:\s*\S+/i)?.[0] ?? "no Result line"}`,
        label: "returns Result ASK for answerable PRD gaps",
      },
      expectNoText(
        visible,
        /Result:\s*BLOCKED|결과:\s*(?:차단|중단)/i,
        "does not label answerable PRD gaps as final BLOCKED",
      ),
      {
        pass: prematureCandidates.length === 0,
        detail:
          prematureCandidates.map((item) => `${item.tag} | ${item.summary}`).join(" ; ") ||
          "no ADR candidate or completed transfer",
        label: "does not draft or declare transfer complete before enrichment answers",
      },
    ];
  },
};
