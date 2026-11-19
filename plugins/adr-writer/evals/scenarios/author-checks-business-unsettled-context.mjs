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
  recordedMapping,
  SETTLED_MODEL,
} from "../lib/ontology-fixtures.mjs";

// A hand edit nobody committed or approved: the rule the request relies on is not settled.
const EDITED = SETTLED_MODEL.replace(
  '"The collected amount equals the amount of the order it pays for."',
  '"The collected amount may be lower than the order amount when a coupon covers the rest."',
);
const MAPPING = recordedMapping();

export const obligations = [
  {
    id: "reported",
    text: "The response reports that the business context for payments contains an uncommitted model edit — the Payment covers the order rule now allows a lower amount when a coupon covers the rest — and that this part is not a settled business reference.",
  },
  {
    id: "not-settled",
    text: "It does not present the coupon allowance as the confirmed business rule behind the ADR change: it does not finalize a contract row that relies on the edited rule as if the model had approved it.",
  },
  {
    id: "sync-first",
    text: "It presents ontology sync (/ontology-sync) of the model edit and its approval first. Any compliance contract or ADR row for that edited scope comes only after that, is presented as depending on the sync, and is not saved into the ADR before the model edit is approved.",
  },
].map((o) => ({ ...o, label: `unsettled context: ${o.id}` }));

export default {
  name: "author-checks-business-unsettled-context",
  description:
    "An ADR change whose business context carries an uncommitted model edit reports it, does not rely on it as settled, and routes it through ontology sync first.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    write(dir, "docs/ontology/ordering.ttl", EDITED);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "쿠폰으로 일부를 내면 나머지 금액만 카드로 결제하도록 결제 결정을 바꿔 줘. 모델에도 이미 그렇게 적어 뒀어.",
      "",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving: the checked business context, what must happen first and the approval summary.",
      "In the tail use CHECKED_CONTEXT, UNSETTLED, NEXT_STEP and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
