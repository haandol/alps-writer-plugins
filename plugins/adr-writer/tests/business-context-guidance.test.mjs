// How ADR Writer's own paths use a business process model that the separate
// ontology-writer plugin keeps: the session notice, the business-context module and
// its callers, the seeded rule docs, and a lint that checks only the shape of the
// index's `realizes` links and never reads the model.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { has, parseLint, PLUGIN_ROOT, runHook, seedRuleDocs, withTmp, write } from "./helpers.mjs";

const read = (rel) => readFileSync(path.join(PLUGIN_ROOT, rel), "utf8");
const CONTEXT = read("references/business-context.md");
const MODEL = `@prefix m: <urn:ontology-writer:model:> .
@prefix pm: <urn:ontology-writer:process:> .

m:ordering a pm:BoundedContext .
`;

test("the session directive notes a business process model without reading it", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
    const plain = runHook(dir);
    assert.doesNotMatch(plain, /business context|process model/i, "an index alone adds nothing");
    write(dir, "docs/process/notes.md", "# notes\n");
    write(dir, "docs/process/.hidden/old.ttl", MODEL);
    assert.equal(runHook(dir), plain, "a non-Turtle or hidden document is not a model");

    write(dir, "docs/process/flows/ordering.ttl", MODEL);
    const lines = runHook(dir).split("\n");
    assert.deepEqual(lines.slice(0, -1), plain.split("\n"), "the ADR directive is unchanged");
    assert.equal(
      lines.at(-1),
      "Business process model present: check business context through the Ontology Writer plugin before an ADR decision or contract changes; if it is unavailable, state that the business context was not checked.",
    );
    assert.doesNotMatch(
      lines.at(-1),
      /ordering|process-model\.mjs/,
      "no model content or query path",
    );
  });
});

test("the lint checks only the shape of realizes and never reads the model", () => {
  const fixture = (dir, realizes) => {
    seedRuleDocs(dir);
    write(
      dir,
      "docs/adr/ordering/0001-confirm-paid-orders.md",
      "# ADR 0001: Confirm paid orders\n\nDate: 2020-01-30\n\n## Status\n\nProposed\n\n## Purpose\n\nOrders need a confirmation.\n\n## Decision Drivers\n\n- Customers see one confirmation.\n- Payments complete first.\n- Support explains each one.\n\n## Decision\n\nConfirm an order once paid.\n\n## Alternatives\n\n1. **On submission** — faster.\n2. **After payment** — chosen.\n\n## Consequences\n\n### Positive\n\n- Confirmed orders are paid.\n",
    );
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: {
          ordering: {
            feature: "Order confirmation",
            adrs: [
              {
                path: "docs/adr/ordering/0001-confirm-paid-orders.md",
                status: "Proposed",
                summary: "orders are confirmed after payment",
              },
            ],
            realizes,
          },
        },
      }),
    );
  };
  for (const [realizes, code] of [
    ["ordering.confirm-order", "map-realizes-not-array"],
    [["ordering.confirm-order", "ordering.confirm-order"], "map-realizes-dup"],
    [["bad id"], "map-realizes-item"],
    [[42], "map-realizes-item"],
  ])
    withTmp((dir) => {
      fixture(dir, realizes);
      const report = parseLint(dir);
      assert.ok(
        report.errors.some((e) => e.rule === code),
        `${JSON.stringify(realizes)}: ${JSON.stringify(report.errors)}`,
      );
    });
  withTmp((dir) => {
    // A link to a step no model has, beside a model that does not parse: neither is the lint's.
    fixture(dir, ["ordering.cancel-order"]);
    write(
      dir,
      "docs/process/ordering.ttl",
      "@prefix m: <urn:ontology-writer:model:> .\nm:x a [ ] .\n",
    );
    const report = parseLint(dir);
    assert.equal(report.code, 0, JSON.stringify(report.errors));
    assert.deepEqual(
      [...report.errors, ...report.warnings].filter((f) => /process|realizes/.test(f.rule)),
      [],
    );
  });
});

test("every path that changes ADR decisions or contracts checks the business context first", () => {
  for (const skill of ["adr-new", "adr-impl", "adr-sync", "adr-import"])
    has(
      read(`skills/${skill}/SKILL.md`),
      "When `docs/process/` holds Turtle documents, read",
      "`${CLAUDE_PLUGIN_ROOT}/references/business-context.md`",
    );
  has(
    read("skills/adr-rollup/SKILL.md"),
    "a rollup keeps each category's `realizes` links and empty record unchanged and does not query business context",
  );
  has(
    CONTEXT,
    "These paths query the target feature's business context before finalizing ADR content: a new ADR, an edit-in-place change, an `/adr-sync` body change, an `/adr-import` adoption, a PRD handoff, and a user-approved deprecation or supersede.",
  );
  has(
    CONTEXT,
    "A deprecation or supersede also shows, in its approval summary, the steps that lose their realizing feature.",
  );
  has(
    CONTEXT,
    "The model, its vocabulary, its validation and the query belong to the separate ontology-writer plugin; this plugin never reads the model.",
    "Run ontology-writer's query, the command its session directive names:",
    "When ontology-writer is not available, state in the approval summary or report that the business context was not checked, and continue; the missing query never blocks the work.",
  );
  has(CONTEXT, "A category split or merge that keeps every meaning, and a rollup, do not query.");
  has(CONTEXT, "They only move `realizes` links in `docs/adr/.mapping.json`");
  has(CONTEXT, "A merge unites the links.");
  has(
    CONTEXT,
    "A split moves each step's link to the category whose ADR holds that step's compliance contract; when no ADR or several ADRs hold it, show the assignment in the approval summary.",
  );
  has(
    CONTEXT,
    "A category created by a split or merge starts without an empty record; merged into a linked category, only the links remain.",
  );
  has(CONTEXT, "A rollup keeps the category, its links and its empty record.");
  has(
    CONTEXT,
    "Automatic lifecycle transitions — `/adr-impl` promoting to `Accepted`, `/adr-sync` returning an ADR to `Proposed` — never wait for a query.",
  );
  has(
    CONTEXT,
    "Without model documents, skip it entirely: add no output, question, link judgment or index change.",
  );
  has(
    CONTEXT,
    "Name the business context you checked in the ADR approval summary and in the implementation plan.",
  );
  has(
    read("../alps-writer/skills/feature-to-adr/references/current-reference-level.md"),
    "`/adr-new` queries each owner's business context and judges a Feature that realizes no step.",
  );
});

test("unlinked features get a three-way judgment and a confirmed empty record is not asked again", () => {
  has(
    CONTEXT,
    "When the target feature realizes no step, judge one of three outcomes and show it with its reason in the approval summary or report: it realizes an existing step (name the candidate), the model needs a new step (a process change proposal), or it is unrelated to the business flow.",
  );
  has(CONTEXT, "Skip the judgment for a deprecation without a replacement.");
  has(
    CONTEXT,
    'record `"realizes": []` for its category; never store a link candidate or an empty record before approval. A category with an empty record is not asked again.',
  );
});

test("the business context bounds choices and raises proposals but never becomes an obligation", () => {
  has(
    CONTEXT,
    "Pick details the ADR leaves open so they do not contradict the model's flow, events, policies, cross-feature rules or terms.",
  );
  has(
    CONTEXT,
    "When no such choice exists, or the change needs a different flow, event, policy, cross-feature rule, or a business concept or term the model defines, raise a process change proposal through ontology-writer's `/process-edit`.",
  );
  has(
    CONTEXT,
    "Until it is approved, or while it is rejected, do not finalize ADR content that depends on it: save that contract row with a visible pending marker and the awaited business change in business language, without the model's file location or element ids.",
  );
  has(
    CONTEXT,
    "A pending row is not implemented, keeps the ADR `Proposed`, and is reported as pending by implementation review and process sync.",
  );
  has(
    CONTEXT,
    "After a rejection, rewrite the row with the model's current meaning or keep it pending until the user decides.",
  );
  has(CONTEXT, "A PRD handoff leaves that Feature unresolved.");
  has(
    CONTEXT,
    "When an approval-bound authoring path — new ADR, edit-in-place, import, PRD handoff — finds that the context's event hand-off, policy or business rule has no compliance contract in the realizing ADR, propose one in the draft at feature resolution: the inputs the feature accepts and the events it emits for that relation, rejection and failure behavior, exact values and conditions, and guarantees such as duplicate delivery.",
  );
  has(CONTEXT, "Report other realizing ADRs missing the same contract as alignment issues.");
  has(
    CONTEXT,
    "In the context of a `Proposed` process, first check model meaning no realizing ADR reflects yet, and fold the compliance contracts it needs into that process's change approval summary so they are asked once.",
  );
  has(
    CONTEXT,
    "`/adr-sync` never adds a compliance contract itself; it reports the gap as an alignment issue for `/process-sync`.",
  );
  has(
    CONTEXT,
    "An ADR or code change that learns of a contradiction with the context reports it in its completion report — as an alignment issue (the model and the realizing ADR contract differ) or as a process change proposal.",
  );
  has(CONTEXT, "Completion is still judged by ADR contract rows only.");
  has(
    CONTEXT,
    "When the context shows validation errors, uncommitted model edits, unsynced direct edits or a lifecycle edit of an `Accepted` process, report that and do not treat that part as a settled reference.",
  );
  has(
    CONTEXT,
    "When the change flags are unavailable or unknown for part of the scope, say so and treat the `Accepted` processes there as possibly edited directly until the history is available and `/process-sync` has checked them with it.",
  );
  has(
    CONTEXT,
    "Propose compliance contracts for it only after presenting `/process-sync` and its approval.",
  );
  has(CONTEXT, "Absence from the model is not absence from the business.");
  has(
    CONTEXT,
    "An open path stays something to confirm; a flow, policy or rule the model lacks is never evidence that no rule applies.",
  );
  has(
    CONTEXT,
    "A not-applicable item is evidence only that the business-level path does not exist; do not turn it back into a question.",
  );
  has(CONTEXT, "Never use it to drop a failure guarantee inside a step.");
  has(
    CONTEXT,
    "The business context is never an implementation obligation or completion condition by itself; only ADR contract rows are.",
  );
  has(CONTEXT, "Never persist a result; it is not a record or a second authority.");
  has(
    read("agents/adr-impl-sufficiency-reviewer.md"),
    "Business context from a process model is never an obligation by itself",
  );
});

test("/adr-impl reuses an approval of the exact revision from any approval path and hands over to the alignment review", () => {
  has(
    read("skills/adr-impl/references/planning.md"),
    "If `/adr-new`, `/feature-to-adr`, `/process-edit` or `/process-sync` already obtained approval for this exact ADR content and the ADR has not changed, reuse that approved baseline, publish the implementation plan as a progress update, and proceed without another approval.",
  );
  has(
    read("skills/adr-impl/references/completion.md"),
    "When `docs/process/` holds Turtle documents and this category realizes steps of a `Proposed` process whose realizing features now all have an `Accepted` ADR and no `Proposed` one, run ontology-writer's `/process-align <process>` as part of the same cascade; it needs no new approval. Without ontology-writer, report that the process waits for that alignment review.",
  );
});

test("ADR bodies keep model locations and element ids out", () => {
  has(CONTEXT, "Keep model locations and element ids out of ADR bodies.");
});

test("the seeded rule docs place the business process model above ADRs without reading it", () => {
  has(
    read("templates/adr/concepts.md"),
    "ADRs remain the only implementation authority.",
    "Without model documents nothing in this section applies.",
    "ADR Writer never reads the model.",
  );
  has(
    read("templates/adr/structure.md"),
    "An empty list `[]` records that the feature was confirmed to realize no step",
  );
});
