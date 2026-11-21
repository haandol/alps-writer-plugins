import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { reviewChanges } from "../scripts/review-changes.mjs";
import { commitAll, git, initRepo, withTmp, write, PLUGIN_ROOT } from "./helpers.mjs";

test("a commit between the tree diff and git status cannot yield unchanged evidence", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "feature.md", "first");
    commitAll(dir);
    const base = git(dir, ["rev-parse", "HEAD"]).trim();
    // Run a normal commit at the boundary between the two reads, deterministically.
    const shim = write(
      dir,
      "bin/git",
      `#!/bin/sh
export PATH="$REVIEW_TEST_PATH"
for arg do
  if [ "$arg" = status ]; then
    echo second > feature.md
    git add feature.md && git commit -qm second || exit 2
    break
  fi
done
exec git "$@"
`,
    );
    chmodSync(shim, 0o755);
    let output;
    try {
      output = execFileSync(
        process.execPath,
        [path.join(PLUGIN_ROOT, "scripts/review-changes.mjs"), base, "feature.md"],
        {
          cwd: dir,
          encoding: "utf8",
          env: {
            ...process.env,
            REVIEW_TEST_PATH: process.env.PATH,
            PATH: path.dirname(shim) + path.delimiter + process.env.PATH,
          },
        },
      );
    } catch (err) {
      assert.equal(err.status, 1);
      output = err.stdout;
    }
    assert.notEqual(git(dir, ["rev-parse", "HEAD"]).trim(), base);
    assert.equal(JSON.parse(output).status, "unverified");
    assert.equal(reviewChanges(base, ["feature.md"], dir).status, "changed");
  });
});

test("review scope compares commits and pending inputs while excluding unrelated work", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "feature/a.txt", "old");
    write(dir, "other/b.txt", "old");
    commitAll(dir);
    const base = git(dir, ["rev-parse", "HEAD"]).trim();
    const check = (...paths) => reviewChanges(base, paths, dir);
    write(dir, "other/b.txt", "unrelated");
    commitAll(dir, "unrelated change");
    assert.equal(check("feature").status, "unchanged");
    git(dir, ["mv", "feature/a.txt", "feature/renamed.txt"]);
    commitAll(dir, "rename");
    write(dir, "feature/current.txt", "new file");
    write(dir, "feature/renamed.txt", "pending");
    assert.deepEqual(check("feature").paths, [
      "feature/a.txt",
      "feature/current.txt",
      "feature/renamed.txt",
    ]);
    const head = git(dir, ["rev-parse", "HEAD"]).trim();
    git(dir, ["add", "feature/renamed.txt"]);
    write(dir, "feature/renamed.txt", "old");
    assert.equal(
      reviewChanges(head, ["feature/renamed.txt"], dir).status,
      "changed",
      "index-only difference remains visible",
    );
    assert.equal(check("does-not-exist").status, "unverified");
    assert.equal(check("feature", "does-not-exist").status, "unverified");
    assert.equal(reviewChanges("0".repeat(40), ["feature"], dir).status, "unverified");
    assert.equal(reviewChanges(head, ["other/b.txt"], dir).status, "unchanged");
    git(dir, ["update-index", "--assume-unchanged", "other/b.txt"]);
    assert.equal(reviewChanges(head, ["other/b.txt"], dir).status, "unverified");
  });
});
