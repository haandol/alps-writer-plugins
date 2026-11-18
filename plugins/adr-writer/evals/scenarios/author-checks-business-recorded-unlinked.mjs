import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { EXAMPLE_MODEL, ontologyQuery } from "../lib/ontology-fixtures.mjs";

const MAPPING = {
  categories: {
    "gift-wrap": {
      feature: "Gift wrapping",
      adrs: [
        {
          path: "docs/adr/gift-wrap/0001-wrap-orders.md",
          status: "Accepted (2026-10-01)",
          summary: "an order can be gift wrapped for a 3,000 won fee",
        },
      ],
      realizes: [],
      dependsOn: [],
    },
  },
};

const ADR = `# ADR 0001: Offer gift wrapping for orders

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

Customers can send an order as a gift without repacking it themselves.

## Decision Drivers

- The wrapping fee follows the pricing policy.

## Decision

An order can be gift wrapped before shipping for a flat fee.

### Requirement contract

- The wrapping fee is 3,000 won per order (pricing policy).

## Alternatives

1. **Free wrapping** — rejected by the pricing policy.
2. **Flat fee (chosen)**.

## Consequences

### Positive

- One predictable fee.
`;

export const obligations = [
  {
    id: "no-rejudgment",
    text: "The user already confirmed that gift wrapping realizes no business step (its index keeps an empty realizes record). The response does not present the three-way link judgment again: it neither asks whether to link the feature to a step nor proposes a new step or an ontology change for the link.",
  },
  {
    id: "checked",
    text: "The response still reports that it checked the business context before changing the ADR, and that the feature is confirmed as unlinked; it does not claim that no business rule applies because nothing is linked.",
  },
  {
    id: "proceeds",
    text: "It proceeds with the requested ADR change (the wrapping fee rising from 3,000 won to 4,000 won) through an approval summary, keeping the value and its pricing-policy basis in the ADR.",
  },
].map((o) => ({ ...o, label: `recorded unlinked: ${o.id}` }));

export default {
  name: "author-checks-business-recorded-unlinked",
  description:
    "Changing the ADR of a feature the user already confirmed as unlinked checks the business context without asking the link judgment again.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/gift-wrap/0001-wrap-orders.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", EXAMPLE_MODEL);
    const context = ontologyQuery(dir, ["--category", "gift-wrap"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new gift-wrap",
      "",
      "선물 포장비를 3,000원에서 4,000원으로 올려 줘. 가격 정책이 바뀌었어.",
      "",
      "docs/adr/gift-wrap/0001-wrap-orders.md:",
      "```markdown",
      ADR,
      "```",
      "The repository contains docs/ontology/ordering.ttl. The business-context query for `gift-wrap` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving: the checked business context and the approval summary.",
      "In the tail use CHECKED_CONTEXT, LINK_JUDGMENT and ADR_VALUE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
