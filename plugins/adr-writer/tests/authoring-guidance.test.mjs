import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { withTmp, write, PLUGIN_ROOT } from "./helpers.mjs";

const root = path.resolve(PLUGIN_ROOT, "../..");
const names = ["requirement-delegation.md", "comprehension-load.md"];

test("both authoring plugins carry the same locally resolvable guidance in separate version directories", () => {
  withTmp((dir) => {
    for (const [plugin, skill] of [
      ["alps-writer", "feature-to-adr"],
      ["adr-writer", "adr-new"],
    ]) {
      const installed = path.join(dir, "cache", plugin, "1.2.3");
      for (const relative of [`skills/${skill}/SKILL.md`, ...names.map((n) => `references/${n}`)]) {
        const target = path.join(installed, relative);
        mkdirSync(path.dirname(target), { recursive: true });
        cpSync(path.join(root, "plugins", plugin, relative), target);
      }
      const prompt = readFileSync(path.join(installed, `skills/${skill}/SKILL.md`), "utf8");
      for (const name of names) {
        const refs = [...prompt.matchAll(/`\$\{CLAUDE_PLUGIN_ROOT\}\/([^`]+)`/g)]
          .map((match) => match[1])
          .filter((relative) => relative.endsWith(name));
        assert.equal(refs.length, 1, `${plugin} has one discoverable reference to ${name}`);
        const target = path.resolve(installed, refs[0]);
        assert.ok(target.startsWith(installed + path.sep), "no sibling package layout assumption");
        assert.equal(
          readFileSync(target, "utf8"),
          readFileSync(path.join(PLUGIN_ROOT, "references", name), "utf8"),
        );
      }
    }
  });
});

test("authoring guidance synchronization repairs drift and its check never mutates the target", () => {
  withTmp((dir) => {
    write(
      dir,
      "scripts/sync-authoring-guidance.mjs",
      readFileSync(path.join(root, "scripts/sync-authoring-guidance.mjs")),
    );
    for (const name of names)
      write(
        dir,
        `plugins/adr-writer/references/${name}`,
        readFileSync(path.join(PLUGIN_ROOT, "references", name)),
      );
    const run = (...args) =>
      spawnSync(
        process.execPath,
        [path.join(dir, "scripts/sync-authoring-guidance.mjs"), ...args],
        { encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    assert.equal(run("--check").status, 0);
    const target = write(dir, "plugins/alps-writer/references/requirement-delegation.md", "stale");
    assert.equal(run("--check").status, 1);
    assert.equal(readFileSync(target, "utf8"), "stale");
    assert.equal(run().status, 0);
    assert.equal(run("--check").status, 0);
    assert.equal(
      run("--global").status,
      2,
      "this distribution helper never writes to a home directory",
    );
  });
});
