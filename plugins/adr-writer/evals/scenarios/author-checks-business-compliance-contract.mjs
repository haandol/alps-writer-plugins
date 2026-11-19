import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  commitFixture,
  ontologyQuery,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// Every process is Accepted with all its features Accepted, so the context is settled.
const MAPPING = settledMapping();
const adr = (title, purpose, decision, rows) => `# ADR 0001: ${title}

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

${purpose}

## Decision Drivers

- Customers are never charged or confirmed twice.

## Decision

${decision}

### Requirement contract

${rows.map((r) => `- ${r}`).join("\n")}

## Alternatives

1. **Manual handling** — too slow.
2. **Automatic handling (chosen)**.

## Consequences

### Positive

- Orders move without manual work.
`;
const PAYMENTS = adr(
  "Capture card payments once per order",
  "Customers must never be charged twice for one order.",
  "Capture the card charge through the payment provider once per order.",
  [
    "An order is captured at most once; a repeated capture request returns the first result.",
    "A declined card leaves the order unpaid.",
  ],
);
const CONFIRMATION = adr(
  "Confirm paid orders",
  "A paid order is accepted for fulfilment without manual review.",
  "Confirm an order once its payment is complete.",
  ["A confirmed order is shown to the customer as confirmed."],
);

export const obligations = [
  {
    id: "compliance",
    text: "The draft proposes, for approval, a compliance contract in the payments ADR for the Payment completed hand-off that order confirmation reacts to: when the event is announced (only after a successful capture, never for a declined card), which order it identifies, and its duplicate guarantee — proposed (one announcement per order, or repeats safe to receive) or put to the user as an explicit choice in the same approval.",
  },
  {
    id: "other-adr",
    text: "It reports that the order-confirmation ADR states no contract for receiving Payment completed (for example a repeated or late event) as an alignment issue for that feature, without editing that ADR in this change.",
  },
  {
    id: "approval",
    text: "Nothing is saved before approval: the compliance contract and the requested change appear in one approval summary, and the requested decline-reason change is kept.",
  },
].map((o) => ({ ...o, label: `compliance contract: ${o.id}` }));

export default {
  name: "author-checks-business-compliance-contract",
  description:
    "An ADR change that finds a business hand-off without a compliance contract proposes one in the draft and reports the other realizing ADR missing it.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, {
      "docs/adr/payments/0001-card-capture.md": PAYMENTS,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "카드가 거절되면 고객에게 거절 사유를 보여 주도록 결제 결정을 고쳐 줘.",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      PAYMENTS,
      "```",
      "docs/adr/confirmation/0001-confirm-paid.md:",
      "```markdown",
      CONFIRMATION,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving: the checked business context and the approval summary.",
      "In the tail use CHECKED_CONTEXT, COMPLIANCE_CONTRACT, ALIGNMENT and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
