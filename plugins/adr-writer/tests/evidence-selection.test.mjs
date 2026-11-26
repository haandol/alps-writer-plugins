import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  carriedChanges,
  changedProbes,
  knownCaseIds,
} from "../evals/skills/evidence-selection.mjs";
import { catalog } from "../evals/skills/catalog.mjs";

const EVALS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../evals");

test("a case is known only when its whole ID is a string literal at the base", () => {
  const known = knownCaseIds(
    [{ id: "routing-sync" }, { id: "routing-syn" }, { id: "report-drilldown-overview" }],
    "HEAD",
  );
  assert.equal(known.has("routing-sync"), true);
  assert.equal(known.has("routing-syn"), false, "a prefix of an existing ID is still new");
  assert.equal(
    known.has("report-drilldown-overview"),
    false,
    "an ID that only prefixes longer IDs is new",
  );
});

test("a prompt carries a change when it embeds a changed line or names the changed file", () => {
  const probes = [
    {
      file: "plugins/adr-writer/references/implementation-evidence.md",
      lines: ["A passing test only shows that no counterexample was found."],
      mention: "references/implementation-evidence.md",
    },
    {
      file: "plugins/adr-writer/references/unrelated.md",
      lines: ["This sentence appears in no prompt at all, anywhere."],
      mention: "references/unrelated.md",
    },
  ];
  assert.deepEqual(
    carriedChanges("…A passing test only shows that no counterexample was found.…", probes),
    ["plugins/adr-writer/references/implementation-evidence.md"],
  );
  assert.deepEqual(
    carriedChanges("Read ${CLAUDE_PLUGIN_ROOT}/references/implementation-evidence.md", probes),
    ["plugins/adr-writer/references/implementation-evidence.md"],
  );
  assert.deepEqual(carriedChanges("Nothing relevant here.", probes), []);
});

test("every catalog case ID is a whole string literal, so new-case detection is exact", async () => {
  const sources = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".mjs")) sources.push(readFileSync(full, "utf8"));
    }
  };
  walk(EVALS);
  const text = sources.join("\n");
  const missing = (await catalog())
    .map((c) => c.id)
    .filter((id) => !['"', "'", "`"].some((q) => text.includes(`${q}${id}${q}`)));
  assert.deepEqual(missing, []);
});

test("a short edited line is carried when its surrounding block is embedded", () => {
  const root = mkdtempSync(path.join(tmpdir(), "probe-git-"));
  try {
    const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    mkdirSync(path.join(root, "plugins/adr-writer/skills/demo"), { recursive: true });
    const file = "plugins/adr-writer/skills/demo/SKILL.md";
    const before =
      "# Demo\n\nA verdict is never more certain\nthan `PASS`.\n\nEnd of the skill body.\n";
    writeFileSync(path.join(root, file), before);
    git("add", ".");
    git("commit", "-qm", "base");
    writeFileSync(path.join(root, file), before.replace("`PASS`", "`FAIL`"));
    const probes = changedProbes("HEAD", [file], root);
    assert.equal(probes[0].mention, "demo/SKILL.md");
    const embedded = readFileSync(path.join(root, file), "utf8").replace("# Demo\n", "");
    assert.deepEqual(carriedChanges(`Skill text:\n${embedded}`, probes), [file]);
    assert.deepEqual(carriedChanges(before, probes), [], "the old text does not carry the change");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a file name without a directory is not a mention", () => {
  const [probe] = changedProbes("HEAD", ["plugins/adr-writer/README.md"]);
  assert.equal(probe.mention, null);
});

test("a short line between blank lines and a deleted paragraph are carried in order", () => {
  const root = mkdtempSync(path.join(tmpdir(), "probe-git-blank-"));
  try {
    const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    mkdirSync(path.join(root, "plugins/adr-writer/skills/demo"), { recursive: true });
    const file = "plugins/adr-writer/skills/demo/SKILL.md";
    const before =
      "## Steps\n\n1. Read the ADR\n\n3. **Build the plan**\n\nOld paragraph to delete.\n\n4. Ship it\n";
    writeFileSync(path.join(root, file), before);
    git("add", ".");
    git("commit", "-qm", "base");
    const after = before
      .replace("**Build the plan**", "**Plan the build**")
      .replace("Old paragraph to delete.\n\n", "");
    writeFileSync(path.join(root, file), after);
    const probes = changedProbes("HEAD", [file], root);
    assert.deepEqual(carriedChanges(`Embedded:\n${after}`, probes), [file]);
    assert.deepEqual(carriedChanges(`Embedded:\n${before}`, probes), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a skill body that points at another skill carries a change to it", () => {
  const [probe] = changedProbes("HEAD", ["plugins/adr-writer/skills/adr-new/SKILL.md"]);
  assert.equal(probe.mention, "adr-new/SKILL.md");
  assert.deepEqual(carriedChanges("Then follow ../adr-new/SKILL.md for drafting.", [probe]), [
    "plugins/adr-writer/skills/adr-new/SKILL.md",
  ]);
});
