import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { BOARD } from "./eventstorming-fixture.mjs";
const cli = fileURLToPath(new URL("../scripts/eventstorming-view.mjs", import.meta.url));
test("a candidate board opens without model documents, preserves inputs and refuses overwrite or invalid evidence", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "eventstorming-candidate-"));
  try {
    const input = path.join(dir, "board.json"),
      out = path.join(dir, "board.html");
    const text = JSON.stringify(BOARD);
    writeFileSync(input, text);
    const result = execFileSync(
      process.execPath,
      [cli, input, "--out", out, "--no-open", "--lang", "ko"],
      { cwd: dir, encoding: "utf8" },
    );
    assert.match(result, /NOT_OPENED/);
    assert.ok(readFileSync(out, "utf8").includes("Waiting for payment"));
    assert.equal(readFileSync(input, "utf8"), text);
    assert.deepEqual(readdirSync(dir).sort(), ["board.html", "board.json"]);
    assert.throws(() =>
      execFileSync(process.execPath, [cli, input, "--out", out, "--no-open"], {
        cwd: dir,
        stdio: "pipe",
      }),
    );
    const bad = structuredClone(BOARD);
    bad.links[0].to = "missing";
    writeFileSync(input, JSON.stringify(bad));
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [cli, input, "--out", path.join(dir, "bad.html"), "--no-open"],
        { cwd: dir, stdio: "pipe" },
      ),
    );
    assert.deepEqual(readdirSync(dir).sort(), ["board.html", "board.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
