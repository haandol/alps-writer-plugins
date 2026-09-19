import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases } from "../evals/regression/cases.mjs";
import { sourceProvenance, snapshotsFor } from "../evals/regression/provenance.mjs";
import { createWorkspace, makeTools } from "../evals/regression/workspace.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("plan discovery gets no corrective path hints and original first plans are graded", () => {
  const discovery = cases.filter((c) => c.id.endsWith("discover-plan"));
  assert.equal(discovery.length, 2);
  for (const item of discovery) {
    assert.equal(item.turns.length, 1);
    assert.doesNotMatch(item.turns[0], /000[1-9]|5턴|15크레딧/);
    assert.ok(item.obligations.some((o) => o.id === "plan"));
    assert.ok(item.obligations.some((o) => o.id === "no-change"));
  }
  for (const id of ["rollup-encbird-turn-chain", "rollup-pixelbank-price-renumber"]) {
    assert.match(
      cases.find((c) => c.id === id).obligations.find((o) => o.id === "plan").text,
      /첫 응답/,
    );
  }
  const rejected = cases.find((c) => c.id === "rollup-encbird-reject-wrong-plan");
  assert.equal(rejected.turns.length, 2);
  assert.ok(rejected.turns.every((t) => !/\d{4}-/.test(t)));
  assert.match(rejected.turns[1], /승인하지 않아/);
});

test("every source resolves to a pinned commit and retained excerpt without the source repo", () => {
  assert.equal(sourceProvenance.snapshots.length, 12);
  for (const item of cases) {
    assert.equal(item.provenance.length, item.sources.length);
    for (const source of item.provenance) {
      assert.match(source.commit, /^[a-f0-9]{40}$/);
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
      assert.ok(source.excerpts.length);
      assert.ok(source.excerpts.every((e) => e.start > 0 && e.end >= e.start && e.text.trim()));
    }
  }
  assert.throws(() => snapshotsFor(["unknown/docs/adr/example.md"]), /Missing pinned/);
});

test("fixture tests reject compensation, metadata and tier-boundary regressions", () => {
  const mutations = [
    ["sync-pixelbank-compensation-cleanup", "compensationRecords.has(key)", "false"],
    ["sync-pixelbank-retention-local", "sizeKB < 128", "sizeKB < 129"],
    ["sync-pixelbank-retention-local", "inactiveDays < 30", "inactiveDays < 31"],
    ["sync-pixelbank-retention-local", "inactiveDays < 90", "inactiveDays < 91"],
    [
      "sync-pixelbank-retention-local",
      "!item || expired(item,day) ? null : item",
      "!item ? null : item",
    ],
    [
      "sync-pixelbank-retention-local",
      "optionalArchiveTiers = false",
      "optionalArchiveTiers = true",
    ],
  ];
  const temp = mkdtempSync(path.join(tmpdir(), "golden-mutations-"));
  try {
    for (const [index, [id, from, to]] of mutations.entries()) {
      const root = path.join(temp, String(index));
      createWorkspace(root, cases.find((c) => c.id === id).build(), PLUGIN);
      const file = path.join(root, "src/policy.mjs");
      const content = readFileSync(file, "utf8");
      assert.ok(content.includes(from), from);
      writeFileSync(file, content.replace(from, to));
      const tools = makeTools({
        root,
        pluginRoot: PLUGIN,
        logPath: path.join(temp, `${index}.jsonl`),
        turn: 0,
      });
      const result = tools.call("run_check", { kind: "policy-tests" });
      assert.notEqual(result.exitCode, 0, `${id}: ${from} must be caught`);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
