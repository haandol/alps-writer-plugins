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

const GIFT = adrDocument({
  title: "Offer gift wrapping",
  purpose: "Customers can send an order as a gift.",
  decision: "An order can be gift wrapped before shipping for a flat fee.",
  rows: ["The wrapping fee is 3,000 won per order (pricing policy)."],
});
const MAPPING = settledMapping({
  "gift-wrap": {
    feature: "Gift wrapping",
    adrs: [
      {
        path: "docs/adr/gift-wrap/0001-offer-wrapping.md",
        status: "Accepted (2026-10-01)",
        summary: "orders can be gift wrapped",
      },
    ],
    dependsOn: [],
  },
});

export const obligations = [
  {
    id: "no-judgment",
    text: "Gift wrapping is being retired without a replacement. Although it realizes no business step, the response does not present the three-way link judgment (an existing step, a new step, or unrelated) and does not propose an ontology change for it.",
  },
  {
    id: "retirement",
    text: "It proceeds to the deprecation's approval summary for the gift-wrapping ADR, with nothing changed before approval.",
  },
].map((o) => ({ ...o, label: `deprecate without replacement: ${o.id}` }));

export default {
  name: "author-checks-business-deprecate-unreplaced",
  description:
    "Deprecating an unlinked feature without a replacement skips the link judgment and goes to the deprecation approval.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/gift-wrap/0001-offer-wrapping.md": GIFT });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    const context = ontologyQuery(dir, ["--category", "gift-wrap"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new gift-wrap",
      "",
      "선물 포장 서비스는 이번 달로 종료해. 대체할 기능은 없어. 기존 결정을 폐기(deprecated) 처리해 줘.",
      "",
      "docs/adr/gift-wrap/0001-offer-wrapping.md:",
      "```markdown",
      GIFT,
      "```",
      "The business-context query for `gift-wrap` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving.",
      "In the tail use CHECKED_CONTEXT, LINK_JUDGMENT and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
