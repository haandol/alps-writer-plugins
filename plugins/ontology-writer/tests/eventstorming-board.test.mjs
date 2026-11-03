import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARD } from "./eventstorming-fixture.mjs";
import {
  modelEventBoard,
  renderEventBoard,
  eventBoardPage,
  validateEventBoard,
  renderWorkflowReadiness,
} from "../scripts/eventstorming-board.mjs";
import { v } from "./ontology-view-helpers.mjs";
import { MAPPING } from "./ontology-lifecycle-helpers.mjs";

test("an evidence-backed entity transition is shown with actor, action, event, reaction and next action, without Mermaid", () => {
  const html = eventBoardPage(BOARD, { lang: "ko" });
  for (const text of [
    "Customer",
    "Submit order",
    "Waiting for payment",
    "Not created",
    "Order placed",
    "Confirm after payment",
    "Authored workflow example",
    "변화 전",
    "변화 후",
  ])
    assert.ok(html.includes(text), text);
  for (const kind of ["command", "entity", "domain-event", "policy"])
    assert.ok(html.includes(`event-card ${kind}`));
  assert.ok(html.includes('class="event-connections"'));
  assert.ok(html.includes('data-from="pay" data-to="confirm"'));
  assert.doesNotMatch(html, /data-mermaid|mermaidRuntime|<script[^>]+src=|<link[^>]+href=/);
});

test("missing sources, disputed facts and absent entity changes never become confirmed business state", () => {
  const b = structuredClone(BOARD);
  b.stages[0].evidence = [];
  b.stages[0].entities[0].evidence = [];
  b.stages[1].entities[0].verdict = "conflicting";
  b.stages[2].entities[0].before = null;
  const html = renderEventBoard(b, { lang: "ko" });
  assert.match(html, /근거 위치 없음 · 미확인/);
  assert.match(html, /event-unknown">미확인/);
  assert.match(html, /event-unknown">충돌/);
  assert.match(html, /<dd>미확인<\/dd>/);
  b.stages[0].entities[0].kind = "concept";
  assert.ok(validateEventBoard(b).some((e) => e.includes("does not establish a state change")));
});

test("model reconstruction preserves event reactions while uses never invents an entity mutation", () => {
  const b = modelEventBoard({ index: v.index, mapping: MAPPING, findings: v.findings });
  assert.deepEqual(validateEventBoard(b), []);
  assert.ok(
    b.links.some((l) => l.from.includes("order-placed") && l.to.includes("request-payment")),
  );
  assert.ok(b.stages.some((s) => s.action === "Submit the order"));
  assert.ok(
    b.links.some(
      (l) =>
        l.relation === "sequence" &&
        l.from.includes("request-payment") &&
        l.to.includes("capture-payment"),
    ),
  );
  for (const s of b.stages)
    for (const e of s.entities)
      assert.deepEqual(
        [e.kind, e.before, e.after, e.verdict],
        ["concept", null, null, "unconfirmed"],
      );
  assert.match(renderEventBoard(b), /does not recover workshop/);
});

test("invalid candidate shape, duplicate stage IDs and broken causal links fail before rendering", () => {
  for (const mutate of [
    (b) => b.stages.push(b.stages[0]),
    (b) => (b.links[0].to = "absent"),
    (b) => (b.stages[0].entities[0].evidence = null),
    (b) => (b.version = 2),
  ]) {
    const b = structuredClone(BOARD);
    mutate(b);
    assert.ok(validateEventBoard(b).length);
    assert.throws(() => renderEventBoard(b));
  }
});

test("source instructions are inert text and all stage links resolve to unique anchors", () => {
  const b = structuredClone(BOARD);
  b.stages[0].action = "</script><script>alert(1)</script>";
  b.stages[0].evidence[0].source = "<img src=x onerror=alert(1)>";
  b.stages[0].id = 'step / " Unicode 한글';
  b.links[0].from = b.stages[0].id;
  b.links[2].from = b.stages[0].id;
  const html = eventBoardPage(b);
  assert.doesNotMatch(html, /<script>alert\(1\)|<img src=x/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), m[1]);
});

test("readiness keeps model sufficiency, ADR contract inspection and execution unknown even with Accepted realizing ADRs", () => {
  const html = renderWorkflowReadiness({
    index: v.index,
    mapping: MAPPING,
    findings: v.findings,
    lang: "ko",
  });
  for (const s of [
    "업무 모델의 충분성 · 미확인",
    "ADR 계약의 준비 · 의미 검토 미확인",
    "실제 실행 검증 · 미확인",
    "/ontology-build",
    "/ontology-edit",
    "/ontology-sync",
    "/ontology-align",
    "관찰 기준",
  ])
    assert.ok(html.includes(s), s);
  assert.match(html, /실현 ADR 구현 미완료 0개/);
  assert.doesNotMatch(html, /data-ready="true"|<form|<input|<button/);
});

test("a model activity explains its performer, business object and incoming event condition without inventing state transitions", () => {
  const board = modelEventBoard({ index: v.index, mapping: MAPPING, findings: v.findings });
  const confirm = board.stages.find((s) => s.modelId === "ordering.confirm-order");
  const incoming = board.links.find((l) => l.to === confirm.id && l.relation !== "sequence");
  assert.equal(confirm.actor, "Order system");
  assert.equal(incoming.condition, "The completed payment belongs to the order.");
  const html = renderEventBoard(board, { lang: "ko" });
  const card = html.split(`data-stage="${confirm.id}"`)[1].split("</article>")[0];
  for (const content of [
    "수행 주체:",
    "Order system",
    "업무 대상:",
    "Order",
    "받는 사건",
    "Payment completed",
    "반응 정책",
    "The completed payment belongs to the order.",
    'data-change-known="false"',
  ])
    assert.ok(card.includes(content), content);
  assert.match(html, /업무 검토용 지도/);
});

test("an unspecified trigger condition stays unrecorded and cannot be injected as markup", () => {
  const board = structuredClone(BOARD);
  board.links[0].condition = "<img src=x onerror=alert(1)>";
  const html = renderEventBoard(board, { lang: "ko" });
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.doesNotMatch(html, /<img src=x/);
  assert.ok(html.includes("별도 기록 없음"));
});
