import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { commitAll, initRepo, mkTmp, write, writeAdrFiles } from "./helpers.mjs";
import { EXAMPLE, CLI } from "./ontology-helpers.mjs";
import { MAPPING } from "./ontology-query-helpers.mjs";

test("Bun business search creates a local SQLite index, returns source evidence and retains diagnostics after edits", () => {
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
    const cache = path.join(dir, "cache");
    const query = (term) =>
      JSON.parse(
        execFileSync(
          "bun",
          [
            "--no-install",
            CLI,
            "query",
            "--context",
            "ordering",
            "--search",
            term,
            "--cache-dir",
            cache,
            "--json",
          ],
          { cwd: root, encoding: "utf8" },
        ),
      );
    const before = readFileSync(file);
    const r = query("확정 결제");
    assert.equal(r.complete, true);
    assert.ok(r.items.some((i) => i.id === "ordering.search-case" && i.searchMatch.matches.length));
    assert.deepEqual(readFileSync(file), before);
    const db = readdirSync(cache).find((name) => name.endsWith(".sqlite"));
    assert.ok(db);
    assert.equal(readFileSync(path.join(cache, db)).subarray(0, 15).toString(), "SQLite format 3");
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
