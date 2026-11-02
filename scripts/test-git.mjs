// Run the tests' git directly instead of through the macOS shim. /usr/bin/git looks the
// developer tools up through xcrun before every run, which makes each of the thousands
// of git processes the tests start several times slower. When the first git on PATH is
// that shim, a private directory holding only a link to the binary it finds goes first
// on PATH, and the CLI processes a test starts inherit it. It is the same git, so no
// result changes; anywhere else nothing changes at all.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SHIM = "/usr/bin/git";
const CHECKED = "TEST_GIT_CHECKED";

/** The first `name` on PATH, as the shell would find it, or null. */
function firstOnPath(name) {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    try {
      if (statSync(path.join(dir, name)).isFile()) return path.join(dir, name);
    } catch {
      // not in this directory
    }
  }
  return null;
}

// Each test file's process decides once (the runner itself loads no preload); the
// processes it starts inherit the decision with the environment.
if (process.platform === "darwin" && !process.env[CHECKED]) {
  process.env[CHECKED] = "1";
  if (firstOnPath("git") === SHIM) {
    let real = "";
    try {
      real = execFileSync("xcrun", ["--find", "git"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      // no developer tools to find: keep the shim
    }
    if (path.isAbsolute(real) && real !== SHIM) {
      const dir = mkdtempSync(path.join(tmpdir(), "test-git-"));
      symlinkSync(real, path.join(dir, "git"));
      process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
      process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
    }
  }
}
