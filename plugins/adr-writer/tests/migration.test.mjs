// Tests for the adr-sync 3.7 stale-fN canonicalization procedure (B7).
// The skill is a prompt, so we can't execute it — but the git mv steps it
// prescribes ARE deterministic. These tests pin the two failure modes the
// procedure's pre-checks exist to prevent, proving the guidance is necessary
// and that the prescribed fix (mkdir -p parent, collision pre-check) works.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { cachedRepo, withTmp, write, initRepo, commitAll, git } from "./helpers.mjs";

function seedLegacyFn(dir) {
  cachedRepo(dir, "migration: legacy fN", (at) => {
    initRepo(at);
    write(
      at,
      "docs/adr/f1/0001-f1-email-signup.md",
      "# 0001. 이메일 가입\n\n## Status\nAccepted (2026-07-02)\n",
    );
    commitAll(at);
  });
}

function gitMv(dir, from, to) {
  try {
    git(dir, ["mv", from, to]);
    return { code: 0 };
  } catch (e) {
    return { code: e.status ?? -1, msg: (e.stderr || "") + (e.stdout || "") };
  }
}

test("B7-A: git mv to a 2-segment path FAILS when the parent context dir is absent", () => {
  withTmp((dir) => {
    seedLegacyFn(dir);
    // No docs/adr/identity yet — this is what the pre-check guards against.
    const r = gitMv(dir, "docs/adr/f1", "docs/adr/identity/login");
    assert.equal(r.code, 128, "bare git mv must fail without the parent dir");
    assert.match(r.msg, /No such file or directory/);
  });
});

test("B7-A fix: mkdir -p parent FIRST makes the 2-segment move succeed", () => {
  withTmp((dir) => {
    seedLegacyFn(dir);
    fs.mkdirSync(path.join(dir, "docs/adr/identity"), { recursive: true });
    const r = gitMv(dir, "docs/adr/f1", "docs/adr/identity/login");
    assert.equal(r.code, 0);
    assert.ok(
      fs.existsSync(path.join(dir, "docs/adr/identity/login/0001-f1-email-signup.md")),
      "file should land at the canonical 2-segment path",
    );
  });
});

test("B7-B: git mv into an EXISTING destination silently nests to 3 segments", () => {
  withTmp((dir) => {
    seedLegacyFn(dir);
    // destination already exists (a real tracked ADR lives there) → git mv
    // moves f1 INTO it instead of renaming. An empty dir wouldn't be tracked,
    // so seed a file to make the collision realistic.
    write(
      dir,
      "docs/adr/identity/login/0001-existing.md",
      "# existing\n\n## Status\nAccepted (2026-07-02)\n",
    );
    commitAll(dir, "add dest");
    const r = gitMv(dir, "docs/adr/f1", "docs/adr/identity/login");
    assert.equal(r.code, 0, "git mv does not error — it nests, silently");
    // The bug: a 3-segment path appears, violating "at most 2 segments".
    const nested = path.join(dir, "docs/adr/identity/login/f1/0001-f1-email-signup.md");
    assert.ok(
      fs.existsSync(nested),
      "reproduces the silent 3-segment nesting the collision pre-check prevents",
    );
  });
});

test("filename fN- prefix strip is a pure rename — NNNN is preserved (not a renumber)", () => {
  withTmp((dir) => {
    seedLegacyFn(dir);
    // case (1): strip the fN- prefix, keep the number
    git(dir, ["mv", "docs/adr/f1/0001-f1-email-signup.md", "docs/adr/f1/0001-email-signup.md"]);
    const listing = execFileSync("ls", [path.join(dir, "docs/adr/f1")], {
      encoding: "utf8",
    });
    assert.match(listing, /0001-email-signup\.md/);
    assert.doesNotMatch(listing, /0001-f1-/, "fN- prefix should be gone");
    // number unchanged → not a renumber, so the rollup-only renumber rule holds
    assert.match(listing, /^0001-/m);
  });
});
