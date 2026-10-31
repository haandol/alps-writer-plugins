import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PLUGIN_ROOT,
  ruleText,
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import { indexGraph, parseTurtle } from "../../scripts/process-model-lib.mjs";
import { alignmentPlan } from "../../scripts/process-model-align.mjs";

const MODEL = readFileSync(path.join(PLUGIN_ROOT, "templates", "process", "example.ttl"), "utf8");
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
  },
};
const EVIDENCE = `Available evidence:
- Unit tests of each feature pass; in the confirmation tests the payment feature is replaced by a stub that returns "completed".
- Every realizing ADR has a compliance contract for its hand-offs.
- Nobody has run the features together through their entry points yet.`;

export const obligations = [
  {
    id: "not-accepted",
    text: "The response does not make the process Accepted from unit tests with stubbed realizing features; it states that the criteria are unverified until executed.",
  },
  {
    id: "scope-first",
    text: "It writes the execution scope for each criterion — the system steps from start condition to result, steps of other processes only when current or verified together, and each entry point — before running anything.",
  },
  {
    id: "doubles",
    text: "It allows doubles only for declared outside organizations or systems (such as the payment provider performing the outside-system capture step), never for a realizing feature, and records inputs given for outside-system steps.",
  },
  {
    id: "deferred",
    text: "It treats the hand-offs with the still-Proposed payment process as deferred unless that process is verified in the same review, and runs them when that process becomes current.",
  },
].map((o) => ({ ...o, label: `process align: ${o.id}` }));

export default {
  name: "process-align-requires-execution",
  description:
    "/process-align must not make a process current from per-feature unit tests; observation criteria need the realizing features executed through real entry points with doubles only for declared outside systems.",
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(dir, "docs/process/ordering.ttl", MODEL);
    const plan = alignmentPlan({
      index: indexGraph(parseTurtle(MODEL).triples),
      mapping: MAPPING,
      processId: "ordering.place-order",
    });
    return [
      skillText("process-align", { references: ["references/process-model.md"] }),
      ruleText("concepts.md"),
      `\n---\n\n# This run`,
      "/process-align ordering.place-order",
      "",
      "The align command returned:",
      "```json",
      JSON.stringify(plan, null, 2),
      "```",
      EVIDENCE,
      "",
      "Do not call tools or write files. State your verdict and what the review must do next.",
      "In the tail use VERDICT, EXECUTION_SCOPE, DOUBLE, DEFERRED tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
