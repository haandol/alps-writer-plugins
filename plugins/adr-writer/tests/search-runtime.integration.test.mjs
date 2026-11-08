import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

// Files a search left in the private home, apart from Bun's own transpiler cache.
const searchFiles = (home) =>
  readdirSync(home, { recursive: true }).filter(
    (p) =>
      ![".cache", path.join(".cache", "bun")].includes(p) &&
      !p.startsWith(path.join(".cache", "bun") + path.sep),
  );
const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts");

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), "bare-bun-search-"));
  const installed = path.join(dir, "installed/scripts");
  mkdirSync(installed, { recursive: true });
  for (const file of ["adr-search.mjs", "adr-lint-lib.mjs"])
    cpSync(path.join(scripts, file), path.join(installed, file));
  cpSync(path.join(scripts, "search"), path.join(installed, "search"), { recursive: true });
  const makeRepo = (name, word) => {
    const root = path.join(dir, name);
    mkdirSync(path.join(root, "docs/adr/orders"), { recursive: true });
    const record = {
      path: "docs/adr/orders/0001-work.md",
      status: "Proposed",
      summary: "Local work",
    };
    writeFileSync(
      path.join(root, "docs/adr/.mapping.json"),
      JSON.stringify({ categories: { orders: { adrs: [record], dependsOn: [] } } }),
    );
    writeFileSync(
      path.join(root, record.path),
      "# Work\n\n## Status\n\nProposed\n\n## Decision\n\n" + word + "\n",
    );
    return root;
  };
  // A private home and cache root: searches must leave both empty.
  const home = path.join(dir, "home");
  mkdirSync(home);
  const env = { ...process.env, HOME: home, XDG_CACHE_HOME: path.join(home, ".cache") };
  const command = path.join(installed, "adr-search.mjs");
  const query = async (root, query) =>
    JSON.parse(
      (
        await run(process.execPath, [command, "--root", root, "--query", query, "--json"], {
          timeout: 15000,
          maxBuffer: 2 * 1024 * 1024,
          env,
        })
      ).stdout,
    );
  return {
    dir,
    installed,
    home,
    makeRepo,
    query,
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("a standalone Bun install searches Korean source text with no package or sibling plugin", async () => {
  const f = setup();
  try {
    const root = f.makeRepo("project with spaces", "결제가 완료되면 주문을 확정한다.");
    const source = path.join(root, "docs/adr/orders/0001-work.md");
    const before = readFileSync(source);
    const result = await f.query(root, "확정 결제");
    assert.equal(result.complete, true);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].source.lineStart, 7);
    assert.deepEqual(readFileSync(source), before);
    assert.deepEqual(searchFiles(f.home), []);
  } finally {
    f.close();
  }
});

test("concurrent Bun searches keep each worktree's current source independent", async () => {
  const f = setup();
  try {
    const left = f.makeRepo("left", "alpha marker");
    const right = f.makeRepo("right", "beta marker");
    const requests = [
      f.query(left, "alpha"),
      f.query(right, "beta"),
      f.query(left, "beta"),
      f.query(right, "alpha"),
    ];
    const results = await Promise.all(requests);
    assert.deepEqual(
      results.map((r) => r.results.length),
      [1, 1, 0, 0],
    );
    assert.ok(results.every((r) => r.complete));
    assert.equal(results[0].scope.root, left);
    assert.equal(results[1].scope.root, right);
  } finally {
    f.close();
  }
});
