import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const preload = fileURLToPath(new URL("../../../scripts/test-git.mjs", import.meta.url));
// A test process that reports its PATH, its first entry's git link, and the PATH of a process it starts.
const probe = `
  import { spawnSync } from "node:child_process";
  import { lstatSync, readlinkSync } from "node:fs";
  import path from "node:path";
  const git = path.join(process.env.PATH.split(path.delimiter)[0], "git");
  const link = (() => { try { return lstatSync(git).isSymbolicLink() ? readlinkSync(git) : null; } catch { return null; } })();
  const child = spawnSync(process.execPath, ["--preload", ${JSON.stringify(preload)}, "-p", "process.env.PATH"], { encoding: "utf8" });
  if (child.status !== 0) throw new Error(child.stderr);
  console.log(JSON.stringify({ own: process.env.PATH, link, child: child.stdout.trim() }));
`;

/** Start the probe as a test file starts: with the preload, in `dir`, under `PATH`. */
function run(dir, PATH, extra = {}) {
  const env = { ...process.env, TMPDIR: dir, PATH, ...extra };
  if (!("TEST_GIT_CHECKED" in extra)) delete env.TEST_GIT_CHECKED;
  const result = spawnSync(process.execPath, ["--preload", preload, "-e", probe], {
    cwd: dir,
    env,
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("a git that is not the macOS shim, or a process that already decided, keeps PATH as it is", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "test-git-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(path.join(bin, "git"), "#!/bin/sh\nexit 0\n");
  chmodSync(path.join(bin, "git"), 0o755);
  const own = `${bin}${path.delimiter}${process.env.PATH}`;
  assert.deepEqual(run(dir, own), { own, link: null, child: own });
  const system = ["/usr/bin", "/bin"].join(path.delimiter);
  assert.deepEqual(run(dir, system, { TEST_GIT_CHECKED: "1" }), {
    own: system,
    link: null,
    child: system,
  });
});

test("on macOS the shim gives way to a link to the git it runs, shared with the processes it starts and removed at exit", (t) => {
  if (process.platform !== "darwin" || !existsSync("/usr/bin/git"))
    return t.skip("only macOS has the /usr/bin/git shim");
  let real;
  try {
    real = execFileSync("xcrun", ["--find", "git"], { encoding: "utf8" }).trim();
  } catch {
    return t.skip("xcrun finds no developer tools git here");
  }
  const dir = mkdtempSync(path.join(tmpdir(), "test-git-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const system = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(path.delimiter);
  const { own, link, child } = run(dir, system);
  const [first, ...rest] = own.split(path.delimiter);
  assert.equal(rest.join(path.delimiter), system, "the rest of PATH is unchanged");
  assert.equal(
    path.dirname(first),
    path.resolve(dir),
    "the link lives in the process's temporary directory",
  );
  assert.equal(link, real, "the link is the binary xcrun names");
  assert.equal(child, own, "a process it starts inherits its PATH and adds nothing");
  assert.equal(existsSync(first), false, "the link's directory is removed when the process exits");
});
