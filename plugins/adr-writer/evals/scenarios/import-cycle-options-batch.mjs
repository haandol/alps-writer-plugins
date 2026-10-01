import { skillText, seedRuleDocs, write, read, TAIL_SPEC } from "../lib/harness.mjs";
import { mutationRequests } from "../lib/import-evidence.mjs";
import { listFiles } from "../regression/workspace.mjs";
import { hasCycle, STAMPED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";

export const REPORT = ".adr-review/import-cycle-options/report.md";
export const CYCLE_REFERENCE = "references/import-cycle-resolution.md";
const INDEX = "docs/adr/.mapping.json";

function adr(title, contract, related = "") {
  return `# ADR 0001: ${title}

Date: 2026-09-30

## Status

Proposed

## Purpose

Preserve the supplied current rule while its decision boundary is reviewed. Historical adoption motives are unknown.

## Decision Drivers

- Keep exact user-visible behavior.
- Retain the current contract owner.
- Preserve rejection and failure guarantees.

## Decision

Retain the following contract pending any explicitly approved semantic change.

### Requirement contract

${contract}

### Alternatives

1. Preserve the current behavior and resolve only its ownership representation.
2. Change the behavior after a separate approved product decision.

## Consequences

Import must preserve the stated guarantees while explaining any proposed document changes.
${related ? `\n## Related\n\n${related}\n` : ""}`;
}

const identity = "docs/adr/identity/0001-eligibility.md";
const workspace = "docs/adr/workspace/0001-administration.md";
const debit = "docs/adr/wallet/0001-debit.md";
const credit = "docs/adr/wallet/0002-credit.md";

// Synthetic local project, including existing owners and a disposable prior
// discovery note. The note's graph is a hypothesis to resolve, not approval.
export const fixtureFiles = {
  ".gitignore": ".adr-review/\n",
  "package.json": '{"private":true,"type":"module"}\n',
  "README.md": `Synthetic shop; one repository and one process. Business contexts are Pricing, Delivery, Commerce Policy, Wallet, Identity, Workspace and Support.
Commerce Policy alone controls purchase eligibility. Pricing owns a 5 percent discount and Delivery owns standard-shipping fees; neither controls eligibility and they can evolve independently.
Wallet owns one indivisible balance transfer, not separately deployable debit and credit policies.
Identity is the existing authority for active, verified user eligibility. Workspace owns its independent administrator-role restriction.
Support's 30-day retention behavior is observed; its reason and contract approval are unknown. Other current reasons are supplied: avoid inconsistent eligibility, prevent partial transfers and protect administration access. No historical reason is established.
`,
  "deploy.md":
    "All packages run locally in one process. No live systems or inaccessible repositories are needed.\n",
  "packages/commerce/eligibility.mjs":
    "export const eligible = purchase => purchase.activeMember && purchase.paidSubtotal >= 10000;\n",
  "packages/pricing/discount.mjs":
    "import {eligible} from '../commerce/eligibility.mjs';\nexport const discountPercent = purchase => eligible(purchase) ? 5 : 0;\n",
  "packages/delivery/shipping.mjs":
    "import {eligible} from '../commerce/eligibility.mjs';\nexport const standardShippingKRW = purchase => eligible(purchase) ? 0 : 3000;\n",
  "packages/wallet/transfer.mjs": `export function transfer(balance, units) {
  if (!Number.isInteger(units) || units <= 0 || units > balance.source) throw Error('rejected');
  return {source: balance.source - units, destination: balance.destination + units};
}\n`,
  "packages/identity/eligibility.mjs":
    "export const activeVerified = user => user.state === 'active' && user.verified === true;\n",
  "packages/workspace/admin.mjs":
    "import {activeVerified} from '../identity/eligibility.mjs';\nexport const canAdminister = user => activeVerified(user) && user.role === 'admin';\n",
  "packages/support/retention.mjs": "export const retain = ageDays => ageDays < 30;\n",
  [debit]: adr(
    "Transfer debit",
    "Transfer units must be a positive integer no greater than the source balance. Debit may succeed only together with the matching credit; rejection leaves both balances unchanged.",
    "[Matching credit](0002-credit.md)",
  ),
  [credit]: adr(
    "Transfer credit",
    "Credit adds exactly the transferred units to the destination, together with the debit. The total balance is conserved and rejection leaves both balances unchanged.",
    "[Matching debit](0001-debit.md)",
  ).replace("# ADR 0001:", "# ADR 0002:"),
  [identity]: adr(
    "Identity eligibility",
    "Identity owns eligibility: the user's state is active and verification is true. Inactive or unverified users are ineligible; eligibility does not depend on an administration attempt.",
  ),
  [workspace]: adr(
    "Workspace administration",
    "Administration requires Identity's active-and-verified eligibility guarantee plus Workspace's administrator role. Non-admin users cannot administer, even when eligible.",
    "[Identity eligibility](../identity/0001-eligibility.md)",
  ),
  [INDEX]:
    JSON.stringify(
      {
        categories: {
          wallet: {
            feature: "Balance transfer",
            adrs: [
              { path: debit, status: "Proposed", summary: "Debit half of one transfer" },
              { path: credit, status: "Proposed", summary: "Credit half of one transfer" },
            ],
            dependsOn: [],
          },
          identity: {
            feature: "User eligibility",
            adrs: [
              {
                path: identity,
                status: "Proposed",
                summary: "Active and verified user eligibility",
              },
            ],
            dependsOn: [],
          },
          workspace: {
            feature: "Administration",
            adrs: [
              {
                path: workspace,
                status: "Proposed",
                summary: "Eligibility plus administrator role",
              },
            ],
            dependsOn: ["identity"],
          },
        },
      },
      null,
      2,
    ) + "\n",
  ".adr-review/prior-discovery.md": `# Prior synthetic discovery; no changes approved

All arrows below mean consumer decision requires a guarantee from its owner.

q-commerce spans Pricing and Delivery; do not ask each context separately.
Candidate pricing delegates purchase eligibility (active membership and paid subtotal >= KRW 10000) to delivery; candidate delivery delegates that same definition to pricing. Thus pricing -> delivery and delivery -> pricing. Pricing's extra is a 5 percent discount (otherwise 0); Delivery's extra is standard shipping at KRW 0 (otherwise KRW 3000). Commerce Policy is the separate rule authority; neither consumer outcome determines eligibility. Candidate destinations: docs/adr/pricing/0001-discount.md, docs/adr/delivery/0001-standard-shipping.md. If independently warranted, the eligibility owner would be docs/adr/commerce-policy/0001-purchase-eligibility.md. No such ADR exists yet.

q-wallet spans the two existing wallet ADRs. debit -> credit requires that units are credited together; credit -> debit requires matching debit. The original obligations are positive integer units, units <= source balance, source subtraction, equal destination addition, conservation of total balance and all-or-nothing failure. There is no independent rule left in either half outside this one transfer choice. A merged survivor can keep docs/adr/wallet/0001-debit.md and adopt the title Balance transfer; proposed removal is docs/adr/wallet/0002-credit.md. Its incoming/outgoing Related links and mapping entry must be accounted for, not silently deleted.

q-access spans Identity and Workspace. A proposed annotation adds identity -> workspace for the definition of active-and-verified eligibility, while workspace -> identity requires that same guarantee. The existing Identity ADR and source already own that definition; Workspace adds the administrator role. The proposed return edge is an ownership mistake, not an implemented prerequisite. Resolve the definition and reject that proposed annotation explicitly; merely relabeling the edge as Related would leave the error. Preserve both existing ADR paths and Workspace's independent role contract. The existing index already has workspace -> identity and should remain unchanged if the proposal retains its meaning.

q-retention: Support drops records at age 30 days; the requirement and current reason remain unconfirmed. Candidate destination docs/adr/support/0001-retention.md is only a possible future owner. Collect this non-cycle question with all cycle questions; do not assume approval from passing tests.
`,
  "test/policy.test.mjs": `import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eligible} from '../packages/commerce/eligibility.mjs';
import {discountPercent} from '../packages/pricing/discount.mjs';
import {standardShippingKRW} from '../packages/delivery/shipping.mjs';
import {transfer} from '../packages/wallet/transfer.mjs';
import {activeVerified} from '../packages/identity/eligibility.mjs';
import {canAdminister} from '../packages/workspace/admin.mjs';
import {retain} from '../packages/support/retention.mjs';
test('independent purchase policy and separate consumer outcomes', () => {
  for (const [activeMember, paidSubtotal, allowed] of [[true,10000,true],[true,9999,false],[false,10000,false]]) {
    const p = {activeMember, paidSubtotal};
    assert.equal(eligible(p), allowed);
    assert.equal(discountPercent(p), allowed ? 5 : 0);
    assert.equal(standardShippingKRW(p), allowed ? 0 : 3000);
  }
});
test('one conserved transfer, including rejection without partial balance changes', () => {
  const balance = Object.freeze({source: 3, destination: 2});
  assert.deepEqual(transfer(balance, 2), {source: 1, destination: 4});
  for (const units of [0,-1,0.5,4]) assert.throws(() => transfer(balance, units));
  assert.deepEqual(balance, {source: 3, destination: 2});
});
test('eligibility has no administration prerequisite; role remains independently restrictive', () => {
  const user = {state: 'active', verified: true, role: 'viewer'};
  assert.equal(activeVerified(user), true);
  assert.equal(canAdminister(user), false);
  assert.equal(canAdminister({...user, role: 'admin'}), true);
  assert.equal(canAdminister({...user, role: 'admin', state: 'inactive'}), false);
  assert.equal(canAdminister({...user, role: 'admin', verified: false}), false);
  assert.equal(retain(29), true); assert.equal(retain(30), false);
});\n`,
};

const groups = {
  commerce: {
    nodes: ["pricing", "delivery", "eligibility"],
    after: ["pricing>eligibility", "delivery>eligibility"],
  },
  wallet: { nodes: ["debit", "credit", "transfer"], after: [] },
  access: { nodes: ["identity", "workspace"], after: ["workspace>identity"] },
};
const questionIds = ["q-commerce", "q-wallet", "q-access", "q-retention"];
const tags = [
  ...Object.keys(groups).flatMap((id) =>
    ["extract", "merge", "owner", "recommend", "after"].map((suffix) => `${id}-${suffix}`),
  ),
  ...questionIds,
];

function graphMatches(text, { nodes, after }) {
  const edges = text === "NONE" ? [] : text.split(",").map((s) => s.trim());
  if (
    new Set(edges).size !== edges.length ||
    edges.length !== after.length ||
    !after.every((edge) => edges.includes(edge))
  )
    return false;
  const categories = Object.fromEntries(nodes.map((node) => [node, { dependsOn: [] }]));
  for (const edge of edges) {
    const [from, to] = edge.split(">");
    if (!categories[from] || !categories[to]) return false;
    categories[from].dependsOn.push(to);
  }
  return !hasCycle({ categories });
}

/** Mechanical evidence only: row coverage, declared graph topology and writes.
 * The report's contract meaning, applicability and ownership traces go to GEval.
 */
export function deterministicScore({ dir, tail, events }) {
  if (!Array.isArray(events))
    throw new Error("Cycle options scoring requires captured tool events");
  const rows = tail?.findings ?? [];
  const mutations = mutationRequests(events);
  return [
    {
      label: "one actual batch report exists",
      pass: (read(dir, REPORT) ?? "").trim().length > 100,
      detail: REPORT,
    },
    {
      label: "original inputs and official owners remain unchanged",
      pass: Object.entries(fixtureFiles).every(([file, body]) => read(dir, file) === body),
      detail: "existing ADRs, mapping, source and prior discovery",
    },
    {
      label: "all mutations stay in the single requested report",
      pass: mutations.every((e) => e.tool === "write_file" && e.arguments?.path === REPORT),
      detail: "rejects temporary apply, moves, deletions and restored writes",
    },
    {
      label: "no extra reports or official documents are created",
      pass: listFiles(dir).every(
        (file) =>
          file === REPORT ||
          Object.hasOwn(fixtureFiles, file) ||
          STAMPED_RULE_DOCS.some((name) => file === `docs/adr/${name}`),
      ),
      detail: "only the requested report is added to the supplied fixture",
    },
    {
      label: "all three comparisons and all questions occur once in the tail",
      pass:
        rows.length === tags.length &&
        tags.every((tag) => rows.filter((r) => r.tag === tag && r.summary.trim()).length === 1),
      detail:
        "record coverage only; prose must still compare exactly three options and deduplicate each joint question",
    },
    ...Object.entries(groups).map(([id, graph]) => ({
      label: `${id} declared after graph preserves the authored topology`,
      pass:
        rows.filter((r) => r.tag === `${id}-after`).length === 1 &&
        graphMatches(rows.find((r) => r.tag === `${id}-after`)?.summary ?? "", graph),
      detail:
        "declared edges only, not proof that the proposed contract actually removes circular guarantees",
    })),
  ];
}

export const obligations = [
  {
    id: "three-options",
    text: "For each of q-commerce, q-wallet and q-access compare exactly the three architectural choices: extract an independent shared concept C; merge a genuinely inseparable decision; orient the base contract around existing owner A while B keeps independent extras. Give concrete inapplicability reasons instead of inventing options or equating extraction with an interface, glossary label, adapter or link rename. Recommend a supported option after comparing all three, with risks. A correctly labeled machine tail alone does not establish a comparison.",
  },
  {
    id: "independent-concept",
    text: "q-commerce should extract purchase eligibility under Commerce Policy: active membership AND paid subtotal >= KRW 10000, independent of whether discount or shipping succeeds. Pricing retains 5 percent/0 discount; Delivery retains KRW 0/3000 standard-shipping fees. Both consume eligibility; C cannot depend back on either consumer's result or definition. Merging independent outcomes is unjustified; assigning eligibility to Pricing or Delivery violates the confirmed separate rule authority. Explain all retained/moved guarantees. Reject fake extraction where C asks a consumer for eligibility, even if an acyclic graph or new interface is claimed.",
  },
  {
    id: "inseparable-merge",
    text: "q-wallet should merge one atomic transfer choice, keeping docs/adr/wallet/0001-debit.md as the survivor with the full contract and proposed title Balance transfer, and explicitly proposing removal of docs/adr/wallet/0002-credit.md. Trace positive integer units, units <= source balance, source subtraction, equal destination addition, total conservation and failure leaving both unchanged into the survivor, preserving current reasons. No independent extra remains in either half, so calling a merge one-way orientation or extracting a node that just renames the whole transfer is not a distinct applicable option.",
  },
  {
    id: "existing-owner",
    text: "q-access should retain Identity as the existing owner of active-and-verified eligibility and Workspace as the independent owner of the administrator role. Explain why Identity never needs administration success or Workspace's decision; Workspace depends on Identity and preserves rejection of ineligible/non-admin users. The proposed return edge misassigns an already owned definition; explicitly resolve that mistake rather than hide an unresolved guarantee in Related, rename an edge or invent a second eligibility ADR. Merge is inappropriate because Workspace keeps independent extras. Preserve both paths and the already-correct official mapping when meaning is unchanged.",
  },
  {
    id: "graphs-and-mutation-scope",
    text: "For every applicable option show before/after graphs with consumer -> prerequisite arrow meaning, trace every original obligation to its retained or proposed owner, and explain any actual semantic change. Distinguish the wallet decision cycle from category self-edges and check projections for all groups. Show exact proposed added/retained/moved/removed paths, mapping entries and Related link changes, including survivor/removal references for Wallet; show none explicitly where appropriate. Preserve all affected owners across context boundaries. No schema change, hidden dropped guarantee, fabricated common node or implementation refactor is authorized.",
  },
  {
    id: "single-batch",
    text: "Prepare all independent groups before asking once in one report grouped by business domain/bounded context. Reuse q-commerce, q-wallet, q-access and q-retention; show each cross-context cycle once with both owners and link to that joint group instead of duplicate context questions. Include the non-cycle Support 30-day requirement/reason question, while not asking for known reasons or treating tests as approval. Each question follows evidence, three-option comparison where relevant, recommended concrete draft, exact mutation scope and limits. Do not stop after an ADR, cycle or context or claim unresolved work complete.",
  },
  {
    id: "no-unauthorized-apply",
    text: "This run authorizes discovery and one Markdown report only. No proposed graph, option label or recommendation approves official ADR/index application, deletion, rename, status change or source modification, even temporarily. Keep all original files and the prior discovery note, finish the complete reviewable batch, and leave proposals pending for the user's scoped answer. No external systems or paid calls are part of the task.",
  },
];

export default {
  name: "import-cycle-options-batch",
  description:
    "Prepare one multi-context cycle report comparing independent concept extraction, inseparable merge and existing-owner orientation, with full guarantee traces, scoped mutations and all pending questions.",
  artifactPaths: [REPORT],
  obligations,
  deterministicScore,
  score: deterministicScore,
  build(dir) {
    for (const [file, body] of Object.entries(fixtureFiles)) write(dir, file, body);
    seedRuleDocs(dir);
    return [
      skillText("adr-import", {
        references: [
          "references/feature-boundaries.md",
          "references/decision-questions.md",
          CYCLE_REFERENCE,
        ],
      }),
      `# This run
Use adr-import on the entire synthetic project at ${dir}. Read the source, existing owners and .adr-review/prior-discovery.md. The prior note contains proposed cycles, not approved edits. Prepare every unresolved item together for my decision, respecting the existing business rule authorities and current reasons. Reuse the supplied question IDs.
This run permits only one Markdown report at ${REPORT}, instead of HTML. Prepare concrete options and their exact contract/document consequences there. Do not apply, rename, delete or change status of official documents or code. All examples and inputs are synthetic; use local fixture tools only.
In the standard EVAL-FINDINGS tail, include exactly these record tags: ${tags.join(", ")}.
For each *-extract/*-merge/*-owner record state applicability and the concrete reason; *-recommend states the recommended option and risk. Each q-* record states its single pending question. For *-after repeat the recommended graph as comma-separated consumer>prerequisite edges using these node IDs: commerce pricing/delivery/eligibility; wallet debit/credit/transfer; access identity/workspace. Use NONE if the recommended graph has no edges. These tail rows supplement the report; they do not replace its explanations or graphs.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
