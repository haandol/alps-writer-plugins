import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const preload = fileURLToPath(new URL("../../../scripts/test-compile-cache.mjs", import.meta.url));
const probe = `
  import { spawnSync } from "node:child_process";
  import { getCompileCacheDir } from "node:module";
  const child = spawnSync(process.execPath,
    ["-p", "require('node:module').getCompileCacheDir()"],
    { encoding: "utf8", cwd: process.env.CACHE_PROBE_CHILD_CWD });
  if (child.status !== 0) throw new Error(child.stderr);
  console.log(JSON.stringify({ parent: getCompileCacheDir() ?? "undefined", child: child.stdout.trim() }));
`;

test("test workers and CLI children share the same compile cache without nesting version directories", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "test-compile-cache-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const childDir = path.join(dir, "child");
  mkdirSync(childDir);
  const env = { ...process.env, TMPDIR: dir, TMP: dir, TEMP: dir, CACHE_PROBE_CHILD_CWD: childDir };
  delete env.NODE_COMPILE_CACHE;
  delete env.NODE_DISABLE_COMPILE_CACHE;
  for (const overrides of [
    {},
    { NODE_COMPILE_CACHE: path.join(dir, "explicit") },
    { NODE_COMPILE_CACHE: "relative" },
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", preload, "--input-type=module", "-e", probe],
      {
        cwd: dir,
        env: { ...env, ...overrides },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const { parent, child } = JSON.parse(result.stdout);
    assert.notEqual(parent, "undefined");
    assert.equal(child, parent);
  }
});

test("disabled or unavailable compile caching still executes the worker and its CLI child", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "test-compile-cache-unavailable-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "file");
  writeFileSync(file, "not a directory");
  for (const overrides of [
    { NODE_COMPILE_CACHE: path.join(dir, "cache"), NODE_DISABLE_COMPILE_CACHE: "1" },
    { NODE_COMPILE_CACHE: file },
  ]) {
    const env = { ...process.env };
    delete env.NODE_DISABLE_COMPILE_CACHE;
    const result = spawnSync(
      process.execPath,
      ["--import", preload, "--input-type=module", "-e", probe],
      {
        env: { ...env, ...overrides },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { parent: "undefined", child: "undefined" });
  }
});
