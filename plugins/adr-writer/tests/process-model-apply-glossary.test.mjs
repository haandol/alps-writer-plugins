// The glossary guard of a save: a concept or context the ADR glossary still defines is
// not saved without the approved cleanup, whatever form its entry takes, and a name
// in a table column that may hold other content is a question, not a refusal.
import assert from "node:assert/strict";
import { test } from "node:test";
import { commitAll, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  GLOSSARY,
  SETTLED,
  apply,
  cli,
  draft,
  exits,
  impact,
  json,
  read,
  repo,
} from "./process-model-apply-helpers.mjs";

test("a concept the glossary still defines is not saved without the approved cleanup", () => {
  withTmp((dir) => {
    repo(dir);
    draft(
      dir,
      `${ACCEPTED}\nm:payment.settlement a pm:BusinessConcept ;\n    rdfs:label "Settlement" ;\n    pm:definition "Paying sellers." ;\n    pm:inContext m:payment .\n`,
    );
    const summary = impact(dir);
    assert.deepEqual(
      summary.glossaryCleanup.map((g) => g.term),
      ["Settlement"],
    );
    const refused = apply(dir, summary.baseHash);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /the glossary would still define "Settlement"/);
    assert.equal(read(dir, "docs/process/model.ttl"), ACCEPTED);
    write(dir, "glossary.next.md", "| Term | Meaning |\n| --- | --- |\n");
    const cleaned = impact(dir, ["--glossary", "glossary.next.md"]);
    const applied = apply(dir, cleaned.baseHash, ["--glossary", "glossary.next.md"]);
    assert.equal(applied.code, 0, applied.out);
    assert.doesNotMatch(read(dir, "docs/adr/glossary.md"), /Settlement/);
    assert.match(read(dir, "docs/process/model.ttl"), /rdfs:label "Settlement"/);
  });
});

test("a concept the glossary defines as a plain list entry is not saved without the approved cleanup", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n- Refund: Money given back to a buyer.\n- Settlement: paying sellers.\n",
    );
    commitAll(dir, "a glossary written as a plain list");
    draft(
      dir,
      `${ACCEPTED}\nm:payment.refund a pm:BusinessConcept ;\n    rdfs:label "Refund" ;\n    pm:definition "Money given back to a buyer." ;\n    pm:inContext m:payment .\n`,
    );
    const summary = impact(dir);
    assert.deepEqual(
      summary.glossaryCleanup.map((g) => g.term),
      ["Refund"],
    );
    const refused = apply(dir, summary.baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /the glossary would still define "Refund"/);
    assert.equal(read(dir, "docs/process/model.ttl"), ACCEPTED);
  });
});

test("a concept whose glossary entry is a term heading with a colon in its definition is not saved beside it", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n## Refund\n\nMoney given back to the buyer: the full amount or a part of it.\n",
    );
    commitAll(dir, "a glossary with a heading per term");
    const refund = `${ACCEPTED}\nm:payment.refund a pm:BusinessConcept ;\n    rdfs:label "Refund" ;\n    pm:definition "Money given back to a buyer." ;\n    pm:inContext m:payment .\n`;
    draft(dir, refund);
    const summary = impact(dir);
    assert.deepEqual(
      summary.glossaryCleanup.map((g) => g.term),
      ["Refund"],
    );
    const refused = apply(dir, summary.baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /the glossary would still define "Refund"/);
    // The same concept added by a direct edit is reported too.
    write(dir, "docs/process/model.ttl", refund);
    assert.match(cli(dir, ["validate"]).out, /process-glossary-overlap/);
  });
});

test("a term heading with details after its definition still guards its term, on the draft and the direct path", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n## Refund\n\nMoney given back to a buyer.\n\n- **Status**: requested, approved or paid.\n- **Owner**: the payments team.\n",
    );
    commitAll(dir, "a glossary with details under each term");
    const refund = `${ACCEPTED}\nm:payment.refund a pm:BusinessConcept ;\n    rdfs:label "Refund" ;\n    pm:definition "Money given back to a buyer." ;\n    pm:inContext m:payment .\n`;
    draft(dir, refund);
    const summary = impact(dir);
    assert.deepEqual(
      summary.glossaryCleanup.map((g) => g.term),
      ["Refund"],
    );
    const refused = apply(dir, summary.baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /the glossary would still define "Refund"/);
    // The same concept added by a direct edit.
    write(dir, "docs/process/model.ttl", refund);
    assert.match(cli(dir, ["validate"]).out, /process-glossary-overlap/);
    assert.deepEqual(
      json(dir, ["impact", "--base", "HEAD"]).glossaryCleanup.map((g) => g.term),
      ["Refund"],
    );
  });
});

test("a heading whose definition is a facet line, a facet sub-heading or prose guards its term on both paths, a context's too", () => {
  withTmp((dir) => {
    repo(dir);
    const refund = `${ACCEPTED}\nm:payment.refund a pm:BusinessConcept ;\n    rdfs:label "Refund" ;\n    pm:definition "Money given back to a buyer." ;\n    pm:inContext m:payment .\n`;
    // A context the change adds over the glossary's entry for it.
    const fulfilment = `${ACCEPTED}\nm:fulfilment a pm:BoundedContext ;\n    rdfs:label "Fulfilment" ;\n    pm:definition "Getting a paid order to the customer." .\n`;
    for (const [glossary, model, term] of [
      [
        "# Glossary\n\n## Refund\n\n### Definition\n\nMoney given back to a buyer.\n",
        refund,
        "Refund",
      ],
      [
        "# Glossary\n\n## Refund\n\n- **Definition**: Money given back to a buyer.\n- **Partial refund**: some of it.\n",
        refund,
        "Refund",
      ],
      [
        "# Glossary\n\n## Fulfilment\n\nGetting a paid order to the customer.\n\n- **Picking**: taking the items.\n- **Packing**: boxing them.\n",
        fulfilment,
        "Fulfilment",
      ],
    ]) {
      write(dir, "docs/adr/glossary.md", glossary);
      commitAll(dir, `the glossary's entry for ${term}`);
      draft(dir, model);
      assert.ok(
        impact(dir).glossaryCleanup.some((g) => g.term === term),
        `${glossary}: no cleanup proposed`,
      );
      // The same element added by a direct edit is reported.
      write(dir, "docs/process/model.ttl", model);
      const validate = cli(dir, ["validate"]).out;
      assert.ok(
        validate.includes("process-glossary-overlap") && validate.includes(`"${term}"`),
        validate,
      );
      write(dir, "docs/process/model.ttl", ACCEPTED);
    }
    const refused = apply(dir, impact(dir).baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /the glossary would still define "Fulfilment"/);
  });
});

test("a glossary table is read in every term column, however its header words it, so a concept named in its second language is guarded on both paths", () => {
  withTmp((dir) => {
    repo(dir);
    const concept = (label) =>
      `${ACCEPTED}\nm:payment.probe a pm:BusinessConcept ;\n    rdfs:label "${label}" ;\n    pm:definition "Money in a payment." ;\n    pm:inContext m:payment .\n`;
    for (const [glossary, term] of [
      [
        "# 용어집\n\n## 결제 용어\n\n| English | 한국어 | 설명 |\n| --- | --- | --- |\n| Charge | 청구 | 받는 돈 |\n",
        "청구",
      ],
      [
        "# 용어집\n\n| 한글명 | 영문명 | 설명 |\n| --- | --- | --- |\n| 환불 | Refund | 구매자에게 돌려주는 돈 |\n",
        "Refund",
      ],
      [
        "# 용어집\n\n| 번호 | 용어명 | 설명 |\n| --- | --- | --- |\n| 1 | 환불 | 구매자에게 돌려주는 돈 |\n",
        "환불",
      ],
      ["# Glossary\n\n| Term | Meaning |\n|:--|:--|\n| Refund | money given back |\n", "Refund"],
      [
        "# 용어집\n\n| 용어(한) | 용어(영) | 설명 |\n| --- | --- | --- |\n| 환불 | Refund | 돌려주는 돈 |\n",
        "Refund",
      ],
      [
        "# Glossary\n\n| Context | Term (Eng) | Meaning |\n| --- | --- | --- |\n| Payment | Refund | money given back |\n",
        "Refund",
      ],
      [
        "# 용어집\n\n| 영문용어 | 한글용어 | 약어 |\n| --- | --- | --- |\n| Refund | 환불 | RF |\n",
        "환불",
      ],
    ]) {
      write(dir, "docs/adr/glossary.md", glossary);
      commitAll(dir, `a glossary table defining ${term}`);
      draft(dir, concept(term));
      const summary = impact(dir);
      assert.deepEqual(
        summary.glossaryCleanup.filter((g) => !g.possible).map((g) => g.term),
        [term],
        glossary,
      );
      const refused = apply(dir, summary.baseHash);
      assert.equal(refused.code, 1, refused.out);
      assert.match(refused.out, new RegExp(`the glossary would still define "${term}"`));
      // The same concept added by a direct edit is reported.
      write(dir, "docs/process/model.ttl", concept(term));
      assert.match(
        cli(dir, ["validate"]).out,
        new RegExp(
          `process-glossary-overlap[\\s\\S]*"${term}".*; remove the glossary entry — or reword it where it only groups or details other terms — through the model's change approval`,
        ),
        glossary,
      );
      write(dir, "docs/process/model.ttl", ACCEPTED);
    }
  });
});

test("a name in a glossary table column that may hold other content is a question in the summary, not a refusal, on both paths", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n| Term | Context | Meaning |\n| --- | --- | --- |\n| Settlement | Payment | paying sellers |\n",
    );
    commitAll(dir, "a glossary table naming a context beside its terms");
    // A redefinition of the payment context the table names in its context column.
    const redefined = ACCEPTED.replace(
      /(m:payment a pm:BoundedContext ;\n    rdfs:label "Payment" ;\n    pm:definition )"[^"]*"/,
      '$1"Collecting and returning the money for orders."',
    );
    assert.notEqual(redefined, ACCEPTED);
    draft(dir, redefined);
    const summary = impact(dir);
    assert.deepEqual(
      summary.glossaryCleanup.map((g) => [g.term, g.type, Boolean(g.possible)]),
      [
        ["Payment", "BusinessConcept", true],
        ["Payment", "BoundedContext", true],
      ],
    );
    assert.match(
      cli(dir, ["impact", "--draft", "draft"]).out,
      /glossary table cells that may define a term the model would own \(ask the user\): Payment/,
    );
    exits(dir, ["apply", "--draft", "draft", "--base-hash", summary.baseHash], 0);
    const validate = cli(dir, ["validate"]).out;
    assert.match(
      validate,
      /process-glossary-mention[\s\S]*the glossary names the business term "Payment" \(BoundedContext\) in a table column that may hold other content/,
    );
    assert.doesNotMatch(validate, /process-glossary-overlap/);
  });
});

test("a glossary heading named after a context is its entry until reworded, and the entries under it are guarded", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n## Payment\n\nTerms of the payment context.\n\n- Refund: money given back.\n- Charge: money taken.\n",
    );
    commitAll(dir, "a glossary grouped by context");
    // A concept the section defines is not saved beside it.
    draft(
      dir,
      `${ACCEPTED}\nm:payment.refund a pm:BusinessConcept ;\n    rdfs:label "Refund" ;\n    pm:definition "Money given back to a buyer." ;\n    pm:inContext m:payment .\n`,
    );
    const refused = apply(dir, impact(dir).baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /the glossary would still define "Refund"/);
    // Nor a change of the context the heading is named after, until the heading is reworded.
    draft(
      dir,
      ACCEPTED.replace(
        '"Collecting the money for an order."',
        '"Collecting and refunding the money for an order."',
      ),
    );
    const summary = impact(dir);
    assert.ok(
      summary.glossaryCleanup.some((g) => g.term === "Payment" && g.type === "BoundedContext"),
      JSON.stringify(summary.glossaryCleanup),
    );
    assert.equal(apply(dir, summary.baseHash).code, 1);
    write(
      dir,
      "glossary.next.md",
      read(dir, "docs/adr/glossary.md").replace("## Payment\n", "## Payment terms\n"),
    );
    const reworded = impact(dir, ["--glossary", "glossary.next.md"]);
    const saved = apply(dir, reworded.baseHash, ["--glossary", "glossary.next.md"]);
    assert.equal(saved.code, 0, saved.out);
    assert.match(read(dir, "docs/adr/glossary.md"), /^## Payment terms$/m);
  });
});

test("a glossary rename, a changed definition or a glossary-side addition never leaves a term defined twice", () => {
  withTmp((dir) => {
    repo(dir);
    // Renaming a concept to a term the glossary defines.
    const payment = 'rdfs:label "Payment" ;\n    pm:definition "The record that the money';
    assert.ok(ACCEPTED.includes(payment));
    draft(
      dir,
      ACCEPTED.replace(
        payment,
        'rdfs:label "Settlement" ;\n    pm:definition "The record that the money',
      ),
    );
    const renamed = impact(dir);
    assert.equal(renamed.draftValid, true);
    assert.match(apply(dir, renamed.baseHash).out, /would still define "Settlement"/);
    // Redefining a concept whose term the glossary also defines.
    write(dir, "docs/adr/glossary.md", `${GLOSSARY}| Payment | money collected |\n`);
    draft(
      dir,
      ACCEPTED.replace(
        "The record that the money for one order was collected.",
        "The record of the money collected for one order.",
      ),
    );
    const redefined = impact(dir);
    assert.match(apply(dir, redefined.baseHash).out, /would still define "Payment"/);
    write(dir, "docs/adr/glossary.md", GLOSSARY);
    // A glossary draft that adds a term the model owns.
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    write(dir, "glossary.next.md", `${GLOSSARY}| Order | a request |\n`);
    const added = impact(dir, ["--glossary", "glossary.next.md"]);
    const refused = apply(dir, added.baseHash, ["--glossary", "glossary.next.md"]);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /would still define "Order"/);
    // A heading is an entry: one named like a model term is refused, another saves.
    write(dir, "glossary.next.md", `# Glossary\n\n## Order\n\n${GLOSSARY}`);
    const heading = impact(dir, ["--glossary", "glossary.next.md"]);
    assert.match(
      apply(dir, heading.baseHash, ["--glossary", "glossary.next.md"]).out,
      /would still define "Order"/,
    );
    write(dir, "glossary.next.md", `# Glossary\n\n## Ordering terms\n\n${GLOSSARY}`);
    const section = impact(dir, ["--glossary", "glossary.next.md"]);
    assert.equal(apply(dir, section.baseHash, ["--glossary", "glossary.next.md"]).code, 0);
  });
});
