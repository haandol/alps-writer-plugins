import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { openerCommand, openReviewReport } from "../scripts/adr-impl-review-open.mjs";

function withReport(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-open-"));
  const report = path.join(dir, "adr-impl-review-report.html");
  try {
    writeFileSync(report, "<!doctype html><title>Review</title>");
    run(report);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the opener uses the host default browser command", () => {
  assert.deepEqual(openerCommand("/tmp/report.html", "darwin"), {
    command: "open",
    args: ["/tmp/report.html"],
  });
  assert.deepEqual(openerCommand("C:\\report.html", "win32"), {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", "start", "", "C:\\report.html"],
  });
  assert.deepEqual(openerCommand("/tmp/report.html", "linux"), {
    command: "xdg-open",
    args: ["/tmp/report.html"],
  });
  assert.equal(openerCommand("/tmp/report.html", "aix"), null);
});

test("a valid report is opened exactly once", () => {
  withReport((report) => {
    const calls = [];
    const result = openReviewReport(report, {
      platform: "darwin",
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0 };
      },
    });

    assert.equal(result.opened, true);
    assert.equal(result.validArtifact, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "open");
    assert.deepEqual(calls[0].args, [path.resolve(report)]);
  });
});

test("an unavailable or failed opener preserves the validated report path", () => {
  withReport((report) => {
    const unavailable = openReviewReport(report, { platform: "aix" });
    assert.equal(unavailable.opened, false);
    assert.equal(unavailable.validArtifact, true);
    assert.equal(unavailable.path, path.resolve(report));
    assert.match(unavailable.reason, /no default opener/);

    const failed = openReviewReport(report, {
      platform: "linux",
      spawn() {
        return { status: 3 };
      },
    });
    assert.equal(failed.opened, false);
    assert.equal(failed.validArtifact, true);
    assert.match(failed.reason, /status 3/);
  });
});

test("a missing report fails before any opener runs", () => {
  let called = false;
  const result = openReviewReport("/tmp/adr-review-report-that-does-not-exist.html", {
    platform: "darwin",
    spawn() {
      called = true;
      return { status: 0 };
    },
  });

  assert.equal(result.opened, false);
  assert.equal(result.validArtifact, false);
  assert.equal(called, false);
});

test("an empty report fails before any opener runs", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-open-empty-"));
  const report = path.join(dir, "adr-impl-review-report.html");
  writeFileSync(report, "");
  let called = false;
  try {
    const result = openReviewReport(report, {
      platform: "darwin",
      spawn() {
        called = true;
        return { status: 0 };
      },
    });

    assert.equal(result.opened, false);
    assert.equal(result.validArtifact, false);
    assert.match(result.reason, /missing or empty/);
    assert.equal(called, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
