#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Select the host command that opens a local HTML report in the default browser,
 * or in the named browser when the user asked for one. Centralizing platform
 * selection gives every review mode the same single open attempt.
 */
export function openerCommand(reportPath, platform = process.platform, browser = null) {
  if (platform === "darwin")
    return { command: "open", args: browser ? ["-a", browser, reportPath] : [reportPath] };
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "start", "", ...(browser ? [browser] : []), reportPath],
    };
  }
  if (platform === "linux" || platform === "freebsd") {
    return browser
      ? { command: browser, args: [reportPath] }
      : { command: "xdg-open", args: [reportPath] };
  }
  return null;
}

/**
 * Validate the HTML artifact before attempting one local browser open.
 * Invalid reports fail the review, while unavailable openers preserve the verified artifact.
 */
export function openReviewReport(
  reportPath,
  { platform = process.platform, spawn = spawnSync, browser = null } = {},
) {
  const absolutePath = path.resolve(reportPath);
  let stat;
  try {
    stat = statSync(absolutePath);
    if (!stat.isFile() || stat.size === 0) {
      return {
        opened: false,
        validArtifact: false,
        path: absolutePath,
        reason: "the report is missing or empty",
      };
    }
  } catch (error) {
    return {
      opened: false,
      validArtifact: false,
      path: absolutePath,
      reason: error.message,
    };
  }

  const reportUrl = pathToFileURL(absolutePath);
  reportUrl.searchParams.set("v", `${stat.size}-${Math.trunc(stat.mtimeMs)}`);
  const opener = openerCommand(reportUrl.href, platform, browser);
  if (!opener) {
    return {
      opened: false,
      validArtifact: true,
      path: absolutePath,
      reason: `no default opener is configured for platform ${platform}`,
    };
  }

  const { result, message } = runOpener(spawn, opener);
  if (result.error) {
    return {
      opened: false,
      validArtifact: true,
      path: absolutePath,
      reason: result.error.message,
    };
  }
  if (result.status !== 0) {
    return {
      opened: false,
      validArtifact: true,
      path: absolutePath,
      reason: `${opener.command} exited with status ${result.status}${message ? `: ${message}` : ""}`,
    };
  }

  return { opened: true, validArtifact: true, path: absolutePath, reason: "" };
}

/**
 * Run the opener once and keep the last line of its error output. The output
 * goes to a temporary file, not a pipe: a browser the opener starts inherits
 * the stream and would hold a pipe open until the browser exits.
 */
function runOpener(spawn, opener) {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-open-"));
  const file = path.join(dir, "stderr.txt");
  const fd = openSync(file, "w");
  try {
    const result = spawn(opener.command, opener.args, { stdio: ["ignore", "ignore", fd] });
    const lines = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return { result, message: (lines.at(-1) ?? "").slice(0, 300) };
  } finally {
    closeSync(fd);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // A browser still running may hold the file open on Windows; the OS temp directory keeps it.
    }
  }
}

function usage(message) {
  if (message) process.stderr.write(`adr-impl-review-open: ${message}\n`);
  process.stderr.write("Usage: node adr-impl-review-open.mjs <report.html>\n");
  process.exitCode = 2;
}

/**
 * Attempt one browser open and print the path plus its observable result.
 * A missing or empty report fails before any host command can run.
 */
function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    usage("report path is required");
    return;
  }

  const result = openReviewReport(reportPath);
  if (result.opened) {
    process.stdout.write(`OPENED ${result.path}\n`);
    return;
  }

  process.stdout.write(`NOT_OPENED ${result.path} — ${result.reason}\n`);
  if (!result.validArtifact) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main();
