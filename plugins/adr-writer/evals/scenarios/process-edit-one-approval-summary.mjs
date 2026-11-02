import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ONTOLOGY_PLUGIN_ROOT,
  ontologySkillText,
  ruleText,
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  indexGraph,
  parseTurtle,
  validateModel,
} from "../../../ontology-writer/scripts/process-model-lib.mjs";
import { impactSummary } from "../../../ontology-writer/scripts/process-model-align.mjs";

const MODEL = readFileSync(
  path.join(ONTOLOGY_PLUGIN_ROOT, "templates", "process", "example.ttl"),
  "utf8",
).replaceAll('pm:status "Proposed"', 'pm:status "Accepted (2026-10-01)"');
const DRAFT = MODEL.replace(
  '"Every placed order asks the customer to pay."',
  '"Every placed order asks the customer to pay, except orders fully covered by store credit."',
).replace(
  '"The order has no payment yet."',
  '"The order has no payment yet and is not covered by store credit."',
);
const MAPPING = {
  categories: {
    checkout: {
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
    payments: {
      adrs: [
        {
          path: "docs/adr/payments/0001-card-capture.md",
          status: "Accepted (2026-10-01)",
          summary: "card payments are captured once per order",
        },
      ],
      realizes: ["payment.request-payment"],
      dependsOn: [],
    },
    confirmation: {
      adrs: [
        {
          path: "docs/adr/confirmation/0001-confirm-paid.md",
          status: "Accepted (2026-10-01)",
          summary: "paid orders are confirmed",
        },
      ],
      realizes: ["ordering.confirm-order"],
      dependsOn: [],
    },
  },
};

export const obligations = [
  {
    id: "one-summary",
    text: "The response presents one approval summary containing the model's semantic diff in business language, the affected features found through the ADR index, the index-link changes (or that there are none), and the processes that become Proposed.",
  },
  {
    id: "adr-diffs",
    text: "For each affected ADR the summary shows a semantic diff of Decision, Decision Drivers, requirement contract and Consequences together with its regeneration checklist; approving it approves exactly those revisions.",
  },
  {
    id: "before-approval",
    text: "Nothing is written to docs/process, the ADR index, the glossary or ADRs before approval; the response says it will apply with the base hash and rerun the comparison if anything changed.",
  },
  {
    id: "resolution",
    text: "The model change keeps relation and meaning only; any exact store-credit threshold or detailed condition is left to the realizing ADR rather than written into the policy.",
  },
  {
    id: "cascade",
    text: "After approval the affected ADRs are edited in place as Proposed and implemented through /adr-impl in prerequisite order, followed by an alignment review; the process does not become Accepted before that.",
  },
].map((o) => ({ ...o, label: `process edit: ${o.id}` }));

export default {
  name: "process-edit-one-approval-summary",
  description:
    "/process-edit must gather a business change into one approval summary — semantic diff, affected features, link changes, processes becoming Proposed and per-ADR semantic diffs with regeneration checklists — and write nothing before approval.",
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(dir, "docs/process/ordering.ttl", MODEL);
    const after = validateModel([{ doc: "draft/ordering.ttl", text: DRAFT }]);
    const impact = impactSummary({
      before: indexGraph(parseTurtle(MODEL).triples),
      after: after.index,
      mapping: MAPPING,
      glossary: null,
    });
    return [
      ontologySkillText("process-edit", { references: ["references/process-model.md"] }),
      ruleText("concepts.md"),
      `\n---\n\n# This run`,
      "/process-edit 스토어 적립금으로 전액 결제되는 주문은 결제 요청 없이 진행하도록 바꿔 줘.",
      "",
      "You already prepared the draft and ran impact. Its JSON result:",
      "```json",
      JSON.stringify(impact, null, 2),
      "```",
      "Do not call tools or write files. Show only the approval summary you would present.",
      "In the tail use SEMANTIC_DIFF, AFFECTED_FEATURE, LINK_CHANGE, BECOMES_PROPOSED, ADR_DIFF and NOT_YET_WRITTEN tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
