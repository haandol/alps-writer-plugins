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
  CONFIRMATION_ADR,
  ontologyQuery,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "losing-steps",
    text: "The approval summary for superseding the order-confirmation ADR shows the business step that loses its realizing feature — Confirm the order (reacting to Payment completed through Confirm once paid) — unless the replacement is linked to it, and asks how its realization continues.",
  },
  {
    id: "checked",
    text: "It checks and names the business context of the confirmation feature before the approval summary.",
  },
  {
    id: "approval",
    text: "Nothing is deprecated, superseded or relinked before the user approves; the index's realizes links are not changed in the response.",
  },
].map((o) => ({ ...o, label: `supersede: ${o.id}` }));

export default {
  name: "author-checks-business-supersede",
  description:
    "Superseding a realizing ADR shows, in its approval summary, the business steps that would lose their realizing feature.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, {
      "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "confirmation"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new fulfillment",
      "",
      "주문 확정 결정은 이제 출고 팀의 새 결정으로 대체할 거야. 새 결정은 출고 준비가 끝나면 주문을 확정한다. 기존 주문 확정 ADR은 대체(superseded) 처리해 줘.",
      "",
      "docs/adr/confirmation/0001-confirm-paid.md:",
      "```markdown",
      CONFIRMATION_ADR,
      "```",
      "The business-context query for `confirmation` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving: the checked business context and the approval summary.",
      "In the tail use CHECKED_CONTEXT, LOSING_STEP and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
