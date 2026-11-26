import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

// Authored planning probes. Only the inputs are shown to the target; the expected
// outcomes are the obligations below.
const probes = [
  {
    id: "adopted",
    input:
      "billing/0001 and 0003 answer the same pricing question. Both were Accepted; 0003 explicitly replaced the full 10-credit contract with an adopted 20-credit contract. Code and tests enforce 20. There is one credible rejected alternative, with its reason. No numbering request was made.",
  },
  {
    id: "unadopted",
    input:
      "billing/0001 owns an Accepted 10-credit contract. A newer Proposed 0003 suggests 20 credits; its adoption is unknown. Code charges 20. Both address the same scope and question.",
  },
  {
    id: "pending",
    input:
      "billing/0001 owns an Accepted 10-credit contract. The user explicitly adopted Proposed 0003 as its full replacement at 20 credits. Implementation and completion review of 20 are pending; code still charges 10. No numbering request was made.",
  },
  {
    id: "residual",
    input:
      "storage/0001 covers standard and regulated customer retention. 0003 says it supersedes 0001 but defines standard customer retention only. The original regulated contract and its owner cannot be established from the available sources. Both have the same broad retention topic.",
  },
  {
    id: "scopes",
    input:
      "storage/0001 requires 30-day retention for standard accounts; 0003 requires 90-day retention for regulated accounts. They are independently current, have different owned populations, and neither replaces the other.",
  },
  {
    id: "cycle",
    input:
      "storage/0001 says Superseded by 0003, while 0003 says Superseded by 0001. The contracts conflict for the same operation and population. No evidence resolves the replacement order.",
  },
  {
    id: "unchanged-approval",
    input:
      "The user approved the exact prepared merge into billing/0001, deletion of 0003, and log/mapping/link updates. The user selected keeping number gaps. Source contents and destinations still match preparation; the original history is verified. Lint warns of a numbering gap. Independent 0005 is outside the approved write scope.",
  },
  {
    id: "changed-source",
    input:
      "The user approved a prepared merge into billing/0001 and deletion of 0003. Before applying, another task changed the survivor's contract and added a new log entry. A separate storage candidate has unchanged inputs and is ready for preparation.",
  },
  {
    id: "occupied-destination",
    input:
      "The user requested renumbering and approved billing/0005 → billing/0002, along with a merge. A different task created billing/0002 after preparation. The destination contains a different current decision.",
  },
  {
    id: "partial-approval",
    input:
      "Two independent candidates, billing and storage, are ready. The user explicitly approved only billing/0001 absorbing billing/0003, including its log/mapping/link updates. They withheld storage changes and chose to keep gaps. All billing source contents and destinations still match preparation, and original history is verified.",
  },
  {
    id: "interrupted-apply",
    input:
      "An approved billing merge persisted its validated history and survivor before deletion of 0003 failed. Some mapping/link updates may be incomplete. Another task has also modified an unrelated storage document. The agent is about to resume; the actual partial filesystem state has not yet been inspected.",
  },
];

// One obligation per probe, judged on the visible plan rows and their reasons.
export const obligations = [
  {
    id: "coverage",
    text: "The visible plan has exactly one row for each of the eleven snapshot ids, each with a source-grounded reason, and classifies every snapshot independently: a hold in one does not stop or change the others. Preparing a plan does not authorize writes.",
  },
  {
    id: "adopted",
    text: "adopted: prepare the billing rollup with the adopted 20-credit contract as the survivor's current value and Accepted status, because 0003 explicitly replaced 0001's full 10-credit contract and code and tests enforce 20. Only billing/0003 is in the destructive plan and no rename is proposed, since no numbering was requested. The one credible rejected alternative is sufficient; do not hold or demand another.",
  },
  {
    id: "unadopted",
    text: "unadopted: hold. The newer Proposed 0003's adoption is unknown, so code charging 20 does not make 20 the current contract; propose no survivor value or status and no removal or rename.",
  },
  {
    id: "pending",
    text: "pending: prepare with 20 credits as the survivor's current value because the user explicitly adopted 0003 as the full replacement, but keep its status Proposed because implementation and completion review are pending and code still charges 10. Only billing/0003 is in the destructive plan; no rename.",
  },
  {
    id: "residual",
    text: "residual: hold. 0003 claims to supersede 0001 but defines only standard retention, and the regulated contract and its owner cannot be established; do not drop the regulated contract, and propose no survivor value, status, removal or rename.",
  },
  {
    id: "scopes",
    text: "scopes: keep both decisions. The 30-day standard and 90-day regulated retention rules are independently current for different populations and neither replaces the other; propose no merge, removal or rename.",
  },
  {
    id: "cycle",
    text: "cycle: hold. Each document says it is superseded by the other and no evidence resolves the replacement order; propose no survivor value, status, removal or rename.",
  },
  {
    id: "unchanged-approval",
    text: "unchanged-approval: apply exactly the approved merge into billing/0001, removing billing/0003 with its log, mapping and link updates, because the sources and destinations still match preparation and the original history is verified. Keep the number gaps the user selected and do not ask about renumbering despite the lint gap warning; propose no rename and leave the independent 0005 outside the write scope.",
  },
  {
    id: "changed-source",
    text: "changed-source: refresh the billing changeset instead of applying it, because the survivor's contract and its log changed after preparation; put no removal or rename in the plan now, and continue preparing the unchanged independent storage candidate.",
  },
  {
    id: "occupied-destination",
    text: "occupied-destination: refresh instead of applying, because the approved rename destination billing/0002 now holds a different current decision; do not overwrite it, and put no removal or rename in the plan now.",
  },
  {
    id: "partial-approval",
    text: "partial-approval: apply only the approved billing change, billing/0001 absorbing billing/0003 with its log, mapping and link updates, because its sources and destinations still match preparation and history is verified. Leave the withheld storage changes untouched, keep the gaps without asking about renumbering, and propose no rename.",
  },
  {
    id: "interrupted-apply",
    text: "interrupted-apply: refresh by first inspecting the actual partial filesystem state instead of resuming or repeating the deletion; put no removal or rename in the plan now, and do not overwrite the unrelated storage modification made by another task.",
  },
];

export default {
  name: "rollup-reconciles-conflicts",
  description:
    "Rollup preserves adopted contract authority, unfinished targets, residual owners and independent scopes; holds only affected conflicts; preserves requested gaps and refreshes stale or occupied apply targets without overwriting concurrent work. One credible alternative is sufficient. This probe checks plans, not filesystem application.",
  obligations,
  build() {
    return [
      skillText("adr-rollup", {
        references: [
          "skills/adr-rollup/references/candidate-contract.md",
          "skills/adr-rollup/references/references-and-history.md",
          "skills/adr-rollup/references/approval-and-apply.md",
        ],
      }),
      "For each independent snapshot below, decide the next rollup action. Do not edit files or call tools.",
      "Return one JSON code block containing an array with exactly one row per id. Fields: id; action (prepare, apply, keep, hold, refresh); currentValue and status (the proposed survivor value and Accepted/Proposed status, or null unless preparing); removals (IDs to include in the destructive plan now); renames (old:new pairs); reason (source-grounded explanation). Add askRenumber and continueIndependent only where relevant. Preparing does not authorize writes. Classify each snapshot independently; a hold in one must not stop the others.",
      JSON.stringify(probes, null, 2),
      TAIL_SPEC,
    ].join("\n\n");
  },
};
