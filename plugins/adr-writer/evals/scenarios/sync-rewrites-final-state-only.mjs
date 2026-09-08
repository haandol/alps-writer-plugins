import {
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  read,
  TAIL_SPEC,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";

const ADR_PATH = "docs/adr/runtime/event/0001-event-name.md";

const ADR = `# ADR 0001: 이벤트 이름

Date: 2026-08-15

## Status

Accepted (2026-08-15)

## Context

처리 경로마다 다른 이벤트 이름을 사용하면 같은 사건을 별개의 사건으로 해석한다.

## Decision Drivers

- 모든 처리 경로가 같은 이벤트 이름을 사용해야 한다
- 운영자가 현재 이벤트 이름을 한 문장으로 확인할 수 있어야 한다
- 완료된 작업은 다시 실행되지 않아야 한다

## Decision

\`LEGACY_EVENT\`와 \`CURRENT_EVENT\`를 혼용하지 않고 \`CURRENT_EVENT\`만 사용한다.

### Requirement contract

- 완료된 작업은 처리 중 상태로 돌아가지 않는다.

### Alternatives

1. **단일 이벤트 이름**
   - 장점: 모든 경로가 같은 의미를 사용한다.
   - 단점: 전환 전에 모든 호출자를 확인해야 한다.
2. **경로별 이벤트 이름**
   - 장점: 각 경로를 독립적으로 변경할 수 있다.
   - 단점: 같은 요청이 경로에 따라 다르게 처리될 수 있다.

## Consequences

### Positive

운영자는 현재 이벤트 이름을 직접 확인할 수 있다.

### Negative

새 처리 경로도 같은 이벤트 이름을 따라야 한다.
`;

export default {
  name: "sync-rewrites-final-state-only",
  description:
    "/adr-sync must replace comparison-based transition prose with the direct current result while preserving a genuine current prohibition.",
  bugReport:
    "“ADR 수정 시 최종 결과만 쓰면 되는데 이전 이름과 혼용하지 않는다는 중간 과정까지 본문에 남아 문서가 길어진다.”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, ADR_PATH, ADR);
    seedMapping(dir, {
      categories: {
        "runtime/event": {
          feature: "Event name",
          adrs: [
            {
              path: ADR_PATH,
              status: "Accepted (2026-08-15)",
              summary: "LEGACY_EVENT와 CURRENT_EVENT를 혼용하지 않고 CURRENT_EVENT만 사용한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(
      dir,
      "src/runtime/event.ts",
      `export const eventName = "CURRENT_EVENT";\n` +
        `export const allowedTransitions = { processing: ["completed"], completed: [] };\n`,
    );
    write(
      dir,
      "tests/runtime-event.test.ts",
      `event name is CURRENT_EVENT\ncompleted work cannot return to processing\n`,
    );

    return [
      skillText("adr-sync", {
        references: [
          "skills/adr-sync/references/repository-hygiene.md",
          "skills/adr-sync/references/current-state-reconstruction.md",
        ],
      }),
      `\n---\n\n# This run`,
      `Repository: ${dir}`,
      `Target category: runtime/event`,
      ``,
      `This is a NON-INTERACTIVE deep sync. The user has confirmed that CURRENT_EVENT is`,
      `the intended current decision and that completed work must never return to`,
      `processing. The code already matches both contracts. Correct only the ADR`,
      `wording and its mapping summary; do not ask another question.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ dir }) {
    const body = read(dir, ADR_PATH) ?? "";
    const decision = body.match(/## Decision\n([\s\S]*?)\n### Alternatives/)?.[1] ?? "";
    const mapping = read(dir, "docs/adr/.mapping.json") ?? "";

    return [
      expectText(
        decision,
        /이벤트 이름은\s*`?CURRENT_EVENT`?다/,
        "states CURRENT_EVENT as the direct result",
      ),
      expectNoText(
        decision,
        /LEGACY_EVENT/,
        "removes the replaced event name from current-state prose",
      ),
      expectNoText(
        decision,
        /혼용하지|대신|rather than|instead of|no longer/i,
        "removes transition and comparison carriers",
      ),
      expectText(
        decision,
        /완료된 작업은 처리 중 상태로 돌아가지 않는다/,
        "preserves the current forbidden transition",
      ),
      expectText(mapping, /"summary":\s*"[^"]*CURRENT_EVENT[^"]*"/, "updates the mapping summary"),
      expectNoText(
        mapping,
        /"summary":\s*"[^"]*LEGACY_EVENT[^"]*"/,
        "removes LEGACY_EVENT from the summary",
      ),
    ];
  },
};
