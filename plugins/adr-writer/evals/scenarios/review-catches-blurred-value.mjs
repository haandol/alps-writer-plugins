// Scenario: the positive twin of review-requirement-value-preserved.
//
// Same shape of ADR, but the values are blurred into "적절히" / "일정 기간" and
// the allowed state set is gone. R18a exists to catch exactly this, so a
// reviewer that returns PASS here is failing in the opposite direction from the
// other scenario — and the two together are what show the reviewer is applying
// the rule rather than just being uniformly permissive or uniformly deletionist.
//
// Run both when a bug report touches requirement handling. A fix that makes one
// pass by breaking the other has not fixed anything.
import { agentText, seedRuleDocs, seedMapping, write, TAIL_SPEC } from "../lib/harness.mjs";

const ADR = `# ADR 0001: 무료 플랜 채팅 세션 제한

Date: 2026-07-01

## Status

Proposed

## Context

무료 사용자의 LLM 호출 비용이 예측 불가능하게 늘고 있다. 재무팀이 원가 상한을 승인했고,
제품팀은 전환율을 해치지 않는 범위에서 대화를 끊는 방식을 원한다.

## Decision Drivers

- 무료 플랜의 1인당 월 LLM 원가를 통제해야 한다
- 상한에 걸린 사용자의 이탈을 최소화해야 한다
- 서버가 세션 상태를 오래 들고 있지 않아야 한다 (운영 제약)

## Decision

세션 단위로 대화 길이를 적절히 제한하고, 상한에 도달하면 새 세션을 시작하도록 안내한다.

### Requirement contract

- 한 채팅 세션의 대화 길이는 적절한 수준으로 제한된다
- 무료 플랜의 월 세션 수에는 상한이 있다
- 세션 기록은 일정 기간 보관 후 삭제된다
- 세션에는 몇 가지 상태가 있으며 상태 전이를 관리한다

## Consequences

### Positive

원가가 예측 가능해진다.

### Negative

긴 대화가 필요한 사용자는 맥락을 다시 제공해야 한다.

### Alternatives

- **토큰 단위 총량 제한**: 원가와 정확히 연동되지만 사용자가 남은 양을 예측할 수 없다.
- **월 총 턴 수만 제한(세션 개념 없음)**: 단순하지만 서버가 누적치를 계속 들고 있어야 해
  운영 제약에 어긋난다.
`;

export default {
  name: "review-catches-blurred-value",
  description:
    "adr-reviewer must flag requirement values blurred into '적절히 / 일정 기간' and a missing allowed state set (R18a).",
  bugReport: "“요구값이 다 뭉개진 ADR인데 리뷰어가 PASS를 줬다”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/pricing/0001-free-plan-session-limit.md", ADR);
    seedMapping(dir, {
      categories: {
        pricing: {
          feature: "무료 플랜 세션 제한",
          adrs: [
            {
              path: "docs/adr/pricing/0001-free-plan-session-limit.md",
              status: "Proposed",
              summary: "세션 단위로 무료 플랜 대화를 제한한다",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      agentText("adr-reviewer"),
      `\n---\n\n# This run\n`,
      `You are running as the adr-reviewer agent described above, in the repository at ${dir}.`,
      `Review this ADR: docs/adr/pricing/0001-free-plan-session-limit.md`,
      `Its mapping entry is the "pricing" category in docs/adr/.mapping.json.`,
      `No deterministic harness result is being passed, so evaluate the rules yourself.`,
      `Read the rule documents under docs/adr/ as your source of truth.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
