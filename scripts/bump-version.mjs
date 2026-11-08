#!/usr/bin/env bun
// bump-version.mjs — set the release version everywhere it is user-visible.
//
// Why a script: the version lives in five places that must agree, and bumping
// them by hand has already drifted twice (0.3.0 and 0.4.20 both shipped with the
// MCP server advertising a stale version while the manifests had moved on).
// tests/version-consistency.test.ts catches the drift, but only after the fact —
// this makes the correct bump a single command.
//
// NOT touched: the two package.json files. Both are `private: true` and never
// published, so their version has no consumer; they are pinned to 0.0.0 on
// purpose (see the "//version" note in each). Do not "fix" them to match.
//
// Usage:
//   bun scripts/bump-version.mjs 0.4.23     set an explicit version
//   bun scripts/bump-version.mjs patch      bump the patch component
//   bun scripts/bump-version.mjs minor|major
//   bun scripts/bump-version.mjs --check    verify every site agrees (exit 1 if not)
//
// A bump then runs `bun run build`, so the committed bundle carries the new serverInfo.
//
// Exit: 0 = done / in sync, 1 = drift found (--check) or the rebuild failed, 2 = usage error.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

// The release version's source of truth: the Claude Code plugin manifest. Every
// other site mirrors it.
const SOURCE = "plugins/adr-writer/.claude-plugin/plugin.json";

// Plain JSON manifests whose top-level "version" is the release version.
const MANIFESTS = [
  "plugins/adr-writer/.claude-plugin/plugin.json",
  "plugins/adr-writer/.codex-plugin/plugin.json",
  "plugins/alps-writer/.claude-plugin/plugin.json",
  "plugins/alps-writer/.codex-plugin/plugin.json",
  "plugins/ontology-writer/.claude-plugin/plugin.json",
  "plugins/ontology-writer/.codex-plugin/plugin.json",
];

// The marketplace catalog: metadata.version plus one version per plugin entry.
const MARKETPLACE = ".claude-plugin/marketplace.json";

// The MCP serverInfo literal — what a client sees in its initialize response.
// tsconfig's rootDir ("src") rules out importing ../package.json, so this is a
// literal that has to be rewritten in place.
const SERVER = "plugins/alps-writer/src/index.ts";
const SERVER_RE = /(name:\s*"alps-writer",\s*version:\s*")([^"]+)(")/;

// The rules-version stamp in each seeded ADR rule doc. adr-structure-lint compares
// a project's seeded copy against the installed plugin version to warn that rules
// added upstream are missing from that repo (rules-doc-stale). So the stamp has to
// move with the release: leave it behind and the plugin reports its OWN templates
// as stale on the next bump — the check would cry wolf on every consumer at once.
//
// This list must equal STAMPED_RULE_DOCS in
// plugins/adr-writer/scripts/adr-lint-lib.mjs (the seeded set plus the decision-log
// template). It is spelled out rather than imported because this script bumps the
// repo and must not depend on plugin internals; tests/stamped-docs.test.mjs asserts
// the two agree, so a doc added to one and not the other fails the build.
const RULE_DOCS = [
  "plugins/adr-writer/templates/adr/README.md",
  "plugins/adr-writer/templates/adr/concepts.md",
  "plugins/adr-writer/templates/adr/authoring-rules.md",
  "plugins/adr-writer/templates/adr/structure.md",
  "plugins/adr-writer/templates/adr/decision-log.template.md",
];
const STAMP_RE = /(<!--\s*adr-writer:rules-version\s+)(\d+\.\d+\.\d+)/;

const read = (rel) => readFileSync(path.join(REPO, rel), "utf8");
const write = (rel, text) => writeFileSync(path.join(REPO, rel), text);

function die(message, code = 2) {
  process.stderr.write(`bump-version: ${message}\n`);
  process.exit(code);
}

function currentVersion() {
  const version = JSON.parse(read(SOURCE)).version;
  if (!SEMVER.test(version ?? "")) die(`${SOURCE} has no plain semver version`);
  return version;
}

// Collect every site's declared version so --check and the final report share
// one view of the tree.
function collect() {
  const sites = [];
  for (const rel of MANIFESTS) sites.push([rel, JSON.parse(read(rel)).version]);

  const market = JSON.parse(read(MARKETPLACE));
  sites.push([`${MARKETPLACE} (metadata)`, market.metadata?.version]);
  for (const plugin of market.plugins ?? []) {
    sites.push([`${MARKETPLACE} (${plugin.name})`, plugin.version]);
  }

  sites.push([SERVER, read(SERVER).match(SERVER_RE)?.[2]]);
  for (const rel of RULE_DOCS) sites.push([rel, read(rel).match(STAMP_RE)?.[2]]);
  return sites;
}

function nextVersion(argument, current) {
  if (SEMVER.test(argument)) return argument;
  const [major, minor, patch] = current.split(".").map(Number);
  if (argument === "major") return `${major + 1}.0.0`;
  if (argument === "minor") return `${major}.${minor + 1}.0`;
  if (argument === "patch") return `${major}.${minor}.${patch + 1}`;
  die(`expected a semver like 1.2.3, or major|minor|patch, got "${argument}"`);
}

// Rewrite a top-level "version" without reserializing the file — keeps key order
// and formatting byte-identical so the diff shows only the version line.
function setJsonVersion(rel, version) {
  const text = read(rel);
  const patched = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  if (patched === text) die(`could not rewrite the version in ${rel}`);
  write(rel, patched);
}

function bump(version) {
  for (const rel of MANIFESTS) setJsonVersion(rel, version);

  // marketplace.json holds several versions, so replace each "version": "..."
  // occurrence — metadata plus one per plugin entry.
  const market = read(MARKETPLACE);
  write(MARKETPLACE, market.replace(/("version"\s*:\s*")[^"]+(")/g, `$1${version}$2`));

  const server = read(SERVER);
  if (!SERVER_RE.test(server)) die(`could not find the serverInfo version literal in ${SERVER}`);
  write(SERVER, server.replace(SERVER_RE, `$1${version}$3`));

  for (const rel of RULE_DOCS) {
    const text = read(rel);
    if (!STAMP_RE.test(text)) die(`could not find the rules-version stamp in ${rel}`);
    write(rel, text.replace(STAMP_RE, `$1${version}`));
  }
}

function main() {
  const argument = process.argv[2];
  if (!argument || process.argv.length !== 3) {
    die("usage: bump-version.mjs <semver|patch|minor|major|--check>");
  }

  if (argument === "--check") {
    const sites = collect();
    const expected = currentVersion();
    const drifted = sites.filter(([, version]) => version !== expected);
    for (const [rel, version] of sites) {
      process.stdout.write(`${version === expected ? "✓" : "✗"} ${rel} — ${version}\n`);
    }
    if (drifted.length) die(`${drifted.length} site(s) drifted from ${expected}`, 1);
    process.stdout.write(`\nAll ${sites.length} sites report ${expected}\n`);
    return;
  }

  const current = currentVersion();
  const version = nextVersion(argument, current);
  bump(version);

  for (const [rel, found] of collect()) {
    process.stdout.write(`  ${rel} — ${found}\n`);
  }
  process.stdout.write(
    `\n${current} → ${version}\nRebuilding dist/ with the new serverInfo: bun run build\n`,
  );
  // The committed bundle carries the serverInfo literal, so the bump rebuilds it instead of
  // leaving a step to remember.
  const build = spawnSync(process.execPath, ["run", "build"], { cwd: REPO, stdio: "inherit" });
  if (build.status !== 0)
    die(
      `bun run build ${build.error ? `could not start (${build.error.code})` : "failed"}; run it before committing the bump`,
      1,
    );
}

main();
