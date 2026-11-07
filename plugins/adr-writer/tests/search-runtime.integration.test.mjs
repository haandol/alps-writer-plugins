import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchCachePath } from "../scripts/search/search-index.mjs";

const run = promisify(execFile);
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
  const cacheDir = path.join(dir, "cache");
  const command = path.join(installed, "adr-search.mjs");
  const query = async (root, query) =>
    JSON.parse(
      (
        await run(
          "bun",
          [
            "--no-install",
            command,
            "--root",
            root,
            "--query",
            query,
            "--cache-dir",
            cacheDir,
            "--json",
          ],
          { timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
        )
      ).stdout,
    );
  return {
    dir,
    installed,
    cacheDir,
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
    const file = searchCachePath({
      root,
      namespace: "decisions:" + path.join(root, "docs/adr") + ":",
      cacheDir: f.cacheDir,
    });
    assert.equal(readFileSync(file).subarray(0, 15).toString(), "SQLite format 3");
  } finally {
    f.close();
  }
});

test("concurrent Bun searches keep each worktree's current source and cache independent", async () => {
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

test("a held SQLite writer does not change Bun search results or source files", async () => {
  const f = setup();
  let holder;
  try {
    const root = f.makeRepo("project", "alpha marker");
    const expected = await f.query(root, "alpha");
    const file = searchCachePath({
      root,
      namespace: "decisions:" + path.join(root, "docs/adr") + ":",
      cacheDir: f.cacheDir,
    });
    const script = path.join(f.dir, "hold.mjs");
    writeFileSync(
      script,
      'import {Database} from "bun:sqlite"; const db=new Database(process.argv[2]); db.exec("BEGIN IMMEDIATE"); console.log("ready"); const timer=setInterval(()=>{},1000); process.on("SIGTERM",()=>{db.exec("ROLLBACK");db.close();clearInterval(timer);});',
    );
    holder = spawn("bun", [script, file], { stdio: ["ignore", "pipe", "pipe"] });
    const ready = await once(holder.stdout, "data", { signal: AbortSignal.timeout(10000) });
    assert.match(String(ready[0]), /ready/);
    assert.deepEqual(await f.query(root, "alpha"), expected);
  } finally {
    if (holder && holder.exitCode === null) {
      const done = once(holder, "exit");
      holder.kill("SIGTERM");
      await done;
    }
    f.close();
  }
});
