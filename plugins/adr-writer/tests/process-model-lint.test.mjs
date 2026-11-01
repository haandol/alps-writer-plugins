// The optional business process model level inside adr-structure-lint and the
// process-model CLI: a repository without a model is untouched, a model is
// validated as one union graph, and ADR index links stay consistent with it.
import assert from "node:assert/strict";
import { chmodSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseLint, runStructureLint, withTmp, write } from "./helpers.mjs";
import { EXAMPLE, cli } from "./process-model-helpers.mjs";
import { ADR, fixture, SHUFFLED, PREFIXES } from "./process-model-lint-helpers.mjs";

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

test("a model that cannot be validated is reported at its own directory, wherever the ADRs live", () => {
  withTmp((dir) => {
    write(dir, "adr/.mapping.json", JSON.stringify({ categories: {} }));
    write(dir, "process/ordering.ttl", EXAMPLE);
    write(dir, "process/broken.ttl", '@prefix m: <urn:adr-writer:model:> .\nm:a m:b "open\n');
    const checked = cli(dir, ["validate", "--adr-dir", "adr"]);
    assert.equal(checked.code, 1, checked.out);
    assert.match(checked.out, /✗ \[process-parse\] process\/broken\.ttl:2:\d+/);
    assert.match(checked.out, /✗ \[process-not-validated\] process\n/);
    assert.doesNotMatch(checked.out, /docs\/process/);
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

test("output larger than a pipe buffer reaches the reader whole", () => {
  withTmp((dir) => {
    // Two thousand elements of unknown types: a report far larger than a pipe buffer.
    const unknown = Array.from({ length: 2000 }, (_, i) => `m:x${i} a pm:Unknown${i} .\n`);
    write(
      dir,
      "docs/process/model.ttl",
      `@prefix m: <urn:adr-writer:model:> .\n@prefix pm: <urn:adr-writer:process:> .\n\n${unknown.join("")}`,
    );
    const run = cli(dir, ["validate", "--json"]);
    assert.equal(run.code, 1);
    assert.ok(run.out.length > 65536, `${run.out.length} bytes`);
    const report = JSON.parse(run.out);
    assert.ok(report.findings.some((f) => f.element === "x1999"));
  });
});
