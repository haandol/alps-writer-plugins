import {
  alpsLiteGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
현재 8-Section Lite ALPS의 Sections 1-6은 승인되었다.
사용자가 제외 범위를 명시했다.

- 비회원 장바구니의 기기 간 동기화는 다루지 않는다.
- 위시리스트 병합은 다루지 않는다.
- 판매자용 화면은 만들지 않는다.

쿠폰을 병합된 장바구니에 다시 적용할지는 아직 미결정이며 제외로 확정하지 않았다.
Section 7 승인 초안을 작성하라. 도구를 호출하지 마라.
`;

export default {
  name: "lite-alps-records-explicit-exclusions",
  description:
    "Current Lite ALPS Section 7 must record only explicit exclusions and keep unresolved choices out of non-scope.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Produce the normal user-facing approval digest in Korean.`,
      `In the tail use EXPLICIT_EXCLUSION three times, UNRESOLVED_NOT_EXCLUDED once, and OPTIONAL_SECTION once.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
