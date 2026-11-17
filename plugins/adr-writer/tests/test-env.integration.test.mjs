import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const preload = fileURLToPath(new URL("../../../scripts/test-env.mjs", import.meta.url));
// A test process that reports the configuration a git it starts reads.
const probe = `
  import { execFileSync } from "node:child_process";
  const get = (key) => execFileSync("git", ["config", "--get", key], { encoding: "utf8" }).trim();
  console.log(JSON.stringify({ maintenance: get("maintenance.auto"), gc: get("gc.auto"), extra: get("test.kept") }));
`;

test("no git a test starts runs automatic maintenance while a fixture is copied, and earlier settings stay", () => {
  const result = spawnSync(process.execPath, ["--preload", preload, "-e", probe], {
    env: { ...process.env, GIT_CONFIG_PARAMETERS: "'test.kept'='yes'" },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { maintenance: "false", gc: "0", extra: "yes" });
});
