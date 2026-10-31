import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 승격 전 구현 검토

Date: 2026-08-28

## Status

Proposed

## Context

구현과 테스트가 끝나도 완료 검토가 통과하기 전에는 구현 완료 상태가 아니다.

## Decision Drivers

- Status는 검증된 구현 사실을 나타낸다
- 완료 리뷰는 Proposed 상태에서 실행된다
- PASS 이전 승격은 완료 의미를 약화한다

## Decision

완료 리뷰는 구현과 테스트 후, Proposed에서 Accepted로 승격하기 전에 실행한다.

### Alternatives

- 구현 직후 승격하고 나중에 검토한다
- 검토 PASS 뒤에 승격한다

## Consequences

리뷰가 실패하면 ADR은 Proposed로 남는다.
`;

export default {
  name: "impl-review-pre-promotion-lifecycle",
  description:
    "The implementation review and sufficiency role must treat Proposed as the canonical pre-promotion completion-review state.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/review/0001-pre-promotion.md", ADR);
    seedMapping(dir, {
      categories: {
        review: {
          feature: "Pre-promotion review",
          adrs: [
            {
              path: "docs/adr/review/0001-pre-promotion.md",
              status: "Proposed",
              summary: "완료 리뷰는 Proposed 상태에서 Accepted 승격 전에 실행한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(dir, "src/review.ts", "export const implemented = true;\n");
    write(dir, "tests/review.test.ts", "tests passed\n");

    return [
      skillText("adr-impl-review"),
      agentText("adr-impl-sufficiency-reviewer"),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `Implementation, refactoring, and tests have completed.`,
      `The target ADR is still Proposed and /adr-impl-review is now the completion gate.`,
      `Do not call tools. State the lifecycle order.`,
      `Use PRE_PROMOTION and PROMOTE_AFTER_PASS as tail tags.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
