import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "classification",
    text: "The proposed cancelled-to-shipping transition changes the protected state contract and must never be APPLY_NOW. Rejecting it as DROP or keeping it proposal-only are both valid when the response explains the contract conflict and performs no edits.",
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

const ADR = `# ADR 0001: 주문 취소 전이

Date: 2026-08-15

## Status

Proposed

## Context

취소된 주문이 배송되는 사고를 막는다.

## Decision Drivers

- 취소 후 배송 사고는 허용하지 않는다
- 전이 규칙은 한 곳에서 검증한다
- 오류 의미를 유지한다

## Decision

취소된 주문은 배송중 상태로 전이하지 않는다.

### Alternatives

- 각 핸들러가 개별 검증한다
- 단일 전이 표가 검증한다

## Consequences

새 상태를 추가할 때 전이 계약을 함께 검토한다.
`;

export default {
  name: "refactor-protected-state-transition",
  description:
    "refactor reviewer must keep a state-transition change out of APPLY_NOW even when presented as simplification.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/ordering/0001-cancel-transition.md", ADR);
    seedMapping(dir, {
      categories: {
        ordering: {
          feature: "Ordering",
          adrs: [
            {
              path: "docs/adr/ordering/0001-cancel-transition.md",
              status: "Proposed",
              summary: "취소된 주문의 배송중 전이를 금지한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(
      dir,
      "src/ordering/status.ts",
      `export const allowed = { cancelled: [], paid: ["shipping", "cancelled"] };\n`,
    );
    write(
      dir,
      "proposal.txt",
      "Simplify the table by allowing cancelled -> shipping and handling it downstream.\n",
    );
    write(dir, "tests/ordering.test.ts", "tests currently assert cancelled cannot ship\n");

    return [
      agentText("adr-impl-refactor-reviewer"),
      ruleText("concepts.md"),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `ADR: docs/adr/ordering/0001-cancel-transition.md`,
      `Code: src/ordering/status.ts`,
      `Candidate: proposal.txt`,
      `Tests: tests/ordering.test.ts`,
      `Classify the proposed state-transition simplification. Do not edit files.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    return [
      expectFinding(tail, /PROPOSE_ONLY/i, "state-transition change is proposal-only"),
      expectNoFinding(tail, /APPLY_NOW/i, "state-transition change is never APPLY_NOW"),
    ];
  },
};
