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
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "reported",
    text: "The response reports that the Accepted payment process has a direct edit that was never synced — the Payment covers the order rule changed by hand — and that this part is not a settled business reference.",
  },
  {
    id: "sync-first",
    text: "It does not describe the coupon allowance as the confirmed business rule, and presents ontology sync (/ontology-sync) of the edit and its approval first. Any compliance contract or ADR row that relies on the edited rule comes only after that, is presented as depending on the sync, and is not saved into the ADR before the process change is approved.",
  },
].map((o) => ({ ...o, label: `unsynced accepted edit: ${o.id}` }));

export default {
  name: "author-checks-business-unsynced-accepted",
  description:
    "ADR authoring over an Accepted process with an unsynced direct edit reports it and routes it through ontology sync first.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir, "settled");
    write(
      dir,
      "docs/ontology/ordering.ttl",
      SETTLED_MODEL.replace(
        '"The collected amount equals the amount of the order it pays for."',
        '"The collected amount may be lower when a coupon covers the rest."',
      ),
    );
    commitFixture(dir, "edit the payment rule by hand");
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "쿠폰으로 일부를 내면 나머지 금액만 카드로 결제하도록 결제 결정을 바꿔 줘. 규칙은 모델에 이미 반영해서 커밋해 뒀어.",
      "",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving.",
      "In the tail use CHECKED_CONTEXT, UNSETTLED and NEXT_STEP tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
