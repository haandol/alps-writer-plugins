// Guards the one version number users actually see against the manifests.
//
// The MCP server hardcodes its version in src/index.ts because importing
// ../package.json would escape tsconfig's rootDir: "src". That second literal
// has now drifted twice: once to 0.3.0 (fixed in 2353d14) and again to 0.4.20,
// when a release bumped the manifests but not the server. Both times the server
// advertised a stale version to every MCP client for multiple releases with a
// green test suite. These tests make that drift a build failure.
//
// The reference is the Claude Code plugin manifest, NOT package.json: both
// package.json files are private (never published) and are pinned to 0.0.0 on
// purpose, so the release version lives only in the manifests. `pnpm bump` keeps
// the five real sites in step; this file fails the build if they diverge.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here, "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");

function readJson(relativeToRepo: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativeToRepo), "utf8"));
}

// The release version's source of truth — mirrored by every other site.
const EXPECTED = readJson("plugins/adr-writer/.claude-plugin/plugin.json").version as string;

test("the reference version is a plain semver string", () => {
  assert.match(EXPECTED, /^\d+\.\d+\.\d+$/);
});

test("every plugin manifest declares the same version", () => {
  const manifests = [
    "plugins/adr-writer/.claude-plugin/plugin.json",
    "plugins/adr-writer/.codex-plugin/plugin.json",
    "plugins/alps-writer/.claude-plugin/plugin.json",
    "plugins/alps-writer/.codex-plugin/plugin.json",
    "plugins/ontology-writer/.claude-plugin/plugin.json",
    "plugins/ontology-writer/.codex-plugin/plugin.json",
  ];

  for (const manifest of manifests) {
    assert.equal(readJson(manifest).version, EXPECTED, `${manifest} version drifted`);
  }
});

test("the marketplace metadata and every plugin entry declare the same version", () => {
  const marketplace = readJson(".claude-plugin/marketplace.json");
  const metadata = marketplace.metadata as { version?: string };
  assert.equal(metadata.version, EXPECTED, "marketplace.json metadata.version drifted");

  const plugins = marketplace.plugins as Array<{ name: string; version?: string }>;
  assert.ok(plugins.length > 0, "marketplace.json lists no plugins");
  for (const plugin of plugins) {
    assert.equal(plugin.version, EXPECTED, `marketplace.json plugin "${plugin.name}" drifted`);
  }
});

// The regression that motivated this file: the literal passed to McpServer is
// what shows up in a client's initialize response, so it is the version users
// see. Assert against the source text rather than importing the module, so the
// test does not need to boot a server.
test("the MCP server advertises the reference version", () => {
  const source = fs.readFileSync(path.join(pluginRoot, "src", "index.ts"), "utf8");
  const declared = source.match(/name:\s*"alps-writer",\s*version:\s*"([^"]+)"/);

  assert.ok(declared, "could not find the McpServer version literal in src/index.ts");
  assert.equal(declared[1], EXPECTED, "src/index.ts McpServer version drifted");
});

// Both package.json files are deliberately NOT part of the release version.
// They are private, so their version reaches no consumer; pinning them to 0.0.0
// keeps the bump surface at five sites instead of seven. Assert the pin so a
// future contributor does not "resync" them and re-widen it.
test("the private package.json files stay pinned to 0.0.0", () => {
  for (const manifest of ["package.json", "plugins/alps-writer/package.json"]) {
    const pkg = readJson(manifest);
    assert.equal(pkg.private, true, `${manifest} must stay private for the 0.0.0 pin to be safe`);
    assert.equal(
      pkg.version,
      "0.0.0",
      `${manifest} is pinned to 0.0.0 by design — the release version lives in the plugin manifests (pnpm bump)`,
    );
    assert.ok(pkg["//version"], `${manifest} should keep the note explaining the pin`);
  }
});
