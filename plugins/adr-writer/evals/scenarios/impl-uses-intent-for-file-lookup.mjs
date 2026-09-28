import { intentDiscretionScenario } from "../lib/intent-discretion.mjs";

const scenario = intentDiscretionScenario({
  name: "impl-uses-intent-for-file-lookup",
  purpose:
    "Help a human find a known file's review findings quickly by its path in a large inventory, while retaining the human's control over edits.",
  groupingChoices: ["ALPHABETICAL"],
  groupingObligation:
    "For A choose alphabetical grouping without routine approval because the supplied purpose is locating a known file by its path. Do not impose impact-first ordering merely because risk triage is a common review goal. Ground the choice in this purpose, not only in the neighboring convention.",
});

export const { obligations, deterministicScore } = scenario;
export default scenario;
