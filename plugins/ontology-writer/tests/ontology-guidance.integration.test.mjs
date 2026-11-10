// The business ontology level in the instructions agents actually load:
// the session directive, the business-context module and its callers, and the
// ontology skills.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { runHook, withTmp, write } from "./helpers.mjs";
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
