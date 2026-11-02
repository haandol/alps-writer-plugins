// The ontology CLI's validation: a repository without a model is untouched,
// a model is validated as one union graph, and ADR index links stay consistent
// with it. ADR Writer's own lint never reads the model; its tests say so.
import assert from "node:assert/strict";
import { chmodSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { withTmp, write } from "./helpers.mjs";
import { EXAMPLE, cli } from "./ontology-helpers.mjs";
import { ADR, fixture, SHUFFLED, PREFIXES } from "./ontology-lint-helpers.mjs";

/** The CLI's validation as a report: its exit code, and its errors and warnings by rule. */
function validated(dir) {
  const run = cli(dir, ["validate", "--json"]);
  const { findings } = JSON.parse(run.out);
  const by = (error) =>
    findings
      .filter((f) => (f.level === "error") === error)
      .map((f) => ({ rule: f.code, where: f.where, msg: f.msg }));
  return { code: run.code, errors: by(true), warnings: by(false) };
}
const ontologyFindings = (report) => [...report.errors, ...report.warnings];

test("without model documents or links validation finds no model, and a non-Turtle document is not one", () => {
  withTmp((dir) => {
    fixture(dir, { model: null });
    assert.equal(cli(dir, ["validate"]).out.trim(), "no ontology in docs/ontology");
    write(
      dir,
      "docs/ontology/CHANGELOG.md",
      "# Process changes\n\n- 2020-01-30 started the model\n",
    );
    const withNotes = cli(dir, ["validate"]);
    assert.equal(withNotes.code, 0, withNotes.out);
    assert.equal(withNotes.out.trim(), "no ontology in docs/ontology");
  });
});

test("a valid model and an existing realized step validate clean", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    const report = validated(dir);
    assert.equal(report.code, 0, JSON.stringify(report.errors));
    assert.deepEqual(ontologyFindings(report), []);
    const json = JSON.parse(cli(dir, ["validate", "--json"]).out);
    assert.deepEqual(
      { ok: json.ok, model: json.model, findings: json.findings },
      { ok: true, model: true, findings: [] },
    );
  });
});

test("model errors fail validation with their document position", () => {
  withTmp((dir) => {
    fixture(dir, { model: `${EXAMPLE}\nm:customer onto:performs m:ordering.order .\n` });
    const report = validated(dir);
    assert.equal(report.code, 1);
    const error = report.errors.find((e) => e.rule === "ontology-relation-target");
    assert.match(error.where, /^docs\/ontology\/ordering\.ttl:\d+$/);

    write(
      dir,
      "docs/ontology/broken.ttl",
      "@prefix m: <urn:ontology-writer:model:> .\nm:x a [ ] .\n",
    );
    const broken = validated(dir);
    assert.ok(
      broken.errors.some(
        (e) => e.rule === "ontology-blank-node" && e.where === "docs/ontology/broken.ttl:2:7",
      ),
    );
    assert.ok(broken.errors.some((e) => e.rule === "ontology-not-validated"));
    assert.equal(cli(dir, ["validate"]).code, 1);
  });
});

test("dangling and orphaned realizes links are errors; an empty record is not a link", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.cancel-order"] });
    assert.ok(
      validated(dir).errors.some(
        (e) => e.rule === "ontology-link-dangling" && /cancel-order/.test(e.msg),
      ),
    );
  });
  withTmp((dir) => {
    fixture(dir, { model: null, realizes: ["ordering.confirm-order"] });
    const report = validated(dir);
    assert.ok(
      report.errors.some(
        (e) => e.rule === "ontology-link-dangling" && /"ordering".*no ontology/.test(e.msg),
      ),
    );
  });
  withTmp((dir) => {
    fixture(dir, { model: null, realizes: [] });
    assert.deepEqual(
      ontologyFindings(validated(dir)),
      [],
      "a confirmed no-link record needs no model",
    );
  });
});

test("a realizes value that is not a list is a link-shape error", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: "ordering.submit-order" });
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(validated.out, /✗ \[ontology-link-shape\] docs\/adr\/\.mapping\.json/);
  });
});

test("a realizing ADR whose Status differs from its index record is a Status mismatch", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"], status: "Accepted (2020-01-01)" });
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /✗ \[ontology-adr-status-mismatch\] docs\/adr\/ordering\/0001-confirm-paid-orders\.md/,
    );
  });
});

test("a realizing ADR whose indexed file is missing is a missing ADR", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    rmSync(path.join(dir, "docs/adr/ordering/0001-confirm-paid-orders.md"));
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /✗ \[ontology-adr-missing\] docs\/adr\/ordering\/0001-confirm-paid-orders\.md/,
    );
  });
});

test("an ADR file of a realizing feature that the index does not list is an unindexed ADR", () => {
  withTmp((dir) => {
    fixture(dir, { realizes: ["ordering.confirm-order"] });
    write(
      dir,
      "docs/adr/ordering/0002-hold-unpaid-orders.md",
      ADR("Hold unpaid orders").replace("# ADR 0001:", "# ADR 0002:"),
    );
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1);
    assert.match(
      validated.out,
      /✗ \[ontology-adr-unindexed\] docs\/adr\/ordering\/0002-hold-unpaid-orders\.md/,
    );
  });
});

test("an ADR file of a realizing feature that another category records is unindexed for the feature", () => {
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
    assert.match(cli(dir, ["validate"]).out, /ontology-adr-unindexed/);
    const hits = validated(dir).errors.filter((e) => e.rule === "ontology-adr-unindexed");
    assert.deepEqual(
      hits.map((h) => h.where),
      ["docs/adr/ordering/0002-hold-unpaid-orders.md"],
    );
  });
});

test("a realizing feature's record naming another folder's ADR is an invalid record", () => {
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
    const hits = validated(dir).errors.filter((e) => e.rule === "ontology-adr-record-invalid");
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
        "## Decision\n\nThis realizes m:ordering.confirm-order in docs/ontology/ordering.ttl.\n\n",
      ),
    });
    const hits = validated(dir).errors.filter((e) => e.rule === "ontology-adr-identifier");
    assert.deepEqual(hits.map((h) => h.where).sort(), [
      "docs/adr/ordering/0001-confirm-paid-orders.md:21",
      "docs/adr/ordering/0001-confirm-paid-orders.md:21",
    ]);
  });
  withTmp((dir) => {
    fixture(dir, {
      body: ADR("Confirm paid orders").replace(
        "## Decision\n\n",
        "## Decision\n\nSee docs/ontology/ordering.ttl.\n\n",
      ),
    });
    assert.deepEqual(ontologyFindings(validated(dir)), [], "only realizing categories are checked");
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
    assert.ok(validated(dir).errors.some((e) => e.rule === "ontology-adr-reference"));
  });
  withTmp((dir) => {
    fixture(dir);
    write(
      dir,
      "docs/adr/glossary.md",
      "# Glossary\n\n| Term | Meaning in these documents |\n| --- | --- |\n| Order | a request |\n| Settlement | paying sellers |\n",
    );
    const report = validated(dir);
    assert.equal(report.code, 0);
    const overlap = report.warnings.filter((w) => w.rule === "ontology-glossary-overlap");
    assert.equal(overlap.length, 1);
    assert.match(overlap[0].msg, /"Order"/);
  });
});

test("format checks and rewrites the canonical form, and never drops comments silently", () => {
  withTmp((dir) => {
    fixture(dir, { model: SHUFFLED });
    assert.equal(cli(dir, ["format", "--check"]).code, 1);
    assert.equal(cli(dir, ["format", "--write"]).code, 0);
    assert.equal(readFileSync(path.join(dir, "docs/ontology/ordering.ttl"), "utf8"), EXAMPLE);
    assert.equal(cli(dir, ["format"]).code, 0);

    write(dir, "docs/ontology/ordering.ttl", `# owner: ordering team\n${EXAMPLE}`);
    const blocked = cli(dir, ["format", "--write"]);
    assert.equal(blocked.code, 1);
    assert.match(blocked.out, /--allow-comment-removal/);
    assert.match(readFileSync(path.join(dir, "docs/ontology/ordering.ttl"), "utf8"), /^# owner/);
    assert.ok(validated(dir).warnings.some((w) => w.rule === "ontology-comment"));
    assert.equal(cli(dir, ["format", "--write", "--allow-comment-removal"]).code, 0);
    assert.equal(readFileSync(path.join(dir, "docs/ontology/ordering.ttl"), "utf8"), EXAMPLE);
  });
});

test("a symlinked model document is read like any other", () => {
  withTmp((dir) => {
    fixture(dir);
    write(dir, "shared/extra.ttl", `${PREFIXES}m:orphan a onto:Actor, onto:Step .\n`);
    symlinkSync(path.join(dir, "shared/extra.ttl"), path.join(dir, "docs/ontology/extra.ttl"));
    const report = JSON.parse(cli(dir, ["validate", "--json"]).out);
    assert.ok(
      report.findings.some((f) => f.code === "ontology-type-multiple"),
      JSON.stringify(report.findings),
    );
    assert.equal(cli(dir, ["validate"]).code, 1);
  });
});

test("an out-of-range escape or invalid UTF-8 is a positioned error and validation still reports", () => {
  withTmp((dir) => {
    fixture(dir);
    write(dir, "docs/ontology/escape.ttl", `${PREFIXES}m:customer onto:summary "x\\U00110000" .\n`);
    const report = validated(dir);
    assert.equal(report.code, 1);
    const parse = report.errors.find((e) => e.rule === "ontology-parse");
    assert.ok(parse, JSON.stringify(report.errors));
    assert.match(JSON.stringify(parse), /escape\.ttl:5/);
    write(
      dir,
      "docs/ontology/escape.ttl",
      Buffer.concat([
        Buffer.from(`${PREFIXES}m:customer onto:summary "caf`),
        Buffer.from([0xe9]),
        Buffer.from('" .\n'),
      ]),
    );
    const utf = JSON.parse(cli(dir, ["validate", "--json"]).out);
    assert.ok(
      utf.findings.some(
        (f) =>
          f.code === "ontology-parse" &&
          /not valid UTF-8/.test(f.msg) &&
          /escape\.ttl:5:/.test(f.where),
      ),
      JSON.stringify(utf.findings),
    );
  });
});

test("the model lives only in the ADR directory's sibling ontology directory", () => {
  withTmp((dir) => {
    fixture(dir);
    assert.equal(cli(dir, ["validate", "--ontology-dir", "model"]).code, 2);
  });
});

test("format rewrites no document while one cannot be parsed, and says where", () => {
  withTmp((dir) => {
    fixture(dir, { model: SHUFFLED });
    write(
      dir,
      "docs/ontology/broken.ttl",
      '@prefix m: <urn:ontology-writer:model:> .\nm:a m:b "open\n',
    );
    const bytes = () =>
      ["broken.ttl", "ordering.ttl"].map((f) => readFileSync(path.join(dir, "docs/ontology", f)));
    const before = bytes();
    const formatted = cli(dir, ["format", "--write"]);
    assert.equal(formatted.code, 1, formatted.out);
    assert.match(formatted.out, /✗ \[ontology-parse\] docs\/ontology\/broken\.ttl:2:\d+/);
    assert.deepEqual(
      bytes(),
      before,
      "neither the broken nor the non-canonical document is rewritten",
    );
  });
});

test("a model that cannot be validated is reported at its own directory, wherever the ADRs live", () => {
  withTmp((dir) => {
    write(dir, "adr/.mapping.json", JSON.stringify({ categories: {} }));
    write(dir, "ontology/ordering.ttl", EXAMPLE);
    write(dir, "ontology/broken.ttl", '@prefix m: <urn:ontology-writer:model:> .\nm:a m:b "open\n');
    const checked = cli(dir, ["validate", "--adr-dir", "adr"]);
    assert.equal(checked.code, 1, checked.out);
    assert.match(checked.out, /✗ \[ontology-parse\] ontology\/broken\.ttl:2:\d+/);
    assert.match(checked.out, /✗ \[ontology-not-validated\] ontology\n/);
    assert.doesNotMatch(checked.out, /docs\/ontology/);
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
      write(dir, "shared/more/extra.ttl", `${PREFIXES}m:orphan a onto:Actor, onto:Step .\n`);
      symlinkSync(path.join(dir, "shared/more"), path.join(dir, "docs/ontology/more"));
      assert.ok(
        JSON.parse(cli(dir, ["validate", "--json"]).out).findings.some(
          (f) => f.code === "ontology-type-multiple",
        ),
        "a document under a linked directory is part of the model",
      );
      unlinkSync(path.join(dir, "docs/ontology/more"));
      symlinkSync(path.join(dir, "shared/missing.ttl"), path.join(dir, "docs/ontology/gone.ttl"));
      const dangling = JSON.parse(cli(dir, ["validate", "--json"]).out);
      assert.ok(
        dangling.findings.some(
          (f) => /gone\.ttl:1:1/.test(f.where) && /cannot read the document/.test(f.msg),
        ),
        JSON.stringify(dangling.findings),
      );
      rmSync(path.join(dir, "docs/ontology/gone.ttl"));
      write(dir, "docs/ontology/locked.ttl", `${PREFIXES}m:customer onto:summary "x" .\n`);
      chmodSync(path.join(dir, "docs/ontology/locked.ttl"), 0o000);
      try {
        const locked = JSON.parse(cli(dir, ["validate", "--json"]).out);
        assert.ok(
          locked.findings.some(
            (f) => /locked\.ttl/.test(f.where) && /cannot read the document/.test(f.msg),
          ),
          JSON.stringify(locked.findings),
        );
      } finally {
        chmodSync(path.join(dir, "docs/ontology/locked.ttl"), 0o644);
      }
    });
  },
);

test("output larger than a pipe buffer reaches the reader whole", () => {
  withTmp((dir) => {
    // Two thousand elements of unknown types: a report far larger than a pipe buffer.
    const unknown = Array.from({ length: 2000 }, (_, i) => `m:x${i} a onto:Unknown${i} .\n`);
    write(
      dir,
      "docs/ontology/model.ttl",
      `@prefix m: <urn:ontology-writer:model:> .\n@prefix onto: <urn:ontology-writer:vocabulary:> .\n\n${unknown.join("")}`,
    );
    const run = cli(dir, ["validate", "--json"]);
    assert.equal(run.code, 1);
    assert.ok(run.out.length > 65536, `${run.out.length} bytes`);
    const report = JSON.parse(run.out);
    assert.ok(report.findings.some((f) => f.element === "x1999"));
  });
});

test("help prints the usage, a missing command points to it, and format says when there is no model", () => {
  withTmp((dir) => {
    for (const ask of ["help", "--help", "-h"]) {
      const help = cli(dir, [ask]);
      assert.equal(help.code, 0, help.out);
      assert.match(help.out, /^Usage:\n {2}node ontology\.mjs validate/);
      assert.match(help.out, /^Exit: 0 = clean/m);
    }
    const missing = cli(dir, []);
    assert.equal(missing.code, 2);
    assert.match(missing.out, /expected a command: .* \(help shows the usage\)/);
    const empty = cli(dir, ["format", "--check"]);
    assert.equal(empty.code, 0, empty.out);
    assert.equal(empty.out, "no ontology in docs/ontology; nothing to format\n");
  });
});
