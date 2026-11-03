// Authored business example for board rendering, not a claim about a user's business.
const evidence = [
  {
    source: "Authored workflow example",
    detail:
      "An order waits for payment; successful payment confirms it; rejection requests cancellation.",
  },
];
const entity = (name, before, after) => ({
  name,
  kind: "aggregate",
  before,
  after,
  verdict: "stated",
  evidence,
});
const stage = (id, context, actor, action, entities, event, policies) => ({
  id,
  context,
  actor,
  action,
  entities,
  event: { name: event, description: event },
  policies,
  verdict: "stated",
  evidence,
  businessStatus: "current",
});
export const BOARD = {
  version: 1,
  origin: "candidate",
  title: "주문과 결제 · 이벤트 스토밍 예시",
  scope: "검증용 예시: 주문 접수, 결제와 주문 확정 및 결제 거절. 실제 사용자 업무 자료가 아님.",
  stages: [
    stage(
      "submit",
      "Ordering",
      "Customer",
      "Submit order",
      [entity("Order", "Not created", "Waiting for payment")],
      "Order placed",
      ["Request payment"],
    ),
    stage(
      "pay",
      "Payment",
      "Payment provider",
      "Collect payment",
      [entity("Payment", "Requested", "Collected")],
      "Payment completed",
      ["Confirm order"],
    ),
    stage(
      "confirm",
      "Ordering",
      "Order system",
      "Confirm order",
      [entity("Order", "Waiting for payment", "Confirmed")],
      "Order confirmed",
      [],
    ),
    stage(
      "reject",
      "Payment",
      "Payment provider",
      "Reject payment",
      [entity("Payment", "Requested", "Rejected")],
      "Payment rejected",
      ["Request cancellation"],
    ),
  ],
  links: [
    { from: "submit", to: "pay", label: "Request payment", verdict: "stated", evidence },
    { from: "pay", to: "confirm", label: "Confirm after payment", verdict: "stated", evidence },
    {
      from: "submit",
      to: "reject",
      label: "Payment request rejected",
      verdict: "stated",
      evidence,
    },
  ],
  subdomains: [
    {
      name: "Ordering",
      responsibility: "Order lifecycle; the ordering context owns the order meaning.",
      verdict: "inferred",
      evidence,
    },
  ],
};
