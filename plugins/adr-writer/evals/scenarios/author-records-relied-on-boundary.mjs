import { skillText, ruleText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "relied-on-content",
    text: "The draft requirement contract has a Relied-on boundary written in Shipping's own words for both dependencies. For Ordering's order-paid event it states one event per paid order, the order identifier, and that the event may arrive more than once and out of order; the paid amount may be omitted because Shipping does not rely on it. For the CarrierX pickup booking it states the returned tracking number, possible timeouts and idempotency through a caller-supplied key. A dependsOn key, a Related link or 'see the Ordering ADR' alone fails this check.",
  },
  {
    id: "failure-behavior",
    text: "A repeated order-paid event creates no second shipment. Retrying a timed-out booking with the same idempotency key may be proposed, but no retry count, timeout value or final-failure behavior was supplied: the response raises what happens when booking ultimately fails as a question needing confirmation and does not present an invented number or final-failure policy as an approved contract.",
  },
  {
    id: "relied-on-only",
    text: "Do not copy Ordering's 14-day refund window or its payment-retry policy, which Shipping does not rely on. Ordering stays the owner of the event contract; Shipping records only the part it relies on and does not claim to change or own Ordering's contract.",
  },
  {
    id: "self-contained",
    text: "The draft is understandable without the Ordering repository, which is unavailable: it needs no path or link to that repository's documents, and the response does not claim to have read it. Answer in Korean and do not invoke tools or write files.",
  },
];

export default {
  name: "author-records-relied-on-boundary",
  description:
    "An ADR for a dependent context records what it relies on from another context and an external system in its own body, copying only the relied-on part.",
  obligations,
  build() {
    return [
      skillText("adr-new", { references: ["references/feature-boundaries.md"] }),
      `\n# Loaded rule document: docs/adr/authoring-rules.md\n`,
      ruleText("authoring-rules.md"),
      `# This run
Response-only drafting probe. Do not use tools, write files or request approval to
execute this probe. Draft only the Decision summary and the requirement contract of
a new ADR for category shipping/dispatch, then list your questions.
The brief from the user (the user writes in Korean):
- Shipping은 Ordering이 주문 결제 완료를 알리면 배송을 생성한다.
- Ordering은 다른 저장소(orders-service)에 있고 지금은 접근할 수 없다. Ordering 담당자의
  설명: 주문 결제 완료 이벤트는 결제 승인 후 주문마다 한 번 발행되며 주문 식별자, 원화(KRW)
  결제 금액, 결제 시각을 담는다. 최소 한 번 전달되고 순서가 바뀔 수 있다. Ordering은 14일
  환불 기간을 두고, 실패한 결제 승인을 세 번 재시도한다.
- Shipping은 한 주문에 배송을 최대 하나만 만든다.
- 픽업 예약은 외부 택배사 API인 CarrierX를 호출한다. CarrierX는 운송장 번호를 돌려주고,
  가끔 시간 초과가 나며, 호출자가 준 같은 멱등 키로 반복 예약하면 하나의 예약으로 처리한다.
- 색인에는 이 category의 dependsOn으로 ["ordering/payment-confirmation"]을 기록한다.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
