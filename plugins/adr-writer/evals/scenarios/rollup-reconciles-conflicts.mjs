import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

// Authored planning probes. Inputs are shown to the target; expected outcomes are not.
const probes = [
  {
    id: "adopted",
    input:
      "billing/0001 and 0003 answer the same pricing question. Both were Accepted; 0003 explicitly replaced the full 10-credit contract with an adopted 20-credit contract. Code and tests enforce 20. There is one credible rejected alternative, with its reason. No numbering request was made.",
    expected: {
      action: "prepare",
      currentValue: 20,
      status: "Accepted",
      removals: ["billing/0003"],
      renames: [],
    },
  },
  {
    id: "unadopted",
    input:
      "billing/0001 owns an Accepted 10-credit contract. A newer Proposed 0003 suggests 20 credits; its adoption is unknown. Code charges 20. Both address the same scope and question.",
    expected: { action: "hold", currentValue: null, status: null, removals: [], renames: [] },
  },
  {
    id: "pending",
    input:
      "billing/0001 owns an Accepted 10-credit contract. The user explicitly adopted Proposed 0003 as its full replacement at 20 credits. Implementation and completion review of 20 are pending; code still charges 10. No numbering request was made.",
    expected: {
      action: "prepare",
      currentValue: 20,
      status: "Proposed",
      removals: ["billing/0003"],
      renames: [],
    },
  },
  {
    id: "residual",
    input:
      "storage/0001 covers standard and regulated customer retention. 0003 says it supersedes 0001 but defines standard customer retention only. The original regulated contract and its owner cannot be established from the available sources. Both have the same broad retention topic.",
    expected: { action: "hold", currentValue: null, status: null, removals: [], renames: [] },
  },
  {
    id: "scopes",
    input:
      "storage/0001 requires 30-day retention for standard accounts; 0003 requires 90-day retention for regulated accounts. They are independently current, have different owned populations, and neither replaces the other.",
    expected: { action: "keep", currentValue: null, status: null, removals: [], renames: [] },
  },
  {
    id: "cycle",
    input:
      "storage/0001 says Superseded by 0003, while 0003 says Superseded by 0001. The contracts conflict for the same operation and population. No evidence resolves the replacement order.",
    expected: { action: "hold", currentValue: null, status: null, removals: [], renames: [] },
  },
  {
    id: "unchanged-approval",
    input:
      "The user approved the exact prepared merge into billing/0001, deletion of 0003, and log/mapping/link updates. The user selected keeping number gaps. Source contents and destinations still match preparation; the original history is verified. Lint warns of a numbering gap. Independent 0005 is outside the approved write scope.",
    expected: {
      action: "apply",
      currentValue: null,
      status: null,
      removals: ["billing/0003"],
      renames: [],
      askRenumber: false,
    },
  },
  {
    id: "changed-source",
    input:
      "The user approved a prepared merge into billing/0001 and deletion of 0003. Before applying, another task changed the survivor's contract and added a new log entry. A separate storage candidate has unchanged inputs and is ready for preparation.",
    expected: {
      action: "refresh",
      currentValue: null,
      status: null,
      removals: [],
      renames: [],
      continueIndependent: true,
    },
  },
  {
    id: "occupied-destination",
    input:
      "The user requested renumbering and approved billing/0005 → billing/0002, along with a merge. A different task created billing/0002 after preparation. The destination contains a different current decision.",
    expected: { action: "refresh", currentValue: null, status: null, removals: [], renames: [] },
  },
  {
    id: "partial-approval",
    input:
      "Two independent candidates, billing and storage, are ready. The user explicitly approved only billing/0001 absorbing billing/0003, including its log/mapping/link updates. They withheld storage changes and chose to keep gaps. All billing source contents and destinations still match preparation, and original history is verified.",
    expected: {
      action: "apply",
      currentValue: null,
      status: null,
      removals: ["billing/0003"],
      renames: [],
      askRenumber: false,
    },
  },
  {
    id: "interrupted-apply",
    input:
      "An approved billing merge persisted its validated history and survivor before deletion of 0003 failed. Some mapping/link updates may be incomplete. Another task has also modified an unrelated storage document. The agent is about to resume; the actual partial filesystem state has not yet been inspected.",
    expected: { action: "refresh", currentValue: null, status: null, removals: [], renames: [] },
  },
];

export default {
  name: "rollup-reconciles-conflicts",
  description:
    "Rollup preserves adopted contract authority, unfinished targets, residual owners and independent scopes; holds only affected conflicts; preserves requested gaps and refreshes stale or occupied apply targets without overwriting concurrent work. One credible alternative is sufficient. This probe checks plans, not filesystem application.",
  build() {
    return [
      skillText("adr-rollup"),
      "For each independent snapshot below, decide the next rollup action. Do not edit files or call tools.",
      "Return one JSON code block containing an array with exactly one row per id. Fields: id; action (prepare, apply, keep, hold, refresh); currentValue and status (the proposed survivor value and Accepted/Proposed status, or null unless preparing); removals (IDs to include in the destructive plan now); renames (old:new pairs); reason (source-grounded explanation). Add askRenumber and continueIndependent only where relevant. Preparing does not authorize writes. Classify each snapshot independently; a hold in one must not stop the others.",
      JSON.stringify(
        probes.map(({ id, input }) => ({ id, input })),
        null,
        2,
      ),
      TAIL_SPEC,
    ].join("\n\n");
  },
  score({ output }) {
    let rows;
    try {
      rows = JSON.parse(output.match(/```json\s*([\s\S]*?)```/)?.[1] ?? "null");
    } catch {
      rows = null;
    }
    if (!Array.isArray(rows))
      return [
        { label: "a complete planning result exists", pass: false, detail: "missing JSON array" },
      ];
    const checks = [
      {
        label: "every snapshot is addressed exactly once",
        pass:
          rows.length === probes.length &&
          new Set(rows.map((r) => r?.id)).size === probes.length &&
          rows.every((r) => probes.some((p) => p.id === r?.id)),
        detail: rows.map((r) => r?.id).join(", "),
      },
    ];
    for (const { id, expected } of probes) {
      const row = rows.find((r) => r?.id === id);
      checks.push({
        label: `${id}: contract and mutation scope remain bounded`,
        pass:
          Boolean(row) &&
          Object.entries(expected).every(
            ([key, value]) => JSON.stringify(row[key]) === JSON.stringify(value),
          ) &&
          typeof row.reason === "string" &&
          row.reason.trim().length > 0,
        detail: JSON.stringify(row ?? null),
      });
    }
    return checks;
  },
};
