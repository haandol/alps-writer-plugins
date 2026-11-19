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

const ADR = adrDocument({
  number: "0002",
  title: "Announce a completed payment once",
  status: "Proposed",
  purpose: "Order confirmation learns about a completed payment exactly once.",
  decision: "After a successful capture, announce Payment completed with the order id.",
  rows: [
    "A successful capture announces Payment completed once, carrying the order id.",
    "A declined card announces nothing.",
  ],
});
const MAPPING = settledMapping();
MAPPING.categories.payments.adrs.push({
  path: "docs/adr/payments/0002-announce-payment.md",
  status: "Proposed",
  summary: "a successful capture announces Payment completed once",
});

export const obligations = [
  {
    id: "no-wait",
    text: "The completion review passed and the tests are green, so the response promotes the ADR to Accepted with the deterministic status transition right away; it does not stop to query the business context again or wait for a business-context check before the transition.",
  },
  {
    id: "transition",
    text: "It names the transition command for docs/adr/payments/0002-announce-payment.md (adr-status-transition.mjs with an Accepted (YYYY-MM-DD) Status) rather than editing the Status by hand.",
  },
].map((o) => ({ ...o, label: `automatic transition: ${o.id}` }));

export default {
  name: "impl-reports-business-auto-transition",
  description:
    "The automatic Proposed → Accepted transition after a passing completion review does not wait for a business-context query.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { "docs/adr/payments/0002-announce-payment.md": ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      skillText("adr-impl", {
        references: ["references/business-context.md", "skills/adr-impl/references/completion.md"],
      }),
      `\n---\n\n# This run`,
      "/adr-impl docs/adr/payments/0002-announce-payment.md",
      "",
      "Today is 2026-11-19. Implementation, the full test command and the selected refactor pass are complete. The completion review (`/adr-impl-review --mode standard`) just returned PASS with every contract row PROVEN and its validated HTML report. The business context was checked in the implementation plan earlier in this session.",
      'Its docs/adr/.mapping.json record: {"path": "docs/adr/payments/0002-announce-payment.md", "status": "Proposed", "summary": "a successful capture announces Payment completed once"}. The decision and contract did not change during implementation.',
      "Do not call tools or write files. State the next step you take now and the exact command.",
      "In the tail use NEXT_STEP and COMMAND tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
