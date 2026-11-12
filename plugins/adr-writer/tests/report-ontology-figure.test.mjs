import assert from "node:assert/strict";
import test from "node:test";
import { parseMermaid } from "../skills/report-writer/scripts/mermaid.mjs";
import { overviewFigure, parseOverview } from "../skills/report-writer/scripts/ontology-figure.mjs";

const line = (record) => JSON.stringify(record);
const overview = [
  "Business navigation — overview",
  "Navigation only: summaries are not complete business-contract evidence.",
  line({ kind: "context", id: "memory", label: "사용자 기억" }),
  line({ kind: "context", id: "conversation", label: "대화 연습" }),
  line({ kind: "context", id: "speech", label: 'Today "speech"' }),
  line({ kind: "context", id: "billing", label: "Billing" }),
  line({ kind: "collaboration", from: { id: "conversation" }, to: { id: "memory" } }),
  line({ kind: "collaboration", from: { id: "memory" }, to: { id: "speech" } }),
  line({ kind: "collaboration", from: { id: "speech" }, to: { id: "billing" } }),
  line({ kind: "collaboration", from: { id: "conversation" }, to: { id: "memory" } }),
].join("\n");

test("the overview figure draws only the chosen contexts and their collaborations, verbatim", () => {
  assert.doesNotMatch(
    overviewFigure(overview, { contexts: ["memory", "conversation", "speech"] }),
    /-->/,
    "collaboration is drawn without direction",
  );
  assert.equal(parseOverview(overview).contexts.size, 4);
  const figure = overviewFigure(overview, { contexts: ["memory", "conversation"] });
  assert.equal(
    figure,
    'flowchart LR\n  bc_memory["사용자 기억"]\n  bc_conversation["대화 연습"]\n  bc_conversation --- bc_memory',
  );
  assert.equal(parseMermaid(figure).error, undefined);
});

test("neighbors appear as dashed context without edges among themselves", () => {
  const figure = overviewFigure(overview, {
    contexts: ["memory"],
    neighbors: true,
    direction: "TB",
  });
  assert.match(figure, /^flowchart TB/);
  assert.match(figure, /bc_speech\["Today 'speech'"\]:::outside/);
  assert.match(figure, /bc_conversation\["대화 연습"\]:::outside/);
  assert.doesNotMatch(figure, /bc_billing/, "a neighbor's neighbor is not drawn");
  assert.match(figure, /classDef outside/);
  assert.equal(parseMermaid(figure).error, undefined);
});

test("unknown or missing context ids are refused instead of inventing a boundary", () => {
  assert.throws(
    () => overviewFigure(overview, { contexts: ["ledger"] }),
    /Unknown bounded-context ids: ledger/,
  );
  assert.throws(() => overviewFigure(overview, { contexts: [] }), /at least one/);
  assert.throws(
    () => overviewFigure("no json here", { contexts: ["memory"] }),
    /No bounded contexts/,
  );
});

test("a neighbor missing from a search-filtered overview keeps the collaboration's own label", () => {
  const filtered = [
    line({ kind: "context", id: "order", label: "주문" }),
    line({
      kind: "collaboration",
      from: { id: "order", label: "주문" },
      to: { id: "billing", label: "청구" },
    }),
    line({ kind: "collaboration", from: { id: "order" }, to: { id: "shipping" } }),
  ].join("\n");
  const figure = overviewFigure(filtered, { contexts: ["order"], neighbors: true });
  assert.match(figure, /bc_billing\["청구"\]:::outside/);
  assert.match(figure, /bc_shipping\["shipping"\]:::outside/, "without any label the id is shown");
  assert.doesNotMatch(figure, /undefined/);
  assert.throws(
    () => overviewFigure(filtered, { contexts: ["billing"] }),
    /Unknown bounded-context ids: billing/,
  );
});
