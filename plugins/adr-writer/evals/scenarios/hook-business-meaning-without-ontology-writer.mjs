import { hookContext, seedIndexedAdrs, seedRuleDocs, TAIL_SPEC, write } from "../lib/harness.mjs";
import {
  CHECKOUT_ADR,
  CONFIRMATION_ADR,
  RETRY_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// A conversational request with no skill loaded, in a repository that holds a business model
// but has no Ontology Writer: only ADR Writer's SessionStart directive tells the agent the
// order. The missing query never blocks the work, yet it does not waive the model's prior
// approval for the rule spanning the payment and confirmation steps; the retry limit is an
// ADR-owned value that proceeds.
export const obligations = [
  {
    id: "unchecked-and-approval-first",
    text: "The response states that the business context was not checked because Ontology Writer is not available, and that confirming an order paid for only half of its amount changes business meaning the model owns — a rule spanning the payment and confirmation steps — so that meaning needs Ontology Writer's model change approval before the ADR settles it. Treating the unavailable query as permission to settle the new confirmation rule in an ADR or in code fails.",
  },
  {
    id: "dependent-pending",
    text: "ADR content that depends on the partial-payment confirmation meaning is held until that approval: it is presented as a pending (미정) contract row or explicitly deferred, the awaited business change is named in business language without model file paths or element identifiers such as ordering.ttl or ordering.confirm-order, and neither that content nor its code is finalized or implemented before the approval. The half-of-the-order threshold stays with the ADR as a requirement value and is not proposed as a model fact.",
  },
  {
    id: "independent-proceeds",
    text: "The retry-limit change does not wait for the business change: it proceeds as a revision of the existing payments ADR row from 3 to 5 retries per order that still rejects the attempt beyond the limit with the order left unpaid.",
  },
  {
    id: "proposed",
    text: "No ADR that carries content awaiting the business change is marked or presented as Accepted or ready to implement; an ADR with a pending row stays Proposed.",
  },
  {
    id: "no-model-reading",
    text: "It does not open, parse, search or summarize docs/ontology/ordering.ttl as a substitute for the query, and it does not present the model's steps, events or rules as checked.",
  },
].map((o) => ({ ...o, label: `directive meaning without ontology writer: ${o.id}` }));

export default {
  name: "hook-business-meaning-without-ontology-writer",
  description:
    "With only ADR Writer's session directive and no Ontology Writer, a conversational request that changes model-owned meaning keeps the dependent ADR content pending on Ontology Writer's approval, states the context was not checked, and still proceeds with an independent value change.",
  obligations,
  // Only the shipped SessionStart directive reaches the agent; no skill body is loaded.
  directiveOnly: true,
  // Ontology Writer is not installed, so its directive is absent and only ADR Writer's is shipped.
  withoutOntologyWriter: true,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedIndexedAdrs(dir, mapping, {
      "docs/adr/payments/0001-card-capture.md": RETRY_ADR,
      "docs/adr/checkout/0001-submit-orders.md": CHECKOUT_ADR,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    const adrDirective = hookContext(dir, mapping);
    return [
      "The session started with this SessionStart directive:",
      "```text",
      adrDirective,
      "```",
      "Ontology Writer is not installed in this client, so no business-context query command is available.",
      `\n---\n\n# This run`,
      "결제 정책 두 가지를 바꿔 줘. 카드가 거절된 주문의 결제 재시도 한도는 3회에서 5회로 늘리고, 결제 금액이 주문 금액보다 적어도 주문 금액의 절반 이상이 결제되면 주문을 확정하도록 해 줘.",
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
      "Do not call tools or write files. List, in order, the steps you take for this request and the ADR changes you would present for approval, and stop where you would need a command's output or the user's decision.",
      TAIL_SPEC,
    ].join("\n");
  },
};
