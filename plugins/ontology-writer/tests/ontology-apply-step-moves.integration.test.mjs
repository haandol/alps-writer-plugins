import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  CLI,
  PREFIXES,
  cli,
  draft,
  impact,
  read,
  repo,
} from "./ontology-apply-helpers.mjs";

const observer = fileURLToPath(new URL("./fixtures/observe-step-moves.mjs", import.meta.url));
for (const withIndexDraft of [false, true]) {
  test(`moving linked steps between documents keeps every intermediate link valid (index draft: ${withIndexDraft})`, () =>
    withTmp((dir) => {
      repo(dir);
      const blocks = ACCEPTED.split("\n\n");
      const payment = blocks.find((s) => s.startsWith("m:payment.request-payment a onto:Step"));
      const order = blocks.find((s) => s.startsWith("m:ordering.submit-order a onto:Step"));
      const unchanged = blocks.filter((b) => b !== order && b !== payment).join("\n\n");
      write(dir, "docs/ontology/model.ttl", unchanged + "\n" + payment + "\n");
      write(dir, "docs/ontology/z.ttl", PREFIXES + order + "\n");
      commitAll(dir, "split the model");
      draft(dir, unchanged + "\n" + order + "\n");
      write(dir, "draft/z.ttl", PREFIXES + payment + "\n");
      const options = withIndexDraft ? ["--mapping", "draft-index.json"] : [];
      const originalIndex = read(dir, "docs/adr/.mapping.json");
      if (withIndexDraft) write(dir, "draft-index.json", originalIndex + "\n");
      const hash = impact(dir, options).baseHash;
      const args = [
        "--preload",
        observer,
        CLI,
        "apply",
        "--draft",
        "draft",
        "--base-hash",
        hash,
        ...options,
      ];
      const failed = spawnSync(process.execPath, args, {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, FAIL_MODEL_RENAME: "2" },
      });
      assert.equal(failed.status, 1, failed.stdout + failed.stderr);
      assert.match(failed.stdout, /EIO/);
      assert.equal(git(dir, ["diff", "--", "docs"]), "");

      const saved = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8" });
      assert.equal(saved.status, 0, saved.stdout + saved.stderr);
      const snapshots = read(dir, "observations.jsonl").trim().split("\n").map(JSON.parse);
      assert.ok(snapshots.length >= 2);
      assert.ok(
        snapshots.every((missing) => missing.length === 0),
        JSON.stringify(snapshots),
      );
      assert.equal(
        read(dir, "docs/adr/.mapping.json"),
        originalIndex + (withIndexDraft ? "\n" : ""),
      );
      assert.doesNotMatch(
        read(dir, "docs/ontology/model.ttl"),
        /m:payment\.request-payment a onto:Step/,
      );
      assert.doesNotMatch(read(dir, "docs/ontology/z.ttl"), /m:ordering\.submit-order a onto:Step/);
      assert.equal(cli(dir, ["validate"]).code, 0);
    }));
}
