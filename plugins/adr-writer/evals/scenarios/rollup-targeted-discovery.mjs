import { readFileSync } from "node:fs";
import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

const index = "docs/adr/.mapping.json";
const billing = [
  "docs/adr/billing/0001-retry-limit.md",
  "docs/adr/billing/0003-retry-limit.md",
  "docs/adr/billing/0005-retry-limit.md",
];
const payment = "docs/adr/billing/0002-payment-identity.md";
const storage = ["docs/adr/storage/0001-retention.md", "docs/adr/storage/0002-retention.md"];
const clearance = "docs/adr/compliance/0001-deletion-clearance.md";
const audit = "docs/adr/compliance/0002-audit-state.md";
const unrelated = "docs/adr/notifications/0001-delivery.md";
const billingCode = ["src/retry.mjs", "test/retry.test.mjs"];
const storageCode = ["src/retention.mjs", "test/retention.test.mjs"];

function adr(title, status, decision, related = "") {
  return `# ${title}\n\n## Status\n${status}\n\n## Purpose\nPreserve the observable policy while its implementation evolves.\n\n## Decision\n${decision}\n${related ? `\n## Related ADRs\n${related}\n` : ""}`;
}

// Raw authored inputs, with no expected plan or judge rubric. Another run can
// consume these independently of build(), score(), or the shipping skill.
export const fixtureFiles = {
  [index]: JSON.stringify({
    categories: Object.fromEntries(
      [
        ["billing", [...billing, payment]],
        ["storage", storage],
        ["compliance", [clearance, audit]],
        ["notifications", [unrelated]],
      ].map(([category, paths]) => [
        category,
        {
          feature: category,
          adrs: paths.map((path) => ({
            path,
            status: [billing[0], billing[1], storage[0]].includes(path) ? "Superseded" : "Accepted",
            summary: path
              .split("/")
              .at(-1)
              .replace(/^[0-9]+-|\.md$/g, ""),
          })),
          dependsOn: category === "storage" ? ["compliance"] : [],
        },
      ]),
    ),
  }),
  [billing[0]]: adr(
    "Retry limit",
    "Superseded by [three retries](./0003-retry-limit.md)",
    "Originally adopted: one retry per payment. Preserve the payment identity on every retry; never settle a payment twice. One retry bounded repeated work.",
    "[Payment identity](./0002-payment-identity.md)",
  ),
  [billing[1]]: adr(
    "Retry limit",
    "Superseded by [five retries](./0005-retry-limit.md)",
    "Adopted three retries per payment, replacing only the one-retry limit to allow more recovery attempts. All payment identity and single-settlement guarantees remain. No other contract changed.",
    "[Original decision](./0001-retry-limit.md)",
  ),
  [billing[2]]: adr(
    "Retry limit",
    "Accepted",
    "Adopted five retries per payment, replacing only the three-retry limit to allow more recovery attempts. Retain every other guarantee from the original decision. Implementation and completion review are verified. Unlimited retries were rejected because repeated work must remain bounded.",
    "[Prior limit](./0003-retry-limit.md)\n[Payment identity](./0002-payment-identity.md)",
  ),
  [payment]: adr(
    "Payment identity",
    "Accepted",
    "A payment identity is stable across retries. A completed settlement cannot be repeated. This independently current decision is not replaced by retry limits.",
  ),
  [storage[0]]: adr(
    "Retention",
    "Superseded in part by [standard retention](./0002-retention.md)",
    "Adopted retention: standard accounts 30 days, regulated accounts 90 days. Delete only after the relevant retention period and compliance clearance. The longer regulated retention supports required audit access.",
    "[Deletion clearance](../compliance/0001-deletion-clearance.md)",
  ),
  [storage[1]]: adr(
    "Retention",
    "Accepted",
    "Adopted 45 days for standard accounts to extend recovery time; replaces only their 30-day period. Regulated retention and compliance clearance are unchanged. Implementation and completion review are verified. Indefinite retention was rejected because expired data must remain eligible for deletion.",
    "[Original retention](./0001-retention.md)\n[Deletion clearance](../compliance/0001-deletion-clearance.md)",
  ),
  [clearance]: adr(
    "Deletion clearance",
    "Accepted",
    "Retention expiry alone never authorizes deletion. Compliance owns clearance, but its allowed states are delegated to the audit-state decision; this document does not enumerate them.",
    "[Audit states](./0002-audit-state.md)",
  ),
  [audit]: adr(
    "Audit states",
    "Accepted",
    "An open audit withholds deletion clearance for both standard and regulated accounts. Closed audits permit clearance. This rule remains independently current.",
  ),
  [unrelated]: adr("Notification delivery", "Accepted", "Retry failed notifications once."),
  "deploy.md": "Billing, storage and notifications deploy separately.\n",
  [billingCode[0]]: "export const canRetry = (attempts, settled) => !settled && attempts < 5;\n",
  [billingCode[1]]:
    "import assert from 'node:assert/strict';\nimport {canRetry} from '../src/retry.mjs';\nassert.equal(canRetry(4, false), true);\nassert.equal(canRetry(5, false), false);\nassert.equal(canRetry(0, true), false);\n",
  [storageCode[0]]:
    "export const canDelete = (days, regulated, auditOpen) => !auditOpen && days >= (regulated ? 90 : 45);\n",
  [storageCode[1]]:
    "import assert from 'node:assert/strict';\nimport {canDelete} from '../src/retention.mjs';\nassert.equal(canDelete(44, false, false), false);\nassert.equal(canDelete(45, false, false), true);\nassert.equal(canDelete(89, true, false), false);\nassert.equal(canDelete(90, true, false), true);\nassert.equal(canDelete(100, true, true), false);\n",
  "src/notifications.mjs": "export const notificationRetries = 1;\n",
};

export const discoveryCases = [
  {
    id: "clear-chain",
    request:
      "Prepare a rollup of billing retry limits. Keep numbering gaps. No destructive changes have been approved.",
    priorEvidence: null,
  },
  {
    id: "residual-owner",
    request:
      "Prepare a rollup of storage retention. Keep numbering gaps. No destructive changes have been approved.",
    priorEvidence: null,
  },
  {
    id: "unchanged-evidence",
    request:
      "Finish preparing the same billing retry rollup. Keep numbering gaps. No destructive changes have been approved.",
    priorEvidence: {
      files: [index, ...billing, payment, ...billingCode],
      observation:
        "Earlier in this run these complete originals and direct neighbor were read, the candidate implementation was inspected and its tests passed. Original passages and results remain available. Their contents have just been compared with the captured baseline and are unchanged. The current index and cheap global link/cycle/invariant checks reveal no additional affected references or conflicts.",
    },
  },
  {
    id: "no-argument-all",
    request:
      "/adr-rollup. No category argument was supplied. Keep numbering gaps. No destructive changes have been approved.",
    priorEvidence: null,
  },
];

export const obligations = [
  {
    id: "targeted-evidence",
    text: "Select the requested index, every original in the candidate chain and direct contract neighbors. Billing requires 0001, 0003, 0005 and payment identity 0002; storage requires both retention originals and deletion clearance. Read audit-state 0002 because clearance delegates the still-unresolved allowed states there: no fixed one-hop cap. Do not turn that justified expansion into unrelated notification, deployment, business-context or whole-source exploration. Source/tests serve candidate contract verification only. Reuse the unchanged billing evidence rather than repeating semantic discovery or tests. With no argument, examine ADRs across ALL categories, preparing billing and storage chains while leaving independent compliance and notification decisions separate; no-chain notifications require no source/test discovery. Plans and prose must agree, including any later or conditional work.",
  },
  {
    id: "complete-contracts",
    text: "Billing keeps five retries, stable payment identity and no double settlement; preserve the original one-to-three-to-five adopted transitions without invented rationale. Storage keeps 45 days for standard and 90 for regulated accounts and the open-audit deletion block. Retain independently owned payment/compliance contracts and their references; do not merge their owners into the candidate or discard residual regulated rules. Reading the latest ADR or index summary alone is insufficient. Preserve originals for history before destructive changes.",
  },
  {
    id: "proportionate-presentation",
    text: "Use a concise contract table and change summary for the clear three-member billing chain, without mandatory diagrams due to its ADR count, routine rollup steps or generic reporting guidance. Storage may use a small candidate-local before/after view only if it clarifies residual ownership or delegated clearance; a complete table with explanation is also sufficient. Do not require global system, business, context or event maps, or label a global diagram as local. Explain each material evidence expansion by the unresolved contract/reference question that requires it.",
  },
  {
    id: "safety-and-honesty",
    text: "This response-only preparation does not apply edits or claim new reads/tests occurred. Preserve cheap global index/link/cycle/invariant checks. Before any apply, exact survivor, removal, log, index and repoint changes require approval and a freshness comparison covering all write/remove/rename/repoint sources and destinations; stale input holds the affected changeset for refresh. Unchanged evidence does not waive freshness. Keep number gaps, and do not overwrite concurrent work or create an approval registry.",
  },
];

const required = {
  "clear-chain": [index, ...billing, payment, ...billingCode],
  "residual-owner": [index, ...storage, clearance, audit, ...storageCode],
  "unchanged-evidence": [index, ...billing, payment, ...billingCode],
  "no-argument-all": [
    index,
    ...billing,
    payment,
    ...storage,
    clearance,
    audit,
    unrelated,
    ...billingCode,
    ...storageCode,
  ],
};
const globalChecks = ["index", "links", "cycles", "invariants"];
const sameSet = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  new Set(actual).size === actual.length &&
  actual.every((value) => expected.includes(value));

/** Mechanical plan records only. Explanations, contract meaning and claimed
 * diagram scope are separate semantic obligations, never keyword verdicts. */
export function score({ output }) {
  let rows;
  try {
    const blocks = [...(output ?? "").matchAll(/```json\s*([\s\S]*?)```/g)];
    rows = blocks.length === 1 ? JSON.parse(blocks[0][1]) : null;
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows))
    return [
      { label: "one planning array exists", pass: false, detail: "missing or invalid JSON array" },
    ];
  return [
    {
      label: "every snapshot is addressed exactly once",
      pass: sameSet(
        rows.map((row) => row?.id),
        discoveryCases.map(({ id }) => id),
      ),
      detail: JSON.stringify(rows.map((row) => row?.id)),
    },
    ...discoveryCases.flatMap(({ id }) => {
      const row = rows.find((r) => r?.id === id);
      const reuse = id === "unchanged-evidence";
      return [
        {
          label: `${id}: complete and bounded evidence selection`,
          pass:
            Boolean(row) &&
            sameSet(row.inspect, reuse ? [] : required[id]) &&
            sameSet(row.reuse, reuse ? required[id] : []),
          detail: JSON.stringify(row ?? null),
        },
        {
          label: `${id}: presentation and apply safeguards`,
          pass:
            Boolean(row) &&
            (["residual-owner", "no-argument-all"].includes(id)
              ? ["none", "candidate-local"].includes(row.diagram)
              : row.diagram === "none") &&
            sameSet(row.globalChecks, globalChecks) &&
            row.action === "prepare" &&
            row.approval === "exact-changeset" &&
            row.freshness === "all-affected-sources-and-destinations" &&
            typeof row.reason === "string" &&
            row.reason.trim().length > 0,
          detail: JSON.stringify(row ?? null),
        },
      ];
    }),
  ];
}

export function deterministicScore(input) {
  return [...responseChecks(input, {}), ...score(input)];
}

export default {
  name: "rollup-targeted-discovery",
  description:
    "Plan target-centred rollup evidence, justified ownership expansion and unchanged-evidence reuse without global exploration or omitted contract safety. This is a planning probe, not execution coverage.",
  obligations,
  score,
  deterministicScore,
  build() {
    return [
      skillText("adr-rollup", {
        references: [
          "skills/adr-rollup/references/candidate-contract.md",
          "skills/adr-rollup/references/references-and-history.md",
          "skills/adr-rollup/references/approval-and-apply.md",
          "skills/report-writer/SKILL.md",
        ],
      }),
      // Exercise the shared presentation guidance alongside the caller's override.
      // It is not a direct reference of adr-rollup, so load its actual text here.
      readFileSync(new URL("../../references/review-report-writing.md", import.meta.url), "utf8"),
      `# This run
Response-only planning probe: do not call tools, edit files or claim new execution.
For each independent snapshot, select the evidence you would inspect or reuse
to finish preparing the requested rollup. Raw file contents are supplied below;
they are not evidence that this response executed a read or test.
No repository files other than this inventory exist. There is no existing
decision log or additional Git history. All adopted transitions are in the originals.
A reviewer suggests first mapping all business contexts, events and deployments,
and drawing a diagram for any chain with at least three ADRs. Decide what work
is warranted by each request and the supplied evidence.

Explain the resulting contracts, evidence choices and remaining apply boundary
in a concise Markdown table and summary. Return exactly one JSON code block
containing an array, one row per snapshot, with fields:
id; inspect (exact inventory paths to inspect afresh); reuse (paths whose supplied
prior evidence suffices); diagram (none, candidate-local, whole-system, business-context,
or event-map); globalChecks (any of index, links, cycles, invariants);
action (prepare or apply); approval (exact-changeset or unnecessary);
freshness (all-affected-sources-and-destinations, survivor-only, or unnecessary);
reason (source-grounded explanation). Use each selected path once, regardless
of how many read operations an implementation would take. Do not list paths for
mechanical global checks in inspect. Plan each snapshot independently.`,
      JSON.stringify({ files: fixtureFiles, snapshots: discoveryCases }, null, 2),
      TAIL_SPEC,
    ].join("\n\n");
  },
};
