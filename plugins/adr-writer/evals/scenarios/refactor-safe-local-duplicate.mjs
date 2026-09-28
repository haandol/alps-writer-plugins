import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "classification",
    text: "Classify the two existing equivalent normalization implementations as an APPLY_NOW local behavior-preserving refactor, grounded in the supplied current call sites and tests. A clear APPLY_NOW decision in the explanation is valid even if the tail uses a general Refactor category. Do not edit files in this classification-only task.",
  },
];

/** The classification may inspect supplied evidence but may not mutate the fixture. */
export function deterministicScore(input) {
  return responseChecks(input, {}, { noTools: false });
}

import {
  agentText,
  ruleText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectFinding,
  expectNoFinding,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 입력 이름 정규화

Date: 2026-08-15

## Status

Proposed

## Context

두 진입점이 같은 이름 정규화 규칙을 사용한다.

## Decision Drivers

- 두 진입점은 같은 결과를 만들어야 한다
- 외부 계약은 바뀌지 않아야 한다
- 현재 중복만 제거한다

## Decision

입력 이름의 앞뒤 공백을 제거하고 소문자로 저장한다.

### Alternatives

- 각 진입점이 규칙을 중복 구현한다
- 공용 정규화 함수를 현재 두 진입점에서 사용한다

## Consequences

두 호출부가 같은 규칙을 공유한다.
`;

export default {
  name: "refactor-safe-local-duplicate",
  description:
    "refactor reviewer should classify a small tested extraction of current same-semantics duplication as APPLY_NOW.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/profile/0001-normalize-name.md", ADR);
    seedMapping(dir, {
      categories: {
        profile: {
          feature: "Profile",
          adrs: [
            {
              path: "docs/adr/profile/0001-normalize-name.md",
              status: "Proposed",
              summary: "두 진입점의 이름 정규화 규칙을 동일하게 유지한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(
      dir,
      "src/profile/create.ts",
      `export const createName = (value) => value.trim().toLowerCase();\n`,
    );
    write(
      dir,
      "src/profile/import.ts",
      `export const importName = (value) => value.trim().toLowerCase();\n`,
    );
    write(dir, "tests/profile.test.ts", "both entry points have passing normalization tests\n");

    return [
      agentText("adr-impl-refactor-reviewer"),
      ruleText("concepts.md"),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `ADR: docs/adr/profile/0001-normalize-name.md`,
      `Code: src/profile/create.ts and src/profile/import.ts`,
      `Tests: tests/profile.test.ts; assume the targeted test passed before review and can run after.`,
      `Classify the duplicated trim().toLowerCase() operation. Do not edit files.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    return [
      expectFinding(tail, /APPLY_NOW/i, "safe current duplication is classified APPLY_NOW"),
      expectNoFinding(
        tail,
        /PROPOSE_ONLY/i,
        "the local tested extraction is not unnecessarily proposal-only",
      ),
    ];
  },
};
