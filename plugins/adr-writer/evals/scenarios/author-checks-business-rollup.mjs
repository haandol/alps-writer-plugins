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
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

const FIRST = adrDocument({
  title: "Capture card payments",
  status: "Superseded by 0002 (2026-10-05)",
  purpose: "Customers pay by card.",
  decision: "Capture the order total by card.",
  rows: ["An order total is captured by card."],
});
const SECOND = adrDocument({
  number: "0002",
  title: "Capture card payments once per order",
  purpose: "Customers are never charged twice.",
  decision: "Capture the order total by card once per order.",
  rows: ["An order is captured at most once; a repeated capture returns the first result."],
});
const record = (path, status, summary) => ({ path, status, summary });
const MAPPING = settledMapping({
  payments: {
    feature: "Payments",
    adrs: [
      record(
        "docs/adr/payments/0001-capture-card.md",
        "Superseded by 0002 (2026-10-05)",
        "card capture",
      ),
      record(
        "docs/adr/payments/0002-capture-once.md",
        "Accepted (2026-10-05)",
        "card payments are captured once",
      ),
    ],
    realizes: ["payment.request-payment", "payment.capture-payment"],
    dependsOn: [],
  },
  "gift-wrap": {
    feature: "Gift wrapping",
    adrs: [
      record("docs/adr/gift-wrap/0001-wrap.md", "Accepted (2026-10-01)", "orders can be wrapped"),
    ],
    realizes: [],
    dependsOn: [],
  },
});

export const obligations = [
  {
    id: "keeps-links",
    text: "Rolling up the payments ADR chain keeps the payments category, its realizes links (Request the payment and Capture the payment) and the gift-wrap category's empty realizes record exactly as they are.",
  },
  {
    id: "no-query",
    text: "The rollup does not query or re-judge the business context, because it changes no meaning or category.",
  },
].map((o) => ({ ...o, label: `rollup: ${o.id}` }));

export default {
  name: "author-checks-business-rollup",
  description:
    "A rollup keeps the category, its realization links and any empty record unchanged, without querying the business context.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, {
      "docs/adr/payments/0001-capture-card.md": FIRST,
      "docs/adr/payments/0002-capture-once.md": SECOND,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      skillText("adr-rollup", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-rollup payments",
      "",
      "docs/adr/.mapping.json:",
      "```json",
      JSON.stringify(MAPPING, null, 2),
      "```",
      "docs/adr/payments/0001-capture-card.md:",
      "```markdown",
      FIRST,
      "```",
      "docs/adr/payments/0002-capture-once.md:",
      "```markdown",
      SECOND,
      "```",
      "Do not call tools or write files. Show the rollup plan and the resulting index entries you would propose for approval.",
      "In the tail use LINKS, EMPTY_RECORD and QUERY tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
