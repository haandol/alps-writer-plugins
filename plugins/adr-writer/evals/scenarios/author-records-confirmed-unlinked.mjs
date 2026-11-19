import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  adrDocument,
  commitFixture,
  ontologyQuery,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

const ADR_PATH = "docs/adr/gift-wrap/0001-offer-gift-wrapping.md";
const ADR = adrDocument({
  title: "Offer gift wrapping",
  status: "Proposed",
  purpose: "A customer can have an order gift-wrapped.",
  decision: "Offer gift wrapping as an order option with a fixed fee.",
  rows: ["Gift wrapping adds a fee of 3,000 KRW to the order."],
});
const MAPPING = settledMapping({
  "gift-wrap": { feature: "Gift wrapping", adrs: [], dependsOn: [] },
});

export const obligations = [
  {
    id: "empty-record",
    text: "After the user confirmed that gift wrapping is unrelated to the business flow, the saved docs/adr/.mapping.json entry for gift-wrap records `realizes: []` (an empty realization record) together with the approved ADR's record.",
  },
  {
    id: "no-link",
    text: "It records no realization link for gift-wrap and writes the approved ADR to docs/adr/gift-wrap/0001-offer-gift-wrapping.md as Proposed.",
  },
].map((o) => ({ ...o, label: `confirmed unlinked: ${o.id}` }));

export default {
  name: "author-records-confirmed-unlinked",
  agentTimeoutMs: 600_000, // writing and checking the approved ADR and index takes several tool calls
  description:
    "Once the user confirms an unlinked feature is unrelated, the approved save records its empty realization record.",
  obligations,
  artifactPaths: ["docs/adr/.mapping.json", ADR_PATH],
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "gift-wrap"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new gift-wrap",
      "",
      "사용자: 주문에 선물 포장을 추가할 수 있고 포장비는 3,000원이다 (가격 정책).",
      "",
      "The business-context query for `gift-wrap` returned:",
      "```text",
      context,
      "```",
      "You presented this approval summary:",
      "- Business context checked: gift wrapping realizes no step of Place an order or Take a payment.",
      "- Link judgment: unrelated to the business flow — wrapping is an order option that no step, hand-off or rule of the ordering or payment processes depends on. Please confirm.",
      `- New ADR ${ADR_PATH} (Proposed):`,
      "```markdown",
      ADR,
      "```",
      "사용자: 승인. 선물 포장은 업무 흐름과 무관한 걸로 확인할게.",
      "",
      "Use the available fixture tools to save the approved result now.",
      "In the tail use SAVED and INDEX tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
