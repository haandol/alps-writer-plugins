import { skillText, ruleText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "snapshot",
    text: "B must not merge the approved edit of the implemented 20-turn limit alone: the shared branch would then hold an ADR saying 30 turns while its code still enforces 20, and the 20-turn contract the code follows would be undocumented. The edit lands with the code in one change unit and can be reviewed on its branch meanwhile. A may merge because a new ADR without code stays Proposed and says the code does not follow it yet. C lands the ADR edit and its code together. D changes only a tuning value absent from any ADR.",
  },
  {
    id: "bounded",
    text: "Explain in Korean without inventing a new approval step, and do not invoke tools, run tests or claim a merge was performed.",
  },
];

export default {
  name: "impl-lands-contract-with-code",
  description:
    "An edit to an implemented ADR contract reaches the shared branch together with its code, so every snapshot shows each ADR with code that follows it.",
  obligations,
  build() {
    return [
      skillText("adr-impl"),
      `\n# Loaded rule document: docs/adr/authoring-rules.md\n`,
      ruleText("authoring-rules.md"),
      `# This run
Response-only probe. Do not use tools. For each independent case, decide whether the
described pull request may merge into main now.
A. A new ADR for a feature with no code yet, status Proposed. The team wants it on
   main for discussion; implementation starts next sprint.
B. An Accepted ADR's session limit changes from 20 to 30 turns. The ADR edit is
   approved and alone in its pull request; the code still enforces 20 and will be
   changed next week. The team asks to merge the ADR edit now.
C. The same 20 → 30 edit and the code that enforces 30 are in one pull request with
   passing tests.
D. A pull request changes only a cache TTL that no ADR records.
Explain in Korean. In EVAL-FINDINGS emit exactly A through D; each summary is exactly MERGE or HOLD.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
