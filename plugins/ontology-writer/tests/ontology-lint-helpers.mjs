// Fixtures that ontology-lint.test.mjs and ontology-lint.integration.test.mjs share.
import { write } from "./helpers.mjs";
import { EXAMPLE } from "./ontology-helpers.mjs";

export const ADR = (title) => `# ADR 0001: ${title}

Date: 2020-01-30

## Status

Proposed

## Purpose

Orders need a confirmation the customer can rely on.

## Decision Drivers

- Customers see one confirmation.
- Payments complete before confirmation.
- Support can explain every confirmation.

## Decision

Confirm an order once its payment completes.

## Alternatives

1. **Confirm on submission** — faster, but unpaid orders look confirmed.
2. **Confirm after payment** — chosen.

## Consequences

### Positive

- Confirmed orders are paid.
`;

export function fixture(
  dir,
  { model = EXAMPLE, realizes, body = ADR("Confirm paid orders"), status = "Proposed" } = {},
) {
  write(dir, "docs/adr/ordering/0001-confirm-paid-orders.md", body);
  const entry = {
    feature: "Order confirmation",
    adrs: [
      {
        path: "docs/adr/ordering/0001-confirm-paid-orders.md",
        status,
        summary: "orders are confirmed after payment",
      },
    ],
  };
  if (realizes) entry.realizes = realizes;
  write(
    dir,
    "docs/adr/.mapping.json",
    JSON.stringify({ categories: { ordering: entry } }, null, 2),
  );
  if (model !== null) write(dir, "docs/ontology/ordering.ttl", model);
}

/** The example with its element blocks in reverse order: the same graph, not canonical. */
export const SHUFFLED = (() => {
  const [header, ...blocks] = EXAMPLE.trimEnd().split("\n\n");
  return `${header}\n\n${blocks.reverse().join("\n\n")}\n`;
})();

export const PREFIXES =
  "@prefix m: <urn:ontology-writer:model:> .\n@prefix onto: <urn:ontology-writer:vocabulary:> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n";
