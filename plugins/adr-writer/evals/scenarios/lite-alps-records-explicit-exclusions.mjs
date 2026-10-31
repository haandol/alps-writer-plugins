import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 4-Section Lite ALPS의 Sections 1-2는 승인되었다.
사용자가 첫 PoC의 제외 범위를 명시했다.

- 팀 관리자 페르소나는 다루지 않는다.
- 음성 입력 화면은 만들지 않는다.
- 오프라인 복구는 데모하지 않는다.

가격 정책은 아직 미결정이며 제외로 확정하지 않았다.
Section 3 승인 초안을 작성하라. 도구를 호출하지 마라.
`;

export default {
  name: "lite-alps-records-explicit-exclusions",
  description:
    "Current Lite ALPS Section 3 must record only explicit exclusions and keep unresolved choices out of non-scope.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(3),
      `\n---\n\n# This run`,
      SOURCE,
      `Produce the normal user-facing approval digest in Korean.`,
      `In the tail use EXPLICIT_EXCLUSION three times, UNRESOLVED_NOT_EXCLUDED once, and OPTIONAL_SECTION once.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
