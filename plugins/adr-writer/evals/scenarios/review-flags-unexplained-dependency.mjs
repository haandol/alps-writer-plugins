// Two ADRs that depend on another context. Dispatch explains the dependency only
// through a category key, a Related link and "see the Ordering ADR"; Invoicing
// writes what it relies on into its own Relied-on boundary. A reviewer that flags
// both is as wrong as one that flags neither.
import { agentText, seedRuleDocs, seedMapping, write, TAIL_SPEC } from "../lib/harness.mjs";

const HEADER = (title) => `# ADR 0001: ${title}

Date: 2026-11-10

## Status

Proposed
`;

const DISPATCH = `${HEADER("결제 완료 주문의 배송 생성")}
## Purpose

결제가 끝난 주문은 사람이 확인하지 않아도 배송 준비를 시작해야 한다. 배송팀은 주문마다 배송이 하나만 생기기를 원한다.

## Decision Drivers

- 결제 완료 후 배송 준비까지의 지연을 줄여야 한다
- 한 주문에 배송이 중복으로 생기면 안 된다
- 주문 컨텍스트의 내부 처리에 결합되지 않아야 한다

## Decision

Ordering의 결제 완료 이벤트를 받아 배송을 생성한다. 이벤트 형식과 전달 보장은 Ordering ADR을 따른다.

### Requirement contract

**Required guarantees**

- 결제 완료 이벤트를 받으면 배송을 생성한다 (자세한 내용은 Ordering ADR 참고)
- 한 주문에는 배송이 최대 하나만 생성된다

**Observable evidence**

- 결제 완료 이벤트 하나를 받은 주문에 배송 하나가 생긴다

### Alternatives

- **주기적으로 Ordering을 조회**: 결합은 약하지만 지연이 커진다.

## Consequences

### Positive

결제 완료 후 배송이 자동으로 시작된다.

### Negative

Ordering 이벤트 장애 시 배송이 지연된다.

## Related

- [Ordering 결제 확정](../../ordering/payment-confirmation/0001-confirm-payment.md)
`;

const INVOICING = `${HEADER("결제 완료 주문의 세금계산서 발행")}
## Purpose

결제가 끝난 기업 고객 주문에는 세금계산서를 자동으로 발행해야 한다. 회계팀은 주문마다 한 장만 발행되기를 원한다.

## Decision Drivers

- 결제 완료 후 발행까지 사람의 확인이 없어야 한다
- 한 주문에 세금계산서가 중복 발행되면 안 된다

## Decision

Ordering의 결제 완료 이벤트를 받아 기업 고객 주문의 세금계산서를 발행한다.

### Requirement contract

**Required guarantees**

- 기업 고객 주문의 결제 완료 이벤트를 받으면 세금계산서를 발행한다
- 한 주문에는 세금계산서가 최대 한 장만 발행된다

**Relied-on boundary**

- Ordering이 제공하는 *주문 결제 완료* 이벤트: 결제가 확정된 주문마다 하나이며 주문 식별자, 원화(KRW) 결제 금액, 고객 사업자 여부를 담는다. 같은 이벤트가 두 번 이상, 순서가 바뀌어 도착할 수 있다. Invoicing은 결제 금액을 공급가액과 부가세의 합계로 해석한다.

**Failure guarantees**

- 이미 발행한 주문의 이벤트가 다시 오면 새 세금계산서를 발행하지 않는다

**Observable evidence**

- 같은 주문의 결제 완료 이벤트가 두 번 와도 세금계산서는 한 장이다

### Alternatives

- **월말 일괄 발행**: 구현은 단순하지만 고객이 즉시 증빙을 받지 못한다.

## Consequences

### Positive

결제 직후 고객이 세금계산서를 받는다.

### Negative

이벤트 지연 시 발행도 지연된다.

## Related

- [Ordering 결제 확정](../../ordering/payment-confirmation/0001-confirm-payment.md)
`;

const ORDERING = `${HEADER("결제 확정 후 주문 결제 완료 이벤트 발행")}
## Purpose

결제가 확정된 주문은 배송·정산 같은 다른 업무가 바로 이어받을 수 있어야 한다.

## Decision Drivers

- 결제 확정 직후 다른 컨텍스트가 처리를 시작할 수 있어야 한다
- 이벤트 유실 없이 전달해야 한다

## Decision

결제가 확정되면 *주문 결제 완료* 이벤트를 발행한다.

### Requirement contract

**Required guarantees**

- 결제가 확정된 주문마다 이벤트를 하나 발행하며 주문 식별자, 원화(KRW) 결제 금액, 결제 시각, 고객 사업자 여부를 담는다
- 이벤트는 최소 한 번 전달되며 순서는 보장하지 않는다
- 결제 확정 실패는 최대 세 번 재시도한다

### Alternatives

- **동기 호출로 각 컨텍스트에 통지**: 즉시 알 수 있지만 하위 컨텍스트 장애가 결제를 막는다.

## Consequences

### Positive

결제 확정 후 다른 컨텍스트가 독립적으로 처리를 시작한다.

### Negative

하위 컨텍스트가 중복 이벤트를 처리해야 한다.
`;

export default {
  name: "review-flags-unexplained-dependency",
  description:
    "adr-reviewer flags the shipping/dispatch ADR under R19 because its dependency on Ordering is explained only by a dependsOn key, a Related link and 'see the Ordering ADR', with no relied-on event meaning, values or duplicate/order assumptions in its own body. It does not raise that finding for billing/invoicing, whose Relied-on boundary states the relied-on event in its own words.",
  bugReport: "“다른 컨텍스트 ADR을 참고하라고만 적은 ADR이 리뷰를 통과했다”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/shipping/dispatch/0001-create-shipment-on-payment.md", DISPATCH);
    write(dir, "docs/adr/billing/invoicing/0001-issue-tax-invoice-on-payment.md", INVOICING);
    write(dir, "docs/adr/ordering/payment-confirmation/0001-confirm-payment.md", ORDERING);
    const entry = (feature, path, summary) => ({
      feature,
      adrs: [{ path, status: "Proposed", summary }],
      dependsOn: ["ordering/payment-confirmation"],
    });
    seedMapping(dir, {
      categories: {
        "ordering/payment-confirmation": {
          feature: "결제 확정",
          adrs: [
            {
              path: "docs/adr/ordering/payment-confirmation/0001-confirm-payment.md",
              status: "Proposed",
              summary: "결제가 확정된 주문마다 결제 완료 이벤트를 발행한다",
            },
          ],
          dependsOn: [],
        },
        "shipping/dispatch": entry(
          "배송 생성",
          "docs/adr/shipping/dispatch/0001-create-shipment-on-payment.md",
          "결제 완료 이벤트로 주문마다 배송을 하나 생성한다",
        ),
        "billing/invoicing": entry(
          "세금계산서 발행",
          "docs/adr/billing/invoicing/0001-issue-tax-invoice-on-payment.md",
          "결제 완료 이벤트로 기업 고객 주문마다 세금계산서를 한 장 발행한다",
        ),
      },
    });

    return [
      agentText("adr-reviewer"),
      `\n---\n\n# This run\n`,
      `You are running as the adr-reviewer agent described above, in the repository at ${dir}.`,
      `Review these two ADRs independently:`,
      `- docs/adr/shipping/dispatch/0001-create-shipment-on-payment.md ("shipping/dispatch")`,
      `- docs/adr/billing/invoicing/0001-issue-tax-invoice-on-payment.md ("billing/invoicing")`,
      `Ordering's ADR is in this repository, but each context must be understandable on its own.`,
      `No deterministic harness result is being passed, so evaluate the rules yourself.`,
      `Read the rule documents under docs/adr/ as your source of truth.`,
      `In the tail, prefix each finding summary with the category key it concerns.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
