import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync } from "node:fs";
import path from "node:path";
import { cli, EXAMPLE } from "./ontology-helpers.mjs";
import { withTmp, write } from "./helpers.mjs";

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
      } finally {
        chmodSync(hidden, 0o700);
      }
    }),
);
