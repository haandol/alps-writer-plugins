import {
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectFinding,
  expectNoFinding,
} from "../lib/harness.mjs";

function adr(number, title, decision) {
  return `# ADR ${number}: ${title}

Date: 2026-08-28

## Status

Accepted (2026-08-28)

## Context

결정 경계를 독립적으로 유지한다.

## Decision Drivers

- 각 결정은 독립적으로 읽힌다
- 서로 다른 질문은 합치지 않는다
- 삭제 전 사용자가 범위를 확인한다

## Decision

${decision}

### Alternatives

- 현재 결정을 유지한다
- 다른 정책을 채택한다

## Consequences

결정은 별도 계약으로 유지된다.
`;
}

export default {
  name: "rollup-preserves-decision-boundaries",
  description:
    "/adr-rollup must merge only a real evolution chain, preserve independent decisions, stay within a category, and wait for approval before destructive changes.",

  build(dir) {
    seedRuleDocs(dir);
    write(
      dir,
      "docs/adr/billing/0001-payment-policy.md",
      adr("0001", "Payment policy", "결제는 한 번만 완료된다."),
    );
    write(
      dir,
      "docs/adr/billing/0002-refund-policy.md",
      adr("0002", "Refund policy", "환불은 승인된 거래에만 허용된다."),
    );
    seedMapping(dir, {
      categories: {
        billing: {
          feature: "Billing",
          adrs: [
            {
              path: "docs/adr/billing/0001-payment-policy.md",
              status: "Accepted (2026-08-28)",
              summary: "결제는 한 번만 완료된다",
            },
            {
              path: "docs/adr/billing/0002-refund-policy.md",
              status: "Accepted (2026-08-28)",
              summary: "환불은 승인된 거래에만 허용된다",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      skillText("adr-rollup", {
        references: ["skills/adr-rollup/references/candidate-contract.md"],
      }),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `The two billing ADRs are distinct decisions, not an evolution chain.`,
      `Explain the rollup result without calling tools or editing files.`,
      `Use KEEP_INDEPENDENT, CATEGORY_BOUNDARY, and APPROVAL_BEFORE_DELETE as tail tags.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    return [
      expectFinding(tail, /KEEP_INDEPENDENT/i, "distinct decisions remain separate"),
      expectFinding(tail, /CATEGORY_BOUNDARY/i, "rollup remains inside one category"),
      expectFinding(
        tail,
        /APPROVAL_BEFORE_DELETE/i,
        "destructive changes require explicit approval",
      ),
      expectNoFinding(tail, /MERGE_ALL|DELETE_0002/i, "ADR count alone never triggers merge"),
    ];
  },
};
