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
  commitFixture,
  CONFIRMATION_ADR,
  EXAMPLE_MODEL,
  ontologyQuery,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// The template model keeps its processes Proposed: their meaning is not yet realized everywhere.
export const obligations = [
  {
    id: "unreflected",
    text: "The Place an order process is Proposed. Before proposing anything, the response checks which model meaning no realizing ADR reflects yet — order confirmation reacting to Payment completed through Confirm once paid when the completed payment belongs to the order.",
  },
  {
    id: "folded",
    text: "The compliance contract that meaning needs is routed to the ontology change approval of that process (ontology-writer's /ontology-sync propagation, asked once there with the other ADR edits it drafts), rather than approved in this ADR's own approval summary or saved into the confirmation ADR on its own.",
  },
  {
    id: "not-saved",
    text: "No compliance contract from that unreflected meaning is saved to the ADR before the process approval.",
  },
].map((o) => ({ ...o, label: `proposed process: ${o.id}` }));

export default {
  name: "author-checks-business-proposed-process",
  description:
    "In a Proposed process's context, compliance contracts from model meaning no ADR reflects yet are asked once in that process's approval summary.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, {
      "docs/adr/checkout/0001-submit-orders.md": CHECKOUT_ADR,
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    write(dir, "docs/ontology/ordering.ttl", EXAMPLE_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "confirmation"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new confirmation",
      "",
      "주문 확정 결정에 확정 알림 문구를 추가해 줘.",
      "",
      "The realizing ADRs of the Place an order process:",
      "docs/adr/checkout/0001-submit-orders.md:",
      "```markdown",
      CHECKOUT_ADR,
      "```",
      "docs/adr/confirmation/0001-confirm-paid.md:",
      "```markdown",
      CONFIRMATION_ADR,
      "```",
      "The business-context query for `confirmation` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving.",
      "In the tail use CHECKED_CONTEXT, UNREFLECTED, APPROVAL and COMPLIANCE_CONTRACT tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
