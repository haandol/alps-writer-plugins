#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Select the host command that opens a local HTML report in the default browser.
 * Centralizing platform selection gives every review mode the same single open attempt.
 */
export function openerCommand(reportPath, platform = process.platform) {
  if (platform === "darwin") return { command: "open", args: [reportPath] };
  if (platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "start", "", reportPath] };
  }
  if (platform === "linux" || platform === "freebsd") {
    return { command: "xdg-open", args: [reportPath] };
  }
  return null;
}

/**
 * Validate the HTML artifact before attempting one local browser open.
 * Invalid reports fail the review, while unavailable openers preserve the verified artifact.
 */
export function openReviewReport(
  reportPath,
  { platform = process.platform, spawn = spawnSync } = {},
) {
  const absolutePath = path.resolve(reportPath);
  try {
    const stat = statSync(absolutePath);
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

  const opener = openerCommand(absolutePath, platform);
  if (!opener) {
    return {
      opened: false,
      validArtifact: true,
      path: absolutePath,
      reason: `no default opener is configured for platform ${platform}`,
    };
  }

  const result = spawn(opener.command, opener.args, { stdio: "ignore" });
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
      reason: `${opener.command} exited with status ${result.status}`,
    };
  }

  return { opened: true, validArtifact: true, path: absolutePath, reason: "" };
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
