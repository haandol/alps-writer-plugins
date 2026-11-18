import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  CLI,
  MAPPING,
  SETTLED,
  UNLINKED,
  cli,
  draft,
  impact,
  read,
  repo,
} from "./ontology-apply-helpers.mjs";

const preload = fileURLToPath(new URL("./fixtures/concurrent-save.mjs", import.meta.url));
const modelPath = "docs/ontology/model.ttl";
const mappingPath = "docs/adr/.mapping.json";
const paymentPath = "docs/adr/payments/0001-b.md";
const marker = "\n# Editor's newer note.\n";

test("a new ADR in a feature's folder during staging leaves the proposed realization link unapplied", () =>
  withTmp((dir) => {
    repo(dir, ACCEPTED, UNLINKED);
    draft(dir);
    write(dir, "next-index.json", JSON.stringify(MAPPING));
    const options = ["--mapping", "next-index.json"];
    const before = read(dir, mappingPath);
    const { baseHash } = impact(dir, options);
    const saved = spawnSync(
      process.execPath,
      ["--preload", preload, CLI, "apply", "--draft", "draft", "--base-hash", baseHash, ...options],
      { cwd: dir, encoding: "utf8", env: { ...process.env, TEST_EDIT_AT: "stage-realizer" } },
    );
    assert.equal(saved.status, 1, saved.stdout + saved.stderr);
    assert.match(saved.stdout, /changed after the approval summary; rerun impact/);
    assert.equal(read(dir, mappingPath), before);
    assert.equal(read(dir, modelPath), ACCEPTED);
    assert.match(read(dir, "docs/adr/payments/0002-retry.md"), /Proposed/);
    assert.equal(cli(dir, ["validate"]).code, 0);
    const refreshed = cli(dir, ["impact", "--draft", "draft", ...options]);
    assert.equal(refreshed.code, 1, refreshed.out);
    assert.match(refreshed.out, /ontology-adr-unindexed.*0002-retry\.md/);
  }));

for (const [when, behavior] of [
  ["stage-model", "a model edit during staging cancels the approval"],
  ["stage-adr", "an affected ADR edit during staging cancels the approval"],
  ["after-index", "a model edit after the index write survives the aborted unit"],
  ["rollback", "rollback keeps a newer edit to an already published model and restores the index"],
]) {
  test(behavior, () =>
    withTmp((dir) => {
      repo(dir);
      draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
      const originalIndex = read(dir, mappingPath);
      const originalAdr = read(dir, paymentPath);
      write(dir, "mapping.next.json", originalIndex + "\n");
      const options = ["--mapping", "mapping.next.json"];
      const { baseHash } = impact(dir, options);
      const saved = spawnSync(
        process.execPath,
        [
          "--preload",
          preload,
          CLI,
          "apply",
          "--draft",
          "draft",
          "--base-hash",
          baseHash,
          ...options,
          "--log",
          "payment.payment-completed: collected and settled",
        ],
        { cwd: dir, encoding: "utf8", env: { ...process.env, TEST_EDIT_AT: when } },
      );
      assert.equal(saved.status, 1, saved.stdout + saved.stderr);
      assert.equal(read(dir, mappingPath), originalIndex);
      assert.equal(read(dir, paymentPath), originalAdr + (when === "stage-adr" ? marker : ""));
      assert.equal(existsSync(path.join(dir, "docs/ontology/change-log.md")), false);
      if (when === "rollback") {
        assert.match(saved.stdout, /newer edits were preserved in .*model\.ttl/);
        assert.ok(read(dir, modelPath).includes(SETTLED));
        assert.ok(read(dir, modelPath).endsWith(marker));
      } else {
        assert.match(saved.stdout, /changed.*rerun impact/);
        assert.equal(read(dir, modelPath), ACCEPTED + (when === "stage-adr" ? "" : marker));
      }
    }),
  );
}

for (const mode of ["move-head", "move-extra", "delete-extra"]) {
  test(`a direct edit keeps its working tree when its primary or additional revision changes during staging (${mode})`, () =>
    withTmp((dir) => {
      repo(dir);
      git(dir, ["branch", "comparison", "HEAD"]);
      git(dir, ["commit", "--allow-empty", "-qm", "later commit with the same model"]);
      write(dir, modelPath, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
      for (const id of ["ordering.place-order", "payment.take-payment"]) {
        const marked = cli(dir, ["transition", "--process", id, "--to", "Proposed"]);
        assert.equal(marked.code, 0, marked.out);
      }
      const model = read(dir, modelPath);
      const options = ["--base", "HEAD", "--also-base", "comparison"];
      const preview = cli(dir, ["impact", ...options, "--json"]);
      assert.equal(preview.code, 0, preview.out);
      const { baseHash } = JSON.parse(preview.out);
      const saved = spawnSync(
        process.execPath,
        [
          "--preload",
          preload,
          CLI,
          "apply",
          ...options,
          "--base-hash",
          baseHash,
          "--log",
          "payment.payment-completed: collected and settled",
        ],
        { cwd: dir, encoding: "utf8", env: { ...process.env, TEST_EDIT_AT: mode } },
      );
      assert.equal(saved.status, 1, saved.stdout + saved.stderr);
      assert.match(saved.stdout, /changed after the approval summary; rerun impact/);
      assert.equal(existsSync(path.join(dir, "docs/ontology/change-log.md")), false);
      assert.equal(read(dir, modelPath), model);
    }));
}
