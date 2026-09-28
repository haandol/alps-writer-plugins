// Scenario: the sufficiency reviewer must route the two halves of an enum
// mismatch to opposite levels.
//
// The diff below differs from the ADR in two ways at once, on purpose:
//   1. the identifier/wire form differs   (PAID → PAYMENT_COMPLETED)
//        → the code owns naming, so this is [Impl-fact mismatch] → fix the ADR
//   2. a forbidden transition is reachable (cancelled → shipping)
//        → the ADR owns the contract, so this is [Spec violation] → fix the code
//
// Filing #2 as an Impl-fact mismatch is the expensive failure: routed to
// /adr-sync it would rewrite the ADR to match whatever the code does, quietly
// legalising a transition the business forbade. Putting both differences in one
// fixture is deliberate — the reviewer has to split them rather than picking one
// label for "the enum is different".
import {
  agentText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectFinding,
  expectNotMiscategorized,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 주문 상태 전이

Date: 2026-07-01

## Status

Accepted (2026-07-05)

## Context

주문 상태가 코드 곳곳에서 개별적으로 갱신되어, 환불된 주문이 배송되는 사고가 있었다.
상태 집합과 전이 규칙을 한 곳에 고정한다.

## Decision Drivers

- 취소된 주문이 배송되는 사고를 0건으로 (2026-05 사고 대응)
- 정산은 결제 완료 시점을 단일 기준으로 삼는다 (재무 요구)
- 상태 추가 시 코드 수정 지점이 한 곳이어야 한다

## Decision

주문 상태를 하나의 상태 기계로 관리한다.

### Requirement contract

- 주문은 결제완료·배송중·배송완료·취소 중 하나의 상태를 가진다
- **취소된 주문은 어떤 경우에도 배송중으로 넘어가지 않는다** — 2026-05 사고 대응
- 배송완료된 주문은 취소할 수 없다 (환불은 별도 절차)

현재 구현 메모: 결제완료 상태의 내부 코드 식별자는 PAID다.
이 식별자 이름은 외부 전송 형식이나 필수 계약이 아니라 교체 가능한 구현 상세다.

### Alternatives

- **각 핸들러에서 개별 검증**: 지금 방식이며, 사고의 원인이었다. 검증 누락을 막을 수 없다.
- **DB 제약으로만 표현**: 전이 규칙을 트리거로 표현하면 애플리케이션에서 이유를 알 수 없어
  사용자에게 실패 원인을 알려주지 못한다.

## Consequences

취소·배송 경로가 한 곳에서 검증된다. 상태 추가 시 전이 표를 함께 고쳐야 한다.
`;

const DIFF = `diff --git a/src/ordering/status.ts b/src/ordering/status.ts
new file mode 100644
--- /dev/null
+++ b/src/ordering/status.ts
@@
+export const OrderStatus = {
+  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
+  SHIPPING: "SHIPPING",
+  DELIVERED: "DELIVERED",
+  CANCELLED: "CANCELLED",
+} as const;
+
+const ALLOWED = {
+  PAYMENT_COMPLETED: ["SHIPPING", "CANCELLED"],
+  SHIPPING: ["DELIVERED", "CANCELLED"],
+  DELIVERED: [],
+  CANCELLED: ["SHIPPING"],
+};
+
+export function canTransition(from, to) {
+  return ALLOWED[from]?.includes(to) ?? false;
+}
`;

export default {
  name: "impl-review-enum-split-routing",
  description:
    "sufficiency reviewer must split an enum mismatch: differing name = Impl-fact mismatch (fix ADR), reachable forbidden transition = Spec violation (fix code).",
  bugReport: "“취소→배송이 열려 있는데 리뷰어가 ADR을 코드에 맞추라고 했다”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/ordering/0001-order-status-transitions.md", ADR);
    write(
      dir,
      "src/ordering/status.ts",
      DIFF.split("+++ b/src/ordering/status.ts\n@@\n")[1].replace(/^\+/gm, ""),
    );
    write(dir, "diff.patch", DIFF);
    seedMapping(dir, {
      categories: {
        ordering: {
          feature: "주문 상태 전이",
          adrs: [
            {
              path: "docs/adr/ordering/0001-order-status-transitions.md",
              // must carry the transition date, matching the body's ## Status —
              // the shipped lint fails a bare "Accepted" here (status-index-mismatch)
              status: "Accepted (2026-07-05)",
              summary: "주문 상태를 단일 상태 기계로 관리하고 취소→배송을 금지한다",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      agentText("adr-impl-sufficiency-reviewer"),
      `\n---\n\n# This run\n`,
      `You are running as the adr-impl-sufficiency-reviewer described above, in the repository at ${dir}.`,
      `ADR under review: docs/adr/ordering/0001-order-status-transitions.md`,
      `Mapping entry: the "ordering" category in docs/adr/.mapping.json`,
      `Code scope: src/ordering/ (the diff is also saved at diff.patch)`,
      `No pre-implementation approval summary was produced for this standalone run; use the ADR as review-baseline.md.`,
      `No project convention documents exist in this fixture.`,
      `You may read files, but do not edit anything.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    const TRANSITION = /cancel|취소|transition|전이|CANCELLED/i;
    const NAMING = /PAYMENT_COMPLETED|결제완료|identifier|name|이름|naming|wire/i;
    return [
      // The contract violation must be found at all.
      expectFinding(tail, /Spec violation/i, "finds the forbidden transition as a Spec violation"),
      // ...and must NOT be filed as an ADR correction, which would legalise it.
      expectNotMiscategorized(
        tail,
        TRANSITION,
        /Impl-fact mismatch/i,
        "the forbidden transition is NOT routed as an Impl-fact mismatch",
      ),
      // The naming difference is the code's business, so the ADR is what changes.
      // Softer check: some reviewers legitimately treat naming as out of scope
      // and say nothing, so only miscategorisation is failed here.
      expectNotMiscategorized(
        tail,
        NAMING,
        /Spec violation/i,
        "the identifier difference is NOT escalated to a Spec violation",
      ),
      {
        pass: tail.verdict !== null && /FIX_REQUIRED|BLOCK/i.test(tail.verdict),
        detail: tail.verdict ? `verdict was ${tail.verdict}` : "no verdict in the tail block",
        label: "verdict is FIX_REQUIRED or BLOCK (a contract is broken)",
      },
    ];
  },
};
