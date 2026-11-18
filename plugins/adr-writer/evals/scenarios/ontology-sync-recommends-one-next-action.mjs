import { ontologySkillText, ruleText, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "ontology-sync-recommends-one-next-action",
  description:
    "A read-only status conversation about several proposed processes ends with one actionable recommendation.",
  obligations: [
    {
      id: "one-last-action",
      text: "The final user-facing recommendation selects exactly one next action for one process. Future steps or an alternative process do not follow it. A question inviting that same action is allowed.",
    },
    {
      id: "specific",
      text: "The action names the known process loan.return-fee, its missing fee-requested hand-off, and the intended output: an approval-ready model/criterion amendment linking the return to the fee request. A specific natural-language action or /ontology-edit with that target is acceptable.",
    },
    {
      id: "authority",
      text: "The answer neither claims end-to-end verification or promotion nor edits the model. A separate unresolved account-closure policy does not obscure the executable next action.",
    },
  ],
  build() {
    return [
      ontologySkillText("ontology-sync", {
        references: ["references/workflow-readiness.md", "references/next-action.md"],
      }),
      ruleText("concepts.md"),
      "# Status request",
      "There are 17 Proposed processes in a fictional lending service. A read-only readiness review has already verified that loan.return-fee has implemented ADRs and a locally reproducible fee calculation. Its observation criterion currently covers completion only: the fee-requested hand-off to billing is missing from every criterion. Preparing that narrow model amendment can start now. Membership closure separately needs a policy owner who is unavailable. No amendment or actual process alignment has been approved or executed.",
      "사용자: 여러 프로세스가 Proposed인데, 지금 제가 무엇을 하면 되나요? 검토 결과로 답해 주세요.",
      TAIL_SPEC,
    ].join("\n\n");
  },
};
