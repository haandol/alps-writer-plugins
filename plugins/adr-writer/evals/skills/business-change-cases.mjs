// Execution cases for the business process "business-change": a change requested
// during development is settled at the level that owns its meaning. Each case
// executes one of the process's observation criteria through the real entry
// points of its realizing features — Ontology Writer's business-context query
// and model change unit (impact, one approval, apply) and ADR Writer's ADR
// revision with its checks — in a small course-enrollment project with both
// plugins installed. Local gates check observable actions, their order and the
// files; meaning stays with each case's obligations. `criterion` names the
// observation criterion a case executes; `reportGroup` names its result-report
// subgroup, at most four cases each.
import { mutationRequests } from "../lib/import-evidence.mjs";
import { MODEL_DIR, MODEL_TOOL, targetsModel } from "../regression/model-change.mjs";

/** The authored business model: two processes joined by events and one cross-step rule. */
const MODEL = `@prefix m: <urn:ontology-writer:model:> .
@prefix onto: <urn:ontology-writer:vocabulary:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:billing-system a onto:Actor ;
    rdfs:label "수강료 결제 시스템" ;
    onto:definition "신청의 수강료를 받는 시스템 역할." ;
    onto:performs m:billing.collect-fee .

m:enrollment-system a onto:Actor ;
    rdfs:label "수강 신청 시스템" ;
    onto:definition "결제된 신청의 좌석을 자동으로 확정하는 시스템 역할." ;
    onto:performs m:enrollment.confirm-seat .

m:student a onto:Actor ;
    rdfs:label "학생" ;
    onto:definition "강좌를 신청하는 사람." ;
    onto:performs m:enrollment.request-seat .

m:billing a onto:BoundedContext ;
    rdfs:label "수강료 결제" ;
    onto:definition "신청한 강좌의 수강료를 받는 경계." ;
    onto:coreLogic "좌석 신청이 들어오면 수강료를 받고, 결제가 끝나면 그 사실을 수강 신청에 알린다." .

m:enrollment a onto:BoundedContext ;
    rdfs:label "수강 신청" ;
    onto:definition "학생이 강좌 좌석을 신청하고 확정받는 경계." ;
    onto:coreLogic "학생의 좌석 신청을 받아 수강료 결제를 요청하고, 결제가 끝난 신청의 좌석을 확정한다." ;
    onto:collaboratesWith m:billing .

m:billing.fee-payment a onto:BusinessConcept ;
    rdfs:label "수강료 납부" ;
    onto:definition "한 신청의 수강료를 받은 기록." ;
    onto:inContext m:billing .

m:enrollment.application a onto:BusinessConcept ;
    rdfs:label "수강 신청서" ;
    onto:definition "학생이 한 강좌의 좌석을 요청한 기록." ;
    onto:inContext m:enrollment .

m:billing.fee-paid a onto:BusinessEvent ;
    rdfs:label "수강료 결제됨" ;
    onto:definition "신청의 수강료가 결제되었다." ;
    onto:triggers m:enrollment.confirm-on-payment ;
    onto:inContext m:billing .

m:enrollment.seat-confirmed a onto:BusinessEvent ;
    rdfs:label "좌석 확정됨" ;
    onto:definition "학생의 좌석이 확정되었다." ;
    onto:inContext m:enrollment .

m:enrollment.seat-requested a onto:BusinessEvent ;
    rdfs:label "좌석 신청됨" ;
    onto:definition "학생이 강좌 좌석을 신청했다." ;
    onto:triggers m:billing.charge-on-request ;
    onto:inContext m:enrollment .

m:billing.collect a onto:Process ;
    rdfs:label "수강료 받기" ;
    onto:definition "학원이 신청된 좌석의 수강료를 받는다." ;
    onto:startCondition "학생이 좌석을 신청했다." ;
    onto:businessOutcome "신청의 수강료가 결제되었다." ;
    onto:openScope "결제가 거절된 신청의 처리."^^onto:OpenPath ;
    onto:summary "수강료 청구에서 결제 완료까지." ;
    onto:status "Accepted (2026-10-01)" ;
    onto:hasStep m:billing.collect-fee .

m:enrollment.enroll a onto:Process ;
    rdfs:label "강좌 수강 신청" ;
    onto:definition "학생이 강좌 좌석을 신청하고 결제한 뒤 좌석을 확정받는다." ;
    onto:startCondition "학생이 강좌 좌석을 신청한다." ;
    onto:businessOutcome "학생의 좌석이 확정되고 학생이 그 좌석을 볼 수 있다." ;
    onto:openScope "정원이 찬 강좌의 대기 신청."^^onto:OpenPath ;
    onto:summary "좌석 신청에서 좌석 확정까지." ;
    onto:status "Accepted (2026-10-01)" ;
    onto:hasStep m:enrollment.confirm-seat, m:enrollment.request-seat .

m:billing.collect-fee a onto:Step ;
    rdfs:label "수강료 결제" ;
    onto:definition "수강료 결제 시스템이 신청의 수강료를 받는다." ;
    onto:stepKind "system" ;
    onto:emits m:billing.fee-paid ;
    onto:uses m:billing.fee-payment ;
    onto:inContext m:billing .

m:enrollment.confirm-seat a onto:Step ;
    rdfs:label "좌석 확정" ;
    onto:definition "수강 신청 시스템이 결제된 신청의 좌석을 확정한다." ;
    onto:stepKind "system" ;
    onto:emits m:enrollment.seat-confirmed ;
    onto:uses m:enrollment.application ;
    onto:inContext m:enrollment .

m:enrollment.request-seat a onto:Step ;
    rdfs:label "좌석 신청" ;
    onto:definition "학생이 강좌 좌석을 신청한다." ;
    onto:stepKind "system" ;
    onto:flowsTo m:enrollment.confirm-seat ;
    onto:emits m:enrollment.seat-requested ;
    onto:uses m:enrollment.application ;
    onto:inContext m:enrollment .

m:billing.charge-on-request a onto:Policy ;
    rdfs:label "신청 즉시 수강료 청구" ;
    onto:definition "새 좌석 신청마다 수강료를 청구한다." ;
    onto:reactionCondition "신청에 아직 결제가 없다." ;
    onto:basisKind "user-decision" ;
    onto:basis "학원은 신청 직후 수강료를 받기로 정했다." ;
    onto:starts m:billing.collect-fee ;
    onto:inContext m:billing .

m:enrollment.confirm-on-payment a onto:Policy ;
    rdfs:label "결제 후 좌석 확정" ;
    onto:definition "결제된 신청의 좌석을 확정한다." ;
    onto:reactionCondition "결제가 그 신청의 것이다." ;
    onto:basisKind "operating-policy" ;
    onto:basis "학원 운영 정책: 결제되지 않은 좌석은 확정하지 않는다." ;
    onto:starts m:enrollment.confirm-seat ;
    onto:uses m:enrollment.application ;
    onto:inContext m:enrollment .

m:enrollment.full-fee-before-seat a onto:BusinessRule ;
    rdfs:label "전액 결제 뒤 좌석 확정" ;
    onto:definition "좌석은 그 신청의 수강료 전액이 결제된 뒤에만 확정된다." ;
    onto:basisKind "operating-policy" ;
    onto:basis "학원 회계 정책: 미수금이 남은 좌석은 확정하지 않는다." ;
    onto:constrains m:billing.collect-fee, m:enrollment.confirm-seat .

m:billing.collect.paid a onto:ObservationCriterion ;
    rdfs:label "신청의 수강료 결제" ;
    onto:startCondition "학생이 좌석을 신청했다." ;
    onto:observedResult "신청의 수강료가 결제된 것으로 보인다." ;
    onto:criterionOf m:billing.collect ;
    onto:passesThrough m:billing.fee-paid .

m:enrollment.enroll.confirmed a onto:ObservationCriterion ;
    rdfs:label "신청한 좌석의 확정" ;
    onto:startCondition "학생이 좌석을 신청하고 수강료를 결제한다." ;
    onto:observedResult "학생이 확정된 좌석을 본다." ;
    onto:criterionOf m:enrollment.enroll ;
    onto:passesThrough m:billing.fee-paid, m:enrollment.seat-confirmed, m:enrollment.seat-requested .
`;

const P = {
  model: `${MODEL_DIR}/enrollment.ttl`,
  billing: "docs/adr/billing/fee/0001-collect-course-fee.md",
  seat: "docs/adr/enrollment/seat/0001-confirm-paid-seat.md",
  request: "docs/adr/enrollment/apply/0001-accept-seat-request.md",
  mapping: "docs/adr/.mapping.json",
};
/** The disposable ADR candidate tree prepare_draft creates. */
export const DRAFT_ROOT = ".adr-review/adr-revision";
/** The cross-step rule both dependent rows rely on, by its model id. */
export const RULE = "enrollment.full-fee-before-seat";
/** The rows that rely on the rule's current meaning, and the value-only row. */
export const ROWS = {
  billing: "수강료는 신청 금액 전액을 한 번에 결제받는다.",
  seat: "좌석은 그 신청의 수강료 전액이 결제된 것을 확인한 뒤에만 확정한다.",
  attempts: "카드 결제 시도는 신청당 최대 3회이며, 4번째 시도는 거절되고 신청은 미결제로 남는다.",
};

function adr({ title, purpose, drivers, decision, rows, alternatives }) {
  return `# ADR 0001: ${title}

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

${purpose}

## Decision Drivers

${drivers.map((d) => `- ${d}`).join("\n")}

## Decision

${decision}

### Requirement contract

${rows.map((r) => `- ${r}`).join("\n")}

## Alternatives

${alternatives.map((a, i) => `${i + 1}. ${a}`).join("\n")}

## Consequences

### Positive

- 학생과 학원이 좌석과 수강료 상태를 같은 기준으로 본다.

### Negative

- 결제 방식이 늘면 같은 계약을 방식마다 다시 확인해야 한다.
`;
}

const record = (path, summary) => ({ path, status: "Accepted (2026-10-01)", summary });

/** A course-enrollment project with ADR Writer and Ontology Writer installed. */
export function courseEnrollment() {
  return {
    "package.json": '{"private":true,"type":"module"}\n',
    "README.md": "# 수강 신청\n\n로컬 검증: node --test test/policy.test.mjs\n",
    ".adr-review/.gitignore": "*\n",
    [P.model]: MODEL,
    [P.billing]: adr({
      title: "신청의 수강료를 한 번에 받는다",
      purpose:
        "학원은 좌석을 확정하기 전에 그 신청의 수강료를 받아야 하고, 학생이 같은 신청에 두 번 청구되면 안 된다.",
      drivers: [
        "미수금이 남은 좌석이 생기지 않아야 한다.",
        "학생이 같은 신청에 두 번 청구되지 않아야 한다.",
        "결제 거절이 반복될 때 결제 위험을 제한해야 한다.",
      ],
      decision:
        "좌석 신청마다 수강료 전액을 카드로 한 번에 받고, 결제가 끝나면 수강료 결제됨을 알린다.",
      rows: [
        `${ROWS.billing} 일부 금액만 결제하는 신청은 받지 않는다. — 학원 회계 정책`,
        `${ROWS.attempts} — 결제 위험 정책`,
        "결제가 끝나면 수강료 결제됨을 신청 번호, 결제 금액과 함께 한 번 알린다. 같은 결제 요청이 다시 와도 새로 청구하거나 다시 알리지 않는다.",
      ],
      alternatives: [
        "**신청 뒤 수동 청구** — 담당자가 늦게 청구하면 좌석 확정이 늦어진다.",
        "**신청 시 자동 결제 (채택)** — 신청 직후 결제가 끝난다.",
      ],
    }),
    [P.request]: adr({
      title: "좌석 신청을 접수한다",
      purpose:
        "학생이 강좌 좌석을 신청할 수 있어야 하고, 한 학생이 같은 강좌에 신청을 중복해 남기면 안 된다.",
      drivers: [
        "한 학생의 같은 강좌 신청은 하나여야 한다.",
        "신청 직후 결제가 시작되어야 한다.",
        "학생이 신청 결과를 바로 알아야 한다.",
      ],
      decision: "학생의 좌석 신청을 접수하고 좌석 신청됨을 알린다.",
      rows: [
        "한 학생은 한 강좌에 진행 중인 신청을 하나만 가진다. 두 번째 신청은 거절되고 기존 신청이 유지된다.",
        "신청이 접수되면 좌석 신청됨을 신청 번호와 함께 한 번 알린다.",
      ],
      alternatives: [
        "**대기 명단 먼저 작성** — 신청과 결제가 분리되어 확정이 늦어진다.",
        "**즉시 신청 접수 (채택)** — 신청 직후 결제가 시작된다.",
      ],
    }),
    [P.seat]: adr({
      title: "결제된 신청의 좌석을 확정한다",
      purpose:
        "학원은 수강료를 받은 신청에만 좌석을 내주어야 하고, 학생은 확정된 좌석을 바로 볼 수 있어야 한다.",
      drivers: [
        "미수금이 남은 좌석이 확정되지 않아야 한다.",
        "같은 결제 알림이 두 번 와도 좌석은 하나여야 한다.",
        "강좌 정원을 넘는 좌석이 생기지 않아야 한다.",
      ],
      decision: "수강료 결제됨을 받으면 그 신청의 결제 금액을 확인하고 좌석을 확정한다.",
      rows: [
        `${ROWS.seat} 결제 금액이 수강료보다 적으면 확정하지 않고 신청은 결제 대기로 남는다.`,
        "같은 신청의 수강료 결제됨이 두 번 와도 좌석은 한 번만 확정한다.",
        "강좌 정원은 30석이며 정원을 넘는 좌석은 확정하지 않는다.",
      ],
      alternatives: [
        "**담당자 수동 확정** — 결제 확인이 늦어진다.",
        "**결제 알림에 따른 자동 확정 (채택)** — 결제 직후 좌석이 확정된다.",
      ],
    }),
    [P.mapping]:
      JSON.stringify(
        {
          categories: {
            "billing/fee": {
              feature: "수강료 결제",
              adrs: [
                record(P.billing, "좌석 신청의 수강료 전액을 카드로 한 번에 받고 결제됨을 알린다"),
              ],
              dependsOn: [],
              realizes: ["billing.collect-fee"],
            },
            "enrollment/apply": {
              feature: "좌석 신청",
              adrs: [record(P.request, "학생의 좌석 신청을 접수하고 신청됨을 알린다")],
              dependsOn: [],
              realizes: ["enrollment.request-seat"],
            },
            "enrollment/seat": {
              feature: "좌석 확정",
              adrs: [record(P.seat, "전액 결제된 신청의 좌석을 정원 안에서 한 번 확정한다")],
              dependsOn: ["billing/fee"],
              realizes: ["enrollment.confirm-seat"],
            },
          },
        },
        null,
        2,
      ) + "\n",
    "src/policy.mjs": `export const MAX_CARD_ATTEMPTS = 3;
export const SEAT_CAPACITY = 30;
export function canAttemptCard(previousAttempts) {
  return previousAttempts < MAX_CARD_ATTEMPTS;
}
export function canConfirmSeat({ fee, paid, alreadyConfirmed, confirmedSeats }) {
  if (alreadyConfirmed) return false;
  return paid >= fee && confirmedSeats < SEAT_CAPACITY;
}
`,
    "test/policy.test.mjs": `import test from "node:test";
import assert from "node:assert/strict";
import * as policy from "../src/policy.mjs";

test("a fourth card attempt is rejected", () => {
  assert.equal(policy.canAttemptCard(2), true);
  assert.equal(policy.canAttemptCard(3), false);
});
test("a seat is confirmed only after the full fee is paid", () => {
  const seat = { fee: 100, alreadyConfirmed: false, confirmedSeats: 0 };
  assert.equal(policy.canConfirmSeat({ ...seat, paid: 100 }), true);
  assert.equal(policy.canConfirmSeat({ ...seat, paid: 50 }), false);
});
test("a repeated payment notice confirms no second seat and the capacity holds", () => {
  assert.equal(policy.canConfirmSeat({ fee: 100, paid: 100, alreadyConfirmed: true, confirmedSeats: 0 }), false);
  assert.equal(policy.canConfirmSeat({ fee: 100, paid: 100, alreadyConfirmed: false, confirmedSeats: 30 }), false);
});
`,
  };
}

// ── Observable facts the verifiers share ───────────────────────────────────
const check = (label, pass, detail = "") => ({ label, pass: Boolean(pass), detail });
const resultOf = (events, request) =>
  events.find((e) => e.kind === "result" && e.request === request.seq);
const succeeded = (events, request) => {
  const result = resultOf(events, request);
  return (
    result?.ok === true && (result.result?.exitCode === undefined || result.result.exitCode === 0)
  );
};
const targets = (e) => [e.arguments?.path, e.arguments?.from, e.arguments?.to];
const official = (file) => typeof file === "string" && file.startsWith("docs/");
const officialRequests = (events) =>
  mutationRequests(events).filter((e) => targets(e).some(official));
const officialAdrRequests = (events) =>
  mutationRequests(events).filter((e) => targets(e).some((f) => f?.startsWith("docs/adr/")));
/** ADR revision writes in the candidate tree or the official documents. */
const adrRevisions = (events) =>
  events.filter(
    (e) =>
      e.kind === "request" &&
      e.tool === "write_file" &&
      [`${DRAFT_ROOT}/docs/adr/`, "docs/adr/"].some((root) => e.arguments?.path?.startsWith(root)),
  );
const modelRequests = (events, action) =>
  events.filter(
    (e) =>
      e.kind === "request" && e.tool === MODEL_TOOL && (!action || e.arguments?.action === action),
  );
/** Successful impact runs on a valid draft that differs from the model: shown proposals. */
function proposals(events) {
  return modelRequests(events, "impact").flatMap((request) => {
    if (!succeeded(events, request)) return [];
    try {
      const summary = JSON.parse(resultOf(events, request).result.stdout);
      return summary?.draftValid === true &&
        summary.same === false &&
        /^[0-9a-f]{64}$/.test(summary.baseHash ?? "")
        ? [{ request, summary }]
        : [];
    } catch {
      return [];
    }
  });
}
const modelFiles = (files) =>
  JSON.stringify(
    Object.entries(files)
      .filter(([file]) => file.startsWith(`${MODEL_DIR}/`))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
/** The requirement contract section of an ADR body, or the whole body without one. */
function contractLines(text = "") {
  const lines = text.split("\n");
  const start = lines.findIndex((line) =>
    /^#{2,4}\s.*(requirement contract|요구사항 계약)/i.test(line),
  );
  if (start < 0) return lines;
  const end = lines.findIndex((line, index) => index > start && /^#{1,3}\s/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

const allTurnsCaptured = ({ replies = [], turns = [] }) =>
  check("every user turn was captured", turns.length > 0 && replies.length === turns.length);
/** The query returned the cross-step rule before the step that classified the change. */
function contextFirst(events, seq, what) {
  const query = events.find(
    (e) =>
      e.kind === "result" &&
      e.tool === "query_business_context" &&
      e.ok === true &&
      typeof e.result === "string" &&
      e.result.includes(RULE),
  );
  return check(
    `the business context with the cross-step rule was returned before ${what}`,
    query && seq !== undefined && query.seq < seq,
    query ? `query result #${query.seq}, classified at #${seq ?? "none"}` : "no such query result",
  );
}
const modelOnlyThroughTool = (events) =>
  check(
    "no document tool request targets the model; only the change tool can change it",
    !events.some((e) => e.kind === "request" && targetsModel(e, DRAFT_ROOT)),
  );
const firstTurnKeepsDocuments = (events) =>
  check(
    "the approval-pending first turn requests no official document change",
    officialRequests(events).every((e) => e.turn !== 1),
  );
const shownBeforeDecision = (events) =>
  check(
    "a valid model change proposal was shown in the first turn",
    proposals(events).some((p) => p.request.turn === 1),
  );

/** A model proposal comes first; nothing is settled, applied or saved without approval. */
export function verifyMeaningFirst(evidence) {
  const { before = {}, after = {}, events = [] } = evidence;
  const proposal = proposals(events)[0];
  const revisions = adrRevisions(events);
  return [
    allTurnsCaptured(evidence),
    contextFirst(events, modelRequests(events)[0]?.seq, "the first model change step"),
    check("a valid model change proposal with a semantic difference was prepared", proposal),
    check(
      "no ADR revision, candidate or official, was written before that proposal",
      proposal && revisions.every((e) => e.seq > proposal.request.seq),
      `${revisions.length} ADR revision writes`,
    ),
    check("no model change apply was requested", !modelRequests(events, "apply").length),
    check(
      "no turn requested an official document change, even temporarily",
      !officialRequests(events).length,
      `${officialRequests(events).length} official document requests`,
    ),
    check(
      "every original document is byte-identical and none was added",
      Object.entries(before)
        .filter(([file]) => official(file))
        .every(([file, text]) => after[file] === text) &&
        Object.keys(after)
          .filter(official)
          .every((file) => file in before),
    ),
    modelOnlyThroughTool(events),
  ];
}

/** The approved change is saved as shown, and the dependent rows are settled only after it. */
export function verifyApprovedMeaning(evidence, { approvalTurn = 2 } = {}) {
  const { before = {}, after = {}, events = [] } = evidence;
  const applies = modelRequests(events, "apply");
  const saved = applies.filter((e) => succeeded(events, e));
  const savedResult = saved[0] && resultOf(events, saved[0]);
  const adrWrites = officialAdrRequests(events);
  return [
    allTurnsCaptured(evidence),
    contextFirst(events, modelRequests(events)[0]?.seq, "the first model change step"),
    shownBeforeDecision(events),
    firstTurnKeepsDocuments(events),
    check(
      "no apply was requested before the approval turn",
      applies.every((e) => e.turn >= approvalTurn),
    ),
    check(
      "the model change was saved once, after the approval",
      saved.length === 1 && saved[0].turn >= approvalTurn,
      `${saved.length} successful of ${applies.length} apply requests`,
    ),
    check(
      "the saved change carries the base hash of the proposal shown before approval",
      saved[0] &&
        proposals(events).some(
          (p) =>
            p.request.turn < approvalTurn && p.summary.baseHash === saved[0].arguments?.baseHash,
        ),
    ),
    check(
      "the model documents changed",
      after[P.model] !== before[P.model] && modelFiles(after) !== modelFiles(before),
    ),
    check(
      "both ADRs whose rows relied on the rule were revised",
      typeof after[P.billing] === "string" &&
        typeof after[P.seat] === "string" &&
        after[P.billing] !== before[P.billing] &&
        after[P.seat] !== before[P.seat],
    ),
    check(
      "every official ADR or index change came after the model change was saved",
      savedResult && adrWrites.every((e) => e.seq > savedResult.seq),
      `${adrWrites.length} official ADR requests`,
    ),
    modelOnlyThroughTool(events),
  ];
}

/** A declined change leaves the model as it is and the dependent rows in the current meaning. */
export function verifyDeclinedMeaning(evidence) {
  const { before = {}, after = {}, events = [] } = evidence;
  return [
    allTurnsCaptured(evidence),
    contextFirst(events, modelRequests(events)[0]?.seq, "the first model change step"),
    shownBeforeDecision(events),
    firstTurnKeepsDocuments(events),
    check("no apply was requested in any turn", !modelRequests(events, "apply").length),
    check("the model documents are byte-identical", modelFiles(after) === modelFiles(before)),
    ...[
      [P.billing, ROWS.billing],
      [P.seat, ROWS.seat],
    ].map(([file, row]) =>
      check(
        `${file} keeps its rule-dependent row in the current meaning or marks it pending`,
        typeof after[file] === "string" &&
          (after[file].includes(row) ||
            contractLines(after[file]).some((line) => /미정|pending/i.test(line))),
      ),
    ),
    modelOnlyThroughTool(events),
  ];
}

/** A value-only change is settled in its ADR without any model proposal. */
export function verifyContractOnly(evidence) {
  const { before = {}, after = {}, events = [] } = evidence;
  return [
    allTurnsCaptured(evidence),
    contextFirst(events, adrRevisions(events)[0]?.seq, "the first ADR revision"),
    check(
      "no model change was drafted, checked or applied",
      !modelRequests(events).length,
      `${modelRequests(events).length} model change requests`,
    ),
    check("the model documents are byte-identical", modelFiles(after) === modelFiles(before)),
    firstTurnKeepsDocuments(events),
    check(
      "the payments ADR holds the new attempt limit in place of the old row",
      typeof after[P.billing] === "string" &&
        !after[P.billing].includes(ROWS.attempts) &&
        contractLines(after[P.billing]).some((line) => /(^|[^0-9])5\s*회/.test(line)),
    ),
    check(
      "the ADRs of the other features are unchanged",
      after[P.seat] === before[P.seat] && after[P.request] === before[P.request],
    ),
    modelOnlyThroughTool(events),
  ];
}

const obligation = (id, text) => ({ id, text });
/** The user withholds only official saves; disposable drafts and checks stay allowed, as in rollup cases. */
const NO_OFFICIAL_SAVE =
  "아직 공식 업무 모델·ADR·색인의 저장은 승인하지 않아. 필요한 초안과 검사는 .adr-review/ 아래에서 해도 돼.";
const MEANING_REQUEST = [
  "/adr-new enrollment/seat 좌석 확정 규칙을 바꿔 줘.",
  "학원이 2026-11-27에 회계 정책을 바꿔서, 학생이 신청 직후 수강료의 절반을 선금으로 카드 결제하면 잔금이 남아 있어도 좌석을 확정하기로 했어.",
  "첫 결제는 항상 선금 절반이고 처음부터 전액을 내는 선택지는 없어. 수강료는 항상 짝수 원이라 끝수는 생기지 않아.",
  "잔금은 수강료 결제 시스템이 강좌 개강 7일 전에 같은 카드로 자동 청구해서 받고, 잔금이 결제돼도 좌석 상태는 바뀌지 않아.",
  "카드 결제 시도 한도 3회는 선금 결제와 잔금 청구에 각각 따로 적용해. 용어는 선금과 잔금으로 써.",
  "잔금 청구가 끝내 실패하거나 개강 전까지 잔금이 들어오지 않은 신청의 처리는 이번에 정하지 않고 열어 둘 거야.",
  `구현은 이번 작업에 넣지 말고, 바꿀 내용과 승인 질문은 대화로 보여 줘. ${NO_OFFICIAL_SAVE}`,
].join(" ");
const proposalFirst = obligation(
  "proposal-first",
  "첫 응답은 업무 맥락 조회 결과를 근거로 이 요청이 수강료 결제와 좌석 확정 두 단계에 걸친 업무 규칙(전액 결제 뒤 좌석 확정)의 뜻을 바꾸고 잔금 청구 흐름을 더한다고 판단한다. ADR 개정보다 먼저 검증한 업무 모델 변경안(바뀌는 규칙의 뜻, 더해지는 흐름, 영향받는 프로세스와 기능)을 제시하고, 모델 변경과 그에 따른 ADR 개정을 하나의 승인으로 묻는다. 요청이 이미 정한 값이나 조건을 다시 정해 달라고 묻지 않는다. 요청이 다루지 않은 경우를 묻거나 요청에서 끌어낸 보완 조항을 확인받는 것, 승인을 막지 않는 선택 제안은 허용된다. 공식 업무 모델·ADR·색인은 저장하지 않으며, `.adr-review/` 아래의 일회용 초안과 검사는 저장이 아니다.",
);
const meaningOnly = obligation(
  "meaning-only",
  "모델 변경안은 절반, 개강 7일 전, 시도 3회 같은 정확한 값을 담지 않고 업무 뜻만 바꾸며, 그 값은 ADR 계약 쪽에 둔다. 사용자가 열어 두기로 한 잔금 청구 실패·미납 처리는 흐름이나 규칙으로 지어내지 않고 열린 범위로 남긴다.",
);
const shared = {
  skill: "adr-new",
  impactSkills: ["adr-new", "adr-impl", "ontology-edit"],
  requiredGuidance: ["SKILL.md", "../../references/business-context.md"],
  sources: ["authored course-enrollment fixture"],
  build: courseEnrollment,
  businessContext: true,
  draftRoot: DRAFT_ROOT,
  // Reading both plugins' guidance before the first proposal takes the default model past 10 minutes.
  agentTimeoutMs: 1_200_000,
};

export const businessChangeCases = [
  {
    ...shared,
    id: "business-change-meaning-first-proposes-model",
    criterion: "business-change.meaning-first",
    reportGroup: "업무 의미 변경",
    title: "여러 단계 규칙의 뜻을 바꾸는 요청은 ADR보다 모델 변경안을 먼저 제시",
    adaptation:
      "업무 변경 반영 프로세스의 관찰 기준 meaning-first를 실행한다. 두 플러그인이 설치된 작은 수강 신청 프로젝트에서 사용자가 전액 결제 뒤 좌석 확정 규칙의 뜻을 바꾸도록 요청하고, 승인 전에 대화가 끝난다.",
    modelChange: {},
    turns: [MEANING_REQUEST],
    obligations: [
      proposalFirst,
      meaningOnly,
      obligation(
        "pending",
        "승인 전에는 그 규칙에 기대는 ADR 계약(전액 결제 확인 뒤 좌석 확정, 전액 일괄 결제)을 새 뜻으로 확정하거나 공식 문서에 저장·구현하지 않고, 승인 뒤의 순서(모델 저장, ADR 개정 저장, 구현, 정렬 검토)를 설명한다.",
      ),
    ],
    verifyEvidence: verifyMeaningFirst,
  },
  {
    ...shared,
    id: "business-change-approved-meaning-settles-rows",
    criterion: "business-change.approved-meaning",
    reportGroup: "업무 의미 변경",
    title: "승인된 뜻을 모델에 저장한 뒤에만 그 뜻에 기대던 ADR 계약을 확정",
    adaptation:
      "업무 변경 반영 프로세스의 관찰 기준 approved-meaning을 실행한다. meaning-first와 같은 요청 뒤 사용자가 보여 준 모델 변경과 ADR 개정을 승인한다.",
    modelChange: { approvalTurn: 2 },
    turns: [
      MEANING_REQUEST,
      "보여 준 변경 묶음, 즉 업무 모델 변경과 그에 따른 ADR 개정을 그대로 승인해. 적용하고 결과를 대화로 알려 줘.",
    ],
    obligations: [
      proposalFirst,
      obligation(
        "apply-then-revise",
        "두 번째 발화의 승인 뒤 첫 응답에서 보인 모델 변경을 그대로 먼저 저장하고, 저장이 성공한 뒤에만 그 규칙에 기대던 수강료 결제와 좌석 확정 ADR 계약을 새 뜻(수강료 절반 선금 결제 뒤 좌석 확정, 잔금은 결제 시스템이 개강 7일 전 자동 청구)으로 확정한다.",
      ),
      obligation(
        "contracts",
        "개정한 ADR은 Proposed이고 절반·개강 7일 전 같은 값은 ADR에만 있으며, 결제 시도 한도(선금·잔금 각각 3회), 정원, 중복 확정 방지 같은 계약을 보존한다. 잔금 청구 실패·미납 처리는 지어내지 않는다. 그 처리가 아직 정해지지 않았다는 사실과 그동안의 결과나 위험을 적는 것은 지어내기가 아니다.",
      ),
      obligation(
        "report",
        "실제로 저장된 모델 변경, Proposed가 된 프로세스와 개정한 ADR을 사실대로 보고하고, 구현과 정렬 검토를 남은 다음 단계로 안내하며 구현은 하지 않는다.",
      ),
    ],
    verifyEvidence: verifyApprovedMeaning,
  },
  {
    ...shared,
    id: "business-change-declined-meaning-keeps-rows",
    criterion: "business-change.declined-meaning",
    reportGroup: "업무 의미 변경",
    title: "거절된 뜻은 모델에 저장하지 않고 그 뜻에 기대던 ADR 계약을 현재 뜻으로 유지",
    adaptation:
      "업무 변경 반영 프로세스의 관찰 기준 declined-meaning을 실행한다. meaning-first와 같은 요청 뒤 사용자가 업무 규칙 변경을 거절하고 현재 뜻을 유지하도록 정한다.",
    modelChange: {},
    turns: [
      MEANING_REQUEST,
      "업무 규칙 변경은 승인하지 않을게. 업무 모델은 지금 뜻 그대로 두고, 그 규칙에 기대는 ADR 계약도 현재 뜻대로 유지해 줘. 결과를 대화로 알려 줘.",
    ],
    obligations: [
      proposalFirst,
      obligation(
        "no-model-change",
        "두 번째 발화의 거절 뒤 업무 모델 변경을 저장하지 않고 같은 승인을 다시 요청하지 않는다.",
      ),
      obligation(
        "current-meaning",
        "그 규칙에 기대던 수강료 결제와 좌석 확정 ADR 계약을 현재 뜻(수강료 전액 결제 뒤 좌석 확정)대로 유지하며, 거절된 선금 절반 결제 뒤 확정이라는 뜻을 확정된 계약으로 저장하거나 구현하지 않는다.",
      ),
      obligation(
        "report",
        "거절에 따라 업무 모델과 ADR이 바뀌지 않았음을 실제 파일 상태대로 보고하고, 남긴 초안이 저장되지 않은 임시 자료임을 밝힌다.",
      ),
    ],
    verifyEvidence: verifyDeclinedMeaning,
  },
  {
    ...shared,
    id: "business-change-contract-only-revises-adr",
    criterion: "business-change.contract-only",
    reportGroup: "결정 기록만의 변경",
    title: "규칙의 뜻을 바꾸지 않는 값 변경은 모델 제안 없이 ADR에서 확정",
    adaptation:
      "업무 변경 반영 프로세스의 관찰 기준 contract-only를 실행한다. 같은 프로젝트에서 사용자가 카드 결제 시도 한도라는 정확한 값만 바꾸도록 요청하고 ADR 개정안을 승인한다.",
    modelChange: {},
    turns: [
      `/adr-new billing/fee 카드 결제 시도 한도를 신청당 3회에서 5회로 늘려 줘. 구현은 이번 작업에 넣지 말고, 바꿀 내용과 승인 질문은 대화로 보여 줘. ${NO_OFFICIAL_SAVE}`,
      "보여 준 수강료 결제 ADR 개정안을 그대로 승인해. 저장하고 결과를 대화로 알려 줘.",
    ],
    obligations: [
      obligation(
        "classify",
        "업무 맥락 조회 결과를 근거로 결제 시도 한도 3회→5회 변경을 수강료 결제 기능 안의 정확한 값 변경으로 판단하고, 전액 결제 뒤 좌석 확정 규칙과 수강료 결제됨 인계의 뜻은 그대로임을 밝힌다.",
      ),
      obligation(
        "no-proposal",
        "업무 모델 변경안이나 모델 초안을 만들지 않고 그 한도 값을 업무 모델에 옮기지 않는다.",
      ),
      obligation(
        "revision",
        "첫 응답은 수강료 결제 ADR의 제자리 개정안과 승인 질문만 제시하고 공식 ADR·색인을 저장하지 않는다(`.adr-review/` 아래의 일회용 초안과 검사는 저장이 아니다). 승인 뒤 그 ADR의 해당 행을 신청당 최대 5회, 6번째 시도 거절과 미결제 유지로 개정하고 다른 계약은 보존하며, ADR과 색인의 Status를 Proposed로 맞춘다.",
      ),
      obligation(
        "report",
        "실제로 바꾼 파일과 실행한 검사 결과를 사실대로 보고하고 구현을 남은 다음 단계로 안내한다.",
      ),
    ],
    verifyEvidence: verifyContractOnly,
  },
];
