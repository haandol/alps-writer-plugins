import {
  skillText,
  ruleText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 이름 정규화

Date: 2026-08-15

## Status

Proposed

## Context

동일한 정규화가 두 호출부에 중복됐다.

## Decision Drivers

- 동작을 바꾸지 않는다
- 현재 중복만 다룬다
- 자동 변경은 정확한 근거와 전후 테스트를 거친다

## Decision

두 호출부는 같은 이름 정규화 규칙을 사용한다.

### Alternatives

- 중복을 유지한다
- 공용 함수를 사용한다

## Consequences

두 호출부의 동작이 함께 유지된다.
`;

export default {
  name: "refactor-orchestration-discretion",
  description:
    "adr-impl-refactor must let the model choose main-session or subagent review while keeping the same evidence and before/after-test gates.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/profile/0001-name-normalization.md", ADR);
    seedMapping(dir, {
      categories: {
        profile: {
          feature: "Profile",
          adrs: [
            {
              path: "docs/adr/profile/0001-name-normalization.md",
              status: "Proposed",
              summary: "두 호출부가 같은 이름 정규화 규칙을 사용한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(dir, "src/profile/a.ts", `export const a = (v) => v.trim().toLowerCase();\n`);
    write(dir, "src/profile/b.ts", `export const b = (v) => v.trim().toLowerCase();\n`);
    write(dir, "tests/profile.test.ts", "targeted baseline passed\n");

    return [
      skillText("adr-impl-refactor"),
      ruleText("concepts.md"),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `Target: docs/adr/profile/0001-name-normalization.md`,
      `The named reviewer and generic read-only subagents are unavailable.`,
      `The duplicate is exact, local, and covered by a passing targeted baseline.`,
      `Explain whether the main session may classify it APPLY_NOW after rechecking every safety gate and running the same test after the patch.`,
      `Do not edit files.`,
      `Use ORCHESTRATION_DISCRETION and APPLY_NOW as the applicable tail tags.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
