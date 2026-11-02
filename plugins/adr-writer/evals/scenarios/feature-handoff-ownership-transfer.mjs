import { alpsSkillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

const BRIEF = `
F1: 워크스페이스 멤버 초대
- 관리자만 이메일 주소로 멤버를 초대할 수 있다.
- 같은 워크스페이스와 이메일에 활성 초대가 있으면 중복 초대를 거부한다.
- 초대는 7일 뒤 만료된다 (보안 정책).
- 이메일 전송은 SendGrid SDK로 구현할 계획이지만 같은 계약을 지키는 다른 클라이언트로 교체할 수 있다.

F2: 워크스페이스 내보내기
- 활성 워크스페이스 멤버만 내보내기를 요청할 수 있다.
- 완료된 export는 30일 뒤 삭제한다 (개인정보 정책).
- 장기 보관은 외부 ArchiveCo에 위임하고 장애 시 24시간 로컬 보관 후 재전송한다
  (법무 승인과 운영 복구 정책).
- F2의 권한 판정은 F1이 확립한 워크스페이스 membership 계약을 전제로 한다.
`;

export default {
  name: "feature-handoff-ownership-transfer",
  description:
    "/feature-to-adr must show complete Feature-specific ADR-owned inventories, keep replaceable SDKs in code, separate durable decisions, and preserve required Feature prerequisites.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("feature-to-adr"),
      `\n---\n\n# This run`,
      `Analyze the following completed ALPS features. Do not write files; return only the`,
      `decision-discovery and dependency result that the skill would show before drafting.`,
      BRIEF,
      `Follow the skill's normal Feature result format, including ADR-owned,`,
      `Implementation discretion, Transfer coverage, and Result for each Feature.`,
      `Write each Feature's Transfer coverage on its own line as a numeric X/X ratio.`,
      `In the machine-readable tail use ADR_CANDIDATE and ADR_DEPENDENCY as tags.`,
      `Use ENRICHMENT_QUESTION only if this completed source actually leaves a`,
      `contract or durable decision unanswered.`,
      `Put each tag exactly to the left of the | separator.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
