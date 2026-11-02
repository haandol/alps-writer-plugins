#!/usr/bin/env node
// publish-release.mjs — publish the GitHub release a main commit's version needs.
//
// The Release workflow runs this once CI has passed on a commit pushed to main. A
// version that already has its tag needs nothing, so a merge that does not raise the
// version ends here. A new version gets its tag on that exact commit and a published
// release: the title names the plugins the marketplace ships, and the notes are the
// `## Release notes` section of the pull request the commit merged, or GitHub's
// generated notes when there is no such section. A line naming the commit, its pull
// request and the CI run that passed on it follows.
//
// Usage:
//   node scripts/publish-release.mjs <commit-sha> [--repo OWNER/NAME] [--dry-run]
//
// Needs `gh` signed in (GH_TOKEN in the workflow). The repository defaults to
// GITHUB_REPOSITORY, and CI_RUN_URL names the CI run. --dry-run prints the decision
// and publishes nothing.
//
// Exit: 0 = published or nothing to publish, 1 = cannot publish, 2 = usage error.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The release version's source of truth, as scripts/bump-version.mjs reads it.
const SOURCE = "plugins/adr-writer/.claude-plugin/plugin.json";
const MARKETPLACE = ".claude-plugin/marketplace.json";

/**
 * The `## Release notes` section of a pull request body, without its heading, or null
 * when the body has none or it is empty. The section ends at the next heading of level
 * one or two; the agent attribution line that closes this repository's pull request
 * bodies is not part of it.
 */
export function releaseNotes(body) {
  const lines = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const start = lines.findIndex((line) => /^##\s+release notes\s*$/i.test(line.trim()));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
  const section = (end < 0 ? rest : rest.slice(0, end)).filter(
    (line) => !line.startsWith("🤖 Generated with"),
  );
  return section.join("\n").trim() || null;
}

/** The release title: "A v1.2.3", "A & B v1.2.3", "A, B & C v1.2.3" and so on. */
export function releaseTitle(names, version) {
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0];
  return `${list} v${version}`;
}

/**
 * Whether `sha` publishes `version`: not when the version's tag names another commit (the
 * version was released earlier and this merge did not raise it), nor when the tag names
 * this commit and its release exists. A tag on this commit without a release is published
 * on that tag.
 */
export function decide({ version, sha, tagCommit, released }) {
  const tag = `v${version}`;
  if (tagCommit && tagCommit !== sha)
    return {
      publish: false,
      why: `${tag} was released at ${tagCommit}; ${sha} raises no version.`,
    };
  if (tagCommit && released)
    return { publish: false, why: `${tag} is already published at ${sha}.` };
  return { publish: true, tag, tagged: Boolean(tagCommit) };
}

/** The line that ends the notes: which commit, pull request and CI run the release came from. */
export function provenance({ sha, pr, runUrl }) {
  const merged = pr ? `, merged in pull request #${pr},` : "";
  return `Published by the Release workflow on ${sha}${merged} after CI passed${runUrl ? ` (${runUrl})` : ""}.`;
}

function fail(message, code = 1) {
  process.stderr.write(`publish-release: ${message}\n`);
  process.exit(code);
}

/** `gh` output, or null for a 404 when `missing` allows one. */
function gh(args, { missing = false } = {}) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    if (missing && /HTTP 404/.test(String(error.stderr))) return null;
    fail(`gh ${args.join(" ")} failed: ${String(error.stderr || error.message).trim()}`);
  }
}
const api = (repo, route, options) => {
  const out = gh(["api", `repos/${repo}/${route}`], options);
  return out === null ? null : JSON.parse(out);
};

/** The commit a tag names, peeling an annotated tag, or null when there is no such tag. */
function tagCommit(repo, tag) {
  const ref = api(repo, `git/ref/tags/${tag}`, { missing: true });
  if (!ref) return null;
  if (ref.object.type !== "tag") return ref.object.sha;
  return api(repo, `git/tags/${ref.object.sha}`).object.sha;
}

/** Display names of the plugins the marketplace ships, in its order. */
function pluginNames() {
  const read = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
  return read(MARKETPLACE).plugins.map(
    (plugin) =>
      read(path.join(plugin.source, ".codex-plugin/plugin.json")).interface?.displayName ??
      plugin.name,
  );
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const repoAt = args.indexOf("--repo");
  const repo = repoAt >= 0 ? args[repoAt + 1] : process.env.GITHUB_REPOSITORY;
  const sha = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--repo");
  if (!sha || !/^[0-9a-f]{40}$/.test(sha) || !repo)
    fail("usage: publish-release.mjs <commit-sha> [--repo OWNER/NAME] [--dry-run]", 2);

  // Every version site must agree before a release names the version.
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts/bump-version.mjs"), "--check"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error) {
    fail(`the version sites disagree: ${String(error.stderr).trim()}`);
  }
  const version = JSON.parse(readFileSync(path.join(ROOT, SOURCE), "utf8")).version;
  const tag = `v${version}`;
  const tagged = tagCommit(repo, tag);
  const released = tagged === sha && api(repo, `releases/tags/${tag}`, { missing: true }) !== null;
  const decision = decide({ version, sha, tagCommit: tagged, released });
  if (!decision.publish) {
    process.stdout.write(`${decision.why} Nothing to publish.\n`);
    return;
  }

  const pull = (api(repo, `commits/${sha}/pulls`) ?? []).find((p) => p.merge_commit_sha === sha);
  const notes = releaseNotes(pull?.body);
  const title = releaseTitle(pluginNames(), version);
  const footer = provenance({ sha, pr: pull?.number, runUrl: process.env.CI_RUN_URL });
  const dir = mkdtempSync(path.join(tmpdir(), "release-notes-"));
  try {
    const file = path.join(dir, "notes.md");
    // GitHub's generated notes follow what --notes-file holds, so the footer leads them.
    writeFileSync(file, notes ? `${notes}\n\n${footer}\n` : `${footer}\n`);
    const create = [
      "release",
      "create",
      tag,
      "--repo",
      repo,
      "--title",
      title,
      ...(decision.tagged ? ["--verify-tag"] : ["--target", sha]),
      "--notes-file",
      file,
      ...(notes ? [] : ["--generate-notes"]),
    ];
    process.stdout.write(
      `${title}: ${notes ? `notes from #${pull.number}` : "generated notes"} on ${sha}\n`,
    );
    if (dryRun) {
      process.stdout.write(`dry run — would run: gh ${create.join(" ")}\n`);
      process.stdout.write(readFileSync(file, "utf8"));
      return;
    }
    gh(create);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // The release is published and its tag names the commit that passed CI.
  const release = api(repo, `releases/tags/${tag}`);
  if (release.draft || tagCommit(repo, tag) !== sha)
    fail(`${tag} was created but is a draft or names another commit; check ${release.html_url}`);
  process.stdout.write(`Published ${release.html_url}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
