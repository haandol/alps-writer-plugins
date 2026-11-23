import type { DocumentService } from "../src/tools/documents/service.js";
import { TemplateRegistry } from "../src/tools/templates/registry.js";

/** One business-wording Context diagram, the only C4 level Lite Section 3.2 accepts. */
export function liteContextDiagram(): string {
  return `\`\`\`mermaid
C4Context
title Business Context for Guest Cart Merge
Person(shopper, "Shopper", "Collects products and buys them")
System(store, "Online Store", "Keeps each shopper's cart")
Rel(shopper, store, "Collects products and signs in at")
\`\`\``;
}

/** Lite subsections that define BR-1, FR-1, NFR-1, EC-1, KPI-1 and TM-1 exactly once. */
export const COMPLETE_LITE_SUBSECTIONS: [number, string, string, string][] = [
  [1, "1", "Target User and Core Problem", "Guest shoppers lose their cart at sign-in."],
  [1, "2", "Intent and Desired Outcome", "Shoppers keep their cart and finish buying."],
  [
    2,
    "1",
    "Business Requirements",
    "| ID | Business requirement | Required | Pass/fail criterion | Basis |\n|----|----|----|----|----|\n| BR-1 | Quantities of the same product are summed on merge | Required | 2 + 1 shirts show as 3 | Product owner |",
  ],
  [
    3,
    "1",
    "Functional Requirements",
    "**FR-1: Merge the guest cart on sign-in** (Required)\n\n- Rules: BR-1\n- Failure handling: EC-1\n- Given 2 guest shirts and 1 member shirt, When the guest signs in, Then the cart shows 3 shirts.",
  ],
  [3, "2", "Business Context Diagram", liteContextDiagram()],
  [
    4,
    "1",
    "Non-Functional Requirements",
    "| ID | Quality expectation | Threshold | Scope | Required | Basis |\n|----|----|----|----|----|----|\n| NFR-1 | The merged cart appears promptly | Within 2 seconds for 95% of sign-ins | FR-1 | Required | Checkout goal |",
  ],
  [
    5,
    "1",
    "Edge Cases",
    "| ID | Situation | Related | Expected business outcome | Required |\n|----|----|----|----|----|\n| EC-1 | The merge is retried | FR-1, BR-1 | Quantities are summed once | Required |",
  ],
  [
    6,
    "1",
    "KPIs and Tension Metrics",
    "Release acceptance: every Required BR, FR, NFR and EC passes.\n\n| ID | KPI | Calculation | Use | Tension decision |\n|----|----|----|----|----|\n| KPI-1 | Guest checkout recovery | checkouts / guest sign-ins | Monitoring | TM-1 |\n\n| ID | Tension metric | Calculation | Protects |\n|----|----|----|----|\n| TM-1 | Cart complaint rate | complaints / guest sign-ins | KPI-1 |",
  ],
  [
    8,
    "1",
    "Demo Scenario",
    "| Step | User action | Visible expected result | Shows |\n|----|----|----|----|\n| 1 | Signs in | 3 shirts | FR-1 |\n| 2 | Retries sign-in | Still 3 shirts | FR-1, EC-1 |",
  ],
];

/** Save every required Lite subsection on an initialized Lite document. */
export function saveCompleteLite(service: DocumentService): void {
  for (const [section, id, title, content] of COMPLETE_LITE_SUBSECTIONS) {
    service.saveSection(section, id, title, content);
  }
}

/** The two C4 levels Full Section 4.1 requires. */
const FULL_SYSTEM_DIAGRAMS = `\`\`\`mermaid
C4Context
title Guest Cart Merge
Person(shopper, "Shopper")
System(store, "Online Store")
Rel(shopper, store, "Buys at")
\`\`\`

\`\`\`mermaid
C4Container
title Online Store
Container(web, "Web App", "SPA")
\`\`\``;

/**
 * Write every required Full subsection and Feature F1 so only Lite coverage can keep the
 * document incomplete; `purpose` becomes 1.1 and usually carries `Source requirements:`.
 */
export function saveCompleteFull(service: DocumentService, purpose: string): void {
  const registry = new TemplateRegistry();
  for (let section = 1; section <= 9; section++) {
    for (const { id, title, required } of registry.expectedSubsections(section)) {
      if (!required) continue;
      const content =
        id === "1.1"
          ? purpose
          : id === "4.1"
            ? FULL_SYSTEM_DIAGRAMS
            : id === "5.1"
              ? "| ID | Feature | Priority |\n|----|----|----|\n| F1 | Guest cart merge | Must-Have |"
              : `${title} body`;
      service.saveSection(section, id.slice(String(section).length + 1), title, content);
    }
  }
  service.saveSection(7, "1", "Guest cart merge", "Feature ID: F1\n\nFeature body");
}
