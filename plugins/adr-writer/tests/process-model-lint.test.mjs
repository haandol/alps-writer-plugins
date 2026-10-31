// The optional business process model level inside adr-structure-lint and the
// process-model CLI: a repository without a model is untouched, a model is
// validated as one union graph, and ADR index links stay consistent with it.
import assert from "node:assert/strict";
import {
  chmodSync,
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseTurtle } from "../scripts/process-model-lib.mjs";
import {
  commitAll,
  initRepo,
  parseLint,
  runStructureLint,
  seedRuleDocs,
  withTmp,
  write,
} from "./helpers.mjs";
import { EXAMPLE, cli } from "./process-model-helpers.mjs";

const ADR = (title) => `# ADR 0001: ${title}

Date: 2020-01-30

## Status

Proposed

## Purpose

Orders need a confirmation the customer can rely on.

## Decision Drivers

- Customers see one confirmation.
- Payments complete before confirmation.
- Support can explain every confirmation.

## Decision

Confirm an order once its payment completes.

## Alternatives

1. **Confirm on submission** — faster, but unpaid orders look confirmed.
2. **Confirm after payment** — chosen.

## Consequences

### Positive

- Confirmed orders are paid.
`;

function fixture(
  dir,
  { model = EXAMPLE, realizes, body = ADR("Confirm paid orders"), status = "Proposed" } = {},
) {
  seedRuleDocs(dir);
  write(dir, "docs/adr/ordering/0001-confirm-paid-orders.md", body);
  const entry = {
    feature: "Order confirmation",
    adrs: [
      {
        path: "docs/adr/ordering/0001-confirm-paid-orders.md",
        status,
        summary: "orders are confirmed after payment",
      },
    ],
  };
  if (realizes) entry.realizes = realizes;
  write(
    dir,
    "docs/adr/.mapping.json",
    JSON.stringify({ categories: { ordering: entry } }, null, 2),
  );
  if (model !== null) write(dir, "docs/process/ordering.ttl", model);
}

/** The example with its element blocks in reverse order: the same graph, not canonical. */
const SHUFFLED = (() => {
  const [header, ...blocks] = EXAMPLE.trimEnd().split("\n\n");
  return `${header}\n\n${blocks.reverse().join("\n\n")}\n`;
})();

const processFindings = (report) =>
  [...report.errors, ...report.warnings].filter(
    (f) => f.rule.startsWith("process-") || f.rule.startsWith("map-realizes"),
  );

test("without model documents or links the lint output is unchanged", () => {
  withTmp((dir) => {
    fixture(dir, { model: null });
    const plain = runStructureLint(dir, ["--no-invariants"], { json: false });
    assert.equal(plain.code, 0, plain.stdout);
    assert.doesNotMatch(plain.stdout, /process/i);

    write(
      dir,
      "docs/process/CHANGELOG.md",
      "# Process changes\n\n- 2020-01-30 started the model\n",
    );
    const withNotes = runStructureLint(dir, ["--no-invariants"], { json: false });
    assert.equal(withNotes.stdout, plain.stdout, "a non-Turtle document is not a model");
    assert.equal(cli(dir, ["validate"]).out.trim(), "no process model in docs/process");
  });
});

test("a valid model and an existing realized step lint clean", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    const report = parseLint(dir);
    assert.equal(report.code, 0, JSON.stringify(report.errors));
    assert.deepEqual(processFindings(report), []);
    const json = JSON.parse(cli(dir, ["validate", "--json"]).out);
    assert.deepEqual(
      { ok: json.ok, model: json.model, findings: json.findings },
      { ok: true, model: true, findings: [] },
    );
  });
});

test("model errors fail the lint with their document position", () => {
  withTmp((dir) => {
    fixture(dir, { model: `${EXAMPLE}\nm:customer pm:performs m:ordering.order .\n` });
    const report = parseLint(dir);
    assert.equal(report.code, 1);
    const error = report.errors.find((e) => e.rule === "process-relation-target");
    assert.match(error.where, /^docs\/process\/ordering\.ttl:\d+$/);

    write(dir, "docs/process/broken.ttl", "@prefix m: <urn:adr-writer:model:> .\nm:x a [ ] .\n");
    const broken = parseLint(dir);
    assert.ok(
      broken.errors.some(
        (e) => e.rule === "process-blank-node" && e.where === "docs/process/broken.ttl:2:7",
      ),
    );
    assert.ok(broken.errors.some((e) => e.rule === "process-not-validated"));
    assert.equal(cli(dir, ["validate"]).code, 1);
  });
});

test("dangling and orphaned realizes links are errors; an empty record is not a link", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.cancel-order"] });
    assert.ok(
      parseLint(dir).errors.some(
        (e) => e.rule === "process-link-dangling" && /cancel-order/.test(e.msg),
      ),
    );
  });
  withTmp((dir) => {
    fixture(dir, { model: null, realizes: ["ordering.confirm-order"] });
    const report = parseLint(dir);
    assert.ok(
      report.errors.some(
        (e) => e.rule === "process-link-dangling" && /"ordering".*no process model/.test(e.msg),
      ),
    );
  });
  withTmp((dir) => {
    fixture(dir, { model: null, realizes: [] });
    assert.deepEqual(
      processFindings(parseLint(dir)),
      [],
      "a confirmed no-link record needs no model",
    );
  });
});

test("the index validates the shape of realizes", () => {
  for (const [realizes, code] of [
    ["ordering.confirm-order", "map-realizes-not-array"],
    [["ordering.confirm-order", "ordering.confirm-order"], "map-realizes-dup"],
    [["bad id"], "map-realizes-item"],
    [[42], "map-realizes-item"],
  ]) {
    withTmp((dir) => {
      fixture(dir, { realizes });
      const report = parseLint(dir);
      assert.ok(
        report.errors.some((e) => e.rule === code),
        `${JSON.stringify(realizes)}: ${JSON.stringify(report.errors)}`,
      );
    });
  }
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    assert.ok(
      !parseLint(dir).warnings.some((w) => w.rule === "map-unknown-field"),
      "realizes is a known field",
    );
  });
});

test("a realizes value that is not a list is reported once by the lint and as a link-shape error by validate", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: "ordering.submit-order" });
    assert.deepEqual(
      processFindings(parseLint(dir)).map((f) => f.rule),
      ["map-realizes-not-array"],
    );
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(validated.out, /✗ \[process-link-shape\] docs\/adr\/\.mapping\.json/);
  });
});

test("a realizing ADR whose Status differs from its index record is reported once by the lint and as a Status mismatch by validate", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"], status: "Accepted (2020-01-01)" });
    const report = parseLint(dir);
    assert.ok(
      report.errors.some(
        (e) =>
          e.rule === "status-index-mismatch" &&
          e.where === "docs/adr/ordering/0001-confirm-paid-orders.md",
      ),
      JSON.stringify(report.errors),
    );
    assert.deepEqual(processFindings(report), []);
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /✗ \[process-adr-status-mismatch\] docs\/adr\/ordering\/0001-confirm-paid-orders\.md/,
    );
  });
});

test("a realizing ADR whose indexed file is missing is reported once by the lint and as a missing ADR by validate", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    rmSync(path.join(dir, "docs/adr/ordering/0001-confirm-paid-orders.md"));
    const report = parseLint(dir);
    const dangling = report.errors.filter((e) => e.rule === "mapping-dangling-adr");
    assert.equal(dangling.length, 1, JSON.stringify(report.errors));
    assert.match(dangling[0].msg, /docs\/adr\/ordering\/0001-confirm-paid-orders\.md/);
    assert.deepEqual(processFindings(report), []);
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /✗ \[process-adr-missing\] docs\/adr\/ordering\/0001-confirm-paid-orders\.md/,
    );
  });
});

test("an ADR file of a realizing feature that the index does not list is reported once by the lint and as an unindexed ADR by validate", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    write(
      dir,
      "docs/adr/ordering/0002-hold-unpaid-orders.md",
      ADR("Hold unpaid orders").replace("# ADR 0001:", "# ADR 0002:"),
    );
    const report = parseLint(dir);
    assert.deepEqual(
      report.errors.filter((e) => e.rule === "index-orphan-mapping").map((e) => e.where),
      ["docs/adr/ordering/0002-hold-unpaid-orders.md"],
    );
    assert.deepEqual(processFindings(report), []);
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /✗ \[process-adr-unindexed\] docs\/adr\/ordering\/0002-hold-unpaid-orders\.md/,
    );
  });
});

test("an ADR file of a realizing feature that another category records is unindexed for the feature, and the lint says so", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    write(
      dir,
      "docs/adr/ordering/0002-hold-unpaid-orders.md",
      ADR("Hold unpaid orders").replace("# ADR 0001:", "# ADR 0002:"),
    );
    const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
    mapping.categories.holds = {
      adrs: [
        {
          path: "docs/adr/ordering/0002-hold-unpaid-orders.md",
          status: "Proposed",
          summary: "unpaid orders are held",
        },
      ],
    };
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    // The gates count the feature's own records, so its Proposed ADR must be one of them.
    assert.match(cli(dir, ["validate"]).out, /process-adr-unindexed/);
    const hits = parseLint(dir).errors.filter((e) => e.rule === "process-adr-unindexed");
    assert.deepEqual(
      hits.map((h) => h.where),
      ["docs/adr/ordering/0002-hold-unpaid-orders.md"],
    );
  });
});

test("a realizing feature's record naming another folder's ADR is reported by the lint, which has no check of its own for it", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    write(dir, "docs/adr/payments/0001-take-payment.md", ADR("Take payment"));
    const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
    mapping.categories.ordering.adrs.push({
      path: "docs/adr/payments/0001-take-payment.md",
      status: "Proposed",
      summary: "payment is taken",
    });
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    const hits = parseLint(dir).errors.filter((e) => e.rule === "process-adr-record-invalid");
    assert.deepEqual(
      hits.map((h) => h.where),
      ["docs/adr/payments/0001-take-payment.md"],
    );
  });
});

test("a realizing ADR body that cites the model is an error", () => {
  withTmp((dir) => {
    fixture(dir, {
      realizes: ["ordering.confirm-order"],
      body: ADR("Confirm paid orders").replace(
        "## Decision\n\n",
        "## Decision\n\nThis realizes m:ordering.confirm-order in docs/process/ordering.ttl.\n\n",
      ),
    });
    const hits = parseLint(dir).errors.filter((e) => e.rule === "process-adr-identifier");
    assert.deepEqual(hits.map((h) => h.where).sort(), [
      "docs/adr/ordering/0001-confirm-paid-orders.md:21",
      "docs/adr/ordering/0001-confirm-paid-orders.md:21",
    ]);
  });
  withTmp((dir) => {
    fixture(dir, {
      body: ADR("Confirm paid orders").replace(
        "## Decision\n\n",
        "## Decision\n\nSee docs/process/ordering.ttl.\n\n",
      ),
    });
    assert.deepEqual(processFindings(parseLint(dir)), [], "only realizing categories are checked");
  });
});

test("a link in a realizing ADR is judged by where it leads from the ADR's own folder", () => {
  const cites = (link) =>
    withTmp((dir) => {
      fixture(dir, {
        realizes: ["ordering.confirm-order"],
        body: ADR("Confirm paid orders").replace(
          "## Decision\n\n",
          `## Decision\n\nSee [the reference](${link}).\n\n`,
        ),
      });
      return parseLint(dir).errors.some((e) => e.rule === "process-adr-identifier");
    });
  // From docs/adr/ordering/: two levels up is docs/, three is the repository root.
  assert.equal(cites("../../process/ordering.ttl"), true);
  assert.equal(cites("./../../process/ordering.ttl"), true);
  assert.equal(cites("../../process/"), true);
  assert.equal(cites("../../../process/"), false, "a root-level process/ folder is not the model");
  assert.equal(cites("../../../services/process/handler.md"), false);
});

test("a link into the model spelled in another letter case is a link into the model where the volume folds case", (t) => {
  withTmp((dir) => {
    fixture(dir, {
      realizes: ["ordering.confirm-order"],
      body: ADR("Confirm paid orders").replace(
        "## Decision\n\n",
        "## Decision\n\nSee [the flow](../../Process/model.ttl).\n\n",
      ),
    });
    if (!existsSync(path.join(dir, "docs/Process")))
      return t.skip("this volume keeps the two spellings apart");
    assert.ok(parseLint(dir).errors.some((e) => e.rule === "process-adr-identifier"));
  });
});

test("a link to a model document that is itself a link is a link into the model, by its path", () => {
  withTmp((dir) => {
    fixture(dir, {
      realizes: ["ordering.confirm-order"],
      body: ADR("Confirm paid orders").replace(
        "## Decision\n\n",
        "## Decision\n\nSee [the courier](../../process/extra.ttl).\n\n",
      ),
    });
    write(
      dir,
      "docs/shared/extra.ttl",
      '@prefix m: <urn:adr-writer:model:> .\n@prefix pm: <urn:adr-writer:process:> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\nm:courier a pm:Actor ;\n    rdfs:label "Courier" ;\n    pm:definition "The outside organization that delivers orders." .\n',
    );
    symlinkSync("../shared/extra.ttl", path.join(dir, "docs/process/extra.ttl"));
    assert.ok(parseLint(dir).errors.some((e) => e.rule === "process-adr-identifier"));
  });
});

test("a link to the folder a linked model directory leads to is judged by its path", () => {
  withTmp((dir) => {
    fixture(dir, {
      model: null,
      realizes: ["ordering.confirm-order"],
      body: ADR("Confirm paid orders").replace(
        "## Decision\n\n",
        "## Decision\n\nSee [the source](../../../model-src/ordering.ttl).\n\n",
      ),
    });
    write(dir, "model-src/ordering.ttl", EXAMPLE);
    symlinkSync("../model-src", path.join(dir, "docs/process"));
    assert.ok(!parseLint(dir).errors.some((e) => e.rule === "process-adr-identifier"));
  });
});

test("the model never records ADR references and the glossary keeps only terms the model does not own", () => {
  withTmp((dir) => {
    fixture(dir, {
      model: EXAMPLE.replace(
        '"Store accounting policy."',
        '"Decided in docs/adr/ordering/0001-confirm-paid-orders.md"',
      ),
    });
    assert.ok(parseLint(dir).errors.some((e) => e.rule === "process-adr-reference"));
  });
  withTmp((dir) => {
    fixture(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n| Term | Meaning in these documents |\n| --- | --- |\n| Order | a request |\n| Settlement | paying sellers |\n",
    );
    const report = parseLint(dir);
    assert.equal(report.code, 0);
    const overlap = report.warnings.filter((w) => w.rule === "process-glossary-overlap");
    assert.equal(overlap.length, 1);
    assert.match(overlap[0].msg, /"Order"/);
  });
});

test("format checks and rewrites the canonical form, and never drops comments silently", () => {
  withTmp((dir) => {
    fixture(dir, { model: SHUFFLED });
    assert.equal(cli(dir, ["format", "--check"]).code, 1);
    assert.equal(cli(dir, ["format", "--write"]).code, 0);
    assert.equal(readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"), EXAMPLE);
    assert.equal(cli(dir, ["format"]).code, 0);

    write(dir, "docs/process/ordering.ttl", `# owner: ordering team\n${EXAMPLE}`);
    const blocked = cli(dir, ["format", "--write"]);
    assert.equal(blocked.code, 1);
    assert.match(blocked.out, /--allow-comment-removal/);
    assert.match(readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"), /^# owner/);
    assert.ok(parseLint(dir).warnings.some((w) => w.rule === "process-comment"));
    assert.equal(cli(dir, ["format", "--write", "--allow-comment-removal"]).code, 0);
    assert.equal(readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"), EXAMPLE);
  });
});

test("diff reports semantic changes against a revision and ignores formatting", () => {
  withTmp((dir) => {
    initRepo(dir);
    fixture(dir);
    commitAll(dir);
    write(dir, "docs/process/ordering.ttl", `# reordered\n${SHUFFLED}`);
    const same = cli(dir, ["diff"]);
    assert.equal(same.code, 0, same.out);
    assert.match(same.out, /no semantic change against HEAD/);

    write(
      dir,
      "docs/process/ordering.ttl",
      EXAMPLE.replace('rdfs:label "Customer"', 'rdfs:label "Shopper"'),
    );
    const changed = JSON.parse(cli(dir, ["diff", "--json"]).out);
    assert.deepEqual(
      changed.elements.map((e) => [
        e.id,
        e.properties.map((p) => [p.property, p.family, p.removed, p.added]),
      ]),
      [["customer", [["rdfs:label", "fact", ['"Customer"'], ['"Shopper"']]]]],
    );
  });
});

const PREFIXES =
  "@prefix m: <urn:adr-writer:model:> .\n@prefix pm: <urn:adr-writer:process:> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n";

test("a symlinked model document is read like any other", () => {
  withTmp((dir) => {
    fixture(dir);
    write(dir, "shared/extra.ttl", `${PREFIXES}m:orphan a pm:Actor, pm:Step .\n`);
    symlinkSync(path.join(dir, "shared/extra.ttl"), path.join(dir, "docs/process/extra.ttl"));
    const report = JSON.parse(cli(dir, ["validate", "--json"]).out);
    assert.ok(
      report.findings.some((f) => f.code === "process-type-multiple"),
      JSON.stringify(report.findings),
    );
    assert.equal(cli(dir, ["validate"]).code, 1);
  });
});

test("an out-of-range escape or invalid UTF-8 is a positioned error and the lint still reports", () => {
  withTmp((dir) => {
    fixture(dir);
    write(dir, "docs/process/escape.ttl", `${PREFIXES}m:customer pm:summary "x\\U00110000" .\n`);
    const report = parseLint(dir);
    assert.equal(report.code, 1);
    const parse = report.errors.find((e) => e.rule === "process-parse");
    assert.ok(parse, JSON.stringify(report.errors));
    assert.match(JSON.stringify(parse), /escape\.ttl:5/);
    write(
      dir,
      "docs/process/escape.ttl",
      Buffer.concat([
        Buffer.from(`${PREFIXES}m:customer pm:summary "caf`),
        Buffer.from([0xe9]),
        Buffer.from('" .\n'),
      ]),
    );
    const utf = JSON.parse(cli(dir, ["validate", "--json"]).out);
    assert.ok(
      utf.findings.some(
        (f) =>
          f.code === "process-parse" &&
          /not valid UTF-8/.test(f.msg) &&
          /escape\.ttl:5:/.test(f.where),
      ),
      JSON.stringify(utf.findings),
    );
  });
});

test("the model lives only in the ADR directory's sibling process directory", () => {
  withTmp((dir) => {
    fixture(dir);
    assert.equal(cli(dir, ["validate", "--process-dir", "model"]).code, 2);
    assert.equal(runStructureLint(dir, ["--process-dir", "model"]).code, 2);
  });
});

test("format keeps an invalid model's graph, and the save path never drops comments silently", () => {
  withTmp((dir) => {
    fixture(dir, {
      model: SHUFFLED.replace(
        '    pm:definition "A person who buys products from the store." ;\n',
        "",
      ),
    });
    const graph = (text) =>
      parseTurtle(text)
        .triples.map((t) => `${t.s} ${t.p} ${JSON.stringify(t.o)}`)
        .sort()
        .join("\n");
    const before = readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8");
    assert.equal(cli(dir, ["validate"]).code, 1, "the model has a validation error");
    assert.equal(cli(dir, ["format", "--write"]).code, 0);
    const after = readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8");
    assert.notEqual(after, before, "the document was rewritten canonically");
    assert.equal(graph(after), graph(before), "and kept its graph");
    assert.match(cli(dir, ["validate"]).out, /process-attribute-missing/);
  });
  withTmp((dir) => {
    fixture(dir, { model: `# owner: ordering team\n${EXAMPLE}` });
    cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), { recursive: true });
    write(
      dir,
      "draft/ordering.ttl",
      EXAMPLE.replace('rdfs:label "Customer"', 'rdfs:label "Shopper"'),
    );
    const summary = JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json"]).out);
    assert.deepEqual(summary.commentsDroppedOnRewrite, ["docs/process/ordering.ttl"]);
    const refused = cli(dir, ["apply", "--draft", "draft", "--base-hash", summary.baseHash]);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /Turtle comments would be dropped/);
    assert.match(readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"), /^# owner/);
    const applied = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      summary.baseHash,
      "--allow-comment-removal",
    ]);
    assert.equal(applied.code, 0, applied.out);
    assert.doesNotMatch(
      readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"),
      /# owner/,
    );
  });
});

test("format rewrites no document while one cannot be parsed, and says where", () => {
  withTmp((dir) => {
    fixture(dir, { model: SHUFFLED });
    write(dir, "docs/process/broken.ttl", '@prefix m: <urn:adr-writer:model:> .\nm:a m:b "open\n');
    const bytes = () =>
      ["broken.ttl", "ordering.ttl"].map((f) => readFileSync(path.join(dir, "docs/process", f)));
    const before = bytes();
    const formatted = cli(dir, ["format", "--write"]);
    assert.equal(formatted.code, 1, formatted.out);
    assert.match(formatted.out, /✗ \[process-parse\] docs\/process\/broken\.ttl:2:\d+/);
    assert.deepEqual(
      bytes(),
      before,
      "neither the broken nor the non-canonical document is rewritten",
    );
  });
});

test(
  "documents under a linked directory are read, and a dangling or unreadable document is an error",
  {
    skip: process.getuid?.() === 0 && "an unreadable file does not stop root from reading",
  },
  () => {
    withTmp((dir) => {
      fixture(dir);
      write(dir, "shared/more/extra.ttl", `${PREFIXES}m:orphan a pm:Actor, pm:Step .\n`);
      symlinkSync(path.join(dir, "shared/more"), path.join(dir, "docs/process/more"));
      assert.ok(
        JSON.parse(cli(dir, ["validate", "--json"]).out).findings.some(
          (f) => f.code === "process-type-multiple",
        ),
        "a document under a linked directory is part of the model",
      );
      unlinkSync(path.join(dir, "docs/process/more"));
      symlinkSync(path.join(dir, "shared/missing.ttl"), path.join(dir, "docs/process/gone.ttl"));
      const dangling = JSON.parse(cli(dir, ["validate", "--json"]).out);
      assert.ok(
        dangling.findings.some(
          (f) => /gone\.ttl:1:1/.test(f.where) && /cannot read the document/.test(f.msg),
        ),
        JSON.stringify(dangling.findings),
      );
      rmSync(path.join(dir, "docs/process/gone.ttl"));
      write(dir, "docs/process/locked.ttl", `${PREFIXES}m:customer pm:summary "x" .\n`);
      chmodSync(path.join(dir, "docs/process/locked.ttl"), 0o000);
      try {
        const locked = JSON.parse(cli(dir, ["validate", "--json"]).out);
        assert.ok(
          locked.findings.some(
            (f) => /locked\.ttl/.test(f.where) && /cannot read the document/.test(f.msg),
          ),
          JSON.stringify(locked.findings),
        );
      } finally {
        chmodSync(path.join(dir, "docs/process/locked.ttl"), 0o644);
      }
    });
  },
);

test("diff reads documents as strictly as validation, and an invalid byte is located exactly", () => {
  withTmp((dir) => {
    initRepo(dir);
    fixture(dir);
    commitAll(dir);
    const bytes = Buffer.concat([
      Buffer.from(
        `${PREFIXES}m:customer pm:summary "real \u{FFFD} char" .\nm:customer pm:summary "caf`,
      ),
      Buffer.from([0xe9]),
      Buffer.from('" .\n'),
    ]);
    write(dir, "docs/process/escape.ttl", bytes);
    const out = cli(dir, ["diff"]);
    assert.equal(out.code, 1);
    assert.match(out.out, /escape\.ttl:6:\d+[\s\S]*not valid UTF-8/, out.out);
    assert.doesNotMatch(out.out, /caf�/);
  });
});

test("diff reads committed documents as strictly as the working tree", () => {
  withTmp((dir) => {
    initRepo(dir);
    fixture(dir);
    write(
      dir,
      "docs/process/x.ttl",
      Buffer.concat([
        Buffer.from(`${PREFIXES}m:customer pm:summary "caf`),
        Buffer.from([0xe9]),
        Buffer.from('" .\n'),
      ]),
    );
    commitAll(dir);
    // The working tree holds the repaired document, so only the committed one fails.
    write(dir, "docs/process/x.ttl", `${PREFIXES}m:customer pm:summary "café" .\n`);
    const out = cli(dir, ["diff"]);
    assert.equal(out.code, 1, out.out);
    assert.match(
      out.out,
      /✗ \[process-parse\] HEAD:docs\/process\/x\.ttl:5:27\n\s+the document is not valid UTF-8/,
    );
    assert.doesNotMatch(out.out, /\] docs\/process\/x\.ttl/);
  });
});

test("the lint leaves out a record finding only for the record its own check reports", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    write(dir, "docs/adr/payments/0001-take-payment.md", ADR("Take payment"));
    const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
    // One record without a path, which the shape check reports, and one naming another
    // folder's ADR, which only the process level sees.
    mapping.categories.ordering.adrs.push(
      { status: "Proposed", summary: "no path" },
      { path: "docs/adr/payments/0001-take-payment.md", status: "Proposed", summary: "s" },
    );
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    const hits = parseLint(dir).errors.filter((e) => e.rule === "process-adr-record-invalid");
    assert.deepEqual(
      hits.map((h) => h.where),
      ["docs/adr/payments/0001-take-payment.md"],
    );
  });
});

test(
  "an indexed realizing ADR the lint cannot read is reported once",
  { skip: process.getuid?.() === 0 && "an unreadable file does not stop root from reading" },
  () => {
    withTmp((dir) => {
      fixture(dir, { realizes: ["ordering.confirm-order"] });
      const file = path.join(dir, "docs/adr/ordering/0001-confirm-paid-orders.md");
      chmodSync(file, 0o000);
      try {
        const errors = parseLint(dir).errors.filter(
          (e) => e.where === "docs/adr/ordering/0001-confirm-paid-orders.md",
        );
        assert.deepEqual(
          errors.map((e) => e.rule),
          ["read"],
        );
      } finally {
        chmodSync(file, 0o644);
      }
    });
  },
);
