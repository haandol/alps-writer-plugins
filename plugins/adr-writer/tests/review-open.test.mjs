import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
  assert.deepEqual(openerCommand("file:///tmp/report.html?v=1", "darwin"), {
    command: "open",
    args: ["file:///tmp/report.html?v=1"],
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

test("a named browser replaces the default opener on every platform", () => {
  assert.deepEqual(openerCommand("file:///tmp/report.html", "darwin", "Firefox"), {
    command: "open",
    args: ["-a", "Firefox", "file:///tmp/report.html"],
  });
  assert.deepEqual(openerCommand("C:\\report.html", "win32", "firefox"), {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", "start", "", "firefox", "C:\\report.html"],
  });
  assert.deepEqual(openerCommand("/tmp/report.html", "linux", "firefox"), {
    command: "firefox",
    args: ["/tmp/report.html"],
  });
  withReport((report) => {
    const calls = [];
    const result = openReviewReport(report, {
      platform: "linux",
      browser: "firefox",
      spawn(command, args) {
        calls.push({ command, args });
        return { status: 0 };
      },
    });
    assert.equal(result.opened, true);
    assert.equal(calls.length, 1, "still exactly one open attempt");
    assert.equal(calls[0].command, "firefox");
  });
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
    assert.equal(calls[0].args.length, 1);
    assert.match(calls[0].args[0], /^file:.*adr-impl-review-report\.html\?v=\d+-\d+$/);
  });
});

test("rewriting the same report path changes the browser URL fingerprint", () => {
  withReport((report) => {
    const targets = [];
    const spawn = (_command, args) => {
      targets.push(args[0]);
      return { status: 0 };
    };

    openReviewReport(report, { platform: "darwin", spawn });
    writeFileSync(report, "<!doctype html><title>Updated review</title>");
    openReviewReport(report, { platform: "darwin", spawn });

    assert.equal(targets.length, 2);
    assert.notEqual(targets[0], targets[1]);
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

test("a failed opener's own message is reported with its exit status after one attempt", () => {
  withReport((report) => {
    // A private temporary directory shows whether the captured output is cleaned up.
    const temp = path.join(path.dirname(report), "tmp");
    mkdirSync(temp);
    const names = ["TMPDIR", "TMP", "TEMP"];
    const saved = names.map((name) => [name, process.env[name]]);
    for (const name of names) process.env[name] = temp;
    let calls = 0;
    let result;
    try {
      result = openReviewReport(report, {
        platform: "darwin",
        browser: "NoSuchBrowser",
        // A real process writes to whatever error output the opener provides.
        spawn(_command, _args, options) {
          calls++;
          return spawnSync(
            process.execPath,
            [
              "-e",
              "process.stderr.write(\"LSOpenURLsWithRole() failed\\nUnable to find application named 'NoSuchBrowser'\\n\"); process.exit(1)",
            ],
            options,
          );
        },
      });
    } finally {
      for (const [name, value] of saved)
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
    assert.equal(calls, 1, "still exactly one open attempt");
    assert.equal(result.opened, false);
    assert.equal(result.validArtifact, true);
    assert.equal(
      result.reason,
      "open exited with status 1: Unable to find application named 'NoSuchBrowser'",
    );
    assert.deepEqual(readdirSync(temp), [], "the captured output leaves no file behind");
  });
});

test(
  "a browser the opener leaves running does not hold the open attempt",
  {
    skip: process.platform === "win32" && "detached POSIX process groups only",
  },
  () => {
    withReport((report) => {
      const pidFile = path.join(path.dirname(report), "browser.pid");
      let pid = 0;
      try {
        const result = openReviewReport(report, {
          platform: "linux",
          // The opener starts a long-running browser that inherits its output and exits.
          spawn: (_command, _args, options) =>
            spawnSync(
              process.execPath,
              [
                "-e",
                `const browser = require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], { detached: true, stdio: "inherit" });
require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(browser.pid));
browser.unref();`,
              ],
              options,
            ),
        });
        pid = Number(readFileSync(pidFile, "utf8"));
        assert.equal(result.opened, true);
        assert.doesNotThrow(
          () => process.kill(pid, 0),
          "the attempt returned while the browser still runs",
        );
      } finally {
        try {
          if (pid) process.kill(pid);
        } catch {
          // already gone
        }
      }
    });
  },
);

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
