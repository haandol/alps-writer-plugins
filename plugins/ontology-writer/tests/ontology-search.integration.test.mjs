import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { commitAll, initRepo, mkTmp, write, writeAdrFiles } from "./helpers.mjs";
import { EXAMPLE, cli } from "./ontology-helpers.mjs";
import { MAPPING } from "./ontology-query-helpers.mjs";

// Files a search left in the private home, apart from Bun's own transpiler cache.
const searchFiles = (home) =>
  readdirSync(home, { recursive: true }).filter(
    (p) =>
      ![".cache", path.join(".cache", "bun")].includes(p) &&
      !p.startsWith(path.join(".cache", "bun") + path.sep),
  );

test("Bun business search reads the current documents without search files, returns source evidence and retains diagnostics after edits", () => {
  const dir = mkTmp("bun-ontology-search-");
  try {
    const root = path.join(dir, "repo");
    write(
      root,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: {
          ordering: MAPPING.categories.ordering,
          payments: MAPPING.categories.payments,
        },
      }),
    );
    writeAdrFiles(root, {
      categories: { ordering: MAPPING.categories.ordering, payments: MAPPING.categories.payments },
    });
    const text =
      EXAMPLE +
      '\nm:ordering.search-case a onto:Step ; rdfs:label "Search example" ; onto:definition "결제가 완료되면 주문을 확정한다." ; onto:stepKind "system" ; onto:inContext m:ordering .\nm:ordering.place-order onto:hasStep m:ordering.search-case .\nm:customer onto:performs m:ordering.search-case .\n';
    const file = write(root, "docs/ontology/model.ttl", text);
    initRepo(root);
    commitAll(root, "Search fixture");
    // A private home and cache root: the query must leave both empty.
    const home = path.join(dir, "home");
    mkdirSync(home);
    const env = { ...process.env, HOME: home, XDG_CACHE_HOME: path.join(home, ".cache") };
    const query = (term) =>
      JSON.parse(
        cli(root, ["query", "--context", "ordering", "--search", term, "--json"], env).out,
      );
    const before = readFileSync(file);
    const r = query("확정 결제");
    assert.equal(r.complete, true);
    assert.ok(r.items.some((i) => i.id === "ordering.search-case" && i.searchMatch.matches.length));
    assert.deepEqual(readFileSync(file), before);
    assert.deepEqual(searchFiles(home), []);
    assert.equal(existsSync(path.join(root, ".cache")), false);
    write(
      root,
      "docs/ontology/model.ttl",
      text.replace("결제가 완료되면 주문을 확정한다.", "환불을 확인한다."),
    );
    const changed = query("환불");
    assert.ok(changed.items.some((i) => i.id === "ordering.search-case"));
    assert.ok(
      changed.items.some((i) => i.kind === "diagnostic" && i.flag.startsWith("uncommitted")),
    );
    const removed = query("확정 결제");
    assert.ok(!removed.items.some((i) => i.kind === "element" && i.id === "ordering.search-case"));
    assert.ok(
      removed.items.some((i) => i.kind === "diagnostic" && i.id === "ordering.search-case"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
