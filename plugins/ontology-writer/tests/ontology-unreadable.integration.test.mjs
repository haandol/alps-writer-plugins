import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { cli, EXAMPLE } from "./ontology-helpers.mjs";
import { runHook, withTmp, write } from "./helpers.mjs";

test(
  "a broken model directory link is not a first-time setup",
  { skip: process.platform === "win32" },
  () =>
    withTmp((root) => {
      mkdirSync(path.join(root, "docs"));
      symlinkSync("missing", path.join(root, "docs/ontology"));
      assert.doesNotMatch(runHook(root), /\/ontology-build/);
      const result = cli(root, ["validate", "--json"]);
      assert.equal(result.code, 1);
      assert.ok(
        JSON.parse(result.out).findings.some((f) => f.code === "ontology-directory-unreadable"),
      );
      const aligned = cli(root, ["align", "--process", "payment", "--json"]);
      assert.equal(aligned.code, 1);
      const plan = JSON.parse(aligned.out);
      assert.ok(
        plan.errors.some(
          (f) => f.code === "ontology-directory-unreadable" && f.where === "docs/ontology",
        ),
      );
      assert.equal(plan.nextAction.command, "/ontology-sync payment");
    }),
);

test(
  "an unreadable model directory is incomplete instead of being reported as no ontology",
  {
    skip: process.platform === "win32" || process.getuid?.() === 0,
  },
  () =>
    withTmp((root) => {
      write(root, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
      const hidden = path.dirname(write(root, "docs/ontology/private/model.ttl", EXAMPLE));
      chmodSync(hidden, 0);
      try {
        const result = cli(root, ["query", "--overview", "--json"]);
        assert.equal(result.code, 1, result.out);
        const body = JSON.parse(result.out);
        assert.equal(body.found, null);
        assert.equal(body.complete, false);
        assert.ok(
          body.validationSample.some(
            (e) => e.code === "ontology-directory-unreadable" && e.where.includes("private"),
          ),
        );
        assert.doesNotMatch(body.note, /no ontology in/);
        assert.doesNotMatch(runHook(root), /\/ontology-build/);
      } finally {
        chmodSync(hidden, 0o700);
      }
    }),
);
