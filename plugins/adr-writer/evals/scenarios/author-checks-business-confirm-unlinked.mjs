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

// Gift wrapping has no index record yet: the link judgment is still the user's to confirm.
const MAPPING = settledMapping({
  "gift-wrap": { feature: "Gift wrapping", adrs: [], dependsOn: [] },
});

export const obligations = [
  {
    id: "judgment",
    text: "Because gift wrapping realizes no step, the response presents the link judgment (an existing step, a new step through an ontology change proposal, or unrelated) with its reason and asks the user to confirm it.",
  },
  {
    id: "nothing-before-approval",
    text: "Before the user confirms, it records nothing: no `realizes` link, no empty `realizes: []` record and no ADR file is written; the approval summary is presented instead.",
  },
].map((o) => ({ ...o, label: `confirm unlinked: ${o.id}` }));

export default {
  name: "author-checks-business-confirm-unlinked",
  description:
    "An unlinked feature's link judgment and empty record wait for the user's confirmation; nothing is written before approval.",
  obligations,
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
      "선물 포장 기능을 결정하려 한다. 주문에 선물 포장을 추가할 수 있고 포장비는 3,000원이다 (가격 정책).",
      "",
      "The business-context query for `gift-wrap` returned:",
      "```text",
      context,
      "```",
      "Use the available fixture tools as you normally would. The user has not approved anything in this conversation yet.",
      "In the tail use LINK_JUDGMENT, APPROVAL and WRITES tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
