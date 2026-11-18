import {
  hookContext,
  ruleText,
  seedIndexedAdrs,
  seedMapping,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { EXAMPLE_MODEL, ontologyDirective } from "../lib/ontology-fixtures.mjs";

const MAPPING = {
  categories: {
    confirmation: {
      feature: "Order confirmation",
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
    id: "unlocated",
    text: "For the first task, whose place in the business is unknown, the agent enters at the bounded-context layer — `query --overview`, optionally with `--search` to find candidate contexts — picks the relevant context, and then queries inside it (`query --context <id>`, with `--search` when useful), instead of reading every context's internal detail or the model files.",
  },
  {
    id: "known",
    text: "For the second task, whose step is already known, it queries that step directly (`query --step ordering.confirm-order`, or its process) without first touring the overview.",
  },
  {
    id: "contract",
    text: "It treats query and search results as locating business context, not as the implementation contract: before changing code it reads the contract of the realizing ADR the query names (for the second task, the order-confirmation feature's ADR) and uses the business context only to check for contradictions.",
  },
].map((o) => ({ ...o, label: `entry point: ${o.id}` }));

export default {
  name: "ontology-query-chooses-entry-point",
  description:
    "Development work enters the business context at the smallest known scope: overview then a scoped search when unlocated, a direct detail query when known.",
  obligations,
  build(dir) {
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(dir, "docs/ontology/ordering.ttl", EXAMPLE_MODEL);
    const directive = ontologyDirective(dir);
    if (!/--overview/.test(directive)) throw new Error("the fixture must give the query directive");
    // A real session loads both installed plugins' session directives.
    const adrDirective = hookContext(dir, MAPPING);
    return [
      // The project uses ADR Writer, so its seeded rule document is background context.
      ruleText("concepts.md"),
      "# Session start",
      "The client loaded these directives at the start of the session:",
      "```text",
      adrDirective,
      "",
      directive,
      "```",
      "# This run",
      "The user asks for two code changes:",
      "1. 카드가 거절된 뒤 다시 결제를 시도할 수 있게 하고 싶어. 어디부터 봐야 할지 모르겠어.",
      "2. ordering.confirm-order 단계를 실현하는 주문 확정 코드에서 확정 알림 문구를 바꿔 줘.",
      "Do not call tools. For each task, list the business-context queries you would run, in order, and what you would read before changing code.",
      "In the tail use TASK1_QUERIES, TASK2_QUERIES and CONTRACT tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
