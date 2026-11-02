import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ONTOLOGY_PLUGIN_ROOT,
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { validateModel } from "../../../ontology-writer/scripts/process-model-lib.mjs";
import {
  queryContext,
  renderContext,
} from "../../../ontology-writer/scripts/process-model-query.mjs";

const MODEL = readFileSync(
  path.join(ONTOLOGY_PLUGIN_ROOT, "templates", "process", "example.ttl"),
  "utf8",
);
const MAPPING = {
  categories: {
    checkout: {
      feature: "Checkout",
      adrs: [
        {
          path: "docs/adr/checkout/0001-submit-orders.md",
          status: "Accepted (2026-10-01)",
          summary: "orders are submitted from the cart",
        },
      ],
      realizes: ["ordering.submit-order"],
      dependsOn: [],
    },
    "gift-wrap": { feature: "Gift wrapping", adrs: [], dependsOn: [] },
  },
};

export const obligations = [
  {
    id: "checked",
    text: "Before drafting, the response names the business context it checked for the feature — the Order placed hand-off and the steps that react to it — and states it in the approval summary.",
  },
  {
    id: "judgment",
    text: "Because gift-wrap realizes no step, the response judges one of three outcomes with a reason: it realizes an existing step, the model needs a new step (presented as a process change proposal through /process-edit), or it is unrelated to the business flow. Choosing silently or skipping the judgment fails.",
  },
  {
    id: "pending",
    text: "Contract rows that depend on a not-yet-approved model change are marked pending with the awaited business change in business language; they are not presented as approved contracts, and the ADR stays Proposed.",
  },
  {
    id: "value",
    text: "The 3,000 won wrapping fee with its pricing-policy basis stays a requirement value in the ADR; it is not moved into the model.",
  },
  {
    id: "identifiers",
    text: "The proposed ADR body contains no docs/process path and no model element identifiers such as m:ordering.order-placed or urn:ontology-writer:model:.",
  },
].map((o) => ({ ...o, label: `business context: ${o.id}` }));

export default {
  name: "author-checks-business-context",
  description:
    "ADR authoring in a repository with a business process model must check the feature's business context first, judge an unlinked feature three ways, keep values in the ADR and model identifiers out of its body.",
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(dir, "docs/process/ordering.ttl", MODEL);
    const v = validateModel([{ doc: "docs/process/ordering.ttl", text: MODEL }]);
    const context = renderContext(
      queryContext({
        index: v.index,
        mapping: MAPPING,
        findings: v.findings,
        target: { kind: "event", id: "ordering.order-placed" },
      }),
    );
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new gift-wrap",
      "",
      "선물 포장 기능을 결정하려 한다. 주문이 접수되면 포장 요청을 만들고, 포장이 끝나야 배송을 시작한다. 포장비는 3,000원이다 (가격 정책).",
      "",
      "The repository contains docs/process/ordering.ttl. The business-context query for the event the feature reacts to returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show only what you would present before saving: the checked business context, the link judgment and the approval summary.",
      "In the tail use CHECKED_CONTEXT, LINK_JUDGMENT, MODEL_PROPOSAL, PENDING_ROW and ADR_VALUE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
