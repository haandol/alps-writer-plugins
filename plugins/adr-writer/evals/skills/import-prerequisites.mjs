import {
  sectionRange,
  validateMappingShape,
  STAMPED_RULE_DOCS,
} from "../../scripts/adr-lint-lib.mjs";

const REPORT = ".adr-review/import-prerequisites/report.md";
const INDEX = "docs/adr/.mapping.json";
const MUTATIONS = new Set(["write_file", "delete_file", "move_file", "demote_adr_status"]);

// Synthetic, explicitly authored contracts. Exact quotation checks below apply
// only because turn 2 asks to retain these clauses verbatim. GEval owns meaning,
// rationale, discovery quality and contradictions elsewhere in the prose.
const contracts = {
  reserve:
    "Reservation grants only positive integer units no greater than available stock; rejection leaves stock unchanged.",
  confirm:
    "Order confirmation requires a granted reservation for the requested units; rejected reservation creates no confirmed order.",
  cancel:
    "Only confirmed orders can become cancelled; cancellation preserves the reserved units and rejects other states.",
  release: "Stock release requires a cancelled order; other states leave stock unchanged.",
  lookup:
    "Support lookup returns an order only to its owning member; other members receive no result.",
};
const titles = {
  reserve: "Stock reservation",
  confirm: "Order confirmation",
  cancel: "Order cancellation",
  release: "Stock release",
  lookup: "Member order lookup",
};

function decisionsFor(kind) {
  const rows = [
    ["reserve", kind === "within" ? "ordering" : "inventory", "0001-reservation.md"],
    ["confirm", "ordering", kind === "within" ? "0002-confirmation.md" : "0001-confirmation.md"],
    ...(kind === "projection"
      ? [
          ["cancel", "ordering", "0002-cancellation.md"],
          ["release", "inventory", "0002-release.md"],
          ["lookup", "support", "0001-lookup.md"],
        ]
      : []),
  ];
  return rows.map(([id, category, filename]) => ({
    id,
    category,
    path: `docs/adr/${category}/${filename}`,
    title: titles[id],
    contract: contracts[id],
  }));
}

function edgesFor(kind) {
  return [
    { dependent: "confirm", owner: "reserve", guarantee: contracts.reserve },
    ...(kind === "projection"
      ? [{ dependent: "release", owner: "cancel", guarantee: contracts.cancel }]
      : []),
  ];
}

const edgeLine = (edge) => `${edge.dependent} requires ${edge.owner}: ${edge.guarantee}`;
const prerequisiteClauses = (edge) => [
  `Prerequisite owner: ${titles[edge.owner]}.`,
  `Required guarantee: ${edge.guarantee}`,
];

/** All application behavior is local and executable through the existing policy-tests tool. */
function buildFixture(kind) {
  const files = {
    ".gitignore": ".adr-review/\n",
    "package.json": '{"private":true,"type":"module","workspaces":["packages/*"]}\n',
    "README.md": `Synthetic shop, with no external services. ${kind === "within" ? "Ordering owns both stock reservation and order confirmation in one confirmed category, ordering." : "Inventory owns stock reservation; Ordering owns order confirmation. Confirmed categories are inventory and ordering."} Confirmation calls reservation because it must not confirm unavailable units, not merely because one function calls another. Original adoption history is unknown.\n${kind === "projection" ? "Ordering also owns cancellation; Inventory owns release. Support independently owns member-scoped order lookup. These are separate decisions within the confirmed inventory, ordering and support categories; grouping has not been approved for change.\n" : ""}`,
    "deploy.md":
      "One repository, one locally deployed process containing several packages. Package boundaries do not denote separate deployments.\n",
    "packages/stock/reserve.mjs": `export function reserve(stock, units) {
  if (!Number.isInteger(units) || units <= 0 || units > stock.available) throw Error('unavailable');
  return {available: stock.available - units, reservation: {units, state: 'reserved'}};
}\n`,
    "packages/orders/confirm.mjs": `import {reserve} from '../stock/reserve.mjs';
export function confirm(stock, units, member) {
  const next = reserve(stock, units);
  return {stock: next, order: {member, units: next.reservation.units, state: 'confirmed'}};
}\n`,
    "test/policy.test.mjs": `import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserve} from '../packages/stock/reserve.mjs';
import {confirm} from '../packages/orders/confirm.mjs';
test('reservation and confirmation preserve stock guarantees', () => {
  const stock = Object.freeze({available: 3});
  assert.equal(reserve(stock, 3).available, 0);
  for (const units of [0, -1, 1.5, 4]) {
    assert.throws(() => reserve(stock, units));
    assert.throws(() => confirm(stock, units, 'member-a'));
    assert.equal(stock.available, 3);
  }
  assert.deepEqual(confirm(stock, 2, 'member-a'), {
    stock: {available: 1, reservation: {units: 2, state: 'reserved'}},
    order: {member: 'member-a', units: 2, state: 'confirmed'}
  });
});\n`,
  };
  if (kind === "projection") {
    files["packages/orders/cancel.mjs"] = `export function cancel(order) {
  if (order.state !== 'confirmed') throw Error('not confirmed');
  return {...order, state: 'cancelled'};
}\n`;
    files["packages/stock/release.mjs"] = `export function release(stock, order) {
  if (order.state !== 'cancelled') throw Error('not cancelled');
  return {...stock, available: stock.available + order.units};
}\n`;
    files["packages/support/lookup.mjs"] =
      "export const lookup = (order, member) => order.member === member ? order : null;\n";
    files["test/policy.test.mjs"] += `import {cancel} from '../packages/orders/cancel.mjs';
import {release} from '../packages/stock/release.mjs';
import {lookup} from '../packages/support/lookup.mjs';
test('release requires cancellation; support lookup is independently member-scoped', () => {
  const {stock, order} = confirm({available: 3}, 2, 'member-a');
  assert.throws(() => release(stock, order));
  assert.equal(stock.available, 1);
  const cancelled = cancel(order);
  assert.equal(cancelled.units, 2);
  assert.equal(release(stock, cancelled).available, 3);
  assert.throws(() => cancel(cancelled));
  assert.throws(() => cancel({...order, state: 'draft'}));
  assert.equal(lookup(order, 'member-a'), order);
  assert.equal(lookup(order, 'member-b'), null);
  assert.equal(lookup({member: 'member-a', state: 'draft'}, 'member-a').state, 'draft');
});\n`;
  }
  return files;
}

const official = (files = {}) =>
  Object.fromEntries(
    Object.entries(files).filter(
      ([file]) =>
        file.startsWith("docs/adr/") &&
        !STAMPED_RULE_DOCS.some((name) => file === `docs/adr/${name}`),
    ),
  );
const same = (left = {}, right = {}) =>
  [...new Set([...Object.keys(left), ...Object.keys(right)])].every(
    (key) => left[key] === right[key],
  );
const sectionText = (section) =>
  section?.lines
    .slice(section.start + 1, section.end)
    .join("\n")
    .trim();

function validBody(body, decision, item, date) {
  if (typeof body !== "string") return false;
  const status = sectionRange(body, (h) => h.level === 2 && h.text === "Status");
  const choice = sectionRange(body, (h) => h.level === 2 && h.text === "Decision");
  const contract = sectionRange(body, (h) => h.level === 3 && h.text === "Requirement contract");
  if (
    sectionText(status) !== "Proposed" ||
    !choice ||
    !contract ||
    contract.start <= choice.start ||
    contract.end > choice.end ||
    !body.includes(`Date: ${date}`)
  )
    return false;
  const lines = sectionText(contract)
    .split("\n")
    .map((line) => line.trim().replace(/^[-*] /, ""));
  return [
    decision.contract,
    ...item.edges.filter((e) => e.dependent === decision.id).flatMap(prerequisiteClauses),
  ].every((clause) => lines.includes(clause));
}

function expectedDependencies(item, category) {
  return [
    ...new Set(
      item.edges.flatMap((edge) => {
        const dependent = item.decisions.find((d) => d.id === edge.dependent);
        const owner = item.decisions.find((d) => d.id === edge.owner);
        return dependent.category === category && owner.category !== category
          ? [owner.category]
          : [];
      }),
    ),
  ];
}

function validIndex(content, item, complete) {
  try {
    const mapping = JSON.parse(content);
    // Unknown fields are warnings in the shared linter, but adding a new
    // dependency schema is explicitly forbidden in these fixture tasks.
    if (
      validateMappingShape(mapping).some(
        (i) => i.level === "error" || i.code.includes("unknown-field"),
      )
    )
      return false;
    const expected = item.decisions.filter((d) => item.approvedIds.includes(d.id));
    const paths = [];
    for (const [key, category] of Object.entries(mapping.categories)) {
      if (!expected.some((d) => d.category === key) || !category.adrs.length) return false;
      const dependencies = category.dependsOn ?? [];
      const required = expectedDependencies(item, key);
      if (
        dependencies.length !== required.length ||
        !required.every((d) => dependencies.includes(d))
      )
        return false;
      for (const record of category.adrs) {
        if (
          record.status !== "Proposed" ||
          !expected.some((d) => d.category === key && d.path === record.path)
        )
          return false;
        paths.push(record.path);
      }
    }
    return (
      !complete ||
      (paths.length === expected.length && expected.every((d) => paths.includes(d.path)))
    );
  } catch {
    return false;
  }
}

/** Mechanical checks supplement, and never replace, the case's GEval obligations. */
export function verifyImportPrerequisites(evidence, item) {
  const checkpoints = evidence.checkpoints ?? [];
  const complete =
    checkpoints.length === 3 &&
    checkpoints.every((c, i) => c.turn === i + 1 && c.files && typeof c.files === "object");
  const first = checkpoints[0]?.files ?? {},
    applied = checkpoints[1]?.files ?? {},
    repeated = checkpoints[2]?.files ?? {};
  const approved = item.decisions.filter((d) => item.approvedIds.includes(d.id));
  const paths = new Set([INDEX, ...approved.map((d) => d.path)]);
  const requests = (evidence.events ?? []).filter(
    (e) => e.kind === "request" && MUTATIONS.has(e.tool),
  );
  const reportOnly = (e) => e.tool === "write_file" && e.arguments?.path === REPORT;
  const officialWrites = requests.filter((e) => !reportOnly(e));
  const scope = officialWrites.every(
    (e) => e.turn === 2 && e.tool === "write_file" && paths.has(e.arguments?.path),
  );
  return [
    {
      label: "three checkpoints and final capture agree",
      pass: Boolean(complete && same(repeated, evidence.after)),
      detail: `${checkpoints.length} checkpoints`,
    },
    {
      label: "discovery saves only a report before approval",
      pass: Boolean(
        complete &&
        !Object.keys(official(first)).length &&
        first[REPORT]?.trim().length > 100 &&
        requests.filter((e) => e.turn === 1).every(reportOnly),
      ),
      detail: "includes transient mutation requests",
    },
    {
      label: "only independent approved documents can be written",
      pass: scope,
      detail: "pending candidates, placeholders, moves and writes restored later are forbidden",
    },
    {
      label: "approved index retains exactly the required category edges",
      pass: Boolean(complete && validIndex(applied[INDEX], item, true)),
      detail: "shared mapping shape/graph checks plus fixture-specific edge and owner inventory",
    },
    {
      label: "dependent ADRs retain exact approved owner and guarantee clauses",
      pass: Boolean(
        complete &&
        approved.every((d) => validBody(applied[d.path], d, item, evidence.referenceDate)),
      ),
      detail:
        "verbatim authored clauses under Requirement contract; arbitrary prose meaning is judged by GEval",
    },
    {
      label: "every official write preserves scope, schema and approved contracts",
      pass:
        scope &&
        officialWrites.every((e) =>
          e.arguments.path === INDEX
            ? validIndex(e.arguments.content, item, false)
            : validBody(
                e.arguments.content,
                approved.find((d) => d.path === e.arguments.path),
                item,
                evidence.referenceDate,
              ),
        ),
      detail: "checks the recorded contents, not only the final snapshot",
    },
    {
      label: "no hidden official documents or synthetic owners",
      pass: Boolean(complete && Object.keys(official(applied)).every((file) => paths.has(file))),
      detail: "exact authorized file inventory",
    },
    {
      label: "required decision edges remain visible after approval and repeat",
      pass: Boolean(
        complete &&
        [applied, repeated].every((files) =>
          item.edges.every((edge) => (files[REPORT] ?? "").split("\n").includes(edgeLine(edge))),
        ),
      ),
      detail: "turn 2 explicitly requires verbatim edge lines; deferral rationale remains semantic",
    },
    {
      label: "original inputs are preserved at every checkpoint",
      pass: Boolean(
        complete &&
        evidence.before &&
        checkpoints.every((c) =>
          Object.entries(evidence.before).every(([file, body]) => c.files[file] === body),
        ),
      ),
      detail: "all application, policy and organization inputs",
    },
    {
      label: "equivalent repeat performs no official writes",
      pass: Boolean(
        complete &&
        same(official(applied), official(repeated)) &&
        requests.filter((e) => e.turn === 3).every(reportOnly),
      ),
      detail: "byte equality and mutation events",
    },
  ];
}

function scenario(kind) {
  const decisions = decisionsFor(kind),
    edges = edgesFor(kind);
  const projection = kind === "projection";
  const item = {
    id: `import-prerequisites-${kind === "cross" ? "cross-category" : kind === "within" ? "same-category" : "projection-cycle"}`,
    skill: "adr-import",
    title: projection
      ? "Category projection defers affected decisions while independent approval proceeds"
      : kind === "within"
        ? "Within-category prerequisite survives in ADR prose without a self-edge"
        : "Cross-category required guarantee and its owner survive adoption",
    sources: ["authored synthetic stock/order/support fixture"],
    adaptation: "Local synthetic behavior only; no external service or historical adoption claim.",
    artifactPaths: [REPORT],
    decisions,
    edges,
    approvedIds: projection ? ["lookup"] : decisions.map((d) => d.id),
    build: () => buildFixture(kind),
    turns: [
      `Use adr-import to inspect this entire synthetic local project. Preserve the confirmed grouping in README. Show the four discovery views and reviewable decision drafts in ${REPORT}, with report-local IDs ${decisions.map((d) => d.id).join(", ")}. Identify actual prerequisite guarantees and owners, distinguish workflow timing from dependencies, and check projection into category dependsOn. Collect missing intent and grouping questions together. Official ADR/index writes are not yet approved. This fixture requests one Markdown report instead of HTML; rules and Git ignore setup are already supplied. Do not contact external systems or alter source.`,
      `I confirm these current contracts and reasons: prevent unavailable-stock confirmation, preserve cancellation before release, and limit support visibility to the owning member where applicable. Original history remains unknown. Keep the supplied grouping. Use the following chosen ADR paths and preserve each exact authored contract clause verbatim under Decision / Requirement contract:\n${decisions.map((d) => `${d.id}: ${d.path} — ${d.title}\n${d.contract}`).join("\n")}\nFor each dependent ADR also retain these exact clauses there:\n${edges.map((e) => `${e.dependent}:\n${prerequisiteClauses(e).join("\n")}`).join("\n")}\nKeep these confirmed edge lines verbatim in the report, including while pending (arrow meaning: dependent requires owner):\n${edges.map(edgeLine).join("\n")}\n${projection ? "I approve the contract contents above for Proposed adoption within the confirmed grouping and existing schema. Determine which decisions can be applied without losing a required guarantee or creating a category cycle. Keep structurally unresolved decisions pending and explain the ownership/grouping question; continue independently applicable decisions through validation. Do not silently drop edges, write pending ADRs even temporarily, invent common/placeholder owners, change the mapping schema or regroup categories." : "I approve these decisions for official Proposed adoption now. Preserve prerequisite guarantees and their owners in the dependent ADRs as well as the valid category dependencies. Same-category prerequisites must not create self-edges. Validate the approved result."} Code, existing rules and historical records must stay unchanged.`,
      `Repeat adr-import with the same confirmed input and approval scope. Keep ${projection ? "reserve, confirm, cancel and release pending, and lookup adopted" : "the adopted decisions unchanged"}. Do not rewrite official files, dates, statuses or index when meaning is unchanged. Retain the confirmed edge lines in the report and state applied, unchanged and deferred scope accurately.`,
    ],
    obligations: [
      {
        id: "four-stage-discovery",
        text: "From the actual local source/tests reconstruct reservation and confirmation success/rejection, then business ownership, independent decision candidates and required guarantees. In the projection fixture include cancellation/release failures and member-scoped support lookup. Distinguish one repository/one process from business categories. Use the report to connect all four views and observed evidence; do not invent historical intent or uninspected external behavior.",
      },
      {
        id: "prerequisite-meaning",
        text: `Confirmation needs Stock reservation's positive-integer/available-stock guarantee to prevent unavailable-stock confirmation. ${projection ? "Keep that owner and guarantee, and release's cancellation prerequisite, in the pending report drafts; this case must not create their official ADRs." : "Explain the guarantee and owner in the adopted dependent ADR at decision resolution, not solely in a Related link or disposable report. The same requirement applies within one category without a self-edge."} Preserve exact authored clauses and avoid contradicting them elsewhere; a keyword match is not proof of meaning.`,
      },
      {
        id: "projection-and-ownership",
        text: projection
          ? "The required decision edges are confirm -> reserve and release -> cancel, where arrows mean depends on. These are acyclic. Category projection produces ordering -> inventory and inventory -> ordering, overstates prerequisites for other decisions in those categories and is cyclic. Do not infer cancel -> confirm merely from lifecycle order or lookup prerequisites from its order input. Preserve both real guarantees and owners; explain the projection conflict and leave all four affected official decisions pending while adopting independent lookup. Do not hide an edge, invent a synthetic owner, regroup unilaterally or modify the schema."
          : "Preserve the confirmed business grouping. Cross-category confirmation requires inventory in ordering.dependsOn; within-category reservation/confirmation must remain two decisions in ordering with no self-edge. Category edges are not exact ADR-level edges. Persist the necessary guarantee and actual owner in the dependent ADR so it can be read without the report.",
      },
      {
        id: "approval-and-repeat",
        text: "Discovery does not authorize official writes. Apply only the explicitly approved decisions as Proposed with current rationale, exact contracts and observable evidence; original adoption history remains unknown. Keep pending questions visible, do not claim full completion of deferred work, and make equivalent repeat a no-op. No placeholder, hidden candidate omission or unapproved application may be disguised by restoring files later.",
      },
    ],
  };
  item.verifyEvidence = (evidence) => verifyImportPrerequisites(evidence, item);
  return item;
}

export const importPrerequisiteCases = [
  scenario("cross"),
  scenario("within"),
  scenario("projection"),
];
