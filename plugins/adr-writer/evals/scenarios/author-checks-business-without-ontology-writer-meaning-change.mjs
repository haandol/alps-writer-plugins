import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  CHECKOUT_ADR,
  CONFIRMATION_ADR,
  RETRY_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// The repository holds a business model, but Ontology Writer is not installed. The missing
// query never blocks the work, yet it does not waive the model's prior approval: the request
// changes a rule spanning the payment and confirmation steps, so the content depending on it
// stays pending, while the retry limit is an ADR-owned value that proceeds.
export const obligations = [
  {
    id: "unchecked-and-approval-first",
    text: "The response states that the business context was not checked because Ontology Writer is not available, and that confirming an order paid for only half of its amount changes business meaning the model owns — a rule spanning the payment and confirmation steps — so that meaning needs Ontology Writer's model change approval before the ADR settles it. Treating the unavailable query as permission to settle the new confirmation rule in the ADR fails.",
  },
  {
    id: "dependent-pending",
    text: "Every contract row that depends on the partial-payment confirmation meaning is left pending (미정): it names the awaited business change in business language, without model file paths or element identifiers such as ordering.ttl or ordering.confirm-order, and it is neither presented as an approved contract nor planned for implementation before that approval. The half-of-the-order threshold stays with that pending ADR row as a requirement value and is not proposed as a model fact.",
  },
  {
    id: "independent-proceeds",
    text: "The retry-limit change does not wait for the business change: the approval summary revises the existing payments ADR row in place from 3 to 5 retries per order, still rejects the attempt beyond the limit with the order left unpaid, and presents that revision for normal ADR approval.",
  },
  {
    id: "proposed",
    text: "Every ADR that carries a pending row stays Proposed, and the response does not present any ADR as ready to implement or accept while the business change awaits approval.",
  },
  {
    id: "no-model-reading",
    text: "It does not open, parse, search or summarize docs/ontology/ordering.ttl as a substitute for the query, and it does not present the model's steps, events or rules as checked.",
  },
].map((o) => ({ ...o, label: `meaning without ontology writer: ${o.id}` }));

export default {
  name: "author-checks-business-without-ontology-writer-meaning-change",
  description:
    "ADR authoring with a business model but no Ontology Writer keeps content that depends on a model-owned meaning change pending on Ontology Writer's approval, states the context was not checked, and still proceeds with an independent value change.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedIndexedAdrs(dir, mapping, {
      "docs/adr/payments/0001-card-capture.md": RETRY_ADR,
      "docs/adr/checkout/0001-submit-orders.md": CHECKOUT_ADR,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    seedMapping(dir, mapping);
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "결제 정책 두 가지를 바꾸려 한다.",
      "- 카드가 거절된 주문의 결제 재시도 한도를 3회에서 5회로 늘린다 (결제 위험 정책).",
      "- 결제 금액이 주문 금액보다 적어도, 주문 금액의 절반 이상이 결제되면 주문을 확정한다.",
      "",
      "The repository contains docs/ontology/ordering.ttl, but Ontology Writer is not installed in this client: its query command is not available.",
      "",
      "docs/adr/.mapping.json:",
      "```json",
      JSON.stringify(mapping, null, 2),
      "```",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      RETRY_ADR,
      "```",
      "",
      "docs/adr/confirmation/0001-confirm-paid.md:",
      "```markdown",
      CONFIRMATION_ADR,
      "```",
      "",
      "docs/adr/checkout/0001-submit-orders.md:",
      "```markdown",
      CHECKOUT_ADR,
      "```",
      "",
      "Do not call tools or write files. Show what you would present before saving: what you checked and the approval summary.",
      TAIL_SPEC,
    ].join("\n");
  },
};
