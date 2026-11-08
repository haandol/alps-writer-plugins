import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("every process a test starts gets the test's time zone and no on-the-fly installs", () => {
  const child = spawnSync(
    process.execPath,
    ["-p", "JSON.stringify([process.env.TZ, process.env.BUN_OPTIONS])"],
    { encoding: "utf8" },
  );
  const [tz, options] = JSON.parse(child.stdout);
  assert.equal(tz, process.env.TZ);
  assert.ok(tz);
  assert.match(options, /--no-install/);
});
