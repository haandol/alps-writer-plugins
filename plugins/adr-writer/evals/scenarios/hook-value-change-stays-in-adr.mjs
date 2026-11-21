import { hookContext, seedIndexedAdrs, seedRuleDocs, TAIL_SPEC, write } from "../lib/harness.mjs";
import {
  commitFixture,
  ontologyDirective,
  RETRY_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

// The counterpart of hook-business-rule-change-goes-upward: the same directives, but the
// request changes only a value inside the capture step, which the realizing ADR owns.
export const obligations = [
  {
    id: "adr-only",
    text: "The response treats raising the declined-card retry limit from 3 to 5 as a change to a requirement value the payments ADR owns: it plans an edit-in-place of that ADR contract, confirmed with the user before implementation, and does not propose an ontology change, run /ontology-edit or plan any edit of the business model for it. Proposing, or waiting on, an ontology change for this value fails. Naming /ontology-edit only as a contingency in case the business-context query shows that a business rule's meaning would change is acceptable, because the value stays ADR-owned only while every touched rule keeps its meaning.",
  },
  {
    id: "no-model-value",
    text: "It does not add the retry limit, or any other number or retry condition, to the docs/ontology model.",
  },
  {
    id: "context-checked",
    text: "Before finalizing the ADR change it checks the payments feature's business context through ontology-writer's query command named by the session directive (a check that finds no affected business rule is enough); it does not read or parse the docs/ontology documents itself.",
  },
].map((o) => ({ ...o, label: `value change stays in ADR: ${o.id}` }));

export default {
  name: "hook-value-change-stays-in-adr",
  description:
    "With only the session directives, a conversational request that changes an in-step requirement value stays in the ADR without an ontology proposal.",
  obligations,
  // Only the shipped SessionStart directives reach the agent; no skill body is loaded.
  directiveOnly: true,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": RETRY_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    const adrDirective = hookContext(dir, mapping);
    commitFixture(dir);
    return [
      "The session started with these SessionStart directives:",
      "```text",
      adrDirective,
      "",
      ontologyDirective(dir),
      "```",
      `\n---\n\n# This run`,
      "카드가 거절된 주문의 결제 재시도 한도를 3회에서 5회로 늘려 줘.",
      "",
      "Do not call tools or write files. List, in order, the steps you take for this request and the first artifact you would change, and stop where you would need a command's output or the user's decision.",
      "In the tail use ROUTE (ONTOLOGY_FIRST or ADR_ONLY) and FIRST_CHANGE tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
