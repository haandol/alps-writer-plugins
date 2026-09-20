import author, { delegationPrompt } from "./author-delegation-is-not-approval.mjs";
import { alpsSkillText } from "../lib/harness.mjs";

export default {
  name: "feature-handoff-delegation-is-not-approval",
  description: "Feature handoff preserves protected choices when the user delegates a proposal.",
  build() {
    return delegationPrompt(
      alpsSkillText("feature-to-adr", { references: ["references/requirement-delegation.md"] }),
      "whatever is reasonable",
    );
  },
  score: author.score,
};
