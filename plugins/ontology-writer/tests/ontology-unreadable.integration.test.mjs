import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLI, EXAMPLE } from "./ontology-helpers.mjs";

test(
  "an unreadable model directory is incomplete instead of being reported as no ontology",
  {
    skip: process.platform === "win32" || process.getuid?.() === 0,
  },
  () => {
    const root = mkdtempSync(path.join(tmpdir(), "ontology-unreadable-"));
    const hidden = path.join(root, "docs/ontology/private");
    try {
      mkdirSync(path.join(root, "docs/adr"), { recursive: true });
      mkdirSync(hidden, { recursive: true });
      writeFileSync(path.join(root, "docs/adr/.mapping.json"), JSON.stringify({ categories: {} }));
      writeFileSync(path.join(hidden, "model.ttl"), EXAMPLE);
      chmodSync(hidden, 0);
      for (const runtime of [process.execPath, "bun"]) {
        const result = spawnSync(
          runtime,
          [...(runtime === "bun" ? ["--no-install"] : []), CLI, "query", "--overview", "--json"],
          { cwd: root, encoding: "utf8" },
        );
        assert.equal(result.status, 1, result.stdout + result.stderr);
        const body = JSON.parse(result.stdout);
        assert.equal(body.found, null);
        assert.equal(body.complete, false);
        assert.ok(
          body.validationSample.some(
            (e) => e.code === "ontology-directory-unreadable" && e.where.includes("private"),
          ),
        );
        assert.doesNotMatch(body.note, /no ontology in/);
      }
    } finally {
      chmodSync(hidden, 0o700);
      rmSync(root, { recursive: true, force: true });
    }
  },
);
