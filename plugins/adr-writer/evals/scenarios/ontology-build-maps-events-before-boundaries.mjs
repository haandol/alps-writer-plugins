import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const NOTES = `# 주문 처리 업무 메모

고객이 주문을 제출하면 결제를 요청한다. 카드 결제가 승인되면 결제 완료가 기록되고, 결제가 완료된 주문만 출고를 준비한다.
출고가 끝나면 고객에게 배송 시작을 알린다. 결제가 거절되면 고객이 다른 카드로 다시 시도할 수 있다.
`;

export default {
  name: "ontology-build-maps-events-before-boundaries",
  description:
    "A first build shows the evidence-based event map before deriving contexts and subdomains, and never takes services or folders as boundaries by themselves.",
  obligations: [
    {
      id: "order",
      text: "The report first presents the business event map for the requested scope — events such as order submitted, payment completed and shipment started with their causal hand-offs — and only then identifies bounded contexts and subdomains from that map, before any model candidates.",
    },
    {
      id: "not-folders",
      text: "The service folders (services/order-api, services/payment-worker, services/notification) are evidence, not boundaries: no bounded context is accepted because a folder or service exists, and each proposed boundary cites business evidence or is marked unconfirmed.",
    },
    {
      id: "subdomain",
      text: "Subdomains are described as problem areas separate from bounded contexts as responsibility boundaries, and a core, supporting or generic classification that the evidence does not state is left unconfirmed.",
    },
    {
      id: "open-path",
      text: "The retry with another card after a declined payment is kept in the map (as stated or as an open question); it is not dropped to make the flow simpler.",
    },
  ],
  build(dir) {
    seedMapping(dir);
    write(dir, "docs/order-notes.md", NOTES);
    for (const service of ["order-api", "payment-worker", "notification"])
      write(dir, `services/${service}/README.md`, `# ${service}\n`);
    return buildPrompt(
      ["references/eventstorming.md", "skills/ontology-build/references/candidate-review.md"],
      "This project has no saved ontology and no ADRs. Its folders are services/order-api, services/payment-worker and services/notification. docs/order-notes.md:",
      "```markdown",
      NOTES,
      "```",
      "사용자: /ontology-build docs/order-notes.md 주문 처리 업무로 첫 모델 초안을 보여 줘.",
      "Do not call tools. Show the report you would present before writing candidates.",
    );
  },
};
