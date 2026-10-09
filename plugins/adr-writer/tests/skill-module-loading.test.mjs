import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { skillText, alpsSkillText } from "../evals/lib/harness.mjs";

const plugins = fileURLToPath(new URL("../../", import.meta.url));

test("each skill's explicit module links resolve after relocation, without eager loading", () => {
  let modules = 0;
  for (const plugin of ["adr-writer", "alps-writer"]) {
    const skills = path.join(plugins, plugin, "skills");
    for (const name of readdirSync(skills)) {
      const root = path.join(skills, name);
      const entry = path.join(root, "SKILL.md");
      if (!existsSync(entry)) continue;
      const core = readFileSync(entry, "utf8");
      const load = plugin === "adr-writer" ? skillText : alpsSkillText;
      assert.equal(load(name), core.replace(/^---\n[\s\S]*?\n---\n/, ""));
      const seen = new Set();
      const inspect = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        const source = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
        for (const [, target] of source.matchAll(/\[[^\]]+\]\(([^()\s]+\.md)(?:#[^()\s]*)?\)/g)) {
          if (/^[a-z]+:/i.test(target)) continue;
          const destination = path.resolve(path.dirname(file), target);
          assert.ok(existsSync(destination), `${file} has a broken link: ${target}`);
          if (!destination.startsWith(path.join(root, "references") + path.sep)) continue;
          const body = readFileSync(destination, "utf8");
          assert.ok(body.trim(), `${destination} is empty`);
          assert.ok(!core.includes(body), `${name} eagerly embeds a module`);
          modules++;
          inspect(destination);
        }
      };
      inspect(entry);
    }
  }
  assert.ok(modules > 0, "expected module links in shipped skills");
});

test("explicit module selection includes its real instructions but not sibling workflows", () => {
  const reference = "skills/adr-rollup/references/candidate-contract.md";
  const body = readFileSync(path.join(plugins, "adr-writer", reference), "utf8");
  const sibling = readFileSync(
    path.join(plugins, "adr-writer/skills/adr-rollup/references/approval-and-apply.md"),
    "utf8",
  );
  const selected = skillText("adr-rollup", { references: [reference] });
  assert.ok(selected.includes(body));
  assert.ok(!selected.includes(sibling));
  assert.throws(
    () => skillText("adr-rollup", { references: ["skills/adr-new/references/draft-and-index.md"] }),
    /not directly referenced/,
  );
});
