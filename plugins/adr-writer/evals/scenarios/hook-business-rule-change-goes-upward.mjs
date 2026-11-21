import { hookContext, seedIndexedAdrs, seedRuleDocs, TAIL_SPEC, write } from "../lib/harness.mjs";
import {
  commitFixture,
  ontologyDirective,
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// A conversational request with no skill loaded: only the two SessionStart directives
// stand between the user and a direct ADR edit. The request changes a rule that spans the
// order and payment steps, so the model owns its meaning; the threshold stays in the ADR.
export const obligations = [
  {
    id: "upward-first",
    text: "Before drafting or editing any ADR contract or code for this request, the response routes the change to the business model: it treats letting a partly paid order be confirmed as a change to model-owned meaning (the rule that a payment covers its order, or the confirm-once-paid reaction) and proposes it through /ontology-edit first. Editing the payments or confirmation ADR, or the code, before that proposal fails, and so does changing the ADR while only reporting the conflict with the model.",
  },
  {
    id: "pending-until-approved",
    text: "It states that ADR contract changes depending on the new meaning are not finalized — they stay pending or wait — until the ontology change is approved, and that implementation waits for them.",
  },
  {
    id: "value-stays-in-adr",
    text: "The half-of-the-order threshold is treated as a requirement value for the realizing ADR, not as a fact to write into the business model.",
  },
  {
    id: "context-through-query",
    text: "It obtains the business context through ontology-writer's query command named by the session directive, not by reading or parsing the docs/ontology documents itself.",
  },
].map((o) => ({ ...o, label: `business rule change goes upward: ${o.id}` }));

export default {
  name: "hook-business-rule-change-goes-upward",
  description:
    "With only the session directives, a conversational request that changes a cross-step business rule proposes the ontology change before any ADR or code edit.",
  obligations,
  // Only the shipped SessionStart directives reach the agent; no skill body is loaded.
  directiveOnly: true,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    const adrDirective = hookContext(dir, mapping);
    commitFixture(dir);
    return [
      "The session started with these SessionStart directives:",
      "```text",
      adrDirective,
      "",
      ontologyDirective(dir),
      "```",
      `\n---\n\n# This run`,
      "결제 금액이 주문 금액보다 적어도, 주문 금액의 절반 이상이 결제되면 주문을 확정하도록 바꿔 줘.",
      "",
      "Do not call tools or write files. List, in order, the steps you take for this request and the first artifact you would change, and stop where you would need a command's output or the user's decision.",
      "In the tail use ROUTE (ONTOLOGY_FIRST or ADR_ONLY) and FIRST_CHANGE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
