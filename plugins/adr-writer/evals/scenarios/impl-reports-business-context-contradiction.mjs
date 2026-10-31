import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PLUGIN_ROOT,
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { validateModel } from "../../scripts/process-model-lib.mjs";
import { queryContext, renderContext } from "../../scripts/process-model-query.mjs";

const MODEL = readFileSync(path.join(PLUGIN_ROOT, "templates", "process", "example.ttl"), "utf8");
const MAPPING = {
  categories: {
    payments: {
      feature: "Payments",
      adrs: [
        {
          path: "docs/adr/payments/0001-card-capture.md",
          status: "Proposed",
          summary: "card payments are captured once per order",
        },
      ],
      realizes: ["payment.capture-payment", "payment.request-payment"],
      dependsOn: [],
    },
    confirmation: {
      feature: "Order confirmation",
      adrs: [
        {
          path: "docs/adr/confirmation/0001-confirm-paid.md",
          status: "Accepted (2026-10-01)",
          summary: "paid orders are confirmed",
        },
      ],
      realizes: ["ordering.confirm-order"],
      dependsOn: [],
    },
  },
};
const ADR = `# ADR 0001: Capture card payments once per order

Date: 2026-10-20

## Status

Proposed

## Purpose

Customers must never be charged twice for one order.

## Decision Drivers

- One order is charged at most once.
- A declined card leaves the order unpaid.
- Support can explain every charge.

## Decision

Capture the card charge through the payment provider once per order. After capture, set the order record to confirmed directly in the ordering data instead of announcing that the payment completed.

### Requirement contract

- An order is captured at most once; a repeated capture request returns the first result.
- A declined card leaves the order unpaid and shows the decline reason.

## Alternatives

1. **Capture on submission** — simpler, but charges abandoned carts.
2. **Capture once per order (chosen)**.

## Consequences

### Positive

- No double charges.
`;

export const obligations = [
  {
    id: "contradiction",
    text: "The response identifies that confirming the order directly, without the payment-completed hand-off, contradicts the business context: the model's Confirm once paid policy in another feature reacts to Payment completed.",
  },
  {
    id: "route",
    text: "It reports the contradiction as an alignment issue or a process change proposal and routes it to an ADR-first decision (fix the ADR, or approve a process change); it does not silently implement the contradiction or silently rewrite the model.",
  },
  {
    id: "authority",
    text: "Completion is still judged only by the ADR contract rows; the business context is not turned into a new implementation obligation or completion condition by itself.",
  },
  {
    id: "plan",
    text: "The implementation plan names the business context it checked (the payment-completed hand-off and the confirmation feature reacting to it).",
  },
].map((o) => ({ ...o, label: `impl business context: ${o.id}` }));

export default {
  name: "impl-reports-business-context-contradiction",
  description:
    "/adr-impl in a repository with a business process model must notice an ADR choice that breaks a hand-off another feature relies on, report it as an alignment issue or process change proposal, and keep completion judged by ADR rows.",
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    write(dir, "docs/process/ordering.ttl", MODEL);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0001-card-capture.md": ADR });
    const v = validateModel([{ doc: "docs/process/ordering.ttl", text: MODEL }]);
    const context = renderContext(
      queryContext({
        index: v.index,
        mapping: MAPPING,
        findings: v.findings,
        target: { kind: "category", id: "payments" },
      }),
    );
    return [
      skillText("adr-impl", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-impl payments",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      ADR,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show the implementation plan you would publish and anything you must report before implementing.",
      "In the tail use CONTRADICTION, ROUTE, COMPLETION_BASIS and CHECKED_CONTEXT tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
