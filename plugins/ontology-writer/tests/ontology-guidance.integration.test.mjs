// The business ontology level in the instructions agents actually load:
// the session directive, the business-context module and its callers, and the
// ontology skills.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runHook, withTmp, write, writeAdrFiles, PLUGIN_ROOT } from "./helpers.mjs";
import { EXAMPLE } from "./ontology-guidance-helpers.mjs";

test("the session directive's query reads the model beside an index kept elsewhere", () => {
  withTmp((dir) => {
    write(
      dir,
      "adr/.mapping.json",
      JSON.stringify({
        categories: { ordering: { adrs: [], realizes: ["ordering.submit-order"] } },
      }),
    );
    write(dir, "ontology/ordering.ttl", EXAMPLE);
    const ctx = runHook(dir, { env: { ALPS_ADR_MAPPING: "adr/.mapping.json" } });
    const [, cli, where] = ctx.match(/\(bun "([^"]+)" query --step <id>( --adr-dir "adr")\)/) ?? [];
    assert.ok(cli && where, ctx);
    const query = spawnSync(
      "bun",
      [cli, "query", "--step", "ordering.submit-order", "--adr-dir", "adr"],
      {
        cwd: dir,
        encoding: "utf8",
      },
    );
    assert.equal(query.status, 0, query.stdout + query.stderr);
    assert.match(query.stdout, /Business context — step "ordering.submit-order"/);
    assert.doesNotMatch(query.stdout, /no ontology|NOT FOUND/);
  });
});

test("the hook preserves a custom index filename through query and missing-index errors", () => {
  withTmp((dir) => {
    const indexFile = "spec/adr/current.json";
    const mapping = {
      categories: {
        ordering: {
          adrs: [
            {
              path: "spec/adr/ordering/0001-order.md",
              status: "Proposed",
              summary: "Order",
            },
          ],
          realizes: ["ordering.submit-order"],
        },
      },
    };
    write(dir, indexFile, JSON.stringify(mapping));
    writeAdrFiles(dir, mapping);
    write(dir, "spec/ontology/ordering.ttl", EXAMPLE);
    // A different valid index must not silently replace the configured one.
    write(dir, "spec/adr/.mapping.json", '{"categories":{}}');
    const ctx = runHook(dir, { env: { ALPS_ADR_MAPPING: indexFile } });
    const [, script, selected] =
      ctx.match(/\(bun "([^"]+)" query --step <id> --index "([^"]+)"\)/) ?? [];
    assert.ok(script, ctx);
    assert.equal(selected, indexFile);
    for (const args of [["--index", selected], []]) {
      const query = spawnSync(
        process.execPath,
        [script, "query", "--step", "ordering.submit-order", "--json", ...args],
        {
          cwd: dir,
          encoding: "utf8",
          env: { ...process.env, ALPS_ADR_MAPPING: indexFile },
        },
      );
      assert.equal(query.status, 0, query.stdout + query.stderr);
      assert.equal(JSON.parse(query.stdout).steps[0].step.realizedBy[0].category, "ordering");
    }
    unlinkSync(path.join(dir, indexFile));
    const missing = spawnSync(
      process.execPath,
      [
        path.join(PLUGIN_ROOT, "scripts/ontology.mjs"),
        "query",
        "--step",
        "ordering.submit-order",
        "--index",
        indexFile,
        "--json",
      ],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    const result = JSON.parse(missing.stdout);
    assert.equal(result.complete, false);
    assert.ok(result.errors.some((e) => e.code === "ontology-index-unreadable"));
  });
});
