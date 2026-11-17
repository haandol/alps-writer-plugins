import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

const EXPECTED = { A: "ordering", B: "billing", C: "root", D: "keep" };

export const obligations = [
  {
    id: "context-meaning",
    text: "Order means a confirmed purchase request in Ordering and a paid, billable record in Billing, so each meaning is saved in that context's own glossary (docs/adr/ordering/glossary.md and docs/adr/billing/glossary.md) and never merged into one entry or forced into one shared definition. SKU means the same everywhere and goes to the root docs/adr/glossary.md.",
  },
  {
    id: "existing-entry",
    text: "The existing root entry for Hold stays valid where it is: the response may propose moving it into the Inventory context glossary, but only as a change needing approval, not as an automatic move or deletion.",
  },
  {
    id: "bounded",
    text: "Explain in Korean, keep requirement values in the ADR rather than only in a glossary, and do not invoke tools or write files in this response-only probe.",
  },
];

export function deterministicScore(input) {
  const rows = Array.isArray(input.tail?.findings) ? input.tail.findings : [];
  return [
    ...responseChecks(input, {}),
    ...Object.entries(EXPECTED).map(([tag, place]) => ({
      label: `${tag} is placed in ${place}`,
      pass:
        rows.filter((r) => r?.tag === tag).length === 1 &&
        rows.find((r) => r?.tag === tag)?.summary?.trim() === place,
      detail: rows.find((r) => r?.tag === tag)?.summary ?? "missing",
    })),
  ];
}

export default {
  name: "author-places-terms-by-context",
  description:
    "Glossary entries follow the bounded context whose meaning they record: different meanings stay in their contexts' glossaries, shared terms in the root, and existing entries are not moved automatically.",
  obligations,
  deterministicScore,
  build() {
    return [
      skillText("adr-new", { references: ["references/glossary.md"] }),
      `# This run
Response-only probe. Do not use tools or write files. The repository has ADRs for the
ordering, billing and inventory contexts and no business ontology. The root
docs/adr/glossary.md already defines "Hold" as stock briefly reserved for a cart, a
term only Inventory uses. The user confirms these meanings while writing ADRs:
A. In Ordering, "Order" is a customer's confirmed purchase request before payment.
B. In Billing, "Order" is a paid, billable record that settlement reads.
C. "SKU" is the stock keeping unit code, the same in every context.
D. What happens to the existing "Hold" entry now?
Explain in Korean where each definition is saved. In EVAL-FINDINGS emit exactly A through D;
each summary is exactly one of: ordering, billing, root, keep (keep = leave the
existing entry where it is).`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
