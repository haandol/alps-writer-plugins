import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("pre-push fixture Git commands cannot change a linked worktree's commits, index or identity", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "pre-push-worktree-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Isolate test setup from its caller. The real nested push below exports
  // fresh Git selectors for its own linked worktree, exercising the hook.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  for (const key of execFileSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" })
    .trim()
    .split("\n")) {
    delete env[key];
  }
  const git = (cwd, args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
  const base = path.join(dir, "base");
  const work = path.join(dir, "work");
  const remote = path.join(dir, "remote.git");
  const fixture = path.join(dir, "fixture");
  const bin = path.join(dir, "bin");
  for (const target of [base, fixture, bin]) mkdirSync(target);
  git(base, ["init", "-q"]);
  git(base, ["config", "user.email", "outer@example.test"]);
  git(base, ["config", "user.name", "Outer"]);
  writeFileSync(path.join(base, "keep.txt"), "original\n");
  git(base, ["add", "."]);
  git(base, ["commit", "-qm", "base"]);
  git(base, ["worktree", "add", "-qb", "release", work]);
  git(base, ["init", "--bare", "-q", remote]);
  git(work, ["remote", "add", "origin", remote]);

  for (const target of [".test-hooks", "plugins/alps-writer/dist", "plugins/adr-writer/hooks"]) {
    mkdirSync(path.join(work, target), { recursive: true });
  }
  const hook = path.join(work, ".test-hooks/pre-push");
  writeFileSync(
    hook,
    "#!/bin/sh\nset -e\n" + readFileSync(path.join(ROOT, ".husky/pre-push"), "utf8"),
  );
  chmodSync(hook, 0o755);
  git(work, ["config", "core.hooksPath", path.dirname(hook)]);
  writeFileSync(
    path.join(work, "plugins/alps-writer/dist/index.js"),
    'console.log(JSON.stringify({result:{serverInfo:{name:"alps-writer"}}}));\n',
  );
  writeFileSync(path.join(work, "plugins/adr-writer/hooks/surface-adr-context.mjs"), "\n");
  git(work, ["add", "."]);
  git(work, ["commit", "-qm", "release"]);
  const head = git(work, ["rev-parse", "HEAD"]);

  const pnpm = path.join(bin, "pnpm");
  writeFileSync(
    pnpm,
    `#!/bin/sh
set -e
if [ "$1" = "test" ]; then
  git -C "$RELEASE_HOOK_FIXTURE" init -q
  git -C "$RELEASE_HOOK_FIXTURE" config user.email fixture@example.test
  git -C "$RELEASE_HOOK_FIXTURE" config user.name Fixture
  printf 'fixture\\n' > "$RELEASE_HOOK_FIXTURE/fixture.txt"
  git -C "$RELEASE_HOOK_FIXTURE" add .
  git -C "$RELEASE_HOOK_FIXTURE" commit -qm fixture
fi
`,
  );
  chmodSync(pnpm, 0o755);
  const result = spawnSync("git", ["push", "origin", "HEAD:refs/heads/release"], {
    cwd: work,
    env: { ...env, PATH: `${bin}${path.delimiter}${env.PATH}`, RELEASE_HOOK_FIXTURE: fixture },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(git(work, ["rev-parse", "HEAD"]), head);
  assert.equal(git(work, ["status", "--porcelain"]), "");
  assert.equal(git(base, ["config", "user.email"]), "outer@example.test");
  assert.equal(git(fixture, ["log", "-1", "--format=%s"]), "fixture");
  assert.equal(git(remote, ["rev-parse", "refs/heads/release"]), head);
});
