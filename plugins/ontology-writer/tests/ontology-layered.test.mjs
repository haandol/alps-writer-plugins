import assert from "node:assert/strict";
import { readFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readAdrDocument } from "../scripts/ontology-layered-data.mjs";
import {
  renderAdrText,
  renderLayeredView,
  scopedEventBoard,
} from "../scripts/ontology-layered-view.mjs";
import { modelEventBoard } from "../scripts/eventstorming-board.mjs";
import { withTmp, write } from "./helpers.mjs";
import {
  ADR_BODY,
  ADR_PATH,
  BUSINESS_BOARD,
  BUSINESS,
  LAYER_MAPPING,
  layeredData,
  writeLayeredFixture,
} from "./ontology-layered-helpers.mjs";

function fixture(dir, options = {}) {
  const model = writeLayeredFixture(dir);
  assert.deepEqual(model.findings, []);
  const input = {
    index: model.index,
    findings: model.findings,
    mapping: LAYER_MAPPING,
    cwd: dir,
    adrRoot: "docs/adr",
    ...options,
  };
  const html = renderLayeredView(input);
  return { ...input, html, data: layeredData(html) };
}

test("two business processes stay separate while sharing one functional ADR category", () =>
  withTmp((dir) => {
    const { data } = fixture(dir);
    assert.deepEqual(data.contexts.find((c) => c.id === "studio").containers.sort(), [
      "studio.animation",
      "studio.image",
    ]);
    assert.deepEqual(data.adrs[ADR_PATH].containers.sort(), ["studio.animation", "studio.image"]);
    assert.ok(data.adrs[ADR_PATH].bindings.every((binding) => binding.precision === "category"));
    assert.deepEqual(
      data.adrs[ADR_PATH].bindings.find((b) => b.container === "studio.animation").steps,
      ["studio.animate"],
    );
    assert.equal(
      data.containers.some((c) => c.id === "rendering"),
      false,
    );
  }));

test("same-name BCs keep their separate identifiers and process memberships", () =>
  withTmp((dir) => {
    const model = writeLayeredFixture(dir, {
      text: BUSINESS.replace('rdfs:label "Billing"', 'rdfs:label "Creative studio"'),
    });
    const data = layeredData(
      renderLayeredView({
        index: model.index,
        mapping: LAYER_MAPPING,
        cwd: dir,
        adrRoot: "docs/adr",
      }),
    );
    assert.equal(data.contexts.filter((context) => context.name === "Creative studio").length, 2);
    assert.deepEqual(data.contexts.map((context) => context.id).sort(), ["billing", "studio"]);
    assert.equal(
      data.contexts
        .find((context) => context.id === "studio")
        .containers.includes("billing.collect"),
      false,
    );
    assert.equal(
      data.contexts
        .find((context) => context.id === "billing")
        .containers.includes("studio.animation"),
      false,
    );
  }));

test("a process crossing BCs keeps its identity and distinguishes owned and external activities", () =>
  withTmp((dir) => {
    const { data } = fixture(dir);
    assert.deepEqual(data.containers.find((c) => c.id === "studio.image").contexts.sort(), [
      "billing",
      "studio",
    ]);
    assert.ok(data.contexts.find((c) => c.id === "billing").containers.includes("studio.image"));
    assert.deepEqual(data.businessSteps["billing.reserve"].contexts, ["billing"]);
    assert.deepEqual(data.elementContainers["studio.keep"].sort(), [
      "studio.animation",
      "studio.image",
    ]);
    assert.ok(
      data.elementContainers["billing.paid"].includes("studio.image"),
      "incoming event is part of the receiving workflow detail",
    );
    assert.ok(
      data.elementContainers["billing.deliver-policy"].includes("billing.collect"),
      "outgoing policy remains available at its source",
    );
  }));

test("unprovided domains and unrealized activities remain absent rather than inferred from folder names", () =>
  withTmp((dir) => {
    const mapping = structuredClone(LAYER_MAPPING);
    mapping.categories.rendering.realizes = ["studio.request"];
    const { data } = fixture(dir, { mapping });
    assert.deepEqual(data.domains, []);
    assert.equal(data.domain, null);
    assert.equal(data.businessSteps["studio.animate"].state, "unrealized");
    assert.equal(data.businessSteps["studio.manual"].state, "outside");
    assert.deepEqual(data.containers.find((c) => c.id === "studio.animation").adrs, []);
  }));

test("provided domain identities, multiple memberships and verdicts survive without creating BC duplicates", () =>
  withTmp((dir) => {
    const { data } = fixture(dir, { metadata: BUSINESS_BOARD, sourceKind: "draft" });
    assert.deepEqual(data.contexts.find((c) => c.id === "studio").domains, ["visual", "delivery"]);
    assert.equal(data.contexts.length, 2);
    assert.equal(data.domains[0].verdict, "inferred");
    assert.deepEqual(data.domains[0].evidence, BUSINESS_BOARD.subdomains[0].evidence);
    assert.equal(data.businessSteps["studio.request"].supplied.entities[0].after, "Submitted");
    const emptyEvidence = structuredClone(BUSINESS_BOARD);
    emptyEvidence.subdomains[0].evidence = [];
    const unconfirmed = layeredData(
      renderLayeredView({
        index: writeLayeredFixture(dir).index,
        mapping: LAYER_MAPPING,
        cwd: dir,
        adrRoot: "docs/adr",
        metadata: emptyEvidence,
      }),
    );
    assert.equal(unconfirmed.domains[0].verdict, "unconfirmed");
  }));

test("indexed Markdown is read only inside the lexical and real ADR root", () =>
  withTmp((dir) => {
    fixture(dir);
    assert.equal(
      readAdrDocument({ path: ADR_PATH }, { cwd: dir, adrRoot: "docs/adr" }).body,
      ADR_BODY,
    );
    write(dir, "outside.md", "PRIVATE_OUTSIDE_SENTINEL");
    symlinkSync(path.join(dir, "outside.md"), path.join(dir, "docs/adr/rendering/0002-escape.md"));
    for (const file of [
      "outside.md",
      "docs/adr/../../outside.md",
      "docs/adr/rendering/0002-escape.md",
      "docs/adr/rendering/missing.md",
      "docs/adr/rendering/source.js",
    ]) {
      const result = readAdrDocument({ path: file }, { cwd: dir, adrRoot: "docs/adr" });
      assert.equal(result.body, null, file);
      assert.ok(result.error, file);
    }
    const mapping = structuredClone(LAYER_MAPPING);
    mapping.categories.rendering.adrs.push({
      path: "docs/adr/rendering/0002-escape.md",
      status: "Accepted (2026-10-01)",
    });
    const result = renderLayeredView({
      index: writeLayeredFixture(dir).index,
      mapping,
      cwd: dir,
      adrRoot: "docs/adr",
    });
    assert.doesNotMatch(result, /PRIVATE_OUTSIDE_SENTINEL/);
    assert.equal(layeredData(result).businessSteps["studio.request"].state, "unknown");
  }));

test("a changed document Status is shown and makes realization unverified until the index agrees", () =>
  withTmp((dir) => {
    const { index } = fixture(dir);
    write(dir, ADR_PATH, ADR_BODY.replace("Accepted (2026-10-01)", "Proposed"));
    const data = layeredData(
      renderLayeredView({ index, mapping: LAYER_MAPPING, cwd: dir, adrRoot: "docs/adr" }),
    );
    assert.equal(data.adrs[ADR_PATH].documentStatus, "Proposed");
    assert.equal(data.businessSteps["studio.request"].state, "unknown");
    assert.ok(data.adrs[ADR_PATH].issues.some((issue) => /Status/.test(issue)));
  }));

test("ADR document Status uses the common parser and ignores headings in code examples", () =>
  withTmp((dir) => {
    writeLayeredFixture(dir);
    write(
      dir,
      ADR_PATH,
      "# Decision\n\n```markdown\n## Status\n\nProposed\n```\n\n## Status\n\nAccepted (2026-10-01)\n",
    );
    assert.equal(
      readAdrDocument({ path: ADR_PATH }, { cwd: dir, adrRoot: "docs/adr" }).documentStatus,
      "Accepted (2026-10-01)",
    );
  }));

test("document inspection does not double-count a Status mismatch already found by validation", () =>
  withTmp((dir) => {
    const { index } = fixture(dir);
    write(dir, ADR_PATH, ADR_BODY.replace("Accepted (2026-10-01)", "Proposed"));
    const finding = {
      level: "error",
      code: "ontology-adr-status-mismatch",
      category: "rendering",
      where: ADR_PATH,
      element: null,
      msg: "The source Status differs from its index.",
    };
    const data = layeredData(
      renderLayeredView({
        index,
        mapping: LAYER_MAPPING,
        cwd: dir,
        adrRoot: "docs/adr",
        findings: [finding],
      }),
    );
    assert.equal(
      data.errors.filter((error) => error.code === finding.code && error.where === ADR_PATH).length,
      1,
    );
    assert.equal(data.businessSteps["studio.request"].state, "unknown");
  }));

test("process EventStorming retains exact reaction conditions, cycles and direct outside hand-offs", () =>
  withTmp((dir) => {
    const { index, data } = fixture(dir);
    const board = modelEventBoard({ index, mapping: LAYER_MAPPING });
    const process = data.containers.find((c) => c.id === "studio.image");
    const scoped = scopedEventBoard(board, process);
    assert.deepEqual(scoped.stages.map((s) => s.modelId).sort(), [
      "billing.reserve",
      "billing.take",
      "studio.request",
    ]);
    assert.equal(scoped.external.length, 1);
    assert.ok(
      scoped.links.some(
        (l) => l.condition === "The payment matches this creator and has not been delivered.",
      ),
    );
    assert.ok(scoped.links.some((l) => l.condition === "The earlier result is still unknown."));
    assert.ok(scoped.links.some((l) => l.relation === "sequence"));
    assert.ok(scoped.questions.some((q) => q.scopeType === "process"));
    assert.ok(
      scoped.stages.every((s) => s.entities.every((e) => e.before === null && e.after === null)),
      "uses is not a state transition",
    );
  }));

test("only an explicit draft combines supplied entity/view candidates with its board, leaving saved-model facts intact", () =>
  withTmp((dir) => {
    const { index, data } = fixture(dir);
    const board = modelEventBoard({ index, mapping: LAYER_MAPPING });
    const process = data.containers.find((c) => c.id === "studio.image");
    const model = scopedEventBoard(board, process, { metadata: BUSINESS_BOARD });
    const draft = scopedEventBoard(board, process, {
      metadata: BUSINESS_BOARD,
      sourceKind: "draft",
    });
    assert.equal(model.origin, "model");
    assert.equal(draft.origin, "candidate");
    assert.equal(model.stages.find((s) => s.modelId === "studio.request").views, undefined);
    assert.equal(draft.stages.find((s) => s.modelId === "studio.request").views[0].role, "input");
    assert.equal(
      draft.stages.find((s) => s.modelId === "studio.request").entities.at(-1).after,
      "Submitted",
    );
  }));

test("the offline page retains exact inert ADR source, readable contracts and no source-code links", () =>
  withTmp((dir) => {
    const before = writeLayeredFixture(dir);
    const html = renderLayeredView({
      index: before.index,
      mapping: LAYER_MAPPING,
      cwd: dir,
      adrRoot: "docs/adr",
    });
    assert.equal(layeredData(html).adrs[ADR_PATH].body, ADR_BODY);
    const readable = renderAdrText(ADR_BODY);
    assert.match(readable, /<strong>at most once<\/strong>/);
    assert.match(readable, /<table>/);
    assert.doesNotMatch(readable, /<script|<a |<img |onclick=/);
    assert.match(readable, /&lt;script&gt;/);
    assert.equal(readFileSync(path.join(dir, ADR_PATH), "utf8"), ADR_BODY);
  }));
